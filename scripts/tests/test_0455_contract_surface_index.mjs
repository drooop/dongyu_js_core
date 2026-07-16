import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildContractIndex,
  generateContractCoverageSummary,
  loadContractManifest,
  resolveContractArtifactPaths,
  validateContractManifest,
  writeContractArtifacts,
} from '../ops/build_contract_index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(repoRoot, 'docs/ssot/contract_surface_manifest.json');
const summaryPath = path.join(repoRoot, 'docs/ssot/contract_coverage_summary.md');
const indexPath = path.join(repoRoot, 'test_files/generated/contract_surface_index.json');
const backlogPath = path.join(repoRoot, 'docs/ssot/feishu_contract_backlog.md');
const sourceManifestPath = path.join(repoRoot, 'docs/ssot/feishu_source_watch_manifest.json');
const docsIndexPath = path.join(repoRoot, 'docs/README.md');
const agentsPath = path.join(repoRoot, 'AGENTS.md');
const claudePath = path.join(repoRoot, 'CLAUDE.md');
const alignmentPath = path.join(repoRoot, 'docs/ssot/feishu_alignment_decisions_v0.md');
const workflowPath = path.join(repoRoot, 'docs/WORKFLOW.md');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function test_contract_manifest_rejects_repository_path_escape() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].ssot_files = ['../../../../../etc/hosts'];
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /escapes repository root/u,
    'repo-relative contract paths must not escape the repository root',
  );
}

async function test_contract_index_requires_layer_specific_anchors() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].anchor_terms = {
    ssot_files: ['__missing_ssot_anchor__'],
    implementation_files: ['model.v1n'],
    test_files: ['test_model_v1n_is_accepted_at_worker_root'],
  };
  const index = buildContractIndex(manifest, { repoRoot });
  assert.deepEqual(
    index.missingAnchors,
    [{ contract_id: 'model.v1n.worker_root', field: 'ssot_files', term: '__missing_ssot_anchor__' }],
    'each required anchor term must be found within its declared file layer',
  );
}

async function test_contract_manifest_rejects_invalid_verification_target() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].verification_commands = ['false'];
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /unsupported verification command/u,
    'verification commands must point to supported repository checks',
  );
}

async function test_contract_manifest_rejects_unmapped_existing_verification_target() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].verification_commands = [
    'node scripts/tests/test_0455_contract_surface_index.mjs',
  ];
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /verification target is not declared in test_files/u,
    'an existing but unrelated test must not be accepted as contract verification',
  );
}

async function test_contract_manifest_rejects_generated_artifact_path_escape() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.generated_summary = '../contract-summary-outside-repo.md';
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /manifest\.generated_summary must be a repo-relative path/u,
    'generated artifact metadata must stay inside the repository',
  );

  const absoluteArtifactManifest = clone(loadContractManifest(manifestPath));
  absoluteArtifactManifest.generated_index = path.join(repoRoot, 'test_files/generated/contract-index.json');
  const absoluteArtifactValidation = validateContractManifest(absoluteArtifactManifest, { repoRoot });
  assert.match(
    absoluteArtifactValidation.errors.join('\n'),
    /manifest\.generated_index must be a repo-relative path/u,
    'generated artifact metadata must not use absolute paths even inside the repository',
  );

  const absoluteSourceManifest = clone(loadContractManifest(manifestPath));
  absoluteSourceManifest.source_manifest = sourceManifestPath;
  const absoluteSourceValidation = validateContractManifest(absoluteSourceManifest, { repoRoot });
  assert.match(
    absoluteSourceValidation.errors.join('\n'),
    /manifest\.source_manifest must be a repo-relative path/u,
    'the source manifest reference must remain repository-relative',
  );
}

async function test_contract_artifact_paths_follow_manifest_metadata_and_reject_escape() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.generated_summary = 'test_files/generated/alternate-contract-summary.md';
  manifest.generated_index = 'test_files/generated/alternate-contract-index.json';
  assert.deepEqual(resolveContractArtifactPaths(manifest, { repoRoot }), {
    summaryPath: path.join(repoRoot, manifest.generated_summary),
    indexPath: path.join(repoRoot, manifest.generated_index),
  });

  assert.throws(
    () => resolveContractArtifactPaths(manifest, {
      repoRoot,
      summaryPath: path.join(repoRoot, 'test_files/generated/absolute-summary.md'),
    }),
    /summary output must be repo-relative/u,
    'explicit artifact paths must be expressed relative to the repository',
  );

  assert.throws(
    () => resolveContractArtifactPaths(manifest, {
      repoRoot,
      summaryPath: '..',
    }),
    /summary output must stay within repository root/u,
    'explicit summary output must not escape the repository',
  );
  assert.throws(
    () => resolveContractArtifactPaths(manifest, {
      repoRoot,
      indexPath: '../outside-contract-index.json',
    }),
    /index output must stay within repository root/u,
    'explicit index output must not escape the repository',
  );
}

async function test_contract_manifest_rejects_stale_local_source_heading() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].source_refs = [
    'docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md#missing-heading',
  ];
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /source_refs heading not found/u,
    'local source references must point to an existing Markdown heading',
  );
}

async function test_contract_manifest_rejects_unknown_external_source_id() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].source_refs = ['missing-source-id'];
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /unknown source_refs id: missing-source-id/u,
    'external source ids must resolve through the source manifest',
  );
}

async function test_contract_manifest_rejects_derived_view_as_source_authority() {
  const manifest = clone(loadContractManifest(manifestPath));
  manifest.contracts[0].source_refs = ['main'];
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.match(
    validation.errors.join('\n'),
    /source_refs id is not UpstreamConsensus: main/u,
    'derived views must not become contract source authorities',
  );
}

async function test_feishu_source_manifest_encodes_approved_authority_model() {
  const manifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'));
  assert.equal(manifest.schema, 'feishu_source_watch_manifest.v2');

  const upstream = manifest.documents
    .filter((doc) => doc.authority_class === 'UpstreamConsensus')
    .map((doc) => doc.id)
    .sort();
  assert.deepEqual(upstream, ['feishu-message-api', 'feishu-model2']);

  const derived = manifest.documents.filter((doc) => doc.authority_class === 'DerivedView');
  assert.deepEqual(derived.map((doc) => doc.id).sort(), ['examples', 'main', 'planning', 'rules']);
  for (const doc of derived) {
    assert.deepEqual(
      [...doc.derives_from].sort(),
      upstream,
      `${doc.id} must derive from the approved upstream pair`,
    );
  }

  assert.deepEqual(
    manifest.supporting_source_slots,
    [
      { id: 'supporting-source-1', authority_class: 'SupportingSource', status: 'identity_pending', watch_enabled: false },
      { id: 'supporting-source-2', authority_class: 'SupportingSource', status: 'identity_pending', watch_enabled: false },
    ],
  );
}

async function test_contract_manifest_separates_authority_surfaces_and_open_findings() {
  const manifest = loadContractManifest(manifestPath);
  assert.equal(manifest.schema, 'contract_surface_manifest.v2');
  assert.equal(manifest.contracts.length, 10, 'v2 manifest must include the two missing open-contract routes');

  for (const contract of manifest.contracts) {
    assert.ok(Array.isArray(contract.source_refs));
    assert.ok(Array.isArray(contract.decision_files));
    assert.ok(Array.isArray(contract.evidence_files));
    assert.ok(Array.isArray(contract.open_findings));
    assert.equal(
      contract.ssot_files.includes('docs/ssot/feishu_contract_backlog.md'),
      false,
      `${contract.contract_id} must not treat the open-decision backlog as executable SSOT`,
    );
    assert.equal(
      contract.source_refs.some((ref) => ref.includes('current-diff-report.md')),
      false,
      `${contract.contract_id} must not treat iteration evidence as a source authority`,
    );
    assert.equal(
      contract.evidence_files.includes('docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md'),
      true,
      `${contract.contract_id} must retain the 0454 report only as evidence`,
    );
    for (const field of ['ssot_files', 'implementation_files', 'test_files']) {
      assert.ok(Array.isArray(contract.anchor_terms[field]) && contract.anchor_terms[field].length > 0);
    }
  }

  const findingClasses = Object.fromEntries(manifest.contracts.flatMap((contract) => (
    contract.open_findings.map((finding) => [finding.id, finding.class])
  )));
  assert.deepEqual(findingClasses, {
    'F-04': 'decision_recorded_source_correction_pending',
    'F-05': 'decision_recorded_implementation_pending',
    'F-06': 'requires_user_confirmation',
    'F-07': 'requires_user_confirmation',
    'F-08': 'decision_recorded_implementation_pending',
  });

  const contractsById = new Map(manifest.contracts.map((contract) => [contract.contract_id, contract]));
  assert.equal(
    contractsById.get('feishu_message_api.input_version').status,
    'aligned',
  );
  assert.deepEqual(contractsById.get('feishu_message_api.input_version').open_findings, []);
  assert.equal(
    contractsById.get('model.relationship.naming_and_numeric_subtable').status,
    'decision_recorded_source_correction_pending',
  );
  assert.equal(
    contractsById.get('feishu_message_api.resource_data_ui_task_handlers').status,
    'decision_recorded_implementation_pending',
  );
  for (const contractId of [
    'model.relationship.naming_and_numeric_subtable',
    'feishu_message_api.input_version',
    'feishu_message_api.resource_data_ui_task_handlers',
  ]) {
    assert.ok(
      contractsById.get(contractId).decision_files.includes('docs/ssot/feishu_alignment_decisions_v0.md'),
      `${contractId} must route recorded user decisions to the formal alignment decision surface`,
    );
  }
  const watcher = contractsById.get('feishu_source_watch.focused_docs');
  assert.equal(watcher.status, 'aligned');
  assert.deepEqual(watcher.open_findings, []);
  assert.ok(watcher.owner_iterations.includes('0456-feishu-watcher-tls-preflight'));

  const model3200Patch = 'deploy/sys-v1ns/remote-worker/patches/15_model3200_feishu_message_api.json';
  const currentRuntime = ['packages/worker-base/src/runtime.mjs', 'packages/worker-base/src/runtime.js'];
  const expectedRouting = {
    'feishu_message_api.input_version': {
      implementation_files: [model3200Patch, ...currentRuntime],
      test_files: [
        'scripts/tests/test_0442_feishu_current_contract_alignment.mjs',
        'scripts/tests/test_0457_feishu_message_api_v2_hard_cut.mjs',
        'scripts/tests/test_0457_feishu_model3200_actor_contract.mjs',
        'scripts/tests/test_0457_orbstack_e2e_verifier_contract.mjs',
      ],
      anchor_terms: {
        ssot_files: ['pin_payload.v2', 'R1 Model 3200'],
        implementation_files: ['pin_payload.v2', 'legacy_feishu_message_api_v1_removed'],
        test_files: [
          'test_worker_root_bus_in_rejects_complete_legacy_feishu_message_api_v1_shape',
          'test_generic_v2_requires_exact_transport_envelope',
          'revision4_live_verified',
        ],
      },
    },
    'feishu_message_api.response_outbox': {
      implementation_files: [model3200Patch, ...currentRuntime],
      test_files: [
        'scripts/tests/test_0448_feishu_message_api_response_outbox.mjs',
        'scripts/tests/test_0449_feishu_response_outbox_publish.mjs',
        'scripts/tests/test_0452_feishu_response_e2e_smoke.mjs',
        'scripts/tests/test_0457_feishu_model3200_actor_contract.mjs',
      ],
      anchor_terms: {
        ssot_files: ['result:pin.out', 'response_topic'],
        implementation_files: ['pin_payload.v2', 'response_topic'],
        test_files: ['test_resource_response_uses_generic_v2_result_and_response_topic'],
      },
    },
    'feishu_message_api.resource_data_ui_task_handlers': {
      implementation_files: [model3200Patch],
      test_files: [
        'scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs',
        'scripts/tests/test_0444_feishu_task_manager_processor.mjs',
        'scripts/tests/test_0445_feishu_resource_api_processor.mjs',
        'scripts/tests/test_0446_feishu_data_api_processor.mjs',
        'scripts/tests/test_0447_feishu_ui_api_processor.mjs',
        'scripts/tests/test_0457_feishu_model3200_actor_contract.mjs',
      ],
      anchor_terms: {
        ssot_files: ['ui.refresh_data', 'task_data'],
        implementation_files: ['ui_action_pending:refresh_data', 'task_action_pending:add_task_return'],
        test_files: ['test_refresh_data_remains_pending_without_state_or_response', 'task_action_pending:add_task_return'],
      },
    },
    'feishu_message_api.route_autofill_permission': {
      implementation_files: [model3200Patch, ...currentRuntime],
      test_files: [
        'scripts/tests/test_0442_feishu_current_contract_alignment.mjs',
        'scripts/tests/test_0457_feishu_model3200_actor_contract.mjs',
      ],
      anchor_terms: {
        ssot_files: ['origin_pin', 'endpoint_worker_id'],
        implementation_files: ['origin_pin', 'endpoint_worker_id'],
        test_files: [
          'test_explicit_v2_route_metadata_is_required_without_autofill',
          'test_generic_v2_requires_exact_transport_envelope',
        ],
      },
    },
  };
  for (const [contractId, expected] of Object.entries(expectedRouting)) {
    const contract = contractsById.get(contractId);
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(contract[field], value, `${contractId}.${field} must route to the Revision 4 current contract`);
    }
    assert.equal(
      contract.implementation_files.includes('scripts/lib/feishu_message_api_v1.mjs'),
      false,
      `${contractId} must not route current implementation through the retired v1 helper`,
    );
  }
  assert.ok(contractsById.get('feishu_message_api.input_version').owner_iterations.includes('0457-feishu-message-api-v2-local-de'));
}

async function test_human_and_llm_entries_share_one_contract_and_authority_model() {
  const docsIndex = readFileSync(docsIndexPath, 'utf8');
  const agents = readFileSync(agentsPath, 'utf8');
  const claude = readFileSync(claudePath, 'utf8');
  const alignment = readFileSync(alignmentPath, 'utf8');
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(docsIndex, /Human entry/u);
  assert.match(agents, /LLM entry/u);
  for (const [name, content] of [['docs index', docsIndex], ['AGENTS', agents], ['CLAUDE', claude]]) {
    assert.match(content, /contract_surface_manifest\.json/u, `${name} must point to the shared contract routing index`);
    assert.match(content, /feishu_alignment_decisions_v0\.md/u, `${name} must point to the same adoption decisions`);
  }
  assert.match(claude, /repository execution authority/u);
  assert.match(claude, /docs\/ssot\/\*\.md.*excludes.*generated summaries.*decision backlogs/su);
  assert.match(alignment, /UpstreamConsensus/u);
  assert.match(alignment, /DerivedView/u);
  assert.match(alignment, /SupportingSource/u);
  assert.match(alignment, /feishu-model2/u);
  assert.match(alignment, /feishu-message-api/u);
  assert.match(alignment, /supporting-source-1/u);
  assert.match(alignment, /supporting-source-2/u);
  assert.match(alignment, /0456 裁决与当前实施状态/u);
  assert.match(alignment, /F-01.*pin_payload\.v2.*aligned\/completed/su);
  assert.match(alignment, /F-04.*来源笔误.*no alias.*decision_recorded_source_correction_pending/su);
  assert.match(alignment, /F-05.*ModelTable.*projection-only.*decision_recorded_implementation_pending/su);
  assert.match(alignment, /F-08.*真实 PIN 消息.*decision_recorded_implementation_pending/su);
  assert.match(alignment, /F-06.*F-07.*requires_user_confirmation/su);
  assert.match(alignment, /F-04.*当前 repo 行为无需修改/su);
  assert.match(alignment, /Feishu 写入仍需单独授权/u);
  assert.match(workflow, /Feishu consensus adoption/u);
  assert.match(workflow, /heading diff.*requires_user_confirmation.*Approved iteration.*repo SSOT/su);
  assert.match(docsIndex, /current executable contract/su);
  assert.match(docsIndex, /routing indexes.*generated summaries.*decision backlogs.*不属于产品 SSOT/su);
  assert.match(agents, /2 UpstreamConsensus.*4 DerivedView.*2 pending SupportingSource/su);
  const backlog = readFileSync(backlogPath, 'utf8');
  assert.match(backlog, /doc_type: decision-backlog/u);
  assert.doesNotMatch(backlog, /doc_type: ssot-backlog/u);
}

async function test_contract_manifest_is_complete_and_anchored() {
  const manifest = loadContractManifest(manifestPath);
  const validation = validateContractManifest(manifest, { repoRoot });
  assert.deepEqual(validation.errors, [], 'contract manifest must have no validation errors');
  assert.ok(manifest.contracts.length >= 8, 'starter manifest must contain at least eight contract cards');

  const index = buildContractIndex(manifest, { repoRoot });
  assert.deepEqual(index.missingFiles, [], 'all contract file anchors must exist');
  assert.deepEqual(index.missingAnchors, [], 'all contract known_terms must be present in declared anchors');
}

async function test_contract_summary_is_generated_from_manifest() {
  const manifest = loadContractManifest(manifestPath);
  const index = buildContractIndex(manifest, { repoRoot });
  const expected = generateContractCoverageSummary(manifest, index);
  const actual = readFileSync(summaryPath, 'utf8');
  assert.equal(actual, expected, 'contract coverage summary must be regenerated from manifest without drift');
  assert.doesNotMatch(actual, /\n\n$/u, 'generated summary must end with exactly one newline');
  assert.match(actual, /doc_type: generated-summary/u);
  assert.doesNotMatch(actual, /doc_type: ssot-generated-summary/u, 'generated coverage must not claim SSOT document type');

  const customManifestRef = 'docs/ssot/custom-contract-manifest.json';
  const custom = generateContractCoverageSummary(manifest, index, { manifestRef: customManifestRef });
  assert.match(custom, new RegExp(`generated_from: "${customManifestRef}"`, 'u'));
  assert.match(custom, new RegExp(`Generated from \`${customManifestRef}\``, 'u'));
}

async function test_contract_index_is_byte_stable_and_matches_generated_index_metadata() {
  const manifest = loadContractManifest(manifestPath);
  assert.equal(indexPath, path.join(repoRoot, manifest.generated_index));
  const { index } = writeContractArtifacts({ repoRoot, manifestPath });
  const first = readFileSync(indexPath, 'utf8');
  writeContractArtifacts({ repoRoot, manifestPath });
  const second = readFileSync(indexPath, 'utf8');
  assert.equal(second, first, 'regenerating the ignored index must be byte-stable');
  assert.deepEqual(JSON.parse(second), buildContractIndex(manifest, { repoRoot }));
  assert.equal(index.contract_count, manifest.contracts.length);
}

async function test_feishu_backlog_tracks_decided_unresolved_and_completed_items() {
  const backlog = readFileSync(backlogPath, 'utf8');
  const expectedClasses = {
    'F-01': 'completed',
    'F-04': 'decision_recorded_source_correction_pending',
    'F-05': 'decision_recorded_implementation_pending',
    'F-06': 'requires_user_confirmation',
    'F-07': 'requires_user_confirmation',
    'F-08': 'decision_recorded_implementation_pending',
    'F-09': 'completed',
  };
  for (const [findingId, decisionClass] of Object.entries(expectedClasses)) {
    assert.match(
      backlog,
      new RegExp(`\\| ${findingId} \\| ${decisionClass} \\|`, 'u'),
      `${findingId} must retain its approved decision class`,
    );
  }
  const awaiting = backlog.split('## Awaiting User Confirmation')[1]?.split('\n## ')[0] || '';
  assert.match(awaiting, /F-06/u);
  assert.match(awaiting, /F-07/u);
  assert.doesNotMatch(awaiting, /F-01|F-04|F-05|F-08|F-09/u);
  const decided = backlog.split('## Decisions Recorded — Follow-up Pending')[1]?.split('\n## ')[0] || '';
  assert.doesNotMatch(decided, /F-01/u);
  assert.match(decided, /F-04/u);
  assert.match(decided, /F-05/u);
  assert.match(decided, /F-08/u);
  const completed = backlog.split('## Completed Items')[1]?.split('\n## ')[0] || '';
  assert.match(completed, /F-01/u);
  assert.match(completed, /F-09/u);
  assert.match(backlog, /F-05.*ui_action_pending:refresh_data.*does not write refresh state or produce a response/su);
  assert.match(backlog, /F-08.*task_action_pending:add_task_return.*generic `result`.*does not count as a real.*PIN/su);
  assert.match(backlog, /还有什么要做/u, 'backlog must document the future query rule');
}

for (const test of [
  test_contract_manifest_rejects_repository_path_escape,
  test_contract_index_requires_layer_specific_anchors,
  test_contract_manifest_rejects_invalid_verification_target,
  test_contract_manifest_rejects_unmapped_existing_verification_target,
  test_contract_manifest_rejects_generated_artifact_path_escape,
  test_contract_artifact_paths_follow_manifest_metadata_and_reject_escape,
  test_contract_manifest_rejects_stale_local_source_heading,
  test_contract_manifest_rejects_unknown_external_source_id,
  test_contract_manifest_rejects_derived_view_as_source_authority,
  test_feishu_source_manifest_encodes_approved_authority_model,
  test_contract_manifest_separates_authority_surfaces_and_open_findings,
  test_human_and_llm_entries_share_one_contract_and_authority_model,
  test_contract_manifest_is_complete_and_anchored,
  test_contract_summary_is_generated_from_manifest,
  test_contract_index_is_byte_stable_and_matches_generated_index_metadata,
  test_feishu_backlog_tracks_decided_unresolved_and_completed_items,
]) {
  await test();
}

console.log('PASS test_0455_contract_surface_index');
