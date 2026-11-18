// Tanjung Panas — the city itself: ground texture, districts, buildings,
// palms, market stalls, port containers and cranes, sky and sun.
// Also owns the collision boxes and the road graph the AI drives on.

// three.min.js (UMD) is loaded by index.html before this module runs.
const THREE = window.THREE;
import { CFG, DISTRICTS, BUILDING_COLORS } from './config.js';
import { pick, range, intRange } from './rng.js';

const WORLD = CFG.worldSize;
const HALF = WORLD / 2;
const STEP = CFG.roadStep;
const ROAD_HALF = CFG.roadHalf;

// Road lines sit at multiples of 60 from -360 to 360.
export function roadLines() {
  const lines = [];
  for (let v = -HALF; v <= HALF; v += STEP) lines.push(v);
  return lines;
}

export function nearestRoadPoint(x, z) {
  const rx = Math.round(x / STEP) * STEP;
  const rz = Math.round(z / STEP) * STEP;
  // Closer road axis wins.
  if (Math.abs(x - rx) < Math.abs(z - rz)) return { x: rx, z, along: 'z' };
  return { x, z: rz, along: 'x' };
}

function districtAt(x, z) {
  for (const d of Object.values(DISTRICTS)) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.kind;
  }
  return 'default';
}

function groundTexture() {
  const S = 2048;
  const px = S / WORLD; // pixels per world unit
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const X = (wx) => (wx + HALF) * px;
  const Z = (wz) => (wz + HALF) * px;

  // Base: warm concrete.
  g.fillStyle = '#b3a58c';
  g.fillRect(0, 0, S, S);
  // Subtle block tint variation.
  const lines = roadLines();
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      if ((i + j) % 3 === 0) {
        g.fillStyle = 'rgba(0,0,0,0.05)';
        g.fillRect(X(lines[i] + ROAD_HALF), Z(lines[j] + ROAD_HALF),
          (lines[i + 1] - lines[i] - 2 * ROAD_HALF) * px,
          (lines[j + 1] - lines[j] - 2 * ROAD_HALF) * px);
      }
    }
  }
  // Beach sand (west strip) and port concrete (east yard).
  g.fillStyle = '#e6cf9a';
  g.fillRect(X(-HALF), Z(-HALF), (54) * px, WORLD * px);
  g.fillStyle = '#9d9d96';
  g.fillRect(X(240), Z(-300), 120 * px, 240 * px);
  // Market plaza tiles.
  g.fillStyle = '#c9a06a';
  g.fillRect(X(-120), Z(120), 240 * px, 180 * px);
  g.strokeStyle = 'rgba(120,80,40,0.35)';
  g.lineWidth = 2;
  for (let x = -120; x <= 120; x += 12) { g.beginPath(); g.moveTo(X(x), Z(120)); g.lineTo(X(x), Z(300)); g.stroke(); }
  for (let z = 120; z <= 300; z += 12) { g.beginPath(); g.moveTo(X(-120), Z(z)); g.lineTo(X(120), Z(z)); g.stroke(); }
  // A small park.
  g.fillStyle = '#7fae6a';
  g.fillRect(X(-60), Z(-60), 60 * px, 60 * px);
  g.fillStyle = '#6d9c5c';
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.arc(X(-55 + (i % 4) * 15), Z(-55 + Math.floor(i / 4) * 40), 7 * px, 0, Math.PI * 2);
    g.fill();
  }
  // Sidewalks along every road.
  g.fillStyle = '#cfc7b4';
  for (const v of lines) {
    g.fillRect(X(-HALF), Z(v - ROAD_HALF - 3), WORLD * px, 3 * px);
    g.fillRect(X(-HALF), Z(v + ROAD_HALF), WORLD * px, 3 * px);
    g.fillRect(X(v - ROAD_HALF - 3), Z(-HALF), 3 * px, WORLD * px);
    g.fillRect(X(v + ROAD_HALF), Z(-HALF), 3 * px, WORLD * px);
  }
  // Asphalt roads with dashed centre lines.
  g.fillStyle = '#3c3c44';
  for (const v of lines) {
    g.fillRect(X(-HALF), Z(v - ROAD_HALF), WORLD * px, 2 * ROAD_HALF * px);
    g.fillRect(X(v - ROAD_HALF), Z(-HALF), 2 * ROAD_HALF * px, WORLD * px);
  }
  g.fillStyle = '#d8c25a';
  for (const v of lines) {
    for (let d = -HALF + 6; d < HALF - 6; d += 18) {
      g.fillRect(X(d), Z(v - 0.5), 9 * px, 1 * px);
      g.fillRect(X(v - 0.5), Z(d), 1 * px, 9 * px);
    }
  }
  // Beach waterline.
  g.fillStyle = '#e9dcae';
  g.fillRect(X(-HALF), Z(-HALF), 6 * px, WORLD * px);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#e6e2d8';
  g.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffd27a' : '#2c2c38';
      g.fillRect(12 + c * 28, 14 + r * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function awningTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#e8e8e8' : '#d23b2e';
    g.fillRect(i * 16, 0, 16, 64);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = null;
    this.colliders = []; // {x0,z0,x1,z1}
    this.palmSpots = [];
    this.parkSpots = [];
    this.spawnRoads = [];
    this._build(seed);
  }

  _build(seed) {
    // Local seeded rng — import cycle free.
    let a = seed >>> 0;
    const rng = () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.rng = rng;
    const scene = this.scene;

    // Sky dome: sunset gradient.
    const skyCv = document.createElement('canvas');
    skyCv.width = 4; skyCv.height = 256;
    const sg = skyCv.getContext('2d');
    const grad = sg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#2e5f8a');
    grad.addColorStop(0.45, '#7fa8c4');
    grad.addColorStop(0.72, '#f2a35e');
    grad.addColorStop(1, '#ff7a3c');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(skyCv);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(880, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);

    // Sun disc low in the west.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
    );
    sun.position.set(-820, 95, -60);
    sun.lookAt(0, 60, 0);
    scene.add(sun);

    // Lights.
    const hemi = new THREE.HemisphereLight(CFG.hemiSky, CFG.hemiGround, CFG.hemiIntensity);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(CFG.sunColor, CFG.sunIntensity);
    dir.position.set(-260, 150, 60);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -260; dir.shadow.camera.right = 260;
    dir.shadow.camera.top = 260; dir.shadow.camera.bottom = -260;
    dir.shadow.camera.far = 800;
    dir.shadow.bias = -0.0004;
    dir.shadow.normalBias = 1.5;
    scene.add(dir);
    scene.add(dir.target);
    scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);

    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD, WORLD),
      new THREE.MeshLambertMaterial({ map: groundTexture() }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ocean west + east of the port.
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x2e7f9e, transparent: true, opacity: 0.92 });
    const seaW = new THREE.Mesh(new THREE.PlaneGeometry(240, WORLD + 240), waterMat);
    seaW.rotation.x = -Math.PI / 2;
    seaW.position.set(-HALF - 120, 0.05, 0);
    scene.add(seaW);
    const seaE = new THREE.Mesh(new THREE.PlaneGeometry(240, 260), waterMat.clone());
    seaE.rotation.x = -Math.PI / 2;
    seaE.position.set(HALF + 120, 0.05, -180);
    scene.add(seaE);

    const winTex = windowTexture();
    const awnTex = awningTexture();

    // Buildings block by block.
    const lines = roadLines();
    for (let i = 0; i < lines.length - 1; i++) {
      for (let j = 0; j < lines.length - 1; j++) {
        const bx0 = lines[i] + ROAD_HALF + 3;
        const bz0 = lines[j] + ROAD_HALF + 3;
        const bx1 = lines[i + 1] - ROAD_HALF - 3;
        const bz1 = lines[j + 1] - ROAD_HALF - 3;
        const cx = (bx0 + bx1) / 2;
        const cz = (bz0 + bz1) / 2;
        const kind = districtAt(cx, cz);
        if (kind === 'beach') { this._palms(rng, cx, cz, 5); continue; }
        if (kind === 'port') { this._containers(rng, cx, cz); continue; }
        if (kind === 'market' && i % 2 === 0 && j % 2 === 0) { this._marketStalls(rng, cx, cz, awnTex); continue; }
        this._blockBuildings(rng, bx0, bz0, bx1, bz1, kind, winTex);
      }
    }

    // Port cranes along the east quay.
    for (const cz of [-270, -180, -90]) this._crane(348, cz);
    // Palm rows along the beach boardwalk and a few in the park.
    for (let z = -330; z <= 330; z += 42) this._palm(-312 + (rng() - 0.5) * 6, z + (rng() - 0.5) * 8, rng);
    for (let k = 0; k < 6; k++) this._palm(-52 + rng() * 44, -52 + rng() * 44, rng);
  }

  _blockBuildings(rng, bx0, bz0, bx1, bz1, kind, winTex) {
    const palette = BUILDING_COLORS[kind] || BUILDING_COLORS.default;
    const n = kind === 'modern' ? 1 : (rng() < 0.5 ? 2 : 3);
    const cols = Math.ceil(Math.sqrt(n));
    const w = (bx1 - bx0) / cols;
    const d = (bz1 - bz0) / Math.ceil(n / cols);
    let placed = 0;
    for (let r = 0; r < Math.ceil(n / cols) && placed < n; r++) {
      for (let c = 0; c < cols && placed < n; c++) {
        const bw = w * range(rng, 0.62, 0.86);
        const bd = d * range(rng, 0.62, 0.86);
        const h = kind === 'modern' ? range(rng, 30, 78)
          : kind === 'hills' ? range(rng, 6, 11)
          : kind === 'market' ? range(rng, 8, 15)
          : range(rng, 10, 24);
        const x = bx0 + c * w + w / 2 + range(rng, -2, 2);
        const z = bz0 + r * d + d / 2 + range(rng, -2, 2);
        const color = pick(rng, palette);
        const side = new THREE.MeshLambertMaterial({ map: winTex, color });
        const top = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.72) });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(bw, h, bd),
          [side, side, top, top, side, side],
        );
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.colliders.push({ x0: x - bw / 2, z0: z - bd / 2, x1: x + bw / 2, z1: z + bd / 2 });
        placed++;
      }
    }
  }

  _containers(rng, cx, cz) {
    const colors = [0xc23b2e, 0x2e6fc2, 0xd98a2e, 0x3a8a4a, 0x7a4fc2];
    const rows = intRange(rng, 2, 3);
    for (let r = 0; r < rows; r++) {
      const n = intRange(rng, 2, 4);
      for (let k = 0; k < n; k++) {
        const x = cx - 14 + k * 13.5 + range(rng, -1, 1);
        const z = cz - 12 + r * 14 + range(rng, -1, 1);
        const stack = rng() < 0.35 ? 2 : 1;
        for (let s = 0; s < stack; s++) {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(12, 2.6, 2.6),
            new THREE.MeshLambertMaterial({ color: pick(rng, colors) }),
          );
          m.position.set(x, 1.3 + s * 2.6, z);
          m.castShadow = true;
          m.receiveShadow = true;
          this.scene.add(m);
        }
        this.colliders.push({ x0: x - 6, z0: z - 1.3, x1: x + 6, z1: z + 1.3 });
      }
    }
  }

  _marketStalls(rng, cx, cz, awnTex) {
    const n = intRange(rng, 3, 5);
    for (let k = 0; k < n; k++) {
      const x = cx + range(rng, -16, 16);
      const z = cz + range(rng, -14, 14);
      const g = new THREE.Group();
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 1, 2.2),
        new THREE.MeshLambertMaterial({ color: 0x8a5a34 }),
      );
      table.position.y = 0.5;
      table.castShadow = true;
      g.add(table);
      for (const [gx, gz] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
          new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
        );
        post.position.set(gx, 1.3, gz);
        g.add(post);
      }
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.12, 3.2),
        new THREE.MeshLambertMaterial({ map: awnTex }),
      );
      awn.position.y = 2.7;
      awn.rotation.z = 0.08;
      awn.castShadow = true;
      g.add(awn);
      // Goods: colourful fruit boxes.
      const goodsColors = [0xe8a33d, 0xd23b2e, 0x3aa655, 0xe87a2e];
      for (let b = 0; b < 4; b++) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.5, 0.9),
          new THREE.MeshLambertMaterial({ color: pick(rng, goodsColors) }),
        );
        box.position.set(-1.5 + b * 1.0, 1.25, (rng() - 0.5) * 0.8);
        g.add(box);
      }
      g.position.set(x, 0, z);
      g.rotation.y = range(rng, -0.4, 0.4);
      this.scene.add(g);
      this.colliders.push({ x0: x - 2.2, z0: z - 1.1, x1: x + 2.2, z1: z + 1.1 });
    }
  }

  _crane(x, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xd98a2e });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0x8a8a92 });
    for (const dx of [-4, 4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 34, 1.6), mat);
      leg.position.set(dx, 17, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 1.6), mat);
    beam.position.set(-6, 33, 0);
    beam.castShadow = true;
    g.add(beam);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), mat2);
    cab.position.set(0, 31, 0);
    g.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12, 4),
      new THREE.MeshLambertMaterial({ color: 0x222226 }));
    cable.position.set(-16, 26, 0);
    g.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2),
      new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
    hook.position.set(-16, 19.5, 0);
    g.add(hook);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.colliders.push({ x0: x - 5, z0: z - 1.5, x1: x + 5, z1: z + 1.5 });
  }

  _palms(rng, cx, cz, n) {
    for (let k = 0; k < n; k++) this._palm(cx + range(rng, -18, 18), cz + range(rng, -18, 18), rng);
  }

  _palm(x, z, rng) {
    const g = new THREE.Group();
    const h = range(rng, 7, 11);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.45, h, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
    );
    trunk.position.y = h / 2;
    trunk.rotation.z = range(rng, -0.08, 0.08);
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 4.6), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, h + 0.3, Math.sin(a) * 1.6);
      leaf.rotation.y = -a;
      leaf.rotation.x = 0.5;
      leaf.castShadow = true;
      g.add(leaf);
    }
    const nuts = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x7a5a34 }),
    );
    nuts.position.y = h - 0.2;
    g.add(nuts);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.colliders.push({ x0: x - 0.5, z0: z - 0.5, x1: x + 0.5, z1: z + 0.5 });
  }

  // ---- collision helpers ----
  // True if a circle at (x,z) radius r overlaps any collider or the sea.
  hits(x, z, r) {
    if (x < -HALF + 2 || x > HALF - 2 || z < -HALF + 2 || z > HALF - 2) return true;
    if (x < -306) return true; // beach waterline: no swimming
    for (const c of this.colliders) {
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
    }
    return false;
  }

  // Move a circle with axis separation so it slides along walls.
  moveCircle(p, dx, dz, r) {
    if (!this.hits(p.x + dx, p.z, r)) p.x += dx;
    if (!this.hits(p.x, p.z + dz, r)) p.z += dz;
  }

  // A random point on a road, optionally near a target.
  randomRoadPoint(rng, near, radius = 200) {
    for (let tries = 0; tries < 20; tries++) {
      const v = pick(rng, roadLines());
      const along = range(rng, -330, 330);
      const p = rng() < 0.5 ? { x: v, z: along } : { x: along, z: v };
      if (near && Math.hypot(p.x - near.x, p.z - near.z) > radius) continue;
      if (p.x < -300 || p.x > 330) continue;
      return p;
    }
    return { x: 0, z: 0 };
  }
}
