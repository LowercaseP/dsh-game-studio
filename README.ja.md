<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>小さなゲームを一文で描写する — <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> の会話のサイドバーでプレイし、AIアートに差し替え、HTMLファイル1つにエクスポート。</strong><br />
  <sub>10のエージェントツール &bull; サイドバーのライブプレビュー &bull; 2Dと3Dボクセルのテンプレート &bull; 事前の費用確認つきのOpenAI/Codexアート &bull; 自動プレイのプレイテスト &bull; バージョン履歴 &bull; 1ファイルエクスポート</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <b>日本語</b> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>パッケージ: <code>@zseven-w/dsh-game-studio</code> &middot; 現在のプラグインリリース: <code>0.1.0-rc.3</code> &middot; 動作確認: DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — 一文で、プレイできるゲームをひとつ" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Game Studioのサイドバーで動く3Dゲームと、適用待ちのAIアート候補" width="100%" />
</p>
<p align="center"><sub>エージェントが作業している間もゲームは右のサイドバーでプレイでき、番号付きのAIアート候補がその下であなたが選ぶのを待っています</sub></p>

## DSH Game Studio を選ぶ理由

エージェントに普段の言葉でゲームを頼む — 「3Dゲーム:レッサーパンダが森でタケノコを集め、イノシシを避ける」— と、テンプレートからゲームを組み立て、正常に動くか確認するために実際にプレイし、すぐに遊べるサイドバーに表示します。キャラクターは最初、コードで描かれたモデルです。本物のアートが欲しくなったら、エージェントがOpenAIまたはあなたのCodexサインインで候補を生成し、番号で1つを選ぶとゲームがそれに差し替えます。すべての変更は戻れるバージョンとして保存され、完成したゲームは単一のオフラインHTMLファイルとしてエクスポートできます。

| | |
| --- | --- |
| 🎮 **最初の回答からプレイ可能** | 2つのテンプレート — 2Dトップダウンゲームと、同じループを3Dボクセル世界(three.js)で実現したもの — を、エージェントがあなたの説明したゲームへと作り替えます:キャラクター、ルール、レベル、画面。 |
| 🖥️ **サイドバーのライブプレビュー** | ゲームは会話の横にあるサンドボックス化されたパネルで動作し、変更のたびに再ビルドされ、その下にアートスロット・候補・バージョンが一覧表示されます。横画面のゲームにはワイドなステージが与えられます。 |
| 🎨 **事前の費用確認つきで、自分のアートを** | `game_studio_generate_asset` は、OpenAIの画像APIまたはローカルのCodex CLIを使い、スロットごとに番号付きの候補を作成します。何かが支出される前に、サービス・画像枚数・想定費用を記した承認カードが表示されます。チャットで添付した画像を参考にできます。 |
| 🤖 **自動プレイのプレイテスト** | `game_studio_playtest` は最新のコードをヘッドレスのChromeまたはEdgeでプレイし、フェーズ、スコア、フレームレート、スクリプトエラー、スクリーンショットを報告します。矢印キーで操作しないゲーム(グリッド、カード、照準、リズム…)は `window.__autoplay` を定義するため、プレイテストはその本来のループをプレイします。 |
| 🕰️ **バージョン履歴** | ゲームを変更したすべてのビルドが保存され、`game_studio_restore_version` がコード・ルール・アートをまとめて復元します。 |
| 📦 **1ファイルエクスポート** | `game_studio_export` は、ネットワークアクセスのない自己完結型HTMLファイルを書き出します — 任意のブラウザで開いたり、任意の静的ホストに置けます。 |
| 📱 **スマートフォンで試す** | `game_studio_share` はローカルネットワークに一時的な読み取り専用リンクを開きます。サイドバーにQRコードが表示されます。 |
| 🗂️ **マイゲーム** | 右サイドバーの **+** から **Game Studio · My games** を選ぶと、ワークスペースのゲームが最新のプレイテスト画面を表紙にしたタイルで一面に並びます。2D/3D で絞り込み、更新順・バージョン数・名前で並べ替えでき、クリックするだけで遊べます（agent もトークンも使いません）。**Export wall** で表示中のゲームを1つのオフラインページにまとめて友だちに送れます。 |

## これで作ったゲーム

テストで作った4本のゲームです。どれも新しいセッションで、画像の下の一文から始めました（プロンプトは中国語からの訳）。一部は同じセッションで後から修正を頼んでおり、その旨を記しています。プレイ映像は各ゲーム内蔵のオートプレイで録画しています。

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="『月光キツネ：ランタン島』— 3D ボクセルテンプレート、実機プレイ" width="640" />
</p>
<p align="center"><sub>『月光キツネ：ランタン島』— 3D ボクセルテンプレート、実機プレイ</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="小さなゲームを作って：子ギツネが月夜の森でランタンを集め、トゲの魔物をよける。" width="100%" /><br /><sub>「小さなゲームを作って：子ギツネが月夜の森でランタンを集め、トゲの魔物をよける。」<br />2D テンプレート。キャラクターは後で選んだ AI アートに差し替え</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="3D ゲームを作って：子ギツネがボクセルの小島でランタンを集め、トゲの魔物をよける。" width="100%" /><br /><sub>「3D ゲームを作って：子ギツネがボクセルの小島でランタンを集め、トゲの魔物をよける。」<br />3D ボクセルテンプレート。ランタンのモデルは後の依頼で作り直し</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="3D ゲームを作って：子ペンギンが氷山で魚を集め、アザラシをよける。" width="100%" /><br /><sub>「3D ゲームを作って：子ペンギンが氷山で魚を集め、アザラシをよける。」<br />3D。赤い帽子は後の依頼で追加</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="3D ゲームを作って：レッサーパンダが竹林でタケノコを集め、イノシシをよける。" width="100%" /><br /><sub>「3D ゲームを作って：レッサーパンダが竹林でタケノコを集め、イノシシをよける。」<br />3D。キャラクターは後で AI アートに差し替え、竹林は 3D のまま</sub></td>
</tr>
</table>

## どれだけうまく動くか

実際のDSHでDeepSeek-V4.1-Flashを使用して計測。各ゲームは新しいセッションで一文から作成し、独立したプレイテストで採点しました(2026-11-04/05):

- **集めて避けるゲーム**(テンプレートのホームグラウンド):異なる10個のリクエストすべてが初回でプレイ可能で、1ゲームあたりの所要時間の中央値は約14分でした。
- **その他のジャンル** — マッチ3、箱押し、タワーディフェンス、バスケットボール、プラットフォーマー、リズム、レーシング、カードバトル、農場経営、カフェ経営:10本すべてがプレイ可能でしたが、所要時間の中央値は約26分でした。`__autoplay`、カスタムアートスロット、横画面対応を追加した後、そのうち4本を再実行したところ8–18分でした。サンプルは小規模です。

## ツール

| ツール | 機能 |
| --- | --- |
| `game_studio_create` | `collector`(2D)または `voxel`(3D)テンプレートからプレイ可能なゲームを作成し、ビルドしてサイドバーに表示します。タイトル、アートスタイル、`orientation`(縦画面または横画面)、`slots`(ゲーム固有のアートスロット。ユーザーの言語で命名)を受け取ります。 |
| `game_studio_build` | `game.json` または `game.js` を編集した後に再ビルドし、プレビューを更新して、短いメモとともにバージョンを保存します。 |
| `game_studio_playtest` | 最新のコードをヘッドレスでプレイし(スマートフォン形状の縦画面または960×540の横画面)、フェーズ、ハイスコア、ハート、fps、エラー、スクリーンショットを報告します。`characters: true` でキャラクターのみのクローズアップを返します。 |
| `game_studio_generate_asset` | 1つのスロットについて `openai` または `codex` で1–4枚の候補画像を生成します。必要に応じて参考画像に従わせることもできます。支出の前に承認を求めます。Codexはバックグラウンドで実行されます。 |
| `game_studio_apply_asset` | 候補を番号でゲームに適用し、再ビルドして更新します。 |
| `game_studio_revert_asset` | スロットの以前のアートに戻します。 |
| `game_studio_versions` | 保存済みバージョンを新しい順に一覧表示します。 |
| `game_studio_restore_version` | ゲーム全体の以前のバージョンを復元します。 |
| `game_studio_export` | 自己完結型のオフラインHTMLファイルを1つエクスポートします。 |
| `game_studio_share` | スマートフォンからゲームを遊べるよう、ローカルネットワークに一時的な読み取り専用リンクを開きます(閉じることもできます)。 |
| `game_studio_list` | ワークスペースのゲームをタイトル・2D/3D・ビルド状態・バージョン数つきで一覧にし、agent が「あのペンギンのゲーム」を名前で見つけられるようにします。 |
| `game_studio_export_wall` | ゲームウォールをエクスポート：ビルド済みのゲームを1タイルずつ並べたオフラインHTMLページ。タイルをクリックで遊べます。 |

サイドバーのボタン(適用、元に戻す、ビルド、エクスポート、復元、共有)は、`/game-studio` コマンド経由で同じ操作を呼び出します。

## 画像サービスと費用

| サービス | 必要なもの | 費用 | 備考 |
| --- | --- | --- | --- |
| **OpenAI**(GPT Image) | DSHのクレデンシャルまたは環境変数にAPIキー(デフォルトでは `OPENAI_API_KEY`) | 画像ごとにあなたのキーへ課金。承認カードに見積もりが表示されます | 1バッチあたり約1分。`openaiBaseUrl` はOpenAI互換ゲートウェイを受け付けます。 |
| **Codex CLI** | Codexがインストールされ、サインイン済みであること(`codex login`) | あなたのCodexプランの利用量にカウント。APIキー不要 | 1画像あたり数分。バックグラウンドで実行され、完了時に報告します。 |

`imageProvider: auto`(デフォルト)は、キーが設定されていればOpenAIを、それ以外ではCodexを使用します。`confirmSpending` がオン(デフォルト)の場合、カードを承認するまで何も生成されません。スプライトは提示前に、透明背景と構図がチェックされ、スロットに合わせて調整されます。

## セキュリティとプライバシー

- ゲームは、ネットワークアクセスをブロックするコンテンツセキュリティポリシー付きのサンドボックス化されたiframeで動作します。エクスポートされたファイルはネットワークリクエストを行いません。
- マシンの外に送られるのは、プロンプトと、指定した場合の参考画像だけで、送り先はあなたが選んだ画像サービスです。
- 共有リンクは読み取り専用で、そのゲームのビルドだけを提供し、ローカルネットワークのみでリッスンし、設定した時間が経過すると閉じます(デフォルトは30分)。
- APIキーはDSHのクレデンシャルまたは環境変数から読み込まれ、プロジェクト・ログ・ツール結果に書き込まれることはありません。

## 動作要件

- DeepSeek Harness `0.2.1` 以降(webまたはデスクトップ)、Node.js `24.11` 以降。
- プレイテストには、同じコンピューター上のGoogle ChromeまたはMicrosoft Edge。
- AIアートには、OpenAIのAPIキーまたはサインイン済みのCodex CLIのいずれか。どちらもなくても、ゲームはコード描画のキャラクターで動作します。

## DSHへのインストール

npm から DSH プロファイルにインストールします:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## クイックスタート

ワークスペースフォルダーでセッションを開き、たとえば次のように頼んでみてください:

- `小さなゲームを作って:子猫がキッチンで、ロボット掃除機にぶつからないように干物を盗む。`
- `3Dゲームを作って:小さな騎士が城でコインを集めてスケルトンを避ける。60秒で20枚のコインを集めたら勝ち。`
- `6×6のグリッドのマッチ3ゲームを作って:60秒で1000点に達したら勝ち。`

その後、次を試してみてください:

- `AIで主人公のアートを2枚新しく生成して。サイドバーで選ぶから。`
- `添付した画像の見た目を主人公に反映して。`
- `単一のHTMLファイルとしてエクスポートして。`

## 設定

プロファイルの `cordis.patch.yml` の `config` 配下に設定します:

| オプション | デフォルト | 意味 |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`、`openai` または `codex`。 |
| `openaiModel` | `gpt-image-2.5-flare` | OpenAIの画像モデル。結果の比較可能性を保つため固定します。 |
| `openaiBaseUrl` | OpenAI | OpenAI互換のベースURL(例: 社内ゲートウェイ)。 |
| `openaiCredential` | `OPENAI_API_KEY` | キーを保持するクレデンシャルまたは環境変数の名前。 |
| `codexPath` | `PATH` またはログインシェル経由で見つかるもの | Codex CLIの実行ファイル。 |
| `codexModel` | Codexのデフォルト | Codexによる画像生成に使うモデル。 |
| `codexReasoningEffort` | `low` | Codexによる画像生成時の推論の強さ。 |
| `codexTimeoutMinutes` | `15` | この時間を超えたら1枚のCodex画像を諦めます。 |
| `confirmSpending` | `true` | 毎回の生成前に承認を求めます。 |

## ゲームプロジェクトの形式

各ゲームは、ワークスペース内の通常のフォルダーです:

- `game.json` — タイトル、アートスタイル、向き、アートスロット、ルール。ルールは自由形式で、任意のキーが `window.GAME.rules` としてゲームに渡されます。
- `game.js` — エージェントが編集するゲームコード。プレイテスト用に `window.__gameState()` を、矢印キーで操作しないゲーム用に(オプションで)`window.__autoplay(state)` を、サイドバーがコード描画のキャラクターを表示できるよう `window.__renderSlots(size)` を公開します(2Dテンプレートは `drawCharacter()` で描画します)。
- `assets/` — 各スロットの画像と、それぞれの出所を記録した `ASSETS.json`。スロットのファイルに直接描き込むこともでき、スタジオはそれをあなたの編集として記録します。
- `dist/index.html` — 現在のビルド。`.studio/` にはバージョン、候補、プレイテストの実行結果が保存されます。

## 開発

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## エコシステム

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / Codex からDSHエージェントに作業を割り振る
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — 会話の中でライブのiOSシミュレーターまたはUSB接続のiPhone
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 会話の中でライブのAndroidエミュレーターまたはUSB接続のデバイス
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSHのための長期記憶
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 会話の中で `.op` デザインドキュメントを閲覧・編集

## クレジット &amp; ライセンス

- [three.js](https://github.com/mrdoob/three.js) — ボクセルゲームにバンドルされる3Dランタイム(MIT)。
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — サイドバーの共有パネルのQRコード(MIT)。
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — プレイテストでブラウザを駆動(Apache-2.0、ランタイム依存)。
- テンプレート、スプライト、ボクセルモデルはこのプロジェクトのオリジナルです。
- 完全な通知は[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)を参照してください。

**ライセンス**: MIT
