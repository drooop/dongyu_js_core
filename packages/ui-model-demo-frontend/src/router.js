export const ROUTE_HOME = '/';
export const ROUTE_GALLERY = '/gallery';
export const ROUTE_TEST = '/test';
export const ROUTE_PIN = '/pin';
export const ROUTE_DOCS = '/docs';
export const ROUTE_STATIC = '/static';

export function normalizeHashPath(value) {
  let s = value === undefined || value === null ? '' : String(value);
  if (s.startsWith('#')) s = s.slice(1);
  if (s.startsWith('!')) s = s.slice(1);
  s = s.trim();
  if (s.length === 0) return ROUTE_HOME;

  const pathOnly = s.split('?')[0];
  let p = String(pathOnly || '').trim();
  if (p.length === 0) return ROUTE_HOME;
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

export function getHashPath() {
  if (typeof window === 'undefined' || !window.location) return ROUTE_HOME;
  return normalizeHashPath(window.location.hash);
}

export function setHashPath(path, options) {
  if (typeof window === 'undefined' || !window.location) return;
  const p = normalizeHashPath(path);
  const hash = `#${p}`;
  const replace = Boolean(options && options.replace);
  if (replace && window.history && typeof window.history.replaceState === 'function') {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', url);
    return;
  }
  window.location.hash = hash;
}

export function isHomePath(path) {
  return normalizeHashPath(path) === ROUTE_HOME;
}

export function isGalleryPath(path) {
  return normalizeHashPath(path) === ROUTE_GALLERY;
}

export function isTestPath(path) {
  return normalizeHashPath(path) === ROUTE_TEST;
}

export function isPinPath(path) {
  return normalizeHashPath(path) === ROUTE_PIN;
}

export function isDocsPath(path) {
  return normalizeHashPath(path) === ROUTE_DOCS;
}

export function isStaticPath(path) {
  return normalizeHashPath(path) === ROUTE_STATIC;
}

export function subscribeHashPath(onChange) {
  if (typeof window === 'undefined') return () => {};
  if (typeof onChange !== 'function') return () => {};
  const handler = () => onChange(getHashPath());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
