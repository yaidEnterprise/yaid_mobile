import { IssuanceApiErrorCause } from '../domain/errors/credential_errors';

export type IssueCredentialResult =
  | { readonly kind: 'success'; readonly ageOver18: boolean; readonly issuedAt: Date }
  | { readonly kind: 'wrong_pin'; readonly attemptsRemaining: number }
  | { readonly kind: 'locked'; readonly remainingMs: number }
  | { readonly kind: 'api_error'; readonly cause: IssuanceApiErrorCause };
