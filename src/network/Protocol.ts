import { HeroType, Team } from '../heroes/HeroBase';
import { ControlState } from '../world/ControlPoint';

export type PacketType =
  | 'HANDSHAKE'
  | 'INIT_STATE'
  | 'PLAYER_UPDATE'
  | 'ACTION_EVENT'
  | 'DAMAGE_EVENT'
  | 'OBJECTIVE_SYNC'
  | 'HERO_CHANGE'
  | 'CHAT_MESSAGE';

export interface HandshakePacket {
  type: 'HANDSHAKE';
  playerId: string;
  playerName: string;
  heroType: HeroType;
  team: Team;
}

export interface PlayerNetState {
  id: string;
  name: string;
  heroType: HeroType;
  team: Team;
  x: number;
  y: number;
  z: number;
  rotY: number;
  health: number;
  shield: number;
  isAlive: boolean;
  kills: number;
  deaths: number;
}

export interface InitStatePacket {
  type: 'INIT_STATE';
  hostId: string;
  players: PlayerNetState[];
  blueScore: number;
  redScore: number;
  controlState: ControlState;
  captureProgress: number;
}

export interface PlayerUpdatePacket {
  type: 'PLAYER_UPDATE';
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  health: number;
  shield: number;
  isAlive: boolean;
}

export interface ActionEventPacket {
  type: 'ACTION_EVENT';
  playerId: string;
  action: 'fire_primary' | 'fire_secondary' | 'ability_shift' | 'ability_e' | 'ultimate';
  dirX: number;
  dirY: number;
  dirZ: number;
  posX: number;
  posY: number;
  posZ: number;
}

export interface DamageEventPacket {
  type: 'DAMAGE_EVENT';
  attackerId: string;
  victimId: string;
  damage: number;
  isHeadshot: boolean;
  killed: boolean;
}

export interface ObjectiveSyncPacket {
  type: 'OBJECTIVE_SYNC';
  blueScore: number;
  redScore: number;
  state: ControlState;
  captureProgress: number;
  isContested: boolean;
}

export interface HeroChangePacket {
  type: 'HERO_CHANGE';
  playerId: string;
  newHero: HeroType;
}

export type GamePacket =
  | HandshakePacket
  | InitStatePacket
  | PlayerUpdatePacket
  | ActionEventPacket
  | DamageEventPacket
  | ObjectiveSyncPacket
  | HeroChangePacket;
