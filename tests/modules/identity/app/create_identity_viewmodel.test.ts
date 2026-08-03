import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateIdentityViewModel } from '../../../../src/modules/identity/app/create_identity_viewmodel';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';

test('toDisplay output contains only { did }', () => {
  const viewModel = new CreateIdentityViewModel();
  const identity = createIdentity({
    seed: new Uint8Array(32).fill(3),
    publicKey: new Uint8Array(32).fill(4),
    did: `did:yaid:user:${'a'.repeat(64)}`,
  });
  const display = viewModel.toDisplay(identity);
  assert.deepEqual(Object.keys(display), ['did']);
  assert.equal(display.did, identity.did);
});

test('seed and publicKey fields are absent from the output', () => {
  const viewModel = new CreateIdentityViewModel();
  const identity = createIdentity({
    seed: new Uint8Array(32).fill(3),
    publicKey: new Uint8Array(32).fill(4),
    did: `did:yaid:user:${'b'.repeat(64)}`,
  });
  const display = viewModel.toDisplay(identity) as unknown as Record<string, unknown>;
  assert.equal('seed' in display, false);
  assert.equal('publicKey' in display, false);
});
