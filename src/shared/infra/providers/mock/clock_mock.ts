import { IClock } from '../../../domain/interfaces/providers/clock';

export class ClockMock implements IClock {
  private currentMs: number;

  constructor(initialMs = 0) {
    this.currentMs = initialMs;
  }

  nowMs(): number {
    return this.currentMs;
  }

  nowSeconds(): number {
    return Math.floor(this.currentMs / 1000);
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }
}
