import { IClock } from '../../domain/interfaces/providers/clock';

export class ClockConcrete implements IClock {
  nowMs(): number {
    return Date.now();
  }

  nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
