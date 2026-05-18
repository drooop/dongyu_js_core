window.MODEL_MOUNTING_DATA = {
  "generatedAt": "2026-05-18T16:11:07.566Z",
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
      "id": -28,
      "title": "Model -28",
      "desc": "",
      "kind": "system",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/desktop_catalog_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/desktop_catalog_ui.json",
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
      "id": -27,
      "title": "Model -27",
      "desc": "",
      "kind": "system",
      "runtimeType": "ui",
      "form": "model.single",
      "declaredBy": [
        "packages/worker-base/system-models/sliding_flow_shell_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/sliding_flow_shell_ui.json",
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
        "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json:record",
        "packages/worker-base/system-models/cognition_handlers.json:record",
        "packages/worker-base/system-models/intent_dispatch_config.json:record",
        "packages/worker-base/system-models/intent_handlers_docs.json:record",
        "packages/worker-base/system-models/intent_handlers_home.json:record",
        "packages/worker-base/system-models/intent_handlers_matrix_debug.json:record",
        "packages/worker-base/system-models/intent_handlers_prompt_filltable.json:record",
        "packages/worker-base/system-models/intent_handlers_slide_create.json:record",
        "packages/worker-base/system-models/intent_handlers_slide_import.json:record",
        "packages/worker-base/system-models/intent_handlers_static.json:record",
        "packages/worker-base/system-models/intent_handlers_three_scene.json:record",
        "packages/worker-base/system-models/intent_handlers_ui_examples.json:record",
        "packages/worker-base/system-models/intent_handlers_ws.json:record",
        "packages/worker-base/system-models/llm_cognition_config.json:record",
        "packages/worker-base/system-models/matrix_config.json:record",
        "packages/worker-base/system-models/system_models.json:record",
        "packages/worker-base/system-models/test_model_100_full.json:record",
        "packages/worker-base/system-models/test_model_100_ui.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
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
          "relPath": "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
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
          "relPath": "packages/worker-base/system-models/intent_handlers_slide_create.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        },
        {
          "relPath": "packages/worker-base/system-models/intent_handlers_slide_import.json",
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
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-mbr",
        "deploy-remote-worker",
        "fixture",
        "model100-local",
        "system-bootstrap",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": -3,
      "title": "Model -3",
      "desc": "Login UI 模型",
      "kind": "system",
      "runtimeType": "ui",
      "form": "model.single",
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
        "deploy/sys-v1ns/remote-worker/patches/11_model1010.json:record",
        "deploy/sys-v1ns/remote-worker/patches/12_model1019.json:record",
        "deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json:record",
        "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json:record",
        "packages/worker-base/system-models/runtime_hierarchy_mounts.json:record",
        "packages/worker-base/system-models/server_config.json:record",
        "packages/worker-base/system-models/system_models.json:record",
        "packages/worker-base/system-models/test_model_100_ui.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
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
          "relPath": "deploy/sys-v1ns/remote-worker/patches/11_model1010.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/12_model1019.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "relPath": "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
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
        },
        {
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-mbr",
        "deploy-remote-worker",
        "model100-local",
        "system-bootstrap",
        "ui-runtime-hierarchy",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1,
      "title": "Model 1",
      "desc": "用户模型 / demo",
      "kind": "user",
      "runtimeType": "main",
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
      "id": 2,
      "title": "Model 2",
      "desc": "用户模型",
      "kind": "user",
      "runtimeType": "main",
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
        "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record",
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
          "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
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
        "system-bootstrap",
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
      "id": 1009,
      "title": "Model 1009",
      "desc": "",
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
      "id": 1010,
      "title": "Model 1010",
      "desc": "",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "deploy/sys-v1ns/remote-worker/patches/11_model1010.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/11_model1010.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
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
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1011,
      "title": "Model 1011",
      "desc": "",
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
      "id": 1012,
      "title": "Model 1012",
      "desc": "",
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
      "id": 1013,
      "title": "Model 1013",
      "desc": "",
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
      "id": 1014,
      "title": "Model 1014",
      "desc": "",
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
      "id": 1015,
      "title": "Model 1015",
      "desc": "",
      "kind": "user",
      "runtimeType": "ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/doc_page_filltable_example_minimal.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/doc_page_filltable_example_minimal.json",
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
      "id": 1016,
      "title": "Model 1016",
      "desc": "",
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
      "id": 1017,
      "title": "Model 1017",
      "desc": "",
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
      "id": 1018,
      "title": "Model 1018",
      "desc": "",
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
      "id": 1019,
      "title": "Model 1019",
      "desc": "",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "deploy/sys-v1ns/remote-worker/patches/12_model1019.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/12_model1019.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
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
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1020,
      "title": "Model 1020",
      "desc": "",
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
      "id": 1021,
      "title": "Model 1021",
      "desc": "",
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
      "id": 1030,
      "title": "Model 1030",
      "desc": "",
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
      "id": 1031,
      "title": "Model 1031",
      "desc": "",
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
      "id": 1034,
      "title": "Model 1034",
      "desc": "",
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
      "id": 1035,
      "title": "Model 1035",
      "desc": "",
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
      "id": 1036,
      "title": "Model 1036",
      "desc": "",
      "kind": "user",
      "runtimeType": "ui",
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
      "id": 1037,
      "title": "Model 1037",
      "desc": "",
      "kind": "user",
      "runtimeType": "ui",
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
      "id": 1039,
      "title": "Model 1039",
      "desc": "",
      "kind": "user",
      "runtimeType": "ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/slide_app_provider_docs_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/slide_app_provider_docs_ui.json",
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
      "id": 1050,
      "title": "Model 1050",
      "desc": "",
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
      "id": 1051,
      "title": "Model 1051",
      "desc": "",
      "kind": "user",
      "runtimeType": "sliding_ui",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record",
        "packages/worker-base/system-models/workspace_positive_models.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
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
        "system-bootstrap",
        "workspace-positive-models"
      ],
      "canonical": true
    },
    {
      "id": 1052,
      "title": "Model 1052",
      "desc": "",
      "kind": "user",
      "runtimeType": "data",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
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
      "id": 2101,
      "title": "Model 2101",
      "desc": "",
      "kind": "user",
      "runtimeType": "data",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/templates/data_queue_v0.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/templates/data_queue_v0.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        }
      ],
      "sourceScopes": [
        "fixture"
      ],
      "canonical": false
    },
    {
      "id": 2201,
      "title": "Model 2201",
      "desc": "",
      "kind": "user",
      "runtimeType": "data",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/templates/data_stack_v0.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/templates/data_stack_v0.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        }
      ],
      "sourceScopes": [
        "fixture"
      ],
      "canonical": false
    },
    {
      "id": 2301,
      "title": "Model 2301",
      "desc": "",
      "kind": "user",
      "runtimeType": "data",
      "form": "model.table",
      "declaredBy": [
        "packages/worker-base/system-models/templates/data_array_one_v1.json:record"
      ],
      "sources": [
        {
          "relPath": "packages/worker-base/system-models/templates/data_array_one_v1.json",
          "scopeId": "fixture",
          "scopeLabel": "fixture / legacy",
          "canonical": false
        }
      ],
      "sourceScopes": [
        "fixture"
      ],
      "canonical": false
    },
    {
      "id": 3000,
      "title": "Model 3000",
      "desc": "",
      "kind": "user",
      "runtimeType": "ui",
      "form": "model.table",
      "declaredBy": [
        "deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "deploy-remote-worker"
      ],
      "canonical": true
    },
    {
      "id": 4000,
      "title": "Model 4000",
      "desc": "",
      "kind": "user",
      "runtimeType": "service",
      "form": "model.table",
      "declaredBy": [
        "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json:record"
      ],
      "sources": [
        {
          "relPath": "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json",
          "scopeId": "system-bootstrap",
          "scopeLabel": "system bootstrap",
          "canonical": true
        }
      ],
      "sourceScopes": [
        "system-bootstrap"
      ],
      "canonical": true
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
      "cell": "(1,0,3)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": -10,
      "cell": "(1,0,3)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
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
      "child": 100,
      "cell": "(10,0,0)",
      "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
      "scopeId": "model100-local",
      "scopeLabel": "model100 local ui",
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
      "parent": 0,
      "child": 1009,
      "cell": "(2,0,8)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1009,
      "cell": "(2,0,8)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1010,
      "cell": "(1,0,10)",
      "relPath": "deploy/sys-v1ns/remote-worker/patches/11_model1010.json",
      "scopeId": "deploy-remote-worker",
      "scopeLabel": "deploy remote-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1011,
      "cell": "(2,0,9)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1013,
      "cell": "(2,0,10)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1016,
      "cell": "(2,0,12)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1019,
      "cell": "(1,0,19)",
      "relPath": "deploy/sys-v1ns/remote-worker/patches/12_model1019.json",
      "scopeId": "deploy-remote-worker",
      "scopeLabel": "deploy remote-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1030,
      "cell": "(2,0,13)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1030,
      "cell": "(2,0,13)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1034,
      "cell": "(2,0,15)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1034,
      "cell": "(2,0,15)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1036,
      "cell": "(2,0,16)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1037,
      "cell": "(2,0,17)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1039,
      "cell": "(2,0,19)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 1050,
      "cell": "(9,0,1050)",
      "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
      "scopeId": "ui-runtime-hierarchy",
      "scopeLabel": "ui runtime hierarchy",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 3000,
      "cell": "(1,0,30)",
      "relPath": "deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json",
      "scopeId": "deploy-remote-worker",
      "scopeLabel": "deploy remote-worker",
      "canonical": true
    },
    {
      "parent": 0,
      "child": 4000,
      "cell": "(1,0,0)",
      "relPath": "deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json",
      "scopeId": "system-bootstrap",
      "scopeLabel": "system bootstrap",
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
    },
    {
      "parent": 1009,
      "child": 1010,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1011,
      "child": 1012,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1013,
      "child": 1014,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1016,
      "child": 1017,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1016,
      "child": 1018,
      "cell": "(0,2,1)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1016,
      "child": 1019,
      "cell": "(0,2,2)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1016,
      "child": 1020,
      "cell": "(0,2,3)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1016,
      "child": 1021,
      "cell": "(0,2,4)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1030,
      "child": 1031,
      "cell": "(0,2,0)",
      "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
      "scopeId": "workspace-positive-models",
      "scopeLabel": "workspace positive models",
      "canonical": true
    },
    {
      "parent": 1034,
      "child": 1035,
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
      "modelCount": 6,
      "mountCount": 5
    },
    {
      "id": "fixture",
      "label": "fixture / legacy",
      "canonical": false,
      "modelCount": 7,
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
      "mountCount": 1
    },
    {
      "id": "page-assets",
      "label": "page assets",
      "canonical": true,
      "modelCount": 9,
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
      "modelCount": 11,
      "mountCount": 1
    },
    {
      "id": "ui-runtime-hierarchy",
      "label": "ui runtime hierarchy",
      "canonical": true,
      "modelCount": 1,
      "mountCount": 33
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
      "modelCount": 34,
      "mountCount": 17
    }
  ],
  "audit": {
    "canonical": {
      "declaredModelCount": 54,
      "mountCount": 58,
      "unmountedCount": 5,
      "duplicateCount": 7,
      "unmountedModels": [
        {
          "id": -28,
          "title": "Model -28",
          "desc": "",
          "kind": "system",
          "runtimeType": "ui",
          "form": "model.single",
          "declaredBy": [
            "packages/worker-base/system-models/desktop_catalog_ui.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/desktop_catalog_ui.json",
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
          "id": -27,
          "title": "Model -27",
          "desc": "",
          "kind": "system",
          "runtimeType": "ui",
          "form": "model.single",
          "declaredBy": [
            "packages/worker-base/system-models/sliding_flow_shell_ui.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/sliding_flow_shell_ui.json",
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
          "id": 1015,
          "title": "Model 1015",
          "desc": "",
          "kind": "user",
          "runtimeType": "ui",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/doc_page_filltable_example_minimal.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/doc_page_filltable_example_minimal.json",
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
          "id": 1051,
          "title": "Model 1051",
          "desc": "",
          "kind": "user",
          "runtimeType": "sliding_ui",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record",
            "packages/worker-base/system-models/workspace_positive_models.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
              "scopeId": "system-bootstrap",
              "scopeLabel": "system bootstrap",
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
            "system-bootstrap",
            "workspace-positive-models"
          ],
          "canonical": true
        },
        {
          "id": 1052,
          "title": "Model 1052",
          "desc": "",
          "kind": "user",
          "runtimeType": "data",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
              "scopeId": "system-bootstrap",
              "scopeLabel": "system bootstrap",
              "canonical": true
            }
          ],
          "sourceScopes": [
            "system-bootstrap"
          ],
          "canonical": true
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
              "cell": "(1,0,3)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,3)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
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
            },
            {
              "parent": 0,
              "child": 100,
              "cell": "(10,0,0)",
              "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
              "scopeId": "model100-local",
              "scopeLabel": "model100 local ui",
              "canonical": true
            }
          ]
        },
        {
          "child": 1009,
          "entries": [
            {
              "parent": 0,
              "child": 1009,
              "cell": "(2,0,8)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1009,
              "cell": "(2,0,8)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1010,
          "entries": [
            {
              "parent": 0,
              "child": 1010,
              "cell": "(1,0,10)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/11_model1010.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 1009,
              "child": 1010,
              "cell": "(0,2,0)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1019,
          "entries": [
            {
              "parent": 0,
              "child": 1019,
              "cell": "(1,0,19)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/12_model1019.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 1016,
              "child": 1019,
              "cell": "(0,2,2)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1030,
          "entries": [
            {
              "parent": 0,
              "child": 1030,
              "cell": "(2,0,13)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1030,
              "cell": "(2,0,13)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1034,
          "entries": [
            {
              "parent": 0,
              "child": 1034,
              "cell": "(2,0,15)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1034,
              "cell": "(2,0,15)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        }
      ]
    },
    "all": {
      "declaredModelCount": 57,
      "mountCount": 58,
      "unmountedCount": 8,
      "duplicateCount": 7,
      "unmountedModels": [
        {
          "id": -28,
          "title": "Model -28",
          "desc": "",
          "kind": "system",
          "runtimeType": "ui",
          "form": "model.single",
          "declaredBy": [
            "packages/worker-base/system-models/desktop_catalog_ui.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/desktop_catalog_ui.json",
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
          "id": -27,
          "title": "Model -27",
          "desc": "",
          "kind": "system",
          "runtimeType": "ui",
          "form": "model.single",
          "declaredBy": [
            "packages/worker-base/system-models/sliding_flow_shell_ui.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/sliding_flow_shell_ui.json",
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
          "id": 1015,
          "title": "Model 1015",
          "desc": "",
          "kind": "user",
          "runtimeType": "ui",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/doc_page_filltable_example_minimal.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/doc_page_filltable_example_minimal.json",
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
          "id": 1051,
          "title": "Model 1051",
          "desc": "",
          "kind": "user",
          "runtimeType": "sliding_ui",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record",
            "packages/worker-base/system-models/workspace_positive_models.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
              "scopeId": "system-bootstrap",
              "scopeLabel": "system bootstrap",
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
            "system-bootstrap",
            "workspace-positive-models"
          ],
          "canonical": true
        },
        {
          "id": 1052,
          "title": "Model 1052",
          "desc": "",
          "kind": "user",
          "runtimeType": "data",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
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
          "id": 2101,
          "title": "Model 2101",
          "desc": "",
          "kind": "user",
          "runtimeType": "data",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/templates/data_queue_v0.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/templates/data_queue_v0.json",
              "scopeId": "fixture",
              "scopeLabel": "fixture / legacy",
              "canonical": false
            }
          ],
          "sourceScopes": [
            "fixture"
          ],
          "canonical": false
        },
        {
          "id": 2201,
          "title": "Model 2201",
          "desc": "",
          "kind": "user",
          "runtimeType": "data",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/templates/data_stack_v0.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/templates/data_stack_v0.json",
              "scopeId": "fixture",
              "scopeLabel": "fixture / legacy",
              "canonical": false
            }
          ],
          "sourceScopes": [
            "fixture"
          ],
          "canonical": false
        },
        {
          "id": 2301,
          "title": "Model 2301",
          "desc": "",
          "kind": "user",
          "runtimeType": "data",
          "form": "model.table",
          "declaredBy": [
            "packages/worker-base/system-models/templates/data_array_one_v1.json:record"
          ],
          "sources": [
            {
              "relPath": "packages/worker-base/system-models/templates/data_array_one_v1.json",
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
              "cell": "(1,0,3)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": -10,
              "cell": "(1,0,3)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
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
            },
            {
              "parent": 0,
              "child": 100,
              "cell": "(10,0,0)",
              "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
              "scopeId": "model100-local",
              "scopeLabel": "model100 local ui",
              "canonical": true
            }
          ]
        },
        {
          "child": 1009,
          "entries": [
            {
              "parent": 0,
              "child": 1009,
              "cell": "(2,0,8)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1009,
              "cell": "(2,0,8)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1010,
          "entries": [
            {
              "parent": 0,
              "child": 1010,
              "cell": "(1,0,10)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/11_model1010.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 1009,
              "child": 1010,
              "cell": "(0,2,0)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1019,
          "entries": [
            {
              "parent": 0,
              "child": 1019,
              "cell": "(1,0,19)",
              "relPath": "deploy/sys-v1ns/remote-worker/patches/12_model1019.json",
              "scopeId": "deploy-remote-worker",
              "scopeLabel": "deploy remote-worker",
              "canonical": true
            },
            {
              "parent": 1016,
              "child": 1019,
              "cell": "(0,2,2)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1030,
          "entries": [
            {
              "parent": 0,
              "child": 1030,
              "cell": "(2,0,13)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1030,
              "cell": "(2,0,13)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
              "canonical": true
            }
          ]
        },
        {
          "child": 1034,
          "entries": [
            {
              "parent": 0,
              "child": 1034,
              "cell": "(2,0,15)",
              "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
              "scopeId": "ui-runtime-hierarchy",
              "scopeLabel": "ui runtime hierarchy",
              "canonical": true
            },
            {
              "parent": 0,
              "child": 1034,
              "cell": "(2,0,15)",
              "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
              "scopeId": "workspace-positive-models",
              "scopeLabel": "workspace positive models",
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
      "modelCount": 52,
      "mountCount": 51,
      "modelIds": [
        -103,
        -102,
        -101,
        -100,
        -28,
        -27,
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
        1008,
        1009,
        1010,
        1011,
        1012,
        1013,
        1014,
        1015,
        1016,
        1017,
        1018,
        1019,
        1020,
        1021,
        1030,
        1031,
        1034,
        1035,
        1036,
        1037,
        1039,
        1050,
        1051,
        1052
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
          "child": -10,
          "cell": "(1,0,3)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
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
          "child": 100,
          "cell": "(10,0,0)",
          "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
          "scopeId": "model100-local",
          "scopeLabel": "model100 local ui",
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
          "parent": 0,
          "child": 1009,
          "cell": "(2,0,8)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1009,
          "cell": "(2,0,8)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1011,
          "cell": "(2,0,9)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1013,
          "cell": "(2,0,10)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1016,
          "cell": "(2,0,12)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1030,
          "cell": "(2,0,13)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1030,
          "cell": "(2,0,13)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1034,
          "cell": "(2,0,15)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1034,
          "cell": "(2,0,15)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1036,
          "cell": "(2,0,16)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1037,
          "cell": "(2,0,17)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1039,
          "cell": "(2,0,19)",
          "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
          "scopeId": "ui-runtime-hierarchy",
          "scopeLabel": "ui runtime hierarchy",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1050,
          "cell": "(9,0,1050)",
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
        },
        {
          "parent": 1009,
          "child": 1010,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1011,
          "child": 1012,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1013,
          "child": 1014,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1016,
          "child": 1017,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1016,
          "child": 1018,
          "cell": "(0,2,1)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1016,
          "child": 1019,
          "cell": "(0,2,2)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1016,
          "child": 1020,
          "cell": "(0,2,3)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1016,
          "child": 1021,
          "cell": "(0,2,4)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1030,
          "child": 1031,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        },
        {
          "parent": 1034,
          "child": 1035,
          "cell": "(0,2,0)",
          "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
          "scopeId": "workspace-positive-models",
          "scopeLabel": "workspace positive models",
          "canonical": true
        }
      ],
      "audit": {
        "declaredModelCount": 52,
        "mountCount": 51,
        "unmountedCount": 5,
        "duplicateCount": 5,
        "unmountedModels": [
          {
            "id": -28,
            "title": "Model -28",
            "desc": "",
            "kind": "system",
            "runtimeType": "ui",
            "form": "model.single",
            "declaredBy": [
              "packages/worker-base/system-models/desktop_catalog_ui.json:record"
            ],
            "sources": [
              {
                "relPath": "packages/worker-base/system-models/desktop_catalog_ui.json",
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
            "id": -27,
            "title": "Model -27",
            "desc": "",
            "kind": "system",
            "runtimeType": "ui",
            "form": "model.single",
            "declaredBy": [
              "packages/worker-base/system-models/sliding_flow_shell_ui.json:record"
            ],
            "sources": [
              {
                "relPath": "packages/worker-base/system-models/sliding_flow_shell_ui.json",
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
            "id": 1015,
            "title": "Model 1015",
            "desc": "",
            "kind": "user",
            "runtimeType": "ui",
            "form": "model.table",
            "declaredBy": [
              "packages/worker-base/system-models/doc_page_filltable_example_minimal.json:record"
            ],
            "sources": [
              {
                "relPath": "packages/worker-base/system-models/doc_page_filltable_example_minimal.json",
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
            "id": 1051,
            "title": "Model 1051",
            "desc": "",
            "kind": "user",
            "runtimeType": "sliding_ui",
            "form": "model.table",
            "declaredBy": [
              "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record",
              "packages/worker-base/system-models/workspace_positive_models.json:record"
            ],
            "sources": [
              {
                "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
                "scopeId": "system-bootstrap",
                "scopeLabel": "system bootstrap",
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
              "system-bootstrap",
              "workspace-positive-models"
            ],
            "canonical": true
          },
          {
            "id": 1052,
            "title": "Model 1052",
            "desc": "",
            "kind": "user",
            "runtimeType": "data",
            "form": "model.table",
            "declaredBy": [
              "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json:record"
            ],
            "sources": [
              {
                "relPath": "packages/worker-base/system-models/workspace_manager_asset_manager_ui.json",
                "scopeId": "system-bootstrap",
                "scopeLabel": "system bootstrap",
                "canonical": true
              }
            ],
            "sourceScopes": [
              "system-bootstrap"
            ],
            "canonical": true
          }
        ],
        "duplicateChildren": [
          {
            "child": -10,
            "entries": [
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
                "child": -10,
                "cell": "(1,0,3)",
                "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
                "scopeId": "workspace-positive-models",
                "scopeLabel": "workspace positive models",
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
                "cell": "(10,0,0)",
                "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
                "scopeId": "ui-runtime-hierarchy",
                "scopeLabel": "ui runtime hierarchy",
                "canonical": true
              },
              {
                "parent": 0,
                "child": 100,
                "cell": "(10,0,0)",
                "relPath": "packages/worker-base/system-models/test_model_100_ui.json",
                "scopeId": "model100-local",
                "scopeLabel": "model100 local ui",
                "canonical": true
              }
            ]
          },
          {
            "child": 1009,
            "entries": [
              {
                "parent": 0,
                "child": 1009,
                "cell": "(2,0,8)",
                "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
                "scopeId": "ui-runtime-hierarchy",
                "scopeLabel": "ui runtime hierarchy",
                "canonical": true
              },
              {
                "parent": 0,
                "child": 1009,
                "cell": "(2,0,8)",
                "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
                "scopeId": "workspace-positive-models",
                "scopeLabel": "workspace positive models",
                "canonical": true
              }
            ]
          },
          {
            "child": 1030,
            "entries": [
              {
                "parent": 0,
                "child": 1030,
                "cell": "(2,0,13)",
                "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
                "scopeId": "ui-runtime-hierarchy",
                "scopeLabel": "ui runtime hierarchy",
                "canonical": true
              },
              {
                "parent": 0,
                "child": 1030,
                "cell": "(2,0,13)",
                "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
                "scopeId": "workspace-positive-models",
                "scopeLabel": "workspace positive models",
                "canonical": true
              }
            ]
          },
          {
            "child": 1034,
            "entries": [
              {
                "parent": 0,
                "child": 1034,
                "cell": "(2,0,15)",
                "relPath": "packages/worker-base/system-models/runtime_hierarchy_mounts.json",
                "scopeId": "ui-runtime-hierarchy",
                "scopeLabel": "ui runtime hierarchy",
                "canonical": true
              },
              {
                "parent": 0,
                "child": 1034,
                "cell": "(2,0,15)",
                "relPath": "packages/worker-base/system-models/workspace_positive_models.json",
                "scopeId": "workspace-positive-models",
                "scopeLabel": "workspace positive models",
                "canonical": true
              }
            ]
          }
        ]
      }
    },
    "remote-worker": {
      "id": "remote-worker",
      "label": "remote-worker",
      "modelCount": 6,
      "mountCount": 5,
      "modelIds": [
        -10,
        0,
        100,
        1010,
        1019,
        3000
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
        },
        {
          "parent": 0,
          "child": 1010,
          "cell": "(1,0,10)",
          "relPath": "deploy/sys-v1ns/remote-worker/patches/11_model1010.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 1019,
          "cell": "(1,0,19)",
          "relPath": "deploy/sys-v1ns/remote-worker/patches/12_model1019.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        },
        {
          "parent": 0,
          "child": 3000,
          "cell": "(1,0,30)",
          "relPath": "deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json",
          "scopeId": "deploy-remote-worker",
          "scopeLabel": "deploy remote-worker",
          "canonical": true
        }
      ],
      "audit": {
        "declaredModelCount": 6,
        "mountCount": 5,
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
