export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  abilityE: boolean;
  ultimate: boolean;
  reload: boolean;
  primaryFire: boolean;
  secondaryFire: boolean;
  tabScoreboard: boolean;
  heroSelect: boolean;
  mouseXDelta: number;
  mouseYDelta: number;
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  public state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    abilityE: false,
    ultimate: false,
    reload: false,
    primaryFire: false,
    secondaryFire: false,
    tabScoreboard: false,
    heroSelect: false,
    mouseXDelta: 0,
    mouseYDelta: 0,
  };

  public isLocked: boolean = false;
  private onLockChangeCallbacks: ((locked: boolean) => void)[] = [];
  public mouseSensitivity: number = 0.0022;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  public onLockChange(cb: (locked: boolean) => void) {
    this.onLockChangeCallbacks.push(cb);
  }

  public requestPointerLock(): void {
    try {
      this.canvas.requestPointerLock();
    } catch (e) {
      console.warn('Pointer lock request error:', e);
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  private setupListeners(): void {
    // Pointer lock events
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      for (const cb of this.onLockChangeCallbacks) {
        cb(this.isLocked);
      }
    });

    // Mouse movement
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isLocked) {
        this.state.mouseXDelta += e.movementX * this.mouseSensitivity;
        this.state.mouseYDelta += e.movementY * this.mouseSensitivity;
      }
    });

    // Mouse buttons
    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.isLocked) return;
      if (e.button === 0) {
        this.state.primaryFire = true;
      } else if (e.button === 2) {
        this.state.secondaryFire = true;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.state.primaryFire = false;
      } else if (e.button === 2) {
        this.state.secondaryFire = false;
      }
    });

    // Prevent context menu on right click in game
    window.addEventListener('contextmenu', (e: MouseEvent) => {
      if (this.isLocked) e.preventDefault();
    });

    // Keyboard events
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.state.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.state.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.state.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.state.right = true;
      if (code === 'Space') this.state.jump = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.state.sprint = true;
      if (code === 'KeyE') this.state.abilityE = true;
      if (code === 'KeyQ') this.state.ultimate = true;
      if (code === 'KeyR') this.state.reload = true;
      if (code === 'Tab') {
        e.preventDefault();
        this.state.tabScoreboard = true;
      }
      if (code === 'KeyH') this.state.heroSelect = true;
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.state.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.state.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.state.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.state.right = false;
      if (code === 'Space') this.state.jump = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.state.sprint = false;
      if (code === 'KeyE') this.state.abilityE = false;
      if (code === 'KeyQ') this.state.ultimate = false;
      if (code === 'KeyR') this.state.reload = false;
      if (code === 'Tab') {
        this.state.tabScoreboard = false;
      }
      if (code === 'KeyH') this.state.heroSelect = false;
    });
  }

  // Consume accumulated mouse deltas each frame
  public consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.state.mouseXDelta, y: this.state.mouseYDelta };
    this.state.mouseXDelta = 0;
    this.state.mouseYDelta = 0;
    return delta;
  }
}
