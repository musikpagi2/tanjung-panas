// Raka, the player: on-foot movement (camera-relative), entering and
// exiting cars, punching, health. While driving, the car owns the motion.

const THREE = window.THREE;
import { CFG } from './config.js';
import { buildPersonMesh, animateWalk } from './pedestrians.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildPersonMesh(0x2e8a8a, 0x2e3440);
    // Red bandana so Raka reads at a distance.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46),
      new THREE.MeshLambertMaterial({ color: 0xd23b2e }));
    band.position.y = 1.92;
    this.mesh.add(band);
    scene.add(this.mesh);
    this.x = 0; this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.phase = 0;
    this.car = null; // the Car being driven, or null
    this.health = CFG.playerHealth;
    this.cash = CFG.startCash;
    this.punchCooldown = 0;
    this.enterCooldown = 0;
  }

  get driving() { return !!this.car; }

  spawn(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  // On-foot update. camYaw is the camera's yaw so WASD is camera-relative.
  updateOnFoot(dt, input, city, camYaw, callbacks) {
    this.punchCooldown -= dt;
    this.enterCooldown -= dt;
    let ix = 0, iz = 0;
    if (input.up) { ix += Math.sin(camYaw); iz += Math.cos(camYaw); }
    if (input.down) { ix -= Math.sin(camYaw); iz -= Math.cos(camYaw); }
    if (input.left) { ix += Math.sin(camYaw - Math.PI / 2); iz += Math.cos(camYaw - Math.PI / 2); }
    if (input.right) { ix += Math.sin(camYaw + Math.PI / 2); iz += Math.cos(camYaw + Math.PI / 2); }
    const len = Math.hypot(ix, iz);
    const sprint = input.sprint;
    const targetSpeed = len > 0 ? (sprint ? CFG.runSpeed : CFG.walkSpeed) : 0;
    if (len > 0) {
      const moveHeading = Math.atan2(ix / len, iz / len);
      let dh = moveHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
    }
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 8);
    const dx = Math.sin(this.heading) * this.speed * dt;
    const dz = Math.cos(this.heading) * this.speed * dt;
    city.moveCircle(this, dx, dz, 0.6);
    this.phase += dt * this.speed * 2.2;
    animateWalk(this.mesh, this.phase, clamp(this.speed / CFG.walkSpeed, 0, 1));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = true;

    // Enter a car.
    if (input.enterCar && this.enterCooldown <= 0) {
      const car = callbacks.nearestCar(this.x, this.z, 5.5);
      if (car) {
        this.enterCar(car, callbacks);
        // No cooldown after entering: the keypress is edge-triggered and
        // cleared at end of frame, so it cannot double-fire into an exit.
        // The cooldown only matters after exiting (set in main.js).
      }
    }
    // Punch.
    if (input.punch && this.punchCooldown <= 0) {
      this.punchCooldown = 0.5;
      callbacks.punch(this.x, this.z, this.heading);
    }
  }

  enterCar(car, callbacks) {
    this.car = car;
    car.mode = 'player';
    car.speed = 0;
    this.mesh.visible = false;
    if (!car.stolen) {
      car.stolen = true;
      callbacks.onSteal(car);
    }
    callbacks.onEnterCar(car);
  }

  exitCar(city) {
    if (!this.car) return;
    const car = this.car;
    car.mode = 'parked';
    car.speed = 0;
    // Step out to the left side of the car.
    const sx = car.x + Math.cos(car.heading) * 2.4;
    const sz = car.z - Math.sin(car.heading) * 2.4;
    this.x = city.hits(sx, sz, 0.6) ? car.x - Math.cos(car.heading) * 2.4 : sx;
    this.z = city.hits(sx, sz, 0.6) ? car.z + Math.sin(car.heading) * 2.4 : sz;
    this.heading = car.heading;
    this.car = null;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  damage(amount, reason) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(CFG.playerHealth, this.health + amount);
  }

  syncWithCar() {
    if (this.car) {
      this.x = this.car.x;
      this.z = this.car.z;
      this.heading = this.car.heading;
    }
  }
}
