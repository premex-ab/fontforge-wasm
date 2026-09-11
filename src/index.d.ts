export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'eot' | 'svg' | 'pfa' | 'pfb' | 'cff' | 't42' | 'ps' | 'pt3' | 'dfont' | 'suit' | 'bin' | 'ufo' | 'ttc' | 'afm' | 'pfm' | 'tfm' | 'fon' | 't11';
export interface ConversionProgress {
  stage: 'assets' | 'worker' | 'initialize' | 'input' | 'convert' | 'converted' | 'output' | 'decode' | 'package';
  message: string;
  /** Measured inside the worker for the native conversion stage. */
  durationMs?: number;
}
export interface ConvertOptions {
  format: FontFormat;
  /** Optional hint for ambiguous legacy containers and PostScript aliases. */
  inputFormat?: FontFormat;
  /** Zero-based face index for TTC input. Defaults to 0. */
  faceIndex?: number;
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

export declare const FORMATS: readonly Readonly<{ id: FontFormat; native: number; label: string; input: boolean; preview?: boolean; extension?: string; note?: string }>[];
