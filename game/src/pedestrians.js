// Pedestrians: low-poly people strolling the sidewalks, plus the shared
// person builder the player and the foot police also use.

const THREE = window.THREE;
import { PED_SHIRTS } from './config.js';
import { pick, range } from './rng.js';
import { roadLines } from './city.js';

export function buildPersonMesh(shirt, pants = 0x2e3440) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.44),
    new THREE.MeshLambertMaterial({ color: 0x1e1a16 }));
  hair.position.y = 1.9;
  g.add(hair);
  const legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.26), pantsMat);
    leg.position.set(sx, 0.34, 0);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const sx of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
    arm.position.set(sx, 1.05, 0);
    arm.castShadow = true;
    g.add(arm);
    arms.push(arm);
  }
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}

// Walk-cycle: swing legs and arms opposite each other.
export function animateWalk(mesh, phase, speedNorm) {
  const s = Math.sin(phase) * 0.55 * speedNorm;
  mesh.userData.legs[0].rotation.x = s;
  mesh.userData.legs[1].rotation.x = -s;
  mesh.userData.arms[0].rotation.x = -s * 0.8;
  mesh.userData.arms[1].rotation.x = s * 0.8;
}

class Pedestrian {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.mesh = buildPersonMesh(pick(rng, PED_SHIRTS));
    scene.add(this.mesh);
    this.x = 0; this.z = 0;
    this.heading = 0;
    this.speed = range(rng, 1.2, 2.2);
    this.phase = rng() * Math.PI * 2;
    this.axis = 'x';
    this.dir = 1;
    this.lane = 8.2; // sidewalk offset from the road centre
    this.down = false;
    this.downTimer = 0;
    this.fleeing = false;
    this._placeRandom();
  }

  _placeRandom() {
    const lines = roadLines();
    const v = pick(this.rng, lines);
    this.axis = this.rng() < 0.5 ? 'x' : 'z';
    this.dir = this.rng() < 0.5 ? 1 : -1;
    const along = range(this.rng, -330, 330);
    if (this.axis === 'x') { this.x = along; this.z = v + this.lane * (this.dir > 0 ? 1 : -1); }
    else { this.x = v + this.lane * (this.dir > 0 ? -1 : 1); this.z = along; }
    this.heading = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  update(dt, threat) {
    if (this.down) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) { this._placeRandom(); this.down = false; this.mesh.rotation.x = 0; this.mesh.visible = true; }
      return;
    }
    // Flee from a fast car or a punch nearby.
    let speed = this.speed;
    if (threat) {
      const d = Math.hypot(threat.x - this.x, threat.z - this.z);
      if (d < 9) {
        this.fleeing = true;
        const away = Math.atan2(this.x - threat.x, this.z - threat.z);
        this.heading = away;
        speed = 5.5;
      } else this.fleeing = false;
    }
    if (!this.fleeing) {
      // Walk the sidewalk; turn at intersections.
      const nearX = Math.abs(this.x - Math.round(this.x / 60) * 60) < 2;
      const nearZ = Math.abs(this.z - Math.round(this.z / 60) * 60) < 2;
      if (nearX && nearZ && Math.random() < 0.02) {
        if (this.axis === 'x') {
          this.axis = 'z';
          this.dir = Math.random() < 0.5 ? 1 : -1;
          this.z = Math.round(this.z / 60) * 60 + this.lane * (this.dir > 0 ? -1 : 1);
        } else {
          this.axis = 'x';
          this.dir = Math.random() < 0.5 ? 1 : -1;
          this.x = Math.round(this.x / 60) * 60 + this.lane * (this.dir > 0 ? 1 : -1);
        }
      }
      const target = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
      let dh = target - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 5);
    }
    this.x += Math.sin(this.heading) * speed * dt;
    this.z += Math.cos(this.heading) * speed * dt;
    if (this.x > 350) this.x = -350;
    if (this.x < -350) this.x = 350;
    if (this.z > 350) this.z = -350;
    if (this.z < -350) this.z = 350;
    this.phase += dt * speed * 3.2;
    animateWalk(this.mesh, this.phase, Math.min(1, speed / 3));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  knockDown() {
    this.down = true;
    this.downTimer = 6;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.3;
  }
}

export class PedestrianManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < 18; i++) this.peds.push(new Pedestrian(scene, rng));
  }

  update(dt, threat) {
    for (const p of this.peds) p.update(dt, threat);
  }

  // Move n pedestrians to sidewalk spots near (x,z) — used to stage shots.
  gatherNear(x, z, n) {
    const spots = [[-6, 4], [5, -3], [-2, -8], [8, 6]];
    for (let i = 0; i < Math.min(n, this.peds.length); i++) {
      const p = this.peds[i];
      p.x = x + spots[i][0];
      p.z = z + spots[i][1];
      p.axis = 'x';
      p.dir = i % 2 ? 1 : -1;
      p.heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  // A pedestrian within reach in front of (x,z) facing heading.
  nearestInFront(x, z, heading, maxDist) {
    let best = null, bd = maxDist;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    for (const p of this.peds) {
      if (p.down) continue;
      const dx = p.x - x, dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) > 0.2) { bd = d; best = p; }
    }
    return best;
  }

  // Did a car just run someone over? Returns the victim or null.
  checkCarHit(carX, carZ, speed) {
    if (Math.abs(speed) < 3) return null;
    for (const p of this.peds) {
      if (p.down) continue;
      if (Math.hypot(p.x - carX, p.z - carZ) < 2.2) {
        p.knockDown();
        return p;
      }
    }
    return null;
  }
}
