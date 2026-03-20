/**
 * drivers.mjs — CLI tool drivers (§13)
 *
 * Codex CLI (doit role): codex exec for planning and execution
 * Claude Code CLI (ultrawork role): claude -p for review
 *
 * Each call captures output to transcript files.
 * Claude Code session_id is extracted from JSON output.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { transcriptsDir } from './state.mjs'

// Ensure transcript directory exists before writing (needed for decompose
// which runs before any state/batch is created).
function ensureTranscriptDir(batchId) {
  const dir = transcriptsDir(batchId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// ── Codex exec (doit) ──────────────────────────────────

export function codexExec(batchId, iterationId, prompt, opts = {}) {
  ensureTranscriptDir(batchId)
  const sandbox = opts.sandbox || 'workspace-write'
  const model = opts.model || 'gpt-5.4'
  const transcriptFile = join(transcriptsDir(batchId), `${iterationId}_${opts.phase || 'exec'}.json`)

  const promptFile = join(transcriptsDir(batchId), `${iterationId}_${opts.phase || 'exec'}_prompt.txt`)
  writeFileSync(promptFile, prompt)

  try {
    const result = execSync(
      `codex exec --full-auto -s ${sandbox} -m ${model} ` +
      `--ephemeral ` +
      `-o ${transcriptFile} ` +
      `- < ${promptFile}`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: opts.timeout || 600_000,
        stdio: ['pipe', 'pipe', 'inherit'], // stderr passes through for real-time progress
      }
    )

    // Read the output file
    let output = ''
    try {
      output = readFileSync(transcriptFile, 'utf-8')
    } catch {
      output = result // fallback to stdout
    }

    return {
      ok: true,
      output,
      stdout: result,
      transcript_file: transcriptFile,
    }
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      transcript_file: transcriptFile,
    }
  }
}

// ── Claude Code review (ultrawork) ─────────────────────

export function claudeReview(batchId, iterationId, prompt, opts = {}) {
  ensureTranscriptDir(batchId)
  const model = opts.model || 'opus'
  const maxTurns = opts.maxTurns || 10
  const phase = opts.phase || 'review'
  const round = opts.round || 0
  const continueSession = opts.continueSession || false

  const transcriptFile = join(
    transcriptsDir(batchId),
    `${iterationId}_${phase}_r${round}.json`
  )

  const promptFile = join(
    transcriptsDir(batchId),
    `${iterationId}_${phase}_r${round}_prompt.txt`
  )
  writeFileSync(promptFile, prompt)

  // §13.1: review = read-only + can run tests, no edits
  const allowedTools = [
    'Read', 'Grep', 'Glob',
    'Bash(git:*)', 'Bash(node:*)', 'Bash(bun:*)',
    'Agent', 'Skill',
  ].join(',')

  const continueFlag = continueSession ? '-c' : ''

  try {
    const result = execSync(
      `cat ${promptFile} | claude -p ${continueFlag} ` +
      `--model ${model} ` +
      `--output-format json ` +
      `--max-turns ${maxTurns} ` +
      `--allowedTools "${allowedTools}"`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: opts.timeout || 600_000,
        stdio: ['pipe', 'pipe', 'inherit'],
      }
    )

    // Save raw transcript
    writeFileSync(transcriptFile, result)

    // Parse JSON output
    let parsed
    try {
      parsed = JSON.parse(result)
    } catch {
      return {
        ok: false,
        error: 'Failed to parse Claude Code JSON output',
        raw: result,
        transcript_file: transcriptFile,
        session_id: null,
      }
    }

    // Extract session_id for Auto-Approval audit (§5.3)
    const sessionId = parsed.session_id || null

    // Extract the result text
    const resultText = parsed.result || ''

    return {
      ok: true,
      result_text: resultText,
      session_id: sessionId,
      num_turns: parsed.num_turns || 0,
      transcript_file: transcriptFile,
      raw_parsed: parsed,
    }
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      transcript_file: transcriptFile,
      session_id: null,
    }
  }
}

// ── Parse verdict from Claude Code result text ─────────

export function parseVerdict(resultText) {
  // Try to find JSON block in result text
  // Claude Code outputs the verdict as JSON within its response text
  const jsonPatterns = [
    // Fenced code block with json
    /```json\s*\n?([\s\S]*?)\n?\s*```/,
    // Raw JSON object with verdict field
    /(\{[\s\S]*?"verdict"[\s\S]*?\})\s*$/,
    // JSON anywhere in text
    /(\{[\s\S]*?"verdict"\s*:\s*"(?:APPROVED|NEEDS_CHANGES)"[\s\S]*?\})/,
  ]

  for (const pattern of jsonPatterns) {
    const match = resultText.match(pattern)
    if (match) {
      try {
        const parsed = JSON.parse(match[1] || match[0])
        if (parsed.verdict) return { ok: true, verdict: parsed }
      } catch {
        continue
      }
    }
  }

  return {
    ok: false,
    error: 'Could not parse verdict from review output',
    raw: resultText.slice(-500),
  }
}

// ── Parse final verification result ─────────────────────

export function parseFinalVerdict(resultText) {
  const jsonPatterns = [
    /```json\s*\n?([\s\S]*?)\n?\s*```/,
    /(\{[\s\S]*?"all_goals_met"[\s\S]*?\})\s*$/,
    /(\{[\s\S]*?"goal_results"[\s\S]*?\})/,
  ]

  for (const pattern of jsonPatterns) {
    const match = resultText.match(pattern)
    if (match) {
      try {
        const parsed = JSON.parse(match[1] || match[0])
        if ('all_goals_met' in parsed) return { ok: true, result: parsed }
      } catch {
        continue
      }
    }
  }

  return {
    ok: false,
    error: 'Could not parse final verification from review output',
    raw: resultText.slice(-500),
  }
}

// ── Parse exec output from Codex result ────────────────

export function parseExecOutput(outputText) {
  const jsonPatterns = [
    /```json\s*\n?([\s\S]*?)\n?\s*```/,
    /(\{[\s\S]*?"execution_summary"[\s\S]*?\})\s*$/,
  ]

  for (const pattern of jsonPatterns) {
    const match = outputText.match(pattern)
    if (match) {
      try {
        return { ok: true, output: JSON.parse(match[1] || match[0]) }
      } catch {
        continue
      }
    }
  }

  // If no structured output, return raw as summary
  return {
    ok: true,
    output: {
      execution_summary: outputText.slice(-2000),
      steps_completed: [],
      spawned_iterations: [],
    },
  }
}
