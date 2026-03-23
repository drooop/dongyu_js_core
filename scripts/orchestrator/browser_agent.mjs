#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  BrowserBridgeError,
  BROWSER_TASK_KIND,
  BROWSER_TASK_RESULT_SCHEMA_VERSION,
  computeArtifactDigest,
  createBrowserTaskFailureResult,
  deriveBrowserTaskPaths,
  loadBrowserTaskRequest,
  loadBrowserTaskResult,
  readBrowserTaskClaim,
  removeBrowserTaskClaim,
  validateBrowserTaskRequest,
  verifyArtifactsOnDisk,
  writeBrowserTaskResult,
} from './browser_bridge.mjs'

function parseArgs(argv) {
  const args = {
    batchId: null,
    taskId: null,
    consumerId: 'browser-agent',
    rootDir: process.cwd(),
  }

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '--batch-id') args.batchId = argv[++index] || null
    if (token === '--task-id') args.taskId = argv[++index] || null
    if (token === '--consumer-id') args.consumerId = argv[++index] || args.consumerId
    if (token === '--root-dir') args.rootDir = argv[++index] || args.rootDir
  }

  return args
}

function browserTasksRoot(batchId, rootDir = process.cwd()) {
  return join(rootDir, '.orchestrator', 'runs', batchId, 'browser_tasks')
}

function listTaskIds(batchId, rootDir = process.cwd()) {
  const root = browserTasksRoot(batchId, rootDir)
  if (!existsSync(root)) {
    return []
  }

  return readdirSync(root)
    .filter(taskId => statSync(join(root, taskId)).isDirectory())
    .sort()
}

function claimPayload(request, consumerId) {
  return {
    task_kind: BROWSER_TASK_KIND,
    batch_id: request.batch_id,
    task_id: request.task_id,
    attempt: request.attempt,
    consumer_id: consumerId,
    claimed_at: new Date().toISOString(),
  }
}

function writeExclusiveJson(file, payload) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(payload, null, 2), { flag: 'wx' })
}

function artifactContent(request, artifact, consumerId) {
  const header = [
    `task=${request.task_id}`,
    `batch=${request.batch_id}`,
    `consumer=${consumerId}`,
    `artifact=${artifact.artifact_kind}`,
    `mode=${request.executor.mode}`,
  ].join('\n')

  if (artifact.artifact_kind === 'json' || artifact.artifact_kind === 'console') {
    return JSON.stringify({
      task_id: request.task_id,
      batch_id: request.batch_id,
      consumer_id: consumerId,
      artifact_kind: artifact.artifact_kind,
      mode: request.executor.mode,
    }, null, 2)
  }

  return `${header}\n`
}

function buildPassResult(request, artifacts, timestamps) {
  return {
    schema_version: BROWSER_TASK_RESULT_SCHEMA_VERSION,
    task_kind: BROWSER_TASK_KIND,
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'pass',
    failure_kind: 'none',
    summary: 'Browser Agent mock executor produced all required artifacts.',
    executor: { ...request.executor },
    started_at: timestamps.started_at,
    completed_at: timestamps.completed_at,
    artifacts,
  }
}

export function claimBrowserTask({ request, consumerId, rootDir = process.cwd() }) {
  const validation = validateBrowserTaskRequest(request, { rootDir })
  if (!validation.ok) {
    throw new BrowserBridgeError(validation.failureKind, validation.reason, { request })
  }

  const existingResult = loadBrowserTaskResult({ request, rootDir })
  if (existingResult) {
    return {
      status: 'existing_result',
      result: existingResult.result,
      paths: existingResult.paths,
    }
  }

  const paths = validation.paths
  const payload = claimPayload(request, consumerId)

  try {
    writeExclusiveJson(paths.claimFile, payload)
    return {
      status: 'claimed',
      claim: payload,
      paths,
    }
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return {
        status: 'claim_exists',
        ...(readBrowserTaskClaim({ request, rootDir }) || { claim: null, paths }),
      }
    }
    throw error
  }
}

export function releaseBrowserTaskClaim({ request, batchId, taskId, rootDir = process.cwd() }) {
  return removeBrowserTaskClaim({ request, batchId, taskId, rootDir })
}

export function findPendingBrowserTask({ batchId, taskId = null, rootDir = process.cwd() }) {
  const candidateIds = taskId ? [taskId] : listTaskIds(batchId, rootDir)

  for (const candidateTaskId of candidateIds) {
    const paths = deriveBrowserTaskPaths(batchId, candidateTaskId, { rootDir })
    if (!existsSync(paths.requestFile)) {
      continue
    }

    try {
      const loaded = loadBrowserTaskRequest({
        batchId,
        taskId: candidateTaskId,
        rootDir,
      })
      const existingResult = loadBrowserTaskResult({ request: loaded.request, rootDir })
      if (existingResult) {
        continue
      }

      return loaded
    } catch (error) {
      return {
        request: null,
        paths,
        error,
      }
    }
  }

  return null
}

export function runMockBrowserExecutor({ request, consumerId, rootDir = process.cwd() }) {
  const paths = deriveBrowserTaskPaths(request.batch_id, request.task_id, { rootDir })
  mkdirSync(paths.artifactsDir, { recursive: true })

  const startedAt = new Date().toISOString()
  const artifacts = request.required_artifacts.map(artifact => {
    const absolutePath = join(rootDir, artifact.relative_path)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, artifactContent(request, artifact, consumerId))

    const digest = computeArtifactDigest(absolutePath)
    return {
      ...artifact,
      bytes: digest.bytes,
      sha256: digest.sha256,
      producer: {
        actor: 'browser_executor',
        executor_id: request.executor.executor_id,
      },
    }
  })

  return buildPassResult(request, artifacts, {
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  })
}

export function executeBrowserTask({ request, consumerId, rootDir = process.cwd() }) {
  if (request.executor.mode === 'mcp') {
    const failResult = createBrowserTaskFailureResult(
      request,
      'mcp_unavailable',
      'Browser Agent requires an explicit MCP-backed executor; no MCP executor is available in 0219.'
    )
    return writeBrowserTaskResult({ request, result: failResult, rootDir })
  }

  const passResult = runMockBrowserExecutor({ request, consumerId, rootDir })
  const diskValidation = verifyArtifactsOnDisk(passResult, request, { rootDir })
  if (!diskValidation.ok) {
    const failResult = createBrowserTaskFailureResult(
      request,
      diskValidation.failureKind,
      diskValidation.reason,
      {
        executor: { ...request.executor },
        started_at: passResult.started_at,
        completed_at: new Date().toISOString(),
        artifacts: passResult.artifacts,
      }
    )
    return writeBrowserTaskResult({ request, result: failResult, rootDir })
  }

  return writeBrowserTaskResult({ request, result: passResult, rootDir })
}

export function consumeOneBrowserTask({ batchId, taskId = null, consumerId = 'browser-agent', rootDir = process.cwd() }) {
  const pending = findPendingBrowserTask({ batchId, taskId, rootDir })
  if (!pending) {
    return { status: 'idle' }
  }

  if (pending.error) {
    return {
      status: 'request_invalid',
      failure_kind: pending.error.failureKind || 'request_invalid',
      error: pending.error.message,
      paths: pending.paths,
    }
  }

  const claimOutcome = claimBrowserTask({ request: pending.request, consumerId, rootDir })
  if (claimOutcome.status === 'existing_result') {
    return {
      status: 'completed',
      result: claimOutcome.result,
      paths: claimOutcome.paths,
      reused_existing_result: true,
    }
  }
  if (claimOutcome.status === 'claim_exists') {
    return {
      status: 'claimed_elsewhere',
      claim: claimOutcome.claim,
      paths: claimOutcome.paths,
    }
  }

  try {
    const execution = executeBrowserTask({ request: pending.request, consumerId, rootDir })
    return {
      status: 'completed',
      result: execution.result,
      paths: execution.paths,
    }
  } finally {
    releaseBrowserTaskClaim({ request: pending.request, rootDir })
  }
}

function cleanupForCli(outcome, rootDir = process.cwd()) {
  if (outcome?.status !== 'request_invalid') {
    return
  }

  if (outcome.paths?.claimFile && existsSync(outcome.paths.claimFile)) {
    unlinkSync(outcome.paths.claimFile)
  }
  if (outcome.paths?.artifactsDir && existsSync(outcome.paths.artifactsDir)) {
    rmSync(outcome.paths.artifactsDir, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.batchId) {
    process.stderr.write('usage: bun scripts/orchestrator/browser_agent.mjs --batch-id <batch_id> [--task-id <task_id>] [--consumer-id <consumer_id>]\n')
    process.exit(1)
  }

  const outcome = consumeOneBrowserTask({
    batchId: args.batchId,
    taskId: args.taskId,
    consumerId: args.consumerId,
    rootDir: args.rootDir,
  })
  cleanupForCli(outcome, args.rootDir)
  process.stdout.write(JSON.stringify(outcome, null, 2) + '\n')
  if (outcome.status === 'request_invalid') {
    process.exit(1)
  }
}
