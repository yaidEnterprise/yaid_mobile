import { ProofSessionStatus } from '../enums/proof_session_status';
import { ProofType } from '../enums/proof_type';

export interface ProofSession {
  readonly token: string;
  readonly status: ProofSessionStatus;
  readonly proofType: ProofType;
  readonly companyName: string;
  readonly expiresAt: Date;
}
