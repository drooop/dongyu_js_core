#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  createOpsTaskFailureResult,
  deriveOpsTaskPaths,
  loadOpsTaskRequest,
  loadOpsTaskResult,
  materializeOpsTaskArtifacts,
  readOpsTaskClaim,
  removeOpsTaskClaim,
  validateOpsTaskRequest,
  verifyOpsArtifactsOnDisk,
  writeOpsTaskLog,
  writeOpsTaskResult,
} from './ops_bridge.mjs'

function parseArgs(argv) {
  const args = {
    batchId: null,
    taskId: null,
    consumerId: 'ops-executor',
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

function opsTasksRoot(batchId, rootDir = process.cwd()) {
  return join(rootDir, '.orchestrator', 'runs', batchId, 'ops_tasks')
}

function listTaskIds(batchId, rootDir = process.cwd()) {
  const root = opsTasksRoot(batchId, rootDir)
  if (!existsSync(root)) {
    return []
  }

  return readdirSync(root)
    .filter(taskId => statSync(join(root, taskId)).isDirectory())
    .sort()
}

function inspectExistingResult(request, rootDir = process.cwd()) {
  try {
    const existing = loadOpsTaskResult({ request, rootDir })
    if (!existing) {
      return null
    }

    if (existing.result.status === 'pass') {
      const diskValidation = verifyOpsArtifactsOnDisk(existing.result, request, { rootDir })
      if (!diskValidation.ok) {
        return {
          status: 'conflict',
          failure_kind: diskValidation.failureKind,
          error: diskValidation.reason,
          result: existing.result,
          paths: existing.paths,
        }
      }
    }

    return {
      status: 'existing_result',
      result: existing.result,
      paths: existing.paths,
    }
  } catch (error) {
    return {
      status: 'conflict',
      failure_kind: error.failureKind || 'result_invalid',
      error: error.message,
      paths: deriveOpsTaskPaths(request.batch_id, request.task_id, { rootDir }),
    }
  }
}

function claimPayload(request, consumerId) {
  return {
    task_kind: 'ops_task',
    batch_id: request.batch_id,
    task_id: request.task_id,
    attempt: request.attempt,
    consumer_id: consumerId,
    claimed_at: new Date().toISOString(),
  }
}

function writeExclusiveJson(file, payload) {
  const parentDir = dirname(file)
  mkdirSync(parentDir, { recursive: true })
  writeFileSync(file, JSON.stringify(payload, null, 2), { flag: 'wx' })
}

function isExplicitFailure(outcome) {
  return Boolean(outcome && outcome.ok === false && typeof outcome.failure_kind === 'string' && outcome.failure_kind.length > 0)
}

function normalizeOutputText(value) {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value, null, 2)
}

function defaultArtifactContent(spec, request, dispatch, consumerId) {
  const summary = {
    task_id: request.task_id,
    batch_id: request.batch_id,
    consumer_id: consumerId,
    mode: request.executor.mode,
    command: request.command,
    exit_code: dispatch.exit_code,
    stdout_file: request.exchange.stdout_file,
    stderr_file: request.exchange.stderr_file,
  }

  if (spec.artifact_kind === 'json' || spec.media_type === 'application/json') {
    return JSON.stringify(summary, null, 2)
  }

  return [
    `task=${request.task_id}`,
    `batch=${request.batch_id}`,
    `consumer=${consumerId}`,
    `mode=${request.executor.mode}`,
    `command=${request.command}`,
    `exit_code=${dispatch.exit_code}`,
  ].join('\n') + '\n'
}

function buildArtifactInputs(request, dispatch, consumerId) {
  if (Array.isArray(dispatch.artifacts) && dispatch.artifacts.length > 0) {
    return dispatch.artifacts
  }

  return request.required_artifacts.map(spec => ({
    relative_path: spec.relative_path,
    content: defaultArtifactContent(spec, request, dispatch, consumerId),
  }))
}

function buildPassResult(request, artifacts, timestamps, summary = null) {
  return {
    schema_version: 'ops_task_result.v1',
    task_kind: 'ops_task',
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'pass',
    failure_kind: 'none',
    summary: summary || 'Ops executor completed the command and archived canonical outputs.',
    exit_code: 0,
    executor: { ...request.executor },
    started_at: timestamps.started_at,
    completed_at: timestamps.completed_at,
    stdout_file: request.exchange.stdout_file,
    stderr_file: request.exchange.stderr_file,
    artifacts,
  }
}

function defaultAssertionEvaluator({ dispatch, artifacts }) {
  return {
    ok: dispatch.exit_code === 0 && artifacts.length > 0,
    summary: dispatch.exit_code === 0
      ? 'executor proved exit_code=0 and canonical artifacts are present'
      : 'command did not exit successfully',
  }
}

function isForbiddenRemoteCommand(request) {
  if (request.target_env !== 'remote') {
    return false
  }

  const command = request.command
  const forbiddenPatterns = [
    /\bk3s\b/i,
    /\bsystemctl\s+(start|stop|restart|enable|disable)\s+(rke2|k3s|containerd|docker|sshd|networking)\b/i,
    /\/etc\/rancher\//i,
    /\/etc\/cni\/net\.d\//i,
    /\biptables\b.*\b(flush|restore)\b/i,
    /\bnft(ables)?\b.*\b(flush|delete)\b/i,
    /\bufw\b/i,
    /\bfirewalld\b/i,
    /\bip\s+link\b/i,
    /\bip\s+route\b/i,
    /\bbridge\b/i,
  ]

  return forbiddenPatterns.some(pattern => pattern.test(command))
}

function requiresRemoteGuard(request) {
  return request.target_env === 'remote' && request.mutating === true
}

function defaultRemoteGuardFailure() {
  return {
    ok: false,
    stdout: '',
    stderr: 'remote guard runner unavailable for mutating remote ops in 0227 bridge-only mode',
  }
}

function runMockDispatch(request, consumerId) {
  return {
    exit_code: 0,
    stdout: [
      `mode=mock`,
      `task=${request.task_id}`,
      `consumer=${consumerId}`,
      `command=${request.command}`,
    ].join('\n') + '\n',
    stderr: '',
    summary: 'Mock ops executor produced deterministic bridge evidence.',
  }
}

function runLocalShellDispatch(request, rootDir = process.cwd()) {
  const workingDir = join(rootDir, request.cwd)
  const child = spawnSync(request.shell, ['-lc', request.command], {
    cwd: workingDir,
    encoding: 'utf8',
    timeout: request.timeout_ms,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (child.error) {
    if (child.error.code === 'ETIMEDOUT') {
      return {
        ok: false,
        failure_kind: 'timeout',
        summary: 'Local shell command timed out.',
        stdout: normalizeOutputText(child.stdout),
        stderr: normalizeOutputText(child.stderr || child.error.message),
        exit_code: null,
      }
    }

    return {
      ok: false,
      failure_kind: 'executor_unavailable',
      summary: `Local shell runner failed: ${child.error.message}`,
      stdout: normalizeOutputText(child.stdout),
      stderr: normalizeOutputText(child.stderr || child.error.message),
      exit_code: null,
    }
  }

  return {
    exit_code: child.status ?? 0,
    stdout: normalizeOutputText(child.stdout),
    stderr: normalizeOutputText(child.stderr),
    summary: 'Local shell command finished.',
  }
}

function archiveLogs(request, stdout, stderr, rootDir = process.cwd()) {
  writeOpsTaskLog({ request, stream: 'stdout', content: stdout, rootDir })
  writeOpsTaskLog({ request, stream: 'stderr', content: stderr, rootDir })
}

function persistFailureResult(request, failureKind, summary, extra = {}, rootDir = process.cwd()) {
  archiveLogs(request, extra.stdout || '', extra.stderr || '', rootDir)
  const result = createOpsTaskFailureResult(request, failureKind, summary, {
    exit_code: extra.exit_code ?? null,
    artifacts: extra.artifacts || [],
    started_at: extra.started_at,
    completed_at: extra.completed_at,
    executor: extra.executor || { ...request.executor },
  })
  return writeOpsTaskResult({ request, result, rootDir })
}

function finalizeDispatchSuccess({
  request,
  dispatch,
  consumerId,
  rootDir = process.cwd(),
  assertionEvaluator = defaultAssertionEvaluator,
}) {
  const startedAt = dispatch.started_at || new Date().toISOString()
  archiveLogs(request, dispatch.stdout || '', dispatch.stderr || '', rootDir)

  if (dispatch.exit_code !== 0) {
    return persistFailureResult(
      request,
      'nonzero_exit',
      dispatch.summary || 'Shell command exited with a non-zero status.',
      {
        stdout: dispatch.stdout || '',
        stderr: dispatch.stderr || '',
        exit_code: Number.isInteger(dispatch.exit_code) ? dispatch.exit_code : null,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
      rootDir
    )
  }

  const materialized = materializeOpsTaskArtifacts({
    request,
    artifacts: buildArtifactInputs(request, dispatch, consumerId),
    executorId: request.executor.executor_id,
    rootDir,
  })

  const assertion = (assertionEvaluator || defaultAssertionEvaluator)({
    request,
    dispatch,
    artifacts: materialized.artifacts,
    rootDir,
  })
  if (!assertion?.ok) {
    return persistFailureResult(
      request,
      'assertion_failed',
      assertion?.summary || 'executor could not prove all success assertions',
      {
        stdout: dispatch.stdout || '',
        stderr: dispatch.stderr || '',
        exit_code: 0,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        artifacts: materialized.artifacts,
      },
      rootDir
    )
  }

  const result = buildPassResult(
    request,
    materialized.artifacts,
    {
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    },
    dispatch.summary || 'Ops executor completed the command and archived canonical outputs.'
  )
  return writeOpsTaskResult({ request, result, rootDir })
}

function dispatchOpsTask({
  request,
  consumerId,
  rootDir = process.cwd(),
  localShellRunner = null,
  sshRunner = null,
  remoteGuardRunner = null,
  assertionEvaluator = defaultAssertionEvaluator,
}) {
  if (isForbiddenRemoteCommand(request)) {
    return persistFailureResult(
      request,
      'forbidden_remote_op',
      'Remote command hits a forbidden REMOTE_OPS_SAFETY surface.',
      {
        stderr: `forbidden remote op: ${request.command}`,
      },
      rootDir
    )
  }

  if (requiresRemoteGuard(request)) {
    const guard = (remoteGuardRunner || defaultRemoteGuardFailure)({ request, rootDir })
    if (!guard?.ok) {
      return persistFailureResult(
        request,
        'remote_guard_blocked',
        'Remote preflight guard blocked the requested operation.',
        {
          stdout: guard?.stdout || '',
          stderr: guard?.stderr || '',
        },
        rootDir
      )
    }
  }

  if (request.executor.mode === 'mock') {
    const dispatch = runMockDispatch(request, consumerId)
    return finalizeDispatchSuccess({ request, dispatch, consumerId, rootDir, assertionEvaluator })
  }

  if (request.executor.mode === 'local_shell') {
    const dispatch = (localShellRunner || ((ctx) => runLocalShellDispatch(ctx.request, ctx.rootDir)))({
      request,
      consumerId,
      rootDir,
    })
    if (isExplicitFailure(dispatch)) {
      return persistFailureResult(request, dispatch.failure_kind, dispatch.summary, {
        stdout: dispatch.stdout || '',
        stderr: dispatch.stderr || '',
        exit_code: dispatch.exit_code ?? null,
        started_at: dispatch.started_at,
        completed_at: dispatch.completed_at,
      }, rootDir)
    }

    return finalizeDispatchSuccess({ request, dispatch, consumerId, rootDir, assertionEvaluator })
  }

  if (request.executor.mode === 'ssh') {
    if (!sshRunner) {
      return persistFailureResult(
        request,
        'executor_unavailable',
        'SSH executor is not configured for this bridge invocation.',
        {
          stderr: 'ssh executor unavailable',
        },
        rootDir
      )
    }

    const dispatch = sshRunner({ request, consumerId, rootDir })
    if (isExplicitFailure(dispatch)) {
      return persistFailureResult(request, dispatch.failure_kind, dispatch.summary, {
        stdout: dispatch.stdout || '',
        stderr: dispatch.stderr || '',
        exit_code: dispatch.exit_code ?? null,
        started_at: dispatch.started_at,
        completed_at: dispatch.completed_at,
      }, rootDir)
    }

    return finalizeDispatchSuccess({ request, dispatch, consumerId, rootDir, assertionEvaluator })
  }

  return persistFailureResult(
    request,
    'executor_unavailable',
    `Unsupported executor mode: ${request.executor.mode}`,
    {
      stderr: `unsupported executor mode: ${request.executor.mode}`,
    },
    rootDir
  )
}

export function claimOpsTask({ request, consumerId, rootDir = process.cwd() }) {
  const validation = validateOpsTaskRequest(request, { rootDir })
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const existingResult = inspectExistingResult(request, rootDir)
  if (existingResult) {
    return existingResult
  }

  const paths = validation.paths
  const payload = claimPayload(request, consumerId)

  const existingClaim = readOpsTaskClaim({ request, rootDir })
  if (existingClaim?.claim) {
    return {
      status: 'claim_exists',
      claim: existingClaim.claim,
      failure_kind: 'duplicate_result',
      paths,
    }
  }

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
        failure_kind: 'duplicate_result',
        ...(readOpsTaskClaim({ request, rootDir }) || { claim: null, paths }),
      }
    }
    throw error
  }
}

export function releaseOpsTaskClaim({ request, batchId, taskId, rootDir = process.cwd() }) {
  return removeOpsTaskClaim({ request, batchId, taskId, rootDir })
}

export function findPendingOpsTask({ batchId, taskId = null, rootDir = process.cwd() }) {
  const candidateIds = taskId ? [taskId] : listTaskIds(batchId, rootDir)
  let fallback = null

  for (const candidateTaskId of candidateIds) {
    const paths = deriveOpsTaskPaths(batchId, candidateTaskId, { rootDir })
    if (!existsSync(paths.requestFile)) {
      continue
    }

    try {
      const loaded = loadOpsTaskRequest({
        batchId,
        taskId: candidateTaskId,
        rootDir,
      })
      const existingResult = inspectExistingResult(loaded.request, rootDir)
      if (existingResult) {
        fallback ||= {
          request: loaded.request,
          paths: loaded.paths,
          ...existingResult,
        }
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

  return fallback
}

export function consumeOneOpsTask({
  batchId,
  taskId = null,
  consumerId = 'ops-executor',
  rootDir = process.cwd(),
  localShellRunner = null,
  sshRunner = null,
  remoteGuardRunner = null,
  assertionEvaluator = defaultAssertionEvaluator,
}) {
  const pending = findPendingOpsTask({ batchId, taskId, rootDir })
  if (!pending) {
    return { status: 'idle' }
  }

  if (pending.status === 'existing_result') {
    return {
      status: 'completed',
      result: pending.result,
      paths: pending.paths,
      reused_existing_result: true,
    }
  }
  if (pending.status === 'conflict') {
    return {
      status: 'bridge_conflict',
      failure_kind: pending.failure_kind,
      error: pending.error,
      result: pending.result || null,
      paths: pending.paths,
    }
  }
  if (pending.error) {
    return {
      status: 'bridge_conflict',
      failure_kind: pending.error.failureKind || 'request_invalid',
      error: pending.error.message,
      paths: pending.paths,
    }
  }

  const claimOutcome = claimOpsTask({ request: pending.request, consumerId, rootDir })
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
      failure_kind: claimOutcome.failure_kind || 'duplicate_result',
      paths: claimOutcome.paths,
    }
  }

  try {
    const execution = dispatchOpsTask({
      request: pending.request,
      consumerId,
      rootDir,
      localShellRunner,
      sshRunner,
      remoteGuardRunner,
      assertionEvaluator,
    })
    return {
      status: 'completed',
      result: execution.result,
      paths: execution.paths,
      reused_existing_result: execution.status === 'existing_result',
    }
  } finally {
    releaseOpsTaskClaim({ request: pending.request, rootDir })
  }
}

function cleanupForCli(outcome) {
  if (outcome?.status !== 'bridge_conflict' || !outcome.paths) {
    return
  }
  if (outcome.paths.claimFile && existsSync(outcome.paths.claimFile)) {
    unlinkSync(outcome.paths.claimFile)
  }
  if (outcome.paths.artifactsDir && existsSync(outcome.paths.artifactsDir)) {
    rmSync(outcome.paths.artifactsDir, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.batchId) {
    process.stderr.write('usage: bun scripts/orchestrator/ops_executor.mjs --batch-id <batch_id> [--task-id <task_id>] [--consumer-id <consumer_id>]\n')
    process.exit(1)
  }

  const outcome = consumeOneOpsTask({
    batchId: args.batchId,
    taskId: args.taskId,
    consumerId: args.consumerId,
    rootDir: args.rootDir,
  })
  cleanupForCli(outcome)
  process.stdout.write(JSON.stringify(outcome, null, 2) + '\n')
  if (outcome.status === 'bridge_conflict') {
    process.exit(1)
  }
}
