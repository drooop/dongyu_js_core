export const DESKTOP_FOREGROUND_APP_LABEL = 'desktop_foreground_app_json';
export const DESKTOP_TASK_STACK_LABEL = 'desktop_task_stack_json';
export const DESKTOP_TASK_SWITCHER_OPEN_LABEL = 'desktop_task_switcher_open';
export const DESKTOP_APP_DETAIL_DRAWER_OPEN_LABEL = 'desktop_app_detail_drawer_open';
export const DESKTOP_APP_VIEW_MODE_LABEL = 'desktop_app_view_mode';
export const DESKTOP_APP_MANAGE_MODE_LABEL = 'desktop_app_manage_mode';
export const DESKTOP_DELETE_CONFIRM_OPEN_LABEL = 'desktop_delete_confirm_open';
export const DESKTOP_DELETE_CONFIRM_TARGET_LABEL = 'desktop_delete_confirm_target_json';
export const DESKTOP_DELETE_RESULT_OPEN_LABEL = 'desktop_delete_result_open';

function getStateRootLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

export function normalizeDesktopAppTableId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'host';
}

export function desktopAppRefKey(value) {
  if (!value || !Number.isInteger(value.model_id)) return '';
  return `${normalizeDesktopAppTableId(value.table_id)}|${value.model_id}`;
}

export function desktopTaskKey(value) {
  const app = normalizeDesktopForegroundApp(value);
  if (!app) return '';
  const refKey = app.page === 'workspace' ? desktopAppRefKey(app) : '';
  return refKey || app.id;
}

function readWorkspaceAppRegistryModelRefs(snapshot) {
  const labels = getStateRootLabels(snapshot);
  const registry = labels.ws_apps_registry?.v;
  if (!Array.isArray(registry)) return null;
  const refs = new Set();
  for (const entry of registry) {
    const key = desktopAppRefKey(entry);
    if (key) refs.add(key);
  }
  return refs;
}

export function normalizeDesktopForegroundApp(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const page = typeof value.page === 'string' ? value.page.trim().toLowerCase() : '';
  const path = typeof value.path === 'string' ? value.path.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const kind = typeof value.kind === 'string' ? value.kind.trim().toLowerCase() : '';
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!id || !page || !path) return null;
  const app = {
    id,
    kind: kind || (page === 'workspace' ? 'workspace' : 'system'),
    page,
    path,
    title: title || id,
  };
  if (Number.isInteger(value.model_id)) {
    app.model_id = value.model_id;
  }
  if (typeof value.table_id === 'string' && value.table_id.trim()) {
    app.table_id = value.table_id.trim();
  }
  return app;
}

export function readDesktopForegroundApp(snapshot) {
  const labels = getStateRootLabels(snapshot);
  const raw = labels[DESKTOP_FOREGROUND_APP_LABEL]?.v;
  return normalizeDesktopForegroundApp(raw);
}

export function readDesktopForegroundWorkspaceModelId(snapshot) {
  const app = readDesktopForegroundApp(snapshot);
  if (!app || app.page !== 'workspace' || !Number.isInteger(app.model_id)) return null;
  return app.model_id;
}

export function normalizeDesktopTaskStack(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const app = normalizeDesktopForegroundApp(item);
    const taskKey = desktopTaskKey(app);
    if (!app || !taskKey || seen.has(taskKey)) continue;
    out.push(app);
    seen.add(taskKey);
  }
  return out;
}

export function readDesktopTaskStack(snapshot) {
  const labels = getStateRootLabels(snapshot);
  return normalizeDesktopTaskStack(labels[DESKTOP_TASK_STACK_LABEL]?.v);
}

export function isAvailableDesktopApp(snapshot, value) {
  const app = normalizeDesktopForegroundApp(value);
  if (!app) return false;
  if (app.page !== 'workspace') return true;
  if (!Number.isInteger(app.model_id)) return false;
  const registryModelRefs = readWorkspaceAppRegistryModelRefs(snapshot);
  if (registryModelRefs === null) return false;
  return registryModelRefs.has(desktopAppRefKey(app));
}

export function readAvailableDesktopForegroundApp(snapshot) {
  const app = readDesktopForegroundApp(snapshot);
  return app && isAvailableDesktopApp(snapshot, app) ? app : null;
}

export function readAvailableDesktopTaskStack(snapshot) {
  return readDesktopTaskStack(snapshot).filter((task) => isAvailableDesktopApp(snapshot, task));
}

export function readDesktopTaskSwitcherOpen(snapshot) {
  const labels = getStateRootLabels(snapshot);
  return labels[DESKTOP_TASK_SWITCHER_OPEN_LABEL]?.v === true;
}

export function deriveDesktopTaskStack(currentValue, foregroundValue, options = {}) {
  const foreground = normalizeDesktopForegroundApp(foregroundValue);
  const current = normalizeDesktopTaskStack(currentValue);
  if (!foreground) return current;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 12;
  const foregroundKey = desktopTaskKey(foreground);
  return [
    foreground,
    ...current.filter((item) => desktopTaskKey(item) !== foregroundKey),
  ].slice(0, limit);
}

export function removeDesktopTaskFromStack(currentValue, targetTask) {
  const targetKey = desktopTaskKey(targetTask);
  if (!targetKey) return normalizeDesktopTaskStack(currentValue);
  return normalizeDesktopTaskStack(currentValue).filter((task) => desktopTaskKey(task) !== targetKey);
}
