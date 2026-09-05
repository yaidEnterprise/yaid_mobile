import { SessionNotFoundError } from '../domain/errors/presentation_errors';

export type CancelProofSessionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: SessionNotFoundError };
