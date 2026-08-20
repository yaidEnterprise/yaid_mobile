import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RevokeCredentialViewModel } from '../../../../src/modules/credential/app/revoke_credential_viewmodel';

test('from(output) returns only revokedAt (formatted string) and credentialType (label)', () => {
  const viewModel = new RevokeCredentialViewModel();
  const display = viewModel.fromOutput({ revokedAt: new Date('2026-08-02T12:00:00Z'), ageOver18: true });

  assert.equal(typeof display.revokedAt, 'string');
  assert.equal(typeof display.credentialType, 'string');
  assert.deepEqual(Object.keys(display).sort(), ['credentialType', 'revokedAt']);
});

test('no seed/vcId/raw/holder leak — only the two display fields exist', () => {
  const viewModel = new RevokeCredentialViewModel();
  const display = viewModel.fromOutput({ revokedAt: new Date(0), ageOver18: false }) as unknown as Record<
    string,
    unknown
  >;

  assert.equal('vcId' in display, false);
  assert.equal('raw' in display, false);
  assert.equal('holder' in display, false);
  assert.equal('seed' in display, false);
});
