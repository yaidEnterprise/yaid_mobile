import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdentityRepositoryMock } from '../../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { createIdentity } from '../../../../../src/shared/domain/entities/identity';

const DID_A = `did:yaid:user:${'a'.repeat(64)}`;
const DID_B = `did:yaid:user:${'b'.repeat(64)}`;

test('save then load returns the same entity', async () => {
  const repo = new IdentityRepositoryMock();
  const identity = createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(32), did: DID_A });
  await repo.save(identity);
  const loaded = await repo.load();
  assert.deepEqual(loaded, identity);
});

test('load when empty returns null', async () => {
  const repo = new IdentityRepositoryMock();
  assert.equal(await repo.load(), null);
});

test('exists is false when empty and true after save', async () => {
  const repo = new IdentityRepositoryMock();
  assert.equal(await repo.exists(), false);
  const identity = createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(32), did: DID_A });
  await repo.save(identity);
  assert.equal(await repo.exists(), true);
});

test('clear after save makes exists false and load null', async () => {
  const repo = new IdentityRepositoryMock();
  const identity = createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(32), did: DID_A });
  await repo.save(identity);
  await repo.clear();
  assert.equal(await repo.exists(), false);
  assert.equal(await repo.load(), null);
});

test('clear when empty is idempotent and does not throw', async () => {
  const repo = new IdentityRepositoryMock();
  await assert.doesNotReject(() => repo.clear());
});

test('save twice: second write wins', async () => {
  const repo = new IdentityRepositoryMock();
  const first = createIdentity({ seed: new Uint8Array(32), publicKey: new Uint8Array(32), did: DID_A });
  const second = createIdentity({ seed: new Uint8Array(32).fill(1), publicKey: new Uint8Array(32).fill(2), did: DID_B });
  await repo.save(first);
  await repo.save(second);
  const loaded = await repo.load();
  assert.deepEqual(loaded, second);
});
