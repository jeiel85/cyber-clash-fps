import { HeroType } from '../heroes/HeroBase';

export class HeroSelectModal {
  private modalEl: HTMLElement;
  private cards: NodeListOf<HTMLElement>;
  private confirmBtn: HTMLElement;
  private selectedHero: HeroType = 'striker';
  private onConfirmCallback: ((hero: HeroType) => void) | null = null;

  constructor() {
    this.modalEl = document.getElementById('hero-select-modal')!;
    this.cards = document.querySelectorAll('.hero-card');
    this.confirmBtn = document.getElementById('confirm-hero-btn')!;

    this.setupEvents();
  }

  private setupEvents(): void {
    this.cards.forEach((card) => {
      card.addEventListener('click', () => {
        this.cards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedHero = card.dataset.hero as HeroType;
      });
    });

    this.confirmBtn.addEventListener('click', () => {
      this.hide();
      if (this.onConfirmCallback) {
        this.onConfirmCallback(this.selectedHero);
      }
    });
  }

  public show(onConfirm: (hero: HeroType) => void): void {
    this.onConfirmCallback = onConfirm;
    this.modalEl.classList.remove('hidden');
  }

  public hide(): void {
    this.modalEl.classList.add('hidden');
  }

  public isVisible(): boolean {
    return !this.modalEl.classList.contains('hidden');
  }
}
