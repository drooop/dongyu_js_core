import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const THREE_MODULE_URL = 'https://unpkg.com/three@0.174.0/build/three.module.js';
let cachedThreeModulePromise = null;

function parseDimension(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function toVector3(value, fallback) {
  if (Array.isArray(value) && value.length >= 3) {
    return value.map((entry, index) => {
      const parsed = Number(entry);
      return Number.isFinite(parsed) ? parsed : fallback[index];
    });
  }
  if (value && typeof value === 'object') {
    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    return [
      Number.isFinite(x) ? x : fallback[0],
      Number.isFinite(y) ? y : fallback[1],
      Number.isFinite(z) ? z : fallback[2],
    ];
  }
  return fallback;
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  if (typeof material.dispose === 'function') {
    material.dispose();
  }
}

function disposeObjectTree(root) {
  if (!root || !Array.isArray(root.children)) return;
  for (const child of [...root.children]) {
    disposeObjectTree(child);
    root.remove(child);
    if (child.geometry && typeof child.geometry.dispose === 'function') {
      child.geometry.dispose();
    }
    disposeMaterial(child.material);
  }
}

async function loadThreeModule() {
  if (!cachedThreeModulePromise) {
    cachedThreeModulePromise = import(/* @vite-ignore */ THREE_MODULE_URL);
  }
  return cachedThreeModulePromise;
}

function buildEntityMesh(THREE, entity, selectedEntityId) {
  const kind = typeof entity?.type === 'string' ? entity.type : 'box';
  const color = typeof entity?.color === 'string' && entity.color.trim() ? entity.color : '#60a5fa';
  let geometry = null;
  if (kind === 'sphere') {
    geometry = new THREE.SphereGeometry(0.5, 24, 16);
  } else if (kind === 'plane') {
    geometry = new THREE.PlaneGeometry(1.25, 1.25);
  } else {
    geometry = new THREE.BoxGeometry(1, 1, 1);
  }
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: entity?.visible === false ? 0.35 : 1,
    emissive: entity?.id && entity.id === selectedEntityId ? '#1d4ed8' : '#000000',
    emissiveIntensity: entity?.id && entity.id === selectedEntityId ? 0.35 : 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = typeof entity?.id === 'string' ? entity.id : '';
  const [px, py, pz] = toVector3(entity?.position, [0, 0, 0]);
  const [rx, ry, rz] = toVector3(entity?.rotation, [0, 0, 0]);
  const [sx, sy, sz] = toVector3(entity?.scale, [1, 1, 1]);
  mesh.position.set(px, py, pz);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.visible = entity?.visible !== false;
  return mesh;
}

export default defineComponent({
  name: 'ThreeSceneHost',
  props: {
    width: { type: [String, Number], default: '100%' },
    height: { type: [String, Number], default: 320 },
    background: { type: String, default: '#0f172a' },
    sceneModelId: { type: Number, default: null },
    sceneGraph: { type: Object, default: () => ({ entities: [] }) },
    cameraState: { type: Object, default: () => ({}) },
    selectedEntityId: { type: String, default: '' },
    sceneStatus: { type: String, default: '' },
    auditLog: { type: String, default: '' },
    actions: { type: Object, default: () => ({}) },
    sceneGraphRef: { type: Object, default: null },
    cameraStateRef: { type: Object, default: null },
    selectedEntityIdRef: { type: Object, default: null },
    sceneStatusRef: { type: Object, default: null },
    auditLogRef: { type: Object, default: null },
  },
  setup(props) {
    const rootRef = ref(null);
    const canvasRef = ref(null);
    const renderState = ref('idle');
    let threeApi = null;
    let scene = null;
    let camera = null;
    let renderer = null;
    let entityGroup = null;

    function syncRendererSize() {
      if (!renderer || !canvasRef.value) return;
      const width = parseDimension(props.width, 480);
      const height = parseDimension(props.height, 320);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }

    async function ensureThreeRuntime() {
      if (scene && camera && renderer && entityGroup) return true;
      if (typeof window === 'undefined') {
        renderState.value = 'browser_only';
        return false;
      }
      if (!canvasRef.value || typeof canvasRef.value.getContext !== 'function') {
        renderState.value = 'canvas_unavailable';
        return false;
      }
      if (!threeApi) {
        renderState.value = 'loading_module';
        try {
          threeApi = await loadThreeModule();
        } catch (_) {
          renderState.value = 'three_module_unavailable';
          return false;
        }
      }
      try {
        const THREE = threeApi;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        entityGroup = new THREE.Group();
        scene.add(entityGroup);

        const ambient = new THREE.AmbientLight('#ffffff', 0.8);
        const directional = new THREE.DirectionalLight('#ffffff', 1.1);
        directional.position.set(4, 8, 6);
        scene.add(ambient);
        scene.add(directional);
        scene.add(new THREE.GridHelper(12, 12, '#334155', '#1e293b'));

        renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.value,
          antialias: true,
          alpha: false,
        });
        renderer.setPixelRatio(typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
        renderState.value = 'ready';
        syncRendererSize();
        return true;
      } catch (_) {
        renderState.value = 'webgl_init_failed';
        return false;
      }
    }

    async function renderScene() {
      if (!await ensureThreeRuntime()) return;
      const THREE = threeApi;
      disposeObjectTree(entityGroup);
      const entities = Array.isArray(props.sceneGraph?.entities) ? props.sceneGraph.entities : [];
      for (const entity of entities) {
        entityGroup.add(buildEntityMesh(THREE, entity, props.selectedEntityId));
      }
      const [cx, cy, cz] = toVector3(props.cameraState?.position, [5, 4, 8]);
      const [tx, ty, tz] = toVector3(props.cameraState?.target, [0, 0, 0]);
      const nextFov = Number(props.cameraState?.fov);
      camera.fov = Number.isFinite(nextFov) && nextFov > 0 ? nextFov : 50;
      camera.position.set(cx, cy, cz);
      camera.lookAt(tx, ty, tz);
      scene.background = new THREE.Color(props.background || '#0f172a');
      renderer.render(scene, camera);
    }

    function teardown() {
      if (entityGroup) {
        disposeObjectTree(entityGroup);
      }
      if (renderer) {
        renderer.dispose();
        if (typeof renderer.forceContextLoss === 'function') {
          renderer.forceContextLoss();
        }
      }
      renderer = null;
      camera = null;
      scene = null;
      entityGroup = null;
    }

    onMounted(() => {
      void renderScene();
    });

    watch(
      () => ({
        sceneGraph: props.sceneGraph,
        cameraState: props.cameraState,
        selectedEntityId: props.selectedEntityId,
        width: props.width,
        height: props.height,
        background: props.background,
      }),
      () => {
        void renderScene();
      },
      { deep: true },
    );

    onBeforeUnmount(() => {
      teardown();
    });

    return () => {
      const entityCount = Array.isArray(props.sceneGraph?.entities) ? props.sceneGraph.entities.length : 0;
      const hostStyle = {
        width: typeof props.width === 'number' ? `${props.width}px` : props.width,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      };
      const canvasWrapStyle = {
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #1e293b',
        background: props.background || '#0f172a',
      };
      const canvasStyle = {
        display: 'block',
        width: '100%',
        height: typeof props.height === 'number' ? `${props.height}px` : props.height,
      };
      const metaStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '12px',
        color: '#94a3b8',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      };
      return h('div', { ref: rootRef, class: 'three-scene-host', style: hostStyle }, [
        h('div', { style: canvasWrapStyle }, [
          h('canvas', { ref: canvasRef, style: canvasStyle }),
          h('div', {
            style: {
              position: 'absolute',
              top: '10px',
              left: '10px',
              padding: '4px 8px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.72)',
              color: '#e2e8f0',
              fontSize: '11px',
              letterSpacing: '0.04em',
            },
          }, renderState.value === 'ready' ? `scene ${props.sceneModelId ?? '--'}` : renderState.value),
        ]),
        h('div', { style: metaStyle }, [
          h('span', `status=${props.sceneStatus || 'unknown'}`),
          h('span', `entities=${entityCount}`),
          h('span', props.selectedEntityId ? `selected=${props.selectedEntityId}` : 'selected=none'),
        ]),
        props.auditLog
          ? h('div', {
            style: {
              fontSize: '11px',
              color: '#64748b',
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            },
          }, props.auditLog)
          : null,
      ].filter(Boolean));
    };
  },
});
