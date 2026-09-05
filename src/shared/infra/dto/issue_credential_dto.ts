import { Credential, createCredential } from '../../domain/entities/credential';
import { decodeBase64Url } from '../../clients/base64url';

interface VCJwtPayload {
  iss: string;
  sub: string;
  jti: string;
  iat: number;
  nbf: number;
  vc: {
    personhood: boolean;
    ageOver18: boolean;
  };
}

function decodeJwtPayload(jwt: string): VCJwtPayload {
  const payloadSegment = jwt.split('.')[1];
  const json = new TextDecoder().decode(decodeBase64Url(payloadSegment as string));
  return JSON.parse(json) as VCJwtPayload;
}

export function vcResponseToCredential(raw: string): Credential {
  const payload = decodeJwtPayload(raw);
  return createCredential({
    vcId: payload.jti,
    raw,
    issuedAt: new Date(payload.iat * 1000),
    holder: payload.sub,
    ageOver18: payload.vc.ageOver18 === true,
  });
}
