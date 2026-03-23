#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

let passed = 0
let failed = 0

function check(condition, message) {
  if (condition) {
    passed++
    process.stderr.write(`  PASS: ${message}\n`)
    return
  }

  failed++
  process.stderr.write(`  FAIL: ${message}\n`)
}

function parseArgs(argv) {
  let selectedCase = 'all'

  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--case') {
      selectedCase = argv[index + 1] || selectedCase
      index++
    }
  }

  return {
    case: selectedCase,
  }
}

function repoPath(relativePath) {
  return join(process.cwd(), relativePath)
}

function clean(relativePath) {
  const absolutePath = repoPath(relativePath)
  if (existsSync(absolutePath)) {
    rmSync(absolutePath, { recursive: true, force: true })
  }
}

function sampleRequest(batchId, taskId, overrides = {}) {
  const base = {
    schema_version: 'ops_task_request.v1',
    task_kind: 'ops_task',
    batch_id: batchId,
    iteration_id: '0227-orchestrator-ops-executor-bridge',
    task_id: taskId,
    attempt: 1,
    created_at: '2026-03-24T08:00:00.000Z',
    executor: {
      executor_class: 'ops_capable',
      bridge_channel: 'ops_task_bridge',
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
    exchange: {
      request_file: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/request.json`,
      result_file: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/result.json`,
      task_dir: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}`,
      stdout_file: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/stdout.log`,
      stderr_file: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/stderr.log`,
      artifacts_dir: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/artifacts`,
    },
    command: 'bash scripts/ops/check_runtime_baseline.sh',
    shell: 'bash',
    cwd: '.',
    target_env: 'local',
    host_scope: 'local_cluster',
    mutating: false,
    danger_level: 'low',
    timeout_ms: 45_000,
    success_assertions: [
      'command exits with code 0',
      'required artifacts are archived',
    ],
    required_artifacts: [
      {
        artifact_kind: 'json',
        relative_path: `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/artifacts/report.json`,
        required: true,
        media_type: 'application/json',
      },
    ],
  }

  return {
    ...base,
    ...overrides,
    executor: {
      ...base.executor,
      ...(overrides.executor || {}),
    },
    exchange: {
      ...base.exchange,
      ...(overrides.exchange || {}),
    },
    success_assertions: overrides.success_assertions || base.success_assertions,
    required_artifacts: overrides.required_artifacts || base.required_artifacts,
  }
}

function samplePassResult(request) {
  return {
    schema_version: 'ops_task_result.v1',
    task_kind: 'ops_task',
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'pass',
    failure_kind: 'none',
    summary: 'Ops bridge persisted canonical stdout/stderr/result/artifact evidence.',
    exit_code: 0,
    executor: structuredClone(request.executor),
    started_at: '2026-03-24T08:00:01.000Z',
    completed_at: '2026-03-24T08:00:03.000Z',
    stdout_file: request.exchange.stdout_file,
    stderr_file: request.exchange.stderr_file,
    artifacts: [],
  }
}

async function runExchangeCase() {
  process.stderr.write('\n== Ops Executor Bridge Test 1: exchange helpers ==\n')

  const batchId = 'test-ops-bridge-step1'
  const taskId = 'ops-task-exchange'
  clean(`.orchestrator/runs/${batchId}`)

  const bridge = await import('./ops_bridge.mjs')
  const paths = bridge.deriveOpsTaskPaths(batchId, taskId)

  check(
    paths.requestFileRelative === `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/request.json`,
    'deriveOpsTaskPaths returns canonical request.json path'
  )
  check(
    paths.resultFileRelative === `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/result.json`,
    'deriveOpsTaskPaths returns canonical result.json path'
  )
  check(
    paths.stdoutFileRelative === `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/stdout.log`,
    'deriveOpsTaskPaths returns canonical stdout.log path'
  )
  check(
    paths.stderrFileRelative === `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/stderr.log`,
    'deriveOpsTaskPaths returns canonical stderr.log path'
  )
  check(
    paths.artifactsDirRelative === `.orchestrator/runs/${batchId}/ops_tasks/${taskId}/artifacts`,
    'deriveOpsTaskPaths returns canonical artifacts dir path'
  )

  const request = sampleRequest(batchId, taskId)
  mkdirSync(dirname(repoPath(request.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(request.exchange.request_file), JSON.stringify(request, null, 2))

  const loaded = bridge.loadOpsTaskRequest({ batchId, taskId })
  check(loaded.request.task_id === taskId, 'loadOpsTaskRequest reads canonical request.json')
  check(loaded.paths.taskDirRelative === request.exchange.task_dir, 'loadOpsTaskRequest returns canonical task_dir metadata')

  bridge.writeOpsTaskLog({
    request: loaded.request,
    stream: 'stdout',
    content: 'stdout line 1\nstdout line 2\n',
  })
  bridge.writeOpsTaskLog({
    request: loaded.request,
    stream: 'stderr',
    content: '',
  })
  check(existsSync(repoPath(request.exchange.stdout_file)), 'writeOpsTaskLog materializes stdout.log')
  check(existsSync(repoPath(request.exchange.stderr_file)), 'writeOpsTaskLog materializes stderr.log')

  const materializedArtifacts = bridge.materializeOpsTaskArtifacts({
    request: loaded.request,
    artifacts: [
      {
        relative_path: request.required_artifacts[0].relative_path,
        content: JSON.stringify({ ok: true }, null, 2),
      },
    ],
  })
  check(materializedArtifacts.artifacts.length === 1, 'materializeOpsTaskArtifacts returns one produced artifact manifest entry')
  check(existsSync(repoPath(request.required_artifacts[0].relative_path)), 'materializeOpsTaskArtifacts writes required artifact to canonical artifacts dir')

  const result = samplePassResult(loaded.request)
  result.artifacts = materializedArtifacts.artifacts
  const firstWrite = bridge.writeOpsTaskResult({ request: loaded.request, result })
  check(firstWrite.status === 'written', 'writeOpsTaskResult writes the first canonical result.json')
  check(existsSync(repoPath(request.exchange.result_file)), 'result.json exists after first write')

  const persisted = JSON.parse(readFileSync(repoPath(request.exchange.result_file), 'utf8'))
  check(persisted.summary === result.summary, 'persisted result keeps original summary')

  const secondWrite = bridge.writeOpsTaskResult({
    request: loaded.request,
    result: { ...result, summary: 'should not overwrite existing completed result' },
  })
  check(secondWrite.status === 'existing_result', 'duplicate write short-circuits on existing completed result')

  const afterDuplicate = JSON.parse(readFileSync(repoPath(request.exchange.result_file), 'utf8'))
  check(afterDuplicate.summary === result.summary, 'duplicate short-circuit preserves first completed result')

  const diskValidation = bridge.verifyOpsArtifactsOnDisk(persisted, loaded.request)
  check(diskValidation.ok, 'verifyOpsArtifactsOnDisk validates artifact manifest on disk')

  clean(`.orchestrator/runs/${batchId}`)
}

async function runMockExecutorCase() {
  process.stderr.write('\n== Ops Executor Bridge Test 2: mock executor ==\n')

  const batchId = 'test-ops-bridge-step2-mock'
  const taskId = 'ops-task-mock'
  clean(`.orchestrator/runs/${batchId}`)

  const bridge = await import('./ops_bridge.mjs')
  const executor = await import('./ops_executor.mjs')
  const request = sampleRequest(batchId, taskId, {
    executor: {
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
  })

  mkdirSync(dirname(repoPath(request.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(request.exchange.request_file), JSON.stringify(request, null, 2))

  const outcome = executor.consumeOneOpsTask({
    batchId,
    consumerId: 'mock-consumer-step2',
  })

  check(outcome.status === 'completed', 'consumeOneOpsTask completes one mock request')
  check(outcome.result.status === 'pass', 'mock executor writes pass result')
  check(outcome.result.failure_kind === 'none', 'mock executor keeps failure_kind=none on pass')
  check(outcome.result.exit_code === 0, 'mock executor keeps exit_code=0 on pass')
  check(existsSync(repoPath(request.exchange.stdout_file)), 'mock executor materializes stdout.log')
  check(existsSync(repoPath(request.exchange.stderr_file)), 'mock executor materializes stderr.log')
  check(existsSync(repoPath(request.required_artifacts[0].relative_path)), 'mock executor materializes required artifact')

  const persisted = bridge.loadOpsTaskResult({ request })
  check(Boolean(persisted), 'mock executor persists canonical result.json')
  check(bridge.verifyOpsArtifactsOnDisk(persisted.result, request).ok, 'mock executor result manifest matches files on disk')

  clean(`.orchestrator/runs/${batchId}`)
}

async function runLocalShellCase() {
  process.stderr.write('\n== Ops Executor Bridge Test 3: local shell ==\n')

  const bridge = await import('./ops_bridge.mjs')
  const executor = await import('./ops_executor.mjs')

  const passBatchId = 'test-ops-bridge-step2-local-pass'
  const passTaskId = 'ops-task-local-pass'
  clean(`.orchestrator/runs/${passBatchId}`)
  const passRequest = sampleRequest(passBatchId, passTaskId, {
    executor: {
      executor_id: 'local-ops-executor',
      mode: 'local_shell',
    },
    command: "printf 'local shell ok\\n'",
  })
  mkdirSync(dirname(repoPath(passRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(passRequest.exchange.request_file), JSON.stringify(passRequest, null, 2))

  const passOutcome = executor.consumeOneOpsTask({
    batchId: passBatchId,
    consumerId: 'local-shell-consumer',
  })
  check(passOutcome.status === 'completed', 'local shell consumer completes safe local command')
  check(passOutcome.result.status === 'pass', 'local shell consumer writes pass result')
  check(passOutcome.result.failure_kind === 'none', 'local shell pass keeps failure_kind=none')
  check(readFileSync(repoPath(passRequest.exchange.stdout_file), 'utf8').includes('local shell ok'),
    'local shell consumer archives stdout content')
  check(bridge.verifyOpsArtifactsOnDisk(passOutcome.result, passRequest).ok,
    'local shell pass keeps artifact manifest aligned')

  const assertionBatchId = 'test-ops-bridge-step2-local-assertion'
  const assertionTaskId = 'ops-task-local-assertion'
  clean(`.orchestrator/runs/${assertionBatchId}`)
  const assertionRequest = sampleRequest(assertionBatchId, assertionTaskId, {
    executor: {
      executor_id: 'local-ops-executor',
      mode: 'local_shell',
    },
    command: "printf 'assertion failure demo\\n'",
  })
  mkdirSync(dirname(repoPath(assertionRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(assertionRequest.exchange.request_file), JSON.stringify(assertionRequest, null, 2))

  const assertionOutcome = executor.consumeOneOpsTask({
    batchId: assertionBatchId,
    consumerId: 'local-shell-assertion-consumer',
    assertionEvaluator: () => ({
      ok: false,
      summary: 'executor could not prove all success assertions',
    }),
  })
  check(assertionOutcome.status === 'completed', 'assertion failure path still completes with fail result')
  check(assertionOutcome.result.status === 'fail', 'assertion failure path writes fail result')
  check(assertionOutcome.result.failure_kind === 'assertion_failed', 'assertion failure path uses assertion_failed taxonomy')

  clean(`.orchestrator/runs/${passBatchId}`)
  clean(`.orchestrator/runs/${assertionBatchId}`)
}

async function runSshBoundaryCase() {
  process.stderr.write('\n== Ops Executor Bridge Test 4: ssh boundary ==\n')

  const executor = await import('./ops_executor.mjs')

  const unavailableBatchId = 'test-ops-bridge-step2-ssh-unavailable'
  const unavailableTaskId = 'ops-task-ssh-unavailable'
  clean(`.orchestrator/runs/${unavailableBatchId}`)
  const unavailableRequest = sampleRequest(unavailableBatchId, unavailableTaskId, {
    executor: {
      executor_id: 'ssh-ops-executor',
      mode: 'ssh',
    },
    command: 'bash scripts/ops/remote_preflight_guard.sh',
    target_env: 'remote',
    host_scope: 'remote_host',
  })
  mkdirSync(dirname(repoPath(unavailableRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(unavailableRequest.exchange.request_file), JSON.stringify(unavailableRequest, null, 2))

  const unavailableOutcome = executor.consumeOneOpsTask({
    batchId: unavailableBatchId,
    consumerId: 'ssh-boundary-consumer',
  })
  check(unavailableOutcome.status === 'completed', 'ssh boundary completes with explicit failure result when ssh executor is unavailable')
  check(unavailableOutcome.result.status === 'fail', 'ssh unavailable path writes fail result')
  check(unavailableOutcome.result.failure_kind === 'executor_unavailable', 'ssh unavailable path uses executor_unavailable taxonomy')

  const unreachableBatchId = 'test-ops-bridge-step2-ssh-unreachable'
  const unreachableTaskId = 'ops-task-ssh-unreachable'
  clean(`.orchestrator/runs/${unreachableBatchId}`)
  const unreachableRequest = sampleRequest(unreachableBatchId, unreachableTaskId, {
    executor: {
      executor_id: 'ssh-ops-executor',
      mode: 'ssh',
    },
    command: 'kubectl get pods -n dongyu',
    target_env: 'remote',
    host_scope: 'remote_cluster',
  })
  mkdirSync(dirname(repoPath(unreachableRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(unreachableRequest.exchange.request_file), JSON.stringify(unreachableRequest, null, 2))

  const unreachableOutcome = executor.consumeOneOpsTask({
    batchId: unreachableBatchId,
    consumerId: 'ssh-unreachable-consumer',
    sshRunner: () => ({
      ok: false,
      failure_kind: 'target_unreachable',
      summary: 'ssh transport could not reach target host',
      stdout: '',
      stderr: 'ssh: connect to host 124.71.43.80 port 22: Operation timed out',
      exit_code: null,
    }),
  })
  check(unreachableOutcome.result.failure_kind === 'target_unreachable', 'ssh transport failure uses target_unreachable taxonomy')

  const guardBatchId = 'test-ops-bridge-step2-ssh-guard'
  const guardTaskId = 'ops-task-ssh-guard'
  clean(`.orchestrator/runs/${guardBatchId}`)
  const guardRequest = sampleRequest(guardBatchId, guardTaskId, {
    executor: {
      executor_id: 'ssh-ops-executor',
      mode: 'ssh',
    },
    command: 'bash scripts/ops/deploy_cloud_full.sh',
    target_env: 'remote',
    host_scope: 'remote_cluster',
    mutating: true,
    danger_level: 'high',
  })
  mkdirSync(dirname(repoPath(guardRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(guardRequest.exchange.request_file), JSON.stringify(guardRequest, null, 2))

  const guardOutcome = executor.consumeOneOpsTask({
    batchId: guardBatchId,
    consumerId: 'ssh-guard-consumer',
    remoteGuardRunner: () => ({
      ok: false,
      stdout: '',
      stderr: 'REMOTE_RKE2_GATE: FAIL - kubectl cannot reach cluster',
    }),
  })
  check(guardOutcome.result.failure_kind === 'remote_guard_blocked', 'remote guard failure uses remote_guard_blocked taxonomy')

  const forbiddenBatchId = 'test-ops-bridge-step2-ssh-forbidden'
  const forbiddenTaskId = 'ops-task-ssh-forbidden'
  clean(`.orchestrator/runs/${forbiddenBatchId}`)
  const forbiddenRequest = sampleRequest(forbiddenBatchId, forbiddenTaskId, {
    executor: {
      executor_id: 'ssh-ops-executor',
      mode: 'ssh',
    },
    command: 'systemctl restart rke2',
    target_env: 'remote',
    host_scope: 'remote_host',
    mutating: true,
    danger_level: 'critical',
  })
  mkdirSync(dirname(repoPath(forbiddenRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(forbiddenRequest.exchange.request_file), JSON.stringify(forbiddenRequest, null, 2))

  const forbiddenOutcome = executor.consumeOneOpsTask({
    batchId: forbiddenBatchId,
    consumerId: 'ssh-forbidden-consumer',
  })
  check(forbiddenOutcome.result.failure_kind === 'forbidden_remote_op', 'forbidden remote command uses forbidden_remote_op taxonomy')

  clean(`.orchestrator/runs/${unavailableBatchId}`)
  clean(`.orchestrator/runs/${unreachableBatchId}`)
  clean(`.orchestrator/runs/${guardBatchId}`)
  clean(`.orchestrator/runs/${forbiddenBatchId}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const runners = {
    exchange: runExchangeCase,
    'mock-executor': runMockExecutorCase,
    'local-shell': runLocalShellCase,
    'ssh-boundary': runSshBoundaryCase,
  }

  const selected = args.case === 'all'
    ? Object.keys(runners)
    : [args.case]

  for (const caseName of selected) {
    const runner = runners[caseName]
    if (!runner) {
      process.stderr.write(`Unknown --case value: ${caseName}\n`)
      process.exit(1)
    }
    await runner()
  }

  process.stderr.write(`\nPassed: ${passed}, Failed: ${failed}\n`)
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exit(1)
})
