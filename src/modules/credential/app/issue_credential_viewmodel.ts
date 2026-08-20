import { IssueCredentialOutput } from './issue_credential_usecase';
import { IClock } from '../../../shared/domain/interfaces/providers/clock';
import { PinBackoffActiveError } from '../../../shared/domain/errors/pin_errors';

export interface IssueCredentialDisplay {
  ageOver18: boolean;
  issuedAt: Date;
}

export interface LockedPinDisplay {
  remainingMs: number;
}

export class IssueCredentialViewModel {
  constructor(private readonly clock: IClock) {}

  fromOutput(output: IssueCredentialOutput): IssueCredentialDisplay {
    return { ageOver18: output.ageOver18, issuedAt: output.issuedAt };
  }

  fromBackoffError(error: PinBackoffActiveError): LockedPinDisplay {
    return { remainingMs: error.lockedUntilMs - this.clock.nowMs() };
  }
}
