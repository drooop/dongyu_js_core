#!/usr/bin/env bun

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REQUEST_SCHEMA_FILE = join(process.cwd(), 'scripts/orchestrator/schemas/browser_task_request.json')
const RESULT_SCHEMA_FILE = join(process.cwd(), 'scripts/orchestrator/schemas/browser_task_result.json')

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
  const raw = readFileSync(file, 'utf8')
  return JSON.parse(raw)
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function validateExecutor(executor) {
  if (!executor || typeof executor !== 'object') return false
  if (executor.executor_class !== 'browser_capable') return false
  if (executor.bridge_channel !== 'browser_task_bridge') return false
  if (!['mock', 'mcp'].includes(executor.mode)) return false
  return typeof executor.executor_id === 'string' && executor.executor_id.length > 0
}

function validateRequestArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') return false
  if (!['screenshot', 'json', 'trace', 'console'].includes(artifact.artifact_kind)) return false
  if (typeof artifact.relative_path !== 'string' || !artifact.relative_path.startsWith('output/playwright/')) return false
  if (typeof artifact.required !== 'boolean') return false
  return typeof artifact.media_type === 'string' && artifact.media_type.length > 0
}

function validateResultArtifact(artifact) {
  if (!validateRequestArtifact(artifact)) return false
  if (!artifact.producer || typeof artifact.producer !== 'object') return false
  if (artifact.producer.actor !== 'browser_executor') return false
  if (typeof artifact.producer.executor_id !== 'string' || artifact.producer.executor_id.length === 0) return false
  if (typeof artifact.bytes !== 'number' || artifact.bytes < 0) return false
  return typeof artifact.sha256 === 'string' && artifact.sha256.length > 0
}

function validateRequest(request) {
  if (!request || typeof request !== 'object') return false
  if (request.schema_version !== 'browser_task_request.v1') return false
  if (request.task_kind !== 'browser_task') return false
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
  if (!request.objective || typeof request.objective !== 'object') return false
  if (typeof request.objective.summary !== 'string' || request.objective.summary.length === 0) return false
  if (!Array.isArray(request.objective.instructions) || request.objective.instructions.length === 0) return false
  if (!Array.isArray(request.objective.success_assertions) || request.objective.success_assertions.length === 0) return false
  if (typeof request.timeout_ms !== 'number' || request.timeout_ms <= 0) return false
  if (!Array.isArray(request.required_artifacts) || request.required_artifacts.length === 0) return false
  return request.required_artifacts.every(validateRequestArtifact)
}

function validateResult(result, request) {
  if (!result || typeof result !== 'object') return false
  if (result.schema_version !== 'browser_task_result.v1') return false
  if (result.task_kind !== 'browser_task') return false
  if (result.batch_id !== request.batch_id) return false
  if (result.iteration_id !== request.iteration_id) return false
  if (result.task_id !== request.task_id) return false
  if (result.attempt !== request.attempt) return false
  if (!['pass', 'fail'].includes(result.status)) return false
  if (!isIsoTimestamp(result.started_at) || !isIsoTimestamp(result.completed_at)) return false
  if (!validateExecutor(result.executor)) return false
  if (typeof result.summary !== 'string' || result.summary.length === 0) return false
  if (!Array.isArray(result.artifacts)) return false
  if (!result.artifacts.every(validateResultArtifact)) return false

  const requiredArtifactPaths = new Set(
    request.required_artifacts
      .filter(artifact => artifact.required)
      .map(artifact => artifact.relative_path)
  )
  const producedArtifactPaths = new Set(result.artifacts.map(artifact => artifact.relative_path))

  if (result.status === 'pass') {
    if (result.failure_kind !== 'none') return false
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
  process.stderr.write('\n== Browser Task Contract Test 1: schema files parse ==\n')

  check(existsSync(REQUEST_SCHEMA_FILE), 'browser_task_request.json exists')
  check(existsSync(RESULT_SCHEMA_FILE), 'browser_task_result.json exists')

  const requestSchema = loadJson(REQUEST_SCHEMA_FILE)
  const resultSchema = loadJson(RESULT_SCHEMA_FILE)

  check(requestSchema.title === 'Browser Task Request v1', 'request schema title frozen')
  check(resultSchema.title === 'Browser Task Result v1', 'result schema title frozen')
}

function testSchemaShape() {
  process.stderr.write('\n== Browser Task Contract Test 2: schema shape ==\n')

  const requestSchema = loadJson(REQUEST_SCHEMA_FILE)
  const resultSchema = loadJson(RESULT_SCHEMA_FILE)

  const requestRequired = requestSchema.required || []
  const resultRequired = resultSchema.required || []
  const requestArtifactEnum = requestSchema.properties?.required_artifacts?.items?.properties?.artifact_kind?.enum || []
  const failureKindEnum = resultSchema.properties?.failure_kind?.enum || []
  const executorModeEnum = resultSchema.properties?.executor?.properties?.mode?.enum || []
  const expectedFailureKinds = [
    'request_invalid',
    'executor_unavailable',
    'mcp_unavailable',
    'timeout',
    'cancelled',
    'result_invalid',
    'artifact_missing',
    'artifact_mismatch',
    'stale_result',
    'duplicate_result',
    'ingest_failed',
    'browser_bridge_not_proven',
  ]

  check(requestRequired.includes('batch_id'), 'request schema requires batch_id')
  check(requestRequired.includes('iteration_id'), 'request schema requires iteration_id')
  check(requestRequired.includes('task_id'), 'request schema requires task_id')
  check(requestRequired.includes('required_artifacts'), 'request schema requires required_artifacts')
  check(requestSchema.properties?.exchange?.properties?.request_file?.pattern?.includes('\\.orchestrator/runs/'),
    'request schema freezes batch-local exchange path')
  check(requestArtifactEnum.includes('screenshot'), 'request artifact enum includes screenshot')
  check(requestArtifactEnum.includes('json'), 'request artifact enum includes json')
  check(requestArtifactEnum.includes('trace'), 'request artifact enum includes trace')
  check(requestArtifactEnum.includes('console'), 'request artifact enum includes console')

  check(resultRequired.includes('status'), 'result schema requires status')
  check(resultRequired.includes('failure_kind'), 'result schema requires failure_kind')
  check(resultRequired.includes('artifacts'), 'result schema requires artifacts')
  for (const failureKind of expectedFailureKinds) {
    check(failureKindEnum.includes(failureKind), `result schema includes ${failureKind} failure kind`)
  }
  check(executorModeEnum.includes('mock'), 'result executor mode includes mock')
  check(executorModeEnum.includes('mcp'), 'result executor mode includes mcp')
}

function testPositiveSamples() {
  process.stderr.write('\n== Browser Task Contract Test 3: positive samples ==\n')

  const request = {
    schema_version: 'browser_task_request.v1',
    task_kind: 'browser_task',
    batch_id: 'batch-0218',
    iteration_id: '0218-orchestrator-browser-task-contract-freeze',
    task_id: 'browser-task-001',
    attempt: 1,
    created_at: '2026-03-23T05:00:00.000Z',
    executor: {
      executor_class: 'browser_capable',
      bridge_channel: 'browser_task_bridge',
      executor_id: 'mock-browser-executor',
      mode: 'mock',
    },
    exchange: {
      request_file: '.orchestrator/runs/batch-0218/browser_tasks/browser-task-001/request.json',
      result_file: '.orchestrator/runs/batch-0218/browser_tasks/browser-task-001/result.json',
      task_dir: '.orchestrator/runs/batch-0218/browser_tasks/browser-task-001',
    },
    objective: {
      summary: 'Open the target page and capture deterministic evidence.',
      start_url: 'http://127.0.0.1:30900/',
      instructions: [
        'Navigate to the start_url.',
        'Wait for the primary workspace shell to render.',
        'Capture the required artifacts.',
      ],
      success_assertions: [
        'workspace shell is visible',
        'required artifacts exist on disk',
      ],
    },
    timeout_ms: 30000,
    required_artifacts: [
      {
        artifact_kind: 'screenshot',
        relative_path: 'output/playwright/batch-0218/browser-task-001/final.png',
        required: true,
        media_type: 'image/png',
      },
      {
        artifact_kind: 'json',
        relative_path: 'output/playwright/batch-0218/browser-task-001/report.json',
        required: true,
        media_type: 'application/json',
      },
      {
        artifact_kind: 'trace',
        relative_path: 'output/playwright/batch-0218/browser-task-001/trace.zip',
        required: false,
        media_type: 'application/zip',
      },
      {
        artifact_kind: 'console',
        relative_path: 'output/playwright/batch-0218/browser-task-001/console.json',
        required: false,
        media_type: 'application/json',
      },
    ],
  }

  const result = {
    schema_version: 'browser_task_result.v1',
    task_kind: 'browser_task',
    batch_id: 'batch-0218',
    iteration_id: '0218-orchestrator-browser-task-contract-freeze',
    task_id: 'browser-task-001',
    attempt: 1,
    status: 'pass',
    failure_kind: 'none',
    summary: 'Browser executor completed the task and produced all required artifacts.',
    executor: {
      executor_class: 'browser_capable',
      bridge_channel: 'browser_task_bridge',
      executor_id: 'mock-browser-executor',
      mode: 'mock',
    },
    started_at: '2026-03-23T05:00:01.000Z',
    completed_at: '2026-03-23T05:00:12.000Z',
    artifacts: [
      {
        artifact_kind: 'screenshot',
        relative_path: 'output/playwright/batch-0218/browser-task-001/final.png',
        required: true,
        media_type: 'image/png',
        bytes: 2048,
        sha256: 'a'.repeat(64),
        producer: {
          actor: 'browser_executor',
          executor_id: 'mock-browser-executor',
        },
      },
      {
        artifact_kind: 'json',
        relative_path: 'output/playwright/batch-0218/browser-task-001/report.json',
        required: true,
        media_type: 'application/json',
        bytes: 512,
        sha256: 'b'.repeat(64),
        producer: {
          actor: 'browser_executor',
          executor_id: 'mock-browser-executor',
        },
      },
      {
        artifact_kind: 'trace',
        relative_path: 'output/playwright/batch-0218/browser-task-001/trace.zip',
        required: false,
        media_type: 'application/zip',
        bytes: 4096,
        sha256: 'c'.repeat(64),
        producer: {
          actor: 'browser_executor',
          executor_id: 'mock-browser-executor',
        },
      },
      {
        artifact_kind: 'console',
        relative_path: 'output/playwright/batch-0218/browser-task-001/console.json',
        required: false,
        media_type: 'application/json',
        bytes: 128,
        sha256: 'd'.repeat(64),
        producer: {
          actor: 'browser_executor',
          executor_id: 'mock-browser-executor',
        },
      },
    ],
  }

  check(validateRequest(request), 'positive request sample passes contract validation')
  check(validateResult(result, request), 'positive result sample passes contract validation')
}

function testNegativeSamples() {
  process.stderr.write('\n== Browser Task Contract Test 4: negative samples ==\n')

  const validRequest = {
    schema_version: 'browser_task_request.v1',
    task_kind: 'browser_task',
    batch_id: 'batch-0218',
    iteration_id: '0218-orchestrator-browser-task-contract-freeze',
    task_id: 'browser-task-002',
    attempt: 1,
    created_at: '2026-03-23T05:10:00.000Z',
    executor: {
      executor_class: 'browser_capable',
      bridge_channel: 'browser_task_bridge',
      executor_id: 'mock-browser-executor',
      mode: 'mock',
    },
    exchange: {
      request_file: '.orchestrator/runs/batch-0218/browser_tasks/browser-task-002/request.json',
      result_file: '.orchestrator/runs/batch-0218/browser_tasks/browser-task-002/result.json',
      task_dir: '.orchestrator/runs/batch-0218/browser_tasks/browser-task-002',
    },
    objective: {
      summary: 'Collect evidence.',
      start_url: 'http://127.0.0.1:30900/',
      instructions: ['Navigate to the app.'],
      success_assertions: ['evidence is present'],
    },
    timeout_ms: 30000,
    required_artifacts: [
      {
        artifact_kind: 'screenshot',
        relative_path: 'output/playwright/batch-0218/browser-task-002/final.png',
        required: true,
        media_type: 'image/png',
      },
      {
        artifact_kind: 'json',
        relative_path: 'output/playwright/batch-0218/browser-task-002/report.json',
        required: true,
        media_type: 'application/json',
      },
    ],
  }

  const invalidRequest = structuredClone(validRequest)
  delete invalidRequest.task_id
  invalidRequest.required_artifacts[0].relative_path = '.orchestrator/runs/batch-0218/browser_tasks/browser-task-002/final.png'

  const invalidResult = {
    schema_version: 'browser_task_result.v1',
    task_kind: 'browser_task',
    batch_id: 'batch-0218',
    iteration_id: '0218-orchestrator-browser-task-contract-freeze',
    task_id: 'browser-task-002',
    attempt: 1,
    status: 'pass',
    failure_kind: 'none',
    summary: 'Claims success without required artifacts.',
    executor: {
      executor_class: 'browser_capable',
      bridge_channel: 'browser_task_bridge',
      executor_id: 'mock-browser-executor',
      mode: 'mock',
    },
    started_at: '2026-03-23T05:10:01.000Z',
    completed_at: '2026-03-23T05:10:05.000Z',
    artifacts: [
      {
        artifact_kind: 'json',
        relative_path: 'output/playwright/batch-0218/browser-task-002/report.json',
        required: true,
        media_type: 'application/json',
        bytes: 512,
        sha256: 'e'.repeat(64),
        producer: {
          actor: 'browser_executor',
          executor_id: 'mock-browser-executor',
        },
      },
    ],
  }

  const validFailResult = {
    schema_version: 'browser_task_result.v1',
    task_kind: 'browser_task',
    batch_id: 'batch-0218',
    iteration_id: '0218-orchestrator-browser-task-contract-freeze',
    task_id: 'browser-task-002',
    attempt: 1,
    status: 'fail',
    failure_kind: 'artifact_missing',
    summary: 'Executor returned a result but required screenshot was missing.',
    executor: {
      executor_class: 'browser_capable',
      bridge_channel: 'browser_task_bridge',
      executor_id: 'mock-browser-executor',
      mode: 'mock',
    },
    started_at: '2026-03-23T05:10:01.000Z',
    completed_at: '2026-03-23T05:10:05.000Z',
    artifacts: [
      {
        artifact_kind: 'json',
        relative_path: 'output/playwright/batch-0218/browser-task-002/report.json',
        required: true,
        media_type: 'application/json',
        bytes: 512,
        sha256: 'f'.repeat(64),
        producer: {
          actor: 'browser_executor',
          executor_id: 'mock-browser-executor',
        },
      },
    ],
  }

  check(validateRequest(invalidRequest) === false, 'request missing identity / wrong artifact path is rejected')
  check(validateResult(invalidResult, validRequest) === false, 'pass result missing required screenshot is rejected')
  check(validateResult(validFailResult, validRequest), 'fail result with artifact_missing is accepted')
}

function main() {
  process.stderr.write('== Browser Task Contract Tests ==\n')

  try {
    testSchemaFilesParse()
    testSchemaShape()
    testPositiveSamples()
    testNegativeSamples()
  } catch (error) {
    failed++
    process.stderr.write(`  FAIL: unexpected exception: ${error.message}\n`)
  }

  process.stderr.write(`\n== Results: ${passed} passed, ${failed} failed ==\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

main()
