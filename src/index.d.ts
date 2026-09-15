export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'eot' | 'svg' | 'pfa' | 'pfb' | 'cff' | 't42' | 'ps' | 'pt3' | 'dfont' | 'suit' | 'bin' | 'ufo' | 'ttc' | 'afm' | 'pfm' | 'tfm' | 'fon' | 't11' | 'sfd' | 'bdf' | 'fnt' | 'otb' | 'pdb' | 'pcf';
export type FontOutputFormat = Exclude<FontFormat, 'pcf'>;
export type FontInputFormat = Exclude<FontFormat, 'afm' | 'pfm' | 'tfm'>;
export interface ConversionProgress {
  stage: 'assets' | 'worker' | 'initialize' | 'input' | 'convert' | 'converted' | 'output' | 'decode' | 'package';
  message: string;
  /** Measured inside the worker for the native conversion stage. */
  durationMs?: number;
}
export interface ConvertOptions {
  format: FontOutputFormat;
  /** Optional hint for ambiguous legacy containers and PostScript aliases. */
  inputFormat?: FontInputFormat;
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

export declare const FORMATS: readonly Readonly<{ id: FontFormat; native: number; label: string; input: boolean; output: boolean; preview?: boolean; extension?: string; note?: string }>[];

export interface ScriptLimits {
  /** Cumulative per-inode peak storage, including deleted files. Maximum 64 MiB. */
  maxFileSystemBytes?: number;
  /** Cumulative created files/directories/links, including deleted entries. Maximum 1024. */
  maxEntries?: number;
  /** Maximum copied result data, 32 MiB. */
  maxOutputBytes?: number;
  /** Combined UTF-8 stdout/stderr budget including line separators, 64 KiB. */
  maxLogBytes?: number;
}
export interface ScriptLog {
  stream: 'stdout' | 'stderr';
  message: string;
  elapsedMs: number;
}
export interface ExecuteOptions {
  args?: string[];
  /** Absolute /work/ paths; input buffers are copied, never detached. */
  files?: Record<string, Uint8Array>;
  /** Explicit regular files to return. Missing outputs are omitted, including after errors. */
  outputPaths?: string[];
  limits?: ScriptLimits;
  signal?: AbortSignal;
  timeoutMs?: number;
  cache?: 'default' | 'no-store';
  onLog?: (event: ScriptLog) => void;
  onProgress?: (event: { stage: 'assets' | 'worker'; message: string }) => void;
}
export interface ExecuteResult {
  /** Native script errors resolve with nonzero status; infrastructure/limit failures reject. */
  exitCode: number;
  files: Record<string, Uint8Array>;
  stdout: string;
  stderr: string;
}
export declare const SCRIPT_LIMITS: Readonly<Required<ScriptLimits>>;
/** Executes the FontForge native language, not Python or a shell. One worker per call. */
export declare function execute(script: string, options?: ExecuteOptions): Promise<ExecuteResult>;
