import {
  IYaIDApi,
  IssueCredentialParams,
  GetProofSessionParams,
  GetChallengeParams,
  VerifyPresentationParams,
  CancelProofSessionParams,
  RevokeCredentialParams,
} from '../../domain/interfaces/providers/yaid_api';
import { Credential } from '../../domain/entities/credential';
import { ProofSession } from '../../domain/entities/proof_session';
import { IssuanceApiError, IssuanceApiErrorCause } from '../../domain/errors/credential_errors';
import {
  AuthClockSkewError,
  PresentationRejectedError,
  SessionExpiredError,
  SessionNotFoundError,
} from '../../domain/errors/presentation_errors';
import { RevocationApiError } from '../../domain/errors/revocation_errors';
import { Ed25519Client } from '../../clients/ed25519_client';
import { HttpClient, NetworkFailureError } from '../../clients/http_client';
import { encodeBase64Url as toBase64Url } from '../../clients/base64url';
import { vcResponseToCredential } from '../dto/issue_credential_dto';
import { proofSessionDtoToEntity } from '../dto/proof_session_dto';

const ISSUE_PATH = '/api/credentials/issue';

function proofSessionPath(sessionToken: string): string {
  return `/api/proof-sessions/${sessionToken}`;
}

function challengePath(sessionToken: string): string {
  return `${proofSessionPath(sessionToken)}/challenge`;
}

function cancelPath(sessionToken: string): string {
  return `${proofSessionPath(sessionToken)}/cancel`;
}

const VERIFY_PATH = '/api/presentations/verify';
const REVOKE_PATH = '/api/credentials/revoke';

async function didAuthHeaders(
  method: 'GET' | 'POST',
  path: string,
  seed: Uint8Array,
  did: string,
  timestamp: string,
): Promise<Record<string, string>> {
  const authPayload = `${timestamp}:${method}:${path}`;
  const authSig = toBase64Url(await Ed25519Client.sign(new TextEncoder().encode(authPayload), seed));
  return {
    'X-YaID-DID': did,
    'X-YaID-Timestamp': timestamp,
    'X-YaID-Signature': authSig,
  };
}

function readErrorMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === 'string') {
      return e;
    }
    if (typeof e === 'object' && e !== null && 'message' in e) {
      const message = (e as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
  }
  return 'Erro desconhecido';
}

function causeForStatus(status: number, message: string): IssuanceApiErrorCause {
  if (status === 401) {
    return message === 'Request expired' ? 'clock_skew' : 'unknown';
  }
  if (status === 422) {
    return 'document_unreadable';
  }
  if (status === 502) {
    return 'server_unavailable';
  }
  return 'unknown';
}

export class YaIDApiConcrete implements IYaIDApi {
  async issueCredential(params: IssueCredentialParams): Promise<Credential> {
    const timestamp = params.clock.nowSeconds().toString();
    const authPayload = `${timestamp}:POST:${ISSUE_PATH}`;
    const authSig = toBase64Url(
      await Ed25519Client.sign(new TextEncoder().encode(authPayload), params.seed),
    );

    const bodyPayload = params.documentImage;
    const bodySig = toBase64Url(
      await Ed25519Client.sign(new TextEncoder().encode(bodyPayload), params.seed),
    );

    let response;
    try {
      response = await HttpClient.post(
        ISSUE_PATH,
        {
          'X-YaID-DID': params.did,
          'X-YaID-Timestamp': timestamp,
          'X-YaID-Signature': authSig,
        },
        {
          documentImage: params.documentImage,
          bodySignature: bodySig,
        },
      );
    } catch (error) {
      if (error instanceof NetworkFailureError) {
        throw new IssuanceApiError('no_connection', error.message);
      }
      throw error;
    }

    const rawBody = await response.text();

    if (response.status === 201) {
      return vcResponseToCredential(rawBody);
    }

    const message = readErrorMessage(JSON.parse(rawBody));
    const cause = causeForStatus(response.status, message);
    console.error(
      `[YaIDApi] issueCredential failed: status=${response.status} cause=${cause} body=${rawBody}`,
    );
    throw new IssuanceApiError(cause, message);
  }

  async getProofSession(params: GetProofSessionParams): Promise<ProofSession> {
    const response = await HttpClient.get(proofSessionPath(params.sessionToken));
    const rawBody = await response.text();

    if (response.status === 200) {
      return proofSessionDtoToEntity(JSON.parse(rawBody));
    }

    throw new SessionNotFoundError();
  }

  async getChallenge(params: GetChallengeParams): Promise<{ nonce: string }> {
    const timestamp = params.clock.nowSeconds().toString();
    const path = challengePath(params.sessionToken);
    const headers = await didAuthHeaders('GET', path, params.seed, params.did, timestamp);

    const response = await HttpClient.get(path, headers);
    const rawBody = await response.text();

    if (response.status === 200) {
      return { nonce: JSON.parse(rawBody).nonce };
    }

    if (response.status === 401 && readErrorMessage(JSON.parse(rawBody)) === 'Request expired') {
      throw new AuthClockSkewError();
    }

    throw new SessionExpiredError();
  }

  async verifyPresentation(params: VerifyPresentationParams): Promise<{ verifiedAt: Date }> {
    const timestamp = params.clock.nowSeconds().toString();
    const headers = await didAuthHeaders('POST', VERIFY_PATH, params.seed, params.did, timestamp);

    const response = await HttpClient.post(VERIFY_PATH, headers, {
      vp: params.vp,
      sessionToken: params.sessionToken,
    });
    const rawBody = await response.text();
    const body = JSON.parse(rawBody);

    if (response.status === 200 && body.valid === true) {
      return { verifiedAt: new Date(body.verifiedAt) };
    }

    if (response.status === 401 && readErrorMessage(body) === 'Request expired') {
      throw new AuthClockSkewError();
    }

    throw new PresentationRejectedError();
  }

  async cancelProofSession(params: CancelProofSessionParams): Promise<void> {
    const timestamp = params.clock.nowSeconds().toString();
    const path = cancelPath(params.sessionToken);
    const headers = await didAuthHeaders('POST', path, params.seed, params.did, timestamp);

    try {
      await HttpClient.post(path, headers, {});
    } catch {
      // best-effort — cancel failure never blocks the user
    }
  }

  async revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }> {
    const timestamp = params.clock.nowSeconds().toString();
    const authPayload = `${timestamp}:POST:${REVOKE_PATH}`;
    const authSig = toBase64Url(
      await Ed25519Client.sign(new TextEncoder().encode(authPayload), params.seed),
    );
    const bodySig = toBase64Url(
      await Ed25519Client.sign(new TextEncoder().encode(params.vcId), params.seed),
    );

    let response;
    try {
      response = await HttpClient.post(
        REVOKE_PATH,
        {
          'X-YaID-DID': params.did,
          'X-YaID-Timestamp': timestamp,
          'X-YaID-Signature': authSig,
        },
        {
          vcId: params.vcId,
          bodySignature: bodySig,
        },
      );
    } catch (error) {
      if (error instanceof NetworkFailureError) {
        throw new RevocationApiError(false, true, error.message);
      }
      throw error;
    }

    const rawBody = await response.text();

    if (response.status === 200) {
      return { revoked: true };
    }

    const message = readErrorMessage(JSON.parse(rawBody));
    const isClockSkew = response.status === 401 && message === 'Request expired';
    throw new RevocationApiError(isClockSkew, false, message);
  }
}
