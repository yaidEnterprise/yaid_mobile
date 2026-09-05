export interface Credential {
  readonly vcId: string;
  readonly raw: string;
  readonly issuedAt: Date;
  readonly holder: string;
  readonly ageOver18: boolean;
}

const DID_PATTERN = /^did:yaid:user:[0-9a-f]{64}$/;

export function createCredential(params: {
  vcId: string;
  raw: string;
  issuedAt: Date;
  holder: string;
  ageOver18: boolean;
}): Credential {
  if (!DID_PATTERN.test(params.holder)) {
    throw new Error('Credential holder must match did:yaid:user:<64 lowercase hex chars>');
  }
  return {
    vcId: params.vcId,
    raw: params.raw,
    issuedAt: params.issuedAt,
    holder: params.holder,
    ageOver18: params.ageOver18,
  };
}
