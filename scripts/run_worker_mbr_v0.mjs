#!/usr/bin/env node
/**
 * Deprecated local MBR entrypoint.
 * Default path is K8s deployment: deployment/mbr-worker.
 *
 * To run legacy local MBR temporarily:
 *   ALLOW_LEGACY_MBR=1 node scripts/run_worker_mbr_v0.mjs
 */

if (process.env.ALLOW_LEGACY_MBR === '1') {
  await import('../archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs');
} else {
  const lines = [
    '[DEPRECATED] scripts/run_worker_mbr_v0.mjs is archived and disabled by default.',
    'Use K8s runtime baseline instead:',
    '  kubectl scale deploy/mbr-worker deploy/remote-worker -n default --replicas=1',
    'Legacy fallback (temporary only):',
    '  ALLOW_LEGACY_MBR=1 node scripts/run_worker_mbr_v0.mjs',
    'Archived source: archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs',
  ];
  process.stderr.write(lines.join('\n') + '\n');
  process.exit(2);
}
