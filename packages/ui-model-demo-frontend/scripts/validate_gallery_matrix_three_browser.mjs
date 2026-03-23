#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GALLERY_STATE_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
  UI_EXAMPLE_CHILD_MODEL_ID,
} from '../src/model_ids.js';
const require = createRequire(import.meta.url);
const { createRenderer } = require('../../ui-renderer/src/index.js');
let computed;
let createApp;
let h;
let nextTick;
let reactive;
let resolveComponent;
let ElementPlus;
let createDemoStore;
let createGalleryStore;

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0217-gallery-browser-'));

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0217_gallery_browser_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

async function setupDom() {
  const mod = await import('jsdom');
  const { JSDOM } = mod;
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://127.0.0.1/#/gallery',
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.Node = dom.window.Node;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const vueMod = await import('vue');
  computed = vueMod.computed;
  createApp = vueMod.createApp;
  h = vueMod.h;
  nextTick = vueMod.nextTick;
  reactive = vueMod.reactive;
  resolveComponent = vueMod.resolveComponent;
  ElementPlus = (await import('element-plus')).default;
  createDemoStore = (await import('../src/demo_modeltable.js')).createDemoStore;
  createGalleryStore = (await import('../src/gallery_store.js')).createGalleryStore;
  return dom;
}

function createThreeSceneHostStub() {
  return {
    name: 'ThreeSceneHost',
    render() {
      return h('div', { 'data-testid': 'three-scene-host' }, 'ThreeSceneHost');
    },
  };
}

function createGalleryRoot(store) {
  const host = {
    getSnapshot: () => store.snapshot,
    dispatchAddLabel: (label) => {
      const result = store.dispatchAddLabel(label);
      queueMicrotask(() => {
        store.consumeOnce();
      });
      return result;
    },
    dispatchRmLabel: (labelRef) => store.dispatchRmLabel(labelRef),
  };
  const renderer = createRenderer({ host, vue: { h, resolveComponent } });

  return {
    name: 'GalleryBrowserRoot',
    setup() {
      const ast = computed(() => {
        const { models, v1nConfig } = store.snapshot;
        void models;
        void v1nConfig;
        return store.getUiAst();
      });
      return () => renderer.renderVNode(ast.value);
    },
  };
}

async function flushUi(ms = 0) {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await nextTick();
}

function mountGalleryApp({ galleryStore }) {
  window.location.hash = '#/gallery';
  const container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);

  const app = createApp(createGalleryRoot(galleryStore));
  app.component('ThreeSceneHost', createThreeSceneHostStub());
  app.use(ElementPlus);
  app.mount(container);
  return { app, container };
}

function clickButton(container, labelText) {
  const buttons = Array.from(container.querySelectorAll('button'));
  const button = buttons.find((entry) => String(entry.textContent || '').includes(labelText));
  assert(button, `button_not_found:${labelText}`);
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function runLocalScenario() {
  const mainStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const galleryStore = createGalleryStore({ sourceStore: mainStore });
  const mounted = mountGalleryApp({ galleryStore });

  try {
    await flushUi(20);
    const text = mounted.container.textContent || '';
    assert(text.includes('Matrix Debug Surface'), 'local_gallery_matrix_card_missing_in_dom');
    assert(text.includes('Canonical UI Model Examples'), 'local_gallery_examples_card_missing_in_dom');
    assert(text.includes('Three Scene Integration'), 'local_gallery_three_card_missing_in_dom');

    clickButton(mounted.container, 'Focus Three');
    await flushUi(20);
    assert.equal(
      mainStore.runtime.getLabelValue(mainStore.runtime.getModel(GALLERY_STATE_MODEL_ID), 0, 11, 0, 'gallery_showcase_tab'),
      'three',
      'local_focus_button_must_update_gallery_state',
    );

    clickButton(mounted.container, 'Refresh Matrix');
    await flushUi(20);
    assert.match(
      String(mainStore.runtime.getLabelValue(mainStore.runtime.getModel(-2), 0, 0, 0, 'matrix_debug_status_text') || ''),
      /refresh:/,
      'local_matrix_button_must_update_authoritative_matrix_debug_state',
    );

    clickButton(mounted.container, 'Promote Child Stage');
    await flushUi(20);
    const exampleError = mainStore.runtime.getLabelValue(mainStore.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');
    assert.equal(exampleError?.detail, 'ui_examples_remote_only', 'local_examples_button_must_report_remote_only_boundary');

    clickButton(mounted.container, 'Create Sphere');
    await flushUi(20);
    const threeError = mainStore.runtime.getLabelValue(mainStore.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');
    assert.equal(threeError?.detail, 'three_scene_remote_only', 'local_three_button_must_report_remote_only_boundary');
  } finally {
    mounted.app.unmount();
  }
}

async function runRemoteScenario() {
  const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  await state.activateRuntimeMode('running');

  const snapshot = reactive(state.clientSnap());
  const refreshSnapshot = () => {
    const next = state.clientSnap();
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
  };

  const remoteMainStore = {
    snapshot,
    setRoutePath() {},
    async dispatchAddLabel(label) {
      const result = await state.submitEnvelope(label.v);
      refreshSnapshot();
      return result;
    },
    dispatchRmLabel() {
      return undefined;
    },
    consumeOnce() {
      refreshSnapshot();
      return { consumed: false };
    },
  };
  const galleryStore = createGalleryStore({ sourceStore: remoteMainStore });
  const mounted = mountGalleryApp({ galleryStore });

  try {
    await flushUi(20);
    const text = mounted.container.textContent || '';
    assert(text.includes('Matrix Debug Surface'), 'remote_gallery_matrix_card_missing_in_dom');
    assert(text.includes('Canonical UI Model Examples'), 'remote_gallery_examples_card_missing_in_dom');
    assert(text.includes('Three Scene Integration'), 'remote_gallery_three_card_missing_in_dom');

    clickButton(mounted.container, 'Refresh Matrix');
    await flushUi(50);
    assert.match(
      String(state.clientSnap()?.models?.['-2']?.cells?.['0,0,0']?.labels?.matrix_debug_status_text?.v || ''),
      /refresh:/,
      'remote_matrix_button_must_use_authoritative_server_path',
    );

    clickButton(mounted.container, 'Promote Child Stage');
    await flushUi(50);
    assert.equal(
      state.clientSnap()?.models?.[String(UI_EXAMPLE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.review_stage?.v,
      'review',
      'remote_examples_button_must_mutate_authoritative_review_stage',
    );

    clickButton(mounted.container, 'Create Sphere');
    await flushUi(50);
    const entities = state.clientSnap()?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v?.entities;
    assert(Array.isArray(entities) && entities.some((entity) => entity?.id === 'sphere-2'), 'remote_three_button_must_mutate_authoritative_scene_graph');
  } finally {
    mounted.app.unmount();
  }
}

try {
  await setupDom();
  await runLocalScenario();
  await runRemoteScenario();
  console.log('validate_gallery_matrix_three_browser: PASS');
  process.exit(0);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}
