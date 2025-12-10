import { PreTrainedTokenizer, Tensor } from '@huggingface/transformers';
import { VisionEncoderDecoderModel, Beam } from './types';

/**
 * Helper to gather specific batch indices from a tensor or structure of tensors.
 * Creates new Tensors with the selected logical batch rows.
 */
function gatherIndices(data: any, indices: number[]): any {
  if (!data) return null;

  // Handle Tensor
  if (data.dims && data.data) {
    const tensor = data as Tensor;
    const [B, ...dims] = tensor.dims;

    // If not batched (or batch=1 matched conceptually but we need to expand), 
    // we assume the first dim is batch. 
    // Safety check: if B doesn't match roughly?
    // Actually transformers.js output tensors always have batch at dim 0.

    // Calculate size of one batch row
    const totalSize = tensor.data.length;
    const stride = totalSize / B;

    const CTOR = tensor.data.constructor as any;
    const newData = new CTOR(indices.length * stride);

    for (let i = 0; i < indices.length; i++) {
      const src = indices[i];
      // Copy the slice
      const start = src * stride;
      newData.set(tensor.data.subarray(start, start + stride), i * stride);
    }

    return new Tensor(tensor.type, newData, [indices.length, ...dims]);
  }

  // Handle Array (e.g. past_key_values layers)
  if (Array.isArray(data)) {
    return data.map(item => gatherIndices(item, indices));
  }

  // Handle Object (e.g. encoder_outputs generic dict)
  if (typeof data === 'object') {
    const result: any = {};
    for (const key of Object.keys(data)) {
      result[key] = gatherIndices(data[key], indices);
    }
    return result;
  }

  return data;
}

/**
 * Helper to safely dispose any tensor-like structure
 */
function disposeData(data: any): void {
  if (!data) return;
  if (data.dispose && typeof data.dispose === 'function') {
    data.dispose();
  } else if (Array.isArray(data)) {
    data.forEach(d => disposeData(d));
  } else if (typeof data === 'object') {
    Object.values(data).forEach(v => disposeData(v));
  }
}

/**
 * Performs batched beam search decoding.
 * 
 * Secure & Fast:
 * - Runs all beams in a single batch (one session.run call).
 * - Avoids WebGPU concurrency crashes.
 * - Maximizes GPU utilization.
 */
export async function beamSearch(
  model: VisionEncoderDecoderModel,
  tokenizer: PreTrainedTokenizer,
  pixelValues: Tensor,
  numBeams: number,
  signal?: AbortSignal,
  maxTokens: number = 256,
  repetitionPenalty: number = 1.0,
): Promise<string[]> {
  const eosTokenId = tokenizer.eos_token_id as number;
  const bosTokenId = tokenizer.bos_token_id as number;
  const padTokenId = tokenizer.pad_token_id as number;

  // Active beams state
  // We track beams by their metadata. The actual tensors (past_key_values) vary in batch size.
  // indices: [batch_index] -> keeps track of which row in the current batch corresponds to which beam logic
  let activeBeams: { tokens: number[]; score: number; done: boolean }[] = [
    { tokens: [bosTokenId], score: 0, done: false }
  ];

  // Completed candidates
  const finalizedCandidates: Beam[] = [];

  // Tensors
  let encoderOutputs: any = null;
  let pastKeyValues: any = null;
  let currentDecoderInputIds: Tensor | null = null;

  try {
    // 1. Run Encoder ONCE (Batch=1)
    if (signal?.aborted) throw new Error("Aborted");
    if ((model as any).encoder) {
      encoderOutputs = await (model as any).encoder({
        pixel_values: pixelValues,
      });
    }

    // Loop
    for (let step = 0; step < maxTokens; step++) {
      if (signal?.aborted) throw new Error("Aborted");

      // Stop if all beams are done or we found enough candidates
      if (activeBeams.length === 0) break;
      if (finalizedCandidates.length >= numBeams) break;

      // Prepare inputs
      const batchSize = activeBeams.length;

      // Expand/Gather encoderOutputs if batch size changed or indices need alignment
      // Optimization: Only do this if batch size > 1 or logic dictates
      // For simplicity/correctness: In the first step, batch=1.
      // In step 1, we might expand to numBeams.

      // On step 0, pastKeyValues is null.
      // On step > 0, pastKeyValues has size of PREVIOUS batch.
      // We need to reorder pastKeyValues based on how we selected beams in the previous step.
      // (This reordering is handled at the END of the loop for the NEXT iteration).

      // Construct decoder_input_ids
      // If pastKeyValues is present, we only feed the LAST token.
      const useCache = pastKeyValues !== null;
      let inputIdsData: BigInt64Array;
      let inputShape: number[];

      if (useCache) {
        // Feed only last token [Batch, 1]
        inputIdsData = new BigInt64Array(batchSize);
        inputShape = [batchSize, 1];
        for (let i = 0; i < batchSize; i++) {
          const tokens = activeBeams[i].tokens;
          inputIdsData[i] = BigInt(tokens[tokens.length - 1]);
        }
      } else {
        // Feed full sequence (Step 0 usually) [Batch, SeqLen]
        // Assuming all beams have same length (they usually do in synchronized beam search)
        const seqLen = activeBeams[0].tokens.length;
        inputIdsData = new BigInt64Array(batchSize * seqLen);
        inputShape = [batchSize, seqLen];
        for (let i = 0; i < batchSize; i++) {
          const tokens = activeBeams[i].tokens;
          for (let j = 0; j < seqLen; j++) {
            inputIdsData[i * seqLen + j] = BigInt(tokens[j]);
          }
        }
      }

      // Dispose previous currentDecoderInputIds before creating a new one
      if (currentDecoderInputIds) currentDecoderInputIds.dispose();
      currentDecoderInputIds = new Tensor('int64', inputIdsData, inputShape);

      // Expand pixelValues to batch size [Batch, C, H, W]
      // We explicitly gather index 0 'batchSize' times
      let batchPixelValues: Tensor | null = null;

      try {
        batchPixelValues = gatherIndices(pixelValues, new Array(batchSize).fill(0));

        // Run Forward
        const forwardInputs: any = {
          encoder_outputs: encoderOutputs,
          decoder_input_ids: currentDecoderInputIds,
          pixel_values: batchPixelValues, // Required by some specialized ONNX graphs
          use_cache: true,
        };
        if (useCache) {
          forwardInputs.past_key_values = pastKeyValues;
        }

        const outputs = await (model as any).forward(forwardInputs);

        const logits = outputs.logits || outputs.decoder_logits; // [Batch, SeqLen, Vocab]
        const newPastKeyValues = outputs.past_key_values; // [Batch, ...] structure

        // Process outputs
        // Extract last token logits
        const [B, Seq, Vocab] = logits.dims;
        const vocabSize = Vocab;
        // We want the last time step for each batch row
        // logits buffer layout: Batch * Seq * Vocab

        // Collect all candidates from all beams
        // Format: { score, tokenId, beamIdx }
        const candidates: { score: number; tokenId: number; beamIdx: number }[] = [];
        const logitsData = logits.data; // Float32Array

        for (let b = 0; b < batchSize; b++) {
          // Pointer to start of this beam's logits at the last sequence position
          // offset = b * (Seq * Vocab) + (Seq - 1) * Vocab
          const offset = b * Seq * Vocab + (Seq - 1) * Vocab;

          // Find best token(s) for this beam
          // We can create a view
          const beamLogits = logitsData.subarray(offset, offset + Vocab);

          let maxLogit = -Infinity;
          for (let i = 0; i < vocabSize; i++) {
            if (beamLogits[i] > maxLogit) maxLogit = beamLogits[i];
          }

          let expSum = 0;
          // Compute logSoftmax implicitly or just sparse topK?
          // Beam search requires log_probs.
          // We can compute log_sum_exp
          for (let i = 0; i < vocabSize; i++) {
            expSum += Math.exp(beamLogits[i] - maxLogit);
          }
          const logSumExp = maxLogit + Math.log(expSum);

          // Apply penalty and collect top K
          // For efficiency, we just scan once
          const currentBeamScore = activeBeams[b].score;
          const currentTokens = new Set(activeBeams[b].tokens); // For penalty

          // Optimization: Don't sort entire vocabulary. Just keep top 2*numBeams global?
          // Or per beam? Standard is per beam expand, then global prune.
          // Since numBeams is small (~5), we can just push top K from this beam to global list.

          const beamCandidates: { val: number; idx: number }[] = [];

          for (let i = 0; i < vocabSize; i++) {
            let score = beamLogits[i];
            // Repetition Penalty
            if (repetitionPenalty !== 1.0 && currentTokens.has(i)) {
              score = score < 0 ? score * repetitionPenalty : score / repetitionPenalty;
            }

            score = score - logSumExp + currentBeamScore; // Add cumulative score

            // Maintain top K (numBeams) for this single beam
            // This ensures we have enough to fill global numBeams even if other beams die
            if (beamCandidates.length < numBeams) {
              beamCandidates.push({ val: score, idx: i });
              beamCandidates.sort((x, y) => x.val - y.val); // Ascending (min at 0)
            } else if (score > beamCandidates[0].val) {
              beamCandidates[0] = { val: score, idx: i };
              beamCandidates.sort((x, y) => x.val - y.val);
            }
          }

          // Add to global
          for (const cand of beamCandidates) {
            candidates.push({ score: cand.val, tokenId: cand.idx, beamIdx: b });
          }
        }

        // Dispose logits (keep newPastKeyValues)
        if (logits.dispose) logits.dispose();

        // Sort global candidates
        candidates.sort((a, b) => b.score - a.score);

        // Select best `numBeams` to proceed
        const nextBeams: typeof activeBeams = [];
        const nextBeamIndices: number[] = []; // Which batch row they come from

        let collected = 0;
        for (const cand of candidates) {
          if (collected >= numBeams && activeBeams[cand.beamIdx].tokens.length > 0) break; // Heuristic limit

          const parentBeam = activeBeams[cand.beamIdx];

          // If EOS
          if (cand.tokenId === eosTokenId) {
            finalizedCandidates.push({
              tokens: parentBeam.tokens, // Don't include EOS in output usually, or do? Transformers includes it.
              score: cand.score,
              done: true
            });
            // We don't continue this beam.
            // BUT we still count it towards collected? 
            // Usually separate bucket.
            continue;
          }

          // Create new active beam
          if (nextBeams.length < numBeams) {
            nextBeams.push({
              tokens: [...parentBeam.tokens, cand.tokenId],
              score: cand.score,
              done: false
            });
            nextBeamIndices.push(cand.beamIdx);
          }

          if (nextBeams.length >= numBeams) break;
        }

        // Prepare tensors for next step
        if (nextBeams.length === 0) break; // All finished

        // 1. Gather pastKeyValues based on nextBeamIndices
        // Dispose old pastKeyValues
        disposeData(pastKeyValues);
        pastKeyValues = gatherIndices(newPastKeyValues, nextBeamIndices);

        // Dispose the raw newPastKeyValues from yield (we cloned what we needed)
        // Wait, gatherIndices creates COPIES. So we must dispose the source `newPastKeyValues` fully.
        disposeData(newPastKeyValues);

        // 2. Expand/Gather encoderOutputs
        // If we are at step 0 (going to step 1), we expand from index 0 -> N
        // If step > 0, we gather based on parent indices
        const prevBatchSize = activeBeams.length;

        // Optimization: If indices effectively select everything 1:1, skip gather?
        // Rarely happens in beam search (beams diverge).

        // encoderOutputs was batch size `prevBatchSize`.
        // We need it to be `nextBeamIndices.length`.
        // If step == 0, `encoderOutputs` batch is 1. All `nextBeamIndices` are 0.
        const nextEncoderOutputs = gatherIndices(encoderOutputs, nextBeamIndices);
        disposeData(encoderOutputs); // Dispose old
        encoderOutputs = nextEncoderOutputs;

        activeBeams = nextBeams;
      } finally {
        if (batchPixelValues) (batchPixelValues as any).dispose();
        // currentDecoderInputIds is disposed at the start of the next iteration
        // or in the main finally block if the loop exits early.
      }
    }

  } catch (e) {
    if ((e as Error).message === "Aborted") throw e;
    console.error("Beam search error:", e);
    throw e;
  } finally {
    disposeData(encoderOutputs);
    disposeData(pastKeyValues);
    if (currentDecoderInputIds) currentDecoderInputIds.dispose();
  }

  // Merge active beams into finalized if any remain
  for (const beam of activeBeams) {
    finalizedCandidates.push(beam as Beam);
  }

  // Sort and decode
  finalizedCandidates.sort((a, b) => b.score - a.score);

  const results: string[] = [];
  for (const cand of finalizedCandidates.slice(0, numBeams)) {
    try {
      const text = tokenizer.decode(cand.tokens, { skip_special_tokens: true });
      if (!results.includes(text)) results.push(text);
    } catch (e) { }
  }

  return results;
}
