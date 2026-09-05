import { IYaIDApi } from '../../../shared/domain/interfaces/providers/yaid_api';
import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { ICredentialRepository } from '../../../shared/domain/interfaces/repositories/credential_repository';
import { ProofType } from '../../../shared/domain/enums/proof_type';
import { ProofSessionStatus } from '../../../shared/domain/enums/proof_session_status';
import {
  SessionExpiredError,
  SessionIneligibleError,
} from '../../../shared/domain/errors/presentation_errors';
import { GetProofSessionResult } from '../../../shared/result/get_proof_session_result';

export interface GetProofSessionInput {
  sessionToken: string;
}

export class GetProofSessionUseCase {
  constructor(
    private readonly yaIDApi: IYaIDApi,
    private readonly identityRepository: IIdentityRepository,
    private readonly credentialRepository: ICredentialRepository,
  ) {}

  async execute(input: GetProofSessionInput): Promise<GetProofSessionResult> {
    const session = await this.yaIDApi.getProofSession({ sessionToken: input.sessionToken });

    if (session.status !== ProofSessionStatus.WaitingUser) {
      return { ok: false, error: new SessionExpiredError() };
    }

    const identity = await this.identityRepository.load();
    if (identity === null) {
      return { ok: false, reason: 'needs_identity', companyName: session.companyName };
    }

    const hasCredential = await this.credentialRepository.exists();
    if (!hasCredential) {
      return { ok: false, reason: 'needs_credential', companyName: session.companyName };
    }

    const credential = await this.credentialRepository.load();
    if (session.proofType === ProofType.AgeOver18 && credential?.ageOver18 === false) {
      return { ok: false, error: new SessionIneligibleError() };
    }

    return { ok: true, session, canDecide: true };
  }
}
