export class RevocationApiError extends Error {
  readonly kind = 'revocation_api_error';
  constructor(
    readonly isClockSkew: boolean,
    readonly isNetworkError: boolean,
    message: string,
  ) {
    super(message);
  }
}
