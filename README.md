# ⚡ CYBER CLASH: 3D HERO FPS

> **오버워치 스타일의 영웅 선택 시스템과 서버리스 P2P(WebRTC) 멀티플레이, AI 봇 대전을 탑재한 웹 기반 3D FPS 게임**

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-00f0ff?style=for-the-badge&logo=github)](https://jeiel85.github.io/cyber-clash-fps/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![WebRTC PeerJS](https://img.shields.io/badge/WebRTC-PeerJS-ff5500?style=for-the-badge)](https://peerjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

---

## 🎮 라이브 데모 (Live Demo)
👉 **[게임 플레이하기 (Live Demo)](https://jeiel85.github.io/cyber-clash-fps/)**

---

## ✨ 핵심 특징 (Key Features)

### 1. 👥 4종의 고유한 오버워치 스타일 영웅
각 영웅은 고유한 역할(DPS, TANK, SNIPER, SUPPORT), 주 무기, 보조 스킬(우클릭), 이동기(Shift), 전술 스킬(E), 그리고 전세를 역전시키는 궁극기(Q)를 보유하고 있습니다.

| 영웅 | 역할 | 체력 / 방벽 | 주 무기 | 우클릭 보조 | 이동기 [SHIFT] | 전술기 [E] | 궁극기 [Q] |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **STRIKER** | 딜러 (DPS) | 200 HP | 펄스 라이플 (25발) | 나선 로켓 (Helix) | 전술 질주 (Sprint) | 생체장 (힐 장판) | **전술 조준경** (오토에임) |
| **VANGUARD** | 탱커 (TANK) | 300 HP + 200 Shield | 플라즈마 산탄총 | 에너지 방벽 전개 | 부스터 돌진 (Charge) | 지진 강타 (Slam) | **오버차지** (방어막 & 전기 폭풍) |
| **SPECTER** | 저격 (SNIPER) | 175 HP | 입자 기관단총 | 레일건 저격 줌 (2.5x 헤드샷) | 위상 도약 (Blink) | 맹독 지뢰 (Mine) | **적외선 투시경** (전원 감지) |
| **REMEDY** | 지원 (SUPPORT) | 200 HP (자가 재생) | 치유/공격 블래스터 | 생체 치유 오브 | 천사의 날개 (Glide) | 재생 드론 (AoE 힐) | **발키리 각성** (자유 비행 & 광역 버프) |

---

### 2. 🌐 서버리스 P2P 멀티플레이어 (WebRTC DataChannel)
- **백엔드 서버 비용 0원**: 중앙 전용 서버 없이, 브라우저와 브라우저가 직접 WebRTC DataChannels(PeerJS)로 연결되는 **Host-Client P2P** 구조입니다.
- **방 생성 및 공유**:
  - 원클릭으로 초대 링크(`?room=XYZ`)를 생성하여 친구에게 전송 가능.
  - "빠른 대전(Quick Match)" 클릭 시 공용 로비에 자동 접속하거나 새 방을 즉시 호스팅.
- **클라이언트 동기화 (30Hz)**:
  - 호스트 피어가 맵 오브젝트, 거점 점령 상태, 봇 인공지능을 authoritative하게 계산하고 참가자들에게 실시간 브로드캐스트.

---

### 3. 🤖 AI 봇 자동 매칭 시스템 (Solo & Opponent Fallback)
- **상대가 없어도 즉시 플레이 가능!**
- 혼자 접속하거나 대기 중인 경우, 빈자리를 자동으로 똑똑한 **AI 봇들이 3v3 매치업으로 채워줍니다.**
- 봇들은 각자의 영웅 스킬(방벽 전개, 힐링, 로켓 발사, 저격 후퇴 등)을 사용하며, 체력이 낮아지면 맵의 힐팩을 스스로 찾아 회복합니다.
- 다른 플레이어가 방에 접속하면 봇 슬롯과 원활하게 전환됩니다.

---

### 4. 🏟️ 사이버네틱 아레나 & 거점 점령 모드
- **점령전 (Control Point)**: 중앙의 네오링크 거점에 진입하여 점령 게이지를 100% 채우는 팀이 승리합니다.
- **점프 패드 (Jump Pads)**: 밟으면 순식간에 공중으로 높이 솟구쳐 고지대 저격 포인트로 진입 가능.
- **3D 힐팩 스테이션**: 메가 힐팩(+250 HP), 미니 힐팩(+75 HP)이 주기적으로 재생성되어 전략적 교전 지원.
- **절차적 사운드 신시사이저 (Web Audio API)**:
  - 총기 격발음, 오버워치 특유의 경쾌한 헤드샷 "팅" 사운드, 킬 확인 차임, 궁극기 가동음 등 100% 인라인 생성(외부 오디오 파일 로딩 실패 위험 없음).

---

## 🕹️ 조작법 (Controls)

- **W, A, S, D**: 전후좌우 이동
- **마우스 이동**: 시선 회전 (Pointer Lock)
- **마우스 좌클릭 (LMB)**: 주 무기 발사
- **마우스 우클릭 (RMB)**: 보조 무기 / 스킬 (저격 줌, 에너지 방벽 토글, 힐 오브 등)
- **SPACE**: 점프 (점프 패드 탑승 시 슈퍼 도약)
- **SHIFT**: 이동 스킬 1 (질주 / 돌진 / 점멸 / 비행)
- **E**: 전술 스킬 2 (생체장 / 지진 강타 / 지뢰 / 힐 드론)
- **Q**: 궁극기 (100% 충전 시 발동)
- **R**: 재장전
- **H**: 영웅 변경 화면 열기
- **TAB**: 스코어보드 확인 (킬, 데스, 딜량, 핑)
- **ESC**: 일시 정지 및 메뉴

---

## 🛠️ 로컬 실행 방법 (Local Development)

```bash
# 1. 레포지토리 클론
git clone https://github.com/jeiel85/cyber-clash-fps.git
cd cyber-clash-fps

# 2. 의존성 설치
npm install

# 3. 로컬 개발 서버 실행
npm run dev

# 4. 프로덕션 빌드
npm run build
```

---

## 📁 프로젝트 구조

```
├── .github/workflows/deploy.yml  # GitHub Pages 자동 배포
├── index.html                    # 게임 캔버스 및 HUD 마크업
├── package.json
├── vite.config.ts
├── src/
│   ├── main.ts                   # 게임 메인 루프 및 상태 통합
│   ├── audio/
│   │   └── SoundManager.ts       # Web Audio API 절차적 사운드 생성
│   ├── core/
│   │   ├── Engine.ts             # Three.js 씬/카메라/조명/렌더러
│   │   ├── InputManager.ts       # 키보드/마우스/포인터락 처리
│   │   └── Physics.ts            # 충돌 박스, 점프 패드, 투사체 물리
│   ├── heroes/
│   │   ├── HeroBase.ts           # 영웅 추상 클래스
│   │   ├── Striker.ts            # 공격형 군인 (Soldier: 76 스타일)
│   │   ├── Vanguard.ts           # 중장갑 돌격형 탱커 (Reinhardt 스타일)
│   │   ├── Specter.ts            # 저격/암살형 (Widowmaker 스타일)
│   │   └── Remedy.ts             # 치유/지원형 (Mercy 스타일)
│   ├── ai/
│   │   └── BotController.ts      # 길찾기, 힐팩 탐색, 전투 AI
│   ├── world/
│   │   ├── ArenaMap.ts           # 사이버네틱 3D 경기장 생성
│   │   ├── ControlPoint.ts       # 거점 점령 로직
│   │   └── Pickups.ts            # 3D 회전 힐팩
│   ├── network/
│   │   ├── NetworkManager.ts     # PeerJS P2P WebRTC 연결 관리
│   │   └── Protocol.ts           # 패킷 데이터 정의
│   ├── ui/
│   │   ├── HUD.ts                # 체력바, 스킬 쿨타임, 궁극기 게이지, 킬로그
│   │   ├── HeroSelectModal.ts    # 영웅 선택창
│   │   ├── Scoreboard.ts         # Tab 스코어보드
│   │   └── LobbyModal.ts         # 방 생성/참가/링크 복사
│   └── style.css                 # 미래형 오버워치 스타일 CSS
```

---

## 📜 라이선스 (License)
MIT License. 자유롭게 플레이하고 포크하세요!
