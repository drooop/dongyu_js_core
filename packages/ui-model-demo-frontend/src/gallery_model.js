import { GALLERY_STATE_MODEL_ID } from './model_ids.js';

export { GALLERY_STATE_MODEL_ID };

export function buildGalleryAst() {
  const demoCards = [
    { id: 'demo_button', title: 'Button', desc: 'Button variants & states' },
    { id: 'demo_input', title: 'Input', desc: 'Text / Number / Switch' },
    { id: 'demo_table', title: 'Table', desc: 'Columns, slots, paging' },
    { id: 'demo_layout', title: 'Layout', desc: 'Container, Card, spacing' },
    { id: 'demo_tokens', title: 'Tokens', desc: 'Theme & density' },
    { id: 'demo_motion', title: 'Motion', desc: 'Transitions & reveal' },
  ];

  return {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'layout',
        type: 'Container',
        props: {
          layout: 'column',
          gap: 14,
          style: {
            padding: '16px',
            maxWidth: '1100px',
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
              style: {
                width: '100%',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              },
            },
            children: [
              {
                id: 'title',
                type: 'Text',
                props: { text: 'Gallery', tag: 'h1', size: 'large' },
              },
            ],
          },
          {
            id: 'subtitle',
            type: 'Text',
            props: {
              text: 'ModelTable-driven component demos (skeleton).',
              type: 'info',
            },
          },
          {
            id: 'grid',
            type: 'Container',
            props: {
              layout: 'row',
              gap: 12,
              wrap: true,
              style: {
                width: '100%',
                alignItems: 'stretch',
              },
            },
            children: demoCards.map((c) => ({
              id: c.id,
              type: 'Card',
              props: {
                title: c.title,
                style: {
                  width: '260px',
                },
              },
              children: [
                {
                  id: `${c.id}_desc`,
                  type: 'Text',
                  props: { text: c.desc, type: 'info' },
                },
                {
                  id: `${c.id}_cta`,
                  type: 'Button',
                  props: { label: 'Open (coming soon)', disabled: true },
                },
              ],
            })),
          },
          {
            id: 'wave_a_controls',
            type: 'Card',
            props: {
              title: 'Wave A Controls',
              style: {
                width: '100%',
              },
            },
            children: [
              {
                id: 'wave_a_controls_desc',
                type: 'Text',
                props: {
                  text: 'Checkbox, radio, and slider bound to ModelTable.',
                  type: 'info',
                },
              },
              {
                id: 'wave_a_controls_row',
                type: 'Container',
                props: {
                  layout: 'row',
                  gap: 16,
                  wrap: true,
                  style: {
                    width: '100%',
                    alignItems: 'center',
                  },
                },
                children: [
                  {
                    id: 'wave_a_checkbox_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 6,
                      style: {
                        minWidth: '220px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_a_checkbox',
                        type: 'Checkbox',
                        props: { text: 'Enable alerts' },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 0, k: 'checkbox_demo' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 0, k: 'checkbox_demo' },
                          },
                          change: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 1, k: 'checkbox_change' },
                          },
                        },
                      },
                      {
                        id: 'wave_a_checkbox_value',
                        type: 'Text',
                        props: { type: 'info', text: 'Value: false' },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 0, k: 'checkbox_demo' },
                        },
                      },
                    ],
                  },
                  {
                    id: 'wave_a_radio_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 6,
                      style: {
                        minWidth: '260px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_a_radio',
                        type: 'RadioGroup',
                        props: {
                          options: [
                            { label: 'Alpha', value: 'alpha' },
                            { label: 'Beta', value: 'beta' },
                            { label: 'Gamma', value: 'gamma' },
                          ],
                        },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 2, c: 0, k: 'radio_demo' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 2, c: 0, k: 'radio_demo' },
                          },
                          change: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 2, c: 1, k: 'radio_change' },
                          },
                        },
                      },
                      {
                        id: 'wave_a_radio_value',
                        type: 'Text',
                        props: { type: 'info', text: 'Value: alpha' },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 2, c: 0, k: 'radio_demo' },
                        },
                      },
                    ],
                  },
                  {
                    id: 'wave_a_slider_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 6,
                      style: {
                        minWidth: '260px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_a_slider',
                        type: 'Slider',
                        props: {
                          min: 0,
                          max: 100,
                          showInput: true,
                          style: {
                            width: '240px',
                          },
                        },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 0, k: 'slider_demo' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 0, k: 'slider_demo' },
                          },
                          change: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 1, k: 'slider_change' },
                          },
                        },
                      },
                      {
                        id: 'wave_a_slider_value',
                        type: 'Text',
                        props: { type: 'info', text: 'Value: 0' },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 0, k: 'slider_demo' },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'wave_b_controls',
            type: 'Card',
            props: {
              title: 'Wave B Controls',
              style: {
                width: '100%',
              },
            },
            children: [
              {
                id: 'wave_b_controls_desc',
                type: 'Text',
                props: {
                  text: 'Date/time, tabs, dialog, pagination bound to ModelTable.',
                  type: 'info',
                },
              },
              {
                id: 'wave_b_controls_row',
                type: 'Container',
                props: {
                  layout: 'row',
                  gap: 16,
                  wrap: true,
                  style: {
                    width: '100%',
                    alignItems: 'flex-start',
                  },
                },
                children: [
                  {
                    id: 'wave_b_datepicker_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 6,
                      style: {
                        minWidth: '260px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_b_datepicker_title',
                        type: 'Text',
                        props: { text: 'DatePicker', tag: 'h3' },
                      },
                      {
                        id: 'wave_b_datepicker',
                        type: 'DatePicker',
                        props: {
                          type: 'date',
                          placeholder: 'Pick a date',
                          valueFormat: 'YYYY-MM-DD',
                        },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 4, c: 0, k: 'wave_b_datepicker' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 4, c: 0, k: 'wave_b_datepicker' },
                          },
                        },
                      },
                      {
                        id: 'wave_b_datepicker_value',
                        type: 'Text',
                        props: { type: 'info', text: '—' },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 4, c: 0, k: 'wave_b_datepicker' },
                        },
                      },
                    ],
                  },
                  {
                    id: 'wave_b_timepicker_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 6,
                      style: {
                        minWidth: '260px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_b_timepicker_title',
                        type: 'Text',
                        props: { text: 'TimePicker', tag: 'h3' },
                      },
                      {
                        id: 'wave_b_timepicker',
                        type: 'TimePicker',
                        props: {
                          placeholder: 'Pick a time',
                          valueFormat: 'HH:mm',
                        },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 5, c: 0, k: 'wave_b_timepicker' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 5, c: 0, k: 'wave_b_timepicker' },
                          },
                        },
                      },
                      {
                        id: 'wave_b_timepicker_value',
                        type: 'Text',
                        props: { type: 'info', text: '—' },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 5, c: 0, k: 'wave_b_timepicker' },
                        },
                      },
                    ],
                  },
                  {
                    id: 'wave_b_tabs_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 8,
                      style: {
                        minWidth: '360px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_b_tabs_title',
                        type: 'Text',
                        props: { text: 'Tabs', tag: 'h3' },
                      },
                      {
                        id: 'wave_b_tabs',
                        type: 'Tabs',
                        props: {
                          type: 'card',
                        },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 6, c: 0, k: 'wave_b_tabs' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 6, c: 0, k: 'wave_b_tabs' },
                          },
                        },
                        children: [
                          {
                            id: 'wave_b_tabs_pane_alpha',
                            type: 'TabPane',
                            props: { label: 'Alpha', name: 'alpha' },
                            children: [
                              {
                                id: 'wave_b_tabs_pane_alpha_text',
                                type: 'Text',
                                props: { type: 'info', text: 'Alpha pane content.' },
                              },
                            ],
                          },
                          {
                            id: 'wave_b_tabs_pane_beta',
                            type: 'TabPane',
                            props: { label: 'Beta', name: 'beta' },
                            children: [
                              {
                                id: 'wave_b_tabs_pane_beta_text',
                                type: 'Text',
                                props: { type: 'info', text: 'Beta pane content.' },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'wave_b_tabs_active_row',
                        type: 'Container',
                        props: { layout: 'row', gap: 6, style: { alignItems: 'center' } },
                        children: [
                          {
                            id: 'wave_b_tabs_active_label',
                            type: 'Text',
                            props: { type: 'info', text: 'Active tab:' },
                          },
                          {
                            id: 'wave_b_tabs_active_value',
                            type: 'Text',
                            props: { type: 'info', text: 'alpha' },
                            bind: {
                              read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 6, c: 0, k: 'wave_b_tabs' },
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'wave_b_dialog_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 8,
                      style: {
                        minWidth: '300px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_b_dialog_title',
                        type: 'Text',
                        props: { text: 'Dialog', tag: 'h3' },
                      },
                      {
                        id: 'wave_b_dialog_open',
                        type: 'Button',
                        props: { label: 'Open dialog', type: 'primary' },
                        bind: {
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 7, c: 0, k: 'dialog_open' },
                            value_ref: { t: 'bool', v: true },
                          },
                        },
                      },
                      {
                        id: 'wave_b_dialog',
                        type: 'Dialog',
                        props: {
                          title: 'ModelTable Dialog',
                          width: '420px',
                        },
                        bind: {
                          read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 7, c: 0, k: 'dialog_open' },
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 7, c: 0, k: 'dialog_open' },
                          },
                        },
                        children: [
                          {
                            id: 'wave_b_dialog_body',
                            type: 'Text',
                            props: {
                              type: 'info',
                              text: 'Close (X / mask / ESC) writes dialog_open=false via update:modelValue.',
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'wave_b_pagination_group',
                    type: 'Container',
                    props: {
                      layout: 'column',
                      gap: 8,
                      style: {
                        minWidth: '420px',
                      },
                    },
                    children: [
                      {
                        id: 'wave_b_pagination_title',
                        type: 'Text',
                        props: { text: 'Pagination', tag: 'h3' },
                      },
                      {
                        id: 'wave_b_pagination',
                        type: 'Pagination',
                        props: {
                          background: true,
                          total: 240,
                          layout: 'prev, pager, next, sizes, total',
                          pageSizes: [5, 10, 20, 50],
                        },
                        bind: {
                          models: {
                            currentPage: {
                              read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 0, k: 'wave_b_pagination_currentPage' },
                              write: {
                                action: 'label_update',
                                target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 0, k: 'wave_b_pagination_currentPage' },
                              },
                            },
                            pageSize: {
                              read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 1, k: 'wave_b_pagination_pageSize' },
                              write: {
                                action: 'label_update',
                                target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 1, k: 'wave_b_pagination_pageSize' },
                              },
                            },
                          },
                        },
                      },
                      {
                        id: 'wave_b_pagination_value_row',
                        type: 'Container',
                        props: { layout: 'row', gap: 6, wrap: true, style: { alignItems: 'center' } },
                        children: [
                          { id: 'wave_b_pagination_current_label', type: 'Text', props: { type: 'info', text: 'Page:' } },
                          {
                            id: 'wave_b_pagination_current_value',
                            type: 'Text',
                            props: { type: 'info', text: '1' },
                            bind: {
                              read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 0, k: 'wave_b_pagination_currentPage' },
                            },
                          },
                          { id: 'wave_b_pagination_size_label', type: 'Text', props: { type: 'info', text: 'Size:' } },
                          {
                            id: 'wave_b_pagination_size_value',
                            type: 'Text',
                            props: { type: 'info', text: '10' },
                            bind: {
                              read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 1, k: 'wave_b_pagination_pageSize' },
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },

          {
            id: 'wave_c_composition',
            type: 'Card',
            props: { title: 'Wave C Composition (Include + Submodel)' },
            children: [
              {
                id: 'wave_c_desc',
                type: 'Text',
                props: { type: 'info', text: 'Include renders an AST fragment stored in ModelTable labels. Submodel instance is created via submodel_create.' },
              },
              {
                id: 'wave_c_row',
                type: 'Container',
                props: { layout: 'row', gap: 16, wrap: true, style: { width: '100%', alignItems: 'flex-start' } },
                children: [
                  {
                    id: 'wave_c_static_group',
                    type: 'Container',
                    props: { layout: 'column', gap: 8, style: { minWidth: '320px' } },
                    children: [
                      { id: 'wave_c_static_title', type: 'Text', props: { text: 'Static reuse', tag: 'h3' } },
                      {
                        id: 'wave_c_static_includes_row',
                        type: 'Container',
                        props: { layout: 'row', gap: 12, wrap: true, style: { width: '100%' } },
                        children: [
                          {
                            id: 'wave_c_include_static_a',
                            type: 'Include',
                            props: {
                              ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 1, k: 'wave_c_fragment_static' },
                              fallbackText: 'Static fragment missing',
                            },
                          },
                          {
                            id: 'wave_c_include_static_b',
                            type: 'Include',
                            props: {
                              ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 1, k: 'wave_c_fragment_static' },
                              fallbackText: 'Static fragment missing',
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'wave_c_submodel_group',
                    type: 'Container',
                    props: { layout: 'column', gap: 8, style: { minWidth: '320px' } },
                    children: [
                      { id: 'wave_c_submodel_title', type: 'Text', props: { text: 'Submodel instance', tag: 'h3' } },
                      {
                        id: 'wave_c_submodel_create',
                        type: 'Button',
                        props: { type: 'primary', label: 'Create submodel instance (2001)' },
                        bind: {
                          write: {
                            action: 'submodel_create',
                            value_ref: { t: 'json', v: { id: 2001, name: 'gallery_submodel_2001', type: 'ui' } },
                          },
                        },
                      },
                      {
                        id: 'wave_c_include_submodel',
                        type: 'Include',
                        props: {
                          ref: { model_id: 2001, p: 0, r: 0, c: 0, k: 'ui_fragment_v0' },
                          fallbackText: 'Submodel 2001 not created (click button)',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
