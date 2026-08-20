import { ProofSession } from '../domain/entities/proof_session';
import {
  SessionExpiredError,
  SessionIneligibleError,
  SessionNotFoundError,
} from '../domain/errors/presentation_errors';

export type GetProofSessionResult =
  | { readonly ok: true; readonly session: ProofSession; readonly canDecide: true }
  | { readonly ok: false; readonly reason: 'needs_identity' | 'needs_credential'; readonly companyName: string }
  | {
      readonly ok: false;
      readonly error: SessionNotFoundError | SessionExpiredError | SessionIneligibleError;
    };
