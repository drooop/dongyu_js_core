#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const runnerPath = path.join(repoRoot, 'scripts/run_worker_remote_v1.mjs');
const mbrRunnerPath = path.join(repoRoot, 'scripts/run_worker_v0.mjs');
const mbrPatchDir = path.join(repoRoot, 'deploy/sys-v1ns/mbr/patches');
const dockerfilePath = path.join(repoRoot, 'k8s/Dockerfile.remote-worker');
const workerManifestPaths = [
  path.join(repoRoot, 'k8s/local/workers.yaml'),
  path.join(repoRoot, 'k8s/cloud/workers.yaml'),
];
const source = fs.readFileSync(runnerPath, 'utf8');
const mbrSource = fs.readFileSync(mbrRunnerPath, 'utf8');
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
const networkBoundarySchema = 'de_network_boundary_evidence.v1';
const localMqttDestination = 'mqtt://mosquitto.dongyu.svc.cluster.local:1883';
const localMatrixDestination = 'http://synapse.dongyu.svc.cluster.local:8008';
const allowedFeishuDestination = 'https://open.feishu.cn/open-apis';
const startedAt = 1773379200000;
const networkHeartbeatIntervalMs = 10000;

function stripJavaScriptComments(input) {
  let output = '';
  let state = 'code';

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (state === 'line_comment') {
      if (character === '\n' || character === '\r') {
        output += character;
        state = 'code';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block_comment') {
      if (character === '*' && next === '/') {
        output += '  ';
        index += 1;
        state = 'code';
      } else {
        output += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (state === 'single_quote' || state === 'double_quote' || state === 'template') {
      output += character;
      if (character === '\\') {
        if (next !== undefined) {
          output += next;
          index += 1;
        }
        continue;
      }
      if (
        (state === 'single_quote' && character === "'")
        || (state === 'double_quote' && character === '"')
        || (state === 'template' && character === '`')
      ) {
        state = 'code';
      }
      continue;
    }

    if (character === '/' && next === '/') {
      output += '  ';
      index += 1;
      state = 'line_comment';
      continue;
    }
    if (character === '/' && next === '*') {
      output += '  ';
      index += 1;
      state = 'block_comment';
      continue;
    }
    if (character === "'") state = 'single_quote';
    else if (character === '"') state = 'double_quote';
    else if (character === '`') state = 'template';
    output += character;
  }

  return output;
}

function skipQuotedValue(input, startIndex) {
  const quote = input[startIndex];
  for (let index = startIndex + 1; index < input.length; index += 1) {
    if (input[index] === '\\') {
      index += 1;
      continue;
    }
    if (input[index] === quote) return index;
  }
  return input.length - 1;
}

function maskQuotedValues(input) {
  const characters = input.split('');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character !== "'" && character !== '"' && character !== '`') continue;
    const endIndex = skipQuotedValue(input, index);
    for (let cursor = index; cursor <= endIndex; cursor += 1) {
      if (input[cursor] !== '\n' && input[cursor] !== '\r') characters[cursor] = ' ';
    }
    index = endIndex;
  }
  return characters.join('');
}

function findClosingParenthesis(input, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < input.length; index += 1) {
    const character = input[index];
    if (character === "'" || character === '"' || character === '`') {
      index = skipQuotedValue(input, index);
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findIdentifierCallSites(input, identifier) {
  const sites = [];
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === "'" || character === '"' || character === '`') {
      index = skipQuotedValue(input, index);
      continue;
    }
    if (!input.startsWith(identifier, index)) continue;

    const before = input[index - 1] || '';
    const after = input[index + identifier.length] || '';
    if (/[$\w]/u.test(before) || /[$\w]/u.test(after)) continue;

    let openIndex = index + identifier.length;
    while (/\s/u.test(input[openIndex] || '')) openIndex += 1;
    if (input[openIndex] !== '(') continue;

    const closeIndex = findClosingParenthesis(input, openIndex);
    assert.notEqual(closeIndex, -1, `${identifier} call must have a closing parenthesis`);
    sites.push({
      index,
      openIndex,
      closeIndex,
      body: input.slice(openIndex + 1, closeIndex),
    });
  }
  return sites;
}

function braceDepthAt(input, targetIndex) {
  let depth = 0;
  for (let index = 0; index < targetIndex; index += 1) {
    const character = input[index];
    if (character === "'" || character === '"' || character === '`') {
      index = skipQuotedValue(input, index);
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
  }
  return depth;
}

function exactStringArgument(body, expected) {
  return new RegExp(`^\\s*['"]${expected}['"]\\s*$`, 'u').test(body);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function assertStandaloneExpressionCall(input, site, identifier, expectedExpression, message) {
  const lineStart = input.lastIndexOf('\n', site.index) + 1;
  const lineEndCandidate = input.indexOf('\n', site.closeIndex);
  const lineEnd = lineEndCandidate === -1 ? input.length : lineEndCandidate;
  const line = input.slice(lineStart, lineEnd).trim();
  const escapedIdentifier = escapeRegExp(identifier);
  const escapedExpression = escapeRegExp(expectedExpression);
  assert.match(
    line,
    new RegExp(`^${escapedIdentifier}\\(\\s*${escapedExpression}\\s*\\);$`, 'u'),
    message,
  );
}

function assertStandaloneStringCall(input, site, identifier, expectedValue, message) {
  const lineStart = input.lastIndexOf('\n', site.index) + 1;
  const lineEndCandidate = input.indexOf('\n', site.closeIndex);
  const lineEnd = lineEndCandidate === -1 ? input.length : lineEndCandidate;
  const line = input.slice(lineStart, lineEnd).trim();
  const escapedIdentifier = escapeRegExp(identifier);
  const escapedValue = escapeRegExp(expectedValue);
  assert.match(
    line,
    new RegExp(`^${escapedIdentifier}\\(\\s*['"]${escapedValue}['"]\\s*\\);$`, 'u'),
    message,
  );
}

function assertDirectFactoryInitializer(input, site, variableName, message) {
  const prefix = input.slice(Math.max(0, site.index - 160), site.index);
  const escapedVariableName = escapeRegExp(variableName);
  assert.match(
    prefix,
    new RegExp(`const\\s+${escapedVariableName}\\s*=\\s*$`, 'u'),
    message,
  );
  assert.match(
    input.slice(site.closeIndex + 1),
    /^\s*;/u,
    `${message}: initializer call must terminate as one standalone const statement`,
  );
}

function assertImmediatelyPrecedesCall(input, evidenceSite, outboundSite, message) {
  const outboundLineStart = input.lastIndexOf('\n', outboundSite.index) + 1;
  const between = input.slice(evidenceSite.closeIndex + 1, outboundLineStart);
  assert.match(between, /^\s*;\s*$/u, message);
}

function assertReturnedCall(input, site, message) {
  const lineStart = input.lastIndexOf('\n', site.index) + 1;
  assert.equal(input.slice(lineStart, site.index).trim(), 'return', message);
  assert.match(
    input.slice(site.closeIndex + 1),
    /^\s*;/u,
    `${message}: returned call must terminate as one statement`,
  );
}

function extractUniqueArrowFunction(input, declarationPattern, message) {
  const executableSource = stripJavaScriptComments(input);
  const searchableSource = maskQuotedValues(executableSource);
  const flags = declarationPattern.flags.includes('g')
    ? declarationPattern.flags
    : `${declarationPattern.flags}g`;
  const matches = [...searchableSource.matchAll(new RegExp(declarationPattern.source, flags))];
  assert.equal(matches.length, 1, message);
  const match = matches[0];
  const openBrace = searchableSource.indexOf('{', match.index);
  const closeBrace = findClosingBrace(executableSource, openBrace);
  assert.notEqual(closeBrace, -1, `${message}: wrapper must have a complete executable body`);
  return {
    body: executableSource.slice(openBrace + 1, closeBrace),
    bodyStart: openBrace + 1,
    end: closeBrace + 1,
    source: executableSource.slice(match.index, closeBrace + 1),
    start: match.index,
  };
}

function replaceContractFixtureToken(input, before, after, fixtureName) {
  const occurrences = input.split(before).length - 1;
  assert.equal(occurrences, 1, `${fixtureName}: mutation token must occur exactly once`);
  return input.replace(before, after);
}

function assertContractMutationsRejected(assertContract, mutations, message) {
  const accepted = [];
  const unexpectedFailures = [];
  for (const { name, source: fixtureSource, expectedPattern } of mutations) {
    try {
      assertContract(fixtureSource);
      accepted.push(name);
    } catch (error) {
      const detail = String(error && error.message ? error.message : error);
      if (!expectedPattern.test(detail)) unexpectedFailures.push(`${name}: ${detail}`);
    }
  }
  assert.deepEqual(unexpectedFailures, [], `${message}: mutations must fail for their intended contract reason`);
  assert.deepEqual(accepted, [], `${message}: contract checker accepted invalid mutations`);
}

function findClosingBrace(input, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < input.length; index += 1) {
    const character = input[index];
    if (character === "'" || character === '"' || character === '`') {
      index = skipQuotedValue(input, index);
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractNamedFunction(input, functionName, { exported = false } = {}) {
  const executableSource = stripJavaScriptComments(input);
  const searchableSource = maskQuotedValues(executableSource);
  const declarationPattern = new RegExp(
    `\\b${exported ? 'export\\s+' : ''}function\\s+${escapeRegExp(functionName)}\\s*\\(`,
    'gu',
  );
  const matches = [...searchableSource.matchAll(declarationPattern)].filter((match) => (
    exported || !/\\bexport\\s*$/u.test(searchableSource.slice(Math.max(0, match.index - 24), match.index))
  ));
  assert.equal(
    matches.length,
    1,
    exported
      ? `${functionName} must be one unique exported function declaration`
      : `${functionName} must be one unique non-exported function declaration`,
  );
  const match = matches[0];
  const openParenthesis = executableSource.indexOf('(', match.index);
  const closeParenthesis = findClosingParenthesis(executableSource, openParenthesis);
  const openBrace = executableSource.indexOf('{', closeParenthesis + 1);
  const closeBrace = findClosingBrace(executableSource, openBrace);
  assert.notEqual(closeBrace, -1, `${functionName} must have a complete executable body`);
  return {
    end: closeBrace + 1,
    executableSource,
    body: executableSource.slice(openBrace + 1, closeBrace),
    bodyEnd: closeBrace,
    bodyStart: openBrace + 1,
    parameters: executableSource.slice(openParenthesis + 1, closeParenthesis),
    source: executableSource.slice(match.index, closeBrace + 1),
    start: match.index,
  };
}

function extractExportedFunction(input, functionName) {
  return extractNamedFunction(input, functionName, { exported: true });
}

function assertStandardMainEntrypoint(executableSource, mainDeclaration) {
  const searchableSource = maskQuotedValues(executableSource);
  const entrypointPattern = /\bif\s*\(\s*import\.meta\.url\s*===\s*entrypointUrl\s*\)\s*\{/gu;
  const entrypointMatches = [...searchableSource.matchAll(entrypointPattern)];
  assert.equal(entrypointMatches.length, 1, 'mbr-worker must expose one standard import.meta.url entrypoint');
  const entrypointMatch = entrypointMatches[0];
  assert.ok(entrypointMatch.index > mainDeclaration.end, 'standard entrypoint must follow the real main declaration');
  const entrypointOpenBrace = searchableSource.indexOf('{', entrypointMatch.index);
  const entrypointCloseBrace = findClosingBrace(executableSource, entrypointOpenBrace);
  assert.notEqual(entrypointCloseBrace, -1, 'standard entrypoint must have a complete executable body');
  const entrypointBody = executableSource.slice(entrypointOpenBrace + 1, entrypointCloseBrace);
  const tryMatch = /^\s*try\s*\{/u.exec(entrypointBody);
  assert.ok(tryMatch, 'standard entrypoint must directly enter a try block that invokes main');
  const tryOpenBrace = entrypointBody.indexOf('{', tryMatch.index);
  const tryCloseBrace = findClosingBrace(entrypointBody, tryOpenBrace);
  assert.notEqual(tryCloseBrace, -1, 'standard entrypoint try block must be complete');
  const tryBody = entrypointBody.slice(tryOpenBrace + 1, tryCloseBrace);
  assert.match(tryBody, /^\s*main\s*\(\s*\)\s*;\s*$/u, 'standard entrypoint must directly call the unique main()');

  const mainSites = findIdentifierCallSites(executableSource, 'main')
    .filter((site) => site.index < mainDeclaration.start || site.index >= mainDeclaration.end);
  assert.equal(mainSites.length, 1, 'the unique main function must have exactly one executable call site');
  assert.equal(
    mainSites[0].index > entrypointOpenBrace && mainSites[0].closeIndex < entrypointCloseBrace,
    true,
    'the only main() call must belong to the standard entrypoint',
  );
}

function instantiateRunnerOwnedInstaller(input, functionName, sharedFactory) {
  const declaration = extractExportedFunction(input, functionName);
  const functionSource = declaration.source.replace(/^\s*export\s+/u, '');
  const load = new Function(
    'createDeNetworkBoundaryObservability',
    `'use strict';\n${functionSource}\nreturn ${functionName};`,
  );
  return { declaration, install: load(sharedFactory) };
}

function exerciseRunnerOwnedInstaller({
  install,
  installArgs,
  destinations,
  expectedProtocols,
  expectedService,
  parseLines,
}) {
  const lines = [];
  const timestamps = [];
  let nextTimestamp = startedAt + 500;
  let heartbeat = null;
  let intervalDelay = null;
  let clearCount = 0;
  const timerHandle = { unref() {} };
  const observer = install({
    ...installArgs,
    writeLine: (line) => lines.push(line),
    now: () => {
      timestamps.push(nextTimestamp);
      nextTimestamp += 1;
      return timestamps.at(-1);
    },
    setIntervalFn: (callback, delay) => {
      heartbeat = callback;
      intervalDelay = delay;
      return timerHandle;
    },
    clearIntervalFn: (handle) => {
      assert.equal(handle, timerHandle);
      clearCount += 1;
    },
    heartbeatIntervalMs: networkHeartbeatIntervalMs,
  });
  assert.equal(lines.length, destinations.length, `${expectedService}: runner-owned installer must execute startup heartbeat`);
  assert.equal(intervalDelay, networkHeartbeatIntervalMs, `${expectedService}: runner-owned installer must pass the heartbeat interval`);
  assert.equal(typeof heartbeat, 'function', `${expectedService}: runner-owned installer must execute timer registration`);
  heartbeat();
  for (const destination of destinations) observer.recordOutbound(destination);
  const parsed = parseLines(lines.join('\n'), { since: startedAt });
  assert.deepEqual(
    parsed.map(({ kind, protocol, service }) => ({ kind, protocol, service })),
    [
      ...expectedProtocols.map((protocol) => ({ kind: 'effective_config', protocol, service: expectedService })),
      ...expectedProtocols.map((protocol) => ({ kind: 'effective_config', protocol, service: expectedService })),
      ...expectedProtocols.map((protocol) => ({ kind: 'outbound_attempt', protocol, service: expectedService })),
    ],
    `${expectedService}: runner-owned installer must execute startup, interval, and outbound through the shared helper`,
  );
  assert.deepEqual(parsed.map((entry) => entry.ts), timestamps, `${expectedService}: runner-owned path must preserve fresh injected timestamps`);
  observer.stop();
  observer.stop();
  assert.equal(clearCount, 1, `${expectedService}: runner-owned stop must remain idempotent`);
}

function assertDiagnosticInvocationContract(runnerSource) {
  const executableSource = stripJavaScriptComments(runnerSource);

  assert.match(
    executableSource,
    /import\s*\{[^}]*\bcreateRoleScopedDeRuntimeDiagnosticHeartbeat\b[^}]*\}\s*from\s*['"]\.\/lib\/de_runtime_diagnostics\.mjs['"]/su,
    'runner must import the shared role-scoped diagnostic heartbeat factory',
  );
  assert.match(
    executableSource,
    /const\s+runtimeDiagnostics\s*=\s*createRoleScopedDeRuntimeDiagnosticHeartbeat\(\{/u,
    'runner must create one role-scoped diagnostic lifecycle',
  );
  assert.match(
    executableSource,
    /workerScope:\s*WORKER_SCOPE/u,
    'runner must pass its actual worker scope to diagnostics',
  );
  assert.match(
    executableSource,
    /runtime:\s*rt/u,
    'runner must pass the shared runtime to diagnostics',
  );
  assert.match(
    executableSource,
    /heartbeatIntervalMs:\s*10000/u,
    'runner must request the ten-second diagnostic heartbeat only through the role-scoped lifecycle',
  );
  assert.doesNotMatch(
    executableSource,
    /\bcreateDeRuntimeDiagnosticEmitter\b|function\s+emitMqttDiagnostics\b/u,
    'shared runner must not bypass role scoping or keep a local diagnostics implementation',
  );

  const startSites = findIdentifierCallSites(executableSource, 'rt.startMqttLoop');
  assert.equal(startSites.length, 1, 'runner must have exactly one real startMqttLoop call');
  assert.equal(braceDepthAt(executableSource, startSites[0].index), 0, 'startMqttLoop must execute on the top-level runner path');

  const lifecycleStartSites = findIdentifierCallSites(executableSource, 'runtimeDiagnostics.start');
  assert.equal(lifecycleStartSites.length, 1, 'runner must start the role-scoped diagnostics lifecycle exactly once');
  assertStandaloneExpressionCall(
    executableSource,
    lifecycleStartSites[0],
    'runtimeDiagnostics.start',
    '',
    'diagnostic lifecycle start must be one independent executable statement',
  );
  assert.equal(braceDepthAt(executableSource, lifecycleStartSites[0].index), 0, 'diagnostic lifecycle start must execute on the top-level runner path');
  assert.ok(lifecycleStartSites[0].index > startSites[0].closeIndex, 'diagnostic lifecycle must start only after startMqttLoop returns');
  const lifecycleStopSites = findIdentifierCallSites(executableSource, 'runtimeDiagnostics.stop');
  assert.equal(lifecycleStopSites.length, 1, 'runner shutdown must stop the diagnostic lifecycle exactly once');
}

function assertNetworkBoundaryFactoryImport(executableSource, runnerName) {
  const importMatch = executableSource.match(
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"]\.\/lib\/de_network_boundary_evidence\.mjs['"]/su,
  );
  assert.ok(importMatch, `${runnerName} must import the shared network-boundary evidence helper`);
  assert.match(
    importMatch.groups.names,
    /\bcreateDeNetworkBoundaryObservability\b/u,
    `${runnerName} must import the shared runtime observability factory`,
  );
}

function assertNetworkBoundaryFactoryInstallation(executableSource, {
  runnerName,
  installerName,
  invocationIdentifier = installerName,
  service,
  servicePattern = new RegExp(`\\bservice\\s*:\\s*['"]${escapeRegExp(service)}['"]`, 'u'),
  expectedBraceDepth,
  effectiveDestinationsPattern,
  invocationPattern,
  invocationSource = executableSource,
  defaultInstallerBindingPattern = null,
}) {
  assertNetworkBoundaryFactoryImport(executableSource, runnerName);
  const declaration = extractExportedFunction(executableSource, installerName);
  const factorySites = findIdentifierCallSites(declaration.source, 'createDeNetworkBoundaryObservability');
  assert.equal(factorySites.length, 1, `${runnerName} installer must execute exactly one shared network-boundary observer`);
  const factorySite = factorySites[0];
  assert.match(
    declaration.source,
    new RegExp(`\\breturn\\s+createDeNetworkBoundaryObservability\\s*\\(`, 'u'),
    `${runnerName} installer must return the directly executed shared observer`,
  );
  const allInstallerSites = findIdentifierCallSites(executableSource, installerName)
    .filter((site) => site.index < declaration.start || site.index >= declaration.end);
  if (invocationIdentifier === installerName) {
    assert.equal(allInstallerSites.length, 1, `${runnerName} must have exactly one installer call outside its declaration`);
  } else {
    assert.equal(allInstallerSites.length, 0, `${runnerName} must invoke the injectable installer binding, not bypass it`);
    assert.match(
      invocationSource,
      defaultInstallerBindingPattern,
      `${runnerName} injectable installer must default to its runner-owned installer`,
    );
  }
  const installerSites = invocationIdentifier === installerName && invocationSource === executableSource
    ? allInstallerSites
    : findIdentifierCallSites(invocationSource, invocationIdentifier);
  assert.equal(installerSites.length, 1, `${runnerName} startup path must execute its runner-owned installer exactly once`);
  const installerSite = installerSites[0];
  assertDirectFactoryInitializer(
    invocationSource,
    installerSite,
    'networkBoundaryObservability',
    `${runnerName} must install the observer with a directly executed const initializer`,
  );
  assert.equal(
    braceDepthAt(invocationSource, installerSite.index),
    expectedBraceDepth,
    `${runnerName} observer installation must execute on its real startup path`,
  );
  assert.match(
    declaration.source,
    servicePattern,
    `${runnerName} evidence service must be the actor identity ${service}, not a transport name`,
  );
  assert.match(
    declaration.source,
    effectiveDestinationsPattern,
    `${runnerName} startup and periodic effective_config heartbeats must use its effective destinations`,
  );
  assert.match(
    declaration.source,
    /\bwriteLine\b[\s\S]*\bnow\b[\s\S]*\bsetIntervalFn\b[\s\S]*\bclearIntervalFn\b[\s\S]*\bheartbeatIntervalMs\b/u,
    `${runnerName} installer must pass injected writer, clock, timer, cleanup, and heartbeat interval`,
  );
  assert.match(
    installerSite.body,
    /\bwriteLine\s*:[\s\S]*?\bprocess\.stdout\.write\s*\(/u,
    `${runnerName} startup path must write canonical evidence to stdout`,
  );
  assert.match(
    installerSite.body,
    /\bheartbeatIntervalMs\s*:\s*10000\b/u,
    `${runnerName} observer must install the ten-second effective_config heartbeat`,
  );
  assert.match(
    installerSite.body,
    invocationPattern,
    `${runnerName} startup path must pass its effective destinations to the runner-owned installer`,
  );
  assert.doesNotMatch(
    installerSite.body,
    /\b(?:MQTT_USER|MQTT_PASS|username|password|accessToken|token|secret)\b/iu,
    `${runnerName} observer must never receive credentials or other secret fields`,
  );
  return installerSite;
}

function assertRemoteWorkerNetworkBoundaryRunnerContract(runnerSource) {
  const executableSource = stripJavaScriptComments(runnerSource);
  assert.match(
    executableSource,
    /const\s+MQTT_HOST\s*=\s*process\.env\.DY_MQTT_HOST\s*\|\|\s*process\.env\.MQTT_HOST\s*\|\|/u,
    'effective MQTT host must preserve DY_MQTT_HOST before MQTT_HOST priority',
  );
  assert.match(
    executableSource,
    /const\s+MQTT_PORT\s*=\s*parseInt\(\s*process\.env\.DY_MQTT_PORT\s*\|\|\s*process\.env\.MQTT_PORT\s*\|\|/u,
    'effective MQTT port must preserve DY_MQTT_PORT before MQTT_PORT priority',
  );
  assert.match(
    executableSource,
    /const\s+mqttDestination\s*=\s*`mqtt:\/\/\$\{MQTT_HOST\}:\$\{MQTT_PORT\}`\s*;/u,
    'remote-worker must derive one sanitized MQTT destination from the effective host and port',
  );
  const factorySite = assertNetworkBoundaryFactoryInstallation(executableSource, {
    runnerName: 'remote-worker',
    installerName: 'createRemoteWorkerNetworkBoundaryObservability',
    service: 'remote-worker',
    servicePattern: /\bservice\s*:\s*workerScope\b/u,
    expectedBraceDepth: 0,
    effectiveDestinationsPattern: /\beffectiveDestinations\s*:\s*\[\s*mqttDestination\s*\]/u,
    invocationPattern: /\bworkerScope\s*:\s*WORKER_SCOPE\b[\s\S]*\bmqttDestination\b/u,
  });
  const installerDeclaration = extractExportedFunction(
    executableSource,
    'createRemoteWorkerNetworkBoundaryObservability',
  );
  assert.match(
    installerDeclaration.source,
    /workerScope\s*!==\s*['"]remote-worker['"]\s*&&\s*workerScope\s*!==\s*['"]workspace-manager['"]/u,
    'remote-worker installer must fail closed unless workerScope is an allowed actor identity',
  );

  const startSites = findIdentifierCallSites(executableSource, 'rt.startMqttLoop');
  assert.equal(startSites.length, 1, 'remote-worker must have exactly one real startMqttLoop call');
  const startSite = startSites[0];
  assert.match(startSite.body, /\bhost\s*:\s*MQTT_HOST\b/u, 'startMqttLoop must use the effective MQTT host');
  assert.match(startSite.body, /\bport\s*:\s*MQTT_PORT\b/u, 'startMqttLoop must use the effective MQTT port');

  const outboundSites = findIdentifierCallSites(executableSource, 'networkBoundaryObservability.recordOutbound');
  assert.equal(outboundSites.length, 2, 'remote-worker must record its MQTT connection and response publish attempts');
  const [connectOutboundSite, publishOutboundSite] = outboundSites;
  for (const outboundSite of outboundSites) {
    assert.equal(outboundSite.body.trim(), 'mqttDestination', 'remote-worker outbound evidence must use the effective MQTT destination');
    assertStandaloneExpressionCall(
      executableSource,
      outboundSite,
      'networkBoundaryObservability.recordOutbound',
      'mqttDestination',
      'remote-worker outbound evidence must be an independent executable statement',
    );
    assert.ok(factorySite.closeIndex < outboundSite.index, 'remote-worker must install startup and periodic heartbeats before outbound work');
  }
  assert.equal(braceDepthAt(executableSource, connectOutboundSite.index), 0, 'remote-worker connection evidence must execute on the top-level runner path');
  assertImmediatelyPrecedesCall(
    executableSource,
    connectOutboundSite,
    startSite,
    'remote-worker must record outbound_attempt directly before the real startMqttLoop call',
  );
  assert.match(
    executableSource,
    /const\s+runtimeMqttPublish\s*=\s*rt\.mqttClient\.publish\.bind\(\s*rt\.mqttClient\s*\)\s*;/u,
    'remote-worker response path must retain the runtime-owned MQTT publisher',
  );
  const responsePublishWrapper = extractUniqueArrowFunction(
    executableSource,
    /\brt\.mqttClient\.publish\s*=\s*\(\s*topic\s*,\s*packet\s*\)\s*=>\s*\{/u,
    'remote-worker must install exactly one live rt.mqttClient.publish wrapper',
  );
  assert.equal(
    braceDepthAt(executableSource, responsePublishWrapper.start),
    0,
    'remote-worker live MQTT publish wrapper must be assigned on the top-level runner path',
  );
  const wrapperOutboundSites = findIdentifierCallSites(
    responsePublishWrapper.body,
    'networkBoundaryObservability.recordOutbound',
  );
  assert.equal(wrapperOutboundSites.length, 1, 'remote-worker live response wrapper must record exactly one publish attempt');
  const wrapperOutboundSite = wrapperOutboundSites[0];
  assert.equal(wrapperOutboundSite.body.trim(), 'mqttDestination');
  assertStandaloneExpressionCall(
    responsePublishWrapper.body,
    wrapperOutboundSite,
    'networkBoundaryObservability.recordOutbound',
    'mqttDestination',
    'remote-worker response evidence must be an independent executable statement in the live publish wrapper',
  );
  assert.equal(
    braceDepthAt(responsePublishWrapper.body, wrapperOutboundSite.index),
    0,
    'remote-worker response evidence must execute directly in the live publish wrapper',
  );
  assert.equal(
    responsePublishWrapper.bodyStart + wrapperOutboundSite.index,
    publishOutboundSite.index,
    'remote-worker second outbound evidence call must be the one in the live publish wrapper',
  );
  const allResponsePublishSites = findIdentifierCallSites(executableSource, 'r1PinFlowWiring.publishControlResponse');
  assert.equal(allResponsePublishSites.length, 1, 'remote-worker must have exactly one response publish path');
  const responsePublishSites = findIdentifierCallSites(
    responsePublishWrapper.body,
    'r1PinFlowWiring.publishControlResponse',
  );
  assert.equal(responsePublishSites.length, 1, 'remote-worker live MQTT wrapper must own the response publish path');
  const responsePublishSite = responsePublishSites[0];
  assert.match(
    responsePublishSite.body,
    /^\s*runtimeMqttPublish\s*,\s*topic\s*,\s*packet\s*$/u,
    'remote-worker response path must forward through the retained runtime MQTT publisher',
  );
  assert.equal(
    braceDepthAt(responsePublishWrapper.body, responsePublishSite.index),
    0,
    'remote-worker response publish must execute directly in the live MQTT wrapper',
  );
  assertImmediatelyPrecedesCall(
    responsePublishWrapper.body,
    wrapperOutboundSite,
    responsePublishSite,
    'remote-worker must record outbound_attempt directly before the real response publish path',
  );
  assertReturnedCall(
    responsePublishWrapper.body,
    responsePublishSite,
    'remote-worker live MQTT wrapper must return the acknowledged response publish result',
  );
}

function assertMbrWorkerNetworkBoundaryRunnerContract(runnerSource) {
  const executableSource = stripJavaScriptComments(runnerSource);
  assert.match(
    executableSource,
    /import\s*\{[^}]*\bpublishMqttWithAck\b[^}]*\}\s*from\s*['"]\.\.\/packages\/worker-base\/src\/mqtt_publish_ack\.mjs['"]/su,
    'mbr-worker must import the shared MQTT publish acknowledgement helper',
  );
  const mainDeclaration = extractNamedFunction(executableSource, 'main', { exported: true });
  assert.match(
    mainDeclaration.parameters,
    /^\s*options\s*=\s*\{\s*\}\s*$/u,
    'mbr-worker must export callable main(options = {}) for an isolated startup behavior test',
  );
  assertStandardMainEntrypoint(executableSource, mainDeclaration);
  const mainBody = mainDeclaration.body;
  const factorySite = assertNetworkBoundaryFactoryInstallation(executableSource, {
    runnerName: 'mbr-worker',
    installerName: 'createMbrWorkerNetworkBoundaryObservability',
    invocationIdentifier: 'installNetworkBoundaryObservability',
    service: 'mbr-worker',
    expectedBraceDepth: 0,
    effectiveDestinationsPattern: /\beffectiveDestinations\s*:\s*\[\s*mqttUrl\s*,\s*matrixHomeserverUrl\s*\]/u,
    invocationPattern: /\bservice\s*:\s*['"]mbr-worker['"][\s\S]*\bmqttUrl\b[\s\S]*\bmatrixHomeserverUrl\s*:\s*matrixConfig\.homeserverUrl\b/u,
    invocationSource: mainBody,
    defaultInstallerBindingPattern: /\bconst\s+installNetworkBoundaryObservability\s*=\s*options\.installNetworkBoundaryObservability\s*\|\|\s*createMbrWorkerNetworkBoundaryObservability\s*;/u,
  });

  const mqttPublishWrapper = extractUniqueArrowFunction(
    mainBody,
    /\bconst\s+mqttPublish\s*=\s*\(\s*topic\s*,\s*payload\s*\)\s*=>\s*\{/u,
    'mbr-worker real main startup path must define exactly one live mqttPublish wrapper',
  );
  assert.equal(
    braceDepthAt(mainBody, mqttPublishWrapper.start),
    0,
    'mbr-worker mqttPublish wrapper must execute on the real main startup path',
  );
  const mqttConnectSites = findIdentifierCallSites(mainBody, 'mqtt.connect');
  const mqttPublishSites = findIdentifierCallSites(mainBody, 'publishMqttWithAck');
  const wrapperPublishSites = findIdentifierCallSites(mqttPublishWrapper.body, 'publishMqttWithAck');
  const directMqttPublishSites = findIdentifierCallSites(mainBody, 'mqttClient.publish');
  const matrixConnectSites = findIdentifierCallSites(mainBody, 'createMatrixLiveAdapter');
  assert.equal(mqttConnectSites.length, 1, 'mbr-worker must have exactly one real MQTT connection call');
  assert.equal(mqttPublishSites.length, 1, 'mbr-worker must have exactly one acknowledged MQTT publish call');
  assert.equal(wrapperPublishSites.length, 1, 'mbr-worker live mqttPublish wrapper must own the acknowledged publish call');
  assert.equal(directMqttPublishSites.length, 0, 'mbr-worker must not bypass the shared acknowledgement helper');
  assert.equal(matrixConnectSites.length, 1, 'mbr-worker must have exactly one real Matrix adapter connection call');
  assert.equal(mqttConnectSites[0].body.split(',')[0].trim(), 'mqttUrl', 'mbr-worker MQTT connection must use mqttUrl');
  assert.match(
    matrixConnectSites[0].body,
    /\bhomeserverUrl\s*:\s*matrixConfig\.homeserverUrl\s*\|\|\s*undefined/u,
    'mbr-worker Matrix connection must use the effective Matrix homeserver URL',
  );
  assert.match(
    wrapperPublishSites[0].body,
    /^\s*mqttClient\s*,\s*topic\s*,\s*payload\s*$/u,
    'mbr-worker acknowledged publish must pass the owned client, topic, and payload directly',
  );
  assertDirectFactoryInitializer(
    mqttPublishWrapper.body,
    wrapperPublishSites[0],
    'publishResult',
    'mbr-worker must retain the acknowledged publish result for downstream evidence',
  );
  assert.equal(
    mqttPublishWrapper.bodyStart + wrapperPublishSites[0].index,
    mqttPublishSites[0].index,
    'mbr-worker only acknowledged publish call must belong to the live mqttPublish wrapper',
  );
  const wrapperForwardSites = findIdentifierCallSites(
    mqttPublishWrapper.body,
    'mbrPinFlowWiring.recordControlForward',
  );
  assert.equal(wrapperForwardSites.length, 1, 'mbr-worker live mqttPublish wrapper must record exactly one control forward');
  const wrapperForwardSite = wrapperForwardSites[0];
  assert.match(
    wrapperForwardSite.body,
    /^\s*payload\s*,\s*publishResult\s*$/u,
    'mbr-worker control-forward evidence must consume the exact acknowledged publish result',
  );
  assertImmediatelyPrecedesCall(
    mqttPublishWrapper.body,
    wrapperPublishSites[0],
    wrapperForwardSite,
    'mbr-worker must pass the acknowledged publish result directly to control-forward evidence',
  );
  assertReturnedCall(
    mqttPublishWrapper.body,
    wrapperForwardSite,
    'mbr-worker live mqttPublish wrapper must return recordControlForward with the acknowledged publish result',
  );
  const engineSites = findIdentifierCallSites(mainBody, 'WorkerEngineV0');
  assert.equal(engineSites.length, 1, 'mbr-worker real main path must instantiate exactly one WorkerEngineV0');
  assert.match(
    engineSites[0].body,
    /^\s*\{\s*runtime\s*:\s*rt\s*,\s*mgmtAdapter\s*:\s*null\s*,\s*mqttPublish\s*\}\s*$/u,
    'mbr-worker must pass mqttPublish directly to WorkerEngineV0',
  );
  assert.equal(braceDepthAt(mainBody, engineSites[0].index), 0, 'mbr-worker engine must be created on the real main startup path');
  assert.ok(mqttPublishWrapper.end < engineSites[0].index, 'mbr-worker must define its live mqttPublish wrapper before engine creation');

  assert.ok(factorySite.closeIndex < mqttConnectSites[0].index, 'mbr-worker observer must install before the real MQTT connection');
  assert.ok(factorySite.closeIndex < matrixConnectSites[0].index, 'mbr-worker observer must install before the real Matrix connection');

  const outboundSites = findIdentifierCallSites(mainBody, 'networkBoundaryObservability.recordOutbound');
  assert.equal(outboundSites.length, 3, 'mbr-worker must record its MQTT connect, MQTT publish, and Matrix connect attempts');
  const mqttOutboundSites = outboundSites.filter((site) => site.body.trim() === 'mqttUrl');
  const matrixOutboundSites = outboundSites.filter((site) => site.body.trim() === 'matrixConfig.homeserverUrl');
  assert.equal(mqttOutboundSites.length, 2, 'mbr-worker must record both MQTT connect and publish with the MQTT destination');
  assert.equal(matrixOutboundSites.length, 1, 'mbr-worker must record the Matrix adapter connection with the Matrix destination');

  for (const [outboundSite, realCallSite, operation] of [
    [mqttOutboundSites[0], mqttConnectSites[0], 'MQTT connect'],
    [mqttOutboundSites[1], mqttPublishSites[0], 'MQTT publish'],
    [matrixOutboundSites[0], matrixConnectSites[0], 'Matrix connect'],
  ]) {
    assertStandaloneExpressionCall(
      mainBody,
      outboundSite,
      'networkBoundaryObservability.recordOutbound',
      outboundSite.body.trim(),
      `mbr-worker ${operation} evidence must be an independent executable statement`,
    );
    assert.equal(
      braceDepthAt(mainBody, outboundSite.index),
      braceDepthAt(mainBody, realCallSite.index),
      `mbr-worker ${operation} evidence must execute in the same live block as the real outbound call`,
    );
    assertImmediatelyPrecedesCall(
      mainBody,
      outboundSite,
      realCallSite,
      `mbr-worker must record outbound_attempt directly before the real ${operation} call`,
    );
  }
  assert.ok(factorySite.closeIndex < mqttOutboundSites[0].index, 'mbr-worker must install startup and periodic heartbeats before outbound work');
}

async function loadNetworkBoundaryModule() {
  try {
    return await import('../lib/de_network_boundary_evidence.mjs');
  } catch (error) {
    assert.fail(`missing shared DE network-boundary evidence helper: ${error && error.message ? error.message : error}`);
  }
}

function assertAllowed(evaluate, evidence, since, message) {
  const result = evaluate(evidence, { since });
  assert.equal(result && result.ok, true, message);
  assert.equal(typeof result.code, 'string', `${message}: evaluator must return a machine-readable code`);
}

function assertRejected(evaluate, evidence, since, message) {
  const result = evaluate(evidence, { since });
  assert.equal(result && result.ok, false, message);
  assert.equal(typeof result.code, 'string', `${message}: fail-closed evaluator must return a machine-readable code`);
}

async function test_network_boundary_helper_is_fresh_strict_and_non_secret() {
  const {
    DE_NETWORK_BOUNDARY_MARKER,
    buildDeNetworkBoundaryEvidence,
    createDeNetworkBoundaryObservability,
    formatDeNetworkBoundaryEvidenceLine,
    parseDeNetworkBoundaryEvidenceLines,
    evaluateDeNetworkBoundaryEvidence,
  } = await loadNetworkBoundaryModule();

  assert.equal(DE_NETWORK_BOUNDARY_MARKER, 'DE_NETWORK_BOUNDARY');
  assert.equal(typeof buildDeNetworkBoundaryEvidence, 'function');
  assert.equal(typeof createDeNetworkBoundaryObservability, 'function');
  assert.equal(typeof formatDeNetworkBoundaryEvidenceLine, 'function');
  assert.equal(typeof parseDeNetworkBoundaryEvidenceLines, 'function');
  assert.equal(typeof evaluateDeNetworkBoundaryEvidence, 'function');

  function executeObserver({ service, destinations, expectedProtocols, clockStart }) {
    const lines = [];
    const nowValues = [];
    let nextTimestamp = clockStart;
    let installedCallback = null;
    let installedDelay = null;
    let clearCount = 0;
    const timerHandle = {
      unrefCount: 0,
      unref() { this.unrefCount += 1; },
    };
    const observability = createDeNetworkBoundaryObservability({
      service,
      effectiveDestinations: destinations,
      writeLine: (line) => lines.push(line),
      now: () => {
        nowValues.push(nextTimestamp);
        nextTimestamp += 1;
        return nowValues.at(-1);
      },
      setIntervalFn: (callback, delay) => {
        installedCallback = callback;
        installedDelay = delay;
        return timerHandle;
      },
      clearIntervalFn: (handle) => {
        assert.equal(handle, timerHandle, `${service}: stop must clear the installed heartbeat handle`);
        clearCount += 1;
      },
      heartbeatIntervalMs: networkHeartbeatIntervalMs,
    });

    assert.equal(typeof observability.recordOutbound, 'function', `${service}: observer must expose recordOutbound`);
    assert.equal(typeof observability.stop, 'function', `${service}: observer must expose stop`);
    assert.equal(installedDelay, networkHeartbeatIntervalMs, `${service}: heartbeat interval must be injected exactly`);
    assert.equal(typeof installedCallback, 'function', `${service}: constructor must install the periodic heartbeat`);
    assert.equal(
      lines.length,
      destinations.length,
      `${service}: constructor must immediately emit one startup effective_config per destination`,
    );

    installedCallback();
    assert.equal(
      lines.length,
      destinations.length * 2,
      `${service}: interval callback must emit a fresh effective_config heartbeat per destination`,
    );
    for (const destination of destinations) observability.recordOutbound(destination);

    const parsed = parseDeNetworkBoundaryEvidenceLines(lines.join('\n'), { since: clockStart });
    assert.equal(parsed.length, destinations.length * 3, `${service}: all executed startup, interval, and outbound records must be canonical`);
    assert.deepEqual(
      parsed.map((entry) => entry.kind),
      [
        ...destinations.map(() => 'effective_config'),
        ...destinations.map(() => 'effective_config'),
        ...destinations.map(() => 'outbound_attempt'),
      ],
      `${service}: startup and interval are heartbeats while only real outbound calls create attempts`,
    );
    assert.deepEqual(parsed.map((entry) => entry.service), parsed.map(() => service), `${service}: every record must retain actor identity`);
    assert.deepEqual(
      parsed.map((entry) => entry.protocol),
      [...expectedProtocols, ...expectedProtocols, ...expectedProtocols],
      `${service}: protocol must describe transport independently of actor identity`,
    );
    assert.deepEqual(
      parsed.map((entry) => entry.ts),
      nowValues,
      `${service}: each emitted record must obtain its own fresh timestamp from now()`,
    );
    assert.equal(nowValues.length, parsed.length, `${service}: now() must run once for every emitted record`);

    observability.stop();
    observability.stop();
    assert.equal(clearCount, 1, `${service}: stop must be idempotent`);
    assert.ok(timerHandle.unrefCount <= 1, `${service}: heartbeat timer may be unrefed at most once`);
    return { lines, parsed };
  }

  const remoteObserver = executeObserver({
    service: 'remote-worker',
    destinations: ['mqtt://user:password@mosquitto.dongyu.svc.cluster.local:1883?token=secret'],
    expectedProtocols: ['mqtt:'],
    clockStart: startedAt + 100,
  });
  const mbrObserver = executeObserver({
    service: 'mbr-worker',
    destinations: [localMqttDestination, localMatrixDestination],
    expectedProtocols: ['mqtt:', 'http:'],
    clockStart: startedAt + 200,
  });
  assert.equal(
    [...remoteObserver.lines, ...mbrObserver.lines].some((line) => /(?:password|token|secret|userinfo)/iu.test(line)),
    false,
    'runtime observability must emit only the canonical non-secret allowlist',
  );

  const secretSentinel = '0184-secret-must-never-appear';
  const tokenSentinel = '0184-token-must-never-appear';
  const mqttEvidence = buildDeNetworkBoundaryEvidence({
    kind: 'effective_config',
    service: 'remote-worker',
    destination: localMqttDestination,
    ts: startedAt + 1,
    username: secretSentinel,
    password: secretSentinel,
    token: tokenSentinel,
    secret: secretSentinel,
  });
  assert.deepEqual(mqttEvidence, {
    schema: networkBoundarySchema,
    kind: 'effective_config',
    service: 'remote-worker',
    ts: startedAt + 1,
    protocol: 'mqtt:',
    hostname: 'mosquitto.dongyu.svc.cluster.local',
    port: 1883,
  });

  const matrixEvidence = buildDeNetworkBoundaryEvidence({
    kind: 'effective_config',
    service: 'mbr-worker',
    destination: localMatrixDestination,
    ts: startedAt + 2,
  });
  const feishuEvidence = buildDeNetworkBoundaryEvidence({
    kind: 'outbound_attempt',
    service: 'remote-worker',
    destination: allowedFeishuDestination,
    ts: startedAt + 3,
  });
  assert.deepEqual(matrixEvidence, {
    schema: networkBoundarySchema,
    kind: 'effective_config',
    service: 'mbr-worker',
    ts: startedAt + 2,
    protocol: 'http:',
    hostname: 'synapse.dongyu.svc.cluster.local',
    port: 8008,
  });
  assert.deepEqual(feishuEvidence, {
    schema: networkBoundarySchema,
    kind: 'outbound_attempt',
    service: 'remote-worker',
    ts: startedAt + 3,
    protocol: 'https:',
    hostname: 'open.feishu.cn',
    port: 443,
  });

  const formattedMqtt = formatDeNetworkBoundaryEvidenceLine({
    ...mqttEvidence,
    destination: `mqtt://${secretSentinel}:${secretSentinel}@mosquitto.dongyu.svc.cluster.local:1883?token=${tokenSentinel}`,
    username: secretSentinel,
    password: secretSentinel,
    token: tokenSentinel,
    secret: secretSentinel,
  });
  assert.equal(formattedMqtt.endsWith('\n'), false, 'formatter must return one complete line without transport newline bytes');
  assert.match(formattedMqtt, /^DE_NETWORK_BOUNDARY\s+\{/u, 'formatter must use the standard marker');
  assert.deepEqual(
    JSON.parse(formattedMqtt.slice(`${DE_NETWORK_BOUNDARY_MARKER} `.length)),
    mqttEvidence,
    'formatter must emit only the canonical protocol/hostname/port evidence allowlist',
  );
  for (const forbidden of [secretSentinel, tokenSentinel, 'username', 'password', 'token', 'secret', 'destination']) {
    assert.equal(formattedMqtt.includes(forbidden), false, `formatted evidence must omit ${forbidden}`);
  }

  const staleEvidence = buildDeNetworkBoundaryEvidence({
    kind: 'effective_config',
    service: 'remote-worker',
    destination: localMqttDestination,
    ts: startedAt - 1,
  });
  const parsed = parseDeNetworkBoundaryEvidenceLines([
    'unrelated runner output',
    formatDeNetworkBoundaryEvidenceLine(staleEvidence),
    formattedMqtt,
    formatDeNetworkBoundaryEvidenceLine(feishuEvidence),
    `NOT_${formatDeNetworkBoundaryEvidenceLine(matrixEvidence)}`,
  ].join('\n'), { since: startedAt });
  assert.deepEqual(parsed, [mqttEvidence, feishuEvidence], 'parser must ignore non-marker output and stale evidence while preserving exact fresh records');
  assert.throws(
    () => parseDeNetworkBoundaryEvidenceLines([
      formattedMqtt,
      'DE_NETWORK_BOUNDARY {malformed-json',
      formatDeNetworkBoundaryEvidenceLine(feishuEvidence),
    ].join('\n'), { since: startedAt }),
    /invalid_network_boundary_evidence/u,
    'one malformed marker line must fail closed even beside valid fresh evidence',
  );
  assert.throws(
    () => parseDeNetworkBoundaryEvidenceLines([
      formattedMqtt,
      `${DE_NETWORK_BOUNDARY_MARKER} ${JSON.stringify({
        ...staleEvidence,
        kind: 'outbound_attempt',
        unexpected: true,
      })}`,
      formatDeNetworkBoundaryEvidenceLine(feishuEvidence),
    ].join('\n'), { since: startedAt }),
    /invalid_network_boundary_evidence/u,
    'structural validation must reject stale malformed markers before freshness filtering',
  );

  assertAllowed(evaluateDeNetworkBoundaryEvidence, mqttEvidence, startedAt, 'exact local MQTT service DNS and port must pass');
  assertAllowed(evaluateDeNetworkBoundaryEvidence, matrixEvidence, startedAt, 'exact local Matrix service DNS and port must pass');
  assertAllowed(evaluateDeNetworkBoundaryEvidence, feishuEvidence, startedAt, 'exact HTTPS open.feishu.cn destination must pass');
  assertRejected(evaluateDeNetworkBoundaryEvidence, staleEvidence, startedAt, 'stale evidence must fail closed');

  for (const [name, service, destination] of [
    ['remote_mqtt', 'remote-worker', 'mqtt://mqtt.dongyudigital.com:1883'],
    ['mqtt_hostname_lookalike', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local.evil.test:1883'],
    ['mqtt_wrong_port', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:2883'],
    ['remote_matrix', 'mbr-worker', 'https://matrix.dongyudigital.com'],
    ['matrix_hostname_lookalike', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local.evil.test:8008'],
    ['matrix_wrong_port', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local:9008'],
    ['remote_oidc', 'remote-worker', 'https://id.dongyudigital.com'],
    ['oidc_hostname_lookalike', 'remote-worker', 'https://id.dongyudigital.com.evil.test'],
    ['non_https_feishu', 'remote-worker', 'http://open.feishu.cn/open-apis'],
    ['feishu_hostname_lookalike', 'remote-worker', 'https://open.feishu.cn.evil.test/open-apis'],
    ['feishu_userinfo_lookalike', 'remote-worker', 'https://open.feishu.cn@evil.test/open-apis'],
    ['feishu_wrong_port', 'remote-worker', 'https://open.feishu.cn:444/open-apis'],
    ['transport_alias_mqtt', 'mqtt', localMqttDestination],
    ['transport_alias_matrix', 'matrix', localMatrixDestination],
    ['transport_alias_feishu', 'feishu', allowedFeishuDestination],
    ['unknown_service', 'unknown', 'https://open.feishu.cn/open-apis'],
  ]) {
    const evidence = buildDeNetworkBoundaryEvidence({
      kind: 'outbound_attempt',
      service,
      destination,
      ts: startedAt + 10,
    });
    assertRejected(evaluateDeNetworkBoundaryEvidence, evidence, startedAt, `${name} must fail closed`);
  }

  assertRejected(evaluateDeNetworkBoundaryEvidence, null, startedAt, 'missing evidence must fail closed');
  assert.throws(
    () => buildDeNetworkBoundaryEvidence({
      kind: 'effective_config',
      service: 'remote-worker',
      destination: localMqttDestination,
      ts: Number.NaN,
    }),
    /\b(?:ts|timestamp)\b/iu,
    'builder must reject non-finite timestamps',
  );
  assert.throws(
    () => createDeNetworkBoundaryObservability({
      service: 'mqtt',
      effectiveDestinations: [localMqttDestination],
      writeLine: () => {},
      now: () => startedAt,
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
      heartbeatIntervalMs: networkHeartbeatIntervalMs,
    }),
    /\b(?:service|actor)\b/iu,
    'runtime observer must reject transport mqtt as a substitute for actor identity',
  );
}

async function test_runner_executes_shared_diagnostic_and_network_evidence_paths() {
  const validDiagnosticFixture = `
    import { createRoleScopedDeRuntimeDiagnosticHeartbeat } from './lib/de_runtime_diagnostics.mjs';
    const WORKER_SCOPE = 'remote-worker';
    const runtimeDiagnostics = createRoleScopedDeRuntimeDiagnosticHeartbeat({ workerScope: WORKER_SCOPE, runtime: rt, writeLine: (line) => process.stdout.write(\`${'${line}'}\\n\`), heartbeatIntervalMs: 10000 });
    const mqttResult = rt.startMqttLoop({});
    runtimeDiagnostics.start();
    process.once('SIGINT', () => { runtimeDiagnostics.stop(); });
  `;
  const commentedDiagnosticFixture = `
    import { createRoleScopedDeRuntimeDiagnosticHeartbeat } from './lib/de_runtime_diagnostics.mjs';
    const WORKER_SCOPE = 'remote-worker';
    const runtimeDiagnostics = createRoleScopedDeRuntimeDiagnosticHeartbeat({ workerScope: WORKER_SCOPE, runtime: rt, writeLine: (line) => process.stdout.write(\`${'${line}'}\\n\`), heartbeatIntervalMs: 10000 });
    const mqttResult = rt.startMqttLoop({});
    // runtimeDiagnostics.start();
    /* process.once('SIGINT', () => { runtimeDiagnostics.stop(); }); */
  `;
  const unusedDiagnosticFixture = `
    import { createRoleScopedDeRuntimeDiagnosticHeartbeat } from './lib/de_runtime_diagnostics.mjs';
    const WORKER_SCOPE = 'remote-worker';
    const runtimeDiagnostics = createRoleScopedDeRuntimeDiagnosticHeartbeat({ workerScope: WORKER_SCOPE, runtime: rt, writeLine: (line) => process.stdout.write(\`${'${line}'}\\n\`), heartbeatIntervalMs: 10000 });
    const mqttResult = rt.startMqttLoop({});
  `;
  const shortCircuitedDiagnosticFixture = `
    import { createRoleScopedDeRuntimeDiagnosticHeartbeat } from './lib/de_runtime_diagnostics.mjs';
    const WORKER_SCOPE = 'remote-worker';
    const runtimeDiagnostics = createRoleScopedDeRuntimeDiagnosticHeartbeat({ workerScope: WORKER_SCOPE, runtime: rt, writeLine: (line) => process.stdout.write(\`${'${line}'}\\n\`), heartbeatIntervalMs: 10000 });
    const mqttResult = rt.startMqttLoop({});
    false && runtimeDiagnostics.start();
    process.once('SIGINT', () => { runtimeDiagnostics.stop(); });
  `;
  assert.doesNotThrow(
    () => assertDiagnosticInvocationContract(validDiagnosticFixture),
    'contract checker must accept real after_start and interval invocations',
  );
  assert.throws(
    () => assertDiagnosticInvocationContract(commentedDiagnosticFixture),
    /start the role-scoped|exactly once/u,
    'commented-out invocations must not satisfy the runner contract',
  );
  assert.throws(
    () => assertDiagnosticInvocationContract(unusedDiagnosticFixture),
    /start the role-scoped|exactly once/u,
    'an imported and created but unused emitter must not satisfy the runner contract',
  );
  assert.throws(
    () => assertDiagnosticInvocationContract(shortCircuitedDiagnosticFixture),
    /independent executable statement/u,
    'short-circuited diagnostic calls must not satisfy the producer contract',
  );

  assert.match(source, /MQTT connected:/u, 'runner must retain connected-state diagnostics');
  assert.match(source, /MQTT subscriptions:/u, 'runner must retain effective MQTT subscription diagnostics');
  assertDiagnosticInvocationContract(source);
  const { createRoleScopedDeRuntimeDiagnosticHeartbeat } = await import('../lib/de_runtime_diagnostics.mjs');
  let wmFactoryCalls = 0;
  let wmTimerCalls = 0;
  const wmDiagnostics = createRoleScopedDeRuntimeDiagnosticHeartbeat({
    workerScope: 'workspace-manager',
    runtime: null,
    writeLine: () => {},
    diagnosticFactory: () => {
      wmFactoryCalls += 1;
      throw new Error('workspace_manager_diagnostic_factory_forbidden');
    },
    setIntervalFn: () => {
      wmTimerCalls += 1;
      throw new Error('workspace_manager_diagnostic_timer_forbidden');
    },
    clearIntervalFn: () => {},
    heartbeatIntervalMs: 10000,
  });
  assert.equal(wmDiagnostics.enabled, false);
  assert.deepEqual(wmDiagnostics.start(), []);
  assert.equal(wmFactoryCalls, 0, 'workspace-manager scope must not create the Model3200 diagnostic emitter');
  assert.equal(wmTimerCalls, 0, 'workspace-manager scope must not register the Model3200 diagnostic timer');
  assertContractMutationsRejected(assertRemoteWorkerNetworkBoundaryRunnerContract, [
    {
      name: 'r1_publish_wrapper_not_assigned',
      source: replaceContractFixtureToken(
        source,
        'rt.mqttClient.publish = (topic, packet) => {',
        'const disconnectedResponsePublisher = (topic, packet) => {',
        'r1_publish_wrapper_not_assigned',
      ),
      expectedPattern: /live rt\.mqttClient\.publish wrapper/u,
    },
    {
      name: 'r1_publish_wrapper_drops_ack_return',
      source: replaceContractFixtureToken(
        source,
        'return r1PinFlowWiring.publishControlResponse(runtimeMqttPublish, topic, packet);',
        'r1PinFlowWiring.publishControlResponse(runtimeMqttPublish, topic, packet);',
        'r1_publish_wrapper_drops_ack_return',
      ),
      expectedPattern: /return the acknowledged response publish result/u,
    },
  ], 'remote-worker response publish mutation fixtures');
  assertRemoteWorkerNetworkBoundaryRunnerContract(source);
  const {
    createDeNetworkBoundaryObservability,
    parseDeNetworkBoundaryEvidenceLines,
  } = await loadNetworkBoundaryModule();
  const { install } = instantiateRunnerOwnedInstaller(
    source,
    'createRemoteWorkerNetworkBoundaryObservability',
    createDeNetworkBoundaryObservability,
  );
  exerciseRunnerOwnedInstaller({
    install,
    installArgs: { mqttDestination: localMqttDestination },
    destinations: [localMqttDestination],
    expectedProtocols: ['mqtt:'],
    expectedService: 'remote-worker',
    parseLines: parseDeNetworkBoundaryEvidenceLines,
  });
  exerciseRunnerOwnedInstaller({
    install,
    installArgs: {
      workerScope: 'workspace-manager',
      mqttDestination: localMqttDestination,
    },
    destinations: [localMqttDestination],
    expectedProtocols: ['mqtt:'],
    expectedService: 'workspace-manager',
    parseLines: parseDeNetworkBoundaryEvidenceLines,
  });
  assert.throws(
    () => install({
      workerScope: 'mqtt',
      mqttDestination: localMqttDestination,
    }),
    /workerScope must be remote-worker or workspace-manager/u,
    'remote-worker installer must reject a transport name in place of an actor identity',
  );

  const executableSource = stripJavaScriptComments(source);
  assert.doesNotMatch(executableSource, /\bmqttTraceCursor\b/u, 'runner must not own the runtime trace cursor');
  assert.doesNotMatch(executableSource, /\bmqttTrace\.list\s*\(/u, 'runner must not read the runtime trace list directly');
  assert.doesNotMatch(executableSource, /\btrace\.slice\s*\(/u, 'runner must not slice a local runtime trace list');
  assert.doesNotMatch(executableSource, /\b(?:const|let|var)\s+delta\b/u, 'runner must not calculate a local runtime trace delta');
  assert.doesNotMatch(executableSource, /MQTT trace delta:/u, 'runner must not print raw MQTT trace payloads');
  assert.doesNotMatch(
    executableSource,
    /\b(?:emitDeRuntimeDiagnosticLogLines|formatDeRuntimeDiagnosticLogLines)\b/u,
    'runner must use only the shared cursor-owning diagnostic factory',
  );
  assert.doesNotMatch(executableSource, /JSON\.stringify\(\s*(?:delta|trace)\b/u, 'runner must not serialize raw trace data');
  assert.doesNotMatch(
    executableSource,
    /\bDE_RUNTIME_(?:DIAGNOSTIC|TRACE)_MARKER\b/u,
    'runner must not import or hand-build diagnostic evidence markers',
  );
}

function mbrRunnerContractFixture({ placement = 'main', directEntrypoint = true } = {}) {
  const startupBody = `
    const installNetworkBoundaryObservability = options.installNetworkBoundaryObservability
      || createMbrWorkerNetworkBoundaryObservability;
    const mqttUrl = 'mqtt://mosquitto.dongyu.svc.cluster.local:1883';
    const matrixConfig = { homeserverUrl: 'http://synapse.dongyu.svc.cluster.local:8008' };
    const networkBoundaryObservability = installNetworkBoundaryObservability({
      service: 'mbr-worker',
      mqttUrl,
      matrixHomeserverUrl: matrixConfig.homeserverUrl,
      writeLine: options.writeLine || ((line) => process.stdout.write(line)),
      now: options.now || Date.now,
      setIntervalFn: options.setIntervalFn || setInterval,
      clearIntervalFn: options.clearIntervalFn || clearInterval,
      heartbeatIntervalMs: 10000,
    });
    networkBoundaryObservability.recordOutbound(mqttUrl);
    const mqttClient = mqtt.connect(mqttUrl);
    const mqttPublish = (topic, payload) => {
      networkBoundaryObservability.recordOutbound(mqttUrl);
      const publishResult = publishMqttWithAck(mqttClient, topic, payload);
      return mbrPinFlowWiring.recordControlForward(payload, publishResult);
    };
    const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish });
    if (matrixRoomId) {
      networkBoundaryObservability.recordOutbound(matrixConfig.homeserverUrl);
      createMatrixLiveAdapter({ homeserverUrl: matrixConfig.homeserverUrl || undefined });
    }
  `;
  let mainDeclaration;
  if (placement === 'sibling') {
    mainDeclaration = `function unusedStartup(options = {}) {${startupBody}}\nexport function main(options = {}) {}`;
  } else if (placement === 'if_false') {
    mainDeclaration = `export function main(options = {}) { if (false) {${startupBody}} }`;
  } else if (placement === 'nested') {
    mainDeclaration = `export function main(options = {}) { function nestedStartup() {${startupBody}} nestedStartup(); }`;
  } else {
    mainDeclaration = `export function main(options = {}) {${startupBody}}`;
  }
  const entrypointCall = directEntrypoint ? 'main();' : 'false && main();';
  return `
    import { createDeNetworkBoundaryObservability } from './lib/de_network_boundary_evidence.mjs';
    import { publishMqttWithAck } from '../packages/worker-base/src/mqtt_publish_ack.mjs';
    export function createMbrWorkerNetworkBoundaryObservability({
      mqttUrl,
      matrixHomeserverUrl,
      writeLine,
      now,
      setIntervalFn,
      clearIntervalFn,
      heartbeatIntervalMs,
    }) {
      return createDeNetworkBoundaryObservability({
        service: 'mbr-worker',
        effectiveDestinations: [mqttUrl, matrixHomeserverUrl],
        writeLine,
        now,
        setIntervalFn,
        clearIntervalFn,
        heartbeatIntervalMs,
      });
    }
    ${mainDeclaration}
    const entrypointUrl = 'fixture-entrypoint';
    if (import.meta.url === entrypointUrl) {
      try {
        ${entrypointCall}
      } catch (error) {
        process.exitCode = 1;
      }
    }
  `;
}

function mbrLocalBootstrapPatchFixture({ matrixRoomId = '!test-0184-mbr:localhost' } = {}) {
  return {
    version: 'mt.v0',
    op_id: 'test_0184_mbr_main_local_bootstrap',
    records: [
      {
        op: 'add_label',
        model_id: 0,
        p: 0,
        r: 0,
        c: 0,
        k: 'local_ip',
        t: 'mqtt.local.ip',
        v: ['mosquitto.dongyu.svc.cluster.local'],
      },
      {
        op: 'add_label',
        model_id: 0,
        p: 0,
        r: 0,
        c: 0,
        k: 'local_port',
        t: 'mqtt.local.port',
        v: ['1883'],
      },
      {
        op: 'add_label',
        model_id: 0,
        p: 0,
        r: 0,
        c: 0,
        k: 'matrix_room_id',
        t: 'str',
        v: matrixRoomId,
      },
      {
        op: 'add_label',
        model_id: 0,
        p: 0,
        r: 0,
        c: 0,
        k: 'matrix_server',
        t: 'matrix.server',
        v: localMatrixDestination,
      },
    ],
  };
}

async function assertMbrMainBehavioralStartupContract() {
  assert.equal(fs.existsSync(mbrPatchDir), true, 'behavior harness requires the repository-owned local MBR patch directory');

  const originalArgv = [...process.argv];
  const originalExitCode = process.exitCode;
  const environmentKeys = [
    'DY_ACTOR_ATTEST_ONLY',
    'DY_PERSISTED_ASSET_ROOT',
    'DY_ROLE_PATCH_DIR',
    'MODELTABLE_PATCH_JSON',
  ];
  const originalEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
  const requireFromTest = createRequire(import.meta.url);
  const mqttModule = requireFromTest('mqtt');
  const mqttImplementation = mqttModule.default;
  const matrixModule = requireFromTest(path.join(repoRoot, 'packages/worker-base/src/matrix_live.js'));
  const originalMqttConnect = mqttImplementation.connect;
  const originalMatrixAdapterFactory = matrixModule.createMatrixLiveAdapter;
  const originalStdoutWrite = process.stdout.write;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalDateNow = Date.now;
  const originalProcessExit = process.exit;
  const originalSigintListeners = process.listeners('SIGINT');
  const forbiddenNetworkCalls = [];
  const mqttConnectSentinel = new Error('test_0184_real_mqtt_connect_forbidden');
  let handleTrappedMqttConnect = () => {
    throw mqttConnectSentinel;
  };
  let handleTrappedMatrixCreate = () => {
    throw new Error('test_0184_real_matrix_connect_forbidden');
  };
  const trappedMqttConnect = (...args) => {
    forbiddenNetworkCalls.push({ transport: 'mqtt', args });
    return handleTrappedMqttConnect(...args);
  };

  try {
    mqttImplementation.connect = trappedMqttConnect;
    assert.equal(
      requireFromTest('mqtt').connect,
      trappedMqttConnect,
      'the installed package getter must expose the trap through the exact require(\'mqtt\').connect export used by the runner',
    );
    matrixModule.createMatrixLiveAdapter = (...args) => {
      forbiddenNetworkCalls.push({ transport: 'matrix', args });
      return handleTrappedMatrixCreate(...args);
    };
    process.argv.splice(0, process.argv.length, originalArgv[0] || process.execPath, mbrRunnerPath);
    delete process.env.DY_ACTOR_ATTEST_ONLY;
    process.env.DY_PERSISTED_ASSET_ROOT = '';
    delete process.env.DY_ROLE_PATCH_DIR;
    process.env.MODELTABLE_PATCH_JSON = JSON.stringify(mbrLocalBootstrapPatchFixture());
    process.exitCode = undefined;

    const runnerModule = await import(
      `${pathToFileURL(mbrRunnerPath).href}?test_0184_main_behavior=1`
    );
    assert.equal(
      typeof runnerModule.main,
      'function',
      'MBR runner must export callable main(options = {}) for the real behavior harness',
    );

    const sentinel = new Error('test_0184_network_installer_sentinel');
    const installerCalls = [];
    const writeLine = () => {};
    const now = () => startedAt;
    const setIntervalFn = () => {
      throw new Error('test_0184_timer_must_not_start_before_installer_returns');
    };
    const clearIntervalFn = () => {};

    await assert.rejects(
      async () => runnerModule.main({
        patchDir: mbrPatchDir,
        installNetworkBoundaryObservability: (inputs) => {
          installerCalls.push(inputs);
          throw sentinel;
        },
        writeLine,
        now,
        setIntervalFn,
        clearIntervalFn,
      }),
      (error) => error === sentinel,
      'real main(options) must execute the injected installer and propagate its exact sentinel before network setup',
    );

    assert.equal(installerCalls.length, 1, 'real main(options) must invoke the injected installer exactly once');
    const [installerInputs] = installerCalls;
    assert.deepEqual(
      Object.keys(installerInputs).sort(),
      [
        'clearIntervalFn',
        'heartbeatIntervalMs',
        'matrixHomeserverUrl',
        'mqttUrl',
        'now',
        'service',
        'setIntervalFn',
        'writeLine',
      ],
      'real main(options) must pass only canonical non-secret network evidence inputs',
    );
    assert.equal(installerInputs.service, 'mbr-worker', 'behavior harness must observe the canonical MBR service identity');
    assert.equal(installerInputs.mqttUrl, localMqttDestination, 'behavior harness must observe the effective local MQTT destination');
    assert.equal(installerInputs.matrixHomeserverUrl, localMatrixDestination, 'behavior harness must observe the effective local Matrix destination');
    assert.equal(installerInputs.writeLine, writeLine, 'behavior harness must observe the injected evidence writer');
    assert.equal(installerInputs.now, now, 'behavior harness must observe the injected clock');
    assert.equal(installerInputs.setIntervalFn, setIntervalFn, 'behavior harness must observe the injected timer');
    assert.equal(installerInputs.clearIntervalFn, clearIntervalFn, 'behavior harness must observe the injected timer cleanup');
    assert.equal(installerInputs.heartbeatIntervalMs, networkHeartbeatIntervalMs, 'behavior harness must observe the canonical heartbeat interval');
    assert.equal(forbiddenNetworkCalls.length, 0, 'injected installer sentinel must stop main before any MQTT or Matrix network call');
    assert.equal(process.exitCode, undefined, 'behavior harness must not rely on process.exitCode to fake installer execution');

    const defaultOutput = [];
    const defaultIntervals = [];
    const defaultClears = [];
    let defaultNow = startedAt;
    const defaultTimerHandle = {
      unrefCount: 0,
      unref() {
        this.unrefCount += 1;
        return this;
      },
    };
    process.stdout.write = (chunk, encoding, callback) => {
      defaultOutput.push(String(chunk));
      if (typeof encoding === 'function') encoding();
      else if (typeof callback === 'function') callback();
      return true;
    };
    globalThis.setInterval = (callback, delay, ...args) => {
      defaultIntervals.push({ callback, delay, args });
      return defaultTimerHandle;
    };
    globalThis.clearInterval = (handle) => {
      defaultClears.push(handle);
    };
    Date.now = () => defaultNow;
    handleTrappedMqttConnect = () => {
      assert.equal(defaultIntervals.length, 1, 'default observer must register its timer before MQTT');
      defaultNow += networkHeartbeatIntervalMs;
      defaultIntervals[0].callback();
      throw mqttConnectSentinel;
    };
    process.argv.splice(
      0,
      process.argv.length,
      originalArgv[0] || process.execPath,
      mbrRunnerPath,
      mbrPatchDir,
    );

    await assert.rejects(
      async () => runnerModule.main(),
      (error) => error === mqttConnectSentinel,
      'default main() must execute the real default observer before the trapped MQTT connection',
    );
    assert.deepEqual(
      forbiddenNetworkCalls.map(({ transport }) => transport),
      ['mqtt'],
      'default main() must reach only the trapped local MQTT boundary and must not reach Matrix after the sentinel',
    );
    assert.equal(
      forbiddenNetworkCalls[0].args[0],
      localMqttDestination,
      'default main() must attempt only the ModelTable-derived local Mosquitto destination',
    );
    assert.equal(defaultIntervals.length, 1, 'default observer must install exactly one heartbeat timer before MQTT');
    assert.equal(defaultIntervals[0].delay, networkHeartbeatIntervalMs, 'default observer must use the canonical heartbeat interval');
    assert.equal(typeof defaultIntervals[0].callback, 'function', 'default heartbeat timer must retain an executable callback');
    assert.equal(defaultIntervals[0].args.length, 0, 'default observer heartbeat must not smuggle extra timer arguments');
    assert.ok(defaultTimerHandle.unrefCount <= 1, 'default observer timer may be unrefed at most once');
    assert.deepEqual(
      defaultClears,
      [defaultTimerHandle],
      'a trapped default startup must stop exactly its own observer timer before propagating the MQTT failure',
    );

    const { parseDeNetworkBoundaryEvidenceLines } = await loadNetworkBoundaryModule();
    const defaultEvidence = parseDeNetworkBoundaryEvidenceLines(defaultOutput.join(''), { since: 0 });
    assert.deepEqual(
      defaultEvidence.slice(0, 3).map(({ kind, protocol, service }) => ({ kind, protocol, service })),
      [
        { kind: 'effective_config', protocol: 'mqtt:', service: 'mbr-worker' },
        { kind: 'effective_config', protocol: 'http:', service: 'mbr-worker' },
        { kind: 'outbound_attempt', protocol: 'mqtt:', service: 'mbr-worker' },
      ],
      'default main() must emit both effective destinations and its real MQTT attempt through the shared observer',
    );
    assert.deepEqual(
      defaultEvidence.slice(0, 3).map(({ ts }) => ts),
      [startedAt, startedAt, startedAt],
      'default startup evidence must use the startup clock value rather than a fabricated future timestamp',
    );
    assert.deepEqual(
      defaultEvidence.slice(3).map(({ kind, protocol, service }) => ({ kind, protocol, service })),
      [
        { kind: 'effective_config', protocol: 'mqtt:', service: 'mbr-worker' },
        { kind: 'effective_config', protocol: 'http:', service: 'mbr-worker' },
      ],
      'the default observer timer must emit the next complete MBR effective-config heartbeat',
    );
    assert.deepEqual(
      defaultEvidence.slice(3).map(({ ts }) => ts),
      [startedAt + networkHeartbeatIntervalMs, startedAt + networkHeartbeatIntervalMs],
      'the default heartbeat must obtain a new clock value one full interval after startup',
    );
    assert.equal(process.exitCode, undefined, 'default behavior harness must not convert its trapped boundary into process state');

    defaultOutput.length = 0;
    defaultIntervals.length = 0;
    defaultClears.length = 0;
    defaultTimerHandle.unrefCount = 0;
    defaultNow = startedAt;
    process.env.MODELTABLE_PATCH_JSON = JSON.stringify(mbrLocalBootstrapPatchFixture());
    const mqttHandlers = new Map();
    const mqttEndCalls = [];
    const fakeMqttClient = {
      end(...args) {
        mqttEndCalls.push(args);
      },
      on(event, listener) {
        mqttHandlers.set(event, listener);
        return this;
      },
      publish() {},
      subscribe() {},
    };
    const matrixSubscribeCalls = [];
    let matrixCloseCalls = 0;
    const fakeMatrixAdapter = {
      room_id: '!test-0184-mbr:localhost',
      close() {
        matrixCloseCalls += 1;
      },
      subscribe(listener) {
        matrixSubscribeCalls.push(listener);
        return () => undefined;
      },
    };
    handleTrappedMqttConnect = () => fakeMqttClient;
    handleTrappedMatrixCreate = () => Promise.resolve(fakeMatrixAdapter);
    const processExitCalls = [];
    const processExitSentinel = new Error('test_0184_process_exit_trap');
    process.exit = (code) => {
      processExitCalls.push(code);
      throw processExitSentinel;
    };

    await runnerModule.main();
    await Promise.resolve();
    assert.deepEqual(
      forbiddenNetworkCalls.map(({ transport }) => transport),
      ['mqtt', 'mqtt', 'matrix'],
      'normal default startup must execute both trapped local MQTT and Matrix paths after the MQTT failure case',
    );
    assert.equal(
      forbiddenNetworkCalls[1].args[0],
      localMqttDestination,
      'normal default main() must use only the ModelTable-derived local Mosquitto destination',
    );
    assert.deepEqual(
      {
        homeserverUrl: forbiddenNetworkCalls[2].args[0]?.homeserverUrl,
        roomId: forbiddenNetworkCalls[2].args[0]?.roomId,
      },
      {
        homeserverUrl: localMatrixDestination,
        roomId: '!test-0184-mbr:localhost',
      },
      'normal default main() must execute Matrix only against the ModelTable-derived local Synapse destination',
    );
    assert.equal(matrixSubscribeCalls.length, 1, 'normal Matrix startup must subscribe exactly once through the fake adapter');
    assert.deepEqual([...mqttHandlers.keys()].sort(), ['connect', 'message'], 'normal startup must register only its expected MQTT handlers');
    assert.equal(defaultIntervals.length, 1, 'normal default startup must retain one observer heartbeat timer');
    assert.equal(defaultIntervals[0].delay, networkHeartbeatIntervalMs, 'normal observer must retain the canonical interval');
    assert.equal(defaultClears.length, 0, 'normal main() return must not unconditionally stop the observer');

    const normalStartupEvidence = parseDeNetworkBoundaryEvidenceLines(defaultOutput.join(''), { since: 0 });
    assert.deepEqual(
      normalStartupEvidence.map(({ kind, protocol, service, ts }) => ({ kind, protocol, service, ts })),
      [
        { kind: 'effective_config', protocol: 'mqtt:', service: 'mbr-worker', ts: startedAt },
        { kind: 'effective_config', protocol: 'http:', service: 'mbr-worker', ts: startedAt },
        { kind: 'outbound_attempt', protocol: 'mqtt:', service: 'mbr-worker', ts: startedAt },
        { kind: 'outbound_attempt', protocol: 'http:', service: 'mbr-worker', ts: startedAt },
      ],
      'normal default startup must emit both local outbound attempts before remaining live',
    );
    defaultNow += networkHeartbeatIntervalMs;
    defaultIntervals[0].callback();
    const normalLiveEvidence = parseDeNetworkBoundaryEvidenceLines(defaultOutput.join(''), { since: 0 });
    assert.deepEqual(
      normalLiveEvidence.slice(normalStartupEvidence.length).map(({ kind, protocol, service, ts }) => ({ kind, protocol, service, ts })),
      [
        {
          kind: 'effective_config',
          protocol: 'mqtt:',
          service: 'mbr-worker',
          ts: startedAt + networkHeartbeatIntervalMs,
        },
        {
          kind: 'effective_config',
          protocol: 'http:',
          service: 'mbr-worker',
          ts: startedAt + networkHeartbeatIntervalMs,
        },
      ],
      'normal default startup must keep its observer alive through the next fresh heartbeat',
    );
    const addedSigintListeners = process.listeners('SIGINT').filter((listener) => (
      !originalSigintListeners.includes(listener)
    ));
    assert.equal(addedSigintListeners.length, 1, 'normal main() must own one cleanup handler for its live resources');
    await assert.rejects(
      async () => addedSigintListeners[0](),
      (error) => error === processExitSentinel,
      'the process-exit trap must run only after all owned shutdown work',
    );
    assert.deepEqual(mqttEndCalls, [[true]], 'owned shutdown must close the fake MQTT client exactly once');
    assert.equal(matrixCloseCalls, 1, 'owned shutdown must close the fake Matrix adapter exactly once');
    assert.deepEqual(defaultClears, [defaultTimerHandle], 'owned shutdown must stop the observer heartbeat exactly once');
    assert.deepEqual(processExitCalls, [0], 'owned shutdown must preserve the standard successful exit contract');
  } finally {
    mqttImplementation.connect = originalMqttConnect;
    matrixModule.createMatrixLiveAdapter = originalMatrixAdapterFactory;
    process.stdout.write = originalStdoutWrite;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    Date.now = originalDateNow;
    process.exit = originalProcessExit;
    for (const listener of process.listeners('SIGINT')) {
      if (!originalSigintListeners.includes(listener)) process.removeListener('SIGINT', listener);
    }
    process.argv.splice(0, process.argv.length, ...originalArgv);
    for (const [key, value] of originalEnvironment.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    process.exitCode = originalExitCode;
  }
}

async function test_mbr_runner_executes_shared_network_evidence_paths() {
  assertContractMutationsRejected(assertMbrWorkerNetworkBoundaryRunnerContract, [
    {
      name: 'mbr_ack_publisher_not_passed_to_engine',
      source: replaceContractFixtureToken(
        mbrSource,
        'const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish });',
        'const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish: () => undefined });',
        'mbr_ack_publisher_not_passed_to_engine',
      ),
      expectedPattern: /pass mqttPublish directly to WorkerEngineV0/u,
    },
    {
      name: 'mbr_ack_publisher_drops_record_forward_return',
      source: replaceContractFixtureToken(
        mbrSource,
        'return mbrPinFlowWiring.recordControlForward(payload, publishResult);',
        'mbrPinFlowWiring.recordControlForward(payload, publishResult);',
        'mbr_ack_publisher_drops_record_forward_return',
      ),
      expectedPattern: /return recordControlForward with the acknowledged publish result/u,
    },
  ], 'mbr-worker acknowledged publish mutation fixtures');
  assert.doesNotThrow(
    () => assertMbrWorkerNetworkBoundaryRunnerContract(mbrRunnerContractFixture()),
    'contract checker must accept one direct installer on the real main startup path',
  );
  for (const [name, fixture, pattern] of [
    [
      'uncalled_sibling',
      mbrRunnerContractFixture({ placement: 'sibling' }),
      /installer|startup path must execute|main/u,
    ],
    [
      'literal_false_branch',
      mbrRunnerContractFixture({ placement: 'if_false' }),
      /real startup path/u,
    ],
    [
      'nested_wrapper',
      mbrRunnerContractFixture({ placement: 'nested' }),
      /real startup path/u,
    ],
    [
      'indirect_entrypoint',
      mbrRunnerContractFixture({ directEntrypoint: false }),
      /directly call/u,
    ],
  ]) {
    assert.throws(
      () => assertMbrWorkerNetworkBoundaryRunnerContract(fixture),
      pattern,
      `${name}: static or unreachable producer code must not satisfy the MBR startup contract`,
    );
  }

  await assertMbrMainBehavioralStartupContract();
  assertMbrWorkerNetworkBoundaryRunnerContract(mbrSource);
  const {
    createDeNetworkBoundaryObservability,
    parseDeNetworkBoundaryEvidenceLines,
  } = await loadNetworkBoundaryModule();
  const { install } = instantiateRunnerOwnedInstaller(
    mbrSource,
    'createMbrWorkerNetworkBoundaryObservability',
    createDeNetworkBoundaryObservability,
  );
  exerciseRunnerOwnedInstaller({
    install,
    installArgs: {
      matrixHomeserverUrl: localMatrixDestination,
      mqttUrl: localMqttDestination,
    },
    destinations: [localMqttDestination, localMatrixDestination],
    expectedProtocols: ['mqtt:', 'http:'],
    expectedService: 'mbr-worker',
    parseLines: parseDeNetworkBoundaryEvidenceLines,
  });

  const executableSource = stripJavaScriptComments(mbrSource);
  assert.doesNotMatch(
    executableSource,
    /\b(?:const|let|var)\s+DE_NETWORK_BOUNDARY_MARKER\b|function\s+(?:build|format)DeNetworkBoundaryEvidence\b/u,
    'mbr-worker must not hand-build or duplicate the shared network evidence contract',
  );
  assert.doesNotMatch(
    executableSource,
    /\bservice\s*:\s*['"](?:mqtt|matrix|feishu)['"]/u,
    'mbr-worker evidence must use actor identity while protocol describes MQTT or Matrix transport',
  );
}

async function test_remote_worker_image_packages_shared_evidence_helpers() {
  assert.match(
    dockerfile,
    /COPY\s+scripts\/lib\/de_actor_attestation\.mjs\s+\.\/scripts\/lib\/de_actor_attestation\.mjs/u,
    'remote-worker image must package the actor-attestation helper imported by its runner',
  );
  assert.match(
    dockerfile,
    /COPY\s+scripts\/lib\/de_runtime_diagnostics\.mjs\s+\.\/scripts\/lib\/de_runtime_diagnostics\.mjs/u,
    'remote-worker image must package the shared diagnostic helper imported by its runner',
  );
  assert.match(
    dockerfile,
    /COPY\s+scripts\/lib\/de_network_boundary_evidence\.mjs\s+\.\/scripts\/lib\/de_network_boundary_evidence\.mjs/u,
    'remote-worker image must package the shared network-boundary evidence helper imported by its runner',
  );
  for (const manifestPath of workerManifestPaths) {
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    assert.equal(
      [...manifest.matchAll(/image:\s*dy-remote-worker:v3/gu)].length,
      2,
      `${path.relative(repoRoot, manifestPath)} must run R1 and WM1 from the same guarded image`,
    );
    assert.match(
      manifest,
      /name:\s*workspace-manager-config[\s\S]*?DY_WORKER_SCOPE:\s*['"]workspace-manager['"]/u,
      `${path.relative(repoRoot, manifestPath)} must select the diagnostic-free WM1 scope explicitly`,
    );
  }
}

const tests = [
  test_network_boundary_helper_is_fresh_strict_and_non_secret,
  test_runner_executes_shared_diagnostic_and_network_evidence_paths,
  test_mbr_runner_executes_shared_network_evidence_paths,
  test_remote_worker_image_packages_shared_evidence_helpers,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${error && error.stack ? error.stack : error}`);
  }
}

console.log(`${passed} passed, ${failed} failed out of ${tests.length}`);
if (failed > 0) process.exit(1);
console.log('PASS test_0184_remote_worker_observability_contract');
