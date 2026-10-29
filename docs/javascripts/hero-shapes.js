/**
 * Interactive 3D tap-to-create shapes effect for MkDocs Material hero.
 * Materials science inspired forms with calm, tactile motion.
 */

(function () {
  "use strict";

  // Palette colours
  const CLR_CLAY = 0xd97757;
  const CLR_DEEP_CLAY = 0xc15f3c;
  const CLR_BLUE = 0x5b8fb9;
  const CLR_SAGE = 0x8fae7e;
  const CLR_GOLD = 0xc9a227;
  const CLR_STEEL = 0x7c8a9a;

  const PALETTE = [
    CLR_CLAY,
    CLR_BLUE,
    CLR_SAGE,
    CLR_GOLD,
    CLR_DEEP_CLAY,
    CLR_STEEL
  ];

  const MAX_SHAPES = 18;
  const SHAPE_SCALE = 1.7; // overall on-screen size of spawned shapes
  const CAMERA_FOV = 50;

  // Cached Three.js module
  let THREE = null;

  // Active instance state
  let renderer = null;
  let scene = null;
  let camera = null;
  let hemiLight = null;
  let dirLight = null;

  let containerEl = null;
  let heroEl = null;

  let animFrameId = null;
  let autoSpawnTimer = null;
  let lastTimestamp = 0;
  let isRendering = false;
  let isIntersecting = false;
  let isDocVisible = !document.hidden;
  let isDarkMode = false;
  let userHasTapped = false;

  let resizeObserver = null;
  let intersectionObserver = null;
  let themeObserver = null;
  let motionMediaQuery = null;
  let motionListener = null;

  let pointerDownHandler = null;
  let visibilityHandler = null;

  let liveShapes = [];
  let shapeCycleIndex = 0;
  let colorCycleIndex = 0;

  /**
   * Check WebGL support silently.
   */
  function isWebGLAvailable() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Load Three.js dynamically.
   */
  async function loadThreeModule() {
    if (!THREE) {
      THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
    }
    return THREE;
  }

  /**
   * Helper to create standard material with friendly matte appearance.
   */
  function createShapeMaterial(colorHex, flatShading = false) {
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.45,
      metalness: 0.1,
      flatShading: flatShading,
      transparent: true,
      opacity: 1.0
    });
    if (isDarkMode) {
      mat.emissive.setHex(colorHex).multiplyScalar(0.14);
    } else {
      mat.emissive.setHex(0x000000);
    }
    return mat;
  }

  /**
   * Helper to build a cylinder bond between two 3D points.
   */
  function createBondCylinder(p1, p2, radius, material) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const length = dir.length();
    if (length === 0) return null;
    const geom = new THREE.CylinderGeometry(radius, radius, length, 8);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(p1).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  /**
   * Shape 1: BCC unit cell (8 corner atoms + 1 centre atom linked by bonds).
   */
  function createBccCell(colorHex) {
    const group = new THREE.Group();
    const materials = [];
    const baseOpacities = [];

    const mat = createShapeMaterial(colorHex, false);
    materials.push(mat);
    baseOpacities.push(1.0);

    const s = 19;
    const corners = [
      new THREE.Vector3(-s, -s, -s),
      new THREE.Vector3(s, -s, -s),
      new THREE.Vector3(s, s, -s),
      new THREE.Vector3(-s, s, -s),
      new THREE.Vector3(-s, -s, s),
      new THREE.Vector3(s, -s, s),
      new THREE.Vector3(s, s, s),
      new THREE.Vector3(-s, s, s)
    ];
    const center = new THREE.Vector3(0, 0, 0);

    const cornerGeom = new THREE.SphereGeometry(3.6, 12, 10);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(cornerGeom, mat);
      sp.position.copy(corners[i]);
      group.add(sp);
    }

    const centerGeom = new THREE.SphereGeometry(5.2, 16, 12);
    const centerMesh = new THREE.Mesh(centerGeom, mat);
    group.add(centerMesh);

    // 8 body-diagonal bonds
    for (let i = 0; i < 8; i++) {
      const bond = createBondCylinder(corners[i], center, 1.2, mat);
      if (bond) group.add(bond);
    }

    // 12 outer cube frame edges
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    for (let i = 0; i < edges.length; i++) {
      const bond = createBondCylinder(corners[edges[i][0]], corners[edges[i][1]], 0.9, mat);
      if (bond) group.add(bond);
    }

    return { group, materials, baseOpacities };
  }

  /**
   * Shape 2: Hexagonal honeycomb ring (MgB2 boron sheet fragment).
   */
  function createHoneycombRing(colorHex) {
    const group = new THREE.Group();
    const materials = [];
    const baseOpacities = [];

    const mat = createShapeMaterial(colorHex, false);
    materials.push(mat);
    baseOpacities.push(1.0);

    const ringRadius = 26;
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      vertices.push(new THREE.Vector3(ringRadius * Math.cos(angle), ringRadius * Math.sin(angle), 0));
    }

    const sphereGeom = new THREE.SphereGeometry(3.8, 12, 10);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(sphereGeom, mat);
      sp.position.copy(vertices[i]);
      group.add(sp);
    }

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const bond = createBondCylinder(vertices[i], vertices[next], 1.6, mat);
      if (bond) group.add(bond);
    }

    // Semi-translucent inner hexagonal sheet
    const hexPlateGeom = new THREE.CylinderGeometry(ringRadius * 0.86, ringRadius * 0.86, 2.5, 6);
    hexPlateGeom.rotateX(Math.PI / 2);
    const innerMat = mat.clone();
    innerMat.opacity = 0.35;
    materials.push(innerMat);
    baseOpacities.push(0.35);

    const plateMesh = new THREE.Mesh(hexPlateGeom, innerMat);
    group.add(plateMesh);

    return { group, materials, baseOpacities };
  }

  /**
   * Shape 3: Flat-shaded Icosahedron.
   */
  function createIcosahedron(colorHex) {
    const group = new THREE.Group();
    const geom = new THREE.IcosahedronGeometry(27, 0);
    const mat = createShapeMaterial(colorHex, true);
    group.add(new THREE.Mesh(geom, mat));
    return { group, materials: [mat], baseOpacities: [1.0] };
  }

  /**
   * Shape 4: Torus knot.
   */
  function createTorusKnot(colorHex) {
    const group = new THREE.Group();
    const geom = new THREE.TorusKnotGeometry(19, 5.8, 64, 16, 2, 3);
    const mat = createShapeMaterial(colorHex, false);
    group.add(new THREE.Mesh(geom, mat));
    return { group, materials: [mat], baseOpacities: [1.0] };
  }

  /**
   * Shape 5: Flat-shaded Octahedron.
   */
  function createOctahedron(colorHex) {
    const group = new THREE.Group();
    const geom = new THREE.OctahedronGeometry(27, 0);
    const mat = createShapeMaterial(colorHex, true);
    group.add(new THREE.Mesh(geom, mat));
    return { group, materials: [mat], baseOpacities: [1.0] };
  }

  /**
   * Shape 6: Soft starburst with rounded rays.
   */
  function createStarburst(colorHex) {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    const rayCount = 10;
    const rOuter = 28;
    const rInner = 14;
    const totalSamples = 60;

    for (let i = 0; i < totalSamples; i++) {
      const theta = (i / totalSamples) * Math.PI * 2;
      const r = (rOuter + rInner) / 2 + ((rOuter - rInner) / 2) * Math.cos(rayCount * theta);
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
      depth: 5,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 2,
      bevelThickness: 2
    });
    extrudeGeom.center();

    const mat = createShapeMaterial(colorHex, false);
    group.add(new THREE.Mesh(extrudeGeom, mat));
    return { group, materials: [mat], baseOpacities: [1.0] };
  }

  /**
   * Shape 7: Bar magnet (joined clay and blue boxes).
   */
  function createBarMagnet() {
    const group = new THREE.Group();
    const w = 18;
    const halfH = 22;
    const d = 13;

    const clayMat = createShapeMaterial(CLR_CLAY, false);
    const blueMat = createShapeMaterial(CLR_BLUE, false);

    const geomTop = new THREE.BoxGeometry(w, halfH, d);
    const meshTop = new THREE.Mesh(geomTop, clayMat);
    meshTop.position.set(0, halfH / 2, 0);

    const geomBottom = new THREE.BoxGeometry(w, halfH, d);
    const meshBottom = new THREE.Mesh(geomBottom, blueMat);
    meshBottom.position.set(0, -halfH / 2, 0);

    group.add(meshTop);
    group.add(meshBottom);

    return {
      group,
      materials: [clayMat, blueMat],
      baseOpacities: [1.0, 1.0]
    };
  }

  /**
   * Shape 8: Rounded capsule/pill.
   */
  function createCapsule(colorHex) {
    const group = new THREE.Group();
    const geom = new THREE.CapsuleGeometry(12, 24, 12, 20);
    const mat = createShapeMaterial(colorHex, false);
    group.add(new THREE.Mesh(geom, mat));
    return { group, materials: [mat], baseOpacities: [1.0] };
  }

  /**
   * Shape factory router.
   */
  function instantiateShape(typeIndex, colorHex) {
    switch (typeIndex % 8) {
      case 0:
        return createBccCell(colorHex);
      case 1:
        return createHoneycombRing(colorHex);
      case 2:
        return createIcosahedron(colorHex);
      case 3:
        return createTorusKnot(colorHex);
      case 4:
        return createOctahedron(colorHex);
      case 5:
        return createStarburst(colorHex);
      case 6:
        return createBarMagnet();
      case 7:
      default:
        return createCapsule(colorHex);
    }
  }

  /**
   * Free GPU resources when a shape finishes its lifecycle.
   */
  function disposeShape(shape) {
    const uniqueGeometries = new Set();
    shape.group.traverse((child) => {
      if (child.isMesh && child.geometry) {
        uniqueGeometries.add(child.geometry);
      }
    });
    uniqueGeometries.forEach((g) => g.dispose());

    for (let i = 0; i < shape.materials.length; i++) {
      shape.materials[i].dispose();
    }
    if (scene) {
      scene.remove(shape.group);
    }
  }

  /**
   * Unproject pointer coordinates onto the z=0 world plane.
   */
  function unprojectToWorld(clientX, clientY) {
    if (!containerEl || !camera) return new THREE.Vector3(0, 0, 0);
    const rect = containerEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return new THREE.Vector3(0, 0, 0);

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const pointer = new THREE.Vector2(ndcX, ndcY);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);

    const target = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    raycaster.ray.intersectPlane(plane, target);
    return target;
  }

  /**
   * Spawn a new shape at screen position (clientX, clientY).
   */
  function spawnShapeAt(clientX, clientY) {
    if (!scene || !camera || !containerEl) return;

    const prefersReducedMotion = Boolean(
      motionMediaQuery && motionMediaQuery.matches
    );

    // Enforce live shape cap by fading oldest shapes early
    while (liveShapes.length >= MAX_SHAPES) {
      let candidate = null;
      for (let i = 0; i < liveShapes.length; i++) {
        const item = liveShapes[i];
        if (item.maxAge - item.age > 0.45) {
          candidate = item;
          break;
        }
      }
      if (candidate) {
        candidate.maxAge = candidate.age + 0.4;
        break;
      } else {
        const oldest = liveShapes.shift();
        disposeShape(oldest);
      }
    }

    const typeIdx = shapeCycleIndex % 8;
    shapeCycleIndex++;

    const colorHex = PALETTE[colorCycleIndex % PALETTE.length];
    colorCycleIndex++;

    const shapeData = instantiateShape(typeIdx, colorHex);
    const group = shapeData.group;

    const worldPos = unprojectToWorld(clientX, clientY);
    group.position.copy(worldPos);

    if (prefersReducedMotion) {
      group.rotation.set(0.2, 0.3, 0);
      group.scale.setScalar(SHAPE_SCALE);
    } else {
      group.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      group.scale.set(0, 0, 0);
    }

    const outwardSign = worldPos.x >= 0 ? 1 : -1;
    const velocity = prefersReducedMotion
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(
          (Math.random() - 0.5) * 10 + outwardSign * (5 + Math.random() * 8),
          14 + Math.random() * 16,
          (Math.random() - 0.5) * 6
        );

    const rotVelocity = prefersReducedMotion
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.5
        );

    const maxAge = 5.0 + Math.random() * 2.0;

    liveShapes.push({
      group,
      materials: shapeData.materials,
      baseOpacities: shapeData.baseOpacities,
      age: 0,
      maxAge,
      velocity,
      rotVelocity,
      baseScale: SHAPE_SCALE
    });

    scene.add(group);

    // Ensure rendering loop runs immediately
    syncRenderLoop();
  }

  /**
   * Update active shapes per frame.
   */
  function updateShapes(dt) {
    const prefersReducedMotion = Boolean(
      motionMediaQuery && motionMediaQuery.matches
    );

    const springDuration = 0.6;
    const fadeOutDuration = 1.3;

    for (let i = liveShapes.length - 1; i >= 0; i--) {
      const item = liveShapes[i];
      item.age += dt;

      if (item.age >= item.maxAge) {
        disposeShape(item);
        liveShapes.splice(i, 1);
        continue;
      }

      // Spring scaling
      if (prefersReducedMotion) {
        item.group.scale.setScalar(item.baseScale);
      } else if (item.age < springDuration) {
        const t = item.age / springDuration;
        const s = 1.70158;
        const p = t - 1;
        const scaleVal = Math.max(0, p * p * ((s + 1) * p + s) + 1);
        item.group.scale.setScalar(scaleVal * item.baseScale);
      } else {
        item.group.scale.setScalar(item.baseScale);
      }

      // Drift and spin
      if (!prefersReducedMotion) {
        item.group.position.x += item.velocity.x * dt;
        item.group.position.y += item.velocity.y * dt;
        item.group.position.z += item.velocity.z * dt;

        item.group.rotation.x += item.rotVelocity.x * dt;
        item.group.rotation.y += item.rotVelocity.y * dt;
        item.group.rotation.z += item.rotVelocity.z * dt;
      }

      // Transparency fade
      let alpha = 1.0;
      if (item.age > item.maxAge - fadeOutDuration) {
        alpha = Math.max(0, (item.maxAge - item.age) / fadeOutDuration);
      }

      if (prefersReducedMotion) {
        const fadeIn = Math.min(1, item.age / 0.35);
        alpha = Math.min(alpha, fadeIn);
      }

      for (let m = 0; m < item.materials.length; m++) {
        const base = item.baseOpacities ? item.baseOpacities[m] : 1.0;
        item.materials[m].opacity = alpha * base;
      }
    }
  }

  /**
   * Render loop tick.
   */
  function renderTick(timestamp) {
    if (!isRendering) return;
    animFrameId = requestAnimationFrame(renderTick);

    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    updateShapes(dt);

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  /**
   * Start or pause animation frame based on visibility and presence of shapes.
   */
  function syncRenderLoop() {
    const shouldRender = isIntersecting && isDocVisible;

    if (shouldRender && !isRendering) {
      isRendering = true;
      lastTimestamp = performance.now();
      animFrameId = requestAnimationFrame(renderTick);
    } else if (!shouldRender && isRendering) {
      isRendering = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    }
  }

  /**
   * Responsive resize handling: 1 world unit = 1 pixel at z=0.
   */
  function handleResize(width, height) {
    if (!camera || !renderer) return;
    const halfFovRad = ((CAMERA_FOV / 2) * Math.PI) / 180;
    const dist = (height / 2) / Math.tan(halfFovRad);
    camera.position.set(0, 0, dist);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  /**
   * Light/Dark mode synchronisation.
   */
  function updateThemeSettings() {
    isDarkMode = document.body.getAttribute("data-md-color-scheme") === "slate";

    if (hemiLight && dirLight) {
      if (isDarkMode) {
        hemiLight.color.setHex(0xe2e6ed);
        hemiLight.groundColor.setHex(0x32302d);
        hemiLight.intensity = 1.25;

        dirLight.color.setHex(0xffffff);
        dirLight.intensity = 1.6;
      } else {
        hemiLight.color.setHex(0xfffbf5);
        hemiLight.groundColor.setHex(0xd0c8be);
        hemiLight.intensity = 0.95;

        dirLight.color.setHex(0xfff7ea);
        dirLight.intensity = 1.35;
      }
    }

    for (let i = 0; i < liveShapes.length; i++) {
      const shape = liveShapes[i];
      for (let m = 0; m < shape.materials.length; m++) {
        const mat = shape.materials[m];
        if (isDarkMode) {
          mat.emissive.copy(mat.color).multiplyScalar(0.14);
        } else {
          mat.emissive.setHex(0x000000);
        }
        mat.needsUpdate = true;
      }
    }
  }

  /**
   * Auto-spawn idle shape every ~4 seconds.
   */
  function startAutoSpawn() {
    if (autoSpawnTimer || userHasTapped) return;
    const prefersReducedMotion = Boolean(
      motionMediaQuery && motionMediaQuery.matches
    );
    if (prefersReducedMotion) return;

    autoSpawnTimer = setInterval(() => {
      if (!isRendering || !containerEl || document.hidden) return;
      const rect = containerEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const px = rect.left + rect.width * (0.28 + Math.random() * 0.44);
      const py = rect.top + rect.height * (0.22 + Math.random() * 0.48);
      spawnShapeAt(px, py);
    }, 4000);
  }

  /**
   * Complete teardown of any previous instance.
   */
  function teardown() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    isRendering = false;

    if (autoSpawnTimer) {
      clearInterval(autoSpawnTimer);
      autoSpawnTimer = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }

    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }

    if (motionMediaQuery && motionListener) {
      motionMediaQuery.removeEventListener("change", motionListener);
      motionListener = null;
      motionMediaQuery = null;
    }

    if (heroEl && pointerDownHandler) {
      heroEl.removeEventListener("pointerdown", pointerDownHandler);
      pointerDownHandler = null;
    }

    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }

    for (let i = 0; i < liveShapes.length; i++) {
      disposeShape(liveShapes[i]);
    }
    liveShapes = [];

    if (renderer) {
      try {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch (err) {
        // Silently handle disposal errors
      }
      renderer = null;
    }

    scene = null;
    camera = null;
    hemiLight = null;
    dirLight = null;
    containerEl = null;
    heroEl = null;
  }

  /**
   * Main initializer.
   */
  async function init() {
    teardown();

    const targetContainer = document.getElementById("hero-3d");
    const targetHero = document.querySelector(".hero");

    if (!targetContainer || !targetHero) {
      return;
    }

    if (!isWebGLAvailable()) {
      return;
    }

    let T;
    try {
      T = await loadThreeModule();
    } catch (err) {
      return;
    }

    // Verify DOM element still present after asynchronous import
    if (!document.getElementById("hero-3d")) {
      return;
    }

    containerEl = targetContainer;
    heroEl = targetHero;

    isDarkMode = document.body.getAttribute("data-md-color-scheme") === "slate";
    motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    try {
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch (err) {
      return;
    }

    scene = new T.Scene();

    const rect = containerEl.getBoundingClientRect();
    const initialWidth = Math.max(rect.width, 100);
    const initialHeight = Math.max(rect.height, 100);

    const halfFovRad = ((CAMERA_FOV / 2) * Math.PI) / 180;
    const initialDist = (initialHeight / 2) / Math.tan(halfFovRad);

    camera = new T.PerspectiveCamera(
      CAMERA_FOV,
      initialWidth / initialHeight,
      1,
      8000
    );
    camera.position.set(0, 0, initialDist);
    camera.lookAt(0, 0, 0);

    renderer.setSize(initialWidth, initialHeight, false);
    containerEl.appendChild(renderer.domElement);

    // Lights
    hemiLight = new T.HemisphereLight(0xfffbf5, 0xd0c8be, 0.95);
    scene.add(hemiLight);

    dirLight = new T.DirectionalLight(0xfff7ea, 1.35);
    dirLight.position.set(220, 320, 380);
    scene.add(dirLight);

    updateThemeSettings();

    // Resize observer
    resizeObserver = new ResizeObserver((entries) => {
      for (let i = 0; i < entries.length; i++) {
        const { width, height } = entries[i].contentRect;
        if (width > 0 && height > 0) {
          handleResize(width, height);
        }
      }
    });
    resizeObserver.observe(containerEl);

    // Intersection observer
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isIntersecting = Boolean(entry && entry.isIntersecting);
        syncRenderLoop();
      },
      { threshold: 0 }
    );
    intersectionObserver.observe(heroEl);

    // Visibility change
    visibilityHandler = function () {
      isDocVisible = !document.hidden;
      syncRenderLoop();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    // Theme mutation observer
    themeObserver = new MutationObserver(() => {
      updateThemeSettings();
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-md-color-scheme"]
    });

    // Reduced motion listener
    motionListener = function () {
      if (motionMediaQuery.matches && autoSpawnTimer) {
        clearInterval(autoSpawnTimer);
        autoSpawnTimer = null;
      }
    };
    motionMediaQuery.addEventListener("change", motionListener);

    // Pointer event interaction on .hero
    pointerDownHandler = function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      const target = e.target;
      if (
        target &&
        target.closest &&
        target.closest("a, button, input, select, textarea, img, .hero__portrait, .md-button")
      ) {
        return;
      }

      userHasTapped = true;

      if (autoSpawnTimer) {
        clearInterval(autoSpawnTimer);
        autoSpawnTimer = null;
      }

      const hintEl = document.querySelector(".hero-3d-hint");
      if (hintEl && !hintEl.classList.contains("is-hidden")) {
        hintEl.classList.add("is-hidden");
      }

      spawnShapeAt(e.clientX, e.clientY);
    };
    heroEl.addEventListener("pointerdown", pointerDownHandler);

    // Start idle auto-spawn if motion is not reduced
    startAutoSpawn();
  }

  /**
   * Material for MkDocs instant navigation integration.
   */
  if (typeof document$ !== "undefined") {
    document$.subscribe(() => {
      init();
    });
  } else {
    const onReady = () => {
      if (typeof document$ !== "undefined") {
        document$.subscribe(() => {
          init();
        });
      } else {
        init();
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady, { once: true });
    } else {
      onReady();
    }
  }
})();
