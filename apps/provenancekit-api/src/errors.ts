// apps/replay-api/src/errors.ts
import { ZodError } from "zod";

/** All Replay‑specific error codes */
export type ErrorCode =
  | "MissingField" // required field absent
  | "InvalidField" // type/format wrong
  | "ValidationError" // Zod aggregated errors
  | "Duplicate" // conflict / already exists
  | "Unsupported" // unsupported media or operation
  | "NotFound" // resource not found
  | "EmbeddingFailed" // ML encoder failure
  | "Internal"; // any uncaught error

export class ReplayError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Human hint to fix the problem (optional) */
  readonly recovery?: string;
  /** Any extra diagnostic data */
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    {
      status,
      recovery,
      details,
    }: { status?: number; recovery?: string; details?: unknown } = {}
  ) {
    super(message);
    this.code = code;
    this.status =
      status ??
      {
        MissingField: 400,
        InvalidField: 400,
        ValidationError: 422,
        Duplicate: 409,
        Unsupported: 415,
        NotFound: 404,
        EmbeddingFailed: 502,
        Internal: 500,
      }[code];
    this.recovery = recovery;
    this.details = details;
  }

  /* Helper: convert Zod errors → ValidationError */
  static fromZod(err: ZodError): ReplayError {
    return new ReplayError("ValidationError", "Payload validation failed", {
      details: err.flatten(),
      recovery: "Review `details` and supply fields in the correct shape",
    });
  }
}

/** Wrap *any* thrown value into ReplayError(Internal) */
export function toReplayError(err: unknown): ReplayError {
  if (err instanceof ReplayError) return err;
  if (err instanceof ZodError) return ReplayError.fromZod(err);
  console.error(err); // full stack trace for ops
  return new ReplayError("Internal", "Internal server error");
}
