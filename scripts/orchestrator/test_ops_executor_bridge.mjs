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

function sampleRequest(batchId, taskId) {
  return {
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const runners = {
    exchange: runExchangeCase,
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
