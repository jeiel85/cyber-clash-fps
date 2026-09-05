import { HeroBase } from '../heroes/HeroBase';

export class Scoreboard {
  private modalEl: HTMLElement;
  private blueRowsEl: HTMLElement;
  private redRowsEl: HTMLElement;

  constructor() {
    this.modalEl = document.getElementById('scoreboard-modal')!;
    this.blueRowsEl = document.getElementById('scoreboard-blue-rows')!;
    this.redRowsEl = document.getElementById('scoreboard-red-rows')!;
  }

  public show(heroes: HeroBase[]): void {
    this.updateRows(heroes);
    this.modalEl.classList.remove('hidden');
  }

  public hide(): void {
    this.modalEl.classList.add('hidden');
  }

  private updateRows(heroes: HeroBase[]): void {
    const blueHeroes = heroes.filter((h) => h.team === 'blue');
    const redHeroes = heroes.filter((h) => h.team === 'red');

    this.blueRowsEl.innerHTML = blueHeroes
      .map(
        (h) => `
      <tr>
        <td><b>${h.name}</b> ${h.isLocalPlayer ? '(YOU)' : ''}</td>
        <td>${h.heroType.toUpperCase()}</td>
        <td>${h.kills}</td>
        <td>${h.deaths}</td>
        <td>${Math.round(h.damageDealt)}</td>
        <td>${h.isLocalPlayer ? '0ms' : '18ms'}</td>
      </tr>
    `
      )
      .join('');

    this.redRowsEl.innerHTML = redHeroes
      .map(
        (h) => `
      <tr>
        <td><b>${h.name}</b></td>
        <td>${h.heroType.toUpperCase()}</td>
        <td>${h.kills}</td>
        <td>${h.deaths}</td>
        <td>${Math.round(h.damageDealt)}</td>
        <td>${h.isLocalPlayer ? '0ms' : '24ms'}</td>
      </tr>
    `
      )
      .join('');
  }
}
