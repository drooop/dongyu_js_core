// Login Page AST Builder
// Renders a Matrix login form driven by ModelTable cells.

export const LOGIN_MODEL_ID = -3;

/**
 * Initialize the login model cells in a runtime instance.
 * @param {object} runtime - ModelTableRuntime instance
 */
export function createLoginModel(runtime) {
  let model = runtime.getModel(LOGIN_MODEL_ID);
  if (!model) {
    runtime.createModel(LOGIN_MODEL_ID);
    model = runtime.getModel(LOGIN_MODEL_ID);
  }
  const labels = [
    { k: 'login_hs_url', t: 'str', v: 'https://matrix.localhost' },
    { k: 'login_username', t: 'str', v: '' },
    { k: 'login_password', t: 'str', v: '' },
    { k: 'login_error', t: 'str', v: '' },
    { k: 'login_loading', t: 'str', v: 'false' },
    { k: 'login_hs_list', t: 'json', v: [] },
  ];
  for (const lab of labels) {
    runtime.addLabel(model, 0, 0, 0, lab);
  }
}

/**
 * Build the login page UI AST from a snapshot.
 * @param {object} snapshot - { models: { ... } }
 * @param {number} modelId - model id, default LOGIN_MODEL_ID
 * @returns {object} AST tree
 */
export function buildLoginAst(snapshot, modelId) {
  const mid = modelId !== undefined ? modelId : LOGIN_MODEL_ID;

  function readRef(k) {
    return { model_id: mid, p: 0, r: 0, c: 0, k };
  }
  function writeRef(k) {
    return { model_id: mid, p: 0, r: 0, c: 0, k };
  }

  // Read homeserver list from snapshot to build select options
  let hsOptions = [];
  try {
    const m = snapshot && snapshot.models ? (snapshot.models[mid] || snapshot.models[String(mid)]) : null;
    const cell = m && m.cells ? m.cells['0,0,0'] : null;
    const label = cell && cell.labels ? cell.labels.login_hs_list : null;
    const raw = label ? label.v : null;
    if (Array.isArray(raw)) {
      hsOptions = raw.map(item => {
        const url = typeof item === 'string' ? item : (item && item.url ? item.url : '');
        const label = typeof item === 'string' ? item : (item && item.label ? item.label : url);
        return { label, value: url };
      });
    }
  } catch (_) {
    // ignore
  }

  // Read error value for conditional visibility
  let errorValue = '';
  try {
    const m = snapshot && snapshot.models ? (snapshot.models[mid] || snapshot.models[String(mid)]) : null;
    const cell = m && m.cells ? m.cells['0,0,0'] : null;
    const label = cell && cell.labels ? cell.labels.login_error : null;
    errorValue = label ? String(label.v || '') : '';
  } catch (_) {
    // ignore
  }

  const errorChildren = [];
  if (errorValue) {
    errorChildren.push({
      id: 'login_error',
      type: 'Text',
      props: {
        variant: 'error',
        style: { color: '#f56c6c', fontSize: '13px', textAlign: 'center' },
      },
      bind: { read: readRef('login_error') },
    });
  }

  return {
    id: 'login_root',
    type: 'Root',
    children: [
      {
        id: 'login_outer',
        type: 'Container',
        props: {
          layout: 'column',
          style: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f7fa',
          },
        },
        children: [
          {
            id: 'login_card',
            type: 'Container',
            props: {
              layout: 'column',
              gap: 16,
              style: {
                width: '420px',
                maxWidth: '95vw',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                padding: '32px',
              },
            },
            children: [
              // Title row
              {
                id: 'login_title_row',
                type: 'Container',
                props: {
                  layout: 'row',
                  gap: 8,
                  style: { alignItems: 'center', justifyContent: 'center' },
                },
                children: [
                  {
                    id: 'login_icon',
                    type: 'Icon',
                    props: { name: 'globe', size: 24 },
                  },
                  {
                    id: 'login_title',
                    type: 'Text',
                    props: { text: '洞宇 DongYu', size: 'xl', style: { fontWeight: 'bold' } },
                  },
                ],
              },
              // Subtitle
              {
                id: 'login_subtitle',
                type: 'Text',
                props: {
                  text: 'Matrix Account Login',
                  size: 'sm',
                  variant: 'muted',
                  style: { textAlign: 'center', color: '#909399' },
                },
              },
              // Divider
              { id: 'login_divider', type: 'Divider' },
              // Homeserver URL label
              {
                id: 'login_hs_label',
                type: 'Text',
                props: { text: 'Homeserver URL', size: 'sm', style: { fontWeight: '600' } },
              },
              // Homeserver Select
              {
                id: 'login_hs_select',
                type: 'Select',
                props: {
                  filterable: true,
                  allowCreate: true,
                  defaultFirstOption: true,
                  placeholder: 'https://matrix.localhost',
                  options: hsOptions,
                },
                bind: {
                  read: readRef('login_hs_url'),
                  write: writeRef('login_hs_url'),
                },
              },
              // Username label
              {
                id: 'login_username_label',
                type: 'Text',
                props: { text: 'Username', size: 'sm', style: { fontWeight: '600' } },
              },
              // Username input
              {
                id: 'login_username_input',
                type: 'Input',
                props: { placeholder: '@user:localhost' },
                bind: {
                  read: readRef('login_username'),
                  write: writeRef('login_username'),
                },
              },
              // Password label
              {
                id: 'login_password_label',
                type: 'Text',
                props: { text: 'Password', size: 'sm', style: { fontWeight: '600' } },
              },
              // Password input
              {
                id: 'login_password_input',
                type: 'Input',
                props: { type: 'password', showPassword: true },
                bind: {
                  read: readRef('login_password'),
                  write: writeRef('login_password'),
                },
              },
              // Error text (conditional)
              ...errorChildren,
              // Login button
              {
                id: 'login_submit_btn',
                type: 'Button',
                props: {
                  label: 'Login with Matrix',
                  type: 'primary',
                  style: { width: '100%' },
                },
                bind: {
                  write: {
                    action: 'label_update',
                    target_ref: { model_id: mid, p: 0, r: 0, c: 0, k: 'login_submit' },
                    value_ref: { t: 'str', v: 'submit' },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
