export type RevokeCredentialFailureKind =
  | 'pin_wrong'
  | 'pin_backoff'
  | 'no_credential'
  | 'clock_skew'
  | 'network_error'
  | 'api_error';

export type RevokeCredentialResult =
  | { readonly ok: true; readonly revokedAt: string; readonly credentialType: string }
  | {
      readonly ok: false;
      readonly kind: RevokeCredentialFailureKind;
      readonly message: string;
      readonly lockedUntilMs?: number;
      readonly attemptsRemaining?: number;
    };
