/**
 * iteration_register.mjs — ITERATIONS.md management (§3)
 *
 * Reads/writes the authoritative iteration index.
 * Idempotent: checks existence before writing.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const ITERATIONS_FILE = join(process.cwd(), 'docs', 'ITERATIONS.md')

// ── Get next iteration ID ───────────────────────────────

export function getNextId() {
  const content = readFileSync(ITERATIONS_FILE, 'utf-8')
  const lines = content.split('\n')

  let maxNum = 0
  for (const line of lines) {
    // Match iteration IDs like "0201-route-sse-page-sync-fix" or "0200a-..."
    const match = line.match(/^\|\s*(\d{4})\w*-/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  return maxNum + 1
}

// ── Format ID with zero-padding ─────────────────────────

export function formatId(num, desc) {
  const padded = String(num).padStart(4, '0')
  return `${padded}-${desc}`
}

// ── Check if iteration already registered ───────────────

export function isRegistered(iterationId) {
  const content = readFileSync(ITERATIONS_FILE, 'utf-8')
  // Match with or without surrounding spaces (updateIterationStatus may strip them)
  const escaped = iterationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\|\\s*${escaped}\\s*\\|`).test(content)
}

// ── Register iteration (idempotent §2.4) ────────────────

export function registerIteration(iterationId, date, title, steps, branch) {
  if (isRegistered(iterationId)) return false // Already exists

  const content = readFileSync(ITERATIONS_FILE, 'utf-8')
  const lines = content.split('\n')

  // Find the "---" separator line after the table
  const separatorIdx = lines.findIndex((line, idx) => {
    return idx > 10 && line.trim() === '---'
  })

  if (separatorIdx === -1) {
    throw new Error('Cannot find table separator in ITERATIONS.md')
  }

  const entry = `| ${iterationId} | ${date} | ${title} | ${steps} | ${branch} | Planned | ./docs/iterations/${iterationId}/ |`

  // Insert before the separator
  lines.splice(separatorIdx, 0, entry)

  writeFileSync(ITERATIONS_FILE, lines.join('\n'))
  return true
}

// ── Update iteration status ─────────────────────────────

export function updateIterationStatus(iterationId, newStatus) {
  const content = readFileSync(ITERATIONS_FILE, 'utf-8')
  const lines = content.split('\n')

  const escaped = iterationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const linePattern = new RegExp(`\\|\\s*${escaped}\\s*\\|`)

  const updated = lines.map(line => {
    if (!linePattern.test(line)) return line

    // Replace status field (6th column) while preserving table formatting.
    // Split on |, update the status column, rejoin with original spacing.
    const parts = line.split('|')
    // parts: ['', ' id ', ' date ', ' theme ', ' steps ', ' branch ', ' status ', ' entry ', '']
    if (parts.length >= 8) {
      parts[6] = ` ${newStatus} `
      return parts.join('|')
    }
    return line
  })

  writeFileSync(ITERATIONS_FILE, updated.join('\n'))
}

// ── Create iteration directory skeleton ─────────────────

export function createIterationSkeleton(iterationId) {
  const dir = join(process.cwd(), 'docs', 'iterations', iterationId)

  if (existsSync(dir)) return false // Already exists

  mkdirSync(dir, { recursive: true })

  // Create minimal plan.md
  writeFileSync(join(dir, 'plan.md'), [
    '---',
    `title: "${iterationId}"`,
    `iteration: ${iterationId}`,
    'doc_type: plan',
    'status: planned',
    `created: ${new Date().toISOString().slice(0, 10)}`,
    'source: ai',
    '---',
    '',
    `# ${iterationId}`,
    '',
    '(to be filled by Codex during PLANNING phase)',
    '',
  ].join('\n'))

  // Create minimal resolution.md
  writeFileSync(join(dir, 'resolution.md'), [
    '---',
    `title: "${iterationId} — resolution"`,
    `iteration: ${iterationId}`,
    'doc_type: resolution',
    'status: planned',
    `created: ${new Date().toISOString().slice(0, 10)}`,
    'source: ai',
    '---',
    '',
    `# Resolution: ${iterationId}`,
    '',
    '(to be filled by Codex during PLANNING phase)',
    '',
  ].join('\n'))

  // Create minimal runlog.md
  writeFileSync(join(dir, 'runlog.md'), [
    '---',
    `title: "${iterationId} — runlog"`,
    `iteration: ${iterationId}`,
    'doc_type: runlog',
    `created: ${new Date().toISOString().slice(0, 10)}`,
    '---',
    '',
    `# Runlog: ${iterationId}`,
    '',
    '## Environment',
    '',
    `- Branch: dropx/dev_${iterationId}`,
    '',
    '## Review Gate Records',
    '',
    '## Execution Log',
    '',
  ].join('\n'))

  return true
}

// ── Append review gate record to runlog ─────────────────

export function appendReviewGateRecord(iterationId, record) {
  const runlogPath = join(process.cwd(), 'docs', 'iterations', iterationId, 'runlog.md')
  const content = readFileSync(runlogPath, 'utf-8')

  const phase = record.phase || 'REVIEW'

  const entry = [
    '',
    '```',
    'Review Gate Record',
    `- Iteration ID: ${iterationId}`,
    `- Review Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Review Type: AI-assisted (doit-auto orchestrated)`,
    `- Phase: ${phase}`,
    `- Review Index: ${record.round}`,
    `- Decision: ${record.verdict}`,
    `- Revision Type: ${record.revision_type || 'N/A'}`,
    `- Notes: ${record.summary || ''}`,
    '```',
    '',
  ].join('\n')

  writeFileSync(runlogPath, content + entry)
}
