import { Quantization } from '../services/inference/types';

export async function isWebGPUAvailable(): Promise<boolean> {
  if (!navigator.gpu) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export interface DeviceCapabilities {
  hasGPU: boolean;
  memoryGB?: number;
}

export async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  const hasGPU = await isWebGPUAvailable();

  // navigator.deviceMemory returns approximate RAM in GB (can be 0.25, 0.5, 1, 2, 4, 8)
  const memoryGB = (navigator as any).deviceMemory;

  return {
    hasGPU,
    memoryGB
  };
}

export async function getDefaultQuantization(): Promise<Quantization> {
  const capabilities = await getDeviceCapabilities();

  console.log('[env] Device Capabilities:', capabilities);

  // If we have a GPU and at least 4GB of RAM (or unknown RAM, assume okay if GPU is present for now), default to fp32
  // Actually, if they have a GPU, they usually have reasonable RAM, but let's be safe.
  if (capabilities.hasGPU) {
    if (capabilities.memoryGB === undefined || capabilities.memoryGB >= 4) {
      return 'fp32';
    }
  }

  // Fallback for CPU-only or low memory devices
  return 'int8';
}
