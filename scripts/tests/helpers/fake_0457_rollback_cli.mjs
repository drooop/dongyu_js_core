#!/usr/bin/env node

import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const command = process.argv[2];
const originalArgs = process.argv.slice(3);
const statePath = process.env.DY_0457_FAKE_STATE;
const pvcRoot = process.env.DY_0457_FAKE_PVC;
const callLog = process.env.DY_0457_CALL_LOG;

if (!command || !statePath || !pvcRoot || !callLog) {
  process.stderr.write('fake_0457_missing_environment\n');
  process.exit(2);
}

function readState() {
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function writeState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function logCall() {
  appendFileSync(callLog, command + ' ' + originalArgs.join(' ') + '\n', 'utf8');
}

function failOnce(state, event) {
  if (state.failEvent === event && !state.failConsumed) {
    state.failConsumed = true;
    writeState(state);
    process.stderr.write('injected_failure:' + event + '\n');
    return true;
  }
  return false;
}

function imageTagForApp(app) {
  return {
    'ui-server': 'dy-ui-server:v1',
    'remote-worker': 'dy-remote-worker:v3',
    'workspace-manager': 'dy-remote-worker:v3',
    'mbr-worker': 'dy-mbr-worker:v2',
    synapse: 'ghcr.io/element-hq/synapse:latest',
    mosquitto: 'eclipse-mosquitto:2',
  }[app];
}

function listItem(kind, name, state) {
  const key = kind + '/' + name;
  const isReplaceReadback = Boolean(state.exactObjects && state.exactObjects[key]);
  let item;
  if (isReplaceReadback) {
    item = structuredClone(state.exactObjects[key]);
  } else if (kind === 'deployment') {
    item = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name, namespace: state.namespace },
      spec: {
        replicas: state.replicas[name],
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: { containers: [{ name, image: imageTagForApp(name) }] },
        },
      },
    };
  } else if (kind === 'service') {
    const offset = resourceNames('service', state).indexOf(name) + 10;
    item = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace: state.namespace },
      spec: {
        clusterIP: '10.96.0.' + offset,
        clusterIPs: ['10.96.0.' + offset],
        ipFamilies: ['IPv4'],
        ipFamilyPolicy: 'SingleStack',
        ports: [{ name: 'main', port: 80 + offset, protocol: 'TCP', targetPort: 80 + offset }],
        selector: { app: name === 'ui-server-nodeport' ? 'ui-server' : name },
      },
    };
  } else {
    const titles = { secret: 'Secret', configmap: 'ConfigMap' };
    item = {
      apiVersion: 'v1',
      kind: titles[kind] || (kind.charAt(0).toUpperCase() + kind.slice(1)),
      metadata: { name, namespace: state.namespace },
      data: { base: 'cHJl' },
    };
  }
  item.metadata = item.metadata || {};
  item.metadata.name = name;
  item.metadata.namespace = state.namespace;
  item.metadata.uid = kind + '-' + name;
  item.metadata.resourceVersion = 'rv-' + name;
  if (kind === 'deployment') item.status = { readyReplicas: state.replicas[name] };

  if (!isReplaceReadback && (state.emitSanitizedEmptyMetadataMaps || []).includes(key)) {
    item.metadata.annotations = {
      'kubectl.kubernetes.io/last-applied-configuration': '{"test":"operational-only"}',
    };
    item.metadata.labels = {};
  }

  if (state.k8sResidue && state.k8sResidue[key]) {
    item.metadata.labels = { ...(item.metadata.labels || {}), 'test-residue': 'txn-extra' };
    if (kind === 'deployment') {
      item.spec.template.spec.containers[0].env = [{ name: 'TXN_EXTRA', value: 'txn-extra' }];
    } else if (kind === 'service') {
      item.metadata.annotations = { ...(item.metadata.annotations || {}), 'test/residue': 'txn-extra' };
    } else {
      item.data = { ...(item.data || {}), txn_extra: 'dHhuLWV4dHJh' };
    }
  }
  if (isReplaceReadback && state.apiDropsEmptyMetadataMaps) {
    if (item.metadata.annotations && Object.keys(item.metadata.annotations).length === 0) {
      delete item.metadata.annotations;
    }
    if (item.metadata.labels && Object.keys(item.metadata.labels).length === 0) {
      delete item.metadata.labels;
    }
  }
  return item;
}

function resourceNames(kind, state) {
  if (kind === 'deployment') return Object.keys(state.replicas);
  if (kind === 'secret') return ['ui-server-secret', 'mbr-worker-secret'];
  if (kind === 'configmap') return ['mosquitto-config', 'synapse-config', 'remote-worker-config', 'workspace-manager-config', 'mbr-worker-config'];
  if (kind === 'service') return ['mosquitto', 'synapse', 'ui-server', 'ui-server-nodeport'];
  return [];
}

function parseNames(args, start) {
  const names = [];
  for (let index = start; index < args.length; index += 1) {
    if (args[index].startsWith('-')) break;
    names.push(args[index]);
  }
  return names;
}

function outputJson(value) {
  process.stdout.write(JSON.stringify(value));
}

function stripNamespace(args) {
  if (args[0] === '-n') return args.slice(2);
  return args;
}

function moveDirectoryContents(source, destination, exclusions = new Set()) {
  mkdirSync(destination, { recursive: false });
  for (const name of readFileNames(source)) {
    const from = join(source, name);
    if (exclusions.has(from)) continue;
    renameSync(from, join(destination, name));
  }
}

function readFileNames(root) {
  return existsSync(root) ? Array.from(new Set(readdirSync(root))) : [];
}

function runKubectl() {
  const state = readState();
  const args = stripNamespace(originalArgs);
  const verb = args[0];

  if (verb === 'config' && args[1] === 'current-context') {
    process.stdout.write(state.context + '\n');
    return;
  }

  if (verb === 'get') {
    const kind = args[1];
    if (kind === 'pvc') {
      outputJson({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'synapse-data', namespace: state.namespace, uid: state.pvcUid },
        spec: { volumeName: state.pvName },
        status: { phase: 'Bound' },
      });
      return;
    }
    if (kind === 'pv') {
      outputJson({
        apiVersion: 'v1',
        kind: 'PersistentVolume',
        metadata: { name: state.pvName, uid: state.pvUid },
        spec: { claimRef: { name: 'synapse-data', namespace: state.namespace, uid: state.claimRefUid } },
        status: { phase: 'Bound' },
      });
      return;
    }
    if (kind === 'pod' || kind === 'pods') {
      const selectorIndex = args.indexOf('-l');
      if (selectorIndex >= 0) {
        const app = args[selectorIndex + 1].replace(/^app=/u, '');
        const replicas = state.replicas[app] ?? 0;
        if (app === 'synapse' && state.currentSynapsePodUnavailable && replicas > 0) return;
        const terminating = Boolean(state.terminating && state.terminating[app]);
        if (replicas === 0 && !terminating) return;
        const outputIndex = args.indexOf('-o');
        const output = outputIndex >= 0 ? args[outputIndex + 1] : '';
        if (output === 'name') {
          process.stdout.write('pod/' + app + '-0\n');
          return;
        }
        if (output.includes('metadata.name')) {
          process.stdout.write(app + '-0');
          return;
        }
        if (output.includes('imageID')) {
          if (state.podImageMismatch === app) {
            process.stdout.write('docker://sha256:mismatch');
          } else {
            process.stdout.write('docker://' + state.images[imageTagForApp(app)]);
          }
          return;
        }
        outputJson({ items: [{ metadata: { name: app + '-0' } }] });
        return;
      }
      const directName = args[2];
      if (kind === 'pod' && directName && !directName.startsWith('-')) {
        if (state.helper !== directName) process.exit(1);
        outputJson({ metadata: { name: directName } });
        return;
      }
      const items = [];
      for (const [app, replicas] of Object.entries(state.replicas)) {
        if (replicas > 0 || (state.terminating && state.terminating[app])) {
          items.push({ metadata: { name: app + '-0', labels: { app } } });
        }
      }
      outputJson({ apiVersion: 'v1', kind: 'List', items });
      return;
    }

    const normalizedKind = kind.endsWith('s') ? kind.slice(0, -1) : kind;
    const outputIndex = args.indexOf('-o');
    const output = outputIndex >= 0 ? args[outputIndex + 1] : '';
    const requested = parseNames(args, 2);
    const names = requested.length > 0 ? requested : resourceNames(normalizedKind, state);
    if (normalizedKind === 'deployment' && names.length === 1 && output.includes('spec.replicas')) {
      process.stdout.write(String(state.replicas[names[0]]));
      return;
    }
    if (output === 'name') {
      process.stdout.write(names.map((name) => normalizedKind + '/' + name).join('\n') + '\n');
      return;
    }
    if (names.length === 1 && output === 'json') {
      outputJson(listItem(normalizedKind, names[0], state));
      return;
    }
    outputJson({
      apiVersion: 'v1',
      kind: 'List',
      items: names.map((name) => listItem(normalizedKind, name, state)),
    });
    return;
  }

  if (verb === 'scale') {
    const replicasArg = args.find((value) => value.startsWith('--replicas='));
    const replicas = Number(replicasArg.split('=')[1]);
    if (replicas > 0 && Number(state.failRestoreScaleRemaining || 0) > 0) {
      state.failRestoreScaleRemaining -= 1;
      writeState(state);
      process.stderr.write('injected_failure:restore_scale\n');
      process.exit(1);
    }
    if (replicas === 0) {
      state.scaleDownCount = Number(state.scaleDownCount || 0) + 1;
      if (Number(state.failScaleDownAt || 0) === state.scaleDownCount) {
        writeState(state);
        process.stderr.write('injected_failure:partial_scale_down\n');
        process.exit(1);
      }
      if (failOnce(state, 'scale_down')) process.exit(1);
    }
    for (const value of args.slice(1)) {
      if (value.startsWith('deployment/')) {
        const deployment = value.slice('deployment/'.length);
        state.replicas[deployment] = replicas;
        if (deployment === 'synapse' && replicas === 0) {
          state.currentSynapsePodUnavailable = false;
          state.failCurrentSynapseExec = false;
        }
        state.terminating = state.terminating || {};
        if (replicas === 0 && state.delayedTerminationApp === deployment) {
          state.terminating[deployment] = true;
        } else if (replicas > 0) {
          state.terminating[deployment] = false;
        }
      }
    }
    writeState(state);
    return;
  }

  if (verb === 'wait' || verb === 'rollout') {
    if (verb === 'rollout' && failOnce(state, 'rollout')) process.exit(1);
    if (verb === 'wait' && args.includes('--for=delete')) {
      const selectorIndex = args.indexOf('-l');
      const app = selectorIndex >= 0 ? args[selectorIndex + 1].replace(/^app=/u, '') : '';
      if (app && state.terminating && state.terminating[app]) {
        if (state.delayedTerminationApp === app && !state.delayedTerminationConsumed) {
          state.delayedTerminationConsumed = true;
          writeState(state);
          process.stderr.write('injected_failure:delayed_termination\n');
          process.exit(1);
        }
        state.terminating[app] = false;
        writeState(state);
      }
    }
    return;
  }

  if (verb === 'apply') {
    const fileIndex = args.indexOf('-f');
    const source = args[fileIndex + 1];
    if (args.some((value) => value.startsWith('--dry-run='))) {
      if (source === '-') readFileSync(0, 'utf8');
      return;
    }
    if (source === '-') {
      const yaml = readFileSync(0, 'utf8');
      const match = yaml.match(/name:\s*(synapse-0457-(?:backup|restore))/u);
      if (!match) process.exit(2);
      state.helper = match[1];
      writeState(state);
      return;
    }
    const parsed = JSON.parse(readFileSync(source, 'utf8'));
    for (const item of parsed.items || []) {
      if (item.kind === 'Deployment' && item.metadata && item.spec) {
        state.replicas[item.metadata.name] = Number(item.spec.replicas || 0);
      }
    }
    writeState(state);
    return;
  }

  if (verb === 'replace') {
    const fileIndex = args.indexOf('-f');
    const source = args[fileIndex + 1];
    if (source !== '-') process.exit(2);
    const item = JSON.parse(readFileSync(0, 'utf8'));
    if (process.env.DY_0457_EXACT_RESTORE_PHASE === 'recovery' && state.failRecoveryReplace) {
      process.stderr.write('injected_failure:recovery_replace\n');
      process.exit(1);
    }
    const kind = String(item.kind || '').toLowerCase();
    const name = item.metadata && item.metadata.name;
    const key = kind + '/' + name;
    state.exactObjects = state.exactObjects || {};
    state.k8sResidue = state.k8sResidue || {};
    state.exactObjects[key] = item;
    state.k8sResidue[key] = JSON.stringify(item).includes('txn-extra');
    if (kind === 'deployment') state.replicas[name] = Number(item.spec.replicas || 0);
    writeState(state);
    outputJson(item);
    return;
  }

  if (verb === 'delete' && args[1] === 'pod') {
    if (Number(state.failHelperCleanupRemaining || 0) > 0) {
      state.failHelperCleanupRemaining -= 1;
      writeState(state);
      process.stderr.write('injected_failure:helper_cleanup\n');
      process.exit(1);
    }
    state.helper = null;
    writeState(state);
    return;
  }

  if (verb === 'exec') {
    let index = 1;
    if (args[index] === '-i') index += 1;
    const targetPod = args[index];
    index += 1;
    const separator = args.indexOf('--');
    const remote = args.slice(separator + 1);
    const remoteText = remote.join(' ');

    if (state.failCurrentSynapseExec && targetPod !== 'synapse-0457-restore' && /^synapse-[0-9]/u.test(targetPod)) {
      process.stderr.write('injected_failure:current_synapse_exec\n');
      process.exit(1);
    }

    if (remote[0] === 'du') {
      process.stdout.write('1024\t/data\n');
      return;
    }
    if (remoteText.includes('df -Pk /data')) {
      process.stdout.write('1000000\n');
      return;
    }
    if (remote[0] === 'env' && remote.some((value) => value.startsWith('OUT='))) {
      const out = remote.find((value) => value.startsWith('OUT=')).slice(4);
      cpSync(join(pvcRoot, 'homeserver.db'), join(pvcRoot, basename(out)));
      return;
    }
    if (remote[0] === 'cat' && remote.length === 2) {
      process.stdout.write(readFileSync(join(pvcRoot, basename(remote[1]))));
      return;
    }
    if (remote[0] === 'tar' && remote.includes('-cpf')) {
      const itemIndex = remote.indexOf('-cpf') + 2;
      const result = spawnSync('tar', ['--numeric-owner', '-C', pvcRoot, '-cpf', '-', ...remote.slice(itemIndex)], { encoding: null });
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.status || 1);
      }
      process.stdout.write(result.stdout);
      return;
    }
    if (remote[0] === 'rm' && remote[1] === '-f') {
      const target = join(pvcRoot, basename(remote[2]));
      if (existsSync(target)) unlinkSync(target);
      return;
    }
    if (remote[0] === 'env' && remote.some((value) => value.startsWith('FAILED_NAME='))) {
      const failedName = remote.find((value) => value.startsWith('FAILED_NAME=')).slice('FAILED_NAME='.length);
      const attemptEntry = remote.find((value) => value.startsWith('ATTEMPT_NAME='));
      const failedPath = join(pvcRoot, failedName);
      if (!attemptEntry) {
        moveDirectoryContents(pvcRoot, failedPath, new Set([failedPath]));
      } else {
        const attemptPath = join(pvcRoot, attemptEntry.slice('ATTEMPT_NAME='.length));
        moveDirectoryContents(pvcRoot, attemptPath, new Set([failedPath, attemptPath]));
        for (const name of readFileNames(failedPath)) {
          renameSync(join(failedPath, name), join(pvcRoot, name));
        }
        rmdirSync(failedPath);
      }
      return;
    }
    if (remote[0] === 'tar' && remote.includes('-xpf')) {
      const input = readFileSync(0);
      const result = spawnSync('tar', ['--numeric-owner', '-C', pvcRoot, '-xpf', '-'], { input, encoding: null });
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.status || 1);
      }
      return;
    }
    if (remote[0] === 'sh' && remoteText.includes('cat > /data/homeserver.db')) {
      if (failOnce(state, 'synapse_write')) process.exit(1);
      writeFileSync(join(pvcRoot, 'homeserver.db'), readFileSync(0));
      return;
    }
    if (remote[0] === 'sh' && remoteText.includes('chown -R 991:991')) return;
    if (remote.includes('python3')) return;
    process.stderr.write('unsupported fake kubectl exec: ' + remoteText + '\n');
    process.exit(2);
  }

  process.stderr.write('unsupported fake kubectl args: ' + args.join(' ') + '\n');
  process.exit(2);
}

function runDocker() {
  const state = readState();
  const args = originalArgs;
  if (args[0] === 'context' && args[1] === 'show') {
    process.stdout.write(state.dockerContext + '\n');
    return;
  }
  if (args[0] === 'image' && args[1] === 'inspect') {
    const formatIndex = args.indexOf('--format');
    const tags = args.slice(2, formatIndex >= 0 ? formatIndex : args.length);
    const format = formatIndex >= 0 ? args[formatIndex + 1] : '';
    for (const tag of tags) {
      if (!state.images[tag]) process.exit(1);
    }
    if (format.includes('.Id')) {
      process.stdout.write(tags.map((tag) => state.images[tag]).join('\n') + '\n');
      return;
    }
    if (format.includes('.Size')) {
      process.stdout.write(tags.map(() => '1024').join('\n') + '\n');
      return;
    }
    if (format.includes('RepoDigests')) {
      process.stdout.write('[]\n');
      return;
    }
    outputJson(tags.map((tag) => ({ Id: state.images[tag], RepoTags: [tag], Size: 1024 })));
    return;
  }
  if (args[0] === 'image' && args[1] === 'tag') {
    const source = args[2];
    const target = args[3];
    if (String(source).startsWith('sha256:') && Number(state.failRecoveryImageTagRemaining || 0) > 0) {
      state.failRecoveryImageTagRemaining -= 1;
      writeState(state);
      process.stderr.write('injected_failure:image_tag_recovery\n');
      process.exit(1);
    }
    const resolved = state.images[source] || source;
    state.images[target] = resolved;
    writeState(state);
    return;
  }
  if (args[0] === 'save') {
    const outputIndex = args.indexOf('-o');
    const output = args[outputIndex + 1];
    const tags = args.slice(outputIndex + 2);
    const archive = {};
    for (const tag of tags) archive[tag] = state.images[tag];
    writeFileSync(output, JSON.stringify(archive), 'utf8');
    return;
  }
  if (args[0] === 'load') {
    const inputIndex = args.indexOf('-i');
    Object.assign(state.images, JSON.parse(readFileSync(args[inputIndex + 1], 'utf8')));
    writeState(state);
    if (failOnce(state, 'docker_load_after_mutation')) process.exit(1);
    return;
  }
  process.stderr.write('unsupported fake docker args: ' + args.join(' ') + '\n');
  process.exit(2);
}

function runGit() {
  const args = originalArgs[0] === '-C' ? originalArgs.slice(2) : originalArgs;
  if (args[0] === 'check-ignore') return;
  if (args[0] === 'status') return;
  if (args[0] === 'rev-parse') {
    process.stdout.write('1111111111111111111111111111111111111111\n');
    return;
  }
  if (args[0] === 'show') {
    process.stdout.write('#!/usr/bin/env bash\nexit 0\n');
    return;
  }
  process.stderr.write('unsupported fake git args: ' + args.join(' ') + '\n');
  process.exit(2);
}

function runDitto() {
  const source = originalArgs[originalArgs.length - 2];
  const target = originalArgs[originalArgs.length - 1];
  const state = readState();
  if (failOnce(state, 'ditto')) process.exit(1);
  cpSync(source, target, { recursive: true, preserveTimestamps: true });
}

function runDf() {
  const state = readState();
  const available = state.enospc ? 1 : 1000000;
  process.stdout.write('Filesystem 1024-blocks Used Available Capacity Mounted on\n');
  process.stdout.write('fake 2000000 1 ' + available + ' 1% /\n');
}

function runDu() {
  process.stdout.write('4\t' + originalArgs[originalArgs.length - 1] + '\n');
}

logCall();
if (command === 'kubectl') runKubectl();
else if (command === 'docker') runDocker();
else if (command === 'git') runGit();
else if (command === 'ditto') runDitto();
else if (command === 'df') runDf();
else if (command === 'du') runDu();
else {
  process.stderr.write('unsupported fake command: ' + command + '\n');
  process.exit(2);
}
