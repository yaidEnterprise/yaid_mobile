import { IPinLock } from '../../../shared/domain/interfaces/providers/pin_lock';
import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ICredentialRepository } from '../../../shared/domain/interfaces/repositories/credential_repository';
import { IYaIDApi } from '../../../shared/domain/interfaces/providers/yaid_api';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { Ed25519Client } from '../../../shared/clients/ed25519_client';
import { encodeBase64Url } from '../../../shared/clients/base64url';
import { VerifiablePresentation } from '../../../shared/domain/entities/verifiable_presentation';

export interface PresentProofInput {
  pin: string;
  sessionToken: string;
}

export interface PresentProofOutput {
  verifiedAt: Date;
}

export class PresentProofUseCase {
  constructor(
    private readonly pinLock: IPinLock,
    private readonly identityRepository: IIdentityRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly yaIDApi: IYaIDApi,
    private readonly clock: IClock,
  ) {}

  async execute(input: PresentProofInput): Promise<PresentProofOutput> {
    await this.pinLock.verify(input.pin);

    const identity = await this.identityRepository.load();
    if (identity === null) {
      throw new Error('PresentProofUseCase: no identity found');
    }

    const credential = await this.credentialRepository.load();
    if (credential === null) {
      throw new Error('PresentProofUseCase: no credential found');
    }

    const { nonce } = await this.yaIDApi.getChallenge({
      did: identity.did,
      seed: identity.seed,
      sessionToken: input.sessionToken,
      clock: this.clock,
    });

    const vpBody = {
      holder: identity.did,
      challenge: nonce,
      verifiableCredential: [credential.raw],
    };
    const payload = JSON.stringify(vpBody);
    const signature = await Ed25519Client.sign(new TextEncoder().encode(payload), identity.seed);

    const vp: VerifiablePresentation = {
      ...vpBody,
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date(this.clock.nowMs()).toISOString(),
        verificationMethod: `${identity.did}#key-1`,
        proofPurpose: 'authentication',
        signatureValue: encodeBase64Url(signature),
      },
    };

    const { verifiedAt } = await this.yaIDApi.verifyPresentation({
      did: identity.did,
      seed: identity.seed,
      sessionToken: input.sessionToken,
      vp,
      clock: this.clock,
    });

    return { verifiedAt };
  }
}
