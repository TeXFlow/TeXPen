import { Tensor } from "@huggingface/transformers";
import { logToWindow } from "./debugUtils";

/**
 * Slice/gather batch dimension (dim 0) of a Tensor according to indices.
 * indices can contain duplicates (gather-with-replacement).
 * Uses getData() when available so it works with WebGPU tensors.
 */
export async function sliceTensorBatch(t: Tensor, indices: number[]): Promise<Tensor> {
  const dims = t.dims;
  if (!dims || dims.length === 0) return t;

  const oldBatch = dims[0];
  if (oldBatch === 0) {
    logToWindow("sliceTensorBatch: Found tensor with batch=0. Dims:", dims);
  }

  // Use getData() if available (ORT/WebGPU), otherwise fall back to .data
  let dataAny: any;
  const tt: any = t;
  if (typeof tt.getData === "function") {
    dataAny = await tt.getData();
  } else {
    dataAny = tt.data;
  }

  const totalSize = dataAny.length;
  const rowSize = totalSize / oldBatch;

  const ArrayCtor = dataAny.constructor as { new(len: number): any };
  const newData = new ArrayCtor(indices.length * rowSize);

  for (let newRow = 0; newRow < indices.length; newRow++) {
    const origRow = indices[newRow];
    if (origRow < 0 || origRow >= oldBatch) {
      throw new Error(
        `sliceTensorBatch: index ${origRow} out of range for batch=${oldBatch}. Dims: ${dims}`
      );
    }
    const srcStart = origRow * rowSize;
    const dstStart = newRow * rowSize;
    const slice = dataAny.subarray(srcStart, srcStart + rowSize);
    newData.set(slice, dstStart);
  }

  const dtype = (t as any).dtype ?? (t as any).type ?? "float32";
  const newTensor = new Tensor(dtype, newData, [indices.length, ...dims.slice(1)]);
  /* logToWindow("sliceTensorBatch output:", { dtype, dims: newTensor.dims, dataLen: newTensor.data.length }); */
  return newTensor;
}

/**
 * Slice tensor along sequence dimension (dim 2 for [Batch, Heads, Seq, Dim]).
 * @param t Tensor [B, H, S, D]
 * @param start Start index for sequence slice
 * @param end End index for sequence slice (optional)
 */
export async function sliceTensorSequence(t: Tensor, start: number, end?: number): Promise<Tensor> {
  const dims = t.dims;
  if (!dims || dims.length < 3) return t;

  const [batch, heads, seqLen, headDim] = dims;
  const actualEnd = end ?? seqLen;

  if (start === 0 && actualEnd === seqLen) return t;

  const newSeqLen = actualEnd - start;
  if (newSeqLen <= 0) {
    throw new Error(`sliceTensorSequence: invalid slice range [${start}:${actualEnd}] for seqLen=${seqLen}`);
  }

  // Linear access via .data / .getData()
  let dataAny: any;
  const tt: any = t;
  if (typeof tt.getData === "function") {
    dataAny = await tt.getData();
  } else {
    dataAny = tt.data;
  }

  const ArrayCtor = dataAny.constructor as { new(len: number): any };
  const totalSize = batch * heads * newSeqLen * headDim;
  const newData = new ArrayCtor(totalSize);

  // Buffer copy loop
  // Original stride:
  // batch -> heads -> seq -> dim
  // rowSize = headDim
  // headBlockSize = seqLen * headDim
  // batchBlockSize = heads * headBlockSize

  const headBlockSize = seqLen * headDim;
  const batchBlockSize = heads * headBlockSize;

  const newHeadBlockSize = newSeqLen * headDim;
  const rowSize = headDim;

  let dstOffset = 0;

  for (let b = 0; b < batch; b++) {
    for (let h = 0; h < heads; h++) {
      const srcHeadStart = b * batchBlockSize + h * headBlockSize;
      // Within this head, we want rows [start..actualEnd]
      const srcSeqStart = srcHeadStart + start * rowSize;
      const srcSeqEnd = srcHeadStart + actualEnd * rowSize;

      const slice = dataAny.subarray(srcSeqStart, srcSeqEnd);
      newData.set(slice, dstOffset);
      dstOffset += slice.length;
    }
  }

  const newDims = [...dims];
  newDims[2] = newSeqLen;

  const dtype = (t as any).dtype ?? (t as any).type ?? "float32";
  const outT = new Tensor(dtype, newData, newDims);
  /* logToWindow("sliceTensorSequence output:", { dtype, dims: outT.dims, dataLen: outT.data.length }); */
  return outT;
}

/**
 * Slice a flat ONNX KV cache:
 *   cache["past_key_values.0.decoder.key"] -> new cache with batch dim gathered.
 */
export async function sliceFlatCache(
  cache: Record<string, Tensor> | null,
  indices: number[]
): Promise<Record<string, Tensor> | null> {
  if (!cache) return null;
  const out: Record<string, Tensor> = {};
  for (const [key, val] of Object.entries(cache)) {
    if (isTensor(val)) {
      try {
        out[key] = await sliceTensorBatch(val, indices);
      } catch (e) {
        logToWindow(`sliceFlatCache: Warning: Error slicing key '${key}', dropping it from cache:`, e);
        // Do not throw; just omit this key from the output.
        // This forces re-computation/re-injection of dummy for this key in the next step.
      }
    } else {
      (out as any)[key] = val as any;
    }
  }
  return out;
}

/** Recursively dispose tensors inside a nested cache/outputs structure. */
export function disposeCache(cache: any): void {
  if (!cache) return;
  if (Array.isArray(cache)) {
    for (const item of cache) disposeCache(item);
  } else if (typeof cache === "object") {
    if (typeof (cache as any).dispose === "function") {
      (cache as any).dispose();
    } else {
      for (const key of Object.keys(cache)) {
        disposeCache((cache as any)[key]);
      }
    }
  }
}

/** Heuristic check for transformers.js Tensor / ORT Tensor without touching .data. */
export function isTensor(x: any): x is Tensor {
  return (
    x instanceof Tensor ||
    (x &&
      typeof x === "object" &&
      Array.isArray((x as any).dims) &&
      (typeof (x as any).getData === "function" ||
        (x as any).data !== undefined))
  );
}
