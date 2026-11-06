<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>작은 게임을 한 문장으로 설명하면 — <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 대화의 사이드바에서 바로 플레이하고, AI 아트로 교체하고, HTML 파일 하나로 내보낼 수 있습니다.</strong><br />
  <sub>에이전트 도구 10개 &bull; 실시간 사이드바 미리보기 &bull; 2D 및 3D 복셀 템플릿 &bull; 비용을 먼저 확인하는 OpenAI 또는 Codex 아트 &bull; 자동 플레이 테스트 &bull; 버전 기록 &bull; 단일 파일 내보내기</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <b>한국어</b> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>패키지: <code>@zseven-w/dsh-game-studio</code> &middot; 현재 플러그인 릴리스: <code>0.1.0-rc.3</code> &middot; DSH <code>0.2.1-rc.5</code>로 테스트됨</sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — 한 문장, 하나의 플레이 가능한 게임" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Game Studio 사이드바에서 실행 중인 3D 게임과 적용 대기 중인 AI 아트 후보" width="100%" />
</p>
<p align="center"><sub>에이전트가 작업하는 동안 게임은 오른쪽 사이드바에서 실행되며, 번호가 매겨진 AI 아트 후보가 그 아래에서 선택을 기다립니다</sub></p>

## DSH Game Studio를 쓰는 이유

에이전트에게 일상적인 말로 게임을 요청하세요 — "3D 게임: 레서판다가 숲에서 대나무 순을 모으며 멧돼지를 피해요" — 그러면 템플릿에서 게임을 만들고, 제대로 작동하는지 확인하기 위해 직접 플레이한 뒤, 바로 플레이할 수 있는 사이드바에 보여줍니다. 캐릭터는 코드로 그린 모델로 시작합니다. 진짜 아트를 원할 때 에이전트가 OpenAI 또는 Codex 로그인으로 후보를 생성하고, 번호로 하나를 고르면 게임이 교체해 넣습니다. 모든 변경 사항은 되돌아갈 수 있는 버전으로 저장되며, 완성된 게임은 오프라인 HTML 파일 하나로 내보낼 수 있습니다.

| | |
| --- | --- |
| 🎮 **첫 답변부터 플레이 가능** | 두 가지 템플릿 — 2D 탑다운 게임과 3D 복셀 세계(three.js)에서 같은 루프를 구현한 템플릿 — 을 에이전트가 설명한 게임으로 다듬습니다: 캐릭터, 규칙, 레벨, 화면. |
| 🖥️ **실시간 사이드바 미리보기** | 게임이 대화 옆의 샌드박스 패널에서 실행되고, 변경할 때마다 다시 빌드되며, 그 아래에 아트 슬롯, 후보, 버전이 나열됩니다. 가로형 게임은 넓은 스테이지를 제공받습니다. |
| 🎨 **비용을 먼저 확인하는 나만의 아트** | `game_studio_generate_asset`가 OpenAI 이미지 API 또는 로컬 Codex CLI로 슬롯마다 번호가 붙은 후보를 만듭니다. 비용이 지출되기 전에 서비스, 이미지 수, 예상 비용이 담긴 승인 카드를 받습니다. 채팅에 첨부한 사진을 참고로 사용할 수 있습니다. |
| 🤖 **자동 플레이 테스트** | `game_studio_playtest`가 헤드리스 Chrome 또는 Edge에서 최신 코드를 플레이하고 단계, 점수, 프레임 레이트, 스크립트 오류, 스크린샷을 보고합니다. 방향키로 조작하지 않는 게임(그리드, 카드, 조준, 리듬…)은 `window.__autoplay`를 정의해서 플레이 테스트가 실제 루프를 플레이합니다. |
| 🕰️ **버전 기록** | 게임을 변경한 모든 빌드가 저장됩니다. `game_studio_restore_version`이 코드, 규칙, 아트를 한꺼번에 되돌립니다. |
| 📦 **단일 파일 내보내기** | `game_studio_export`가 네트워크 접근 없이 자립적인 HTML 파일 하나를 만듭니다 — 어떤 브라우저에서든 열거나 아무 정적 호스트에 올릴 수 있습니다. |
| 📱 **휴대폰에서 사용해 보기** | `game_studio_share`가 로컬 네트워크에 임시 읽기 전용 링크를 열고, 사이드바에 QR 코드를 보여줍니다. |
| 🗂️ **내 게임** | 오른쪽 사이드바의 **+** 에서 **Game Studio · My games**를 고르면, 워크스페이스의 게임이 최근 플레이테스트 화면을 표지로 한 타일로 펼쳐집니다. 2D/3D로 거르고 최근순·버전 수·이름순으로 정렬할 수 있으며, 클릭하면 바로 플레이합니다(agent·토큰 사용 없음). **Export wall**은 보이는 게임을 오프라인 페이지 하나로 묶어 친구에게 보낼 수 있게 합니다. |

## 이걸로 만든 게임

테스트하며 만든 게임 네 개입니다. 모두 새 세션에서 그림 아래 한 문장으로 시작했습니다(프롬프트는 중국어 번역). 일부는 같은 세션에서 나중에 수정을 요청했고, 표시해 두었습니다. 플레이 영상은 각 게임의 자체 오토플레이로 녹화했습니다.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="《달빛 여우: 등불 섬》 — 3D 복셀 템플릿, 실제 플레이" width="640" />
</p>
<p align="center"><sub>《달빛 여우: 등불 섬》 — 3D 복셀 템플릿, 실제 플레이</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="작은 게임을 만들어 줘: 아기 여우가 달빛 숲에서 등불을 모으고 가시 괴물을 피한다." width="100%" /><br /><sub>“작은 게임을 만들어 줘: 아기 여우가 달빛 숲에서 등불을 모으고 가시 괴물을 피한다.”<br />2D 템플릿, 캐릭터는 나중에 고른 AI 아트로 교체</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="3D 게임을 만들어 줘: 아기 여우가 복셀 섬에서 등불을 모으고 가시 괴물을 피한다." width="100%" /><br /><sub>“3D 게임을 만들어 줘: 아기 여우가 복셀 섬에서 등불을 모으고 가시 괴물을 피한다.”<br />3D 복셀 템플릿, 등불 모델은 이후 요청으로 다시 만듦</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="3D 게임을 만들어 줘: 아기 펭귄이 빙산에서 물고기를 모으고 물범을 피한다." width="100%" /><br /><sub>“3D 게임을 만들어 줘: 아기 펭귄이 빙산에서 물고기를 모으고 물범을 피한다.”<br />3D, 빨간 모자는 이후 요청으로 추가</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="3D 게임을 만들어 줘: 레서판다가 대나무 숲에서 죽순을 모으고 멧돼지를 피한다." width="100%" /><br /><sub>“3D 게임을 만들어 줘: 레서판다가 대나무 숲에서 죽순을 모으고 멧돼지를 피한다.”<br />3D, 캐릭터는 나중에 AI 아트로 교체, 숲은 그대로 3D</sub></td>
</tr>
</table>

## 어느 정도 잘 작동하나요

실제 DSH에서 DeepSeek-V4.1-Flash로 측정했으며, 각 게임은 새 세션에서 한 문장으로 만들고 독립적인 플레이 테스트로 채점했습니다 (2026-11-04/05):

- **모으고 피하기 게임** (템플릿의 주력 분야): 서로 다른 요청 10개 중 10개가 첫 시도에서 플레이 가능했으며, 게임당 중앙값 약 14분이 걸렸습니다.
- **기타 장르** — 매치-3, 상자 밀기, 타워 디펜스, 농구, 플랫포머, 리듬, 레이싱, 카드 배틀, 농사, 카페 경영: 10개 모두 플레이 가능하게 나왔지만 중앙값 약 26분이 걸렸습니다. `__autoplay`, 커스텀 아트 슬롯, 가로형 지원을 추가한 뒤 그중 네 개를 다시 실행했더니 8–18분이 걸렸습니다. 표본은 작습니다.

## 도구

| 도구 | 기능 |
| --- | --- |
| `game_studio_create` | `collector` (2D) 또는 `voxel` (3D) 템플릿에서 플레이 가능한 게임을 만들고, 빌드하여 사이드바에 보여줍니다. 제목, 아트 스타일, `orientation`(세로 또는 가로), `slots` — 게임 고유의 아트 슬롯, 사용자의 언어로 이름 지정 — 을 받습니다. |
| `game_studio_build` | `game.json` 또는 `game.js`를 편집한 뒤 다시 빌드하고, 미리보기를 새로 고치고, 짧은 메모와 함께 버전을 저장합니다. |
| `game_studio_playtest` | 최신 코드를 헤드리스로 플레이하고(휴대폰 모양 세로 또는 960×540 가로) 단계, 최고 점수, 하트, fps, 오류, 스크린샷을 보고합니다. `characters: true`는 캐릭터의 클로즈업만 반환합니다. |
| `game_studio_generate_asset` | 하나의 슬롯에 `openai` 또는 `codex`로 후보 이미지 1–4개를 생성하며, 선택적으로 참고 사진을 따라갑니다. 지출 전에 승인을 요청합니다. Codex는 백그라운드에서 실행됩니다. |
| `game_studio_apply_asset` | 번호로 후보를 게임에 적용하고, 다시 빌드하고 새로 고칩니다. |
| `game_studio_revert_asset` | 슬롯의 이전 아트로 되돌립니다. |
| `game_studio_versions` | 저장된 버전을 최신순으로 나열합니다. |
| `game_studio_restore_version` | 게임 전체의 이전 버전을 복원합니다. |
| `game_studio_export` | 자립적이고 오프라인인 HTML 파일 하나로 내보냅니다. |
| `game_studio_share` | 휴대폰에서 게임을 플레이할 수 있도록 로컬 네트워크에 임시 읽기 전용 링크를 열거나 닫습니다. |
| `game_studio_list` | 워크스페이스의 게임을 제목·2D/3D·빌드 여부·버전 수와 함께 나열해, agent가 "그 펭귄 게임"을 이름으로 찾게 합니다. |
| `game_studio_export_wall` | 게임 월 내보내기: 빌드된 게임마다 타일 하나씩 있는 오프라인 HTML 페이지. 타일을 클릭하면 플레이합니다. |

사이드바의 버튼(적용, 되돌리기, 빌드, 내보내기, 복원, 공유)은 `/game-studio` 명령을 통해 같은 작업을 수행합니다.

## 이미지 서비스와 지출

| 서비스 | 필요한 것 | 비용 | 참고 |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | DSH 자격 증명 또는 환경 변수의 API 키 (기본값 `OPENAI_API_KEY`) | 이미지당 사용자의 키로 청구됩니다. 승인 카드에 추정치가 표시됩니다 | 배치당 약 1분. `openaiBaseUrl`은 OpenAI 호환 게이트웨이를 허용합니다. |
| **Codex CLI** | Codex 설치 및 로그인 (`codex login`) | Codex 플랜 사용량에 포함됩니다. API 키 불필요 | 이미지당 몇 분 걸리며, 백그라운드에서 실행되다 완료되면 보고합니다. |

`imageProvider: auto` (기본값)은 키가 설정되어 있으면 OpenAI를, 그렇지 않으면 Codex를 사용합니다. `confirmSpending`이 켜져 있으면(기본값) 카드를 승인하기 전까지 아무것도 생성되지 않습니다. 스프라이트는 제공되기 전에 투명 배경과 프레이밍을 검사받고 슬롯에 맞게 조정됩니다.

## 보안과 프라이버시

- 게임은 네트워크 접근을 차단하는 콘텐츠 보안 정책이 적용된 샌드박스 iframe에서 실행됩니다. 내보낸 파일은 네트워크 요청을 하지 않습니다.
- 컴퓨터 밖으로 전송되는 것은 프롬프트와 (제공하는 경우) 참고 사진뿐이며, 사용자가 선택한 이미지 서비스로 전송됩니다.
- 공유 링크는 읽기 전용이며 해당 게임의 빌드만 제공하고, 로컬 네트워크에서만 수신하며, 설정한 시간 후 닫힙니다 (기본 30분).
- API 키는 DSH 자격 증명 또는 환경에서 읽히며 프로젝트, 로그, 도구 결과에 절대 기록되지 않습니다.

## 요구 사항

- DeepSeek Harness `0.2.1` 이상 (웹 또는 데스크톱), Node.js `24.11` 이상.
- 플레이 테스트를 위해 같은 컴퓨터에 설치된 Google Chrome 또는 Microsoft Edge.
- AI 아트를 위해서는 OpenAI API 키 또는 로그인된 Codex CLI 중 하나가 필요합니다. 둘 다 없어도 게임은 코드로 그린 캐릭터로 작동합니다.

## DSH에 설치

npm에서 DSH 프로필로 설치하세요:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## 빠른 시작

워크스페이스 폴더에서 세션을 열고 다음과 같이 요청해 보세요:

- `작은 게임 만들어 줘: 새끼 고양이가 주방에서 로봇 청소기에 부딪히지 않으면서 말린 생선을 훔쳐야 해.`
- `3D 게임 만들어 줘: 꼬마 기사가 성에서 동전을 모으며 해골을 피해 다녀. 60초 안에 동전 20개를 모으면 승리야.`
- `6×6 격자의 매치-3 게임 만들어 줘. 60초 안에 1000점에 도달하면 이겨.`

그런 다음 이렇게 해 보세요:

- `AI로 주인공의 새 아트 2개를 만들어 줘. 사이드바에서 고를게.`
- `주인공의 모습은 내가 첨부한 사진을 따라 줘.`
- `HTML 파일 하나로 내보내 줘.`

## 설정

프로필의 `cordis.patch.yml`에 있는 `config` 아래에 다음을 설정하세요:

| 옵션 | 기본값 | 의미 |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` 또는 `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | OpenAI 이미지 모델. 결과를 비교 가능하게 유지하려면 고정하세요. |
| `openaiBaseUrl` | OpenAI | OpenAI 호환 기본 URL, 예: 회사 게이트웨이. |
| `openaiCredential` | `OPENAI_API_KEY` | 키를 담고 있는 자격 증명 또는 환경 변수의 이름. |
| `codexPath` | `PATH`에서 또는 로그인 셸을 통해 찾음 | Codex CLI 실행 파일. |
| `codexModel` | Codex의 기본값 | Codex 이미지 실행에 사용할 모델. |
| `codexReasoningEffort` | `low` | Codex 이미지 실행의 추론 강도. |
| `codexTimeoutMinutes` | `15` | 이 시간이 지나면 Codex 이미지 하나를 포기합니다. |
| `confirmSpending` | `true` | 매번 생성 전에 승인을 요청합니다. |

## 게임 프로젝트 형식

각 게임은 워크스페이스 안의 일반 폴더입니다:

- `game.json` — 제목, 아트 스타일, 방향, 아트 슬롯, 규칙. 규칙은 자유 형식입니다: 모든 키가 `window.GAME.rules`로 게임에 전달됩니다.
- `game.js` — 에이전트가 편집하는 게임 코드입니다. 플레이 테스트를 위한 `window.__gameState()`, 방향키로 조작하지 않는 게임을 위한 선택적 `window.__autoplay(state)`, 그리고 코드로 그린 캐릭터를 사이드바에 보여주기 위한 `window.__renderSlots(size)`를 노출합니다 (2D 템플릿은 `drawCharacter()`에서 그립니다).
- `assets/` — 각 슬롯의 그림과 각 그림의 출처를 기록한 `ASSETS.json`. 슬롯의 파일에 직접 그릴 수도 있습니다. 스튜디오가 사용자의 편집으로 기록합니다.
- `dist/index.html` — 현재 빌드. `.studio/`에는 버전, 후보, 플레이 테스트 실행 기록이 보관됩니다.

## 개발

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## 생태계

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / Codex에서 DSH 에이전트로 작업 전달
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — 대화 안에서 실시간 iOS 시뮬레이터 또는 USB 연결 iPhone
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 대화 안에서 실시간 Android 에뮬레이터 또는 USB 기기
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH를 위한 장기 기억
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 대화 안에서 `.op` 디자인 문서 조회 및 편집

## 크레딧 &amp; 라이선스

- [three.js](https://github.com/mrdoob/three.js) — 복셀 게임에 번들되는 3D 런타임 (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — 사이드바 공유 패널의 QR 코드 (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — 플레이 테스트를 위해 브라우저를 구동 (Apache-2.0; 런타임 의존성).
- 템플릿, 스프라이트, 복셀 모델은 이 프로젝트의 오리지널입니다.
- 전체 고지 사항은 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)를 참고하세요.

**라이선스**: MIT
