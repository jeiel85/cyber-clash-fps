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

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.012);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      500
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
    this.renderer.toneMappingExposure = 1.1;

    // Clock
    this.clock = new THREE.Clock();

    // Lighting
    this.setupLighting();

    // Window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x405577, 0.8);
    this.scene.add(ambientLight);

    // Hemisphere light for soft ground reflection
    const hemiLight = new THREE.HemisphereLight(0x5599ff, 0x111122, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Sun / Key Directional light
    const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.6);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Cyber accent lights
    const cyanLight = new THREE.PointLight(0x00f0ff, 2, 50);
    cyanLight.position.set(-20, 10, -20);
    this.scene.add(cyanLight);

    const orangeLight = new THREE.PointLight(0xff7700, 2, 50);
    orangeLight.position.set(20, 10, 20);
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
