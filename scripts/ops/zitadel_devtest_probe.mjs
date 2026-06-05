#!/usr/bin/env node

const issuer = 'https://sso.dongyudigital.com';
const projectId = '375910753992966374';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

async function requestJson(path, token, body = {}) {
  const response = await fetch(`${issuer}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'connect-protocol-version': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
  }
  return { status: response.status, json };
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
  const text = await response.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
  }
  if (!response.ok) {
    return { ok: false, status: response.status, error: json.error || json.code || 'token_request_failed' };
  }
  if (!json.access_token) return { ok: false, status: response.status, error: 'token_missing' };
  return {
    ok: true,
    token: json.access_token,
    tokenType: json.token_type,
    expiresIn: json.expires_in,
  };
}

function summarizeApplications(json) {
  const items = json.result || json.applications || json.applicationsResult || [];
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: item.id || item.applicationId || item.appId || item.details?.id,
    name: item.name || item.appName || item.oidcConfiguration?.name,
  }));
}

function summarizeRoles(json) {
  const items = json.result || json.roles || [];
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    roleKey: item.roleKey || item.key,
    displayName: item.displayName || item.name,
  }));
}

const tokenResult = await getApiToken();
if (!tokenResult.ok) {
  console.log(JSON.stringify({ step: 'token', ok: false, status: tokenResult.status, error: tokenResult.error }, null, 2));
  process.exit(1);
}

const token = tokenResult.token;
console.log(JSON.stringify({
  step: 'token',
  ok: true,
  tokenType: tokenResult.tokenType,
  expiresIn: tokenResult.expiresIn,
}, null, 2));

const project = await requestJson('/zitadel.project.v2.ProjectService/GetProject', token, { projectId });
console.log(JSON.stringify({
  step: 'getProject',
  status: project.status,
  code: project.json.code,
  name: project.json.project?.name || project.json.name,
}, null, 2));

const applications = await requestJson('/zitadel.application.v2.ApplicationService/ListApplications', token, { projectId });
console.log(JSON.stringify({
  step: 'listApplications',
  status: applications.status,
  code: applications.json.code,
  applications: summarizeApplications(applications.json),
}, null, 2));

const roles = await requestJson('/zitadel.project.v2.ProjectService/ListProjectRoles', token, { projectId });
console.log(JSON.stringify({
  step: 'listProjectRoles',
  status: roles.status,
  code: roles.json.code,
  roles: summarizeRoles(roles.json),
}, null, 2));
