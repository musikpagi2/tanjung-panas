// TANJUNG PANAS — an open-world crime game in a fictional Indonesian port city.
// Wires the city, cars, traffic, pedestrians, police, missions, HUD, audio and
// camera together; runs the menu / playing / game-over state machine.

import { CFG } from './config.js';
import { makeRng } from './rng.js';
import { City } from './city.js';
import { TrafficManager } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { Player } from './player.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { FollowCamera } from './camera.js';
import { shotParams, stageShot } from './shots.js';

const THREE = window.THREE;

class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | gameover
    this.shot = shotParams();
    this.seed = this.shot ? this.shot.seed : 1337;
    this.shotTime = 0;
    this.frames = 0;
    this.autopilot = null;
    this.menuAngle = 0;
    this.damageToastAt = 0;
  }

  init() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('game').appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 2000);

    this.input = new Input();
    this.audio = new AudioSys();
    this.hud = new HUD();
    this.followCam = new FollowCamera(this.camera);
    this.followCam.city = null; // wired after the city is built

    // World.
    this.city = new City(this.scene, this.seed);
    this.followCam.city = this.city;
    const rng = makeRng(this.seed + 1);
    this.traffic = new TrafficManager(this.scene, this.city, makeRng(this.seed + 2));
    this.peds = new PedestrianManager(this.scene, this.city, makeRng(this.seed + 3));
    this.player = new Player(this.scene);
    this.police = new PoliceManager(this.scene, this.city, makeRng(this.seed + 4), this.audio,
      (reason) => this.gameOver('busted', reason),
      (amount, reason) => this.onDamage(amount, reason));
    this.missions = new MissionManager(this.scene, {
      toast: (m, s) => this.hud.toast(m, s),
      chime: () => this.audio.chime(),
      addCash: (n) => { this.player.cash += n; this.missions.saveState(this.player.cash); },
      setWanted: (n) => this.police.setWanted(n),
      spawnSportCar: (pos) => this.traffic.spawnSportCar(pos[0] + 6, pos[1], Math.PI / 2),
      onStoryComplete: () => {
        this.hud.toast('CERITA SELESAI — Raka bebas. Tanjung Panas milikmu sekarang.', 8);
        this.audio.chime();
      },
    });

    // Callbacks the player (and the shot stager) use to enter cars / punch.
    this.enterCallbacks = {
      nearestCar: (x, z, d) => this.traffic.nearestCar(x, z, d, ['parked', 'traffic']),
      onSteal: (car) => {
        this.police.addWanted(1);
        this.hud.toast('Mobil dicuri! Polisi waspada. +1 ★', 3);
        this.audio.honk();
      },
      onEnterCar: () => {},
      punch: (x, z, heading) => {
        const ped = this.peds.nearestInFront(x, z, heading, 2.6);
        if (ped) {
          ped.knockDown();
          this.police.addWanted(1);
          this.hud.toast('Kamu memukul pejalan kaki! +1 ★', 3);
          this.audio.thud(0.7);
        }
      },
    };

    // Spawn: Raka on foot by the market, his red car parked on the road.
    this.player.spawn(0, 180, Math.PI);
    this.traffic.spawnPlayerCar(10, 180, Math.PI / 2);

    // Saved progress: cash + mission index.
    const save = this.missions.loadState();
    if (save) {
      this.player.cash = save.cash || CFG.startCash;
      this._saveMission = Math.min(save.mission || 0, 5);
    } else this._saveMission = 0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (this.shot) {
      // Staged screenshot: straight into the game, no menu, no audio gesture.
      this.hud.hideStart();
      this.autopilot = stageShot(this, this.shot.shot);
      this.state = 'playing';
      this.missions.active = true;
    } else {
      this.hud.showStart();
      // The mission (and its intro toasts) start only when the player
      // presses Enter, so the title screen stays clean.
      this.state = 'menu';
    }

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  onDamage(amount, reason) {
    if (this.state !== 'playing') return;
    const dead = this.player.damage(amount, reason);
    this.hud.damageFlash();
    this.audio.thud(0.8);
    if (dead) {
      this.gameOver('wasted', 'Raka tumbang di jalanan Tanjung Panas.');
    } else if (performance.now() - this.damageToastAt > 4000) {
      this.damageToastAt = performance.now();
      this.hud.toast(reason, 2);
    }
  }

  gameOver(kind, reason) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.audio.setEngine(0, false);
    this.audio.setSiren(false);
    this.missions.saveState(this.player.cash);
    if (kind === 'busted') {
      this.hud.showGameOver('DITANGKAP!', reason + ' Bu Sari tidak akan membayar uang jaminanmu. Tekan R untuk mencoba lagi.');
    } else {
      this.hud.showGameOver('RAKA TUMBANG', reason + ' Tekan R untuk mencoba lagi.');
    }
  }

  restart() {
    this.police.clear();
    if (this.player.car) {
      this.player.car.mode = 'parked';
      this.player.car.speed = 0;
      this.player.car = null;
      this.player.mesh.visible = true;
    }
    this.player.health = CFG.playerHealth;
    this.player.spawn(0, 180, Math.PI);
    this.hud.hideGameOver();
    this.missions.start(this._saveMission);
    this.state = 'playing';
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frames++;
    const input = this.input;

    if (this.state === 'menu') {
      // Slow cinematic orbit over the city behind the title screen.
      this.menuAngle += dt * 0.04;
      this.camera.position.set(Math.sin(this.menuAngle) * 200, 95, Math.cos(this.menuAngle) * 200);
      this.camera.lookAt(0, 0, 0);
      this.traffic.update(dt, null);
      this.peds.update(dt, null);
      this.hud.drawMinimap({
        player: this.player,
        traffic: this.traffic.cars.filter((c) => c.mode === 'traffic'),
        police: [],
        missionPos: null,
        time: this.clock.elapsedTime,
      });
      if (input.start) {
        this.audio.init();
        this.hud.hideStart();
        this.followCam.snap(this.player, this.player.heading);
        this.missions.start(this._saveMission);
        this.state = 'playing';
      }
    } else if (this.state === 'playing') {
      if (this.autopilot) this.autopilot.update();
      const p = this.player;
      p.enterCooldown -= dt;

      if (p.driving) {
        const car = p.car;
        car.updatePlayer(dt, input, this.city, [...this.traffic.cars, ...this.police.cars],
          (s) => { this.audio.thud(Math.min(1, s / 25)); if (s > 14) this.onDamage(2, 'Tabrakan keras!'); });
        p.syncWithCar();
        // Run over a pedestrian?
        const victim = this.peds.checkCarHit(car.x, car.z, car.speed);
        if (victim) {
          this.police.addWanted(1);
          this.hud.toast('Kamu menabrak pejalan kaki! +1 ★', 3);
          this.audio.thud(1);
        }
        if (input.enterCar && p.enterCooldown <= 0) {
          p.exitCar(this.city);
          p.enterCooldown = 0.5;
        }
        this.audio.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
      } else {
        p.updateOnFoot(dt, input, this.city, this.followCam.camYaw, this.enterCallbacks);
        this.audio.setEngine(0, false);
      }

      const threat = p.driving ? { x: p.x, z: p.z } : null;
      this.traffic.update(dt, p);
      this.peds.update(dt, threat);
      this.police.update(dt, p, p.car, [...this.traffic.cars, ...this.police.cars]);
      this.missions.update(dt, p);
      this.followCam.update(dt, p, p.heading, input, p.driving);

      // HUD.
      this.hud.setStars(this.police.wanted);
      this.hud.setCash(p.cash);
      this.hud.setHealth(p.health);
      this.hud.setSpeed(p.driving ? Math.abs(p.car.speed) * 3.6 : p.speed * 3.6);
      this.hud.setObjective(this.missions.objectiveLabel, this.missions.timeLeft);
      this.hud.drawMinimap({
        player: p,
        traffic: this.traffic.cars.filter((c) => c.mode === 'traffic'),
        police: this.police.cars,
        missionPos: this.missions.currentStep ? this.missions.currentStep.pos : null,
        time: this.clock.elapsedTime,
      });
      this.audio.update(dt);
      this.hud.update(dt);

      if (this.shot) {
        // Wall-clock based: the game clock is dt-clamped, so at low FPS the
        // accumulated game time lags far behind real time.
        if (!this._shotStart) this._shotStart = performance.now();
        if (performance.now() - this._shotStart > 2500 && this.frames > 10) window.__ready = true;
      }
    } else if (this.state === 'gameover') {
      if (input.restart) this.restart();
    }

    input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
game.init();
window.__game = game;
