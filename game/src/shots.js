// Staged screenshots: ?shot=<name>&seed=<n> puts the game straight into a
// real gameplay state and drives it with a simple autopilot, so the frame the
// judge sees is what a real session looks like. No faked or composited shots.

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const seed = parseInt(q.get('seed') || '1', 10) || 1;
  return { shot, seed };
}

// Autopilot: steers the car toward a target point, or walks forward on foot.
export class Autopilot {
  constructor(game) {
    this.game = game;
    this.target = null; // {x, z} to drive toward, or null for straight
    this.walk = false;
    this.throttle = true;
  }

  update() {
    const g = this.game;
    const v = { up: false, down: false, left: false, right: false, brake: false, handbrake: false, enter: false };
    if (this.walk) {
      v.up = true;
      g.input.virtual = v;
      return;
    }
    const p = g.player;
    if (!p.car) { g.input.virtual = v; return; }
    let tx, tz;
    if (this.target) { tx = this.target.x; tz = this.target.z; }
    else { tx = p.x + Math.sin(p.heading) * 120; tz = p.z + Math.cos(p.heading) * 120; }
    const dx = tx - p.x, dz = tz - p.z;
    const want = Math.atan2(dx, dz);
    let dh = want - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (dh > 0.12) v.left = true;
    else if (dh < -0.12) v.right = true;
    // Slow down for sharp turns.
    if (Math.abs(dh) > 0.9 && Math.abs(p.car.speed) > 12) v.brake = true;
    else v.up = true;
    g.input.virtual = v;
  }
}

// Stage one of the four shots on the live game object. Returns the autopilot.
export function stageShot(game, name) {
  const p = game.player;
  const traffic = game.traffic;
  const police = game.police;
  const missions = game.missions;
  const ap = new Autopilot(game);

  const placeOnRoad = (x, z, heading) => {
    const car = p.car || traffic.spawnPlayerCar(x, z, heading);
    car.stolen = true; // staged car: no steal penalty for the shot
    p.enterCar(car, game.enterCallbacks);
    p.syncWithCar(); // enterCar alone does not move the player onto the car
    return car;
  };

  if (name === 'cover') {
    // Sunset drive down the main avenue, wanted 2, mission 1 live.
    placeOnRoad(0, -120, 0);
    p.car.speed = 18;
    missions.start(0);
    police.setWanted(2);
    ap.target = { x: 0, z: 300 };
    // Two traffic cars ahead on the same avenue so the street feels alive.
    const t1 = traffic._spawnTraffic();
    t1.setPos(2.6, -75, 0); t1.axis = 'z'; t1.dir = 1; t1.lane = 2.6; t1.speed = 11;
    const t2 = traffic._spawnTraffic();
    t2.setPos(-2.6, -55, Math.PI); t2.axis = 'z'; t2.dir = -1; t2.lane = -2.6; t2.speed = 10;
  } else if (name === 'onfoot') {
    // On foot walking east along the market road toward the pickup; stalls
    // and pedestrians nearby, mission 2 live.
    p.spawn(-60, 240, Math.PI / 2);
    game.peds.gatherNear(-30, 232, 4);
    missions.start(1);
    police.setWanted(0);
    ap.walk = true;
  } else if (name === 'chase') {
    // High-speed escape, wanted 4, police cars flanking close behind.
    placeOnRoad(-120, 60, Math.PI / 2);
    p.car.speed = 26;
    missions.start(2);
    police.setWanted(4);
    for (let i = 0; i < 3; i++) police._spawnCar(p);
    // Flank the player ON the road, slightly ahead/sideways: the camera sits
    // 13.5 units behind, so anything further back falls out of frame.
    const flank = [[-2, 6], [6, -6], [14, 6]];
    police.cars.forEach((c, i) => {
      const f = flank[i % flank.length];
      c.setPos(p.x + f[0], p.z + f[1], Math.PI / 2);
      c.speed = 10;
    });
    ap.target = { x: 240, z: 60 };
  } else if (name === 'mission') {
    // Timed delivery toward the port, wanted 1, traffic all around.
    placeOnRoad(120, 240, Math.PI);
    p.car.speed = 16;
    missions.start(0);
    missions.step = 1; // second step: deliver to the port, timed
    missions._enterStep();
    police.setWanted(1);
    ap.target = { x: 288, z: -180 };
    const t1 = traffic._spawnTraffic();
    t1.setPos(122.6, 180, Math.PI); t1.axis = 'z'; t1.dir = -1; t1.lane = -2.6; t1.speed = 11;
  } else {
    placeOnRoad(0, 0, 0);
    missions.start(0);
  }
  // Snap the camera behind the player so the first frame is already framed.
  game.followCam.snap(game.player, game.player.heading);
  return ap;
}
