import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function read(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const requiredSecretKeys = [
  'DY_AUTH',
  'DY_OIDC_ISSUER',
  'DY_OIDC_CLIENT_ID',
  'DY_OIDC_CLIENT_SECRET',
  'DY_OIDC_REDIRECT_URI',
  'DY_OIDC_SCOPE',
  'DY_OIDC_STATE_SECRET',
  'DY_SESSION_SECRET',
  'DY_AUTH_SECRET',
  'MATRIX_HOMESERVER_URL',
];

function assertDeployCommonWritesSecretKeys() {
  const source = read('scripts/ops/_deploy_common.sh');
  assert.match(source, /replace_or_create_secret_from_literals\(\)/, '_deploy_common_must_use_replace_or_create_secret_helper');
  assert.match(source, /kubectl -n "\$ns" create secret generic "\$secret_name"/, '_deploy_common_must_generate_secret_with_kubectl_create');
  assert.match(source, /kubectl -n "\$ns" replace -f -/, '_deploy_common_must_replace_existing_secret_without_apply_annotation');
  assert.doesNotMatch(source, /kubectl apply -f -/, '_deploy_common_must_not_apply_stringData_secret_manifest');
  assert.doesNotMatch(source, /stringData/, '_deploy_common_must_not_use_stringData_for_runtime_secret_updates');
  for (const key of requiredSecretKeys) {
    assert.match(source, new RegExp(`--from-literal="${key}=`), `_deploy_common_must_write_${key}`);
  }
  assert.doesNotMatch(source, /cat > "\$tmp_ui"/, '_deploy_common_must_not_write_ui_secret_to_temp_yaml');
  assert.doesNotMatch(source, /cat > "\$tmp_mbr"/, '_deploy_common_must_not_write_mbr_secret_to_temp_yaml');
  assert.doesNotMatch(source, /local tmp_ui tmp_mbr/, '_deploy_common_must_not_keep_secret_temp_file_vars');
  assert.match(
    source,
    /urn:zitadel:iam:org:projects:roles/,
    'deploy_default_scope_must_request_zitadel_project_roles',
  );
}

function assertManifestReadsSecretKeys(relPath) {
  const source = read(relPath);
  for (const key of requiredSecretKeys) {
    const blockPattern = new RegExp(
      [
        `- name: ${key}`,
        '\\s+value: null',
        '\\s+valueFrom:',
        '\\s+secretKeyRef:',
        '\\s+name: ui-server-secret',
        `\\s+key: ${key}`,
      ].join('[\\s\\S]*?'),
    );
    assert.match(source, blockPattern, `${relPath}_must_read_${key}_from_ui_server_secret_with_value_null`);
  }
  assert.doesNotMatch(
    source,
    /- name: DY_AUTH\s*\n\s*value: "0"/,
    `${relPath}_must_not_hardcode_auth_disabled`,
  );
}

function assertEnvExampleDocumentsOidc(relPath, expectedRedirect) {
  const source = read(relPath);
  for (const key of requiredSecretKeys.filter((key) => key !== 'MATRIX_HOMESERVER_URL')) {
    assert.match(source, new RegExp(`^${key}=`, 'm'), `${relPath}_must_document_${key}`);
  }
  assert.match(source, new RegExp(`^DY_OIDC_REDIRECT_URI=${expectedRedirect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(source, /^DY_OIDC_SCOPE=".*urn:zitadel:iam:org:projects:roles"$/m, `${relPath}_must_document_quoted_role_scope`);
  if (relPath.includes('cloud')) {
    assert.match(source, /Required when DY_AUTH=1 on non-loopback domains/, `${relPath}_must_warn_remote_secret_required_when_auth_enabled`);
    assert.match(source, /^DY_OIDC_STATE_SECRET=$/m);
    assert.match(source, /^DY_SESSION_SECRET=$/m);
    assert.doesNotMatch(source, /:\?set DY_REMOTE_/, `${relPath}_must_not_fail_source_when_auth_disabled`);
    assert.doesNotMatch(source, /ChangeMeRemote/, `${relPath}_must_not_ship_public_remote_secret_values`);
  }
}

function assertCloudAppDeployGuardsUiServerSecret() {
  const source = read('scripts/ops/deploy_cloud_app.sh');
  assert.match(source, /verify_ui_server_secret_contract\(\)/, 'cloud_app_deploy_must_define_ui_secret_guard');
  assert.match(source, /verify_ui_server_secret_contract\s*\napply_target_manifest/, 'cloud_app_deploy_must_check_secret_before_apply');
  assert.doesNotMatch(source, /\|\s*python3\s+-\s+<<'PY'/, 'cloud_app_deploy_guard_must_not_pipe_secret_json_into_heredoc_python');
  assert.doesNotMatch(source, /\[\s*"\$TARGET"\s*=\s*"ui-server"\s*\]\s*\|\|\s*return 0/, 'cloud_app_deploy_guard_must_run_before_full_workers_manifest_for_all_targets');
  assert.match(source, /SECRET_JSON="\$secret_json"\s+python3\s+-\s+<<'PY'/, 'cloud_app_deploy_guard_must_pass_secret_json_by_env');
  for (const key of ['MODELTABLE_PATCH_JSON', ...requiredSecretKeys]) {
    assert.match(source, new RegExp(`"${key}"`), `cloud_app_deploy_guard_must_check_${key}`);
  }
  assert.match(source, /deploy_cloud_full\.sh once to refresh ui-server-secret/, 'cloud_app_deploy_guard_must_tell_operator_to_refresh_secret');
}

function extractBashFunction(source, name) {
  const marker = `${name}() {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name}_must_exist`);
  const endMarker = '\n}\n\nload_target_spec';
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `${name}_must_end_before_load_target_spec`);
  return source.slice(start, end + 3);
}

function runGuardWithFakeKubectl({ omitKey = '' } = {}) {
  const source = read('scripts/ops/deploy_cloud_app.sh');
  const fn = extractBashFunction(source, 'verify_ui_server_secret_contract');
  const keys = ['MODELTABLE_PATCH_JSON', ...requiredSecretKeys].filter((key) => key !== omitKey);
  const dataJson = Object.fromEntries(keys.map((key) => [key, Buffer.from('configured').toString('base64')]));
  const secretJson = JSON.stringify({ data: dataJson }).replace(/'/g, "'\\''");
  const script = `
set -euo pipefail
NAMESPACE=dongyu
kubectl() {
  printf '%s' '${secretJson}'
}
${fn}
verify_ui_server_secret_contract
`;
  return spawnSync('bash', ['-s'], {
    input: script,
    encoding: 'utf8',
    cwd: repoRoot,
  });
}

function assertCloudAppDeployGuardExecutes() {
  const ok = runGuardWithFakeKubectl();
  assert.equal(ok.status, 0, `cloud_app_deploy_guard_must_execute_with_complete_secret stderr=${ok.stderr}`);
  assert.match(ok.stdout, /ui-server-secret: OK/, 'cloud_app_deploy_guard_must_report_ok');

  const missing = runGuardWithFakeKubectl({ omitKey: 'DY_OIDC_CLIENT_ID' });
  assert.notEqual(missing.status, 0, 'cloud_app_deploy_guard_must_fail_when_secret_key_missing');
  assert.match(missing.stderr, /DY_OIDC_CLIENT_ID/, 'cloud_app_deploy_guard_must_report_missing_key');
}

async function main() {
  assertDeployCommonWritesSecretKeys();
  assertManifestReadsSecretKeys('k8s/local/workers.yaml');
  assertManifestReadsSecretKeys('k8s/cloud/workers.yaml');
  assertEnvExampleDocumentsOidc('deploy/env/local.env.example', 'http://localhost:30900/auth/sso/callback');
  assertEnvExampleDocumentsOidc('deploy/env/cloud.env.example', 'https://app.dongyudigital.com/auth/sso/callback');
  assertCloudAppDeployGuardsUiServerSecret();
  assertCloudAppDeployGuardExecutes();
  console.log('test_0403_deploy_sso_env_contract: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
