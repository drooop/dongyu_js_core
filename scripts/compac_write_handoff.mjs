import fs from 'node:fs';
import path from 'node:path';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function isoCompact(ts) {
  return new Date(ts).toISOString().replace(/[:.]/g, '-');
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const stdinText = await readStdin();
  const text = typeof stdinText === 'string' ? stdinText : String(stdinText ?? '');

  const outDir = path.resolve(process.cwd(), 'docs', 'tmp');
  ensureDir(outDir);
  const outPath = path.join(outDir, `hadnoff_${isoCompact(Date.now())}.md`);
  fs.writeFileSync(outPath, text, 'utf8');
  process.stdout.write(`${outPath}\n`);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
});
