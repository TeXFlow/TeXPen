/**
 * Postprocess for PaddleOCR Text Recognition
 * CTC Decode
 */

// Standard English Dict for PaddleOCR (96 keys usually)
// If the model is the multilingual one or specific english one, the dict changes.
// Using a standard printable ascii set as a safe default for "English" models.
// "0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~!"#$%&'()*+,-./ "
// Standard English Dict for PaddleOCR (95 keys + space)
// Order: 0-9, a-z, A-Z, punctuation, space
const DEFAULT_DICT = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ";

export function recPostprocess(
  data: Float32Array,
  dims: number[], // [1, SequenceLength, NumClasses]
  vocab: string = DEFAULT_DICT
): string {
  // dims: [Batch=1, SeqLen, NumClasses]
  const seqLen = dims[1];
  const numClasses = dims[2];

  // Diagnostic logging
  // console.log(`Text Rec Output - SeqLen: ${seqLen}, NumClasses: ${numClasses}`);

  const charIndices: number[] = [];

  // ArgMax per time step
  for (let t = 0; t < seqLen; t++) {
    let maxVal = -Infinity;
    let maxIdx = 0;

    const offset = t * numClasses;
    for (let c = 0; c < numClasses; c++) {
      const val = data[offset + c];
      if (val > maxVal) {
        maxVal = val;
        maxIdx = c;
      }
    }
    charIndices.push(maxIdx);
  }

  // CTC Decode: Drop repeats and blanks
  // In many PaddleOCR ONNX exports, the blank token is at index 0.
  // The dictionary characters then occupy indices 1 to N.
  const blankIdx = 0;

  let res = "";
  let lastIdx = -1;

  for (const idx of charIndices) {
    if (idx !== lastIdx && idx !== blankIdx) {
      // Since blank is at 0, the characters from vocab[0...N-1] are at idx 1...N
      const vocabIdx = idx - 1;
      if (vocabIdx >= 0 && vocabIdx < vocab.length) {
        res += vocab[vocabIdx];
      }
    }
    lastIdx = idx;
  }

  return res;
}
