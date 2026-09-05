import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CredentialRepositoryMock } from '../../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { createCredential } from '../../../../../src/shared/domain/entities/credential';

const HOLDER = `did:yaid:user:${'a'.repeat(64)}`;

function makeCredential() {
  return createCredential({
    vcId: 'uuid-1',
    raw: '{"id":"uuid-1"}',
    issuedAt: new Date('2026-08-02T10:00:00Z'),
    holder: HOLDER,
    ageOver18: true,
  });
}

test('save then load returns the same entity, raw verbatim', async () => {
  const repo = new CredentialRepositoryMock();
  const credential = makeCredential();
  await repo.save(credential);
  const loaded = await repo.load();
  assert.deepEqual(loaded, credential);
  assert.equal(loaded?.raw, credential.raw);
});

test('load when empty returns null', async () => {
  const repo = new CredentialRepositoryMock();
  assert.equal(await repo.load(), null);
});

test('exists is false when empty and true after save', async () => {
  const repo = new CredentialRepositoryMock();
  assert.equal(await repo.exists(), false);
  await repo.save(makeCredential());
  assert.equal(await repo.exists(), true);
});

test('delete after save makes exists false and load null', async () => {
  const repo = new CredentialRepositoryMock();
  await repo.save(makeCredential());
  await repo.delete();
  assert.equal(await repo.exists(), false);
  assert.equal(await repo.load(), null);
});

test('delete when empty does not throw', async () => {
  const repo = new CredentialRepositoryMock();
  await assert.doesNotReject(() => repo.delete());
});
