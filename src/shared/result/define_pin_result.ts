export type DefinePinResult =
  | { readonly kind: 'success' }
  | { readonly kind: 'mismatch'; readonly message: string }
  | { readonly kind: 'obvious'; readonly message: string };
