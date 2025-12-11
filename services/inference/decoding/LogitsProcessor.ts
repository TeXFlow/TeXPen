import { Tensor } from "@huggingface/transformers";
import { BeamState } from "../types";

export interface Candidate {
  tokens: number[];
  score: number;
  done: boolean;
  parentIndex: number;
}

export class LogitsProcessor {
  async process(
    logits: Tensor,
    beams: BeamState[],
    numBeams: number,
    repetitionPenalty: number,
    eosTokenId: number
  ): Promise<Candidate[]> {
    const batchSize = beams.length;
    const dims = logits.dims;

    // Validate dims
    if (!dims || dims.length !== 3) {
      throw new Error(`Unexpected logits dims: ${JSON.stringify(dims)}`);
    }
    const [batch, seqLen, vocabSize] = dims;
    if (batch !== batchSize) {
      throw new Error(`Logits batch (${batch}) != beams batch (${batchSize}).`);
    }

    // Read logits data
    let dataAny: any = logits;
    let rawData: Float32Array;
    if (typeof dataAny.getData === "function") {
      rawData = (await dataAny.getData()) as Float32Array;
    } else {
      rawData = dataAny.data as Float32Array;
    }

    const tokensPerBeam = seqLen * vocabSize;
    const lastPosOffset = (seqLen - 1) * vocabSize;
    const allCandidates: Candidate[] = [];

    for (let b = 0; b < batchSize; b++) {
      const beam = beams[b];

      if (beam.done) {
        allCandidates.push({ ...beam, parentIndex: b });
        continue;
      }

      const rowStart = b * tokensPerBeam + lastPosOffset;
      const rowSlice = rawData.subarray(rowStart, rowStart + vocabSize);

      // Copy to working buffer
      const logitsData = new Float32Array(rowSlice.length);
      logitsData.set(rowSlice);

      // Repetition penalty
      if (repetitionPenalty !== 1.0) {
        const counts = new Map<number, number>();
        for (const t of beam.tokens) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
        for (const [token] of counts) {
          if (token >= 0 && token < logitsData.length) {
            const v = logitsData[token];
            logitsData[token] =
              v < 0 ? v * repetitionPenalty : v / repetitionPenalty;
          }
        }
      }

      // Log-softmax
      let maxLogit = -Infinity;
      for (let i = 0; i < logitsData.length; i++) {
        if (logitsData[i] > maxLogit) maxLogit = logitsData[i];
      }

      let expSum = 0;
      for (let i = 0; i < logitsData.length; i++) {
        expSum += Math.exp(logitsData[i] - maxLogit);
      }
      const logSumExp = maxLogit + Math.log(expSum);

      // Top-K per beam (K = numBeams)
      const topCandidates: { idx: number; val: number }[] = [];
      const K = numBeams;

      for (let i = 0; i < logitsData.length; i++) {
        const val = logitsData[i];
        if (topCandidates.length < K) {
          topCandidates.push({ idx: i, val });
          topCandidates.sort((a, b) => b.val - a.val);
        } else if (val > topCandidates[topCandidates.length - 1].val) {
          topCandidates[topCandidates.length - 1] = { idx: i, val };
          topCandidates.sort((a, b) => b.val - a.val);
        }
      }

      for (const { idx, val } of topCandidates) {
        const logProb = val - logSumExp;
        allCandidates.push({
          tokens: [...beam.tokens, idx],
          score: beam.score + logProb,
          done: idx === eosTokenId,
          parentIndex: b,
        });
      }
    }

    return allCandidates;
  }
}
