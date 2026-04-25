window.MODEL_MOUNTING_DATA = {
  "generatedAt": "2026-03-30T06:45:44.627Z",
  "models": [
    {
      "id": -103,
      "title": "Model -103",
      "desc": "Gallery 目录",
      "kind": "system",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/gallery_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/gallery_catalog_ui.json",
          "scopeId": "gallery-catalog",
          "scopeLabel": "gallery catalog",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "gallery-catalog"
      ],
      "canonical": true
    },
    {
      "id": -102,
      "title": "Model -102",
      "desc": "Gallery 状态",
      "kind": "system",
      "runtimeType": "ui",
      "form": "unknown",
      "declaredBy": [
        "packages/ui-model-demo-server/server.mjs#bootstrap:server-bootstrap",
        "packages/worker-base/system-models/gallery_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/ui-model-demo-server/server.mjs#bootstrap",
          "scopeId": "server-bootstrap",
          "scopeLabel": "server bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/gallery_catalog_ui.json",
          "scopeId": "gallery-catalog",
          "scopeLabel": "gallery catalog",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "gallery-catalog",
        "server-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": -101,
      "title": "Model -101",
      "desc": "Gallery 邮箱",
      "kind": "system",
      "runtimeType": "ui",
      "form": "unknown",
      "declaredBy": [
        "packages/ui-model-demo-server/server.mjs#bootstrap:server-bootstrap"
      ],
      "sources": [
        {
          "relPath": "packages/ui-model-demo-server/server.mjs#bootstrap",
          "scopeId": "server-bootstrap",
          "scopeLabel": "server bootstrap",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "server-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": -100,
      "title": "Model -100",
      "desc": "矩阵调试 / Bus Trace",
      "kind": "system",
      "runtimeType": "Data",
      "form": "model.single",
      "declaredBy": [
        "packages/ui-model-demo-server/server.mjs#bootstrap:server-bootstrap",
        "packages/worker-base/system-models/matrix_debug_surface.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/ui-model-demo-server/server.mjs#bootstrap",
          "scopeId": "server-bootstrap",
          "scopeLabel": "server bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/matrix_debug_surface.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets",
        "server-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": -26,
      "title": "Model -26",
      "desc": "Editor Test 页面资产",
      "kind": "page",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/editor_test_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/editor_test_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets"
      ],
      "canonical": true
    },
    {
      "id": -25,
      "title": "Model -25",
      "desc": "Workspace 页面资产 / Catalog host",
      "kind": "page",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_catalog_ui.json",
          "scopeId": "workspace-catalog",
          "scopeLabel": "workspace catalog",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-catalog"
      ],
      "canonical": true
    },
    {
      "id": -24,
      "title": "Model -24",
      "desc": "Static 页面资产",
      "kind": "page",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/static_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/static_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets"
      ],
      "canonical": true
    },
    {
      "id": -23,
      "title": "Model -23",
      "desc": "Docs 页面资产",
      "kind": "page",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/docs_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/docs_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets"
      ],
      "canonical": true
    },
    {
      "id": -22,
      "title": "Model -22",
      "desc": "Home 页面资产",
      "kind": "page",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/home_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/home_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets"
      ],
      "canonical": true
    },
    {
      "id": -21,
      "title": "Model -21",
      "desc": "Prompt 页面资产",
      "kind": "page",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/prompt_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/prompt_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets"
      ],
      "canonical": true
    },
    {
      "id": -12,
      "title": "Model -12",
      "desc": "认知上下文",
      "kind": "system",
      "runtimeType": "system",
      "form": "unknown",
      "declaredBy": [
        "packages/worker-base/system-models/cognition_scene_model.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/cognition_scene_model.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "system-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": -10,
      "title": "Model -10",
      "desc": "系统运行时逻辑 (intent/mgmt/mbr)",
      "kind": "system",
      "runtimeType": "system",
      "form": "unknown",
      "declaredBy": [
        "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json:record",
        "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json:record",
        "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json:record",
        "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json:record",
        "packages/worker-base/system-models/cognition_handlers.json:record",
        "packages/worker-base/system-models/intent_dispatch_config.json:record",
        "packages/worker-base/system-models/intent_handlers_docs.json:record",
        "packages/worker-base/system-models/intent_handlers_home.json:record",
        "packages/worker-base/system-models/intent_handlers_matrix_debug.json:record",
        "packages/worker-base/system-models/intent_handlers_prompt_filltable.json:record",
        "packages/worker-base/system-models/intent_handlers_static.json:record",
        "packages/worker-base/system-models/intent_handlers_three_scene.json:record",
        "packages/worker-base/system-models/intent_handlers_ui_examples.json:record",
        "packages/worker-base/system-models/intent_handlers_ws.json:record",
        "packages/worker-base/system-models/llm_cognition_config.json:record",
        "packages/worker-base/system-models/matrix_config.json:record",
        "packages/worker-base/system-models/remote_worker_model.legacy.json:record",
        "packages/worker-base/system-models/system_models.json:record",
        "packages/worker-base/system-models/test_model_100_full.json:record",
        "packages/worker-base/system-models/test_model_100_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json",
          "scopeId": "deploy-mbr",
          "scopeLabel": "deploy mbr",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/cognition_handlers.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_dispatch_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_docs.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_home.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_matrix_debug.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_prompt_filltable.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_static.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_three_scene.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_ui_examples.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_ws.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/llm_cognition_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/matrix_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/remote_worker_model.legacy.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        },
        {
          "relPath": "packages/worker-base/system-models/system_models.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/test_model_100_full.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        },
        {
          "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
          "scopeId": "model100-local",
          "scopeLabel": "model100 local ui",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-mbr",
        "deploy-remote-worker",
        "deploy-ui-side-worker",
        "fixture",
        "model100-local",
        "system-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": -3,
      "title": "Model -3",
      "desc": "Login UI 模型",
      "kind": "system",
      "runtimeType": "ui",
      "form": "unknown",
      "declaredBy": [
        "packages/ui-model-demo-server/server.mjs#bootstrap:server-bootstrap",
        "packages/worker-base/system-models/login_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/ui-model-demo-server/server.mjs#bootstrap",
          "scopeId": "server-bootstrap",
          "scopeLabel": "server bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/login_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets",
        "server-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": -2,
      "title": "Model -2",
      "desc": "编辑器/Home UI 状态投影",
      "kind": "system",
      "runtimeType": "ui",
      "form": "unknown",
      "declaredBy": [
        "packages/ui-model-demo-server/server.mjs#bootstrap:server-bootstrap",
        "packages/worker-base/system-models/nav_catalog_ui.json:record",
        "packages/worker-base/system-models/prompt_catalog_ui.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/ui-model-demo-server/server.mjs#bootstrap",
          "scopeId": "server-bootstrap",
          "scopeLabel": "server bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/nav_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/prompt_catalog_ui.json",
          "scopeId": "page-assets",
          "scopeLabel": "page assets",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "page-assets",
        "server-bootstrap",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": -1,
      "title": "Model -1",
      "desc": "UI 事件邮箱",
      "kind": "system",
      "runtimeType": "ui",
      "form": "unknown",
      "declaredBy": [
        "packages/ui-model-demo-server/server.mjs#bootstrap:server-bootstrap",
        "packages/worker-base/system-models/cognition_lifecycle_model.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/ui-model-demo-server/server.mjs#bootstrap",
          "scopeId": "server-bootstrap",
          "scopeLabel": "server bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/cognition_lifecycle_model.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "server-bootstrap",
        "system-bootstrap"
      ],
      "canonical": true
    },
    {
      "id": 0,
      "title": "Model 0",
      "desc": "系统根 / 中间层",
      "kind": "system",
      "runtimeType": null,
      "form": "model.table",
      "declaredBy": [
        "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json:record",
        "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json:record",
        "deploy/sys-v1ns/remote-worker/patches/10_model100.json:record",
        "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json:record",
        "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json:record",
        "packages/worker-base/system-models/runtime_hierarchy_mounts.json:record",
        "packages/worker-base/system-models/server_config.json:record",
        "packages/worker-base/system-models/system_models.json:record",
        "packages/worker-base/system-models/test_model_100_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json",
          "scopeId": "deploy-mbr",
          "scopeLabel": "deploy mbr",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/10_model100.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/server_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/system_models.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
          "scopeId": "model100-local",
          "scopeLabel": "model100 local ui",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-mbr",
        "deploy-remote-worker",
        "deploy-ui-side-worker",
        "model100-local",
        "system-bootstrap",
        "ui-runtime-hierarchy"
      ],
      "canonical": true
    },
    {
      "id": 1,
      "title": "Model 1",
      "desc": "用户模型 / demo",
      "kind": "user",
      "runtimeType": "main",
      "form": "model.single",
      "declaredBy": [
        "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-ui-side-worker",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 2,
      "title": "Model 2",
      "desc": "用户模型",
      "kind": "user",
      "runtimeType": "main",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/remote_worker_model.legacy.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/remote_worker_model.legacy.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "fixture",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 100,
      "title": "Model 100",
      "desc": "颜色生成器",
      "kind": "user",
      "runtimeType": "ui",
      "form": "model.table",
      "declaredBy": [
        "deploy/sys-v1ns/remote-worker/patches/10_model100.json:record",
        "packages/worker-base/system-models/test_model_100_full.json:record",
        "packages/worker-base/system-models/test_model_100_ui.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/10_model100.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/test_model_100_full.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        },
        {
          "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
          "scopeId": "model100-local",
          "scopeLabel": "model100 local ui",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-remote-worker",
        "fixture",
        "model100-local",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1001,
      "title": "Model 1001",
      "desc": "用户模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_demo_apps.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_demo_apps.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "fixture",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1002,
      "title": "Model 1002",
      "desc": "用户模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_demo_apps.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_demo_apps.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "fixture",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1003,
      "title": "Model 1003",
      "desc": "用户模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1004,
      "title": "Model 1004",
      "desc": "用户模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1005,
      "title": "Model 1005",
      "desc": "sliding_ui 父模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1006,
      "title": "Model 1006",
      "desc": "sliding_ui 子模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1007,
      "title": "Model 1007",
      "desc": "three-scene 父模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1008,
      "title": "Model 1008",
      "desc": "three-scene 子模型",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 2001,
      "title": "Model 2001",
      "desc": "",
      "kind": "user",
      "runtimeType": "data",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/templates/data_array_v0.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/templates/data_array_v0.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        }
      ],
      "sourceScopes": [
        "fixture"
      ],
      "canonical": false
    }
  ],
  "mounts": [
    {
      "parent": 0,
      "child": -103,
      "cell": "(1,0,14)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -102,
      "cell": "(1,0,13)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -101,
      "cell": "(1,0,12)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -100,
      "cell": "(1,0,11)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -26,
      "cell": "(1,0,10)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -25,
      "cell": "(1,0,9)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -24,
      "cell": "(1,0,8)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -23,
      "cell": "(1,0,7)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -22,
      "cell": "(1,0,6)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -21,
      "cell": "(1,0,5)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -12,
      "cell": "(1,0,4)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -10,
      "cell": "(1,0,0)",
      "relPath": "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json",
      "scopeId": "deploy-mbr",
      "scopeLabel": "deploy mbr",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -10,
      "cell": "(1,0,1)",
      "relPath": "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json",
      "scopeId": "deploy-remote-worker",
      "scopeLabel": "deploy remote-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -10,
      "cell": "(1,0,1)",
      "relPath": "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json",
      "scopeId": "deploy-ui-side-worker",
      "scopeLabel": "deploy ui-side-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -10,
      "cell": "(1,0,3)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -3,
      "cell": "(1,0,2)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -2,
      "cell": "(1,0,1)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -1,
      "cell": "(1,0,0)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1,
      "cell": "(1,0,0)",
      "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
      "scopeId": "deploy-ui-side-worker",
      "scopeLabel": "deploy ui-side-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1,
      "cell": "(2,0,0)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 2,
      "cell": "(2,0,1)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 100,
      "cell": "(1,0,0)",
      "relPath": "deploy/sys-v1ns/remote-worker/patches/10_model100.json",
      "scopeId": "deploy-remote-worker",
      "scopeLabel": "deploy remote-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 100,
      "cell": "(10,0,0)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1001,
      "cell": "(2,0,2)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1002,
      "cell": "(2,0,3)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1003,
      "cell": "(2,0,4)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1004,
      "cell": "(2,0,5)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1005,
      "cell": "(2,0,6)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1007,
      "cell": "(2,0,7)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 1005,
      "child": 1006,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1007,
      "child": 1008,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    }
  ],
  "scopes": [
    {
      "id": "deploy-mbr",
      "label": "deploy mbr",
      "canonical": true,
      "modelCount": 2,
      "mountCount": 1
    },
    {
      "id": "deploy-remote-worker",
      "label": "deploy remote-worker",
      "canonical": true,
      "modelCount": 3,
      "mountCount": 2
    },
    {
      "id": "deploy-ui-side-worker",
      "label": "deploy ui-side-worker",
      "canonical": true,
      "modelCount": 3,
      "mountCount": 2
    },
    {
      "id": "fixture",
      "label": "fixture / legacy",
      "canonical": false,
      "modelCount": 6,
      "mountCount": 0
    },
    {
      "id": "gallery-catalog",
      "label": "gallery catalog",
      "canonical": true,
      "modelCount": 2,
      "mountCount": 0
    },
    {
      "id": "model100-local",
      "label": "model100 local ui",
      "canonical": true,
      "modelCount": 3,
      "mountCount": 0
    },
    {
      "id": "page-assets",
      "label": "page assets",
      "canonical": true,
      "modelCount": 8,
      "mountCount": 0
    },
    {
      "id": "server-bootstrap",
      "label": "server bootstrap",
      "canonical": true,
      "modelCount": 6,
      "mountCount": 0
    },
    {
      "id": "system-bootstrap",
      "label": "system bootstrap",
      "canonical": true,
      "modelCount": 4,
      "mountCount": 0
    },
    {
      "id": "ui-runtime-hierarchy",
      "label": "ui runtime hierarchy",
      "canonical": true,
      "modelCount": 1,
      "mountCount": 24
    },
    {
      "id": "workspace-catalog",
      "label": "workspace catalog",
      "canonical": true,
      "modelCount": 1,
      "mountCount": 0
    },
    {
      "id": "workspace-positive-models",
      "label": "workspace positive models",
      "canonical": true,
      "modelCount": 12,
      "mountCount": 2
    }
  ],
  "audit": {
    "canonical": {
      "declaredModelCount": 27,
      "mountCount": 31,
      "unmountedCount": 0,
      "duplicateCount": 3,
      "unmountedModels": [],
      "duplicateChildren": [
        {
          "child": -10,
          "entries": [
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,0)",
              "relPath": "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json",
              "scopeId": "deploy-mbr",
              "scopeLabel": "deploy mbr",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,1)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,1)",
              "relPath": "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json",
              "scopeId": "deploy-ui-side-worker",
              "scopeLabel": "deploy ui-side-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,3)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            }
          ]
        },
        {
          "child": 1,
          "entries": [
            {
              "parent": 0,
              "child": 1,
              "cell": "(1,0,0)",
              "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
              "scopeId": "deploy-ui-side-worker",
              "scopeLabel": "deploy ui-side-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1,
              "cell": "(2,0,0)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            }
          ]
        },
        {
          "child": 100,
          "entries": [
            {
              "parent": 0,
              "child": 100,
              "cell": "(1,0,0)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/10_model100.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 100,
              "cell": "(10,0,0)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            }
          ]
        }
      ]
    },
    "all": {
      "declaredModelCount": 28,
      "mountCount": 31,
      "unmountedCount": 1,
      "duplicateCount": 3,
      "unmountedModels": [
        {
          "id": 2001,
          "title": "Model 2001",
          "desc": "",
          "kind": "user",
          "runtimeType": "data",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/templates/data_array_v0.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/templates/data_array_v0.json",
              "scopeId": "fixture",
              "scopeLabel": "fixture / legacy",
              "canonical": false
            }
          ],
          "sourceScopes": [
            "fixture"
          ],
          "canonical": false
        }
      ],
      "duplicateChildren": [
        {
          "child": -10,
          "entries": [
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,0)",
              "relPath": "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json",
              "scopeId": "deploy-mbr",
              "scopeLabel": "deploy mbr",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,1)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,1)",
              "relPath": "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json",
              "scopeId": "deploy-ui-side-worker",
              "scopeLabel": "deploy ui-side-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,3)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            }
          ]
        },
        {
          "child": 1,
          "entries": [
            {
              "parent": 0,
              "child": 1,
              "cell": "(1,0,0)",
              "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
              "scopeId": "deploy-ui-side-worker",
              "scopeLabel": "deploy ui-side-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1,
              "cell": "(2,0,0)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            }
          ]
        },
        {
          "child": 100,
          "entries": [
            {
              "parent": 0,
              "child": 100,
              "cell": "(1,0,0)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/10_model100.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 100,
              "cell": "(10,0,0)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            }
          ]
        }
      ]
    }
  },
  "profiles": {
    "ui-server": {
      "id": "ui-server",
      "label": "ui-server",
      "modelCount": 27,
      "mountCount": 26,
      "modelIds": [
        -103,
        -102,
        -101,
        -100,
        -26,
        -25,
        -24,
        -23,
        -22,
        -21,
        -12,
        -10,
        -3,
        -2,
        -1,
        0,
        1,
        2,
        100,
        1001,
        1002,
        1003,
        1004,
        1005,
        1006,
        1007,
        1008
      ],
      "mounts": [
        {
          "parent": 0,
          "child": -103,
          "cell": "(1,0,14)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -102,
          "cell": "(1,0,13)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -101,
          "cell": "(1,0,12)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -100,
          "cell": "(1,0,11)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -26,
          "cell": "(1,0,10)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -25,
          "cell": "(1,0,9)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -24,
          "cell": "(1,0,8)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -23,
          "cell": "(1,0,7)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -22,
          "cell": "(1,0,6)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -21,
          "cell": "(1,0,5)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -12,
          "cell": "(1,0,4)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -10,
          "cell": "(1,0,3)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -3,
          "cell": "(1,0,2)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -2,
          "cell": "(1,0,1)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": -1,
          "cell": "(1,0,0)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1,
          "cell": "(2,0,0)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 2,
          "cell": "(2,0,1)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 100,
          "cell": "(10,0,0)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1001,
          "cell": "(2,0,2)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1002,
          "cell": "(2,0,3)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1003,
          "cell": "(2,0,4)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1004,
          "cell": "(2,0,5)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1005,
          "cell": "(2,0,6)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1007,
          "cell": "(2,0,7)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 1005,
          "child": 1006,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1007,
          "child": 1008,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "audit": {
        "declaredModelCount": 27,
        "mountCount": 26,
        "unmountedCount": 0,
        "duplicateCount": 0,
        "unmountedModels": [],
        "duplicateChildren": []
      }
    },
    "remote-worker": {
      "id": "remote-worker",
      "label": "remote-worker",
      "modelCount": 3,
      "mountCount": 2,
      "modelIds": [
        -10,
        0,
        100
      ],
      "mounts": [
        {
          "parent": 0,
          "child": -10,
          "cell": "(1,0,1)",
          "relPath": "deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 100,
          "cell": "(1,0,0)",
          "relPath": "deploy/sys-v1ns/remote-worker/patches/10_model100.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        }
      ],
      "audit": {
        "declaredModelCount": 3,
        "mountCount": 2,
        "unmountedCount": 0,
        "duplicateCount": 0,
        "unmountedModels": [],
        "duplicateChildren": []
      }
    },
    "ui-side-worker": {
      "id": "ui-side-worker",
      "label": "ui-side-worker",
      "modelCount": 3,
      "mountCount": 2,
      "modelIds": [
        -10,
        0,
        1
      ],
      "mounts": [
        {
          "parent": 0,
          "child": -10,
          "cell": "(1,0,1)",
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1,
          "cell": "(1,0,0)",
          "relPath": "deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json",
          "scopeId": "deploy-ui-side-worker",
          "scopeLabel": "deploy ui-side-worker",
          "canonical": true
        }
      ],
      "audit": {
        "declaredModelCount": 3,
        "mountCount": 2,
        "unmountedCount": 0,
        "duplicateCount": 0,
        "unmountedModels": [],
        "duplicateChildren": []
      }
    },
    "mbr-worker": {
      "id": "mbr-worker",
      "label": "mbr-worker",
      "modelCount": 2,
      "mountCount": 1,
      "modelIds": [
        -10,
        0
      ],
      "mounts": [
        {
          "parent": 0,
          "child": -10,
          "cell": "(1,0,0)",
          "relPath": "deploy/sys-v1ns/mbr/patches/mbr_role_v0.json",
          "scopeId": "deploy-mbr",
          "scopeLabel": "deploy mbr",
          "canonical": true
        }
      ],
      "audit": {
        "declaredModelCount": 2,
        "mountCount": 1,
        "unmountedCount": 0,
        "duplicateCount": 0,
        "unmountedModels": [],
        "duplicateChildren": []
      }
    }
  }
};
