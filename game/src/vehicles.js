// Cars: a low-poly box car factory, arcade driving physics for the player,
// and traffic AI that follows the road grid. Police reuse this class with
// the police body style (see police.js).

const THREE = window.THREE;
import { CFG, CAR_COLORS } from './config.js';
import { pick, range } from './rng.js';
import { roadLines } from './city.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function buildCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const w = opts.sport ? 2.1 : 2.0;
  const len = opts.sport ? 4.6 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.62, len), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.58, len * 0.5), glassMat);
  cabin.position.set(0, 1.18, -len * 0.06);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
  const wheels = [];
  for (const [wx, wz] of [[-w / 2, len * 0.32], [w / 2, len * 0.32], [-w / 2, -len * 0.32], [w / 2, -len * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights + taillights.
  const hlMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa9955 });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hlMat);
    hl.position.set(sx, 0.68, len / 2 + 0.01);
    g.add(hl);
  }
  const tlMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x771111 });
  for (const sx of [-0.65, 0.65]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tlMat);
    tl.position.set(sx, 0.68, -len / 2 - 0.01);
    g.add(tl);
  }
  if (opts.police) {
    // White body with a red/blue light bar.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222226 }));
    bar.position.set(0, 1.56, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.34),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222 }));
    red.position.set(-0.28, 1.66, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff }));
    blue.position.set(0.28, 1.66, -0.2);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  g.userData.bodyLen = len;
  return g;
}

export class Car {
  constructor(scene, color, opts = {}) {
    this.scene = scene;
    this.mesh = buildCarMesh(color, opts);
    scene.add(this.mesh);
    this.x = 0; this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.color = color;
    this.opts = opts;
    this.mode = opts.mode || 'parked'; // player | traffic | police | parked
    this.axis = 'x';
    this.dir = 1;
    this.lane = 2.6;
    this.baseSpeed = 10;
    this.turnCooldown = 0;
    this.stolen = false;
    this.dead = false;
  }

  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  setPos(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016 * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  // Player driving: arcade physics with collision slide.
  updatePlayer(dt, input, city, others, onHit) {
    const fwd = input.up ? 1 : 0;
    const rev = input.down ? 1 : 0;
    if (fwd) this.speed += CFG.carAccel * dt;
    if (rev) {
      if (this.speed > 0.5) this.speed -= CFG.carBrake * dt;
      else this.speed -= CFG.carAccel * 0.55 * dt;
    }
    if (!fwd && !rev) this.speed -= this.speed * 0.9 * dt;
    this.speed -= this.speed * 0.25 * dt; // rolling drag
    if (input.handbrake) {
      this.speed -= this.speed * 2.2 * dt;
    }
    this.speed = clamp(this.speed, -CFG.carMaxReverse, CFG.carMaxSpeed);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steer - this.steer) * Math.min(1, dt * 10);
    const turnBoost = input.handbrake ? 1.7 : 1;
    this.heading += this.steer * CFG.carTurn * turnBoost * dt * clamp(this.speed / 8, -1, 1);

    const f = this.forward;
    const nx = this.x + f.x * this.speed * dt;
    const nz = this.z + f.z * this.speed * dt;
    const before = this.speed;
    if (city.hits(nx, nz, 2.1)) {
      // Slide: try each axis separately.
      const canX = !city.hits(nx, this.z, 2.1);
      const canZ = !city.hits(this.x, nz, 2.1);
      if (canX) this.x = nx;
      if (canZ) this.z = nz;
      if (!canX && !canZ) {
        this.speed *= -0.25; // bounce back a little
        if (Math.abs(before) > 8 && onHit) onHit(Math.abs(before));
      } else if (Math.abs(before) > 12 && onHit) {
        onHit(Math.abs(before) * 0.6);
        this.speed *= 0.55;
      }
    } else {
      this.x = nx; this.z = nz;
    }
    this.collideCars(others, onHit);
    this.syncMesh();
  }

  // Simple circle push-apart between cars.
  collideCars(others, onHit) {
    for (const o of others) {
      if (o === this || o.dead) continue;
      const dx = o.x - this.x;
      const dz = o.z - this.z;
      const d = Math.hypot(dx, dz);
      const min = 3.4;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        this.x -= nx * push; this.z -= nz * push;
        if (o.mode !== 'parked') { o.x += nx * push; o.z += nz * push; }
        const rel = Math.abs(this.speed - o.speed);
        if (rel > 6 && onHit) onHit(rel * 0.5);
        this.speed *= 0.85;
        if (o.mode === 'traffic' || o.mode === 'police') o.speed *= 0.8;
      }
    }
  }

  // Traffic AI: follow the road grid, turn at intersections, queue behind cars.
  updateTraffic(dt, city, others) {
    this.turnCooldown -= dt;
    // Desired speed: slow for cars ahead in the same lane.
    let desired = this.baseSpeed;
    const f = this.forward;
    for (const o of others) {
      if (o === this || o.dead) continue;
      const dx = o.x - this.x, dz = o.z - this.z;
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 0 && ahead < 11 && side < 2.6) {
        desired = Math.min(desired, ahead < 5.5 ? 0 : o.speed * 0.7);
      }
    }
    this.speed += (desired - this.speed) * Math.min(1, dt * 1.6);
    // Move along the current axis.
    if (this.axis === 'x') {
      this.x += this.dir * this.speed * dt;
      this.z += (this._laneZ() - this.z) * Math.min(1, dt * 4);
    } else {
      this.z += this.dir * this.speed * dt;
      this.x += (this._laneX() - this.x) * Math.min(1, dt * 4);
    }
    // Turn at intersections.
    const nearX = Math.abs(this.x - Math.round(this.x / 60) * 60) < 2.2;
    const nearZ = Math.abs(this.z - Math.round(this.z / 60) * 60) < 2.2;
    if (nearX && nearZ && this.turnCooldown <= 0 && this.speed > 2) {
      const r = Math.random();
      if (r < 0.3) {
        // Turn onto the crossing road.
        if (this.axis === 'x') {
          this.axis = 'z';
          this.dir = Math.random() < 0.5 ? 1 : -1;
          this.lane = this.dir > 0 ? -2.6 : 2.6;
          this.x = Math.round(this.x / 60) * 60;
        } else {
          this.axis = 'x';
          this.dir = Math.random() < 0.5 ? 1 : -1;
          this.lane = this.dir > 0 ? 2.6 : -2.6;
          this.z = Math.round(this.z / 60) * 60;
        }
        this.turnCooldown = 2.5;
      } else if (r < 0.36) {
        this.dir *= -1; // U-turn, rare
        this.lane = -this.lane;
        this.turnCooldown = 2.5;
      }
    }
    // Wrap around the city edges.
    if (this.x > 345) this.x = -345;
    if (this.x < -345) this.x = 345;
    if (this.z > 345) this.z = -345;
    if (this.z < -345) this.z = 345;
    // Heading follows the axis, smoothed.
    const target = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    let dh = target - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, dt * 6);
    this.syncMesh();
  }

  _laneZ() {
    const roadZ = Math.round(this.z / 60) * 60;
    return roadZ + this.lane;
  }
  _laneX() {
    const roadX = Math.round(this.x / 60) * 60;
    return roadX + this.lane;
  }
}

export class TrafficManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this._spawnInitial();
  }

  _spawnInitial() {
    for (let i = 0; i < 14; i++) this._spawnTraffic();
    for (let i = 0; i < 10; i++) this._spawnParked();
  }

  _spawnTraffic() {
    const lines = roadLines();
    const car = new Car(this.scene, pick(this.rng, CAR_COLORS), { mode: 'traffic' });
    const v = pick(this.rng, lines);
    car.axis = this.rng() < 0.5 ? 'x' : 'z';
    car.dir = this.rng() < 0.5 ? 1 : -1;
    car.lane = car.dir > 0 ? (car.axis === 'x' ? 2.6 : -2.6) : (car.axis === 'x' ? -2.6 : 2.6);
    car.baseSpeed = range(this.rng, 8, 13);
    const along = range(this.rng, -330, 330);
    if (car.axis === 'x') car.setPos(along, v + car.lane, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    else car.setPos(v + car.lane, along, car.dir > 0 ? 0 : Math.PI);
    car.speed = car.baseSpeed;
    this.cars.push(car);
    return car;
  }

  _spawnParked() {
    const lines = roadLines();
    const car = new Car(this.scene, pick(this.rng, CAR_COLORS), { mode: 'parked' });
    const v = pick(this.rng, lines);
    const along = range(this.rng, -320, 320);
    const side = this.rng() < 0.5 ? 1 : -1;
    if (this.rng() < 0.5) car.setPos(along, v + side * 4.4, side > 0 ? Math.PI / 2 : -Math.PI / 2);
    else car.setPos(v + side * 4.4, along, side > 0 ? 0 : Math.PI);
    this.cars.push(car);
    return car;
  }

  // The player's own starter car, parked near the market spawn.
  // It is Raka's own car, so entering it is not a theft.
  spawnPlayerCar(x, z, heading) {
    const car = new Car(this.scene, 0xd23b2e, { mode: 'parked' });
    car.stolen = true;
    car.setPos(x, z, heading);
    this.cars.push(car);
    return car;
  }

  // The yellow sport car the final mission must steal.
  spawnSportCar(x, z, heading) {
    const car = new Car(this.scene, 0xe8b93b, { mode: 'parked', sport: true });
    car.setPos(x, z, heading);
    this.cars.push(car);
    return car;
  }

  update(dt, playerPos) {
    for (const c of this.cars) {
      if (c.mode === 'traffic') c.updateTraffic(dt, this.city, this.cars);
      // Teleport far-away traffic back near the player so streets stay alive.
      if (c.mode === 'traffic' && playerPos) {
        const d = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
        if (d > 260) {
          const p = this.city.randomRoadPoint(this.rng, playerPos, 130);
          const v = pick(this.rng, roadLines());
          c.axis = this.rng() < 0.5 ? 'x' : 'z';
          c.dir = this.rng() < 0.5 ? 1 : -1;
          if (c.axis === 'x') c.setPos(p.x, v + (c.dir > 0 ? 2.6 : -2.6), c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          else c.setPos(v + (c.dir > 0 ? -2.6 : 2.6), p.z, c.dir > 0 ? 0 : Math.PI);
          c.speed = c.baseSpeed;
        }
      }
    }
  }

  nearestCar(x, z, maxDist, modes) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      if (c.dead || (modes && !modes.includes(c.mode))) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  remove(car) {
    car.dead = true;
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
}
