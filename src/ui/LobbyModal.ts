import { NetworkManager } from '../network/NetworkManager';

export interface MatchStartOptions {
  mode: 'quick' | 'solo' | 'host' | 'join';
  roomCode: string;
  autoFillBots: boolean;
}

export class LobbyModal {
  private modalEl: HTMLElement;
  private tabs: NodeListOf<HTMLElement>;
  private tabContents: NodeListOf<HTMLElement>;

  private quickPlayBtn: HTMLElement;
  private soloBotBtn: HTMLElement;
  private startBtn: HTMLElement;

  private peerIdDisplay: HTMLElement;
  private hostRoomInput: HTMLInputElement;
  private joinRoomInput: HTMLInputElement;
  private createRoomBtn: HTMLElement;
  private copyLinkBtn: HTMLElement;
  private joinRoomBtn: HTMLElement;
  private autoFillBotsCheckbox: HTMLInputElement;

  private network: NetworkManager;
  private onStartCallback: ((options: MatchStartOptions) => void) | null = null;

  constructor(network: NetworkManager) {
    this.network = network;
    this.modalEl = document.getElementById('menu-modal')!;
    this.tabs = document.querySelectorAll('.tab-item');
    this.tabContents = document.querySelectorAll('.tab-content');

    this.quickPlayBtn = document.getElementById('btn-quick-play')!;
    this.soloBotBtn = document.getElementById('btn-solo-bot')!;
    this.startBtn = document.getElementById('start-game-btn')!;

    this.peerIdDisplay = document.getElementById('peer-id-display')!;
    this.hostRoomInput = document.getElementById('host-room-input') as HTMLInputElement;
    this.joinRoomInput = document.getElementById('join-room-input') as HTMLInputElement;
    this.createRoomBtn = document.getElementById('btn-create-room')!;
    this.copyLinkBtn = document.getElementById('btn-copy-link')!;
    this.joinRoomBtn = document.getElementById('btn-join-room')!;
    this.autoFillBotsCheckbox = document.getElementById('auto-fill-bots') as HTMLInputElement;

    this.setupEvents();
    this.checkUrlRoomParam();
  }

  private setupEvents(): void {
    // Tab switching
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.tabs.forEach((t) => t.classList.remove('active'));
        this.tabContents.forEach((c) => c.classList.add('hidden'));

        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        const targetContent = document.getElementById(`tab-${tabName}`);
        if (targetContent) {
          targetContent.classList.remove('hidden');
        }
      });
    });

    // Quick Play
    this.quickPlayBtn.addEventListener('click', () => {
      this.launchMatch({
        mode: 'quick',
        roomCode: 'cyber-clash-open',
        autoFillBots: true,
      });
    });

    // Solo Bots
    this.soloBotBtn.addEventListener('click', () => {
      this.launchMatch({
        mode: 'solo',
        roomCode: 'solo-practice',
        autoFillBots: true,
      });
    });

    // Start Game Bottom Button
    this.startBtn.addEventListener('click', () => {
      this.launchMatch({
        mode: 'quick',
        roomCode: 'cyber-clash-open',
        autoFillBots: this.autoFillBotsCheckbox.checked,
      });
    });

    // New Room button
    this.createRoomBtn.addEventListener('click', () => {
      const code = `room-${Math.random().toString(36).substring(2, 7)}`;
      this.hostRoomInput.value = code;
    });

    // Copy Link button
    this.copyLinkBtn.addEventListener('click', () => {
      const code = this.hostRoomInput.value || `room-${Math.random().toString(36).substring(2, 7)}`;
      this.hostRoomInput.value = code;
      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      navigator.clipboard.writeText(url.toString()).then(() => {
        alert(`초대 링크가 복사되었습니다!\n${url.toString()}`);
      });
    });

    // Join Room button
    this.joinRoomBtn.addEventListener('click', () => {
      const code = this.joinRoomInput.value.trim();
      if (!code) {
        alert('방 코드를 입력해주세요!');
        return;
      }
      this.launchMatch({
        mode: 'join',
        roomCode: code,
        autoFillBots: this.autoFillBotsCheckbox.checked,
      });
    });
  }

  private checkUrlRoomParam(): void {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      this.joinRoomInput.value = room;
      // Auto switch to multiplayer tab
      const mpTab = document.querySelector('[data-tab="multiplayer"]') as HTMLElement;
      if (mpTab) mpTab.click();
    }
  }

  public updatePeerInfo(peerId: string): void {
    this.peerIdDisplay.textContent = peerId;
    if (!this.hostRoomInput.value) {
      this.hostRoomInput.value = `cyber-${peerId.substring(0, 6)}`;
    }
  }

  public show(onStart: (options: MatchStartOptions) => void): void {
    this.onStartCallback = onStart;
    this.modalEl.classList.remove('hidden');
  }

  public hide(): void {
    this.modalEl.classList.add('hidden');
  }

  private launchMatch(options: MatchStartOptions): void {
    this.hide();
    if (this.onStartCallback) {
      this.onStartCallback(options);
    }
  }
}
