import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proofSessionDtoToEntity } from '../../../../src/shared/infra/dto/proof_session_dto';
import { ProofSessionStatus } from '../../../../src/shared/domain/enums/proof_session_status';
import { ProofType } from '../../../../src/shared/domain/enums/proof_type';

test('maps snake_case status and proofType to enums, ISO date to Date, passthrough fields', () => {
  const entity = proofSessionDtoToEntity({
    token: 'abc123',
    status: 'waiting_user',
    proofType: 'age_over_18',
    companyName: 'Empresa Parceira',
    expiresAt: '2026-08-02T15:30:00Z',
  });

  assert.equal(entity.token, 'abc123');
  assert.equal(entity.status, ProofSessionStatus.WaitingUser);
  assert.equal(entity.proofType, ProofType.AgeOver18);
  assert.equal(entity.companyName, 'Empresa Parceira');
  assert.ok(entity.expiresAt instanceof Date);
  assert.equal(entity.expiresAt.toISOString(), '2026-08-02T15:30:00.000Z');
});

test('maps personhood proofType', () => {
  const entity = proofSessionDtoToEntity({
    token: 'abc123',
    status: 'opened',
    proofType: 'personhood',
    companyName: 'Empresa Parceira',
    expiresAt: '2026-08-02T15:30:00Z',
  });

  assert.equal(entity.proofType, ProofType.Personhood);
  assert.equal(entity.status, ProofSessionStatus.Opened);
});

test('maps every status value', () => {
  const statuses: Array<[string, ProofSessionStatus]> = [
    ['waiting_user', ProofSessionStatus.WaitingUser],
    ['opened', ProofSessionStatus.Opened],
    ['approved_by_user', ProofSessionStatus.ApprovedByUser],
    ['expired', ProofSessionStatus.Expired],
    ['cancelled', ProofSessionStatus.Cancelled],
  ];

  for (const [wire, expected] of statuses) {
    const entity = proofSessionDtoToEntity({
      token: 't',
      status: wire as 'waiting_user',
      proofType: 'personhood',
      companyName: 'Empresa',
      expiresAt: '2026-08-02T15:30:00Z',
    });
    assert.equal(entity.status, expected);
  }
});
