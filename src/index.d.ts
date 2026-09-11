export type FontFormat = 'ttf' | 'otf';
export interface ConvertOptions {
  format: FontFormat;
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
