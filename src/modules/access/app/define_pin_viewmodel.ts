import { DefinePinOutput } from './define_pin_usecase';

export type DefinePinDisplay = Record<string, never>;

export class DefinePinViewModel {
  toDisplay(_output: DefinePinOutput): DefinePinDisplay {
    return {};
  }
}
