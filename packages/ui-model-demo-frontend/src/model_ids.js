// Shared model IDs across demo stores.

// Editor (ModelTable editor UI) models.
export const EDITOR_MAILBOX_MODEL_ID = -1;
export const EDITOR_STATE_MODEL_ID = -2;
export const ACTION_LIFECYCLE_MODEL_ID = EDITOR_MAILBOX_MODEL_ID;
export const SCENE_CONTEXT_MODEL_ID = -12;
export const WORKSPACE_CATALOG_MODEL_ID = -25;

// System/internal (currently used for pin demo actions).
export const SYSTEM_MODEL_ID = -10;
export const PROMPT_CATALOG_MODEL_ID = -21;
export const MATRIX_DEBUG_MODEL_ID = -100;

// Gallery models (kept separate from editor mailbox/state).
export const GALLERY_MAILBOX_MODEL_ID = -101;
export const GALLERY_STATE_MODEL_ID = -102;
export const GALLERY_CATALOG_MODEL_ID = -103;

// Wave C demo submodel.
export const WAVE_C_SUBMODEL_ID = 2001;

// 0215 canonical UI model examples.
export const UI_EXAMPLE_SCHEMA_MODEL_ID = 1003;
export const UI_EXAMPLE_PAGE_ASSET_MODEL_ID = 1004;
export const UI_EXAMPLE_PARENT_MODEL_ID = 1005;
export const UI_EXAMPLE_CHILD_MODEL_ID = 1006;
export const UI_EXAMPLE_PROMOTE_CHILD_ACTION = 'ui_examples_promote_child_stage';

// 0216 ThreeScene contract.
export const THREE_SCENE_COMPONENT_TYPE = 'ThreeScene';
export const THREE_SCENE_APP_MODEL_ID = 1007;
export const THREE_SCENE_CHILD_MODEL_ID = 1008;
export const THREE_SCENE_CREATE_ENTITY_ACTION = 'three_scene_create_entity';
export const THREE_SCENE_SELECT_ENTITY_ACTION = 'three_scene_select_entity';
export const THREE_SCENE_UPDATE_ENTITY_ACTION = 'three_scene_update_entity';
export const THREE_SCENE_DELETE_ENTITY_ACTION = 'three_scene_delete_entity';
export const THREE_SCENE_REMOTE_ONLY_DETAIL = 'three_scene_remote_only';

// Model 100 - Dual-bus E2E test model.
export const MODEL_100_ID = 100;
export const FLOW_SHELL_ANCHOR_MODEL_ID = MODEL_100_ID;
export const FLOW_SHELL_TAB_LABEL = 'flow_tab_selected';
export const FLOW_SHELL_DEFAULT_TAB = 'process';
export const FLOW_SHELL_INPUT_MODEL_IDS = Object.freeze([
  EDITOR_STATE_MODEL_ID,
  ACTION_LIFECYCLE_MODEL_ID,
  SCENE_CONTEXT_MODEL_ID,
  MATRIX_DEBUG_MODEL_ID,
]);
export const FLOW_SHELL_FORBIDDEN_WRITE_MODEL_IDS = Object.freeze([
  0,
  SCENE_CONTEXT_MODEL_ID,
  MATRIX_DEBUG_MODEL_ID,
]);
