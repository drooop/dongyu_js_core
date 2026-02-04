import { MODEL_100_ID } from './model_ids.js';

export { MODEL_100_ID };

export function buildModel100Ast() {
  return {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'layout',
        type: 'Container',
        props: {
          layout: 'column',
          gap: 16,
          style: {
            padding: '24px',
            maxWidth: '800px',
            margin: '0 auto',
          },
        },
        children: [
          {
            id: 'header',
            type: 'Container',
            props: {
              layout: 'row',
              gap: 12,
              style: { alignItems: 'center' },
            },
            children: [
              {
                id: 'title',
                type: 'Text',
                props: { text: 'Model 100 - Dual-Bus E2E Test', tag: 'h1', size: 'large' },
              },
            ],
          },
          {
            id: 'subtitle',
            type: 'Text',
            props: {
              text: 'Local UI -> Matrix -> MBR -> MQTT -> K8s Worker -> MQTT -> MBR -> Matrix -> Local UI',
              type: 'info',
            },
          },
          {
            id: 'main_card',
            type: 'Card',
            props: {
              title: 'Color Generator',
              style: { width: '100%' },
            },
            children: [
              {
                id: 'color_display',
                type: 'Container',
                props: {
                  layout: 'column',
                  gap: 16,
                  style: { width: '100%' },
                },
                children: [
                  {
                    id: 'color_info',
                    type: 'Container',
                    props: {
                      layout: 'row',
                      gap: 24,
                      style: { width: '100%', alignItems: 'center' },
                    },
                    children: [
                      {
                        id: 'color_box',
                        type: 'ColorBox',
                        props: { 
                          width: '120px', 
                          height: '80px',
                          borderRadius: '12px',
                        },
                        bind: {
                          read: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'bg_color' },
                        },
                      },
                      {
                        id: 'color_text_group',
                        type: 'Container',
                        props: { layout: 'column', gap: 4 },
                        children: [
                          {
                            id: 'color_label',
                            type: 'Text',
                            props: { text: 'Current Color', type: 'info' },
                          },
                          {
                            id: 'color_value',
                            type: 'Text',
                            props: { 
                              text: '#FFFFFF', 
                              tag: 'span',
                              style: { 
                                fontFamily: 'monospace', 
                                fontSize: '28px',
                                fontWeight: 'bold',
                              },
                            },
                            bind: {
                              read: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'bg_color' },
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'input_row',
                    type: 'Container',
                    props: {
                      layout: 'row',
                      gap: 12,
                      style: { width: '100%', alignItems: 'center' },
                    },
                    children: [
                      {
                        id: 'input_field',
                        type: 'Input',
                        props: {
                          placeholder: 'Enter any text (optional)',
                          style: { flex: 1 },
                        },
                        bind: {
                          read: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'input_value' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'input_value' },
                          },
                        },
                      },
                      {
                        id: 'submit_button',
                        type: 'Button',
                        props: { label: 'Generate Color', type: 'primary', size: 'large', disabled: true },
                        bind: {
                          read: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'system_ready' },
                          write: {
                            action: 'label_add',
                            target_ref: { model_id: MODEL_100_ID, p: 0, r: 0, c: 2, k: 'ui_event' },
                            value_ref: {
                              t: 'json',
                              v: { action: 'submit', input_value: '', meta: {} },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'status_card',
            type: 'Card',
            props: {
              title: 'Status',
              style: { width: '100%' },
            },
            children: [
              {
                id: 'status_row',
                type: 'Container',
                props: {
                  layout: 'column',
                  gap: 8,
                  style: { width: '100%' },
                },
                children: [
                  {
                    id: 'system_ready_row',
                    type: 'Container',
                    props: { layout: 'row', gap: 16 },
                    children: [
                      {
                        id: 'system_ready_label',
                        type: 'Text',
                        props: { text: 'MBR Ready:', type: 'info' },
                      },
                      {
                        id: 'system_ready_value',
                        type: 'Text',
                        props: { text: 'false', style: { fontFamily: 'monospace', fontWeight: 'bold' } },
                        bind: {
                          read: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'system_ready' },
                        },
                      },
                    ],
                  },
                  {
                    id: 'color_status_row',
                    type: 'Container',
                    props: { layout: 'row', gap: 16 },
                    children: [
                      {
                        id: 'status_label',
                        type: 'Text',
                        props: { text: 'Color Status:', type: 'info' },
                      },
                      {
                        id: 'status_value',
                        type: 'Text',
                        props: { text: 'ready', style: { fontFamily: 'monospace' } },
                        bind: {
                          read: { model_id: MODEL_100_ID, p: 0, r: 0, c: 0, k: 'status' },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'info_card',
            type: 'Card',
            props: {
              title: 'How it works',
              style: { width: '100%' },
            },
            children: [
              {
                id: 'info_list',
                type: 'Container',
                props: { layout: 'column', gap: 8 },
                children: [
                  { id: 'info1', type: 'Text', props: { text: '1. Click "Generate Color" to send a ui_event', type: 'info' } },
                  { id: 'info2', type: 'Text', props: { text: '2. Event is forwarded via Matrix management bus to MBR', type: 'info' } },
                  { id: 'info3', type: 'Text', props: { text: '3. MBR routes to K8s Worker via MQTT control bus', type: 'info' } },
                  { id: 'info4', type: 'Text', props: { text: '4. K8s Worker generates random color and sends patch back', type: 'info' } },
                  { id: 'info5', type: 'Text', props: { text: '5. Patch flows back through MBR -> Matrix -> Local UI', type: 'info' } },
                  { id: 'info6', type: 'Text', props: { text: '6. Color value updates above', type: 'info' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
