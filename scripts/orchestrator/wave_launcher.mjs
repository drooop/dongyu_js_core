#!/usr/bin/env bun
/**
 * wave_launcher.mjs — serialized launcher for an existing iteration wave.
 *
 * Usage:
 *   bun scripts/orchestrator/wave_launcher.mjs \
 *     --iterations 0210-a,0211-b \
 *     --wave-prompt-file docs/user-guide/orchestrator_wave_0210_0217_prompt.txt
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

import { loadState, findLatestBatch } from './state.mjs'
import {
  parseIterationList,
  discoverLedgerFollowUps,
  insertIterationsAfterCurrent,
  inspectWaveBatchExtras,
  getIterationLedgerEntry,
  classifyWaveIterationAction,
  classifyWaveBatchOutcome,
  buildWaveIterationPrompt,
} from './wave_launcher_lib.mjs'

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    iterations: '',
    wavePromptFile: null,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--iterations': opts.iterations = args[++i]; break
      case '--wave-prompt-file': opts.wavePromptFile = args[++i]; break
    }
  }

  if (!opts.iterations || !opts.wavePromptFile) {
    console.error('Usage: wave_launcher.mjs --iterations <id1,id2,...> --wave-prompt-file <file>')
    process.exit(1)
  }

  return opts
}

function readIterationsLedger() {
  return readFileSync(join(process.cwd(), 'docs', 'ITERATIONS.md'), 'utf-8')
}

async function runChild(args) {
  return await new Promise((resolve) => {
    const child = spawn('bun', args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    })

    child.on('close', code => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

async function main() {
  const opts = parseArgs()
  let iterationIds = parseIterationList(opts.iterations)
  const wavePrompt = readFileSync(opts.wavePromptFile, 'utf-8').trim()

  process.stderr.write(`[wave] starting serialized wave for ${iterationIds.length} iterations\n`)

  const results = []

  for (let idx = 0; idx < iterationIds.length; idx++) {
    const iterationId = iterationIds[idx]
    const ledgerContent = readIterationsLedger()
    const entry = getIterationLedgerEntry(ledgerContent, iterationId)
    const action = classifyWaveIterationAction(entry)

    if (action.action === 'skip') {
      process.stderr.write(`[wave] skip ${iterationId}: ${action.reason}\n`)
      results.push({ iterationId, action: 'skip', reason: action.reason, batchId: null })
      continue
    }

    if (action.action === 'stop') {
      process.stderr.write(`[wave] stop before ${iterationId}: ${action.reason}\n`)
      process.exit(1)
    }

    const latestBefore = findLatestBatch()
    const ledgerBefore = ledgerContent
    const extraPrompt = buildWaveIterationPrompt(wavePrompt, iterationId, idx + 1, iterationIds.length)

    process.stderr.write(`[wave] run ${iterationId} (${idx + 1}/${iterationIds.length})\n`)

    const exitCode = await runChild([
      'scripts/orchestrator/orchestrator.mjs',
      '--iteration', iterationId,
      '--prompt', extraPrompt,
      '--auto-confirm',
    ])

    const latestAfter = findLatestBatch()
    const batchId = latestAfter && latestAfter !== latestBefore ? latestAfter : latestAfter
    const state = batchId ? loadState(batchId) : null
    const extras = inspectWaveBatchExtras(state, iterationId, iterationIds)
    const outcome = classifyWaveBatchOutcome(state, iterationId)
    const ledgerAfter = readIterationsLedger()
    const followUps = discoverLedgerFollowUps(ledgerBefore, ledgerAfter, iterationId, iterationIds)

    results.push({
      iterationId,
      action: outcome.action,
      reason: outcome.reason,
      batchId,
      exitCode,
      followUps,
    })

    process.stderr.write(
      `[wave] ${iterationId} -> ${outcome.action} (${outcome.reason})` +
      `${batchId ? ` [batch ${batchId.slice(0, 8)}]` : ''}\n`
    )

    if (extras.action === 'stop') {
      process.stderr.write(`[wave] stop on unresolved extra iteration: ${extras.reason}\n`)
      process.exit(1)
    }

    if (followUps.length > 0) {
      iterationIds = insertIterationsAfterCurrent(iterationIds, idx, followUps)
      process.stderr.write(`[wave] inserted follow-up iterations after ${iterationId}: ${followUps.join(', ')}\n`)
    }

    if (exitCode !== 0 || outcome.action !== 'continue') {
      process.stderr.write('[wave] stopped before completing full series\n')
      process.exit(1)
    }
  }

  process.stderr.write('[wave] all iterations completed or skipped\n')
  for (const item of results) {
    process.stderr.write(
      `  - ${item.iterationId}: ${item.action} (${item.reason})` +
      `${item.batchId ? ` [batch ${item.batchId.slice(0, 8)}]` : ''}\n`
    )
  }
}

main().catch((err) => {
  console.error('[wave] fatal error:', err?.stack || err?.message || String(err))
  process.exit(1)
})
