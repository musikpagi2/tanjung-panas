// HUD: DOM overlay (stars, cash, health, speed, objective, toasts) and a
// live top-down minimap canvas drawn from the world state each frame.

import { roadLines } from './city.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.starsEl = this.el('stars');
    this.cashEl = this.el('cash');
    this.healthFill = this.el('health-fill');
    this.speedEl = this.el('speed');
    this.objectiveEl = this.el('objective');
    this.timerEl = this.el('timer');
    this.toastEl = this.el('toast');
    this.minimap = this.el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.startScreen = this.el('start-screen');
    this.gameoverScreen = this.el('gameover-screen');
    this.gameoverTitle = this.el('gameover-title');
    this.gameoverText = this.el('gameover-text');
    this.damageEl = this.el('damage-flash');
    this.toastQueue = [];
    this.toastTimer = 0;
    this._stars = -1;
  }

  setStars(n) {
    if (n === this._stars) return;
    this._stars = n;
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
    this.starsEl.innerHTML = s;
    this.starsEl.classList.toggle('hot', n >= 3);
  }

  setCash(n) { this.cashEl.textContent = 'Rp' + n.toLocaleString('id-ID'); }
  setHealth(h) {
    this.healthFill.style.width = h + '%';
    this.healthFill.classList.toggle('low', h < 30);
  }
  setSpeed(kmh) { this.speedEl.textContent = Math.round(kmh) + ' km/h'; }
  setObjective(text, timeLeft) {
    this.objectiveEl.textContent = text;
    this.timerEl.textContent = timeLeft > 0 ? '⏱ ' + Math.ceil(timeLeft) + ' dtk' : '';
    this.timerEl.classList.toggle('urgent', timeLeft > 0 && timeLeft < 15);
  }

  toast(msg, secs = 3) {
    this.toastQueue.push({ msg, secs });
    if (this.toastQueue.length === 1) this._showNextToast();
  }

  _showNextToast() {
    const t = this.toastQueue[0];
    if (!t) { this.toastEl.classList.remove('show'); return; }
    this.toastEl.textContent = t.msg;
    this.toastEl.classList.add('show');
    this.toastTimer = t.secs;
  }

  update(dt) {
    if (this.toastQueue.length > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastQueue.shift();
        this._showNextToast();
      }
    }
  }

  damageFlash() {
    this.damageEl.classList.remove('flash');
    void this.damageEl.offsetWidth;
    this.damageEl.classList.add('flash');
  }

  showStart() { this.startScreen.classList.remove('hidden'); }
  hideStart() { this.startScreen.classList.add('hidden'); }
  showGameOver(title, text) {
    this.gameoverTitle.textContent = title;
    this.gameoverText.textContent = text;
    this.gameoverScreen.classList.remove('hidden');
  }
  hideGameOver() { this.gameoverScreen.classList.add('hidden'); }

  // Top-down minimap: whole city in a 180px canvas, north (-z) up.
  drawMinimap(world) {
    const c = this.mm;
    const S = 180;
    const scale = S / 720;
    const X = (wx) => (wx + 360) * scale;
    const Z = (wz) => (wz + 360) * scale;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(12,18,26,0.82)';
    c.fillRect(0, 0, S, S);
    // Beach + port.
    c.fillStyle = '#c9b078';
    c.fillRect(X(-360), Z(-360), 54 * scale, 720 * scale);
    c.fillStyle = '#5a6a72';
    c.fillRect(X(240), Z(-300), 120 * scale, 240 * scale);
    // Roads.
    c.strokeStyle = '#8a8f96';
    c.lineWidth = 2;
    for (const v of roadLines()) {
      c.beginPath(); c.moveTo(X(-360), Z(v)); c.lineTo(X(360), Z(v)); c.stroke();
      c.beginPath(); c.moveTo(X(v), Z(-360)); c.lineTo(X(v), Z(360)); c.stroke();
    }
    // Mission marker.
    if (world.missionPos) {
      const mx = X(world.missionPos[0]), mz = Z(world.missionPos[1]);
      const p = 1 + Math.sin(world.time * 4) * 0.25;
      c.fillStyle = '#ffd23b';
      c.beginPath();
      c.moveTo(mx, mz - 6 * p); c.lineTo(mx + 5 * p, mz); c.lineTo(mx, mz + 6 * p); c.lineTo(mx - 5 * p, mz);
      c.closePath(); c.fill();
    }
    // Traffic (white), police (red, flashing).
    c.fillStyle = '#e8e8e8';
    for (const car of world.traffic) {
      c.fillRect(X(car.x) - 1.5, Z(car.z) - 1.5, 3, 3);
    }
    if (Math.floor(world.time * 3) % 2 === 0) c.fillStyle = '#ff3344';
    else c.fillStyle = '#ff8899';
    for (const car of world.police) {
      c.beginPath(); c.arc(X(car.x), Z(car.z), 3.4, 0, Math.PI * 2); c.fill();
    }
    // Player arrow.
    const px = X(world.player.x), pz = Z(world.player.z);
    c.save();
    c.translate(px, pz);
    c.rotate(Math.atan2(Math.sin(world.player.heading), -Math.cos(world.player.heading)) + Math.PI);
    c.fillStyle = '#39d353';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5);
    c.closePath(); c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }
}
