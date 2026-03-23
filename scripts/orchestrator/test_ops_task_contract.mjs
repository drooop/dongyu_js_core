#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REQUEST_SCHEMA_FILE = join(process.cwd(), 'scripts/orchestrator/schemas/ops_task_request.json')
const RESULT_SCHEMA_FILE = join(process.cwd(), 'scripts/orchestrator/schemas/ops_task_result.json')

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

function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function validateExecutor(executor) {
  if (!executor || typeof executor !== 'object') return false
  if (executor.executor_class !== 'ops_capable') return false
  if (executor.bridge_channel !== 'ops_task_bridge') return false
  if (!['mock', 'local_shell', 'ssh'].includes(executor.mode)) return false
  return typeof executor.executor_id === 'string' && executor.executor_id.length > 0
}

function validateRequestArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') return false
  if (!['file', 'json', 'log', 'archive'].includes(artifact.artifact_kind)) return false
  if (typeof artifact.relative_path !== 'string' || !artifact.relative_path.startsWith('.orchestrator/runs/')) return false
  if (typeof artifact.required !== 'boolean') return false
  return typeof artifact.media_type === 'string' && artifact.media_type.length > 0
}

function validateResultArtifact(artifact) {
  if (!validateRequestArtifact(artifact)) return false
  if (!artifact.producer || typeof artifact.producer !== 'object') return false
  if (artifact.producer.actor !== 'ops_executor') return false
  if (typeof artifact.producer.executor_id !== 'string' || artifact.producer.executor_id.length === 0) return false
  if (typeof artifact.bytes !== 'number' || artifact.bytes < 0) return false
  return typeof artifact.sha256 === 'string' && artifact.sha256.length === 64
}

function validateRequest(request) {
  if (!request || typeof request !== 'object') return false
  if (request.schema_version !== 'ops_task_request.v1') return false
  if (request.task_kind !== 'ops_task') return false
  if (typeof request.batch_id !== 'string' || request.batch_id.length === 0) return false
  if (typeof request.iteration_id !== 'string' || request.iteration_id.length === 0) return false
  if (typeof request.task_id !== 'string' || request.task_id.length === 0) return false
  if (!Number.isInteger(request.attempt) || request.attempt < 1) return false
  if (!isIsoTimestamp(request.created_at)) return false
  if (!validateExecutor(request.executor)) return false
  if (!request.exchange || typeof request.exchange !== 'object') return false
  if (typeof request.exchange.request_file !== 'string' || !request.exchange.request_file.startsWith('.orchestrator/runs/')) return false
  if (typeof request.exchange.result_file !== 'string' || !request.exchange.result_file.startsWith('.orchestrator/runs/')) return false
  if (typeof request.exchange.task_dir !== 'string' || !request.exchange.task_dir.startsWith('.orchestrator/runs/')) return false
  if (typeof request.exchange.stdout_file !== 'string' || !request.exchange.stdout_file.endsWith('/stdout.log')) return false
  if (typeof request.exchange.stderr_file !== 'string' || !request.exchange.stderr_file.endsWith('/stderr.log')) return false
  if (typeof request.exchange.artifacts_dir !== 'string' || !request.exchange.artifacts_dir.endsWith('/artifacts')) return false
  if (typeof request.command !== 'string' || request.command.length === 0) return false
  if (typeof request.shell !== 'string' || request.shell.length === 0) return false
  if (typeof request.cwd !== 'string' || request.cwd.length === 0 || request.cwd.startsWith('/')) return false
  if (!['local', 'remote'].includes(request.target_env)) return false
  if (!['repo', 'local_host', 'local_cluster', 'remote_host', 'remote_cluster'].includes(request.host_scope)) return false
  if (typeof request.mutating !== 'boolean') return false
  if (!['low', 'medium', 'high', 'critical'].includes(request.danger_level)) return false
  if (typeof request.timeout_ms !== 'number' || request.timeout_ms <= 0) return false
  if (!Array.isArray(request.success_assertions) || request.success_assertions.length === 0) return false
  if (!Array.isArray(request.required_artifacts) || request.required_artifacts.length === 0) return false
  return request.required_artifacts.every(validateRequestArtifact)
}

function validateResult(result, request) {
  if (!result || typeof result !== 'object') return false
  if (result.schema_version !== 'ops_task_result.v1') return false
  if (result.task_kind !== 'ops_task') return false
  if (result.batch_id !== request.batch_id) return false
  if (result.iteration_id !== request.iteration_id) return false
  if (result.task_id !== request.task_id) return false
  if (result.attempt !== request.attempt) return false
  if (!['pass', 'fail'].includes(result.status)) return false
  if (typeof result.summary !== 'string' || result.summary.length === 0) return false
  if (!validateExecutor(result.executor)) return false
  if (!isIsoTimestamp(result.started_at) || !isIsoTimestamp(result.completed_at)) return false
  if (!(Number.isInteger(result.exit_code) || result.exit_code === null)) return false
  if (result.stdout_file !== request.exchange.stdout_file) return false
  if (result.stderr_file !== request.exchange.stderr_file) return false
  if (!Array.isArray(result.artifacts) || !result.artifacts.every(validateResultArtifact)) return false

  const requiredArtifactPaths = new Set(
    request.required_artifacts
      .filter(artifact => artifact.required)
      .map(artifact => artifact.relative_path)
  )
  const producedArtifactPaths = new Set(result.artifacts.map(artifact => artifact.relative_path))

  if (result.status === 'pass') {
    if (result.failure_kind !== 'none') return false
    if (result.exit_code !== 0) return false
    for (const requiredPath of requiredArtifactPaths) {
      if (!producedArtifactPaths.has(requiredPath)) {
        return false
      }
    }
  } else if (result.failure_kind === 'none') {
    return false
  }

  return true
}

function testSchemaFilesParse() {
  process.stderr.write('\n== Ops Task Contract Test 1: schema files parse ==\n')

  check(existsSync(REQUEST_SCHEMA_FILE), 'ops_task_request.json exists')
  check(existsSync(RESULT_SCHEMA_FILE), 'ops_task_result.json exists')

  const requestSchema = loadJson(REQUEST_SCHEMA_FILE)
  const resultSchema = loadJson(RESULT_SCHEMA_FILE)

  check(requestSchema.title === 'Ops Task Request v1', 'request schema title frozen')
  check(resultSchema.title === 'Ops Task Result v1', 'result schema title frozen')
}

function testSchemaShape() {
  process.stderr.write('\n== Ops Task Contract Test 2: schema shape ==\n')

  const requestSchema = loadJson(REQUEST_SCHEMA_FILE)
  const resultSchema = loadJson(RESULT_SCHEMA_FILE)

  const requestRequired = requestSchema.required || []
  const resultRequired = resultSchema.required || []
  const artifactEnum = requestSchema.properties?.required_artifacts?.items?.properties?.artifact_kind?.enum || []
  const executorModeEnum = requestSchema.properties?.executor?.properties?.mode?.enum || []
  const failureKindEnum = resultSchema.properties?.failure_kind?.enum || []
  const expectedFailureKinds = [
    'request_invalid',
    'executor_unavailable',
    'target_unreachable',
    'timeout',
    'cancelled',
    'result_invalid',
    'nonzero_exit',
    'assertion_failed',
    'artifact_missing',
    'artifact_mismatch',
    'remote_guard_blocked',
    'forbidden_remote_op',
    'stale_result',
    'duplicate_result',
    'ingest_failed',
    'ops_bridge_not_proven',
  ]

  check(requestRequired.includes('command'), 'request schema requires command')
  check(requestRequired.includes('target_env'), 'request schema requires target_env')
  check(requestRequired.includes('host_scope'), 'request schema requires host_scope')
  check(requestRequired.includes('mutating'), 'request schema requires mutating')
  check(requestRequired.includes('danger_level'), 'request schema requires danger_level')
  check(requestRequired.includes('success_assertions'), 'request schema requires success_assertions')
  check(requestRequired.includes('required_artifacts'), 'request schema requires required_artifacts')
  check(requestSchema.properties?.exchange?.properties?.stdout_file?.pattern?.includes('stdout\\.log'),
    'request schema freezes stdout.log path')
  check(requestSchema.properties?.exchange?.properties?.stderr_file?.pattern?.includes('stderr\\.log'),
    'request schema freezes stderr.log path')
  check(requestSchema.properties?.exchange?.properties?.artifacts_dir?.pattern?.includes('/artifacts'),
    'request schema freezes artifacts dir path')
  check(artifactEnum.includes('file'), 'artifact enum includes file')
  check(artifactEnum.includes('json'), 'artifact enum includes json')
  check(artifactEnum.includes('log'), 'artifact enum includes log')
  check(artifactEnum.includes('archive'), 'artifact enum includes archive')
  check(executorModeEnum.includes('mock'), 'request executor mode includes mock')
  check(executorModeEnum.includes('local_shell'), 'request executor mode includes local_shell')
  check(executorModeEnum.includes('ssh'), 'request executor mode includes ssh')

  check(resultRequired.includes('status'), 'result schema requires status')
  check(resultRequired.includes('failure_kind'), 'result schema requires failure_kind')
  check(resultRequired.includes('exit_code'), 'result schema requires exit_code')
  check(resultRequired.includes('stdout_file'), 'result schema requires stdout_file')
  check(resultRequired.includes('stderr_file'), 'result schema requires stderr_file')
  check(resultRequired.includes('artifacts'), 'result schema requires artifacts')
  for (const failureKind of expectedFailureKinds) {
    check(failureKindEnum.includes(failureKind), `result schema includes ${failureKind} failure kind`)
  }
}

function testPositiveSamples() {
  process.stderr.write('\n== Ops Task Contract Test 3: positive samples ==\n')

  const request = {
    schema_version: 'ops_task_request.v1',
    task_kind: 'ops_task',
    batch_id: 'batch-0226',
    iteration_id: '0226-orchestrator-ops-task-contract-freeze',
    task_id: 'ops-task-001',
    attempt: 1,
    created_at: '2026-03-24T03:00:00.000Z',
    executor: {
      executor_class: 'ops_capable',
      bridge_channel: 'ops_task_bridge',
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
    exchange: {
      request_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/request.json',
      result_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/result.json',
      task_dir: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001',
      stdout_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/stdout.log',
      stderr_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/stderr.log',
      artifacts_dir: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/artifacts',
    },
    command: 'bash scripts/ops/check_runtime_baseline.sh',
    shell: 'bash',
    cwd: '.',
    target_env: 'local',
    host_scope: 'local_cluster',
    mutating: false,
    danger_level: 'low',
    timeout_ms: 45000,
    success_assertions: [
      'baseline check exits with code 0',
      'required report artifact exists',
    ],
    required_artifacts: [
      {
        artifact_kind: 'json',
        relative_path: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/artifacts/report.json',
        required: true,
        media_type: 'application/json',
      },
      {
        artifact_kind: 'log',
        relative_path: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/artifacts/summary.log',
        required: false,
        media_type: 'text/plain',
      },
    ],
  }

  const result = {
    schema_version: 'ops_task_result.v1',
    task_kind: 'ops_task',
    batch_id: 'batch-0226',
    iteration_id: '0226-orchestrator-ops-task-contract-freeze',
    task_id: 'ops-task-001',
    attempt: 1,
    status: 'pass',
    failure_kind: 'none',
    summary: 'ops executor completed the command and archived canonical outputs.',
    exit_code: 0,
    executor: {
      executor_class: 'ops_capable',
      bridge_channel: 'ops_task_bridge',
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
    started_at: '2026-03-24T03:00:01.000Z',
    completed_at: '2026-03-24T03:00:12.000Z',
    stdout_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/stdout.log',
    stderr_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/stderr.log',
    artifacts: [
      {
        artifact_kind: 'json',
        relative_path: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-001/artifacts/report.json',
        required: true,
        media_type: 'application/json',
        bytes: 128,
        sha256: 'a'.repeat(64),
        producer: {
          actor: 'ops_executor',
          executor_id: 'mock-ops-executor',
        },
      },
    ],
  }

  check(validateRequest(request), 'positive request sample validates')
  check(validateResult(result, request), 'positive result sample validates')
}

function testNegativeSamples() {
  process.stderr.write('\n== Ops Task Contract Test 4: negative samples ==\n')

  const request = {
    schema_version: 'ops_task_request.v1',
    task_kind: 'ops_task',
    batch_id: 'batch-0226',
    iteration_id: '0226-orchestrator-ops-task-contract-freeze',
    task_id: 'ops-task-002',
    attempt: 1,
    created_at: '2026-03-24T03:30:00.000Z',
    executor: {
      executor_class: 'ops_capable',
      bridge_channel: 'ops_task_bridge',
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
    exchange: {
      request_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/request.json',
      result_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/result.json',
      task_dir: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002',
      stdout_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/stdout.log',
      stderr_file: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/stderr.log',
      artifacts_dir: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/artifacts',
    },
    command: 'sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild',
    shell: 'bash',
    cwd: '.',
    target_env: 'remote',
    host_scope: 'remote_cluster',
    mutating: true,
    danger_level: 'high',
    timeout_ms: 180000,
    success_assertions: [
      'deploy exits with code 0',
    ],
    required_artifacts: [
      {
        artifact_kind: 'json',
        relative_path: '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/artifacts/report.json',
        required: true,
        media_type: 'application/json',
      },
    ],
  }

  const invalidRequest = structuredClone(request)
  invalidRequest.exchange.stdout_file = '.orchestrator/runs/batch-0226/ops_tasks/ops-task-002/output.txt'
  check(validateRequest(invalidRequest) === false, 'request rejects non-canonical stdout path')

  const invalidPass = {
    schema_version: 'ops_task_result.v1',
    task_kind: 'ops_task',
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: 1,
    status: 'pass',
    failure_kind: 'nonzero_exit',
    summary: 'broken pass payload',
    exit_code: 1,
    executor: {
      executor_class: 'ops_capable',
      bridge_channel: 'ops_task_bridge',
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
    started_at: '2026-03-24T03:30:01.000Z',
    completed_at: '2026-03-24T03:30:10.000Z',
    stdout_file: request.exchange.stdout_file,
    stderr_file: request.exchange.stderr_file,
    artifacts: [],
  }
  check(validateResult(invalidPass, request) === false, 'result rejects pass payload with failure_kind/nonzero exit')

  const missingArtifactPass = {
    schema_version: 'ops_task_result.v1',
    task_kind: 'ops_task',
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: 1,
    status: 'pass',
    failure_kind: 'none',
    summary: 'required artifacts missing',
    exit_code: 0,
    executor: {
      executor_class: 'ops_capable',
      bridge_channel: 'ops_task_bridge',
      executor_id: 'mock-ops-executor',
      mode: 'mock',
    },
    started_at: '2026-03-24T03:30:01.000Z',
    completed_at: '2026-03-24T03:30:10.000Z',
    stdout_file: request.exchange.stdout_file,
    stderr_file: request.exchange.stderr_file,
    artifacts: [],
  }
  check(validateResult(missingArtifactPass, request) === false, 'pass result requires required artifacts')
}

function main() {
  process.stderr.write('== Ops Task Contract Tests ==\n')

  testSchemaFilesParse()
  testSchemaShape()
  testPositiveSamples()
  testNegativeSamples()

  process.stderr.write(`\n== Results: ${passed} passed, ${failed} failed ==\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
