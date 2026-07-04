#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
const originalPerformance = globalThis.performance;

function label(k, t, v) {
  return { k, t, v };
}

function appSnapshot() {
  return appSnapshotFor({ table_id: 'app:latency:a', model_id: 1 }, 'Latency App');
}

function appSnapshotFor(ref, title) {
  return {
    models: {
      '-2': {
        table_id: 'host',
        id: -2,
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels: {} },
        },
      },
    },
    tables: {
      [ref.table_id]: {
        table_id: ref.table_id,
        models: {
          [ref.model_id]: {
            table_id: ref.table_id,
            id: ref.model_id,
            cells: {
              '0,0,0': {
                p: 0,
                r: 0,
                c: 0,
                labels: {
                  title: label('title', 'str', title),
                },
              },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installDeterministicBrowserStubs() {
  let now = 1000;
  globalThis.performance = {
    now() {
      now += 7.25;
      return now;
    },
  };
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
    }
    addEventListener() {}
    close() {
      this.readyState = 2;
    }
  };
}

async function test_visible_model_lazy_load_emits_frontend_timing_events() {
  installDeterministicBrowserStubs();
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return jsonResponse({ snapshot: appSnapshot(), snapshot_seq: 3 });
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test', autoBootstrap: false });
    assert.equal(typeof store.clearFrontendTimingEvents, 'function', 'remote store must expose a timing-event reset helper');
    assert.equal(typeof store.getFrontendTimingEvents, 'function', 'remote store must expose timing events for browser probes');

    store.clearFrontendTimingEvents();
    const loaded = await store.ensureVisibleModelLoaded({ table_id: 'app:latency:a', model_id: 1 });
    assert.equal(loaded, true);

    const events = store.getFrontendTimingEvents();
    const types = events.map((event) => event.type);
    assert.deepEqual(
      types,
      [
        'visible_model_load_start',
        'snapshot_fetch_start',
        'snapshot_fetch_response',
        'snapshot_json_parsed',
        'snapshot_apply_start',
        'snapshot_apply_end',
        'visible_model_load_end',
      ],
      'visible App lazy-load must expose ordered timing events for baseline metrics',
    );
    assert.equal(events[0].model_ref.table_id, 'app:latency:a');
    assert.equal(events[0].model_ref.model_id, 1);
    assert.equal(events.at(-1).ok, true);
    assert.equal(events.at(-1).has_model, true);
    assert.equal(
      requestedUrls[0].includes('profile=visible'),
      true,
      'foreground App lazy-load timing must measure the visible snapshot request path',
    );
    assert.ok(
      events.every((event) => Number.isFinite(event.perf_ms) && Number.isInteger(event.seq)),
      'every timing event must include deterministic perf_ms and seq fields',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.performance = originalPerformance;
  }
}

async function test_foreground_app_open_scope_marks_visible_load_events() {
  installDeterministicBrowserStubs();
  globalThis.fetch = async () => jsonResponse({ snapshot: appSnapshot(), snapshot_seq: 4 });

  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test', autoBootstrap: false });
    assert.equal(typeof store.beginForegroundAppOpenTiming, 'function', 'remote store must expose scoped foreground App-open timing start');
    assert.equal(typeof store.endForegroundAppOpenTiming, 'function', 'remote store must expose scoped foreground App-open timing end');
    assert.equal(typeof store.recordForegroundAppContentVisible, 'function', 'remote store must expose foreground content-visible timing marker');

    store.clearFrontendTimingEvents();
    const openId = store.beginForegroundAppOpenTiming({
      app_name: 'Latency App',
      model_ref: { table_id: 'app:latency:a', model_id: 1 },
    });
    assert.equal(typeof openId, 'string');
    assert.match(openId, /^fg_open_/u);

    const loaded = await store.ensureVisibleModelLoaded({ table_id: 'app:latency:a', model_id: 1 });
    assert.equal(loaded, true);
    store.recordForegroundAppContentVisible({
      app_name: 'Latency App',
      model_ref: { table_id: 'app:latency:a', model_id: 1 },
    });
    store.endForegroundAppOpenTiming({ ok: true });

    const events = store.getFrontendTimingEvents();
    const openEvents = events.filter((event) => event.open_id === openId);
    assert.deepEqual(
      openEvents.map((event) => event.type),
      [
        'foreground_app_open_start',
        'visible_model_load_start',
        'snapshot_fetch_start',
        'snapshot_fetch_response',
        'snapshot_json_parsed',
        'snapshot_apply_start',
        'snapshot_apply_end',
        'visible_model_load_end',
        'foreground_app_content_visible',
        'foreground_app_open_end',
      ],
      'foreground App-open timing scope must separate current App events from background snapshot applies',
    );
    assert.ok(
      openEvents.every((event) => event.open_id === openId && event.app_name === 'Latency App'),
      'scoped App-open timing events must carry open_id and app_name',
    );
    assert.equal(openEvents.at(-1).ok, true);
    assert.equal(openEvents.at(-1).has_model, true);
    assert.equal(
      openEvents.find((event) => event.type === 'snapshot_apply_start')?.context,
      'visible model lazy load app:latency:a|1',
      'snapshot apply timing must include request context so current App-open work can be separated from background applies',
    );
    const countAfterEnd = store.getFrontendTimingEvents().length;
    store.recordForegroundAppContentVisible({
      app_name: 'Latency App',
      model_ref: { table_id: 'app:latency:a', model_id: 1 },
    });
    store.endForegroundAppOpenTiming({ ok: true });
    assert.equal(
      store.getFrontendTimingEvents().length,
      countAfterEnd,
      'foreground render re-runs after App-open end must not append unscoped timing events',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.performance = originalPerformance;
  }
}

async function test_visible_model_load_end_keeps_scope_after_content_visible_end() {
  installDeterministicBrowserStubs();
  let releaseFetch = null;
  globalThis.fetch = async () => new Promise((resolve) => {
    releaseFetch = () => resolve(jsonResponse({ snapshot: appSnapshot(), snapshot_seq: 5 }));
  });

  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test', autoBootstrap: false });
    store.clearFrontendTimingEvents();
    const openId = store.beginForegroundAppOpenTiming({
      app_name: 'Latency App',
      model_ref: { table_id: 'app:latency:a', model_id: 1 },
    });
    const loadPromise = store.ensureVisibleModelLoaded({ table_id: 'app:latency:a', model_id: 1 });
    await Promise.resolve();
    store.recordForegroundAppContentVisible({
      app_name: 'Latency App',
      model_ref: { table_id: 'app:latency:a', model_id: 1 },
    });
    store.endForegroundAppOpenTiming({ ok: true });
    releaseFetch();
    assert.equal(await loadPromise, true);

    const events = store.getFrontendTimingEvents();
    const loadEnd = events.find((event) => event.type === 'visible_model_load_end');
    assert.equal(
      loadEnd?.open_id,
      openId,
      'visible_model_load_end must keep the App-open scope captured at load start even if content-visible ended first',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.performance = originalPerformance;
  }
}

async function test_non_visible_snapshot_during_open_stays_unscoped() {
  installDeterministicBrowserStubs();
  globalThis.fetch = async () => jsonResponse({ snapshot: appSnapshot(), snapshot_seq: 6 });

  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test', autoBootstrap: false });
    store.clearFrontendTimingEvents();
    const openId = store.beginForegroundAppOpenTiming({
      app_name: 'Latency App',
      model_ref: { table_id: 'app:latency:a', model_id: 1 },
    });
    const refreshed = await store.refreshSnapshot('manual refresh while opening');
    assert.equal(refreshed, true);

    const events = store.getFrontendTimingEvents();
    const manualRefreshEvents = events.filter((event) => event.context === 'manual refresh while opening');
    assert.ok(manualRefreshEvents.length >= 4, 'manual refresh must still emit fetch/parse/apply timing events');
    assert.equal(
      manualRefreshEvents.some((event) => event.open_id === openId),
      false,
      'non-visible snapshot work during an App open must not be attributed to the foreground App-open scope',
    );
    assert.equal(
      events.filter((event) => event.open_id === openId).map((event) => event.type).join(','),
      'foreground_app_open_start',
      'only the foreground open start should be scoped before visible-model loading begins',
    );
    store.endForegroundAppOpenTiming({ ok: false });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.performance = originalPerformance;
  }
}

async function test_overlapping_app_opens_keep_snapshot_scope_from_request_start() {
  installDeterministicBrowserStubs();
  const pending = [];
  globalThis.fetch = async (url) => new Promise((resolve) => {
    pending.push({ url: String(url), resolve });
  });

  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test', autoBootstrap: false });
    const appA = { table_id: 'app:latency:a', model_id: 1 };
    const appB = { table_id: 'app:latency:b', model_id: 1 };
    store.clearFrontendTimingEvents();

    const openIdA = store.beginForegroundAppOpenTiming({ app_name: 'Latency App A', model_ref: appA });
    const loadA = store.ensureVisibleModelLoaded(appA);
    await Promise.resolve();
    assert.equal(pending.length, 1, 'App A visible snapshot request should be pending');

    const openIdB = store.beginForegroundAppOpenTiming({ app_name: 'Latency App B', model_ref: appB });
    const loadB = store.ensureVisibleModelLoaded(appB);
    await Promise.resolve();
    assert.equal(pending.length, 2, 'App B visible snapshot request should be pending');

    pending[0].resolve(jsonResponse({ snapshot: appSnapshotFor(appA, 'Latency App A'), snapshot_seq: 7 }));
    assert.equal(await loadA, true);

    const eventsAfterA = store.getFrontendTimingEvents();
    const appAResponse = eventsAfterA.find((event) => event.type === 'snapshot_fetch_response' && event.context === 'visible model lazy load app:latency:a|1');
    const appAApply = eventsAfterA.find((event) => event.type === 'snapshot_apply_start' && event.context === 'visible model lazy load app:latency:a|1');
    assert.equal(appAResponse?.open_id, openIdA, 'App A fetch response must keep App A open_id even after App B starts');
    assert.equal(appAApply?.open_id, openIdA, 'App A snapshot apply must keep App A open_id even after App B starts');
    assert.notEqual(appAResponse?.open_id, openIdB, 'App A fetch response must not be attributed to App B');
    assert.notEqual(appAApply?.open_id, openIdB, 'App A snapshot apply must not be attributed to App B');

    pending[1].resolve(jsonResponse({ snapshot: appSnapshotFor(appB, 'Latency App B'), snapshot_seq: 8 }));
    assert.equal(await loadB, true);

    const events = store.getFrontendTimingEvents();
    const appBResponse = events.find((event) => event.type === 'snapshot_fetch_response' && event.context === 'visible model lazy load app:latency:b|1');
    const appBApply = events.find((event) => event.type === 'snapshot_apply_start' && event.context === 'visible model lazy load app:latency:b|1');
    assert.equal(appBResponse?.open_id, openIdB, 'App B fetch response must keep App B open_id');
    assert.equal(appBApply?.open_id, openIdB, 'App B snapshot apply must keep App B open_id');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.performance = originalPerformance;
  }
}

const tests = [
  test_visible_model_lazy_load_emits_frontend_timing_events,
  test_foreground_app_open_scope_marks_visible_load_events,
  test_visible_model_load_end_keeps_scope_after_content_visible_end,
  test_non_visible_snapshot_during_open_stays_unscoped,
  test_overlapping_app_opens_keep_snapshot_scope_from_request_start,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.message ? err.message : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
