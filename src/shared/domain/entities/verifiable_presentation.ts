export interface VPProof {
  readonly type: 'Ed25519Signature2020';
  readonly created: string;
  readonly verificationMethod: string;
  readonly proofPurpose: 'authentication';
  readonly signatureValue: string;
}

export interface VerifiablePresentation {
  readonly holder: string;
  readonly challenge: string;
  readonly verifiableCredential: string[];
  readonly proof: VPProof;
}
