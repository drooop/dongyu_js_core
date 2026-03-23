import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const BROWSER_TASK_REQUEST_SCHEMA_VERSION = 'browser_task_request.v1'
export const BROWSER_TASK_RESULT_SCHEMA_VERSION = 'browser_task_result.v1'
export const BROWSER_TASK_KIND = 'browser_task'
export const BROWSER_TASK_BRIDGE_CHANNEL = 'browser_task_bridge'
export const BROWSER_TASK_EXECUTOR_CLASS = 'browser_capable'
export const BROWSER_TASK_RESULT_FAILURE_KINDS = [
  'none',
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

export class BrowserBridgeError extends Error {
  constructor(failureKind, message, details = {}) {
    super(message)
    this.name = 'BrowserBridgeError'
    this.failureKind = failureKind
    this.details = details
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

function ensureRepoRelativePath(value) {
  return isNonEmptyString(value) && !value.startsWith('/') && !value.includes('..')
}

function isBrowserExecutor(executor) {
  return Boolean(
    executor &&
    executor.executor_class === BROWSER_TASK_EXECUTOR_CLASS &&
    executor.bridge_channel === BROWSER_TASK_BRIDGE_CHANNEL &&
    isNonEmptyString(executor.executor_id) &&
    ['mock', 'mcp'].includes(executor.mode)
  )
}

function validateArtifactShape(artifact) {
  return Boolean(
    artifact &&
    ['screenshot', 'json', 'trace', 'console'].includes(artifact.artifact_kind) &&
    ensureRepoRelativePath(artifact.relative_path) &&
    typeof artifact.required === 'boolean' &&
    isNonEmptyString(artifact.media_type)
  )
}

function validateProducedArtifact(artifact) {
  return Boolean(
    validateArtifactShape(artifact) &&
    Number.isInteger(artifact.bytes) &&
    artifact.bytes >= 0 &&
    /^[a-fA-F0-9]{64}$/.test(artifact.sha256 || '') &&
    artifact.producer?.actor === 'browser_executor' &&
    isNonEmptyString(artifact.producer?.executor_id)
  )
}

function artifactSpecsByPath(request) {
  return new Map((request.required_artifacts || []).map(artifact => [artifact.relative_path, artifact]))
}

function compareResultArtifactsToRequest(request, result) {
  const specByPath = artifactSpecsByPath(request)
  const requiredPaths = new Set(
    (request.required_artifacts || [])
      .filter(artifact => artifact.required)
      .map(artifact => artifact.relative_path)
  )
  const producedPaths = new Set()

  for (const artifact of result.artifacts || []) {
    if (!validateProducedArtifact(artifact)) {
      return {
        ok: false,
        failureKind: 'result_invalid',
        reason: 'result artifact shape is invalid',
      }
    }

    producedPaths.add(artifact.relative_path)
    const requestArtifact = specByPath.get(artifact.relative_path)
    if (requestArtifact) {
      if (
        artifact.artifact_kind !== requestArtifact.artifact_kind ||
        artifact.media_type !== requestArtifact.media_type ||
        artifact.required !== requestArtifact.required
      ) {
        return {
          ok: false,
          failureKind: 'artifact_mismatch',
          reason: `artifact manifest mismatches request contract: ${artifact.relative_path}`,
        }
      }
    }
  }

  if (result.status === 'pass') {
    for (const requiredPath of requiredPaths) {
      if (!producedPaths.has(requiredPath)) {
        return {
          ok: false,
          failureKind: 'artifact_missing',
          reason: `required artifact missing from pass result: ${requiredPath}`,
        }
      }
    }
  }

  return { ok: true }
}

function validateCanonicalExchange(request, rootDir = process.cwd()) {
  const paths = deriveBrowserTaskPaths(request.batch_id, request.task_id, { rootDir })
  if (
    request.exchange?.request_file !== paths.requestFileRelative ||
    request.exchange?.result_file !== paths.resultFileRelative ||
    request.exchange?.task_dir !== paths.taskDirRelative
  ) {
    return {
      ok: false,
      failureKind: 'request_invalid',
      reason: 'request exchange paths do not match the canonical browser_tasks request.json/result.json layout',
    }
  }

  const artifactPrefix = `${paths.artifactsDirRelative}/`
  for (const artifact of request.required_artifacts || []) {
    if (!artifact.relative_path.startsWith(artifactPrefix)) {
      return {
        ok: false,
        failureKind: 'request_invalid',
        reason: `required artifact path escapes canonical output/playwright task dir: ${artifact.relative_path}`,
      }
    }
  }

  return { ok: true, paths }
}

export function deriveBrowserTaskPaths(batchId, taskId, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const taskDirRelative = `.orchestrator/runs/${batchId}/browser_tasks/${taskId}`
  const requestFileRelative = `${taskDirRelative}/request.json`
  const resultFileRelative = `${taskDirRelative}/result.json`
  const claimFileRelative = `${taskDirRelative}/claim.json`
  const artifactsDirRelative = `output/playwright/${batchId}/${taskId}`

  return {
    batchId,
    taskId,
    rootDir,
    taskDirRelative,
    requestFileRelative,
    resultFileRelative,
    claimFileRelative,
    artifactsDirRelative,
    taskDir: join(rootDir, taskDirRelative),
    requestFile: join(rootDir, requestFileRelative),
    resultFile: join(rootDir, resultFileRelative),
    claimFile: join(rootDir, claimFileRelative),
    artifactsDir: join(rootDir, artifactsDirRelative),
  }
}

export function validateBrowserTaskRequest(request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  if (!request || typeof request !== 'object') {
    return { ok: false, failureKind: 'request_invalid', reason: 'request must be an object' }
  }

  if (request.schema_version !== BROWSER_TASK_REQUEST_SCHEMA_VERSION) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request schema_version mismatch' }
  }
  if (request.task_kind !== BROWSER_TASK_KIND) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request task_kind mismatch' }
  }
  if (!isNonEmptyString(request.batch_id) || !isNonEmptyString(request.iteration_id) || !isNonEmptyString(request.task_id)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request identity is incomplete' }
  }
  if (!Number.isInteger(request.attempt) || request.attempt < 1) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request attempt must be >= 1' }
  }
  if (!isIsoTimestamp(request.created_at)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request created_at must be ISO-8601' }
  }
  if (!isBrowserExecutor(request.executor)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request executor must describe a browser_task bridge consumer' }
  }
  if (
    !request.objective ||
    !isNonEmptyString(request.objective.summary) ||
    !Array.isArray(request.objective.instructions) ||
    request.objective.instructions.length === 0 ||
    !Array.isArray(request.objective.success_assertions) ||
    request.objective.success_assertions.length === 0
  ) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request objective is incomplete' }
  }
  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms < 1) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request timeout_ms must be >= 1' }
  }
  if (!Array.isArray(request.required_artifacts) || request.required_artifacts.length === 0) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request required_artifacts must be non-empty' }
  }
  if (!request.required_artifacts.every(validateArtifactShape)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request required_artifacts contain an invalid entry' }
  }

  return validateCanonicalExchange(request, rootDir)
}

export function validateBrowserTaskResult(result, request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const requestValidation = validateBrowserTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    return requestValidation
  }

  if (!result || typeof result !== 'object') {
    return { ok: false, failureKind: 'result_invalid', reason: 'result must be an object' }
  }
  if (result.schema_version !== BROWSER_TASK_RESULT_SCHEMA_VERSION) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result schema_version mismatch' }
  }
  if (result.task_kind !== BROWSER_TASK_KIND) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result task_kind mismatch' }
  }
  if (
    result.batch_id !== request.batch_id ||
    result.iteration_id !== request.iteration_id ||
    result.task_id !== request.task_id ||
    result.attempt !== request.attempt
  ) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result identity mismatches request' }
  }
  if (!['pass', 'fail'].includes(result.status)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result status must be pass|fail' }
  }
  if (!BROWSER_TASK_RESULT_FAILURE_KINDS.includes(result.failure_kind)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result failure_kind is outside the frozen taxonomy' }
  }
  if (!isNonEmptyString(result.summary)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result summary is required' }
  }
  if (!isBrowserExecutor(result.executor)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result executor must stay on browser_task_bridge' }
  }
  if (!isIsoTimestamp(result.started_at) || !isIsoTimestamp(result.completed_at)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result timestamps must be ISO-8601' }
  }
  if (!Array.isArray(result.artifacts)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result artifacts must be an array' }
  }
  if (result.status === 'pass' && result.failure_kind !== 'none') {
    return { ok: false, failureKind: 'result_invalid', reason: 'pass result must use failure_kind=none' }
  }
  if (result.status === 'fail' && result.failure_kind === 'none') {
    return { ok: false, failureKind: 'result_invalid', reason: 'fail result must not use failure_kind=none' }
  }

  const artifactCheck = compareResultArtifactsToRequest(request, result)
  if (!artifactCheck.ok) {
    return artifactCheck
  }

  const artifactPrefix = `${requestValidation.paths.artifactsDirRelative}/`
  if ((result.artifacts || []).some(artifact => !artifact.relative_path.startsWith(artifactPrefix))) {
    return { ok: false, failureKind: 'artifact_mismatch', reason: 'result artifact escapes canonical output/playwright task dir' }
  }

  return { ok: true, paths: requestValidation.paths }
}

export function ensureBrowserTaskDirs(batchId, taskId, opts = {}) {
  const paths = deriveBrowserTaskPaths(batchId, taskId, opts)
  mkdirSync(paths.taskDir, { recursive: true })
  mkdirSync(paths.artifactsDir, { recursive: true })
  return paths
}

export function readBrowserTaskClaim({ request, batchId, taskId, rootDir = process.cwd() }) {
  const identity = request
    ? { batchId: request.batch_id, taskId: request.task_id }
    : { batchId, taskId }
  const paths = deriveBrowserTaskPaths(identity.batchId, identity.taskId, { rootDir })
  if (!existsSync(paths.claimFile)) {
    return null
  }

  return {
    claim: readJsonFile(paths.claimFile, 'result_invalid', 'claim.json'),
    paths,
  }
}

export function writeBrowserTaskClaim({ request, claim, rootDir = process.cwd() }) {
  const requestValidation = validateBrowserTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    throw new BrowserBridgeError(requestValidation.failureKind, requestValidation.reason, { request })
  }

  writeJsonAtomic(requestValidation.paths.claimFile, claim)
  return {
    claim,
    paths: requestValidation.paths,
  }
}

export function removeBrowserTaskClaim({ request, batchId, taskId, rootDir = process.cwd() }) {
  const identity = request
    ? { batchId: request.batch_id, taskId: request.task_id }
    : { batchId, taskId }
  const paths = deriveBrowserTaskPaths(identity.batchId, identity.taskId, { rootDir })
  if (existsSync(paths.claimFile)) {
    unlinkSync(paths.claimFile)
  }
  return paths
}

function readJsonFile(file, failureKind, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new BrowserBridgeError(failureKind, `Failed to read ${label}: ${error.message}`, { file })
  }
}

function writeJsonAtomic(file, payload) {
  mkdirSync(dirname(file), { recursive: true })
  const tmpFile = `${file}.tmp`
  writeFileSync(tmpFile, JSON.stringify(payload, null, 2))
  renameSync(tmpFile, file)
  try {
    unlinkSync(tmpFile)
  } catch {
    // renameSync already moved the tmp file; ignore leftover cleanup.
  }
}

export function loadBrowserTaskRequest({ batchId, taskId, rootDir = process.cwd() }) {
  const paths = deriveBrowserTaskPaths(batchId, taskId, { rootDir })
  if (!existsSync(paths.requestFile)) {
    throw new BrowserBridgeError('request_invalid', `Missing canonical browser task request.json: ${paths.requestFileRelative}`, { paths })
  }

  const request = readJsonFile(paths.requestFile, 'request_invalid', 'request.json')
  const validation = validateBrowserTaskRequest(request, { rootDir })
  if (!validation.ok) {
    throw new BrowserBridgeError(validation.failureKind, validation.reason, { paths, request })
  }

  return { request, paths }
}

export function loadBrowserTaskResult({ request, batchId, taskId, rootDir = process.cwd() }) {
  const identity = request
    ? { batchId: request.batch_id, taskId: request.task_id }
    : { batchId, taskId }
  const paths = deriveBrowserTaskPaths(identity.batchId, identity.taskId, { rootDir })

  if (!existsSync(paths.resultFile)) {
    return null
  }

  const result = readJsonFile(paths.resultFile, 'result_invalid', 'result.json')
  if (request) {
    const validation = validateBrowserTaskResult(result, request, { rootDir })
    if (!validation.ok) {
      throw new BrowserBridgeError(validation.failureKind, validation.reason, { paths, result })
    }
  }

  return { result, paths }
}

export function writeBrowserTaskResult({ request, result, rootDir = process.cwd() }) {
  const requestValidation = validateBrowserTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    throw new BrowserBridgeError(requestValidation.failureKind, requestValidation.reason, { request })
  }

  const resultValidation = validateBrowserTaskResult(result, request, { rootDir })
  if (!resultValidation.ok) {
    throw new BrowserBridgeError(resultValidation.failureKind, resultValidation.reason, { request, result })
  }

  const paths = requestValidation.paths
  mkdirSync(paths.taskDir, { recursive: true })

  if (existsSync(paths.resultFile)) {
    const existingResult = readJsonFile(paths.resultFile, 'result_invalid', 'existing result.json')
    const existingValidation = validateBrowserTaskResult(existingResult, request, { rootDir })
    if (!existingValidation.ok) {
      throw new BrowserBridgeError(existingValidation.failureKind, existingValidation.reason, {
        request,
        existingResult,
        paths,
      })
    }

    return {
      status: 'existing_result',
      result: existingResult,
      paths,
    }
  }

  writeJsonAtomic(paths.resultFile, result)
  return {
    status: 'written',
    result,
    paths,
  }
}

export function computeArtifactDigest(file) {
  const buffer = readFileSync(file)
  return {
    bytes: statSync(file).size,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

export function verifyArtifactsOnDisk(result, request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const validation = validateBrowserTaskResult(result, request, { rootDir })
  if (!validation.ok) {
    return validation
  }

  for (const artifact of result.artifacts) {
    const absolutePath = join(rootDir, artifact.relative_path)
    if (!existsSync(absolutePath)) {
      return {
        ok: false,
        failureKind: 'artifact_missing',
        reason: `artifact file missing on disk: ${artifact.relative_path}`,
      }
    }

    const digest = computeArtifactDigest(absolutePath)
    if (digest.bytes !== artifact.bytes || digest.sha256 !== artifact.sha256) {
      return {
        ok: false,
        failureKind: 'artifact_mismatch',
        reason: `artifact manifest mismatch on disk: ${artifact.relative_path}`,
      }
    }
  }

  return { ok: true, paths: validation.paths }
}

export function createBrowserTaskFailureResult(request, failureKind, summary, extra = {}) {
  const timestamps = {
    started_at: extra.started_at || new Date().toISOString(),
    completed_at: extra.completed_at || new Date().toISOString(),
  }

  return {
    schema_version: BROWSER_TASK_RESULT_SCHEMA_VERSION,
    task_kind: BROWSER_TASK_KIND,
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'fail',
    failure_kind: failureKind,
    summary,
    executor: extra.executor || { ...request.executor },
    started_at: timestamps.started_at,
    completed_at: timestamps.completed_at,
    artifacts: extra.artifacts || [],
  }
}
