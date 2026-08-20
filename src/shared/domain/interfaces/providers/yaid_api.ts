import { Credential } from '../../entities/credential';
import { ProofSession } from '../../entities/proof_session';
import { VerifiablePresentation } from '../../entities/verifiable_presentation';
import { IClock } from './clock';

export interface IssueCredentialParams {
  did: string;
  seed: Uint8Array;
  documentImage: string;
  clock: IClock;
}

export interface GetProofSessionParams {
  sessionToken: string;
}

export interface GetChallengeParams {
  did: string;
  seed: Uint8Array;
  sessionToken: string;
  clock: IClock;
}

export interface VerifyPresentationParams {
  did: string;
  seed: Uint8Array;
  sessionToken: string;
  vp: VerifiablePresentation;
  clock: IClock;
}

export interface CancelProofSessionParams {
  did: string;
  seed: Uint8Array;
  sessionToken: string;
  clock: IClock;
}

export interface RevokeCredentialParams {
  did: string;
  seed: Uint8Array;
  vcId: string;
  clock: IClock;
}

export interface IYaIDApi {
  issueCredential(params: IssueCredentialParams): Promise<Credential>;
  getProofSession(params: GetProofSessionParams): Promise<ProofSession>;
  getChallenge(params: GetChallengeParams): Promise<{ nonce: string }>;
  verifyPresentation(params: VerifyPresentationParams): Promise<{ verifiedAt: Date }>;
  cancelProofSession(params: CancelProofSessionParams): Promise<void>;
  revokeCredential(params: RevokeCredentialParams): Promise<{ revoked: true }>;
}
