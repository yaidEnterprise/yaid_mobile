import { RevokeCredentialOutput } from './revoke_credential_usecase';

export interface RevokeCredentialDisplay {
  revokedAt: string;
  credentialType: string;
}

export class RevokeCredentialViewModel {
  fromOutput(output: RevokeCredentialOutput): RevokeCredentialDisplay {
    return {
      revokedAt: output.revokedAt.toLocaleDateString('pt-BR'),
      credentialType: output.ageOver18 ? 'Maior de 18 anos' : 'Identidade',
    };
  }
}
