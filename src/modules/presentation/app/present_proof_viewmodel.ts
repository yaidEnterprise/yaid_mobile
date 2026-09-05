import { PresentProofOutput } from './present_proof_usecase';

export interface PresentProofDisplay {
  verifiedAtLabel: string;
}

export class PresentProofViewModel {
  fromOutput(output: PresentProofOutput): PresentProofDisplay {
    return { verifiedAtLabel: output.verifiedAt.toLocaleString('pt-BR') };
  }
}
