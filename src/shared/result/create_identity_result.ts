export type CreateIdentityResult =
  | { readonly kind: 'success'; readonly did: string }
  | { readonly kind: 'error'; readonly message: string };
