import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetProofSessionViewModel } from '../../../../src/modules/proof-session/app/get_proof_session_viewmodel';
import { ProofSessionStatus } from '../../../../src/shared/domain/enums/proof_session_status';
import { ProofType } from '../../../../src/shared/domain/enums/proof_type';

test('exposes only companyName, proofTypeLabel, canDecide', () => {
  const viewModel = new GetProofSessionViewModel();
  const display = viewModel.fromSession({
    token: 'tok',
    status: ProofSessionStatus.WaitingUser,
    proofType: ProofType.Personhood,
    companyName: 'Empresa Parceira',
    expiresAt: new Date('2026-08-02T15:30:00Z'),
  });

  assert.deepEqual(Object.keys(display).sort(), ['canDecide', 'companyName', 'proofTypeLabel']);
  assert.equal(display.companyName, 'Empresa Parceira');
  assert.equal(display.canDecide, true);
});

test('maps personhood proofType to natural-language question', () => {
  const viewModel = new GetProofSessionViewModel();
  const display = viewModel.fromSession({
    token: 'tok',
    status: ProofSessionStatus.WaitingUser,
    proofType: ProofType.Personhood,
    companyName: 'Empresa',
    expiresAt: new Date('2026-08-02T15:30:00Z'),
  });

  assert.equal(display.proofTypeLabel, 'você é uma pessoa real');
});

test('maps age_over_18 proofType to natural-language question', () => {
  const viewModel = new GetProofSessionViewModel();
  const display = viewModel.fromSession({
    token: 'tok',
    status: ProofSessionStatus.WaitingUser,
    proofType: ProofType.AgeOver18,
    companyName: 'Empresa',
    expiresAt: new Date('2026-08-02T15:30:00Z'),
  });

  assert.equal(display.proofTypeLabel, 'você tem mais de 18 anos');
});
