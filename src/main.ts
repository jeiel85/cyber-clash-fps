import * as THREE from 'three';
import { Engine } from './core/Engine';
import { InputManager } from './core/InputManager';
import { PhysicsWorld, Projectile } from './core/Physics';
import { sounds } from './audio/SoundManager';
import { ArenaMap } from './world/ArenaMap';
import { ControlPoint } from './world/ControlPoint';
import { PickupManager } from './world/Pickups';
import { HeroBase, HeroType, Team } from './heroes/HeroBase';
import { Striker } from './heroes/Striker';
import { Vanguard } from './heroes/Vanguard';
import { Specter } from './heroes/Specter';
import { Remedy } from './heroes/Remedy';
import { BotController } from './ai/BotController';
import { NetworkManager } from './network/NetworkManager';
import { GamePacket, PlayerUpdatePacket, ActionEventPacket, DamageEventPacket } from './network/Protocol';
import { HUD } from './ui/HUD';
import { HeroSelectModal } from './ui/HeroSelectModal';
import { Scoreboard } from './ui/Scoreboard';
import { LobbyModal, MatchStartOptions } from './ui/LobbyModal';

class GameManager {
  private engine: Engine;
  private input: InputManager;
  private physics: PhysicsWorld;
  private arena: ArenaMap;
  private controlPoint: ControlPoint;
  private pickups: PickupManager;
  private bots: BotController;
  private network: NetworkManager;

  // UI
  private hud: HUD;
  private heroSelectModal: HeroSelectModal;
  private scoreboard: Scoreboard;
  private lobbyModal: LobbyModal;

  // Local Player
  public localPlayer!: HeroBase;
  public cameraPitch: number = 0;
  public cameraYaw: number = 0;

  // All match participants
  public remotePlayers: Map<string, HeroBase> = new Map();
  public allHeroes: HeroBase[] = [];

  // Match State
  private matchActive: boolean = false;
  private autoFillBots: boolean = true;
  private netSyncTimer: number = 0;

  constructor() {
    // 1. Initialize Engine & Input
    this.engine = new Engine('game-canvas');
    this.input = new InputManager(this.engine.canvas);

    // 2. Physics & World
    this.physics = new PhysicsWorld(this.engine.scene);
    this.pickups = new PickupManager(this.engine.scene);
    this.arena = new ArenaMap(this.engine.scene, this.physics, this.pickups);
    this.controlPoint = new ControlPoint(this.engine.scene);
    this.bots = new BotController(this.physics, this.engine.scene, this.pickups);

    // 3. Network
    this.network = new NetworkManager();

    // 4. UI
    this.hud = new HUD();
    this.heroSelectModal = new HeroSelectModal();
    this.scoreboard = new Scoreboard();
    this.lobbyModal = new LobbyModal(this.network);

    // 5. Setup Defaults
    this.createLocalPlayer('striker');
    this.setupNetwork();
    this.setupEvents();

    // 6. Hook render loop
    this.engine.onUpdate(this.update.bind(this));
    this.engine.start();

    // Initialize network peer in background
    this.network.init().then((id) => {
      this.lobbyModal.updatePeerInfo(id);
    });
  }

  private createLocalPlayer(heroType: HeroType): void {
    const prevKills = this.localPlayer ? this.localPlayer.kills : 0;
    const prevDeaths = this.localPlayer ? this.localPlayer.deaths : 0;

    // Remove old first person mesh
    if (this.localPlayer && this.localPlayer.fpWeaponMesh) {
      this.engine.camera.remove(this.localPlayer.fpWeaponMesh);
    }

    switch (heroType) {
      case 'vanguard':
        this.localPlayer = new Vanguard('local_player', 'You', 'blue', true, this.physics, this.engine.scene);
        break;
      case 'specter':
        this.localPlayer = new Specter('local_player', 'You', 'blue', true, this.physics, this.engine.scene);
        break;
      case 'remedy':
        this.localPlayer = new Remedy('local_player', 'You', 'blue', true, this.physics, this.engine.scene);
        break;
      case 'striker':
      default:
        this.localPlayer = new Striker('local_player', 'You', 'blue', true, this.physics, this.engine.scene);
        break;
    }

    this.localPlayer.kills = prevKills;
    this.localPlayer.deaths = prevDeaths;

    // Attach FP weapon to camera
    this.engine.camera.add(this.localPlayer.fpWeaponMesh);
    this.engine.scene.add(this.engine.camera);

    this.localPlayer.respawn();
    this.rebuildHeroesList();
  }

  private rebuildHeroesList(): void {
    this.allHeroes = [this.localPlayer, ...Array.from(this.remotePlayers.values()), ...this.bots.bots];
  }

  private setupNetwork(): void {
    this.network.onPacket((packet: GamePacket, senderId: string) => {
      this.handlePacket(packet, senderId);
    });

    this.network.onPeerConnect((peerId: string) => {
      console.log('Peer joined the game:', peerId);
      // Spawn remote player representation
      const remote = new Striker(peerId, `Player_${peerId.substring(0, 4)}`, 'red', false, this.physics, this.engine.scene);
      remote.respawn();
      this.remotePlayers.set(peerId, remote);
      this.rebuildHeroesList();

      this.hud.showAnnouncement('PLAYER CONNECTED', `${remote.name} has joined the battle!`);

      // If host, send initial match state
      if (this.network.role === 'host') {
        this.network.send({
          type: 'INIT_STATE',
          hostId: this.network.myPeerId,
          players: Array.from(this.remotePlayers.values()).map((p) => ({
            id: p.id,
            name: p.name,
            heroType: p.heroType,
            team: p.team,
            x: p.position.x,
            y: p.position.y,
            z: p.position.z,
            rotY: p.rotation.y,
            health: p.health,
            shield: p.shield,
            isAlive: p.isAlive,
            kills: p.kills,
            deaths: p.deaths,
          })),
          blueScore: this.controlPoint.blueScore,
          redScore: this.controlPoint.redScore,
          controlState: this.controlPoint.state,
          captureProgress: this.controlPoint.captureProgress,
        });
      }
    });

    this.network.onPeerDisconnect((peerId: string) => {
      const remote = this.remotePlayers.get(peerId);
      if (remote) {
        this.engine.scene.remove(remote.model3D);
        this.remotePlayers.delete(peerId);
        this.rebuildHeroesList();
        this.hud.showAnnouncement('PLAYER DISCONNECTED', `${remote.name} left the arena.`);
      }
    });
  }

  private handlePacket(packet: GamePacket, senderId: string): void {
    switch (packet.type) {
      case 'PLAYER_UPDATE': {
        const remote = this.remotePlayers.get(packet.id);
        if (remote) {
          remote.position.set(packet.x, packet.y, packet.z);
          remote.rotation.y = packet.rotY;
          remote.health = packet.health;
          remote.shield = packet.shield;
          remote.isAlive = packet.isAlive;
        }
        break;
      }
      case 'DAMAGE_EVENT': {
        if (packet.victimId === this.localPlayer.id) {
          this.localPlayer.takeDamage(packet.damage, packet.isHeadshot);
          this.hud.flashDamage();
        }
        const victim = this.allHeroes.find((h) => h.id === packet.victimId);
        const attacker = this.allHeroes.find((h) => h.id === packet.attackerId);
        if (packet.killed && victim && attacker) {
          this.hud.addKillfeed(attacker.name, victim.name, attacker.team, packet.isHeadshot);
        }
        break;
      }
      case 'OBJECTIVE_SYNC': {
        if (this.network.role === 'client') {
          this.controlPoint.blueScore = packet.blueScore;
          this.controlPoint.redScore = packet.redScore;
          this.controlPoint.state = packet.state;
          this.controlPoint.captureProgress = packet.captureProgress;
          this.controlPoint.isContested = packet.isContested;
        }
        break;
      }
    }
  }

  private setupEvents(): void {
    // Start match from Lobby
    this.lobbyModal.show((options: MatchStartOptions) => {
      sounds.init();
      this.autoFillBots = options.autoFillBots;

      if (options.mode === 'join') {
        this.network.joinRoom(options.roomCode).then((connected) => {
          if (!connected) {
            alert('방 접속에 실패했습니다. 솔로 모드로 시작합니다.');
          }
          this.startMatch();
        });
      } else if (options.mode === 'host' || options.mode === 'quick') {
        this.network.hostRoom(options.roomCode);
        this.startMatch();
      } else {
        this.network.role = 'solo';
        this.startMatch();
      }
    });

    // Hero select confirm
    this.heroSelectModal.show((hero) => {
      this.createLocalPlayer(hero);
      this.input.requestPointerLock();
    });

    // Pause menu resume
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      document.getElementById('pause-modal')?.classList.add('hidden');
      this.input.requestPointerLock();
    });

    document.getElementById('btn-change-hero')?.addEventListener('click', () => {
      document.getElementById('pause-modal')?.classList.add('hidden');
      this.openHeroSelect();
    });

    document.getElementById('btn-exit-lobby')?.addEventListener('click', () => {
      window.location.reload();
    });

    // Canvas click to lock pointer if match is active
    this.engine.canvas.addEventListener('click', () => {
      if (this.matchActive && !this.heroSelectModal.isVisible()) {
        sounds.init();
        this.input.requestPointerLock();
      }
    });

    this.input.onLockChange((locked) => {
      const pauseModal = document.getElementById('pause-modal');
      if (!locked && this.matchActive && !this.heroSelectModal.isVisible()) {
        pauseModal?.classList.remove('hidden');
      } else {
        pauseModal?.classList.add('hidden');
      }
    });
  }

  private startMatch(): void {
    this.matchActive = true;
    this.hud.show();
    this.hud.showAnnouncement('ROUND START', 'CAPTURE THE CONTROL POINT!');

    // Fill bots for 3v3 match if enabled
    if (this.autoFillBots) {
      this.bots.clearBots();
      // Blue Team allies
      this.bots.createBot('Titan-02', 'vanguard', 'blue');
      this.bots.createBot('Mercy-Bot', 'remedy', 'blue');

      // Red Team opponents
      this.bots.createBot('Reaper-01', 'striker', 'red');
      this.bots.createBot('Goliath', 'vanguard', 'red');
      this.bots.createBot('Shadow-Eye', 'specter', 'red');

      this.rebuildHeroesList();
    }

    this.input.requestPointerLock();
  }

  private openHeroSelect(): void {
    this.input.exitPointerLock();
    this.heroSelectModal.show((hero) => {
      this.createLocalPlayer(hero);
      this.input.requestPointerLock();
    });
  }

  // Master Frame Update
  private update(dt: number): void {
    if (!this.matchActive) return;

    // 1. Process Input & Camera
    this.handlePlayerInput(dt);

    // 2. Update Pickups & Control Point
    this.pickups.update(dt);
    this.controlPoint.update(dt, this.allHeroes);

    // Check Victory
    if (this.controlPoint.isGameOver && !this.controlPoint.winner) {
      // already handled
    } else if (this.controlPoint.isGameOver) {
      const isWin = this.controlPoint.winner === this.localPlayer.team;
      this.hud.showAnnouncement(isWin ? 'VICTORY!' : 'DEFEAT', 'MATCH COMPLETED');
    }

    // 3. Update Bots
    this.bots.update(dt, this.allHeroes, this.controlPoint.position);

    // 4. Update Remote Players
    for (const remote of this.remotePlayers.values()) {
      remote.update(dt);
    }

    // 5. Update Projectiles
    this.physics.updateProjectiles(dt, (proj: Projectile, explodePoint: THREE.Vector3) => {
      this.handleProjectileExplosion(proj, explodePoint);
    });

    // 6. Update HUD
    this.hud.update(this.localPlayer, this.controlPoint);

    // 7. Network State Broadcast (30Hz)
    this.netSyncTimer += dt;
    if (this.netSyncTimer >= 0.033) {
      this.netSyncTimer = 0;
      this.syncNetwork();
    }
  }

  private handlePlayerInput(dt: number): void {
    const inputState = this.input.state;

    // Tab Scoreboard
    if (inputState.tabScoreboard) {
      this.scoreboard.show(this.allHeroes);
    } else {
      this.scoreboard.hide();
    }

    // Hero select key [H]
    if (inputState.heroSelect) {
      this.openHeroSelect();
      inputState.heroSelect = false;
      return;
    }

    if (!this.input.isLocked) return;

    // Camera Rotation (Mouse delta)
    const mouseDelta = this.input.consumeMouseDelta();
    this.cameraYaw -= mouseDelta.x;
    this.cameraPitch -= mouseDelta.y;
    this.cameraPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.cameraPitch));

    this.localPlayer.rotation.y = this.cameraYaw;
    this.engine.camera.rotation.set(this.cameraPitch, this.cameraYaw, 0, 'YXZ');

    // Movement Vectors relative to Camera Yaw
    const moveDir = new THREE.Vector3();
    if (inputState.forward) moveDir.z -= 1;
    if (inputState.backward) moveDir.z += 1;
    if (inputState.left) moveDir.x -= 1;
    if (inputState.right) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
    }

    // Sprint (Shift)
    if (this.localPlayer instanceof Striker) {
      this.localPlayer.setSprinting(inputState.sprint && inputState.forward);
    } else if (inputState.sprint) {
      this.localPlayer.useAbilityShift(this.getAimDirection());
    }

    // Movement velocity
    this.localPlayer.velocity.x = moveDir.x * this.localPlayer.moveSpeed;
    this.localPlayer.velocity.z = moveDir.z * this.localPlayer.moveSpeed;

    // Jump
    if (inputState.jump && this.localPlayer.isGrounded) {
      this.localPlayer.velocity.y = this.localPlayer.jumpSpeed;
      sounds.playJump();
    }

    // Physics Movement integration
    const phys = this.physics.movePlayer(this.localPlayer.position, this.localPlayer.velocity, 0.45, 1.8, dt);
    this.localPlayer.isGrounded = phys.onGround;

    if (phys.hitJumpPad) {
      sounds.playJumpPad();
    }

    // Camera Position attached to Player Eye
    const eyePos = this.localPlayer.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.engine.camera.position.copy(eyePos);

    // Health pack pickup check
    const healed = this.pickups.checkPlayer(this.localPlayer.position, this.localPlayer.health, this.localPlayer.maxHealth);
    if (healed > 0) {
      this.localPlayer.heal(healed);
      sounds.playHealthPickup();
      this.hud.flashHeal();
      this.hud.showDamageNumber(window.innerWidth / 2, window.innerHeight / 2 - 40, healed, false, true);
    }

    // Weapon bobbing & updates
    const isMoving = moveDir.lengthSq() > 0;
    this.localPlayer.update(dt);
    this.localPlayer.updateWeaponBobbing(isMoving, dt);

    // Fire Controls
    const aimDir = this.getAimDirection();

    if (inputState.primaryFire) {
      this.performPlayerPrimaryFire(aimDir, eyePos);
    }

    if (inputState.secondaryFire) {
      this.localPlayer.fireSecondary(aimDir, eyePos);
      inputState.secondaryFire = false; // Trigger once per click for secondary
    }

    if (inputState.abilityE) {
      this.localPlayer.useAbilityE(aimDir);
      inputState.abilityE = false;
    }

    if (inputState.ultimate) {
      this.localPlayer.useUltimate();
      inputState.ultimate = false;
    }

    if (inputState.reload) {
      this.localPlayer.reload();
      inputState.reload = false;
    }
  }

  private getAimDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(this.engine.camera.rotation);
    return dir.normalize();
  }

  private performPlayerPrimaryFire(aimDir: THREE.Vector3, origin: THREE.Vector3): void {
    if (this.localPlayer.fireTimer > 0 || this.localPlayer.ammo <= 0 || this.localPlayer.isReloading) {
      this.localPlayer.firePrimary(aimDir, origin);
      return;
    }

    this.localPlayer.firePrimary(aimDir, origin);

    const enemies = this.allHeroes.filter((h) => h.team !== this.localPlayer.team && h.isAlive);

    // Multi-pellet shotgun hit detection for Vanguard
    if (this.localPlayer instanceof Vanguard) {
      this.cameraPitch += 0.025; // Subtle recoil kick

      const pelletCount = 8;
      const pelletDmg = 14;
      const hitMap: Map<HeroBase, { count: number; isHeadshot: boolean }> = new Map();

      for (let i = 0; i < pelletCount; i++) {
        const spread = new THREE.Vector3(
          (Math.random() - 0.5) * 0.14,
          (Math.random() - 0.5) * 0.14,
          (Math.random() - 0.5) * 0.14
        );
        const pelletDir = aimDir.clone().add(spread).normalize();
        const pRay = new THREE.Ray(origin, pelletDir);
        const worldRay = this.physics.raycastWorld(origin, pelletDir, 50);

        let hitEnemy: HeroBase | null = null;
        let hitDist = worldRay.distance;
        let isHead = false;

        for (const enemy of enemies) {
          const headCenter = enemy.position.clone().add(new THREE.Vector3(0, 1.75, 0));
          const headSphere = new THREE.Sphere(headCenter, 0.4);
          const headHit = pRay.intersectSphere(headSphere, new THREE.Vector3());

          const bodyBox = new THREE.Box3(
            enemy.position.clone().add(new THREE.Vector3(-0.6, 0, -0.6)),
            enemy.position.clone().add(new THREE.Vector3(0.6, 1.6, 0.6))
          );
          const bodyHit = pRay.intersectBox(bodyBox, new THREE.Vector3());

          if (headHit) {
            const d = origin.distanceTo(headHit);
            if (d < hitDist) {
              hitDist = d;
              hitEnemy = enemy;
              isHead = true;
            }
          } else if (bodyHit) {
            const d = origin.distanceTo(bodyHit);
            if (d < hitDist) {
              hitDist = d;
              hitEnemy = enemy;
              isHead = false;
            }
          }
        }

        if (hitEnemy) {
          const entry = hitMap.get(hitEnemy) || { count: 0, isHeadshot: false };
          entry.count++;
          if (isHead) entry.isHeadshot = true;
          hitMap.set(hitEnemy, entry);
        }
      }

      // Apply damage for each hit enemy
      for (const [enemy, hitInfo] of hitMap.entries()) {
        const totalDmg = hitInfo.count * pelletDmg * (hitInfo.isHeadshot ? 1.5 : 1.0);
        const dmgRes = enemy.takeDamage(totalDmg, hitInfo.isHeadshot, this.localPlayer);

        sounds.playHitmarker(hitInfo.isHeadshot);
        this.hud.showHitmarker(hitInfo.isHeadshot);
        this.hud.showDamageNumber(
          window.innerWidth / 2 + (Math.random() - 0.5) * 40,
          window.innerHeight / 2 - 30,
          dmgRes.damageTaken,
          hitInfo.isHeadshot
        );

        if (dmgRes.killed) {
          sounds.playKillChime();
          this.hud.addKillfeed(this.localPlayer.name, enemy.name, this.localPlayer.team, hitInfo.isHeadshot);
        }

        if (this.network.role !== 'solo') {
          this.network.send({
            type: 'DAMAGE_EVENT',
            attackerId: this.localPlayer.id,
            victimId: enemy.id,
            damage: dmgRes.damageTaken,
            isHeadshot: hitInfo.isHeadshot,
            killed: dmgRes.killed,
          });
        }
      }
      return;
    }

    // Single-ray hitscan detection for Striker, Specter, Remedy
    const ray = new THREE.Ray(origin, aimDir);

    let closestHitEnemy: HeroBase | null = null;
    let closestDist = Infinity;
    let isHeadshot = false;

    for (const enemy of enemies) {
      // Check head sphere (radius ~0.3 at y = 1.7)
      const headCenter = enemy.position.clone().add(new THREE.Vector3(0, 1.75, 0));
      const headSphere = new THREE.Sphere(headCenter, 0.35);
      const headHit = ray.intersectSphere(headSphere, new THREE.Vector3());

      // Check torso cylinder / box (radius ~0.6 from y=0 to y=1.5)
      const bodyBox = new THREE.Box3(
        enemy.position.clone().add(new THREE.Vector3(-0.5, 0, -0.5)),
        enemy.position.clone().add(new THREE.Vector3(0.5, 1.5, 0.5))
      );
      const bodyHit = ray.intersectBox(bodyBox, new THREE.Vector3());

      if (headHit) {
        const d = origin.distanceTo(headHit);
        if (d < closestDist) {
          closestDist = d;
          closestHitEnemy = enemy;
          isHeadshot = true;
        }
      } else if (bodyHit) {
        const d = origin.distanceTo(bodyHit);
        if (d < closestDist) {
          closestDist = d;
          closestHitEnemy = enemy;
          isHeadshot = false;
        }
      }
    }

    // World collision distance
    const worldRay = this.physics.raycastWorld(origin, aimDir, 150);
    if (closestHitEnemy && closestDist < worldRay.distance) {
      // Calculate damage based on hero
      let baseDmg = 20;
      if (this.localPlayer instanceof Specter) baseDmg = this.localPlayer.isScoped ? (40 + 80 * (this.localPlayer.scopeCharge / 100)) : 14;
      else if (this.localPlayer instanceof Remedy) baseDmg = 25;

      const dmgRes = closestHitEnemy.takeDamage(baseDmg, isHeadshot, this.localPlayer);

      // Hitmarker & Sound feedback
      sounds.playHitmarker(isHeadshot);
      this.hud.showHitmarker(isHeadshot);
      this.hud.showDamageNumber(
        window.innerWidth / 2 + (Math.random() - 0.5) * 40,
        window.innerHeight / 2 - 30,
        dmgRes.damageTaken,
        isHeadshot
      );

      if (dmgRes.killed) {
        sounds.playKillChime();
        this.hud.addKillfeed(this.localPlayer.name, closestHitEnemy.name, this.localPlayer.team, isHeadshot);
      }

      // Sync network damage
      if (this.network.role !== 'solo') {
        this.network.send({
          type: 'DAMAGE_EVENT',
          attackerId: this.localPlayer.id,
          victimId: closestHitEnemy.id,
          damage: dmgRes.damageTaken,
          isHeadshot,
          killed: dmgRes.killed,
        });
      }
    }
  }

  private handleProjectileExplosion(proj: Projectile, point: THREE.Vector3): void {
    // Explosion sound & visual
    sounds.playExplosion();

    // Visual sphere flash
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(proj.splashRadius, 16, 16),
      new THREE.MeshBasicMaterial({
        color: proj.isHealing ? 0x00ff88 : 0xff6600,
        transparent: true,
        opacity: 0.6,
      })
    );
    flash.position.copy(point);
    this.engine.scene.add(flash);
    setTimeout(() => this.engine.scene.remove(flash), 150);

    // Apply AoE damage/healing to all in range
    for (const h of this.allHeroes) {
      if (!h.isAlive) continue;
      const d = h.position.distanceTo(point);
      if (d <= proj.splashRadius) {
        const falloff = 1.0 - d / proj.splashRadius;
        if (proj.isHealing && h.team === proj.team) {
          h.heal(70 * falloff);
        } else if (!proj.isHealing && h.team !== proj.team) {
          const dmg = proj.damage * falloff;
          const res = h.takeDamage(dmg);
          if (proj.ownerId === this.localPlayer.id) {
            sounds.playHitmarker(false);
            this.hud.showHitmarker(false);
            if (res.killed) {
              sounds.playKillChime();
              this.hud.addKillfeed(this.localPlayer.name, h.name, this.localPlayer.team);
            }
          }
        }
      }
    }
  }

  private syncNetwork(): void {
    if (this.network.role === 'solo') return;

    // Send local update
    const updatePacket: PlayerUpdatePacket = {
      type: 'PLAYER_UPDATE',
      id: this.localPlayer.id,
      x: this.localPlayer.position.x,
      y: this.localPlayer.position.y,
      z: this.localPlayer.position.z,
      vx: this.localPlayer.velocity.x,
      vy: this.localPlayer.velocity.y,
      vz: this.localPlayer.velocity.z,
      rotY: this.localPlayer.rotation.y,
      health: this.localPlayer.health,
      shield: this.localPlayer.shield,
      isAlive: this.localPlayer.isAlive,
    };
    this.network.send(updatePacket);

    // Host syncs objective
    if (this.network.role === 'host') {
      this.network.send({
        type: 'OBJECTIVE_SYNC',
        blueScore: this.controlPoint.blueScore,
        redScore: this.controlPoint.redScore,
        state: this.controlPoint.state,
        captureProgress: this.controlPoint.captureProgress,
        isContested: this.controlPoint.isContested,
      });
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new GameManager();
});
