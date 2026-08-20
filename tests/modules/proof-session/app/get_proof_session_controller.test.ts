import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetProofSessionUseCase } from '../../../../src/modules/proof-session/app/get_proof_session_usecase';
import { GetProofSessionViewModel } from '../../../../src/modules/proof-session/app/get_proof_session_viewmodel';
import { GetProofSessionController } from '../../../../src/modules/proof-session/app/get_proof_session_controller';
import { YaIDApiMock } from '../../../../src/shared/infra/providers/mock/yaid_api_mock';
import { IdentityRepositoryMock } from '../../../../src/shared/infra/repositories/mock/identity_repository_mock';
import { CredentialRepositoryMock } from '../../../../src/shared/infra/repositories/mock/credential_repository_mock';
import { createIdentity } from '../../../../src/shared/domain/entities/identity';
import { createCredential } from '../../../../src/shared/domain/entities/credential';
import { ProofSessionStatus } from '../../../../src/shared/domain/enums/proof_session_status';
import { ProofType } from '../../../../src/shared/domain/enums/proof_type';

const DID = `did:yaid:user:${'a'.repeat(64)}`;

function makeController() {
  const yaIDApi = new YaIDApiMock();
  const identityRepository = new IdentityRepositoryMock();
  const credentialRepository = new CredentialRepositoryMock();
  const useCase = new GetProofSessionUseCase(yaIDApi, identityRepository, credentialRepository);
  const viewModel = new GetProofSessionViewModel();
  const controller = new GetProofSessionController(useCase, viewModel);
  return { controller, yaIDApi, identityRepository, credentialRepository };
}

test('success result exposes companyName, proofTypeLabel, canDecide', async () => {
  const { controller, yaIDApi, identityRepository, credentialRepository } = makeController();
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
  await credentialRepository.save(
    createCredential({ vcId: 'vc', raw: '{}', issuedAt: new Date(), holder: DID, ageOver18: true }),
  );
  yaIDApi.scriptProofSession({ status: ProofSessionStatus.WaitingUser, proofType: ProofType.Personhood });

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'success');
  if (result.kind === 'success') {
    assert.equal(result.canDecide, true);
    assert.ok(result.companyName.length > 0);
  }
});

test('needs_identity result propagates companyName', async () => {
  const { controller, yaIDApi } = makeController();
  yaIDApi.scriptProofSession({ companyName: 'Empresa X' });

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'needs_identity');
  if (result.kind === 'needs_identity') {
    assert.equal(result.companyName, 'Empresa X');
  }
});

test('needs_credential result propagates companyName', async () => {
  const { controller, yaIDApi, identityRepository } = makeController();
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
  yaIDApi.scriptProofSession({ companyName: 'Empresa Y' });

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'needs_credential');
  if (result.kind === 'needs_credential') {
    assert.equal(result.companyName, 'Empresa Y');
  }
});

test('ineligible result surfaces error kind', async () => {
  const { controller, yaIDApi, identityRepository, credentialRepository } = makeController();
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
  await credentialRepository.save(
    createCredential({ vcId: 'vc', raw: '{}', issuedAt: new Date(), holder: DID, ageOver18: false }),
  );
  yaIDApi.scriptProofSession({ status: ProofSessionStatus.WaitingUser, proofType: ProofType.AgeOver18 });

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'ineligible');
});

test('expired result surfaces error kind', async () => {
  const { controller, yaIDApi, identityRepository, credentialRepository } = makeController();
  await identityRepository.save(
    createIdentity({ seed: new Uint8Array(32).fill(3), publicKey: new Uint8Array(32).fill(1), did: DID }),
  );
  await credentialRepository.save(
    createCredential({ vcId: 'vc', raw: '{}', issuedAt: new Date(), holder: DID, ageOver18: true }),
  );
  yaIDApi.scriptProofSession({ status: ProofSessionStatus.Expired });

  const result = await controller.execute({ sessionToken: 'tok' });

  assert.equal(result.kind, 'expired');
});
