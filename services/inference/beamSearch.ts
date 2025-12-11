import { PreTrainedTokenizer, Tensor } from "@huggingface/transformers";
import { VisionEncoderDecoderModel } from "./types";
import { BeamSearch } from "./decoding/BeamSearch";

/**
 * Batched beam search with ONNX KV cache.
 * Wrapped around the refactored BeamSearch class.
 */
export async function beamSearch(
  model: VisionEncoderDecoderModel,
  tokenizer: PreTrainedTokenizer,
  pixelValues: Tensor,
  numBeams: number,
  signal?: AbortSignal,
  maxTokens: number = 256,
  repetitionPenalty: number = 1.0,
  forcedDecoderStartTokenId?: number
): Promise<string[]> {
  const searcher = new BeamSearch(model, tokenizer);
  return searcher.search(
    pixelValues,
    numBeams,
    signal,
    maxTokens,
    repetitionPenalty,
    forcedDecoderStartTokenId
  );
}
