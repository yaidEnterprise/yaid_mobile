export interface Identity {
  readonly seed: Uint8Array;
  readonly publicKey: Uint8Array;
  readonly did: string;
}

const DID_PATTERN = /^did:yaid:user:[0-9a-f]{64}$/;

export function createIdentity(params: {
  seed: Uint8Array;
  publicKey: Uint8Array;
  did: string;
}): Identity {
  if (params.seed.length !== 32) {
    throw new Error('Identity seed must be exactly 32 bytes');
  }
  if (params.publicKey.length !== 32) {
    throw new Error('Identity publicKey must be exactly 32 bytes');
  }
  if (!DID_PATTERN.test(params.did)) {
    throw new Error('Identity did must match did:yaid:user:<64 lowercase hex chars>');
  }
  return { seed: params.seed, publicKey: params.publicKey, did: params.did };
}
