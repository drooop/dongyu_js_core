import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const OPS_TASK_REQUEST_SCHEMA_VERSION = 'ops_task_request.v1'
export const OPS_TASK_RESULT_SCHEMA_VERSION = 'ops_task_result.v1'
export const OPS_TASK_KIND = 'ops_task'
export const OPS_TASK_BRIDGE_CHANNEL = 'ops_task_bridge'
export const OPS_TASK_EXECUTOR_CLASS = 'ops_capable'
export const OPS_TASK_RESULT_FAILURE_KINDS = [
  'none',
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

export class OpsBridgeError extends Error {
  constructor(failureKind, message, details = {}) {
    super(message)
    this.name = 'OpsBridgeError'
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

function isOpsExecutor(executor) {
  return Boolean(
    executor &&
    executor.executor_class === OPS_TASK_EXECUTOR_CLASS &&
    executor.bridge_channel === OPS_TASK_BRIDGE_CHANNEL &&
    isNonEmptyString(executor.executor_id) &&
    ['mock', 'local_shell', 'ssh'].includes(executor.mode)
  )
}

function validateArtifactShape(artifact) {
  return Boolean(
    artifact &&
    ['file', 'json', 'log', 'archive'].includes(artifact.artifact_kind) &&
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
    artifact.producer?.actor === 'ops_executor' &&
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
    if (!requestArtifact) {
      return {
        ok: false,
        failureKind: 'artifact_mismatch',
        reason: `artifact is not declared in request contract: ${artifact.relative_path}`,
      }
    }
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
  const paths = deriveOpsTaskPaths(request.batch_id, request.task_id, { rootDir })
  if (
    request.exchange?.request_file !== paths.requestFileRelative ||
    request.exchange?.result_file !== paths.resultFileRelative ||
    request.exchange?.task_dir !== paths.taskDirRelative ||
    request.exchange?.stdout_file !== paths.stdoutFileRelative ||
    request.exchange?.stderr_file !== paths.stderrFileRelative ||
    request.exchange?.artifacts_dir !== paths.artifactsDirRelative
  ) {
    return {
      ok: false,
      failureKind: 'request_invalid',
      reason: 'request exchange paths do not match the canonical ops_tasks request/result/stdout/stderr/artifacts layout',
    }
  }

  const artifactPrefix = `${paths.artifactsDirRelative}/`
  for (const artifact of request.required_artifacts || []) {
    if (!artifact.relative_path.startsWith(artifactPrefix)) {
      return {
        ok: false,
        failureKind: 'request_invalid',
        reason: `required artifact path escapes canonical ops_tasks artifacts dir: ${artifact.relative_path}`,
      }
    }
  }

  return { ok: true, paths }
}

function readJsonFile(file, failureKind, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new OpsBridgeError(failureKind, `Failed to read ${label}: ${error.message}`, { file })
  }
}

function writeAtomicFile(file, content) {
  mkdirSync(dirname(file), { recursive: true })
  const tmpFile = `${file}.tmp`
  writeFileSync(tmpFile, content)
  renameSync(tmpFile, file)
  try {
    unlinkSync(tmpFile)
  } catch {
    // renameSync already moved the tmp file.
  }
}

function verifyOpsLogsOnDisk(result, request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const expectedStdout = join(rootDir, request.exchange.stdout_file)
  const expectedStderr = join(rootDir, request.exchange.stderr_file)

  if (!existsSync(expectedStdout)) {
    return {
      ok: false,
      failureKind: 'result_invalid',
      reason: `stdout.log missing on disk: ${request.exchange.stdout_file}`,
    }
  }
  if (!existsSync(expectedStderr)) {
    return {
      ok: false,
      failureKind: 'result_invalid',
      reason: `stderr.log missing on disk: ${request.exchange.stderr_file}`,
    }
  }
  if (result.stdout_file !== request.exchange.stdout_file || result.stderr_file !== request.exchange.stderr_file) {
    return {
      ok: false,
      failureKind: 'result_invalid',
      reason: 'result stdout/stderr paths do not match the canonical request exchange',
    }
  }

  return { ok: true }
}

export function deriveOpsTaskPaths(batchId, taskId, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const taskDirRelative = `.orchestrator/runs/${batchId}/ops_tasks/${taskId}`
  const requestFileRelative = `${taskDirRelative}/request.json`
  const resultFileRelative = `${taskDirRelative}/result.json`
  const claimFileRelative = `${taskDirRelative}/claim.json`
  const stdoutFileRelative = `${taskDirRelative}/stdout.log`
  const stderrFileRelative = `${taskDirRelative}/stderr.log`
  const artifactsDirRelative = `${taskDirRelative}/artifacts`

  return {
    batchId,
    taskId,
    rootDir,
    taskDirRelative,
    requestFileRelative,
    resultFileRelative,
    claimFileRelative,
    stdoutFileRelative,
    stderrFileRelative,
    artifactsDirRelative,
    taskDir: join(rootDir, taskDirRelative),
    requestFile: join(rootDir, requestFileRelative),
    resultFile: join(rootDir, resultFileRelative),
    claimFile: join(rootDir, claimFileRelative),
    stdoutFile: join(rootDir, stdoutFileRelative),
    stderrFile: join(rootDir, stderrFileRelative),
    artifactsDir: join(rootDir, artifactsDirRelative),
  }
}

export function validateOpsTaskRequest(request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  if (!request || typeof request !== 'object') {
    return { ok: false, failureKind: 'request_invalid', reason: 'request must be an object' }
  }

  if (request.schema_version !== OPS_TASK_REQUEST_SCHEMA_VERSION) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request schema_version mismatch' }
  }
  if (request.task_kind !== OPS_TASK_KIND) {
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
  if (!isOpsExecutor(request.executor)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request executor must describe an ops_task bridge consumer' }
  }
  if (!isNonEmptyString(request.command) || !isNonEmptyString(request.shell) || !ensureRepoRelativePath(request.cwd)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request execution boundary is incomplete' }
  }
  if (!['local', 'remote'].includes(request.target_env)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request target_env must be local|remote' }
  }
  if (!['repo', 'local_host', 'local_cluster', 'remote_host', 'remote_cluster'].includes(request.host_scope)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request host_scope is invalid' }
  }
  if (typeof request.mutating !== 'boolean') {
    return { ok: false, failureKind: 'request_invalid', reason: 'request mutating must be boolean' }
  }
  if (!['low', 'medium', 'high', 'critical'].includes(request.danger_level)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request danger_level is invalid' }
  }
  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms < 1) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request timeout_ms must be >= 1' }
  }
  if (!Array.isArray(request.success_assertions) || request.success_assertions.length === 0 || !request.success_assertions.every(isNonEmptyString)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request success_assertions must be non-empty' }
  }
  if (!Array.isArray(request.required_artifacts) || request.required_artifacts.length === 0) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request required_artifacts must be non-empty' }
  }
  if (!request.required_artifacts.every(validateArtifactShape)) {
    return { ok: false, failureKind: 'request_invalid', reason: 'request required_artifacts contain an invalid entry' }
  }

  return validateCanonicalExchange(request, rootDir)
}

export function validateOpsTaskResult(result, request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const requestValidation = validateOpsTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    return requestValidation
  }

  if (!result || typeof result !== 'object') {
    return { ok: false, failureKind: 'result_invalid', reason: 'result must be an object' }
  }
  if (result.schema_version !== OPS_TASK_RESULT_SCHEMA_VERSION) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result schema_version mismatch' }
  }
  if (result.task_kind !== OPS_TASK_KIND) {
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
  if (!OPS_TASK_RESULT_FAILURE_KINDS.includes(result.failure_kind)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result failure_kind is outside the frozen taxonomy' }
  }
  if (!isNonEmptyString(result.summary)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result summary is required' }
  }
  if (!(Number.isInteger(result.exit_code) || result.exit_code === null)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result exit_code must be integer|null' }
  }
  if (!isOpsExecutor(result.executor)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result executor must stay on ops_task_bridge' }
  }
  if (!isIsoTimestamp(result.started_at) || !isIsoTimestamp(result.completed_at)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result timestamps must be ISO-8601' }
  }
  if (!isNonEmptyString(result.stdout_file) || !isNonEmptyString(result.stderr_file)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result stdout/stderr files are required' }
  }
  if (!Array.isArray(result.artifacts)) {
    return { ok: false, failureKind: 'result_invalid', reason: 'result artifacts must be an array' }
  }
  if (result.status === 'pass' && result.failure_kind !== 'none') {
    return { ok: false, failureKind: 'result_invalid', reason: 'pass result must use failure_kind=none' }
  }
  if (result.status === 'pass' && result.exit_code !== 0) {
    return { ok: false, failureKind: 'result_invalid', reason: 'pass result must use exit_code=0' }
  }
  if (result.status === 'fail' && result.failure_kind === 'none') {
    return { ok: false, failureKind: 'result_invalid', reason: 'fail result must not use failure_kind=none' }
  }

  const logValidation = verifyOpsLogsOnDisk(result, request, { rootDir })
  if (!logValidation.ok) {
    return logValidation
  }

  const artifactCheck = compareResultArtifactsToRequest(request, result)
  if (!artifactCheck.ok) {
    return artifactCheck
  }

  const artifactPrefix = `${requestValidation.paths.artifactsDirRelative}/`
  if ((result.artifacts || []).some(artifact => !artifact.relative_path.startsWith(artifactPrefix))) {
    return { ok: false, failureKind: 'artifact_mismatch', reason: 'result artifact escapes canonical ops_tasks artifacts dir' }
  }

  return { ok: true, paths: requestValidation.paths }
}

export function ensureOpsTaskDirs(batchId, taskId, opts = {}) {
  const paths = deriveOpsTaskPaths(batchId, taskId, opts)
  mkdirSync(paths.taskDir, { recursive: true })
  mkdirSync(paths.artifactsDir, { recursive: true })
  return paths
}

export function loadOpsTaskRequest({ batchId, taskId, rootDir = process.cwd() }) {
  const paths = deriveOpsTaskPaths(batchId, taskId, { rootDir })
  if (!existsSync(paths.requestFile)) {
    throw new OpsBridgeError('request_invalid', `Missing canonical ops task request.json: ${paths.requestFileRelative}`, { paths })
  }

  const request = readJsonFile(paths.requestFile, 'request_invalid', 'request.json')
  const validation = validateOpsTaskRequest(request, { rootDir })
  if (!validation.ok) {
    throw new OpsBridgeError(validation.failureKind, validation.reason, { paths, request })
  }

  return { request, paths }
}

export function loadOpsTaskResult({ request, batchId, taskId, rootDir = process.cwd() }) {
  const identity = request
    ? { batchId: request.batch_id, taskId: request.task_id }
    : { batchId, taskId }
  const paths = deriveOpsTaskPaths(identity.batchId, identity.taskId, { rootDir })

  if (!existsSync(paths.resultFile)) {
    return null
  }

  const result = readJsonFile(paths.resultFile, 'result_invalid', 'result.json')
  if (request) {
    const validation = validateOpsTaskResult(result, request, { rootDir })
    if (!validation.ok) {
      throw new OpsBridgeError(validation.failureKind, validation.reason, { paths, result })
    }
  }

  return { result, paths }
}

export function readOpsTaskClaim({ request, batchId, taskId, rootDir = process.cwd() }) {
  const identity = request
    ? { batchId: request.batch_id, taskId: request.task_id }
    : { batchId, taskId }
  const paths = deriveOpsTaskPaths(identity.batchId, identity.taskId, { rootDir })
  if (!existsSync(paths.claimFile)) {
    return null
  }

  return {
    claim: readJsonFile(paths.claimFile, 'result_invalid', 'claim.json'),
    paths,
  }
}

export function writeOpsTaskClaim({ request, claim, rootDir = process.cwd() }) {
  const requestValidation = validateOpsTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    throw new OpsBridgeError(requestValidation.failureKind, requestValidation.reason, { request })
  }

  writeAtomicFile(requestValidation.paths.claimFile, JSON.stringify(claim, null, 2))
  return {
    claim,
    paths: requestValidation.paths,
  }
}

export function removeOpsTaskClaim({ request, batchId, taskId, rootDir = process.cwd() }) {
  const identity = request
    ? { batchId: request.batch_id, taskId: request.task_id }
    : { batchId, taskId }
  const paths = deriveOpsTaskPaths(identity.batchId, identity.taskId, { rootDir })
  if (existsSync(paths.claimFile)) {
    unlinkSync(paths.claimFile)
  }
  return paths
}

export function writeOpsTaskLog({ request, stream, content, rootDir = process.cwd() }) {
  const requestValidation = validateOpsTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    throw new OpsBridgeError(requestValidation.failureKind, requestValidation.reason, { request })
  }
  if (!['stdout', 'stderr'].includes(stream)) {
    throw new OpsBridgeError('result_invalid', `log stream must be stdout|stderr, received ${stream}`, { stream })
  }

  const file = stream === 'stdout' ? requestValidation.paths.stdoutFile : requestValidation.paths.stderrFile
  writeAtomicFile(file, content ?? '')
  return {
    stream,
    file,
    relative_path: stream === 'stdout'
      ? requestValidation.paths.stdoutFileRelative
      : requestValidation.paths.stderrFileRelative,
    paths: requestValidation.paths,
  }
}

export function materializeOpsTaskArtifacts({ request, artifacts, executorId = null, rootDir = process.cwd() }) {
  const requestValidation = validateOpsTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    throw new OpsBridgeError(requestValidation.failureKind, requestValidation.reason, { request })
  }
  if (!Array.isArray(artifacts)) {
    throw new OpsBridgeError('artifact_mismatch', 'artifacts must be an array', { artifacts })
  }

  const specByPath = artifactSpecsByPath(request)
  const producedArtifacts = []

  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object' || !isNonEmptyString(artifact.relative_path)) {
      throw new OpsBridgeError('artifact_mismatch', 'artifact entry must include relative_path', { artifact })
    }
    const spec = specByPath.get(artifact.relative_path)
    if (!spec) {
      throw new OpsBridgeError('artifact_mismatch', `artifact is not declared in request contract: ${artifact.relative_path}`, { artifact })
    }

    const absolutePath = join(rootDir, artifact.relative_path)
    writeAtomicFile(absolutePath, artifact.content ?? '')
    const digest = computeArtifactDigest(absolutePath)
    producedArtifacts.push({
      artifact_kind: spec.artifact_kind,
      relative_path: spec.relative_path,
      required: spec.required,
      media_type: spec.media_type,
      bytes: digest.bytes,
      sha256: digest.sha256,
      producer: {
        actor: 'ops_executor',
        executor_id: executorId || request.executor.executor_id,
      },
    })
  }

  return {
    artifacts: producedArtifacts,
    paths: requestValidation.paths,
  }
}

export function computeArtifactDigest(file) {
  const buffer = readFileSync(file)
  return {
    bytes: statSync(file).size,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

export function verifyOpsArtifactsOnDisk(result, request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const validation = validateOpsTaskResult(result, request, { rootDir })
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

export function createOpsTaskFailureResult(request, failureKind, summary, extra = {}) {
  const timestamps = {
    started_at: extra.started_at || new Date().toISOString(),
    completed_at: extra.completed_at || new Date().toISOString(),
  }

  return {
    schema_version: OPS_TASK_RESULT_SCHEMA_VERSION,
    task_kind: OPS_TASK_KIND,
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'fail',
    failure_kind: failureKind,
    summary,
    exit_code: extra.exit_code ?? null,
    executor: extra.executor || { ...request.executor },
    started_at: timestamps.started_at,
    completed_at: timestamps.completed_at,
    stdout_file: extra.stdout_file || request.exchange.stdout_file,
    stderr_file: extra.stderr_file || request.exchange.stderr_file,
    artifacts: extra.artifacts || [],
  }
}

export function writeOpsTaskResult({ request, result, rootDir = process.cwd() }) {
  const requestValidation = validateOpsTaskRequest(request, { rootDir })
  if (!requestValidation.ok) {
    throw new OpsBridgeError(requestValidation.failureKind, requestValidation.reason, { request })
  }

  const resultValidation = validateOpsTaskResult(result, request, { rootDir })
  if (!resultValidation.ok) {
    throw new OpsBridgeError(resultValidation.failureKind, resultValidation.reason, { request, result })
  }

  const diskValidation = verifyOpsArtifactsOnDisk(result, request, { rootDir })
  if (!diskValidation.ok) {
    throw new OpsBridgeError(diskValidation.failureKind, diskValidation.reason, { request, result })
  }

  const paths = requestValidation.paths
  mkdirSync(paths.taskDir, { recursive: true })

  if (existsSync(paths.resultFile)) {
    const existingResult = readJsonFile(paths.resultFile, 'result_invalid', 'existing result.json')
    const existingValidation = validateOpsTaskResult(existingResult, request, { rootDir })
    if (!existingValidation.ok) {
      throw new OpsBridgeError(existingValidation.failureKind, existingValidation.reason, {
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

  writeAtomicFile(paths.resultFile, JSON.stringify(result, null, 2))
  return {
    status: 'written',
    result,
    paths,
  }
}
