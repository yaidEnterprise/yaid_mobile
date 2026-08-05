import { Stage } from './domain/enums/stage';
import { IClock } from './domain/interfaces/providers/clock';
import { IPinLock } from './domain/interfaces/providers/pin_lock';
import { IRandomness } from './domain/interfaces/providers/randomness';
import { IIdentityRepository } from './domain/interfaces/repositories/identity_repository';
import { ClockConcrete } from './infra/providers/clock_concrete';
import { ClockMock } from './infra/providers/mock/clock_mock';
import { PinLockConcrete } from './infra/providers/pin_lock_concrete';
import { PinLockMock } from './infra/providers/mock/pin_lock_mock';
import { RandomnessConcrete } from './infra/providers/randomness_concrete';
import { RandomnessMock } from './infra/providers/mock/randomness_mock';
import { IdentityRepositoryConcrete } from './infra/repositories/identity_repository_concrete';
import { IdentityRepositoryMock } from './infra/repositories/mock/identity_repository_mock';

function resolveStage(): Stage {
  const raw = process.env.EXPO_PUBLIC_STAGE;
  if (raw === Stage.Test || raw === Stage.Dev || raw === Stage.Homol || raw === Stage.Prod) {
    return raw;
  }
  throw new Error(
    `Invalid or missing EXPO_PUBLIC_STAGE: "${raw}". Expected one of: test, dev, homol, prod.`,
  );
}

export const environments = {
  stage: resolveStage(),
};

function isTestStage(): boolean {
  return environments.stage === Stage.Test;
}

export function createClock(): IClock {
  return isTestStage() ? new ClockMock() : new ClockConcrete();
}

export function createPinLock(clock: IClock): IPinLock {
  return isTestStage() ? new PinLockMock(clock) : new PinLockConcrete(clock);
}

export function createRandomness(): IRandomness {
  return isTestStage() ? new RandomnessMock() : new RandomnessConcrete();
}

export function createIdentityRepository(): IIdentityRepository {
  return isTestStage() ? new IdentityRepositoryMock() : new IdentityRepositoryConcrete();
}
