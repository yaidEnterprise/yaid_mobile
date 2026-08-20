import { ProofSession } from '../../domain/entities/proof_session';
import { ProofSessionStatus } from '../../domain/enums/proof_session_status';
import { ProofType } from '../../domain/enums/proof_type';

export interface ProofSessionApiResponse {
  token: string;
  status: 'waiting_user' | 'opened' | 'approved_by_user' | 'expired' | 'cancelled';
  proofType: 'personhood' | 'age_over_18';
  companyName: string;
  expiresAt: string;
}

const STATUS_MAP: Record<ProofSessionApiResponse['status'], ProofSessionStatus> = {
  waiting_user: ProofSessionStatus.WaitingUser,
  opened: ProofSessionStatus.Opened,
  approved_by_user: ProofSessionStatus.ApprovedByUser,
  expired: ProofSessionStatus.Expired,
  cancelled: ProofSessionStatus.Cancelled,
};

const PROOF_TYPE_MAP: Record<ProofSessionApiResponse['proofType'], ProofType> = {
  personhood: ProofType.Personhood,
  age_over_18: ProofType.AgeOver18,
};

export function proofSessionDtoToEntity(dto: ProofSessionApiResponse): ProofSession {
  return {
    token: dto.token,
    status: STATUS_MAP[dto.status],
    proofType: PROOF_TYPE_MAP[dto.proofType],
    companyName: dto.companyName,
    expiresAt: new Date(dto.expiresAt),
  };
}
