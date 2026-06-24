import { getSnapshotModel } from './snapshot_utils.js';

export function modelRefForForegroundApp(app) {
  if (!app || app.page !== 'workspace' || !Number.isInteger(app.model_id)) return null;
  return typeof app.table_id === 'string' && app.table_id.trim()
    ? { table_id: app.table_id.trim(), model_id: app.model_id }
    : app.model_id;
}

export function getForegroundModelLoadState(mainStore, app) {
  const modelRef = modelRefForForegroundApp(app);
  if (!modelRef) {
    return {
      modelRef: null,
      foregroundModel: null,
      waitingForVisibleModel: false,
    };
  }
  const foregroundModel = getSnapshotModel(mainStore?.snapshot, modelRef);
  const waitingForVisibleModel = typeof mainStore?.hasSnapshotModel === 'function'
    && !foregroundModel
    && !mainStore.hasSnapshotModel(modelRef);
  return {
    modelRef,
    foregroundModel,
    waitingForVisibleModel,
  };
}
