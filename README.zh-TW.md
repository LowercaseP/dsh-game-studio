<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>用一句話描述一款小遊戲——在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 對話的側邊欄裡玩它、換上 AI 美術圖、匯出單一 HTML 檔案。</strong><br />
  <sub>10 個代理工具 &bull; 即時側邊欄預覽 &bull; 2D 與 3D 體素範本 &bull; OpenAI 或 Codex 美術圖，產生前先確認費用 &bull; 自動試玩測試 &bull; 版本歷史 &bull; 單檔匯出</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <b>繁體中文</b> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>套件：<code>@zseven-w/dsh-game-studio</code> &middot; 目前的外掛版本：<code>0.1.0-rc.3</code> &middot; 已在 DSH <code>0.2.1-rc.5</code> 下測試</sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — 一句話，一款可玩的遊戲" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="在 Game Studio 側邊欄中執行的 3D 遊戲，AI 候選美術圖已準備好可套用" width="100%" />
</p>
<p align="center"><sub>代理程式工作時，遊戲就在右側側邊欄中執行；編號的 AI 候選美術圖在下方等你挑選</sub></p>

## 為什麼選擇 DSH Game Studio

用平常的話向代理程式要一款遊戲——「一款 3D 遊戲：一隻小貓熊在森林裡收集竹筍、閃避野豬」——它就會從範本打造一款，實際玩一遍確認可以運作，並顯示在側邊欄讓你立刻上手。角色一開始是以程式繪製的模型；當你想要真正的美術圖時，代理程式會用 OpenAI 或你的 Codex 登入產生候選圖，你依編號挑選一張，遊戲就會把它換上。每次修改都是一個可以回頭的版本，完成的遊戲可匯出為單一離線 HTML 檔案。

| | |
| --- | --- |
| 🎮 **第一個回答就能玩** | 兩款範本——一款 2D 俯視角遊戲，以及同一套迴圈放進 3D 體素世界（three.js）——代理程式會把它改造成你描述的遊戲：角色、規則、關卡、畫面。 |
| 🖥️ **即時側邊欄預覽** | 遊戲在對話旁的沙箱面板中執行，每次變更都會重新建置，並在下方列出美術槽位、候選圖與版本。橫向遊戲會獲得寬廣的舞台。 |
| 🎨 **自己的美術圖，產生前先確認費用** | `game_studio_generate_asset` 會用 OpenAI 影像 API 或本機的 Codex CLI，為每個槽位產生編號候選圖。在任何費用發生前，你會收到一張核准卡片，上頭列出服務、圖片數量與預估費用。你在聊天中附加的圖片可以作為參考圖。 |
| 🤖 **自動試玩測試** | `game_studio_playtest` 會在無頭模式的 Chrome 或 Edge 中遊玩最新程式碼，並回報階段、分數、幀率、腳本錯誤與截圖。不用方向鍵操作的遊戲（網格、卡牌、瞄準、節奏等）會定義 `window.__autoplay`，讓試玩測試真正去玩它的核心迴圈。 |
| 🕰️ **版本歷史** | 每個改變遊戲的建置都會被保存；`game_studio_restore_version` 會把程式碼、規則與美術圖一起帶回來。 |
| 📦 **單檔匯出** | `game_studio_export` 會寫出一個自包含、不需網路的 HTML 檔案——用任何瀏覽器開啟，或放到任何靜態網頁空間。 |
| 📱 **在手機上試玩** | `game_studio_share` 會在你的區域網路上開啟一條臨時的唯讀連結，並在側邊欄顯示 QR Code。 |
| 🗂️ **遊戲牆** | 點右欄的 **+**，選 **游戏工坊 · 游戏墙**（介面為簡體中文或英文 **Game Studio · My games**）：工作區裡做過的遊戲鋪滿一面牆，封面是最近一次試玩的畫面，可按 2D/3D 篩選，按最近修改、版本數或名稱排序。點一下就能玩，不經過 agent，也不花 token。**导出游戏墙**（Export wall）會把牆上的遊戲打包成一個離線網頁，傳給朋友就能玩。 |

## 用它做出來的遊戲

以下是實測中做出的四個遊戲。每個都是在新會話裡用圖下那一句話開始的；有幾個後來在同一會話裡又提了修改，已註明。遊戲畫面以遊戲內建的自動駕駛錄製。

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="《月光狐狸：燈籠島》——3D 體素模板，實機畫面" width="640" />
</p>
<p align="center"><sub>《月光狐狸：燈籠島》——3D 體素模板，實機畫面</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="做一個小遊戲：小狐狸在月光森林裡收集燈籠，躲開荊棘怪。" width="100%" /><br /><sub>「做一個小遊戲：小狐狸在月光森林裡收集燈籠，躲開荊棘怪。」<br />2D 模板；角色後來換成挑選的 AI 美術</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="做一個 3D 小遊戲：小狐狸在體素小島上收集燈籠，躲開荊棘怪。" width="100%" /><br /><sub>「做一個 3D 小遊戲：小狐狸在體素小島上收集燈籠，躲開荊棘怪。」<br />3D 體素模板；燈籠模型在後續請求中重做過</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="做一個 3D 小遊戲：小企鵝在冰山上收集小魚，躲開海豹。" width="100%" /><br /><sub>「做一個 3D 小遊戲：小企鵝在冰山上收集小魚，躲開海豹。」<br />3D；紅帽子是後續請求加的</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="做一個 3D 小遊戲：小熊貓在竹林裡收集竹筍，躲開野豬。" width="100%" /><br /><sub>「做一個 3D 小遊戲：小熊貓在竹林裡收集竹筍，躲開野豬。」<br />3D；角色後來換成 AI 美術，竹林仍是 3D</sub></td>
</tr>
</table>

## 實際效果如何

在真實的 DSH 中以 DeepSeek-V4.1-Flash 實測，每款遊戲都在全新工作階段中從一句話製作，並由獨立試玩測試評分（2026-11-04/05）：

- **收集與閃避類遊戲**（範本的主場）：10 個不同的需求中，10 個都第一次就能玩，每款遊戲中位數約 14 分鐘。
- **其他類型**——三消、推箱子、塔防、籃球、平台跳躍、節奏、競速、卡牌對戰、農場經營、咖啡廳經營：10 款全部都能玩，但所耗時間中位數約 26 分鐘。加入 `__autoplay`、自訂美術槽位與橫向支援後，其中四款重新測試，耗時 8–18 分鐘。樣本數不大。

## 工具

| 工具 | 功能 |
| --- | --- |
| `game_studio_create` | 從 `collector`（2D）或 `voxel`（3D）範本建立一款可玩的遊戲，建置並顯示在側邊欄。接受標題、美術風格、`orientation`（直向或橫向）以及 `slots`——遊戲自己的美術槽位，以使用者的語言命名。 |
| `game_studio_build` | 編輯 `game.json` 或 `game.js` 後重新建置、重新整理預覽，並附上簡短備註儲存一個版本。 |
| `game_studio_playtest` | 以無頭方式遊玩最新程式碼（手機外型的直向或 960×540 橫向），回報階段、最高分、愛心、fps、錯誤與截圖；`characters: true` 只回傳角色的特寫。 |
| `game_studio_generate_asset` | 用 `openai` 或 `codex` 為一個槽位產生 1–4 張候選圖片，可選擇跟隨一張參考圖。花費前會先徵求核准。Codex 會在背景執行。 |
| `game_studio_apply_asset` | 依編號把候選圖放進遊戲，重新建置並重新整理。 |
| `game_studio_revert_asset` | 回到某個槽位先前的美術圖。 |
| `game_studio_versions` | 列出已儲存的版本，最新在前。 |
| `game_studio_restore_version` | 回復整個遊戲的較早版本。 |
| `game_studio_export` | 匯出一個自包含的離線 HTML 檔案。 |
| `game_studio_share` | 在區域網路上開啟（或關閉）一條臨時的唯讀連結，讓手機可以遊玩這款遊戲。 |
| `game_studio_list` | 列出工作區裡的遊戲（標題、2D/3D、是否已建置、版本數），agent 能按名字找到「那個企鵝遊戲」。 |
| `game_studio_export_wall` | 匯出遊戲牆：一個離線 HTML 頁面，每個已建置的遊戲一格，點格子就能玩。 |

側邊欄的按鈕（套用、還原、建置、匯出、回復、分享）透過 `/game-studio` 指令呼叫相同的操作。

## 圖像服務與費用

| 服務 | 需要條件 | 費用 | 備註 |
| --- | --- | --- | --- |
| **OpenAI**（GPT Image） | 存放於 DSH 憑證或環境中的 API 金鑰（預設為 `OPENAI_API_KEY`） | 依每張圖向你的金鑰計費；核准卡片會顯示預估費用 | 每批次約 1 分鐘。`openaiBaseUrl` 可接受與 OpenAI 相容的閘道。 |
| **Codex CLI** | 已安裝並登入的 Codex（`codex login`） | 計入你的 Codex 方案用量；無需 API 金鑰 | 每張圖需數分鐘，在背景執行並於完成後回報。 |

`imageProvider: auto`（預設值）在設有 OpenAI 金鑰時使用 OpenAI，否則使用 Codex。開啟 `confirmSpending`（預設值）時，在你核准卡片之前不會產生任何圖片。精靈圖在提供之前，會先檢查透明背景與構圖，並調整成符合槽位的大小。

## 安全與隱私

- 遊戲在沙箱化的 iframe 中執行，並以內容安全政策阻擋網路存取；匯出的檔案不會發出任何網路請求。
- 唯一會送出你機器的內容是提示詞——以及參考圖片（如果你提供的話）——傳給你選擇的圖像服務。
- 分享連結為唯讀，只提供該遊戲的建置，只監聽你的區域網路，並會在你設定的時間後關閉（預設 30 分鐘）。
- API 金鑰從 DSH 憑證或環境讀取，絕不會寫入專案、日誌或工具結果。

## 需求

- DeepSeek Harness `0.2.1` 或更新版本（網頁版或桌面版）、Node.js `24.11` 或更新版本。
- 同一臺電腦上的 Google Chrome 或 Microsoft Edge，供試玩測試使用。
- 若要 AI 美術圖，需要 OpenAI API 金鑰或已登入的 Codex CLI。兩者皆無時，遊戲仍可使用程式繪製的角色正常運作。

## 安裝到 DSH

從 npm 安裝到 DSH profile：

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## 快速開始

在工作區資料夾中開啟一個工作階段，然後像這樣問：

- `做一款小遊戲：一隻小貓在廚房裡偷小魚乾，但不能撞到掃地機器人。`
- `做一款 3D 遊戲：一位小騎士在城堡裡收集金幣並躲開骷髏；60 秒內收集 20 枚金幣即獲勝。`
- `做一款 6×6 網格上的三消遊戲；60 秒內達到 1000 分即獲勝。`

接著試試：

- `用 AI 為主角產生 2 張新美術圖；我到側邊欄裡挑選。`
- `主角的外觀就照我附加的圖片來做。`
- `把它匯出成單一 HTML 檔案。`

## 設定

在你的 profile 的 `cordis.patch.yml` 裡，於 `config` 之下設定這些選項：

| 選項 | 預設值 | 說明 |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`、`openai` 或 `codex`。 |
| `openaiModel` | `gpt-image-2.5-flare` | OpenAI 影像模型；將它固定，結果才有可比較性。 |
| `openaiBaseUrl` | OpenAI | 與 OpenAI 相容的基底 URL，例如公司閘道。 |
| `openaiCredential` | `OPENAI_API_KEY` | 持有金鑰的憑證或環境變數名稱。 |
| `codexPath` | 從 `PATH` 或透過登入 shell 找到 | Codex CLI 執行檔。 |
| `codexModel` | Codex 的預設值 | Codex 產生影像時使用的模型。 |
| `codexReasoningEffort` | `low` | Codex 產生影像時的推理程度。 |
| `codexTimeoutMinutes` | `15` | 超過這段時間即放棄一張 Codex 影像。 |
| `confirmSpending` | `true` | 每次產生前先徵求核准。 |

## 遊戲專案格式

每款遊戲都是你工作區中的一個普通資料夾：

- `game.json` — 標題、美術風格、畫面方向、美術槽位與規則。規則為自由格式：任何鍵都會以 `window.GAME.rules` 的形式傳給遊戲。
- `game.js` — 代理程式編輯的遊戲程式碼。它提供 `window.__gameState()` 供試玩測試使用、可選的 `window.__autoplay(state)` 供不用方向鍵操作的遊戲使用，以及 `window.__renderSlots(size)`，讓側邊欄顯示以程式繪製的角色（2D 範本在 `drawCharacter()` 中繪製它們）。
- `assets/` — 每個槽位的圖片，加上 `ASSETS.json`，記錄每張圖的來源。你可以直接在槽位的檔案上作畫修改；工作室會把它記錄為你的編輯。
- `dist/index.html` — 目前的建置；`.studio/` 保存版本、候選圖與試玩測試的執行記錄。

## 開發

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## 生態系

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — 從 Claude Code / Codex 把工作分派給 DSH 代理程式
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — 在對話中使用即時的 iOS 模擬器或 USB 連接的 iPhone
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 在對話中使用即時的 Android 模擬器或 USB 裝置
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — 給 DSH 的長期記憶
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 在對話中檢視與編輯 `.op` 設計文件

## 銘謝與授權

- [three.js](https://github.com/mrdoob/three.js) — 隨體素遊戲一同打包的 3D 執行環境（MIT）。
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — 側邊欄分享面板中的 QR Code（MIT）。
- [Playwright](https://github.com/microsoft/playwright)（`playwright-core`）— 驅動瀏覽器進行試玩測試（Apache-2.0；執行時期相依套件）。
- 範本、精靈圖與體素模型皆為本專案原創。
- 完整聲明請見 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

**授權條款**：MIT
