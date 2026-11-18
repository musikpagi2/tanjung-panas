// Wanted system + police: chase cars that ram the player, foot police that
// try to bust the player on foot, stars that decay when the player stays
// out of sight. 1-5 stars.

const THREE = window.THREE;
import { CFG } from './config.js';
import { Car, buildCarMesh } from './vehicles.js';
import { buildPersonMesh, animateWalk } from './pedestrians.js';
import { roadLines } from './city.js';
import { pick, range } from './rng.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class FootCop {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = buildPersonMesh(0x1e3a6e, 0x1e3a6e);
    // Cap.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x10244a }));
    cap.position.y = 1.98;
    this.mesh.add(cap);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = 0;
    this.phase = 0;
    this.grapple = 0;
    this.dead = false;
  }

  update(dt, player) {
    const dx = player.x - this.x, dz = player.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.6) {
      this.heading = Math.atan2(dx, dz);
      const speed = 7.2;
      this.x += Math.sin(this.heading) * speed * dt;
      this.z += Math.cos(this.heading) * speed * dt;
      this.phase += dt * speed * 3.2;
      animateWalk(this.mesh, this.phase, 1);
      this.grapple = 0;
    } else {
      this.grapple += dt;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
}

export class PoliceManager {
  constructor(scene, city, rng, audio, onBusted, onDamage) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.audio = audio;
    this.onBusted = onBusted;
    this.onDamage = onDamage;
    this.wanted = 0;
    this.cars = [];
    this.footCops = [];
    this.unseenTimer = 0;
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.flash = 0;
  }

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, CFG.maxWanted);
    if (this.wanted > before) this.unseenTimer = 0;
    return this.wanted;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, CFG.maxWanted);
    this.unseenTimer = 0;
  }

  clear() {
    this.wanted = 0;
    for (const c of this.cars) { this.scene.remove(c.mesh); }
    for (const f of this.footCops) { this.scene.remove(f.mesh); }
    this.cars = [];
    this.footCops = [];
  }

  update(dt, player, playerCar, others) {
    this.flash += dt;
    // Flash the light bars.
    const on = Math.floor(this.flash * 4) % 2 === 0;
    for (const c of this.cars) {
      if (c.mesh.userData.lightRed) {
        c.mesh.userData.lightRed.material.emissiveIntensity = on ? 2.2 : 0.25;
        c.mesh.userData.lightBlue.material.emissiveIntensity = on ? 0.25 : 2.2;
      }
    }
    const active = this.wanted > 0;
    this.audio.setSiren(active && this.cars.length > 0);

    if (!active) {
      // Stand down: remove police gradually.
      if (this.cars.length > 0) {
        const c = this.cars.pop();
        this.scene.remove(c.mesh);
      }
      if (this.footCops.length > 0) {
        const f = this.footCops.pop();
        this.scene.remove(f.mesh);
      }
      return;
    }

    // Spawn chase cars up to the wanted level (max 5).
    this.spawnTimer -= dt;
    const wantCars = Math.min(this.wanted, CFG.policeMaxActive);
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      this._spawnCar(player);
    }
    // Foot cops only when the player is on foot.
    if (!playerCar && this.footCops.length < Math.min(2, this.wanted)) {
      this._spawnFootCop(player);
    }
    if (playerCar && this.footCops.length > 0) {
      const f = this.footCops.pop();
      this.scene.remove(f.mesh);
    }

    // Unseen decay: no police within 70 units.
    let nearest = Infinity;
    for (const c of this.cars) nearest = Math.min(nearest, Math.hypot(c.x - player.x, c.z - player.z));
    for (const f of this.footCops) nearest = Math.min(nearest, Math.hypot(f.x - player.x, f.z - player.z));
    if (nearest > 70) {
      this.unseenTimer += dt;
      if (this.unseenTimer > CFG.wantedDecayDelay) {
        this.decayTimer += dt;
        if (this.decayTimer > CFG.wantedDecayStep) {
          this.decayTimer = 0;
          this.wanted = Math.max(0, this.wanted - 1);
        }
      }
    } else {
      this.unseenTimer = 0;
      this.decayTimer = 0;
    }

    // Chase cars.
    for (const c of this.cars) this._chaseCar(dt, c, player, playerCar, others);
    // Foot cops.
    for (const f of this.footCops) {
      f.update(dt, player);
      if (f.grapple > 1.4) {
        this.onBusted('Polisi menangkapmu di jalan.');
        return;
      }
    }
  }

  _spawnCar(player) {
    const car = new Car(this.scene, 0xe8e8e8, { mode: 'police', police: true });
    const p = this.city.randomRoadPoint(this.rng, player, CFG.policeSpawnDist + 60);
    // Place on a road near the player, facing roughly toward them.
    const rp = { x: Math.round(p.x / 60) * 60, z: Math.round(p.z / 60) * 60 };
    const onX = Math.abs(p.x - rp.x) < Math.abs(p.z - rp.z);
    const x = onX ? rp.x : p.x;
    const z = onX ? p.z : rp.z;
    car.setPos(x, z, Math.atan2(player.x - x, player.z - z));
    car.speed = 12;
    this.cars.push(car);
  }

  _spawnFootCop(player) {
    const a = this.rng() * Math.PI * 2;
    const f = new FootCop(this.scene, player.x + Math.cos(a) * 26, player.z + Math.sin(a) * 26);
    this.footCops.push(f);
  }

  _chaseCar(dt, car, player, playerCar, others) {
    const dx = player.x - car.x, dz = player.z - car.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const turnRate = 2.4;
    car.heading += clamp(dh, -turnRate * dt, turnRate * dt);
    const wantSpeed = dist > 26 ? CFG.policeTopSpeed : dist > 10 ? 24 : 16;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
    const f = car.forward;
    const nx = car.x + f.x * car.speed * dt;
    const nz = car.z + f.z * car.speed * dt;
    // Slide along buildings; if blocked, nudge the heading.
    if (this.city.hits(nx, nz, 2.1)) {
      const canX = !this.city.hits(nx, car.z, 2.1);
      const canZ = !this.city.hits(car.x, nz, 2.1);
      if (canX) car.x = nx;
      if (canZ) car.z = nz;
      if (!canX && !canZ) car.heading += 1.4 * dt;
    } else {
      car.x = nx; car.z = nz;
    }
    car.collideCars(others, null);
    // Ram the player's car.
    if (playerCar && dist < 4.2) {
      const push = 4.4 - dist;
      playerCar.x -= f.x * push * 0.5;
      playerCar.z -= f.z * push * 0.5;
      if (Math.abs(car.speed) > 10) {
        this.onDamage(4, 'Ditabrak polisi!');
        car.speed *= 0.55;
      }
    }
    // Ram the player on foot.
    if (!playerCar && dist < 2.4) {
      this.onDamage(8, 'Ditabrak mobil polisi!');
      car.speed *= 0.4;
      // Shove the player away.
      player.x += f.x * 3;
      player.z += f.z * 3;
    }
    car.syncMesh();
  }
}
