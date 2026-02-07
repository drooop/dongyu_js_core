import { reactive } from 'vue';

export function createAuthStore({ baseUrl }) {
  const state = reactive({
    loading: false,
    authenticated: false,
    userId: '',
    displayName: '',
    homeserverUrl: '',
    homeservers: [],
    loginError: '',
  });

  async function checkSession() {
    try {
      const resp = await fetch(`${baseUrl}/auth/me`, { credentials: 'same-origin' });
      if (resp.ok) {
        const data = await resp.json();
        state.authenticated = true;
        state.userId = data.userId || '';
        state.displayName = data.displayName || '';
        state.homeserverUrl = data.homeserverUrl || '';
        state.loginError = '';
      } else {
        state.authenticated = false;
        state.userId = '';
        state.displayName = '';
        state.homeserverUrl = '';
      }
    } catch (_) {
      state.authenticated = false;
    }
  }

  async function fetchHomeservers() {
    try {
      const resp = await fetch(`${baseUrl}/auth/homeservers`, { credentials: 'same-origin' });
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
      const resp = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, homeserverUrl }),
        credentials: 'same-origin',
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        state.authenticated = true;
        state.userId = data.userId || '';
        state.displayName = data.displayName || '';
        state.homeserverUrl = data.homeserverUrl || '';
        state.loginError = '';
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
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (_) {
      // best-effort
    }
    state.authenticated = false;
    state.userId = '';
    state.displayName = '';
    state.homeserverUrl = '';
  }

  async function deleteHomeserver(url) {
    try {
      await fetch(`${baseUrl}/auth/homeservers?url=${encodeURIComponent(url)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
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
    login,
    logout: logoutUser,
    deleteHomeserver,
  };
}
