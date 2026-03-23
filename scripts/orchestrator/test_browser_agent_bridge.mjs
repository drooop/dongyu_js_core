#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

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
    schema_version: 'browser_task_request.v1',
    task_kind: 'browser_task',
    batch_id: batchId,
    iteration_id: '0219-orchestrator-browser-agent-bridge',
    task_id: taskId,
    attempt: 1,
    created_at: '2026-03-23T09:00:00.000Z',
    executor: {
      executor_class: 'browser_capable',
      bridge_channel: 'browser_task_bridge',
      executor_id: 'mock-browser-agent',
      mode: 'mock',
    },
    exchange: {
      request_file: `.orchestrator/runs/${batchId}/browser_tasks/${taskId}/request.json`,
      result_file: `.orchestrator/runs/${batchId}/browser_tasks/${taskId}/result.json`,
      task_dir: `.orchestrator/runs/${batchId}/browser_tasks/${taskId}`,
    },
    objective: {
      summary: 'Produce deterministic exchange evidence.',
      start_url: 'http://127.0.0.1:30900/',
      instructions: [
        'Read the request from the canonical exchange path.',
        'Write a contract-valid result.',
      ],
      success_assertions: [
        'result.json exists under the task exchange directory',
        'required artifacts remain under output/playwright',
      ],
    },
    timeout_ms: 30_000,
    required_artifacts: [
      {
        artifact_kind: 'screenshot',
        relative_path: `output/playwright/${batchId}/${taskId}/final.png`,
        required: true,
        media_type: 'image/png',
      },
      {
        artifact_kind: 'json',
        relative_path: `output/playwright/${batchId}/${taskId}/report.json`,
        required: true,
        media_type: 'application/json',
      },
    ],
  }
}

function samplePassResult(request) {
  return {
    schema_version: 'browser_task_result.v1',
    task_kind: 'browser_task',
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'pass',
    failure_kind: 'none',
    summary: 'Bridge helper wrote the canonical result and short-circuited duplicates.',
    executor: structuredClone(request.executor),
    started_at: '2026-03-23T09:00:01.000Z',
    completed_at: '2026-03-23T09:00:02.000Z',
    artifacts: request.required_artifacts.map((artifact, index) => ({
      ...artifact,
      bytes: 128 * (index + 1),
      sha256: String.fromCharCode(97 + index).repeat(64),
      producer: {
        actor: 'browser_executor',
        executor_id: request.executor.executor_id,
      },
    })),
  }
}

async function runExchangeCase() {
  process.stderr.write('\n== Browser Agent Bridge Test 1: exchange helpers ==\n')

  const batchId = 'test-browser-bridge-step1'
  const taskId = 'browser-task-exchange'
  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)

  const bridge = await import('./browser_bridge.mjs')
  const paths = bridge.deriveBrowserTaskPaths(batchId, taskId)

  check(paths.requestFileRelative === `.orchestrator/runs/${batchId}/browser_tasks/${taskId}/request.json`,
    'deriveBrowserTaskPaths returns canonical request.json path')
  check(paths.resultFileRelative === `.orchestrator/runs/${batchId}/browser_tasks/${taskId}/result.json`,
    'deriveBrowserTaskPaths returns canonical result.json path')
  check(paths.artifactsDirRelative === `output/playwright/${batchId}/${taskId}`,
    'deriveBrowserTaskPaths returns canonical output/playwright path')

  const request = sampleRequest(batchId, taskId)
  mkdirSync(dirname(repoPath(request.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(request.exchange.request_file), JSON.stringify(request, null, 2))

  const loaded = bridge.loadBrowserTaskRequest({ batchId, taskId })
  check(loaded.request.task_id === taskId, 'loadBrowserTaskRequest reads canonical request.json')
  check(loaded.paths.taskDirRelative === request.exchange.task_dir,
    'loadBrowserTaskRequest returns canonical task_dir metadata')

  const result = samplePassResult(loaded.request)
  const firstWrite = bridge.writeBrowserTaskResult({ request: loaded.request, result })
  check(firstWrite.status === 'written', 'writeBrowserTaskResult writes the first canonical result.json')
  check(existsSync(repoPath(request.exchange.result_file)), 'result.json exists after first write')

  const persisted = JSON.parse(readFileSync(repoPath(request.exchange.result_file), 'utf8'))
  check(persisted.summary === result.summary, 'persisted result keeps original summary')

  const secondWrite = bridge.writeBrowserTaskResult({
    request: loaded.request,
    result: { ...result, summary: 'should not overwrite existing completed result' },
  })
  check(secondWrite.status === 'existing_result', 'duplicate write short-circuits on existing completed result')

  const afterDuplicate = JSON.parse(readFileSync(repoPath(request.exchange.result_file), 'utf8'))
  check(afterDuplicate.summary === result.summary, 'duplicate short-circuit preserves first completed result')

  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)
}

async function runMockExecutorCase() {
  process.stderr.write('\n== Browser Agent Bridge Test 2: mock executor ==\n')

  const batchId = 'test-browser-bridge-step2-mock'
  const taskId = 'browser-task-mock'
  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)

  const bridge = await import('./browser_bridge.mjs')
  const agent = await import('./browser_agent.mjs')
  const request = sampleRequest(batchId, taskId)

  mkdirSync(dirname(repoPath(request.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(request.exchange.request_file), JSON.stringify(request, null, 2))

  const outcome = agent.consumeOneBrowserTask({
    batchId,
    consumerId: 'mock-consumer-step2',
  })

  check(outcome.status === 'completed', 'consumeOneBrowserTask completes one mock request')
  check(outcome.result.status === 'pass', 'mock executor writes pass result')
  check(outcome.result.failure_kind === 'none', 'mock executor keeps failure_kind=none on pass')

  for (const artifact of request.required_artifacts) {
    check(existsSync(repoPath(artifact.relative_path)), `mock executor materializes ${artifact.relative_path}`)
  }

  const persisted = bridge.loadBrowserTaskResult({ request })
  check(Boolean(persisted), 'mock executor persists canonical result.json')
  check(bridge.verifyArtifactsOnDisk(persisted.result, request).ok, 'mock executor result manifest matches files on disk')

  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)
}

async function runConsumerBoundaryCase() {
  process.stderr.write('\n== Browser Agent Bridge Test 3: consumer boundary ==\n')

  const batchId = 'test-browser-bridge-step2-boundary'
  const taskId = 'browser-task-mcp'
  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)

  const bridge = await import('./browser_bridge.mjs')
  const agent = await import('./browser_agent.mjs')
  const request = sampleRequest(batchId, taskId)
  request.executor.mode = 'mcp'
  request.executor.executor_id = 'mcp-browser-agent'

  mkdirSync(dirname(repoPath(request.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(request.exchange.request_file), JSON.stringify(request, null, 2))

  const pending = agent.findPendingBrowserTask({ batchId })
  check(pending?.request?.task_id === taskId, 'findPendingBrowserTask discovers one pending browser task')

  const outcome = agent.consumeOneBrowserTask({
    batchId,
    consumerId: 'boundary-consumer-step2',
  })

  check(outcome.status === 'completed', 'consumer boundary completes with explicit failure result when mcp is unavailable')
  check(outcome.result.status === 'fail', 'mcp mode does not silently degrade to pass')
  check(outcome.result.failure_kind === 'mcp_unavailable', 'mcp mode reports mcp_unavailable explicitly')
  check(existsSync(repoPath(request.exchange.result_file)), 'consumer boundary persists canonical fail result')
  check(!existsSync(repoPath(`output/playwright/${batchId}/${taskId}`)),
    'mcp unavailable path does not fabricate output/playwright artifacts')

  const persisted = bridge.loadBrowserTaskResult({ request })
  check(persisted.result.failure_kind === 'mcp_unavailable', 'persisted result keeps mcp_unavailable taxonomy')

  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)
}

async function runIdempotentReplayCase() {
  process.stderr.write('\n== Browser Agent Bridge Test 4: idempotent replay ==\n')

  const batchId = 'test-browser-bridge-step3-replay'
  const taskId = 'browser-task-replay'
  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)

  const agent = await import('./browser_agent.mjs')
  const request = sampleRequest(batchId, taskId)

  mkdirSync(dirname(repoPath(request.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(request.exchange.request_file), JSON.stringify(request, null, 2))

  const first = agent.consumeOneBrowserTask({
    batchId,
    consumerId: 'replay-consumer-first',
  })
  check(first.status === 'completed', 'first replay attempt completes the task')
  check(first.result.status === 'pass', 'first replay attempt writes a pass result')

  const second = agent.consumeOneBrowserTask({
    batchId,
    consumerId: 'replay-consumer-second',
  })
  check(second.status === 'completed', 'replay returns completed instead of creating a second task result')
  check(second.reused_existing_result === true, 'replay reuses the existing completed result')
  check(second.result.summary === first.result.summary, 'replay preserves the original successful result payload')

  clean(`.orchestrator/runs/${batchId}`)
  clean(`output/playwright/${batchId}`)
}

async function runDuplicateAndStaleCase() {
  process.stderr.write('\n== Browser Agent Bridge Test 5: duplicate and stale conflicts ==\n')

  const bridge = await import('./browser_bridge.mjs')
  const agent = await import('./browser_agent.mjs')

  const staleBatchId = 'test-browser-bridge-step3-stale'
  const staleTaskId = 'browser-task-stale'
  clean(`.orchestrator/runs/${staleBatchId}`)
  clean(`output/playwright/${staleBatchId}`)
  const staleRequest = sampleRequest(staleBatchId, staleTaskId)
  const stalePaths = bridge.deriveBrowserTaskPaths(staleBatchId, staleTaskId)
  mkdirSync(dirname(repoPath(staleRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(staleRequest.exchange.request_file), JSON.stringify(staleRequest, null, 2))
  writeFileSync(repoPath(stalePaths.claimFileRelative), JSON.stringify({
    task_kind: 'browser_task',
    batch_id: staleBatchId,
    task_id: staleTaskId,
    attempt: 1,
    consumer_id: 'old-consumer',
    claimed_at: '2000-01-01T00:00:00.000Z',
  }, null, 2))

  const staleOutcome = agent.consumeOneBrowserTask({
    batchId: staleBatchId,
    consumerId: 'stale-recovery-consumer',
  })
  check(staleOutcome.status === 'completed', 'stale claim is recovered and task completes')
  check(staleOutcome.recovered_failure_kind === 'stale_result', 'stale claim recovery is reported as stale_result')

  const duplicateBatchId = 'test-browser-bridge-step3-duplicate'
  const duplicateTaskId = 'browser-task-duplicate'
  clean(`.orchestrator/runs/${duplicateBatchId}`)
  clean(`output/playwright/${duplicateBatchId}`)
  const duplicateRequest = sampleRequest(duplicateBatchId, duplicateTaskId)
  const duplicatePaths = bridge.deriveBrowserTaskPaths(duplicateBatchId, duplicateTaskId)
  mkdirSync(dirname(repoPath(duplicateRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(duplicateRequest.exchange.request_file), JSON.stringify(duplicateRequest, null, 2))
  writeFileSync(repoPath(duplicatePaths.claimFileRelative), JSON.stringify({
    task_kind: 'browser_task',
    batch_id: duplicateBatchId,
    task_id: duplicateTaskId,
    attempt: 1,
    consumer_id: 'active-consumer',
    claimed_at: new Date().toISOString(),
  }, null, 2))

  const duplicateOutcome = agent.consumeOneBrowserTask({
    batchId: duplicateBatchId,
    consumerId: 'duplicate-consumer',
  })
  check(duplicateOutcome.status === 'claimed_elsewhere', 'fresh claim blocks duplicate consumer completion')
  check(duplicateOutcome.failure_kind === 'duplicate_result', 'duplicate consumer path uses duplicate_result taxonomy')

  const invalidRequestBatchId = 'test-browser-bridge-step3-invalid-request'
  const invalidRequestTaskId = 'browser-task-invalid-request'
  clean(`.orchestrator/runs/${invalidRequestBatchId}`)
  clean(`output/playwright/${invalidRequestBatchId}`)
  const invalidRequest = sampleRequest(invalidRequestBatchId, invalidRequestTaskId)
  delete invalidRequest.task_id
  mkdirSync(dirname(repoPath(`.orchestrator/runs/${invalidRequestBatchId}/browser_tasks/${invalidRequestTaskId}/request.json`)), { recursive: true })
  writeFileSync(repoPath(`.orchestrator/runs/${invalidRequestBatchId}/browser_tasks/${invalidRequestTaskId}/request.json`),
    JSON.stringify(invalidRequest, null, 2))

  const invalidRequestOutcome = agent.consumeOneBrowserTask({
    batchId: invalidRequestBatchId,
    consumerId: 'invalid-request-consumer',
  })
  check(invalidRequestOutcome.failure_kind === 'request_invalid', 'invalid request path uses request_invalid taxonomy')

  const invalidResultBatchId = 'test-browser-bridge-step3-invalid-result'
  const invalidResultTaskId = 'browser-task-invalid-result'
  clean(`.orchestrator/runs/${invalidResultBatchId}`)
  clean(`output/playwright/${invalidResultBatchId}`)
  const invalidResultRequest = sampleRequest(invalidResultBatchId, invalidResultTaskId)
  mkdirSync(dirname(repoPath(invalidResultRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(invalidResultRequest.exchange.request_file), JSON.stringify(invalidResultRequest, null, 2))
  const invalidPersistedResult = samplePassResult(invalidResultRequest)
  invalidPersistedResult.status = 'fail'
  invalidPersistedResult.failure_kind = 'none'
  writeFileSync(repoPath(invalidResultRequest.exchange.result_file), JSON.stringify(invalidPersistedResult, null, 2))

  const invalidResultOutcome = agent.consumeOneBrowserTask({
    batchId: invalidResultBatchId,
    consumerId: 'invalid-result-consumer',
  })
  check(invalidResultOutcome.failure_kind === 'result_invalid', 'invalid persisted result uses result_invalid taxonomy')

  const mismatchBatchId = 'test-browser-bridge-step3-mismatch'
  const mismatchTaskId = 'browser-task-mismatch'
  clean(`.orchestrator/runs/${mismatchBatchId}`)
  clean(`output/playwright/${mismatchBatchId}`)
  const mismatchRequest = sampleRequest(mismatchBatchId, mismatchTaskId)
  mkdirSync(dirname(repoPath(mismatchRequest.exchange.request_file)), { recursive: true })
  writeFileSync(repoPath(mismatchRequest.exchange.request_file), JSON.stringify(mismatchRequest, null, 2))
  const mismatchFirst = agent.consumeOneBrowserTask({
    batchId: mismatchBatchId,
    consumerId: 'mismatch-first-consumer',
  })
  writeFileSync(repoPath(mismatchRequest.required_artifacts[0].relative_path), 'corrupted-artifact')

  const mismatchReplay = agent.consumeOneBrowserTask({
    batchId: mismatchBatchId,
    consumerId: 'mismatch-second-consumer',
  })
  check(mismatchFirst.result.status === 'pass', 'artifact mismatch fixture starts from an existing successful result')
  check(mismatchReplay.failure_kind === 'artifact_mismatch', 'artifact manifest conflict uses artifact_mismatch taxonomy')

  clean(`.orchestrator/runs/${staleBatchId}`)
  clean(`output/playwright/${staleBatchId}`)
  clean(`.orchestrator/runs/${duplicateBatchId}`)
  clean(`output/playwright/${duplicateBatchId}`)
  clean(`.orchestrator/runs/${invalidRequestBatchId}`)
  clean(`output/playwright/${invalidRequestBatchId}`)
  clean(`.orchestrator/runs/${invalidResultBatchId}`)
  clean(`output/playwright/${invalidResultBatchId}`)
  clean(`.orchestrator/runs/${mismatchBatchId}`)
  clean(`output/playwright/${mismatchBatchId}`)
}

const CASES = {
  exchange: runExchangeCase,
  'mock-executor': runMockExecutorCase,
  'consumer-boundary': runConsumerBoundaryCase,
  'idempotent-replay': runIdempotentReplayCase,
  'duplicate-and-stale': runDuplicateAndStaleCase,
}

async function main() {
  process.stderr.write('== Browser Agent Bridge Tests ==\n')

  const caseName = process.argv.includes('--case')
    ? process.argv[process.argv.indexOf('--case') + 1]
    : 'all'

  try {
    if (caseName === 'all') {
      for (const testCase of Object.values(CASES)) {
        await testCase()
      }
    } else {
      assert(CASES[caseName], `Unknown test case: ${caseName}`)
      await CASES[caseName]()
    }
  } catch (error) {
    failed++
    process.stderr.write(`  FAIL: unexpected exception: ${error.message}\n`)
  }

  process.stderr.write(`\n== Results: ${passed} passed, ${failed} failed ==\n`)
  if (failed > 0) {
    process.exit(1)
  }
}

await main()
