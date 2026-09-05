import { Peer, DataConnection } from 'peerjs';
import { GamePacket, HandshakePacket, PlayerUpdatePacket } from './Protocol';

export type NetworkRole = 'host' | 'client' | 'solo';

export class NetworkManager {
  public peer: Peer | null = null;
  public role: NetworkRole = 'solo';
  public myPeerId: string = '';
  public roomCode: string = '';
  public hostConnection: DataConnection | null = null;
  public clientConnections: Map<string, DataConnection> = new Map();

  private onPacketCallbacks: ((packet: GamePacket, senderId: string) => void)[] = [];
  private onPeerConnectCallbacks: ((peerId: string) => void)[] = [];
  private onPeerDisconnectCallbacks: ((peerId: string) => void)[] = [];

  constructor() {}

  public init(customId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create Peer with random ID or custom ID
      const peerOptions = {
        debug: 1,
      };

      this.peer = customId ? new Peer(customId, peerOptions) : new Peer(peerOptions);

      this.peer.on('open', (id: string) => {
        this.myPeerId = id;
        console.log('P2P Peer opened with ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn: DataConnection) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.warn('PeerJS error:', err);
        // Fallback or reject
        if (err.type === 'unavailable-id') {
          // Retry with random ID
          this.init().then(resolve).catch(reject);
        } else {
          resolve(this.myPeerId || 'offline');
        }
      });
    });
  }

  // Host a room
  public hostRoom(roomCode: string): void {
    this.role = 'host';
    this.roomCode = roomCode;
  }

  // Join a room as client
  public joinRoom(hostRoomCode: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.peer) {
        resolve(false);
        return;
      }

      this.role = 'client';
      this.roomCode = hostRoomCode;
      console.log(`Connecting to host: ${hostRoomCode}`);

      const conn = this.peer.connect(hostRoomCode, {
        reliable: false, // UDP-like speed for fast FPS state
      });

      conn.on('open', () => {
        console.log('Connected to host peer!');
        this.hostConnection = conn;
        this.setupConnectionListeners(conn);
        resolve(true);
      });

      conn.on('error', (err) => {
        console.warn('Failed to connect to host:', err);
        resolve(false);
      });

      // Timeout fallback
      setTimeout(() => {
        if (!this.hostConnection) {
          resolve(false);
        }
      }, 6000);
    });
  }

  private handleIncomingConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log('Peer connected to us:', conn.peer);
      this.clientConnections.set(conn.peer, conn);
      this.setupConnectionListeners(conn);

      for (const cb of this.onPeerConnectCallbacks) {
        cb(conn.peer);
      }
    });
  }

  private setupConnectionListeners(conn: DataConnection): void {
    conn.on('data', (data: any) => {
      try {
        const packet = data as GamePacket;
        for (const cb of this.onPacketCallbacks) {
          cb(packet, conn.peer);
        }
      } catch (e) {
        console.warn('Failed to parse incoming packet:', e);
      }
    });

    conn.on('close', () => {
      console.log('Peer disconnected:', conn.peer);
      this.clientConnections.delete(conn.peer);
      if (this.hostConnection === conn) {
        this.hostConnection = null;
      }
      for (const cb of this.onPeerDisconnectCallbacks) {
        cb(conn.peer);
      }
    });
  }

  // Send packet to specific connection or broadcast
  public send(packet: GamePacket): void {
    if (this.role === 'client' && this.hostConnection) {
      if (this.hostConnection.open) {
        this.hostConnection.send(packet);
      }
    } else if (this.role === 'host') {
      this.broadcast(packet);
    }
  }

  public broadcast(packet: GamePacket, exceptPeerId?: string): void {
    for (const [peerId, conn] of this.clientConnections.entries()) {
      if (peerId !== exceptPeerId && conn.open) {
        conn.send(packet);
      }
    }
  }

  public onPacket(callback: (packet: GamePacket, senderId: string) => void): void {
    this.onPacketCallbacks.push(callback);
  }

  public onPeerConnect(callback: (peerId: string) => void): void {
    this.onPeerConnectCallbacks.push(callback);
  }

  public onPeerDisconnect(callback: (peerId: string) => void): void {
    this.onPeerDisconnectCallbacks.push(callback);
  }

  public getConnectedCount(): number {
    return this.clientConnections.size + (this.hostConnection ? 1 : 0);
  }
}
