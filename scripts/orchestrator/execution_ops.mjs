import { materializeOpsTaskRequests } from './drivers.mjs'
import {
  findIteration,
  ingestOpsTaskResult,
  recordOpsTaskRequest,
} from './state.mjs'
import { emitOpsTask, emitTransition } from './events.mjs'
import { appendOpsTaskRunlogRecord } from './iteration_register.mjs'

export function handleExecutionOpsTaskCycle({
  state,
  iterationId,
  execOutput = null,
  rootDir = process.cwd(),
  runlogPath = null,
}) {
  const iter = findIteration(state, iterationId)
  if (!iter) {
    throw new Error(`Iteration ${iterationId} not found`)
  }

  const pendingOpsTask = iter.evidence?.ops_tasks?.find(task => task.status === 'pending') || null
  if (pendingOpsTask) {
    const ingest = ingestOpsTaskResult(state, iterationId, { rootDir })

    if (ingest.status === 'awaiting_result') {
      return {
        handled: true,
        action: 'await_ops_result',
        status: 'awaiting_result',
        ops_task: ingest.ops_task,
      }
    }

    if (ingest.ops_task) {
      emitOpsTask(state, iterationId, ingest.ops_task)
    }

    if (!ingest.ok) {
      appendRunlogSafely(iterationId, ingest.ops_task, runlogPath)
      return {
        handled: true,
        action: 'ops_task_failed',
        status: 'fail',
        failure_kind: ingest.failure_kind,
        ops_task: ingest.ops_task,
      }
    }

    const previousPhase = iter.phase
    iter.phase = 'REVIEW_EXEC'
    iter.last_checkpoint = 'REVIEW_EXEC:ops_task_pass'
    iter.review_round = 0
    iter.consecutive_approvals = 0
    emitTransition(state, iterationId, previousPhase, 'REVIEW_EXEC')
    appendRunlogSafely(iterationId, ingest.ops_task, runlogPath)

    return {
      handled: true,
      action: 'review_exec',
      status: 'pass',
      ops_task: ingest.ops_task,
    }
  }

  const opsTasks = Array.isArray(execOutput?.ops_tasks) ? execOutput.ops_tasks : []
  if (opsTasks.length === 0) {
    return { handled: false, action: 'none' }
  }

  const hasBrowserTasks = Array.isArray(execOutput?.browser_tasks) && execOutput.browser_tasks.length > 0
  if (hasBrowserTasks) {
    return {
      handled: true,
      action: 'external_task_conflict',
      error: 'Execution output cannot mix browser_tasks and ops_tasks in the same step',
      failure_kind: 'request_invalid',
    }
  }

  const materialized = materializeOpsTaskRequests({
    batchId: state.batch_id,
    iterationId,
    opsTasks,
    rootDir,
  })

  if (!materialized.ok) {
    return {
      handled: true,
      action: 'ops_task_materialize_failed',
      error: materialized.error,
      failure_kind: materialized.failure_kind || 'request_invalid',
    }
  }

  for (const opsTask of materialized.tasks) {
    const pendingRecord = recordOpsTaskRequest(state, iterationId, {
      task_id: opsTask.request.task_id,
      attempt: opsTask.request.attempt,
      request_file: opsTask.paths.requestFileRelative,
      result_file: opsTask.paths.resultFileRelative,
      stdout_file: opsTask.paths.stdoutFileRelative,
      stderr_file: opsTask.paths.stderrFileRelative,
      artifact_paths: opsTask.request.required_artifacts.map(artifact => artifact.relative_path),
    })
    emitOpsTask(state, iterationId, pendingRecord)
  }

  return {
    handled: true,
    action: 'await_ops_result',
    status: 'pending',
    ops_tasks: materialized.tasks.map(task => ({
      task_id: task.request.task_id,
      request_file: task.paths.requestFileRelative,
      result_file: task.paths.resultFileRelative,
      stdout_file: task.paths.stdoutFileRelative,
      stderr_file: task.paths.stderrFileRelative,
    })),
  }
}

function appendRunlogSafely(iterationId, opsTask, runlogPath) {
  if (!opsTask) {
    return
  }

  try {
    appendOpsTaskRunlogRecord(iterationId, opsTask, runlogPath ? { runlogPath } : {})
  } catch {
    // runIteration handles authoritative stop/continue semantics;
    // runlog append remains best-effort here.
  }
}
