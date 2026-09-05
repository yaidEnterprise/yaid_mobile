import { Stage } from './domain/enums/stage';
import { IClock } from './domain/interfaces/providers/clock';
import { IPinLock } from './domain/interfaces/providers/pin_lock';
import { IRandomness } from './domain/interfaces/providers/randomness';
import { IIdentityRepository } from './domain/interfaces/repositories/identity_repository';
import { ICredentialRepository } from './domain/interfaces/repositories/credential_repository';
import { IDocumentCapture } from './domain/interfaces/providers/document_capture';
import { IImageProcessor } from './domain/interfaces/providers/image_processor';
import { IYaIDApi } from './domain/interfaces/providers/yaid_api';
import { ClockMock } from './infra/providers/mock/clock_mock';
import { PinLockMock } from './infra/providers/mock/pin_lock_mock';
import { RandomnessMock } from './infra/providers/mock/randomness_mock';
import { IdentityRepositoryMock } from './infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from './infra/repositories/mock/credential_repository_mock';
import { DocumentCaptureMock } from './infra/providers/mock/document_capture_mock';
import { ImageProcessorMock } from './infra/providers/mock/image_processor_mock';
import { YaIDApiMock } from './infra/providers/mock/yaid_api_mock';

// Concrete providers wrap Expo/React Native native modules, whose source
// (e.g. node_modules/react-native/index.js) uses Flow syntax that only the
// Metro/Babel pipeline can parse. A static top-level import here would force
// every consumer of this file — including plain-Node tooling like the
// node:test runner, which never takes the concrete branch — to transform
// that graph too. Requiring them lazily, only inside the non-test branch,
// keeps that graph untouched outside of the Metro bundler that can handle it.

function resolveStage(): Stage {
  const raw = process.env.EXPO_PUBLIC_STAGE;
  if (raw === Stage.Test || raw === Stage.Dev || raw === Stage.Homol || raw === Stage.Prod) {
    return raw;
  }
  throw new Error(
    `Invalid or missing EXPO_PUBLIC_STAGE: "${raw}". Expected one of: test, dev, homol, prod.`,
  );
}

function resolveYaIDApiHost(): string {
  const raw = process.env.EXPO_PUBLIC_YAID_API_HOST;
  if (!raw || !/^https?:\/\//.test(raw)) {
    throw new Error(
      `Invalid or missing EXPO_PUBLIC_YAID_API_HOST: "${raw}". Expected a full URL, e.g. https://api.example.com or http://localhost:3000.`,
    );
  }
  return raw;
}

export const environments = {
  stage: resolveStage(),
  yaIDApiHost: resolveYaIDApiHost(),
};

function isTestStage(): boolean {
  return environments.stage === Stage.Test;
}

export function createClock(): IClock {
  if (isTestStage()) {
    return new ClockMock();
  }
  const { ClockConcrete } = require('./infra/providers/clock_concrete');
  return new ClockConcrete();
}

export function createPinLock(clock: IClock): IPinLock {
  if (isTestStage()) {
    return new PinLockMock(clock);
  }
  const { PinLockConcrete } = require('./infra/providers/pin_lock_concrete');
  return new PinLockConcrete(clock);
}

export function createRandomness(): IRandomness {
  if (isTestStage()) {
    return new RandomnessMock();
  }
  const { RandomnessConcrete } = require('./infra/providers/randomness_concrete');
  return new RandomnessConcrete();
}

export function createIdentityRepository(): IIdentityRepository {
  if (isTestStage()) {
    return new IdentityRepositoryMock();
  }
  const { IdentityRepositoryConcrete } = require('./infra/repositories/identity_repository_concrete');
  return new IdentityRepositoryConcrete();
}

export function createCredentialRepository(): ICredentialRepository {
  if (isTestStage()) {
    return new CredentialRepositoryMock();
  }
  const { CredentialRepositoryConcrete } = require('./infra/repositories/credential_repository_concrete');
  return new CredentialRepositoryConcrete();
}

export function createDocumentCapture(): IDocumentCapture {
  if (isTestStage()) {
    return new DocumentCaptureMock();
  }
  const { DocumentCaptureConcrete } = require('./infra/providers/document_capture_concrete');
  return new DocumentCaptureConcrete();
}

export function createImageProcessor(): IImageProcessor {
  if (isTestStage()) {
    return new ImageProcessorMock();
  }
  const { ImageProcessorConcrete } = require('./infra/providers/image_processor_concrete');
  return new ImageProcessorConcrete();
}

export function createYaIDApi(): IYaIDApi {
  if (isTestStage()) {
    return new YaIDApiMock();
  }
  const { YaIDApiConcrete } = require('./infra/providers/yaid_api_concrete');
  return new YaIDApiConcrete();
}
