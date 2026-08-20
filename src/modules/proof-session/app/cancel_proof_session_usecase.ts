import { IIdentityRepository } from '../../../shared/domain/interfaces/repositories/identity_repository';
import { IYaIDApi } from '../../../shared/domain/interfaces/providers/yaid_api';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { CancelProofSessionResult } from '../../../shared/result/cancel_proof_session_result';

export interface CancelProofSessionInput {
  sessionToken: string;
}

export class CancelProofSessionUseCase {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly yaIDApi: IYaIDApi,
    private readonly clock: IClock,
  ) {}

  async execute(input: CancelProofSessionInput): Promise<CancelProofSessionResult> {
    const identity = await this.identityRepository.load();
    if (identity === null) {
      return { ok: true };
    }

    try {
      await this.yaIDApi.cancelProofSession({
        did: identity.did,
        seed: identity.seed,
        sessionToken: input.sessionToken,
        clock: this.clock,
      });
    } catch {
      // best-effort — refusal stands regardless of API outcome
    }

    return { ok: true };
  }
}
