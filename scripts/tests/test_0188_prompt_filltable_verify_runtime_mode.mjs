#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const verifyScript = fs.readFileSync(path.join(repoRoot, 'scripts/ops/verify_0155_prompt_filltable.sh'), 'utf8');

assert.match(
  verifyScript,
  /POST\s+"\$BASE_URL\/api\/runtime\/mode"/,
  'verify_0155_prompt_filltable.sh must activate runtime mode before preview/apply',
);

assert.match(
  verifyScript,
  /\{"mode":"running"\}/,
  'verify_0155_prompt_filltable.sh must request runtime mode=running',
);

console.log('test_0188_prompt_filltable_verify_runtime_mode: PASS');
