export type VerifyPinResult =
  | { readonly kind: 'success' }
  | { readonly kind: 'wrong'; readonly attemptsRemaining: number }
  | { readonly kind: 'locked'; readonly remainingMs: number }
  | { readonly kind: 'cancelled' };
