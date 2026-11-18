// Third-person follow camera: trails behind the player/car, mouse drag orbits
// around them, and it eases back behind the direction of travel.

const THREE = window.THREE;

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // world heading the camera looks along
    this.orbit = 0; // mouse-drag offset from behind-target
    this.pitch = 0.32; // radians above horizontal
    this.dist = 15;
    this.height = 6.5;
    this.pos = new THREE.Vector3(0, 10, -20);
    this.look = new THREE.Vector3();
    this.city = null; // set by main: used to keep the camera out of buildings
  }

  // Place the camera immediately behind the target (no swing-in).
  snap(target, heading) {
    this.yaw = heading;
    this.orbit = 0;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.pos.set(target.x - fx * this.dist, this.height, target.z - fz * this.dist);
    this.camera.position.copy(this.pos);
    this.look.set(target.x + fx * 5, 1.6, target.z + fz * 5);
    this.camera.lookAt(this.look);
  }

  get camYaw() { return this.yaw; }

  update(dt, target, heading, input, driving) {
    // Mouse drag orbits; the offset decays back to zero so the camera
    // settles behind the direction of travel.
    this.orbit -= input.mouseDX * 0.005;
    this.pitch += input.mouseDY * 0.003;
    this.pitch = Math.max(0.12, Math.min(0.9, this.pitch));
    this.orbit *= Math.max(0, 1 - dt * 0.55);

    const wantYaw = heading + this.orbit;
    let dy = wantYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    // Follow the direction of travel: fast when moving forward or driving,
    // slow when strafing/backing — otherwise a strafe key spirals the player
    // around as the camera chases their facing.
    const follow = driving || input.up;
    const rate = driving ? 2.2 : (follow ? 3.2 : 0.35);
    this.yaw += dy * Math.min(1, dt * rate);

    const dist = driving ? 13.5 : 10;
    const height = driving ? 5.2 : 4.5;
    this.dist += (dist - this.dist) * Math.min(1, dt * 3);
    this.height += (height - this.height) * Math.min(1, dt * 3);

    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let tx = target.x - fx * this.dist;
    let tz = target.z - fz * this.dist;
    let ty = this.height + Math.tan(this.pitch) * this.dist * 0.4;
    // Keep the camera out of buildings: sample the line from the target to
    // the camera and pull in just before the first blocked point.
    if (this.city) {
      for (let s = 0.25; s <= 1.01; s += 0.1) {
        const px = target.x + (tx - target.x) * s;
        const pz = target.z + (tz - target.z) * s;
        if (this.city.hits(px, pz, 1.2)) {
          const k = Math.max(0.18, s - 0.12);
          tx = target.x + (tx - target.x) * k;
          tz = target.z + (tz - target.z) * k;
          ty = Math.max(ty, 2.5);
          break;
        }
      }
    }
    // Ease the camera so it never snaps.
    const k = Math.min(1, dt * 7);
    this.pos.x += (tx - this.pos.x) * k;
    this.pos.y += (ty - this.pos.y) * k;
    this.pos.z += (tz - this.pos.z) * k;
    this.camera.position.copy(this.pos);
    this.look.set(target.x + fx * 5, 1.6, target.z + fz * 5);
    this.camera.lookAt(this.look);
  }
}
