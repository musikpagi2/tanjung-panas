// Bu Sari's job chain: six missions with a story arc. Each mission is a
// list of steps (goto / pickup / onfoot / steal / escape); a floating beacon
// marks the current objective and the HUD shows the label and any timer.

const THREE = window.THREE;
import { MISSIONS } from './config.js';

export class MissionManager {
  constructor(scene, callbacks) {
    this.scene = scene;
    this.cb = callbacks; // {toast, chime, addCash, setWanted, spawnSportCar, onStoryComplete}
    this.index = 0; // mission index
    this.step = 0;
    this.active = false;
    this.timeLeft = 0;
    this.stepDoneFlash = 0;
    this.marker = this._buildMarker();
    this.marker.visible = false;
    scene.add(this.marker);
    this.beaconMat = this.marker.children[0].material;
    this.ring = this.marker.children[1];
    this.diamond = this.marker.children[2];
    this.t = 0;
  }

  _buildMarker() {
    const g = new THREE.Group();
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 50, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }),
    );
    beacon.position.y = 25;
    g.add(beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23b }),
    );
    diamond.position.y = 6;
    g.add(diamond);
    return g;
  }

  get current() { return MISSIONS[this.index] || null; }
  get currentStep() {
    const m = this.current;
    return m ? m.steps[this.step] : null;
  }
  get done() { return this.index >= MISSIONS.length; }

  get objectiveLabel() {
    if (this.done) return 'Semua pekerjaan selesai — Tanjung Panas milikmu, Raka. Bebas berkeliaran.';
    const s = this.currentStep;
    return s ? s.label : '';
  }

  start(index = 0) {
    this.index = index;
    this.step = 0;
    this.active = true;
    const m = this.current;
    if (!m) { this.active = false; return; }
    this.cb.toast(`MISI ${m.id}: ${m.title} — hadiah Rp${m.reward}`, 4);
    this.cb.toast(m.intro, 6);
    this._enterStep();
  }

  _enterStep() {
    const s = this.currentStep;
    if (!s) return;
    this.marker.position.set(s.pos[0], 0, s.pos[1]);
    this.marker.visible = true;
    this.timeLeft = s.timed || 0;
    if (s.type === 'escape' && s.wanted) this.cb.setWanted(s.wanted);
    if (s.type === 'steal') this.cb.spawnSportCar(s.pos);
  }

  update(dt, player) {
    this.t += dt;
    if (!this.active || this.done) { this.marker.visible = false; return; }
    // Animate the beacon.
    this.diamond.rotation.y += dt * 2;
    this.diamond.position.y = 6 + Math.sin(this.t * 2.2) * 0.7;
    const pulse = 1 + Math.sin(this.t * 3) * 0.12;
    this.ring.scale.set(pulse, pulse, 1);
    this.beaconMat.opacity = 0.22 + Math.sin(this.t * 2.2) * 0.08;

    const s = this.currentStep;
    if (!s) return;
    if (s.timed) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.cb.toast('Waktu habis! Misi diulang dari awal.', 3);
        this.step = 0;
        this._enterStep();
        return;
      }
    }
    const d = Math.hypot(player.x - s.pos[0], player.z - s.pos[1]);
    let done = false;
    if (s.type === 'goto' || s.type === 'pickup') done = d < s.radius;
    else if (s.type === 'onfoot') done = d < s.radius && !player.driving;
    else if (s.type === 'steal') done = !!player.car && player.car.opts && player.car.opts.sport;
    else if (s.type === 'escape') done = d < s.radius;
    if (done) this._completeStep();
  }

  _completeStep() {
    const m = this.current;
    const s = this.currentStep;
    this.cb.chime();
    if (s.type === 'pickup') this.cb.toast('Penumpang naik. Jalan!', 2.5);
    if (s.type === 'onfoot') this.cb.toast('Koper didapat. Bawa kembali!', 2.5);
    if (s.type === 'steal') this.cb.toast('Mobil sport didapat! Kabur!', 2.5);
    this.step++;
    if (this.step >= m.steps.length) {
      this.cb.addCash(m.reward);
      this.cb.toast(`MISI SELESAI: ${m.title} — +Rp${m.reward}`, 4);
      this.index++;
      this.step = 0;
      if (this.done) {
        this.marker.visible = false;
        this.active = false;
        this.cb.onStoryComplete();
      } else {
        setTimeout(() => this.start(this.index), 1200);
        this.active = false;
        this.marker.visible = false;
      }
    } else {
      this._enterStep();
    }
  }

  // Save/load: cash + mission index only.
  saveState(cash) {
    try {
      localStorage.setItem('tanjungpanas-save', JSON.stringify({ cash, mission: this.index }));
    } catch { /* storage unavailable */ }
  }

  loadState() {
    try {
      const raw = localStorage.getItem('tanjungpanas-save');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
}
