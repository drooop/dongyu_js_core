#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const issuer = 'https://sso.dongyudigital.com';
const projectId = '375910753992966374';
const organizationId = '375910751979700454';
const appName = 'Dongyu App Dev';
const appRedirectUri = 'http://127.0.0.1:9018/auth/sso/callback';
const appLogoutUri = 'http://127.0.0.1:9018/';
const roleDefinitions = [
  { roleKey: 'dongyu.admin', displayName: 'Dongyu Admin', group: 'dongyu' },
  { roleKey: 'dongyu.viewer', displayName: 'Dongyu Viewer', group: 'dongyu' },
];
const targetLogin = 'drop.yang@dongyudigital.com';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function safeError(json) {
  return {
    code: json && json.code,
    message: json && json.message,
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 400) };
  }
}

async function requestJson(pathname, token, body = {}, { method = 'POST' } = {}) {
  const response = await fetch(`${issuer}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'connect-protocol-version': '1',
      'content-type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const json = await parseResponse(response);
  return { ok: response.ok, status: response.status, json };
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
  const json = await parseResponse(response);
  if (!response.ok || !json.access_token) {
    throw new Error(`token_failed:${JSON.stringify(safeError(json))}`);
  }
  return { token: json.access_token, expiresIn: json.expires_in };
}

function assertOk(step, result) {
  if (!result.ok) {
    throw new Error(`${step}_failed:${JSON.stringify({ status: result.status, ...safeError(result.json) })}`);
  }
  return result.json;
}

async function listApplications(token) {
  const json = assertOk('list_applications', await requestJson(
    '/zitadel.application.v2.ApplicationService/ListApplications',
    token,
    { filters: [{ projectIdFilter: { projectId } }] },
  ));
  return Array.isArray(json.applications) ? json.applications : [];
}

async function listRoles(token) {
  const json = assertOk('list_project_roles', await requestJson(
    '/zitadel.project.v2.ProjectService/ListProjectRoles',
    token,
    { projectId },
  ));
  return Array.isArray(json.roles) ? json.roles : [];
}

async function ensureProjectRoleAssertion(token) {
  assertOk('update_project', await requestJson(
    '/zitadel.project.v2.ProjectService/UpdateProject',
    token,
    {
      projectId,
      projectRoleAssertion: true,
      authorizationRequired: false,
    },
  ));
  return { updated: true };
}

async function ensureRoles(token, existingRoles) {
  const existing = new Set(existingRoles.map((role) => role.roleKey || role.key).filter(Boolean));
  const created = [];
  const skipped = [];
  for (const role of roleDefinitions) {
    if (existing.has(role.roleKey)) {
      skipped.push(role.roleKey);
      continue;
    }
    assertOk(`add_role_${role.roleKey}`, await requestJson(
      '/zitadel.project.v2.ProjectService/AddProjectRole',
      token,
      { projectId, ...role },
    ));
    created.push(role.roleKey);
  }
  return { created, skipped };
}

async function ensureDevApplication(token, existingApplications) {
  const existing = existingApplications.find((app) => app.name === appName);
  if (existing) {
    throw new Error(`existing_app_requires_manual_secret_check:${existing.applicationId || existing.id || appName}`);
  }
  const json = assertOk('create_oidc_app', await requestJson(
    '/zitadel.application.v2.ApplicationService/CreateApplication',
    token,
    {
      projectId,
      name: appName,
      oidcConfiguration: {
        redirectUris: [appRedirectUri],
        responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
        grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE'],
        applicationType: 'OIDC_APP_TYPE_WEB',
        authMethodType: 'OIDC_AUTH_METHOD_TYPE_BASIC',
        postLogoutRedirectUris: [appLogoutUri],
        version: 'OIDC_VERSION_1_0',
        developmentMode: true,
        accessTokenType: 'OIDC_TOKEN_TYPE_BEARER',
        idTokenRoleAssertion: true,
        idTokenUserinfoAssertion: false,
      },
    },
  ));
  const oidc = json.oidcConfiguration || {};
  const secretPath = path.resolve('.env.zitadel-devtest');
  const envText = [
    'DY_AUTH=1',
    `DY_OIDC_ISSUER=${issuer}`,
    `DY_OIDC_CLIENT_ID=${oidc.clientId || ''}`,
    `DY_OIDC_CLIENT_SECRET=${oidc.clientSecret || ''}`,
    'DY_OIDC_REDIRECT_URI=http://127.0.0.1:9018/auth/sso/callback',
    'DY_OIDC_SCOPE=openid profile email urn:zitadel:iam:org:project:id:375910753992966374:aud urn:zitadel:iam:org:projects:roles',
    'MATRIX_HOMESERVER_URL=https://matrix.dongyudigital.com',
    '',
  ].join('\n');
  fs.writeFileSync(secretPath, envText, { mode: 0o600 });
  return {
    created: true,
    applicationId: json.applicationId,
    clientId: oidc.clientId || '',
    clientSecretStored: Boolean(oidc.clientSecret),
    secretPath,
    nonCompliant: Boolean(oidc.nonCompliant),
    complianceProblems: Array.isArray(oidc.complianceProblems) ? oidc.complianceProblems.length : 0,
  };
}

async function findTargetUser(token) {
  const json = assertOk('list_users', await requestJson('/v2/users', token, {
    query: { limit: 100 },
  }));
  const users = Array.isArray(json.result) ? json.result : [];
  return users.find((user) => {
    const email = user.human?.email?.email || user.email;
    const logins = [
      user.username,
      user.preferredLoginName,
      user.human?.username,
      user.human?.preferredLoginName,
      ...(Array.isArray(user.loginNames) ? user.loginNames : []),
      ...(Array.isArray(user.human?.loginNames) ? user.human.loginNames : []),
    ].filter(Boolean);
    return email === targetLogin || logins.includes(targetLogin);
  }) || null;
}

async function listAuthorizations(token) {
  const json = assertOk('list_authorizations', await requestJson(
    '/zitadel.authorization.v2.AuthorizationService/ListAuthorizations',
    token,
    { pagination: { limit: 100 } },
  ));
  return Array.isArray(json.authorizations) ? json.authorizations : [];
}

async function ensureAdminAuthorization(token, user) {
  if (!user) throw new Error('target_user_not_found');
  const userId = user.userId || user.human?.userId;
  if (!userId) throw new Error('target_user_id_missing');
  const existing = await listAuthorizations(token);
  const matched = existing.find((auth) => (
    auth.user?.id === userId
    && auth.project?.id === projectId
    && auth.organization?.id === organizationId
  ));
  if (matched) {
    const keys = Array.isArray(matched.roles) ? matched.roles.map((role) => role.key).filter(Boolean) : [];
    if (keys.includes('dongyu.admin')) return { status: 'already_authorized', userId };
  }
  const json = assertOk('create_authorization', await requestJson(
    '/zitadel.authorization.v2.AuthorizationService/CreateAuthorization',
    token,
    {
      userId,
      projectId,
      organizationId,
      roleKeys: ['dongyu.admin'],
    },
  ));
  return { status: 'created', id: json.id, userId };
}

const { token, expiresIn } = await getApiToken();
console.log(JSON.stringify({ step: 'token', ok: true, expiresIn }, null, 2));

const project = assertOk('get_project', await requestJson(
  '/zitadel.project.v2.ProjectService/GetProject',
  token,
  { projectId },
));
console.log(JSON.stringify({ step: 'getProject', name: project.project?.name || project.name }, null, 2));

const applicationsBefore = await listApplications(token);
const rolesBefore = await listRoles(token);
console.log(JSON.stringify({
  step: 'before',
  applications: applicationsBefore.map((app) => ({ id: app.applicationId || app.id, name: app.name })),
  roles: rolesBefore.map((role) => role.roleKey || role.key).filter(Boolean),
}, null, 2));

const projectUpdate = await ensureProjectRoleAssertion(token);
console.log(JSON.stringify({ step: 'projectRoleAssertion', ...projectUpdate }, null, 2));

const rolesResult = await ensureRoles(token, rolesBefore);
console.log(JSON.stringify({ step: 'roles', ...rolesResult }, null, 2));

const applicationsAfterRoles = await listApplications(token);
const appResult = await ensureDevApplication(token, applicationsAfterRoles);
console.log(JSON.stringify({
  step: 'application',
  created: appResult.created,
  applicationId: appResult.applicationId,
  clientId: appResult.clientId,
  clientSecretStored: appResult.clientSecretStored,
  secretPath: appResult.secretPath,
  nonCompliant: appResult.nonCompliant,
  complianceProblems: appResult.complianceProblems,
}, null, 2));

const targetUser = await findTargetUser(token);
console.log(JSON.stringify({
  step: 'targetUser',
  found: Boolean(targetUser),
  userId: targetUser ? (targetUser.userId || targetUser.human?.userId) : undefined,
  preferredLoginName: targetUser ? (targetUser.preferredLoginName || targetUser.human?.preferredLoginName) : undefined,
}, null, 2));

const authorization = await ensureAdminAuthorization(token, targetUser);
console.log(JSON.stringify({ step: 'authorization', ...authorization }, null, 2));
