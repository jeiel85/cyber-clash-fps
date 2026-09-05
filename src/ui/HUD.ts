import { HeroBase } from '../heroes/HeroBase';
import { ControlPoint } from '../world/ControlPoint';
import { Specter } from '../heroes/Specter';

export class HUD {
  // Elements
  private hudRoot: HTMLElement;
  private hpCurrentEl: HTMLElement;
  private hpMaxEl: HTMLElement;
  private healthFillEl: HTMLElement;
  private shieldFillEl: HTMLElement;
  private heroNameEl: HTMLElement;
  private heroRoleEl: HTMLElement;

  private ultCircleEl: HTMLElement;
  private ultProgressEl: SVGCircleElement;
  private ultPercentEl: HTMLElement;
  private ultReadyTextEl: HTMLElement;

  private ammoCurrentEl: HTMLElement;
  private ammoMaxEl: HTMLElement;
  private weaponNameEl: HTMLElement;
  private reloadPromptEl: HTMLElement;

  private cdSecondaryEl: HTMLElement;
  private nameSecondaryEl: HTMLElement;
  private timerSecondaryEl: HTMLElement;

  private cdShiftEl: HTMLElement;
  private nameShiftEl: HTMLElement;
  private timerShiftEl: HTMLElement;

  private cdEEl: HTMLElement;
  private nameEEl: HTMLElement;
  private timerEEl: HTMLElement;

  private scoreBlueEl: HTMLElement;
  private scoreRedEl: HTMLElement;
  private barBlueEl: HTMLElement;
  private barRedEl: HTMLElement;
  private pointBoxEl: HTMLElement;
  private pointStateEl: HTMLElement;

  private damageNumbersContainer: HTMLElement;
  private killfeedEl: HTMLElement;
  private damageVignetteEl: HTMLElement;
  private healVignetteEl: HTMLElement;
  private hitmarkerEl: HTMLElement;
  private scopeOverlayEl: HTMLElement;
  private scopeChargeValEl: HTMLElement;
  private scopeChargeFillEl: HTMLElement;

  private announcementEl: HTMLElement;
  private announceTitleEl: HTMLElement;
  private announceDescEl: HTMLElement;

  constructor() {
    this.hudRoot = document.getElementById('hud')!;
    this.hpCurrentEl = document.getElementById('hp-current')!;
    this.hpMaxEl = document.getElementById('hp-max')!;
    this.healthFillEl = document.getElementById('health-fill')!;
    this.shieldFillEl = document.getElementById('shield-fill')!;
    this.heroNameEl = document.getElementById('hero-name')!;
    this.heroRoleEl = document.getElementById('hero-role-badge')!;

    this.ultCircleEl = document.getElementById('ult-circle')!;
    this.ultProgressEl = document.getElementById('ult-progress') as unknown as SVGCircleElement;
    this.ultPercentEl = document.getElementById('ult-percent')!;
    this.ultReadyTextEl = document.getElementById('ult-ready-text')!;

    this.ammoCurrentEl = document.getElementById('ammo-current')!;
    this.ammoMaxEl = document.getElementById('ammo-max')!;
    this.weaponNameEl = document.getElementById('weapon-name')!;
    this.reloadPromptEl = document.getElementById('reload-prompt')!;

    this.cdSecondaryEl = document.getElementById('cd-secondary')!;
    this.nameSecondaryEl = document.getElementById('name-secondary')!;
    this.timerSecondaryEl = document.getElementById('timer-secondary')!;

    this.cdShiftEl = document.getElementById('cd-shift')!;
    this.nameShiftEl = document.getElementById('name-shift')!;
    this.timerShiftEl = document.getElementById('timer-shift')!;

    this.cdEEl = document.getElementById('cd-e')!;
    this.nameEEl = document.getElementById('name-e')!;
    this.timerEEl = document.getElementById('timer-e')!;

    this.scoreBlueEl = document.getElementById('score-blue')!;
    this.scoreRedEl = document.getElementById('score-red')!;
    this.barBlueEl = document.getElementById('bar-blue')!;
    this.barRedEl = document.getElementById('bar-red')!;
    this.pointBoxEl = document.getElementById('point-box')!;
    this.pointStateEl = document.getElementById('point-state')!;

    this.damageNumbersContainer = document.getElementById('damage-numbers-container')!;
    this.killfeedEl = document.getElementById('killfeed')!;
    this.damageVignetteEl = document.getElementById('damage-vignette')!;
    this.healVignetteEl = document.getElementById('heal-vignette')!;
    this.hitmarkerEl = document.getElementById('hitmarker')!;
    this.scopeOverlayEl = document.getElementById('scope-overlay')!;
    this.scopeChargeValEl = document.getElementById('scope-charge-val')!;
    this.scopeChargeFillEl = document.getElementById('scope-charge-fill')!;

    this.announcementEl = document.getElementById('announcement')!;
    this.announceTitleEl = document.getElementById('announce-title')!;
    this.announceDescEl = document.getElementById('announce-desc')!;
  }

  public show(): void {
    this.hudRoot.classList.remove('hidden');
  }

  public hide(): void {
    this.hudRoot.classList.add('hidden');
  }

  public update(player: HeroBase, controlPoint: ControlPoint): void {
    // Health & Shield
    const curHp = Math.ceil(player.health);
    const maxHp = player.maxHealth;
    const curShield = Math.ceil(player.shield);
    const maxShield = player.maxShield;

    this.hpCurrentEl.textContent = `${curHp + curShield}`;
    this.hpMaxEl.textContent = `${maxHp + maxShield}`;

    const hpPct = Math.max(0, Math.min(100, (curHp / maxHp) * 100));
    this.healthFillEl.style.width = `${hpPct}%`;

    if (maxShield > 0) {
      const shieldPct = Math.max(0, Math.min(100, (curShield / maxShield) * 100));
      this.shieldFillEl.style.width = `${shieldPct}%`;
      this.shieldFillEl.style.display = 'block';
    } else {
      this.shieldFillEl.style.display = 'none';
    }

    // Hero name & badge
    this.heroNameEl.textContent = player.name.toUpperCase();
    this.heroRoleEl.textContent = player.heroType.toUpperCase();

    // Ammo
    this.ammoCurrentEl.textContent = `${player.ammo}`;
    this.ammoMaxEl.textContent = `${player.maxAmmo}`;
    if (player.ammo === 0 || player.isReloading) {
      this.reloadPromptEl.classList.remove('hidden');
    } else {
      this.reloadPromptEl.classList.add('hidden');
    }

    // Ultimate
    const ultPct = Math.floor(player.ultimateCharge);
    this.ultPercentEl.textContent = `${ultPct}%`;
    const circumference = 264;
    const offset = circumference - (ultPct / 100) * circumference;
    this.ultProgressEl.style.strokeDashoffset = `${offset}`;

    if (ultPct >= 100) {
      this.ultCircleEl.classList.add('ready');
      this.ultReadyTextEl.classList.remove('hidden');
    } else {
      this.ultCircleEl.classList.remove('ready');
      this.ultReadyTextEl.classList.add('hidden');
    }

    // Abilities Cooldowns
    this.updateAbilitySlot(
      this.cdSecondaryEl,
      this.nameSecondaryEl,
      this.timerSecondaryEl,
      player.secondaryAbility.name,
      player.secondaryAbility.currentCooldown,
      player.secondaryAbility.cooldown
    );

    this.updateAbilitySlot(
      this.cdShiftEl,
      this.nameShiftEl,
      this.timerShiftEl,
      player.abilityShift.name,
      player.abilityShift.currentCooldown,
      player.abilityShift.cooldown
    );

    this.updateAbilitySlot(
      this.cdEEl,
      this.nameEEl,
      this.timerEEl,
      player.abilityE.name,
      player.abilityE.currentCooldown,
      player.abilityE.cooldown
    );

    // Objective
    this.scoreBlueEl.textContent = `${Math.floor(controlPoint.blueScore)}%`;
    this.scoreRedEl.textContent = `${Math.floor(controlPoint.redScore)}%`;
    this.barBlueEl.style.width = `${controlPoint.blueScore}%`;
    this.barRedEl.style.width = `${controlPoint.redScore}%`;

    if (controlPoint.isContested) {
      this.pointStateEl.textContent = 'CONTESTED!';
      this.pointStateEl.style.color = '#ffaa00';
    } else if (controlPoint.state === 'blue') {
      this.pointStateEl.textContent = 'CAPTURED BY BLUE';
      this.pointStateEl.style.color = '#00aaff';
    } else if (controlPoint.state === 'red') {
      this.pointStateEl.textContent = 'CAPTURED BY RED';
      this.pointStateEl.style.color = '#ff3344';
    } else {
      this.pointStateEl.textContent = 'UNCLAIMED';
      this.pointStateEl.style.color = '#ffffff';
    }

    // Sniper Scope
    if (player instanceof Specter) {
      if (player.isScoped) {
        this.scopeOverlayEl.classList.remove('hidden');
        const charge = Math.floor(player.scopeCharge);
        this.scopeChargeValEl.textContent = `${charge}%`;
        const fillBar = this.scopeChargeFillEl.firstElementChild as HTMLElement;
        if (fillBar) fillBar.style.width = `${charge}%`;
      } else {
        this.scopeOverlayEl.classList.add('hidden');
      }
    }
  }

  private updateAbilitySlot(
    overlay: HTMLElement,
    nameEl: HTMLElement,
    timerEl: HTMLElement,
    name: string,
    currentCd: number,
    totalCd: number
  ): void {
    nameEl.textContent = name;
    if (currentCd > 0 && totalCd > 0) {
      const pct = (currentCd / totalCd) * 100;
      overlay.style.height = `${pct}%`;
      timerEl.classList.remove('hidden');
      timerEl.textContent = `${currentCd.toFixed(1)}`;
    } else {
      overlay.style.height = '0%';
      timerEl.classList.add('hidden');
    }
  }

  public showHitmarker(isHeadshot: boolean = false): void {
    this.hitmarkerEl.classList.remove('hidden');
    if (isHeadshot) {
      this.hitmarkerEl.classList.add('headshot');
    } else {
      this.hitmarkerEl.classList.remove('headshot');
    }
    setTimeout(() => {
      this.hitmarkerEl.classList.add('hidden');
    }, 120);
  }

  public showDamageNumber(screenX: number, screenY: number, amount: number, isCrit: boolean = false, isHeal: boolean = false): void {
    const el = document.createElement('div');
    el.className = `damage-number ${isCrit ? 'crit' : ''} ${isHeal ? 'heal' : ''}`;
    el.textContent = isHeal ? `+${Math.round(amount)}` : `${Math.round(amount)}`;
    el.style.left = `${screenX + (Math.random() - 0.5) * 20}px`;
    el.style.top = `${screenY + (Math.random() - 0.5) * 20}px`;

    this.damageNumbersContainer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  public flashDamage(): void {
    this.damageVignetteEl.classList.add('active');
    setTimeout(() => this.damageVignetteEl.classList.remove('active'), 200);
  }

  public flashHeal(): void {
    this.healVignetteEl.classList.add('active');
    setTimeout(() => this.healVignetteEl.classList.remove('active'), 250);
  }

  public addKillfeed(killer: string, victim: string, killerTeam: 'blue' | 'red', isHeadshot: boolean = false): void {
    const entry = document.createElement('div');
    entry.className = `kill-entry ${killerTeam === 'red' ? 'red-kill' : ''} ${isHeadshot ? 'headshot' : ''}`;
    entry.innerHTML = `
      <span class="kill-killer">${killer}</span>
      <span class="kill-icon">${isHeadshot ? '🎯 CRIT' : '⚡ ELIM'}</span>
      <span class="kill-victim">${victim}</span>
    `;
    this.killfeedEl.prepend(entry);
    setTimeout(() => entry.remove(), 4500);
  }

  public showAnnouncement(title: string, desc: string): void {
    this.announceTitleEl.textContent = title;
    this.announceDescEl.textContent = desc;
    this.announcementEl.classList.remove('hidden');
    setTimeout(() => this.announcementEl.classList.add('hidden'), 2600);
  }
}
