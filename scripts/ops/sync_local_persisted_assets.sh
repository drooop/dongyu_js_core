#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_PERSISTED_ASSET_ROOT="${LOCAL_PERSISTED_ASSET_ROOT:-/Users/drop/dongyu/volume/persist/assets}"

if [[ -z "$LOCAL_PERSISTED_ASSET_ROOT" || "$LOCAL_PERSISTED_ASSET_ROOT" == "/" ]]; then
  echo "ERROR: invalid LOCAL_PERSISTED_ASSET_ROOT=$LOCAL_PERSISTED_ASSET_ROOT" >&2
  exit 1
fi

export REPO_DIR
export LOCAL_PERSISTED_ASSET_ROOT

python3 - <<'PY'
import json
import os
import pathlib
import shutil

repo = pathlib.Path(os.environ['REPO_DIR']).resolve()
root = pathlib.Path(os.environ['LOCAL_PERSISTED_ASSET_ROOT']).resolve()

if root.exists():
    shutil.rmtree(root)
root.mkdir(parents=True, exist_ok=True)

def copy_rel(src_rel: str, dest_rel: str) -> None:
    src = repo / src_rel
    dest = root / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)

system_negative_full = [
    'cognition_handlers.json',
    'cognition_lifecycle_model.json',
    'cognition_scene_model.json',
    'docs_catalog_ui.json',
    'editor_test_catalog_ui.json',
    'gallery_catalog_ui.json',
    'home_catalog_ui.json',
    'intent_dispatch_config.json',
    'intent_handlers_docs.json',
    'intent_handlers_home.json',
    'intent_handlers_matrix_debug.json',
    'intent_handlers_prompt_filltable.json',
    'intent_handlers_static.json',
    'intent_handlers_ws.json',
    'llm_cognition_config.json',
    'login_catalog_ui.json',
    'matrix_config.json',
    'matrix_debug_surface.json',
    'nav_catalog_ui.json',
    'prompt_catalog_ui.json',
    'remote_worker_model.legacy.json',
    'server_config.json',
    'static_catalog_ui.json',
    'ui_to_matrix_forwarder.json',
    'workspace_catalog_ui.json',
]
system_negative_filtered = list(system_negative_full)
system_negative_filtered.remove('server_config.json')
system_positive_full = [
    'workspace_positive_models.json',
    'doc_page_filltable_example_minimal.json',
    'test_model_100_ui.json',
    'runtime_hierarchy_mounts.json',
]
registry_files = [
    ('packages/ui-renderer/src/component_registry_v1.json', 'registry/component_registry_v1.json'),
]
role_files = {
    'mbr-worker': [
        ('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json', 'roles/mbr/patches/mbr_role_v0.json', '20-role-negative'),
    ],
    'remote-worker': [
        ('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json', 'roles/remote-worker/patches/00_remote_worker_config.json', '20-role-negative'),
        ('deploy/sys-v1ns/remote-worker/patches/10_model100.json', 'roles/remote-worker/patches/10_model100.json', '40-role-positive'),
        ('deploy/sys-v1ns/remote-worker/patches/11_model1010.json', 'roles/remote-worker/patches/11_model1010.json', '40-role-positive'),
        ('deploy/sys-v1ns/remote-worker/patches/12_model1019.json', 'roles/remote-worker/patches/12_model1019.json', '40-role-positive'),
    ],
    'ui-side-worker': [
        ('deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json', 'roles/ui-side-worker/patches/00_ui_side_worker_config.json', '20-role-negative'),
        ('deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json', 'roles/ui-side-worker/patches/10_ui_side_worker_demo.json', '40-role-positive'),
    ],
}

copy_rel('packages/worker-base/system-models/system_models.json', 'system/base/system_models.json')
for filename in system_negative_full:
    copy_rel(f'packages/worker-base/system-models/{filename}', f'system/ui/{filename}')
for filename in system_positive_full:
    copy_rel(f'packages/worker-base/system-models/{filename}', f'system/positive/{filename}')
for src, dest in registry_files:
    copy_rel(src, dest)
for files in role_files.values():
    for src, dest, _phase in files:
        copy_rel(src, dest)

entries = [
    {
        'id': 'system-base',
        'phase': '00-system-base',
        'path': 'system/base/system_models.json',
        'kind': 'patch',
        'scope': ['ui-server', 'mbr-worker', 'remote-worker', 'ui-side-worker'],
        'authority': 'authoritative',
        'filter': 'full',
        'required': True,
    },
]

for filename in system_negative_filtered:
    entries.append({
        'id': f'system-ui-{filename.removesuffix(".json")}',
        'phase': '10-system-negative',
        'path': f'system/ui/{filename}',
        'kind': 'patch',
        'scope': ['ui-server'],
        'authority': 'authoritative',
        'filter': 'negative-only',
        'required': True,
    })

entries.append({
    'id': 'system-ui-server-config',
    'phase': '10-system-negative',
    'path': 'system/ui/server_config.json',
    'kind': 'patch',
    'scope': ['ui-server'],
    'authority': 'authoritative',
    'filter': 'full',
    'required': True,
})

for filename in system_positive_full:
    entries.append({
        'id': f'system-positive-{filename.removesuffix(".json")}',
        'phase': '30-system-positive',
        'path': f'system/positive/{filename}',
        'kind': 'patch',
        'scope': ['ui-server'],
        'authority': 'authoritative',
        'filter': 'full',
        'required': True,
    })

entries.append({
    'id': 'component-registry-v1',
    'phase': '10-system-negative',
    'path': 'registry/component_registry_v1.json',
    'kind': 'registry',
    'scope': ['ui-server', 'frontend-local'],
    'authority': 'authoritative',
    'filter': 'full',
    'required': True,
})

for scope, files in role_files.items():
    for src, dest, phase in files:
        entries.append({
            'id': f'{scope}-{pathlib.Path(dest).stem}',
            'phase': phase,
            'path': dest,
            'kind': 'patch',
            'scope': [scope],
            'authority': 'authoritative',
            'filter': 'full',
            'required': True,
        })

manifest = {
    'version': 'dy.asset_manifest.v0',
    'entries': entries,
}

(root / 'manifest.v0.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(root)
PY

echo "[sync-local-assets] persisted assets synced to: $LOCAL_PERSISTED_ASSET_ROOT"
