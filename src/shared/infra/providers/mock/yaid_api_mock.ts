import {
  IYaIDApi,
  IssueCredentialParams,
  GetProofSessionParams,
  GetChallengeParams,
  VerifyPresentationParams,
  CancelProofSessionParams,
  RevokeCredentialParams,
} from '../../../domain/interfaces/providers/yaid_api';
import { Credential, createCredential } from '../../../domain/entities/credential';
import { ProofSession } from '../../../domain/entities/proof_session';
import { VerifiablePresentation } from '../../../domain/entities/verifiable_presentation';
import { ProofSessionStatus } from '../../../domain/enums/proof_session_status';
import { ProofType } from '../../../domain/enums/proof_type';
import { IssuanceApiError } from '../../../domain/errors/credential_errors';
import { RevocationApiError } from '../../../domain/errors/revocation_errors';
import { encodeBase64Url } from '../../../clients/base64url';

function mockVcJwt(params: {
  vcId: string;
  holder: string;
  issuedAtMs: number;
  ageOver18: boolean;
}): string {
  const header = { alg: 'EdDSA', typ: 'JWT', kid: `did:yaid:issuer:${'f'.repeat(64)}#key-1` };
  const payload = {
    iss: `did:yaid:issuer:${'f'.repeat(64)}`,
    sub: params.holder,
    jti: params.vcId,
    iat: Math.floor(params.issuedAtMs / 1000),
    nbf: Math.floor(params.issuedAtMs / 1000),
    vc: { personhood: true, ageOver18: params.ageOver18 },
  };
  const enc = (o: unknown) => encodeBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  return `${enc(header)}.${enc(payload)}.mock-signature`;
}

export class YaIDApiMock implements IYaIDApi {
  callCount = 0;
  lastParams: IssueCredentialParams | null = null;
  private scriptedError: IssuanceApiError | null = null;

  private proofSessionOverrides: Partial<ProofSession> = {};
  lastGetProofSessionParams: GetProofSessionParams | null = null;
  private getProofSessionError: Error | null = null;

  getChallengeCallCount = 0;
  private getChallengeError: Error | null = null;

  lastVerifyPresentationVp: VerifiablePresentation | null = null;
  private verifyPresentationError: Error | null = null;

  cancelProofSessionCallCount = 0;
  private cancelProofSessionError: Error | null = null;

  lastRevokeParams: RevokeCredentialParams | null = null;
  private revokeError: RevocationApiError | null = null;

  scriptError(error: IssuanceApiError): void {
    this.scriptedError = error;
  }

  scriptProofSession(overrides: Partial<ProofSession>): void {
    this.proofSessionOverrides = overrides;
  }

  scriptGetProofSessionError(error: Error): void {
    this.getProofSessionError = error;
  }

  scriptGetChallengeError(error: Error): void {
    this.getChallengeError = error;
  }

  scriptVerifyPresentationError(error: Error): void {
    this.verifyPresentationError = error;
  }

  scriptCancelProofSessionError(error: Error): void {
    this.cancelProofSessionError = error;
  }

  scriptRevokeCredential(error: RevocationApiError): void {
    this.revokeError = error;
  }

  async issueCredential(params: IssueCredentialParams): Promise<Credential> {
    this.callCount += 1;
    this.lastParams = params;

    if (this.scriptedError !== null) {
      throw this.scriptedError;
    }

    const raw = mockVcJwt({
      vcId: 'mock-vc-id',
      holder: params.did,
      issuedAtMs: params.clock.nowMs(),
      ageOver18: true,
    });
    return createCredential({
      vcId: 'mock-vc-id',
      raw,
      issuedAt: new Date(params.clock.nowMs()),
      holder: params.did,
      ageOver18: true,
    });
  }

  async getProofSession(params: GetProofSessionParams): Promise<ProofSession> {
    this.lastGetProofSessionParams = params;

    if (this.getProofSessionError !== null) {
      throw this.getProofSessionError;
    }

    return {
      token: params.sessionToken,
      status: ProofSessionStatus.WaitingUser,
      proofType: ProofType.Personhood,
      companyName: 'Empresa Parceira',
      expiresAt: new Date('2026-08-02T15:30:00Z'),
      ...this.proofSessionOverrides,
    };
  }

  async getChallenge(params: GetChallengeParams): Promise<{ nonce: string }> {
    this.getChallengeCallCount += 1;

    if (this.getChallengeError !== null) {
      throw this.getChallengeError;
    }

    return { nonce: 'test-nonce-fixed' };
  }

  async verifyPresentation(params: VerifyPresentationParams): Promise<{ verifiedAt: Date }> {
    this.lastVerifyPresentationVp = params.vp;

    if (this.verifyPresentationError !== null) {
      throw this.verifyPresentationError;
    }

    return { verifiedAt: new Date(params.clock.nowMs()) };
  }

  async cancelProofSession(params: CancelProofSessionParams): Promise<void> {
    this.cancelProofSessionCallCount += 1;

    if (this.cancelProofSessionError !== null) {
      throw this.cancelProofSessionError;
    }
  }

  async revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }> {
    this.lastRevokeParams = params;

    if (this.revokeError !== null) {
      throw this.revokeError;
    }

    return { revoked: true };
  }
}
