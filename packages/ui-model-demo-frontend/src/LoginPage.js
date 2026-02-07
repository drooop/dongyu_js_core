import { h, ref, resolveComponent, computed } from 'vue';

/**
 * Creates a login page Vue3 component using Element Plus.
 * @param {{ authStore: object, baseUrl: string }} options
 * @returns Vue component definition
 */
export function createLoginPage({ authStore }) {
  return {
    name: 'LoginPage',
    setup() {
      const ElInput = resolveComponent('ElInput');
      const ElButton = resolveComponent('ElButton');
      const ElSelect = resolveComponent('ElSelect');
      const ElOption = resolveComponent('ElOption');
      const ElAlert = resolveComponent('ElAlert');
      const ElIcon = resolveComponent('ElIcon');

      const username = ref('');
      const password = ref('');
      const homeserverUrl = ref('https://matrix.localhost');

      const homeservers = computed(() => authStore.state.homeservers || []);
      const loading = computed(() => authStore.state.loading);
      const loginError = computed(() => authStore.state.loginError);

      async function handleLogin() {
        await authStore.login(username.value, password.value, homeserverUrl.value);
      }

      function handleKeyup(e) {
        if (e && e.key === 'Enter') handleLogin();
      }

      async function handleDeleteHs(url) {
        await authStore.deleteHomeserver(url);
      }

      return () => {
        const hsOptions = homeservers.value.map((item) => {
          const url = typeof item === 'string' ? item : (item && item.url ? item.url : '');
          const label = typeof item === 'string' ? item : (item && item.label ? item.label : url);
          return h(ElOption, { key: url, label, value: url }, {
            default: () => h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' } }, [
              h('span', null, label),
              h('span', {
                style: { cursor: 'pointer', color: '#909399', fontSize: '12px', marginLeft: '8px' },
                onClick: (e) => { e.stopPropagation(); handleDeleteHs(url); },
              }, '\u2715'),
            ]),
          });
        });

        const errorNode = loginError.value
          ? h(ElAlert, {
            type: 'error',
            title: loginError.value,
            closable: false,
            showIcon: true,
            style: { width: '100%' },
          })
          : null;

        return h('div', {
          style: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f7fa',
          },
        }, [
          h('div', {
            style: {
              width: '420px',
              maxWidth: '95vw',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            },
          }, [
            // Title row
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' } }, [
              h('span', { style: { fontSize: '24px' } }, '\uD83C\uDF10'),
              h('span', { style: { fontSize: '20px', fontWeight: 'bold' } }, '洞宇 DongYu'),
            ]),
            // Subtitle
            h('div', { style: { textAlign: 'center', color: '#909399', fontSize: '14px' } }, 'Matrix Account Login'),
            // Divider
            h('hr', { style: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' } }),
            // Homeserver URL
            h('label', { style: { fontSize: '13px', fontWeight: '600', color: '#303133' } }, 'Homeserver URL'),
            h(ElSelect, {
              modelValue: homeserverUrl.value,
              'onUpdate:modelValue': (v) => { homeserverUrl.value = v; },
              filterable: true,
              allowCreate: true,
              defaultFirstOption: true,
              placeholder: 'https://matrix.localhost',
              style: { width: '100%' },
            }, { default: () => hsOptions }),
            // Username
            h('label', { style: { fontSize: '13px', fontWeight: '600', color: '#303133' } }, 'Username'),
            h(ElInput, {
              modelValue: username.value,
              'onUpdate:modelValue': (v) => { username.value = v; },
              placeholder: '@user:localhost',
            }),
            // Password
            h('label', { style: { fontSize: '13px', fontWeight: '600', color: '#303133' } }, 'Password'),
            h(ElInput, {
              modelValue: password.value,
              'onUpdate:modelValue': (v) => { password.value = v; },
              type: 'password',
              showPassword: true,
              placeholder: 'Password',
              onKeyup: handleKeyup,
            }),
            // Error
            errorNode,
            // Submit
            h(ElButton, {
              type: 'primary',
              loading: loading.value,
              onClick: handleLogin,
              style: { width: '100%' },
            }, { default: () => 'Login with Matrix' }),
          ]),
        ]);
      };
    },
  };
}
