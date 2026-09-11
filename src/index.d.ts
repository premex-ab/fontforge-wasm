export type FontFormat = 'ttf' | 'otf';
export interface ConversionProgress {
  stage: 'assets' | 'worker' | 'initialize' | 'input' | 'convert' | 'converted' | 'output';
  message: string;
  /** Measured inside the worker for the native conversion stage. */
  durationMs?: number;
}
export interface ConvertOptions {
  format: FontFormat;
  /** Browser engine asset policy; no-store also bypasses the in-memory asset cache. */
  cache?: 'default' | 'no-store';
  /** Lifecycle events. Exceptions thrown by this observer are ignored. */
  onProgress?: (event: ConversionProgress) => void;
  /** Terminates the worker and discards its in-memory files. */
  signal?: AbortSignal;
  /** Includes worker startup and WASM loading. Default 30000, maximum 300000. */
  timeoutMs?: number;
}
export declare class FontForgeError extends Error {
  readonly code: string;
}
export declare const MAX_INPUT_BYTES: number;
/** Converts a single static outline font; does not detach or mutate input. */
export declare function convert(input: Uint8Array, options: ConvertOptions): Promise<Uint8Array>;
