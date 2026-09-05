import { PinBackoffActiveError, PinWrongError } from '../domain/errors/pin_errors';
import { AuthClockSkewError, PresentationRejectedError } from '../domain/errors/presentation_errors';

export type PresentProofResult =
  | { readonly ok: true; readonly verifiedAt: Date }
  | {
      readonly ok: false;
      readonly error: PinWrongError | PinBackoffActiveError | PresentationRejectedError | AuthClockSkewError;
    };
