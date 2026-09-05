import { RevokeCredentialUseCase, RevokeCredentialInput } from './revoke_credential_usecase';
import { RevokeCredentialViewModel } from './revoke_credential_viewmodel';
import { RevokeCredentialResult } from '../../../shared/result/revoke_credential_result';
import { PinWrongError, PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';
import { CredentialNotFoundError } from '../../../shared/domain/errors/credential_errors';
import { RevocationApiError } from '../../../shared/domain/errors/revocation_errors';

export class RevokeCredentialController {
  constructor(
    private readonly useCase: RevokeCredentialUseCase,
    private readonly viewModel: RevokeCredentialViewModel,
  ) {}

  async execute(input: RevokeCredentialInput): Promise<RevokeCredentialResult> {
    try {
      const output = await this.useCase.execute(input);
      const display = this.viewModel.fromOutput(output);
      return { ok: true, revokedAt: display.revokedAt, credentialType: display.credentialType };
    } catch (error) {
      if (error instanceof PinWrongError) {
        return {
          ok: false,
          kind: 'pin_wrong',
          message: 'Senha incorreta.',
          attemptsRemaining: error.attemptsRemaining,
        };
      }
      if (error instanceof PinBackoffActiveError) {
        return {
          ok: false,
          kind: 'pin_backoff',
          message: 'Muitas tentativas incorretas. Tente novamente mais tarde.',
          lockedUntilMs: error.lockedUntilMs,
        };
      }
      if (error instanceof CredentialNotFoundError) {
        return { ok: false, kind: 'no_credential', message: 'Não há credencial a revogar.' };
      }
      if (error instanceof RevocationApiError) {
        if (error.isClockSkew) {
          return {
            ok: false,
            kind: 'clock_skew',
            message: 'A data e a hora do seu celular parecem incorretas. Ajuste e tente de novo.',
          };
        }
        if (error.isNetworkError) {
          return { ok: false, kind: 'network_error', message: 'Sem conexão. Verifique sua internet e tente novamente.' };
        }
        return { ok: false, kind: 'api_error', message: 'Não foi possível concluir a revogação. Tente novamente.' };
      }
      throw error;
    }
  }
}
