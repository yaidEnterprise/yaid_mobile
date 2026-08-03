export class IdentityAlreadyExistsError extends Error {
  readonly kind = 'identity_already_exists';
}

export class IdentityCreationFailedError extends Error {
  readonly kind = 'identity_creation_failed';
  constructor(readonly cause: unknown) {
    super();
  }
}
