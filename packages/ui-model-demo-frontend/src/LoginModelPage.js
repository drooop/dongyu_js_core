import { computed, h, reactive, ref, resolveComponent } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';

const LOGIN_MODEL_ID = -3;

/**
 * Creates a ModelTable-driven login page component.
 * Fetches Model -3 (login_form) from public endpoint and renders via the standard renderer pipeline.
 *
 * @param {{ authStore: object, baseUrl: string }} options
 * @returns Vue component definition
 */
export function createLoginModelPage({ authStore, baseUrl }) {
  return {
    name: 'LoginModelPage',
    setup() {
      const snapshot = reactive({ models: {} });
      const ast = ref(null);
      const fetchError = ref('');

      const ElAlert = resolveComponent('ElAlert');

      // ── Fetch Model -3 from public endpoint ──────────────────────────
      async function fetchLoginModel() {
        try {
          const resp = await fetch(`${baseUrl}/auth/login-model`, { credentials: 'same-origin' });
          if (!resp.ok) {
            fetchError.value = `Failed to load login form (${resp.status})`;
            return;
          }
          const data = await resp.json();
          if (data && data.snapshot && data.snapshot.models) {
            const modelKey = String(LOGIN_MODEL_ID);
            const model = data.snapshot.models[modelKey] || data.snapshot.models[LOGIN_MODEL_ID];
            if (model) {
              snapshot.models[modelKey] = model;
            }
          }
          if (data && data.ast) {
            ast.value = data.ast;
          }
        } catch (err) {
          fetchError.value = err && err.message ? err.message : 'network_error';
        }
      }

      fetchLoginModel();

      // ── Local snapshot helpers ────────────────────────────────────────
      function getLocalLabelValue(p, r, c, k) {
        const model = snapshot.models[String(LOGIN_MODEL_ID)];
        if (!model || !model.cells) return undefined;
        const cell = model.cells[`${p},${r},${c}`];
        if (!cell || !cell.labels) return undefined;
        const label = cell.labels[k];
        return label ? label.v : undefined;
      }

      function setLocalLabelValue(p, r, c, k, t, v) {
        const model = snapshot.models[String(LOGIN_MODEL_ID)];
        if (!model || !model.cells) return;
        const cellKey = `${p},${r},${c}`;
        if (!model.cells[cellKey]) {
          model.cells[cellKey] = { labels: {} };
        }
        model.cells[cellKey].labels[k] = { t, v };
      }

      // ── Host adapter for renderer ────────────────────────────────────
      const host = {
        getSnapshot: () => snapshot,

        dispatchAddLabel(label) {
          const envelope = label && label.v;
          const payload = envelope && envelope.payload;
          if (!payload) return;

          const action = payload.action;
          const target = payload.target;

          // label_update → update local snapshot (for input fields)
          if (action === 'label_update' && target) {
            const val = payload.value;
            if (val && typeof target.k === 'string') {
              setLocalLabelValue(
                target.p || 0, target.r || 0, target.c || 0,
                target.k, val.t || 'str', val.v,
              );
            }
            return;
          }

          // label_add targeting login_event → trigger login
          if (action === 'label_add' && target && target.k === 'login_event') {
            const username = getLocalLabelValue(0, 0, 0, 'login_username') || '';
            const password = getLocalLabelValue(0, 0, 0, 'login_password') || '';

            // Clear previous error, set loading
            setLocalLabelValue(0, 0, 0, 'login_error', 'str', '');
            setLocalLabelValue(0, 0, 0, 'login_loading', 'str', 'true');

            // homeserverUrl left empty — server uses MATRIX_HOMESERVER_URL env
            authStore.login(username, password, '').then(() => {
              setLocalLabelValue(0, 0, 0, 'login_loading', 'str', 'false');
              if (authStore.state.loginError) {
                setLocalLabelValue(0, 0, 0, 'login_error', 'str', authStore.state.loginError);
              }
            });
            return;
          }
        },

        dispatchRmLabel() {
          // no-op for login page
        },
      };

      const renderer = createRenderer({ host, vue: { h, resolveComponent } });

      // ── Error display from local snapshot ─────────────────────────────
      const loginError = computed(() => getLocalLabelValue(0, 0, 0, 'login_error') || '');

      return () => {
        if (fetchError.value) {
          return h('div', {
            style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' },
          }, [
            h('div', { style: { width: '420px', maxWidth: '95vw', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '32px' } }, [
              h(ElAlert, { type: 'error', title: fetchError.value, closable: false, showIcon: true }),
            ]),
          ]);
        }

        if (!ast.value) {
          return h('div', {
            style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' },
          }, 'Loading...');
        }

        const errorAlert = loginError.value
          ? h(ElAlert, { type: 'error', title: loginError.value, closable: false, showIcon: true, style: { marginBottom: '8px' } })
          : null;

        return h('div', {
          style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' },
        }, [
          h('div', {
            style: { width: '420px', maxWidth: '95vw', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '32px' },
          }, [
            errorAlert,
            renderer.renderVNode(ast.value),
          ]),
        ]);
      };
    },
  };
}
