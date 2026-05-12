export const DESKTOP_FOREGROUND_APP_LABEL = 'desktop_foreground_app_json';
export const DESKTOP_TASK_STACK_LABEL = 'desktop_task_stack_json';
export const DESKTOP_TASK_SWITCHER_OPEN_LABEL = 'desktop_task_switcher_open';

function getStateRootLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
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
    if (!app || seen.has(app.id)) continue;
    out.push(app);
    seen.add(app.id);
  }
  return out;
}

export function readDesktopTaskStack(snapshot) {
  const labels = getStateRootLabels(snapshot);
  return normalizeDesktopTaskStack(labels[DESKTOP_TASK_STACK_LABEL]?.v);
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
  return [
    foreground,
    ...current.filter((item) => item.id !== foreground.id),
  ].slice(0, limit);
}
