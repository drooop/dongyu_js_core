#!/usr/bin/env node

const issuer = 'https://sso.dongyudigital.com';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

async function getApiToken() {
  const clientId = requireEnv('ZITADEL_DEVTEST_CLIENT_ID');
  const clientSecret = requireEnv('ZITADEL_DEVTEST_CLIENT_SECRET');
  const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
  const response = await fetch(`${issuer}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'openid profile urn:zitadel:iam:org:project:id:zitadel:aud',
    }),
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) throw new Error('token_failed');
  return json.access_token;
}

const token = await getApiToken();
const response = await fetch(`${issuer}/auth/v1/permissions/zitadel/me/_search`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
    'content-type': 'application/json',
  },
  body: JSON.stringify({}),
});
const json = await response.json().catch(() => ({}));
const permissions = Array.isArray(json.result) ? json.result : [];
console.log(JSON.stringify({
  status: response.status,
  count: permissions.length,
  permissions,
}, null, 2));
