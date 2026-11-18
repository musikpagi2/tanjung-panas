// Keyboard + mouse input. Tracks held keys, edge presses, and mouse orbit drag.
// Also exposes a virtual input object the autopilot (staged shots) can drive.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each frame
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this.virtual = null; // {up,down,left,right,brake,handbrake,enter} or null
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => { this.dragging = true; };
    this._onMouseUp = () => { this.dragging = false; };
    this._onMouseMove = (e) => {
      if (this.dragging) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
  }

  // Call once per frame after the game has read input.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  _held(code) {
    if (this.virtual) {
      // Virtual input uses semantic keys (up/down/left/right/brake/handbrake).
      const map = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake', ShiftLeft: 'handbrake', ShiftRight: 'handbrake' };
      return !!this.virtual[map[code] || code];
    }
    return this.keys.has(code);
  }

  get up() { return this._held('KeyW') || this._held('ArrowUp'); }
  get down() { return this._held('KeyS') || this._held('ArrowDown'); }
  get left() { return this._held('KeyA') || this._held('ArrowLeft'); }
  get right() { return this._held('KeyD') || this._held('ArrowRight'); }
  get brake() { return this._held('Space'); }
  get handbrake() { return this._held('ShiftLeft') || this._held('ShiftRight'); }
  get sprint() { return this._held('ShiftLeft') || this._held('ShiftRight'); }
  wasPressed(code) {
    if (this.virtual) return !!this.virtual[code];
    return this.pressed.has(code);
  }
  get enterCar() { return this.wasPressed('KeyE'); }
  get punch() { return this.wasPressed('KeyF'); }
  get start() { return this.wasPressed('Enter'); }
  get restart() { return this.wasPressed('KeyR'); }
}
