export class CredentialNotFoundError extends Error {
  readonly kind = 'credential_not_found';
}

export class CredentialAlreadyExistsError extends Error {
  readonly kind = 'credential_already_exists';
}

export type IssuanceApiErrorCause =
  | 'document_unreadable'
  | 'server_unavailable'
  | 'clock_skew'
  | 'no_connection'
  | 'unknown';

export class IssuanceApiError extends Error {
  readonly kind = 'issuance_api_error';
  constructor(
    readonly cause: IssuanceApiErrorCause,
    message: string,
  ) {
    super(message);
  }
}
