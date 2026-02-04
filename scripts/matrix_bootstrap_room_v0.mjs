import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sdk = require('matrix-js-sdk');

function requireEnv(keys) {
  const out = {};
  const missing = [];
  for (const k of keys) {
    const v = process.env[k];
    if (!v) missing.push(k);
    out[k] = v || '';
  }
  if (missing.length > 0) {
    throw new Error(`missing_env:${missing.join(',')}`);
  }
  return out;
}

async function main() {
  const baseUrl = requireEnv(['MATRIX_HOMESERVER_URL']).MATRIX_HOMESERVER_URL;
  const hasToken = Boolean(process.env.MATRIX_MBR_ACCESS_TOKEN);

  let client = null;
  if (hasToken) {
    const userId = process.env.MATRIX_MBR_USER || null;
    client = sdk.createClient({ baseUrl, accessToken: process.env.MATRIX_MBR_ACCESS_TOKEN, userId });
  } else {
    const env = requireEnv(['MATRIX_MBR_USER', 'MATRIX_MBR_PASSWORD']);
    const tmp = sdk.createClient({ baseUrl });
    const login = await tmp.login('m.login.password', {
      identifier: { type: 'm.id.user', user: env.MATRIX_MBR_USER },
      password: env.MATRIX_MBR_PASSWORD,
    });
    client = sdk.createClient({ baseUrl, accessToken: login.access_token, userId: login.user_id });
  }

  const res = await client.createRoom({
    visibility: 'private',
    preset: 'private_chat',
    name: `dy-bus-test-${Date.now()}`,
  });

  const roomId = res && res.room_id ? String(res.room_id) : '';
  if (!roomId.startsWith('!')) {
    throw new Error('create_room_failed');
  }
  process.stdout.write(`ROOM_ID=${roomId}\n`);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
});
