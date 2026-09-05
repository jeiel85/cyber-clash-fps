import * as THREE from 'three';

export class Engine {
  public canvas: HTMLCanvasElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public clock: THREE.Clock;

  private isRunning: boolean = false;
  private updateCallbacks: ((dt: number) => void)[] = [];

  constructor(canvasId: string) {
    const el = document.getElementById(canvasId);
    if (!el || !(el instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }
    this.canvas = el;

    // Scene: Bright, clear sci-fi stadium sky
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7da4e8); // Vibrant sci-fi blue sky
    this.scene.fog = new THREE.FogExp2(0x90b5f5, 0.0035); // Light atmospheric haze instead of pitch black

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );
    this.camera.position.set(0, 2, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // Clock
    this.clock = new THREE.Clock();

    // Lighting
    this.setupLighting();

    // Window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    // Crisp, bright ambient light so shadows are never pitch black
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    this.scene.add(ambientLight);

    // Hemisphere light: bright blue sky reflection + soft ground bounce
    const hemiLight = new THREE.HemisphereLight(0xbad7ff, 0x99aabf, 1.1);
    hemiLight.position.set(0, 60, 0);
    this.scene.add(hemiLight);

    // Main Sun Directional light
    const dirLight = new THREE.DirectionalLight(0xfffaee, 2.0);
    dirLight.position.set(45, 70, 35);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 220;
    dirLight.shadow.camera.left = -70;
    dirLight.shadow.camera.right = 70;
    dirLight.shadow.camera.top = 70;
    dirLight.shadow.camera.bottom = -70;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);

    // Secondary fill light from opposite angle to prevent dark backfaces
    const fillLight = new THREE.DirectionalLight(0x99bbff, 0.85);
    fillLight.position.set(-40, 45, -35);
    this.scene.add(fillLight);

    // Center arena beacon lights
    const cyanLight = new THREE.PointLight(0x00f0ff, 2.5, 60);
    cyanLight.position.set(-20, 12, -20);
    this.scene.add(cyanLight);

    const orangeLight = new THREE.PointLight(0xff7700, 2.5, 60);
    orangeLight.position.set(20, 12, 20);
    this.scene.add(orangeLight);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public onUpdate(callback: (dt: number) => void): void {
    this.updateCallbacks.push(callback);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
  }

  private loop = (): void => {
    if (!this.isRunning) return;
    requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.1);

    for (const cb of this.updateCallbacks) {
      cb(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
