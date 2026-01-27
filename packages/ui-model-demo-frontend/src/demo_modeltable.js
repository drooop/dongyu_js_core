import { reactive } from 'vue';

function buildDemoAst() {
  return {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'layout',
        type: 'Container',
        props: { layout: 'column', gap: 12 },
        children: [
          {
            id: 'card_model',
            type: 'Card',
            props: { title: 'Model' },
            children: [
              {
                id: 'model_title',
                type: 'Text',
                bind: { read: { p: 0, r: 1, c: 0, k: 'model_title' } },
              },
              {
                id: 'model_code',
                type: 'CodeBlock',
                bind: { read: { p: 0, r: 1, c: 0, k: 'model_json' } },
              },
            ],
          },
          {
            id: 'card_code',
            type: 'Card',
            props: { title: 'Code' },
            children: [
              {
                id: 'code_text',
                type: 'Text',
                bind: { read: { p: 0, r: 1, c: 1, k: 'code_text' } },
              },
              {
                id: 'code_block',
                type: 'CodeBlock',
                bind: { read: { p: 0, r: 1, c: 1, k: 'code_snippet' } },
              },
            ],
          },
          {
            id: 'card_events',
            type: 'Card',
            props: { title: 'Events' },
            children: [
              {
                id: 'event_title',
                type: 'Text',
                bind: { read: { p: 0, r: 1, c: 2, k: 'event_title' } },
              },
              {
                id: 'event_log',
                type: 'CodeBlock',
                bind: { read: { p: 0, r: 1, c: 2, k: 'event_log' } },
              },
            ],
          },
          {
            id: 'card_controls',
            type: 'Card',
            props: { title: 'Controls' },
            children: [
              {
                id: 'input_value',
                type: 'Input',
                bind: {
                  read: { p: 0, r: 2, c: 0, k: 'input_value' },
                  write: {
                    target: { p: 0, r: 0, c: 1, k: 'ui_event' },
                    event_type: 'change',
                    policy: 'clear_then_add',
                  },
                },
              },
              {
                id: 'button_submit',
                type: 'Button',
                props: { label: 'Submit' },
                bind: {
                  write: {
                    target: { p: 0, r: 0, c: 1, k: 'ui_event' },
                    event_type: 'click',
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

function createCell(p, r, c, labels) {
  return { p, r, c, labels: labels || {} };
}

export function createDemoStore() {
  const eventLog = [];
  const snapshot = reactive({
    models: {
      0: {
        id: 0,
        cells: {
          '0,0,0': createCell(0, 0, 0, {
            ui_ast_v0: { k: 'ui_ast_v0', t: 'json', v: buildDemoAst() },
          }),
          '0,0,1': createCell(0, 0, 1, {
            ui_event: { k: 'ui_event', t: 'event', v: null },
          }),
          '0,1,0': createCell(0, 1, 0, {
            model_title: { k: 'model_title', t: 'str', v: 'ModelTable' },
            model_json: { k: 'model_json', t: 'str', v: '{"cells": 4}' },
          }),
          '0,1,1': createCell(0, 1, 1, {
            code_text: { k: 'code_text', t: 'str', v: 'UI AST (v0.1)' },
            code_snippet: { k: 'code_snippet', t: 'str', v: '{"type":"Root"}' },
          }),
          '0,1,2': createCell(0, 1, 2, {
            event_title: { k: 'event_title', t: 'str', v: 'Event Log' },
            event_log: { k: 'event_log', t: 'str', v: '[]' },
          }),
          '0,2,0': createCell(0, 2, 0, {
            input_value: { k: 'input_value', t: 'str', v: 'Hello' },
          }),
        },
      },
    },
  });

  function cellKey(p, r, c) {
    return `${p},${r},${c}`;
  }

  function ensureCell(p, r, c) {
    const key = cellKey(p, r, c);
    if (!snapshot.models[0].cells[key]) {
      snapshot.models[0].cells[key] = createCell(p, r, c, {});
    }
    return snapshot.models[0].cells[key];
  }

  function setLabel(p, r, c, label) {
    const cell = ensureCell(p, r, c);
    cell.labels[label.k] = { ...label };
  }

  function getLabel(p, r, c, k) {
    const key = cellKey(p, r, c);
    const cell = snapshot.models[0].cells[key];
    if (!cell || !cell.labels) return undefined;
    return cell.labels[k];
  }

  function getUiAst() {
    const label = getLabel(0, 0, 0, 'ui_ast_v0');
    return label ? label.v : null;
  }

  function setUiAst(ast) {
    setLabel(0, 0, 0, { k: 'ui_ast_v0', t: 'json', v: ast });
  }

  function dispatchAddLabel(label) {
    if (label.t !== 'event') {
      throw new Error('non_event_write');
    }
    if (label.p !== 0 || label.r !== 0 || label.c !== 1 || label.k !== 'ui_event') {
      throw new Error('event_mailbox_mismatch');
    }
    setLabel(0, 0, 1, label);
    eventLog.push(label);
    setLabel(0, 1, 2, {
      k: 'event_log',
      t: 'str',
      v: JSON.stringify(eventLog, null, 2),
    });
  }

  function dispatchRmLabel(labelRef) {
    if (labelRef.p !== 0 || labelRef.r !== 0 || labelRef.c !== 1 || labelRef.k !== 'ui_event') {
      return;
    }
    setLabel(0, 0, 1, { k: 'ui_event', t: 'event', v: null });
  }

  return {
    snapshot,
    getUiAst,
    setUiAst,
    dispatchAddLabel,
    dispatchRmLabel,
  };
}

export function buildDemoAstSample() {
  return buildDemoAst();
}
