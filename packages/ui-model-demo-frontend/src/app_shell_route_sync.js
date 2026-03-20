import {
  normalizeHashPath,
  ROUTE_HOME,
  ROUTE_WORKSPACE,
} from './router.js';
import { findPageEntryByPath } from './page_asset_resolver.js';

function getStateLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

function readLabelValue(labels, key) {
  const label = labels && typeof labels === 'object' ? labels[key] : null;
  return label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : null;
}

function normalizeInt(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
  return null;
}

function routePage(snapshot, routePath) {
  const entry = findPageEntryByPath(snapshot, routePath);
  if (entry && typeof entry.page === 'string' && entry.page.trim().length > 0) {
    return entry.page;
  }
  return normalizeHashPath(routePath) === '/' ? 'home' : 'home';
}

export function resolveNavigableRoutePath(snapshot, routePath) {
  const normalized = normalizeHashPath(routePath);
  const labels = getStateLabels(snapshot);
  const catalog = Array.isArray(readLabelValue(labels, 'ui_page_catalog_json'))
    ? readLabelValue(labels, 'ui_page_catalog_json')
    : [];

  if (normalized === '/model100') {
    return ROUTE_WORKSPACE;
  }
  if (catalog.length === 0) {
    return normalized;
  }
  if (findPageEntryByPath(snapshot, normalized)) {
    return normalized;
  }
  return ROUTE_HOME;
}

export function readAppShellRouteSyncState(snapshot, routePath) {
  const targetPage = routePage(snapshot, routePath);
  if (targetPage === 'home') return { pending: false, targetPage };

  const labels = getStateLabels(snapshot);
  const currentPage = String(readLabelValue(labels, 'ui_page') ?? '').trim().toLowerCase();

  if (targetPage !== 'workspace') {
    return { pending: false, targetPage, currentPage };
  }

  const wsSelected = normalizeInt(readLabelValue(labels, 'ws_app_selected'));
  const selectedModelId = normalizeInt(readLabelValue(labels, 'selected_model_id'));
  if (!Number.isInteger(wsSelected) || wsSelected === 0) {
    return { pending: true, targetPage, currentPage, wsSelected, selectedModelId };
  }
  return { pending: false, targetPage, currentPage, wsSelected, selectedModelId };
}
