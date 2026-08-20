import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IssueCredentialViewModel } from '../../../../src/modules/credential/app/issue_credential_viewmodel';
import { ClockMock } from '../../../../src/shared/infra/providers/mock/clock_mock';

test('output contains only ageOver18 and issuedAt — vcId, raw, holder, seed absent', () => {
  const viewModel = new IssueCredentialViewModel(new ClockMock(0));
  const issuedAt = new Date('2026-08-02T10:00:00Z');

  const output = viewModel.fromOutput({ ageOver18: true, issuedAt });

  assert.deepEqual(Object.keys(output).sort(), ['ageOver18', 'issuedAt']);
  assert.equal(output.ageOver18, true);
  assert.equal(output.issuedAt, issuedAt);
  assert.equal((output as unknown as Record<string, unknown>).vcId, undefined);
  assert.equal((output as unknown as Record<string, unknown>).raw, undefined);
  assert.equal((output as unknown as Record<string, unknown>).holder, undefined);
  assert.equal((output as unknown as Record<string, unknown>).seed, undefined);
});
