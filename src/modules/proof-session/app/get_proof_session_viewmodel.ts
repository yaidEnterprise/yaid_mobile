import { ProofSession } from '../../../shared/domain/entities/proof_session';
import { ProofType } from '../../../shared/domain/enums/proof_type';

export interface GetProofSessionDisplay {
  companyName: string;
  proofTypeLabel: string;
  canDecide: boolean;
}

const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  [ProofType.Personhood]: 'você é uma pessoa real',
  [ProofType.AgeOver18]: 'você tem mais de 18 anos',
};

export class GetProofSessionViewModel {
  fromSession(session: ProofSession): GetProofSessionDisplay {
    return {
      companyName: session.companyName,
      proofTypeLabel: PROOF_TYPE_LABELS[session.proofType],
      canDecide: true,
    };
  }
}
