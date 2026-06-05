import { reactive } from 'vue';

export function createAuthStore({ baseUrl }) {
  const normalizedBaseUrl = typeof baseUrl === 'string' && baseUrl.trim()
    ? baseUrl.replace(/\/$/, '')
    : '';
  const state = reactive({
    loading: false,
    authenticated: false,
    provider: '',
    subject: '',
    email: '',
    username: '',
    userId: '',
    displayName: '',
    homeserverUrl: '',
    matrixUserId: '',
    roles: [],
    capabilities: [],
    matrixConnected: false,
    homeservers: [],
    loginError: '',
    authIssue: null,
  });

  function clearPrincipal() {
    state.authenticated = false;
    state.provider = '';
    state.subject = '';
    state.email = '';
    state.username = '';
    state.userId = '';
    state.displayName = '';
    state.homeserverUrl = '';
    state.matrixUserId = '';
    state.roles = [];
    state.capabilities = [];
    state.matrixConnected = false;
  }

  function currentReturnTo() {
    if (typeof window === 'undefined' || !window.location) return '/';
    const { pathname, search, hash } = window.location;
    return `${pathname || '/'}${search || ''}${hash || ''}`;
  }

  function isPageReturnTo(returnTo) {
    if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || returnTo.startsWith('//')) return false;
    if (returnTo === '/bus_event' || returnTo === '/ui_event') return false;
    if (returnTo.startsWith('/api/')) return false;
    if (returnTo.startsWith('/auth/')) return false;
    if (returnTo === '/snapshot' || returnTo === '/stream') return false;
    return true;
  }

  function normalizeReturnTo(returnTo) {
    if (isPageReturnTo(returnTo)) {
      return returnTo;
    }
    return currentReturnTo();
  }

  function clearAuthIssue() {
    state.authIssue = null;
  }

  function handleAuthFailure(input = {}) {
    const error = input.error || input.code || 'permission_denied';
    const kind = error === 'login_required' || error === 'not_authenticated'
      ? 'login_required'
      : 'permission_denied';
    if (kind === 'login_required') {
      clearPrincipal();
    } else if (error === 'matrix_session_missing') {
      state.matrixConnected = false;
      state.homeserverUrl = '';
      state.matrixUserId = '';
    }
    state.authIssue = {
      kind,
      error,
      returnTo: normalizeReturnTo(input.returnTo),
      requiredCapability: input.requiredCapability || '',
      at: Date.now(),
    };
  }

  function loginWithSso(options = {}) {
    const returnTo = normalizeReturnTo(options.returnTo);
    const target = `${normalizedBaseUrl}/auth/sso/start?returnTo=${encodeURIComponent(returnTo)}`;
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(target);
    }
    return target;
  }

  async function checkSession() {
    state.loading = true;
    try {
      const resp = await fetch(`${normalizedBaseUrl}/auth/me`, { credentials: 'same-origin' });
      if (resp.ok) {
        const data = await resp.json();
        state.authenticated = true;
        state.provider = data.provider || '';
        state.subject = data.subject || data.userId || '';
        state.email = data.email || '';
        state.username = data.username || '';
        state.userId = data.userId || data.subject || '';
        state.displayName = data.displayName || data.username || data.email || data.userId || '';
        state.homeserverUrl = data.homeserverUrl || '';
        state.matrixUserId = data.matrixUserId || '';
        state.roles = Array.isArray(data.roles) ? data.roles : [];
        state.capabilities = Array.isArray(data.capabilities) ? data.capabilities : [];
        state.matrixConnected = data.matrixConnected === true;
        state.loginError = '';
        clearAuthIssue();
      } else {
        clearPrincipal();
      }
    } catch (_) {
      clearPrincipal();
    } finally {
      state.loading = false;
    }
  }

  async function fetchHomeservers() {
    try {
      const resp = await fetch(`${normalizedBaseUrl}/auth/homeservers`, { credentials: 'same-origin' });
      if (resp.ok) {
        const data = await resp.json();
        state.homeservers = Array.isArray(data.homeservers) ? data.homeservers : [];
      }
    } catch (_) {
      // keep existing list
    }
  }

  async function login(username, password, homeserverUrl) {
    state.loading = true;
    state.loginError = '';
    try {
      const resp = await fetch(`${normalizedBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, homeserverUrl }),
        credentials: 'same-origin',
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        state.authenticated = true;
        state.provider = data.provider || 'matrix';
        state.subject = data.subject || data.userId || '';
        state.email = data.email || '';
        state.username = data.username || '';
        state.userId = data.userId || '';
        state.displayName = data.displayName || '';
        state.homeserverUrl = data.homeserverUrl || '';
        state.matrixUserId = data.matrixUserId || data.userId || '';
        state.roles = Array.isArray(data.roles) ? data.roles : [];
        state.capabilities = Array.isArray(data.capabilities) ? data.capabilities : ['matrix:connect'];
        state.matrixConnected = data.matrixConnected !== false;
        state.loginError = '';
        clearAuthIssue();
        await fetchHomeservers();
      } else {
        state.loginError = data.error || 'login_failed';
      }
    } catch (err) {
      state.loginError = err && err.message ? err.message : 'network_error';
    } finally {
      state.loading = false;
    }
  }

  async function logoutUser() {
    try {
      await fetch(`${normalizedBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (_) {
      // best-effort
    }
    clearPrincipal();
    clearAuthIssue();
  }

  function connectMatrix(options = {}) {
    const returnTo = normalizeReturnTo(options.returnTo);
    const params = new URLSearchParams({ returnTo });
    const homeserverUrl = typeof options.homeserverUrl === 'string' && options.homeserverUrl.trim()
      ? options.homeserverUrl.trim()
      : '';
    if (homeserverUrl) params.set('homeserverUrl', homeserverUrl);
    const target = `${normalizedBaseUrl}/auth/matrix/start?${params.toString()}`;
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(target);
    }
    return target;
  }

  async function fetchMatrixStatus() {
    try {
      const resp = await fetch(`${normalizedBaseUrl}/auth/matrix/status`, { credentials: 'same-origin' });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        handleAuthFailure(data);
        return false;
      }
      state.matrixConnected = data.matrixConnected === true;
      state.homeserverUrl = data.homeserverUrl || '';
      state.matrixUserId = data.matrixUserId || '';
      return true;
    } catch (_) {
      return false;
    }
  }

  async function disconnectMatrix() {
    try {
      const resp = await fetch(`${normalizedBaseUrl}/auth/matrix/disconnect`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        handleAuthFailure(data);
        return false;
      }
      state.matrixConnected = data.matrixConnected === true;
      state.homeserverUrl = data.homeserverUrl || '';
      state.matrixUserId = data.matrixUserId || '';
      return true;
    } catch (_) {
      return false;
    }
  }

  async function deleteHomeserver(url) {
    try {
      const resp = await fetch(`${normalizedBaseUrl}/auth/homeservers?url=${encodeURIComponent(url)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        handleAuthFailure(data);
        return;
      }
      state.homeservers = state.homeservers.filter(
        item => (typeof item === 'string' ? item : item.url) !== url,
      );
    } catch (_) {
      // keep existing list
    }
  }

  return {
    state,
    checkSession,
    fetchHomeservers,
    loginWithSso,
    connectMatrix,
    disconnectMatrix,
    fetchMatrixStatus,
    login,
    logout: logoutUser,
    deleteHomeserver,
    handleAuthFailure,
    clearAuthIssue,
  };
}
