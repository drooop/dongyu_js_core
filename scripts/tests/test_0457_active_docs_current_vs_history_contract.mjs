#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const nonCurrentDocPrefixes = [
  'docs/_templates/',
  'docs/handover/',
  'docs/iterations/',
  'docs/logs/',
  'docs/plans/',
  'docs/prompts/',
  'docs/roadmaps/',
  'docs/tests/',
  'docs/tmp/',
  'docs/user-guide/diary/',
];

function isCurrentActiveSurfacePath(relativePath) {
  if (relativePath === 'docs/ITERATIONS.md') return false;
  return !nonCurrentDocPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function activeCurrentMarkdownSurfaces() {
  const docsRoot = resolve(repoRoot, 'docs');
  const surfaces = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const relativePath = relative(repoRoot, absolutePath).split('\\').join('/');
      if (!isCurrentActiveSurfacePath(relativePath)) continue;
      const content = readFileSync(absolutePath, 'utf8');
      if (!/^status: active$/mu.test(content)) continue;
      surfaces.push({
        path: relativePath,
        content,
      });
    }
  };
  visit(docsRoot);
  return surfaces;
}

function orderedSlice(content, startMarker, endMarker, label) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  assert.notEqual(start, -1, `${label}: missing start marker`);
  assert.notEqual(end, -1, `${label}: missing end marker`);
  assert.ok(start < end, `${label}: current contract must precede preserved history`);
  return {
    current: content.slice(start, end),
    history: content.slice(end),
  };
}

function sectionSlice(content, startMarker, endMarker, label) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${label}: missing start marker`);
  assert.notEqual(end, -1, `${label}: missing end marker`);
  assert.ok(start < end, `${label}: invalid section order`);
  return content.slice(start, end);
}

function assertFormalPinPayloadRecords(records, label) {
  assert.ok(Array.isArray(records), `${label}: payload records must be an array`);
  const root = (key) => records.find((record) => record
    && record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key) || null;
  assert.equal(root('__mt_payload_kind')?.v, 'pin_payload.v2', `${label}: formal kind`);
  assert.match(root('message_role')?.v || '', /^(?:request|response)$/u, `${label}: message_role`);
  assert.match(root('bus')?.v || '', /^(?:control|management)$/u, `${label}: bus`);
  assert.match(root('route_kind')?.v || '', /^(?:control|management)$/u, `${label}: route_kind`);
  assert.equal(root('bus')?.v, root('route_kind')?.v, `${label}: bus and route_kind must match`);
  assert.equal(root('timestamp')?.t, 'int', `${label}: timestamp type`);
  assert.equal(Number.isInteger(root('timestamp')?.v), true, `${label}: timestamp value`);
}

function assertMarkdownFormalPinPayloadExamples(relativePath) {
  const content = read(relativePath);
  const blocks = [...content.matchAll(/```json\s*\n([\s\S]*?)\n```/gu)]
    .map((match) => match[1].trim())
    .filter((block) => block.includes('"pin_payload.v2"'));
  assert.ok(blocks.length > 0, `${relativePath}: expected a formal v2 JSON example`);
  for (const [index, block] of blocks.entries()) {
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(block); }, `${relativePath}#${index + 1}: JSON must be executable`);
    const records = Array.isArray(parsed) ? parsed : parsed?.payload;
    assertFormalPinPayloadRecords(records, `${relativePath}#${index + 1}`);
  }
}

function assertJavascriptFormalPinPayloadExamples(relativePath) {
  const content = read(relativePath);
  const blocks = [...content.matchAll(/```javascript\s*\n([\s\S]*?)\n```/gu)]
    .map((match) => match[1].trim())
    .filter((block) => block.includes("mt('__mt_payload_kind', 'str', 'pin_payload.v2')"));
  assert.ok(blocks.length > 0, `${relativePath}: expected a formal v2 JavaScript example`);
  for (const [index, block] of blocks.entries()) {
    const label = `${relativePath}#javascript-${index + 1}`;
    assert.match(block, /mt\('message_role', 'str', '(?:request|response)'\)/u, `${label}: message_role`);
    const bus = block.match(/mt\('bus', 'str', '(control|management)'\)/u)?.[1];
    const routeKind = block.match(/mt\('route_kind', 'str', '(control|management)'\)/u)?.[1];
    assert.ok(bus, `${label}: bus`);
    assert.ok(routeKind, `${label}: route_kind`);
    assert.equal(bus, routeKind, `${label}: bus and route_kind must match`);
    assert.match(block, /mt\('timestamp', 'int', [^)]+\)/u, `${label}: int timestamp`);
  }
}

function test_highest_runtime_contract_requires_standard_v2_transport_metadata() {
  const content = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const payload = sectionSlice(content, '### 7.1 Payload', '### 7.2 Routing', 'standard v2 payload');
  assert.match(payload, /- `message_role`，必填/u);
  assert.match(payload, /- `bus`，必填/u);
  assert.match(payload, /- `route_kind`，必填[^\n]*必须与 `bus` 相同/u);
  assert.match(payload, /- `timestamp`，必填 `int`/u);
  assert.doesNotMatch(payload, /`route_kind`[^\n]*(?:可选|可省略|缺省|省略等同)/u);
}

function test_runtime_routing_requires_explicit_control_metadata() {
  const content = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const routing = sectionSlice(content, '### 7.2 Routing', '## 8. 数据模型 PIN 接口规范', 'standard v2 routing');
  assert.match(routing, /control payload 必须显式写 `route_kind="control"` 与 `bus="control"`/u);
  assert.match(routing, /缺少任一字段[^\n]*fail closed/u);
  assert.doesNotMatch(routing, /默认 `route_kind` 为 `"control"`/u);
}

function test_active_flow_separates_current_business_submit_from_historical_debug_intent() {
  const content = read('docs/ssot/ui_to_matrix_event_flow.md');
  const fullFlow = sectionSlice(content, '## 完整数据流', '## 关键组件', 'active event flow');
  assert.match(fullFlow, /当前正式业务 submit[\s\S]*POST `\/bus_event`[\s\S]*`bus_event_v2`[\s\S]*Model 0[\s\S]*`pin\.bus\.cb\.in`/u);
  assert.match(fullFlow, /浏览器[\s\S]*`bus_event_v2`[\s\S]*统一[\s\S]*`pin\.bus\.cb\.in`/u);
  assert.match(fullFlow, /management[\s\S]*目标模型外发[\s\S]*`bus=management`[\s\S]*`route_kind=management`[\s\S]*Matrix\/Synapse/u);
  assert.doesNotMatch(fullFlow, /显式 management[^\n]*`pin\.bus\.mb\.in`/u);
  assert.match(fullFlow, /`\/ui_event`[\s\S]*Model -1[\s\S]*(?:历史|debug intent)[\s\S]*不是 current business submit/u);
  assert.doesNotMatch(fullFlow, /UI 事件 \(Browser\)[\s\S]*POST \/ui_event[\s\S]*Mailbox 写入 \(Model -1/u);
}

function test_runtime_browser_bus_event_ingress_is_always_control_pin() {
  const content = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const current = sectionSlice(content, '## 9. 用户输入（Bus Event, 0326）', 'Historical / Retired (pre-0326):', 'current browser ingress');
  assert.match(current, /所有浏览器 `bus_event_v2`[^\n]*统一写入[^\n]*`pin\.bus\.cb\.in`/u);
  assert.match(current, /management[^\n]*目标模型外发[^\n]*`bus="management"`[^\n]*`route_kind="management"`/u);
  assert.doesNotMatch(current, /显式管理语义才写入 `pin\.bus\.mb\.in`/u);
}

function test_active_overview_routes_ordinary_submit_to_control_ingress() {
  const content = read('docs/user-guide/slide_delivery_and_runtime_overview_v1.md');
  assert.doesNotMatch(content, /显式管理语义才使用 `pin\.bus\.mb\.in`/u);
  assert.match(content, /management[^\n]*目标模型外发[^\n]*Matrix\/Synapse\/MBR/u);
  const submit = sectionSlice(content, '如果你要提交业务：', '如果你要外发：', 'overview submit guidance');
  assert.match(submit, /`bus_event_v2 -> Model 0 pin\.bus\.cb\.in`/u);
  assert.doesNotMatch(submit, /`bus_event_v2 -> Model 0 pin\.bus\.mb\.in`/u);
  assert.match(submit, /management[^\n]*目标模型外发[^\n]*`bus=management`[^\n]*`route_kind=management`/u);
}

function test_all_active_browser_ingress_guides_keep_management_at_egress() {
  for (const relativePath of [
    'docs/user-guide/modeltable_user_guide.md',
    'docs/user-guide/slide-app-runtime/README.md',
    'docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md',
    'docs/ssot/imported_slide_app_host_ingress_semantics_v1.md',
    'docs/ssot/ui_model_pin_routing_architecture.md',
    'docs/user-guide/ui_components_v2.md',
  ]) {
    const content = read(relativePath);
    assert.match(content, /bus_event_v2/u, `${relativePath}: current browser protocol`);
    assert.match(content, /pin\.bus\.cb\.in/u, `${relativePath}: browser control ingress`);
    assert.doesNotMatch(
      content,
      /(?:显式管理语义才(?:写入|使用|进入)|Explicit management semantics use)[^\n]*pin\.bus\.mb\.in|pin\.bus\.mb\.in`?[^\n]*(?:只|仅)用于显式管理语义/u,
      `${relativePath}: browser submit must not be routed directly to management ingress`,
    );
  }
}

function test_discovered_active_surfaces_preserve_local_infra_and_browser_ingress_truth() {
  const activeSurfaces = activeCurrentMarkdownSurfaces();
  const byPath = new Map(activeSurfaces.map((surface) => [surface.path, surface]));
  for (const requiredPath of [
    'docs/deployment/runtime_baseline_default.md',
    'docs/ssot/imported_slide_app_host_ingress_semantics_v1.md',
    'docs/user-guide/project_address_record.md',
    'docs/user-guide/matrix_chat_feature_matrix.md',
  ]) {
    assert.ok(byPath.has(requiredPath), `${requiredPath}: must be discovered from status: active frontmatter`);
  }
  assert.equal(byPath.has('docs/ITERATIONS.md'), false, 'iteration ledger must not be scanned as a current contract surface');
  for (const prefix of nonCurrentDocPrefixes) {
    assert.equal(
      activeSurfaces.some(({ path }) => path.startsWith(prefix)),
      false,
      `${prefix}: historical/evidence surfaces must not be scanned as current contracts`,
    );
  }

  const importedIngress = byPath.get('docs/ssot/imported_slide_app_host_ingress_semantics_v1.md').content;
  assert.match(importedIngress, /pin\.bus\.cb\.in`[^\n]*所有浏览器[^\n]*统一入口/u, 'imported-app SSOT must positively declare browser cb.in ingress');
  assert.match(importedIngress, /`pin\.bus\.mb\.in`[^\n]*目标模型外发[^\n]*本地 Matrix\/Synapse\/MBR[^\n]*management transport packet/u, 'imported-app SSOT must positively declare management mb.in transport ingress');
  assert.match(importedIngress, /`pin\.bus\.mb\.in`[^\n]*不是浏览器 submit 入口|`pin\.bus\.mb\.in`[^\n]*绝不是浏览器 submit 入口/u, 'imported-app SSOT must reject browser mb.in submit');

  const projectAddresses = byPath.get('docs/user-guide/project_address_record.md').content;
  assert.match(projectAddresses, /Local test Matrix homeserver[^\n]*`http:\/\/synapse\.dongyu\.svc\.cluster\.local:8008`/u, 'project addresses must positively declare local cluster Synapse');
  assert.match(projectAddresses, /Local test Matrix server name[^\n]*`localhost`/u, 'project addresses must positively declare local Matrix server name');

  const runtimeBaseline = byPath.get('docs/deployment/runtime_baseline_default.md').content;
  const requiredDeployments = ['mosquitto', 'synapse', 'remote-worker', 'workspace-manager', 'mbr-worker', 'ui-server'];
  const assertRuntimeBaselineContract = (content, label) => {
    assert.match(content, /Docker context 必须精确为 `orbstack`/u, `${label}: current runtime runbook must require exact OrbStack Docker context`);
    assert.match(content, /Kubernetes context 必须精确为 `orbstack`/u, `${label}: current runtime runbook must require exact OrbStack Kubernetes context`);
    assert.match(content, /任一不匹配都必须 fail closed/u, `${label}: context mismatch must fail closed`);
    assert.match(content, /namespace\s*=\s*`dongyu`/u, `${label}: current runtime runbook must require namespace=dongyu`);
    assert.match(
      content,
      /bash scripts\/ops\/ensure_runtime_baseline\.sh --force-rebuild\nbash scripts\/ops\/check_runtime_baseline\.sh/u,
      `${label}: changed runtime baseline must use the force-rebuild entry before checking`,
    );
    assert.match(content, /首次部署[^\n]*代码[^\n]*manifest[^\n]*actor asset[^\n]*必须使用[^\n]*`--force-rebuild`/u, `${label}: changed runtime baseline must define force-rebuild scope`);
    assert.match(content, /不得把单独执行 `docker build` 或无参数的 `ensure_runtime_baseline\.sh` 当作变更后的部署完成证据/u, `${label}: standalone builds and non-forced checks must not prove changed deployment`);
    assert.match(content, /`service\/ui-server-nodeport` NodePort 30900(?!\d)/u, `${label}: current runtime runbook must require the exact UI NodePort`);
    assert.doesNotMatch(content, /推荐 context|K8S_CONTEXT|可被[^\n]*覆盖|建议使用[^\n]*context|其他 context[^\n]*(?:可|允许)/u, `${label}: exact OrbStack contexts must not be optional or overridable`);
    for (const deployment of requiredDeployments) {
      assert.match(content, new RegExp('deployment/' + deployment + '` replicas = 1(?!\\d)', 'u'), `${label}: current runtime runbook must require deployment/${deployment} replicas=1`);
    }
  };
  const replaceRequired = (before, after, name) => {
    const occurrences = runtimeBaseline.split(before).length - 1;
    assert.ok(occurrences > 0, `${name}: mutation token must exist`);
    return runtimeBaseline.replaceAll(before, after);
  };
  const mutations = [
    ['wrong_docker_context', replaceRequired('Docker context 必须精确为 `orbstack`', 'Docker context 必须精确为 `other`', 'wrong_docker_context')],
    ['missing_docker_context', replaceRequired('Docker context 必须精确为 `orbstack`', 'Docker context 未声明', 'missing_docker_context')],
    ['wrong_kubernetes_context', replaceRequired('Kubernetes context 必须精确为 `orbstack`', 'Kubernetes context 必须精确为 `other`', 'wrong_kubernetes_context')],
    ['missing_kubernetes_context', replaceRequired('Kubernetes context 必须精确为 `orbstack`', 'Kubernetes context 未声明', 'missing_kubernetes_context')],
    ['missing_fail_closed', replaceRequired('任一不匹配都必须 fail closed', '任一不匹配仍可继续', 'missing_fail_closed')],
    ['optional_contexts', replaceRequired(
      'Docker context 必须精确为 `orbstack`，Kubernetes context 必须精确为 `orbstack`；任一不匹配都必须 fail closed',
      'Docker context 建议使用 `orbstack`，Kubernetes context 建议使用 `orbstack`；其他 context 也允许继续',
      'optional_contexts',
    )],
    ['wrong_namespace', replaceRequired('namespace=`dongyu`', 'namespace=`other`', 'wrong_namespace')],
    ['missing_namespace', replaceRequired('namespace=`dongyu`', '', 'missing_namespace')],
    ['missing_force_rebuild', replaceRequired('ensure_runtime_baseline.sh --force-rebuild', 'ensure_runtime_baseline.sh', 'missing_force_rebuild')],
    ['wrong_ui_nodeport', replaceRequired('`service/ui-server-nodeport` NodePort 30900', '`service/ui-server-nodeport` NodePort 30901', 'wrong_ui_nodeport')],
    ['prefixed_ui_nodeport', replaceRequired('`service/ui-server-nodeport` NodePort 30900', '`service/ui-server-nodeport` NodePort 309000', 'prefixed_ui_nodeport')],
  ];
  for (const deployment of requiredDeployments) {
    const linePattern = new RegExp('^- `deployment/' + deployment + '`[^\\n]*\\n', 'mu');
    const mutated = runtimeBaseline.replace(linePattern, '');
    assert.notEqual(mutated, runtimeBaseline, `missing_${deployment}: deployment line mutation must apply`);
    mutations.push([`missing_${deployment}`, mutated]);
    mutations.push([
      `wrong_replicas_${deployment}`,
      replaceRequired('deployment/' + deployment + '` replicas = 1', 'deployment/' + deployment + '` replicas = 2', `wrong_replicas_${deployment}`),
    ]);
    mutations.push([
      `prefixed_replicas_${deployment}`,
      replaceRequired('deployment/' + deployment + '` replicas = 1', 'deployment/' + deployment + '` replicas = 10', `prefixed_replicas_${deployment}`),
    ]);
  }
  assertRuntimeBaselineContract(runtimeBaseline, 'canonical');
  for (const [name, mutated] of mutations) {
    assert.throws(
      () => assertRuntimeBaselineContract(mutated, name),
      /current runtime runbook|context mismatch|namespace=dongyu|exact OrbStack contexts|changed runtime baseline|standalone builds/u,
      `${name}: active-doc guard must fail for a weakened local runtime baseline`,
    );
  }

  const matrixGuide = byPath.get('docs/user-guide/matrix_chat_feature_matrix.md').content;
  const matrixCurrentDisplay = sectionSlice(matrixGuide, '## 当前显示口径', '## 已实现功能', 'Matrix Chat current display contract');
  const matrixLocalParagraph = matrixCurrentDisplay.split(/\n\s*\n/u).find((paragraph) => paragraph.includes('本地测试与 Revision 4 acceptance')) || '';
  assert.match(matrixLocalParagraph, /`http:\/\/synapse\.dongyu\.svc\.cluster\.local:8008`/u, 'Matrix Chat local paragraph must positively declare cluster Synapse');
  assert.match(matrixLocalParagraph, /server name 为 `localhost`/u, 'Matrix Chat local paragraph must positively declare localhost server name');
  assert.doesNotMatch(matrixLocalParagraph, /matrix\.dongyudigital\.com|synapse\.dongyudigital\.com/u, 'Matrix Chat local paragraph must not mix remote Matrix identity');

  const matrixRegression = sectionSlice(matrixGuide, '## 回归测试清单', '## 已完成的真实验证', 'Matrix Chat current regression contract');
  const localMatrixAcceptance = sectionSlice(matrixRegression, '涉及本地真实 Matrix 行为时', 'Cloud/remote-only', 'Matrix Chat local acceptance commands');
  assert.match(localMatrixAcceptance, /check_runtime_baseline\.sh/u, 'Matrix Chat local acceptance must check the OrbStack baseline');
  assert.match(localMatrixAcceptance, /matrix_connection_check\.py --homeserver k8s/u, 'Matrix Chat local acceptance must target the k8s Synapse service');
  assert.doesNotMatch(localMatrixAcceptance, /matrix_chat_real_flow_check\.py|matrix\.dongyudigital\.com|synapse\.dongyudigital\.com/u, 'Matrix Chat local acceptance must not use the remote-only runner or identity');
  assert.match(matrixRegression, /Cloud\/remote-only[^\n]*`scripts\/matrix_chat_real_flow_check\.py`[^\n]*不(?:属于|计入).*local acceptance/u, 'remote-only Matrix flow runner must be explicitly excluded from local acceptance');
  assert.doesNotMatch(matrixRegression, /确认远端 `drop` joined rooms|@mbr:synapse\.dongyudigital\.com/u, 'current local browser instructions must not retain remote rooms or identities');
  assert.match(matrixRegression, /@mbr:localhost/u, 'current local browser instructions must use the local Matrix identity');

  const claimMap = [
    {
      id: 'browser_ingress',
      select: ({ content }) => content.includes('bus_event_v2') && content.includes('pin.bus.mb.in'),
      assertSurface: ({ path, content }) => {
        assert.doesNotMatch(
          content,
          /(?:显式管理语义才(?:写入|使用|进入)|Explicit management semantics use)[^\n]*pin\.bus\.mb\.in|pin\.bus\.mb\.in`?[^\n]*(?:只|仅)用于显式管理语义/u,
          `${path}: browser management intent must not be described as direct mb.in ingress`,
        );
      },
    },
    {
      id: 'local_matrix',
      select: ({ content }) => /(?:本地测试|Local test)[\s\S]*Matrix/u.test(content),
      assertSurface: ({ path, content }) => {
        const contradictoryParagraphs = content.split(/\n\s*\n/u).filter((paragraph) => (
          /(?:本地测试|Local test)/u.test(paragraph)
          && /(?:https:\/\/matrix\.dongyudigital\.com|synapse\.dongyudigital\.com)/u.test(paragraph)
          && !/(?:历史|historical|cloud|远端部署)/iu.test(paragraph)
        ));
        assert.deepEqual(
          contradictoryParagraphs,
          [],
          `${path}: local tests must use OrbStack Synapse, not the remote Matrix service`,
        );
      },
    },
  ];
  for (const claim of claimMap) {
    const selected = activeSurfaces.filter(claim.select);
    assert.ok(selected.length > 0, `${claim.id}: discovery must select at least one active surface`);
    for (const surface of selected) claim.assertSurface(surface);
  }

  const ops = read('scripts/ops/README.md');
  assert.doesNotMatch(ops, /输出 5 个 deployment 全部 ready/u, 'active Ops PASS criteria must not retain the five-deployment baseline');
  const local0170 = sectionSlice(ops, '## 0170 Local Orbstack', '## Obsidian Docs Migration', '0170 current local runbook');
  assert.match(local0170, /6 个 deployment/u);
  for (const deployment of ['mosquitto', 'synapse', 'remote-worker', 'workspace-manager', 'mbr-worker', 'ui-server']) {
    assert.match(local0170, new RegExp(`\\b${deployment}\\b`, 'u'), `0170 baseline must list ${deployment}`);
  }
}

function test_ui_routing_guides_use_current_browser_ingress_and_local_six_de_baseline() {
  const architecture = read('docs/ssot/ui_model_pin_routing_architecture.md');
  assert.doesNotMatch(architecture, /submitEnvelope\(\)/u);
  assert.doesNotMatch(architecture, /POST \/ui_event/u);
  assert.doesNotMatch(architecture, /双总线 via MBR/u);
  assert.doesNotMatch(architecture, /pin\.model\.(?:in|out)/u);
  assert.match(architecture, /所有浏览器 `bus_event_v2`[^\n]*Model 0[^\n]*`pin\.bus\.cb\.in`/u);
  assert.match(architecture, /control[^\n]*`pin\.bus\.cb\.out`[^\n]*本地 MQTT[^\n]*R1/u);
  assert.match(architecture, /management[^\n]*目标模型外发[^\n]*`bus=management`[^\n]*`route_kind=management`[^\n]*Matrix\/Synapse[^\n]*MBR/u);
  assert.match(architecture, /`pin\.bus\.mb\.in`[^\n]*management transport ingress/u);

  const components = read('docs/user-guide/ui_components_v2.md');
  const eventFlow = sectionSlice(components, '## Event Flow', '```json', 'UI components event-flow Mermaid');
  assert.match(eventFlow, /UI\[Browser bus_event_v2\][\s\S]*CBIn\[Model 0 pin\.bus\.cb\.in\]/u);
  assert.match(eventFlow, /CBOut\[pin\.bus\.cb\.out\][\s\S]*MQTT\[Local MQTT\][\s\S]*R1\[R1 target worker\]/u);
  assert.match(eventFlow, /MgmtOut\[Target-model egress[\s\S]*bus=management[\s\S]*route_kind=management[\s\S]*Matrix\[Local Matrix\/Synapse\][\s\S]*MBR\[MBR\]/u);
  assert.doesNotMatch(eventFlow, /UI\[UI event\] --> Bus\[Model 0 pin\.bus\.mb\.in\]/u);

  const configuration = read('docs/user-guide/ui_event_matrix_mqtt_configuration.md');
  assert.match(configuration, /所有浏览器 `bus_event_v2`[^\n]*Model 0[^\n]*`pin\.bus\.cb\.in`/u);
  assert.match(configuration, /management[^\n]*目标模型外发[^\n]*`bus=management`[^\n]*`route_kind=management`/u);
  assert.match(configuration, /`pin\.bus\.mb\.in`[^\n]*management transport ingress/u);
  const baseline = sectionSlice(configuration, '### 2. 验证 baseline', '### 3. 验证颜色生成器闭环', 'local OrbStack baseline');
  assert.match(baseline, /6 个 deployment ready/u);
  for (const deployment of [
    'mosquitto（Mosquitto）',
    'synapse（Synapse）',
    'remote-worker（R1）',
    'workspace-manager（WM1）',
    'mbr-worker（MBR）',
    'ui-server（UI Server）',
  ]) {
    assert.match(baseline, new RegExp(deployment, 'u'), `baseline must list ${deployment}`);
  }
}

function test_active_formal_v2_examples_include_required_transport_metadata() {
  for (const relativePath of [
    'docs/ssot/temporary_modeltable_payload_v1.md',
    'docs/user-guide/modeltable_user_guide.md',
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
    'docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md',
    'docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md',
  ]) {
    assertMarkdownFormalPinPayloadExamples(relativePath);
  }

  const mqttGuidePath = 'docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md';
  assert.match(read(mqttGuidePath), /^updated: 2026-07-16$/mu);
  assertJavascriptFormalPinPayloadExamples(mqttGuidePath);

  const interactive = read('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html');
  const examples = [...interactive.matchAll(/<pre>([\s\S]*?)<\/pre>/gu)]
    .map((match) => match[1].trim())
    .filter((block) => block.includes('"pin_payload.v2"'));
  assert.equal(examples.length, 1, 'interactive guide must keep one executable manual v2 response');
  const packet = JSON.parse(examples[0]);
  assertFormalPinPayloadRecords(packet.payload, 'interactive manual response');
  assert.doesNotMatch(interactive, /MBR publishes endpoint topic/u);
  assert.match(interactive, /UI Server MQTT adapter publishes endpoint topic/u);
}

function test_runtime_current_contract_precedes_preserved_v1_history() {
  const content = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const { current, history } = orderedSlice(
    content,
    '0457 起，Feishu Message API 的当前公开输入整体 hard cut 到 `pin_payload.v2`',
    '0442 曾把 Feishu `pin_payload.v1` 子模型表 shape 作为公开输入',
    'runtime semantics',
  );
  assert.match(current, /R1 的正数 `Model 3200`/u);
  assert.match(content, /MBR 不桥接、不回显 control response/u);
  assert.match(content, /MBR 只桥接 management response/u);
  assert.match(content, /Current mailbox names are `bus_event` \/ `bus_event_error` \/ `bus_event_last_op_id`/u);
  assert.match(history, /0448 的 `pin_payload\.v1` request → runtime `pin_payload\.v2` outbox 是历史桥接实现/u);
}

function test_alignment_separates_0457_current_from_0442_0450_history() {
  const content = read('docs/ssot/feishu_model_label_alignment_v1.md');
  const { current, history } = orderedSlice(
    content,
    '0457 current supersession:',
    'Historical implementation evidence (0442-0450; superseded by 0457):',
    'Feishu alignment',
  );
  assert.match(current, /only a flat `pin_payload\.v2`/u);
  assert.match(current, /R1 Model 3200 is the Tier 2 owner/u);
  assert.match(current, /MBR never echoes a control response/u);
  assert.match(history, /`pin_payload\.v1` as the then-current Feishu message API input shape/u);
}

function test_decision_surface_closes_f01_and_keeps_followups_open() {
  const content = read('docs/ssot/feishu_alignment_decisions_v0.md');
  const assertDecisionRows = (candidate, label) => {
    const decisionSection = sectionSlice(
      candidate,
      '## 0456 裁决与当前实施状态',
      '0431 correction:',
      `${label}: decision surface`,
    );
    const rows = decisionSection.split('\n').filter((line) => /^\| F-\d+ \|/u.test(line));
    const rowsFor = (finding) => rows.filter((line) => line.startsWith(`| ${finding} |`));
    assert.equal(rowsFor('F-01').length, 1, `${label}: formal F-01 table row must exist exactly once`);
    assert.match(rowsFor('F-01')[0], /\| F-01 \|.*`pin_payload\.v2`.*`aligned\/completed`/u, `${label}: formal F-01 row must be closed`);
    assert.equal(rowsFor('F-05').length, 1, `${label}: formal F-05 table row must exist exactly once`);
    assert.match(rowsFor('F-05')[0], /`decision_recorded_implementation_pending`.*ui_action_pending:refresh_data/u, `${label}: F-05 must remain pending`);
    assert.equal(rowsFor('F-08').length, 1, `${label}: formal F-08 table row must exist exactly once`);
    assert.match(rowsFor('F-08')[0], /`decision_recorded_implementation_pending`.*task_action_pending:add_task_return/u, `${label}: F-08 must remain pending`);
    assert.match(decisionSection, /Feishu 写入仍需单独授权/u, `${label}: Feishu write must remain separately authorized`);
  };

  assertDecisionRows(content, 'canonical');
  const f01Row = content.split('\n').find((line) => line.startsWith('| F-01 |'));
  assert.ok(f01Row, 'F-01 mutation source row must exist');
  assert.throws(
    () => assertDecisionRows(content.replace(`${f01Row}\n`, ''), 'missing_f01_row'),
    /formal F-01 table row/u,
    'active-doc guard must reject deletion of the formal F-01 decision row',
  );
  const revertedF01Row = f01Row.replace('`aligned/completed`', '`local_acceptance_passed_closeout_pending`');
  assert.notEqual(revertedF01Row, f01Row, 'F-01 pending-state mutation must apply');
  assert.throws(
    () => assertDecisionRows(content.replace(f01Row, revertedF01Row), 'reverted_f01_row'),
    /formal F-01 row must be closed/u,
    'active-doc guard must reject a reverted formal F-01 decision row even if surrounding prose still says completed',
  );
}

function test_payload_contract_preserves_outer_transport_and_hard_cuts_inner_v1() {
  const content = read('docs/ssot/temporary_modeltable_payload_v1.md');
  assert.match(content, /公开 Feishu Message API input hard cut 到该版本/u);
  assert.match(content, /Feishu Message API v2 Extension（0457 current）/u);
  assert.match(content, /legacy v1 `0\/0\.1` child-table envelope/u);
  assert.match(content, /外层 transport packet 的 `\{ "version": "v1", "type": "pin_payload", "payload": \[\.\.\.\] \}` 仍是当前跨系统承载格式/u);
}

function test_user_and_ops_guides_use_current_mailbox_and_direct_control_path() {
  const guide = read('docs/user-guide/modeltable_user_guide.md');
  const ops = read('scripts/ops/README.md');
  const layering = read('docs/ssot/model_layering_and_cell_model_labels_v0_1.md');
  assert.match(guide, /Control To Control（默认）[\s\S]*本地 MQTT 直接投递到 R1/u);
  assert.match(guide, /MBR 即使观测到该 response 也不得 republish、echo/u);
  assert.match(guide, /建议先查 `bus_event_error`、`bus_event_last_op_id`/u);
  assert.match(ops, /GET \/snapshot\?profile=full/u);
  assert.match(ops, /POST \/bus_event` \+ `type=bus_event_v2/u);
  assert.match(ops, /baseline 6 个 deployment ready/u);
  assert.match(layering, /软件工人 host table 的 Model 0 `\(0,0,0\)` 必须显式带 `model\.v1n`/u);
  assert.doesNotMatch(layering, /Model 0 `\(0,0,0\)` 必须显式带 `model\.table`/u);
}

function test_all_active_control_guides_and_highest_contract_use_direct_no_echo_truth() {
  const claude = read('CLAUDE.md');
  const runtime = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const flow = read('docs/ssot/ui_to_matrix_event_flow.md');
  const provider = read('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md');
  const providerVisualized = read('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md');
  const providerInteractive = read('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html');
  const developer = read('docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md');
  const flowVisualized = read('docs/user-guide/slide-app-runtime/slide_app_runtime_flow_visualized.html');
  const overview = read('docs/user-guide/slide_delivery_and_runtime_overview_v1.md');
  const eventConfig = read('docs/user-guide/ui_event_matrix_mqtt_configuration.md');
  const workspaceManager = read('docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md');
  const oldColorRunbook = read('docs/user-guide/color_generator_e2e_runbook.md');
  const oldRemoteRunbook = read('docs/deployment/remote_worker_k8s_runbook.md');

  assert.doesNotMatch(claude, /MBR routing rules \(via mbr_route_\* labels\)/u);
  assert.doesNotMatch(claude, /intent_dispatch, mbr_route_\*, mqtt config helpers/u);
  assert.match(claude, /legacy `mbr_route_\*` labels MUST NOT be restored/u);
  assert.doesNotMatch(runtime, /UI Server 到 MBR 的出站路线/u);
  assert.doesNotMatch(runtime, /它是 MBR 的唯一转发 truth/u);
  assert.match(runtime, /control MQTT adapter 与 management MBR bridge 的唯一 transport routing truth/u);

  assert.match(flow, /Control request\/response.*UI Server.*R1.*本地 MQTT.*MBR 不桥接、不回显/su);
  assert.match(flow, /Management request\/response.*Matrix\/Synapse.*MBR/su);
  assert.doesNotMatch(flow, /Control bus packet -> MBR -> MQTT/u);
  assert.doesNotMatch(flow, /控制总线消息发送[\s\S]*MBR Worker 接收并转发[\s\S]*MQTT Broker/u);
  assert.match(flow, /UI Server MQTT adapter[\s\S]*本地 MQTT Broker[\s\S]*远程 Worker/u);

  assert.match(provider, /UI click -> Model 0 control bus -> local MQTT -> remote provider public pin/u);
  assert.match(provider, /pin\.bus\.cb\.out` -> local MQTT -> R1/u);
  assert.doesNotMatch(provider, /pin\.bus\.cb\.out` -> MBR/u);
  const providerManualResponse = sectionSlice(provider, '要模拟 `R1` 回包', '## 6. 导出与交付', 'provider manual response');
  assert.match(providerManualResponse, /"k": "bus"[\s\S]*"v": "control"/u);
  assert.match(providerManualResponse, /"k": "route_kind"[\s\S]*"v": "control"/u);
  assert.match(providerManualResponse, /"k": "timestamp"[\s\S]*"t": "int"/u);
  assert.match(providerManualResponse, /默认 control 回包[\s\S]*local MQTT[\s\S]*MBR 不得转发或回显/u);
  assert.doesNotMatch(providerManualResponse, /MBR 收到 `message_role=response` 后仍按当前 `topic` record 转发/u);
  assert.match(providerVisualized, /本地 MQTT control 直达 remote-worker R1/u);
  assert.doesNotMatch(providerVisualized, /CB->>MBR: control bus packet/u);
  assert.match(providerInteractive, /Model 0 control bus -> local MQTT/u);

  assert.match(developer, /默认 control 路径.*UI Server.*本地 MQTT.*R1/su);
  assert.match(developer, /`route_kind=management`.*Matrix\/Synapse.*MBR/su);
  assert.doesNotMatch(developer, /-> MBR \/ control-bus route/u);

  assert.match(overview, /control.*默认.*UI Server.*R1.*本地 MQTT.*直连/su);
  assert.match(overview, /management.*Matrix\/Synapse.*MBR/su);
  assert.match(flowVisualized, /UI Server MQTT adapter 直达目标 Worker；MBR no-echo/u);
  assert.match(eventConfig, /Control Bus -> local MQTT -> worker/u);
  assert.doesNotMatch(eventConfig, /Control Bus -> MBR -> MQTT -> worker/u);

  const workspacePath = sectionSlice(workspaceManager, '## 7. 安装点击后的完整路径', '## 8. 常见错误', 'workspace manager full path');
  assert.match(workspacePath, /provider_route_kind=control[\s\S]*UI Server local MQTT adapter[\s\S]*provider worker/u);
  assert.match(workspacePath, /provider_route_kind=management[\s\S]*Matrix\/Synapse[\s\S]*MBR/u);
  assert.doesNotMatch(workspacePath, /-> MBR 按 payload\.topic 转发/u);
  assert.match(workspaceManager, /provider 返回时[\s\S]*"k": "timestamp"[\s\S]*"t": "int"/u);

  assert.match(oldColorRunbook, /^status: historical$/mu);
  assert.match(oldColorRunbook, /Historical 0134\/0135 Matrix-first reproduction only/u);
  assert.match(oldRemoteRunbook, /^status: historical$/mu);
  assert.match(oldRemoteRunbook, /historical pre-0457 Matrix-first runbook/u);
}

const tests = [
  test_highest_runtime_contract_requires_standard_v2_transport_metadata,
  test_runtime_routing_requires_explicit_control_metadata,
  test_active_flow_separates_current_business_submit_from_historical_debug_intent,
  test_runtime_browser_bus_event_ingress_is_always_control_pin,
  test_active_overview_routes_ordinary_submit_to_control_ingress,
  test_all_active_browser_ingress_guides_keep_management_at_egress,
  test_discovered_active_surfaces_preserve_local_infra_and_browser_ingress_truth,
  test_ui_routing_guides_use_current_browser_ingress_and_local_six_de_baseline,
  test_runtime_current_contract_precedes_preserved_v1_history,
  test_alignment_separates_0457_current_from_0442_0450_history,
  test_decision_surface_closes_f01_and_keeps_followups_open,
  test_payload_contract_preserves_outer_transport_and_hard_cuts_inner_v1,
  test_user_and_ops_guides_use_current_mailbox_and_direct_control_path,
  test_all_active_control_guides_and_highest_contract_use_direct_no_echo_truth,
  test_active_formal_v2_examples_include_required_transport_metadata,
];

let passed = 0;
for (const test of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}: ${error.message}`);
  }
}

console.log(JSON.stringify({ passed, total: tests.length }));
if (passed !== tests.length) process.exit(1);
