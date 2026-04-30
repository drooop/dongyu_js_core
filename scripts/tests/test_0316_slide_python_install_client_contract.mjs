#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const scriptPath = path.join(repoRoot, 'scripts/examples/slide_app_install_client.py');
const docPath = path.join(repoRoot, 'docs/user-guide/slide_python_install_client_v1.md');

function test_slide_python_client_example_exists_and_uses_supported_chain() {
  assert.ok(fs.existsSync(scriptPath), 'slide_python_client_script_missing');
  const text = fs.readFileSync(scriptPath, 'utf8');
  assert.match(text, /\/auth\/login/, 'slide_python_client_must_support_auth_login');
  assert.match(text, /\/api\/media\/upload/, 'slide_python_client_must_upload_via_ui_server');
  assert.match(text, /\/api\/runtime\/mode/, 'slide_python_client_must_activate_runtime_when_needed');
  assert.match(text, /\/bus_event/, 'slide_python_client_must_submit_import_click_via_bus_event');
  assert.match(text, /slide_import_media_uri_update/, 'slide_python_client_must_update_import_uri_via_model0_bus_key');
  assert.match(text, /slide_import_click/, 'slide_python_client_must_use_import_click_bus_key');
  assert.doesNotMatch(text, /ui_owner_label_update/, 'slide_python_client_must_not_use_owner_label_update_for_import_uri');
  assert.doesNotMatch(text, /post_ui_event/, 'slide_python_client_must_not_post_ui_event');
  assert.match(text, /slide_import_media_uri/, 'slide_python_client_must_write_import_media_uri');
  assert.match(text, /build_write_label_payload\([\s\S]*"slide_import_media_uri"[\s\S]*"str"/, 'slide_python_client_must_write_import_uri_with_modeltable_payload');
  assert.match(text, /build_write_label_payload\([\s\S]*"click"[\s\S]*"pin\.in"/, 'slide_python_client_must_trigger_importer_click_pin');
  assert.match(text, /__mt_payload_kind/, 'slide_python_client_click_must_use_modeltable_payload');
  assert.match(text, /"k": "target"[\s\S]*"model_id": 1031[\s\S]*"p": 0[\s\S]*"r": 0[\s\S]*"c": 0/, 'slide_python_client_click_must_target_importer_truth_cell');
  assert.doesNotMatch(text, /"value": \{"click": True\}/, 'slide_python_client_must_not_use_plain_click_object');
  assert.match(text, /1031/, 'slide_python_client_must_target_importer_truth');
  assert.match(text, /1030/, 'slide_python_client_must_target_importer_host');
  return { key: 'slide_python_client_example_exists_and_uses_supported_chain', status: 'PASS' };
}

function test_slide_python_client_doc_exists() {
  assert.ok(fs.existsSync(docPath), 'slide_python_client_doc_missing');
  const text = fs.readFileSync(docPath, 'utf8');
  assert.match(text, /\/api\/media\/upload/, 'slide_python_client_doc_must_name_upload_route');
  assert.match(text, /slide_import_media_uri/, 'slide_python_client_doc_must_name_import_uri_write');
  assert.match(text, /click pin/, 'slide_python_client_doc_must_name_click_pin');
  assert.match(text, /临时 ModelTable record array/u, 'slide_python_client_doc_must_name_modeltable_click_payload');
  return { key: 'slide_python_client_doc_exists', status: 'PASS' };
}

function test_slide_python_client_result_matching_requires_expected_app_name() {
  const code = `
import importlib.util
import json
import pathlib

script_path = pathlib.Path(${JSON.stringify(scriptPath)})
spec = importlib.util.spec_from_file_location("slide_app_install_client", script_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

snapshot = {
  "models": {
    "1031": {
      "cells": {
        "0,0,0": {
          "labels": {
            "slide_import_status": {"v": "imported: Old App"},
            "slide_import_last_app_name": {"v": "Old App"},
            "slide_import_last_app_id": {"v": 1036}
          }
        }
      }
    },
    "-2": {
      "cells": {
        "0,0,0": {
          "labels": {
            "ws_apps_registry": {
              "v": [
                {"model_id": 1036, "name": "Old App"},
                {"model_id": 1037, "name": "Different New App"}
              ]
            }
          }
        }
      }
    }
  }
}

result = module.extract_result(snapshot, "Minimal Submit App", previous_model_ids={1036})
if result.get("registry_match") is not None:
    raise AssertionError(json.dumps(result, ensure_ascii=False))
`;
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { key: 'slide_python_client_result_matching_requires_expected_app_name', status: 'PASS' };
}

function test_slide_python_client_result_matching_uses_last_id_for_same_name_apps() {
  const code = `
import importlib.util
import json
import pathlib

script_path = pathlib.Path(${JSON.stringify(scriptPath)})
spec = importlib.util.spec_from_file_location("slide_app_install_client", script_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

snapshot = {
  "models": {
    "1031": {
      "cells": {
        "0,0,0": {
          "labels": {
            "slide_import_status": {"v": "imported: Minimal Submit App"},
            "slide_import_last_app_name": {"v": "Minimal Submit App"},
            "slide_import_last_app_id": {"v": 1037}
          }
        }
      }
    },
    "-2": {
      "cells": {
        "0,0,0": {
          "labels": {
            "ws_apps_registry": {
              "v": [
                {"model_id": 1036, "name": "Minimal Submit App"},
                {"model_id": 1037, "name": "Minimal Submit App"}
              ]
            }
          }
        }
      }
    }
  }
}

result = module.extract_result(snapshot, "Minimal Submit App", previous_model_ids={1036})
match = result.get("registry_match")
if not match or match.get("model_id") != 1037:
    raise AssertionError(json.dumps(result, ensure_ascii=False))
`;
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { key: 'slide_python_client_result_matching_uses_last_id_for_same_name_apps', status: 'PASS' };
}

const tests = [
  test_slide_python_client_example_exists_and_uses_supported_chain,
  test_slide_python_client_doc_exists,
  test_slide_python_client_result_matching_requires_expected_app_name,
  test_slide_python_client_result_matching_uses_last_id_for_same_name_apps,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
