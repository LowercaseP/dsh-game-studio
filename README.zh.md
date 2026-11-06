<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH 游戏工坊" width="120" />
</p>

<h1 align="center">DSH 游戏工坊</h1>

<p align="center">
  <strong>一句话描述一个小游戏 —— 在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 对话的侧栏里直接玩，换上 AI 美术，导出成一个 HTML 文件。</strong><br />
  <sub>10 个 agent 工具 &bull; 侧栏实时预览 &bull; 2D 与 3D 体素模板 &bull; OpenAI 或 Codex 生图、花钱前先确认 &bull; 自动试玩 &bull; 版本历史 &bull; 单文件导出</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <b>简体中文</b> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>包名：<code>@zseven-w/dsh-game-studio</code> &middot; 当前插件版本：<code>0.1.0-rc.3</code> &middot; 已在 DSH <code>0.2.1-rc.5</code> 上测试</sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH 游戏工坊 —— 一句话，一个能玩的游戏" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="右侧游戏工坊侧栏里正在运行的 3D 游戏，下面是待选的 AI 美术候选" width="100%" />
</p>
<p align="center"><sub>agent 干活时，游戏就在右侧侧栏里运行；下方是带编号的 AI 美术候选，等你来挑</sub></p>

## 为什么用 DSH 游戏工坊

用大白话跟 agent 说想要什么游戏，比如「做一个 3D 小游戏：小熊猫在竹林里收集竹笋，躲开野猪」。它会从模板出发把游戏做出来，自己试玩一遍确认能玩，然后放进侧栏，你马上就能玩。角色一开始是代码画的模型；想要正式美术时，agent 用 OpenAI 或你的 Codex 账号生成候选图，你按编号挑一张，游戏里就换上了。每次改动都存成一个版本可以回退，做好的游戏能导出成一个离线可玩的 HTML 文件。

| | |
| --- | --- |
| 🎮 **第一次回答就能玩** | 两个模板：2D 俯视角，以及同一套玩法的 3D 体素世界（three.js）。agent 会把它改成你描述的游戏：角色、规则、关卡、界面。 |
| 🖥️ **侧栏实时预览** | 游戏在对话旁的沙箱面板里运行，每次改动自动重建；下方列出美术槽位、候选图和版本。横屏游戏会用宽舞台显示。 |
| 🎨 **换上自己的美术，花钱前先确认** | `game_studio_generate_asset` 用 OpenAI 图像接口或本机 Codex CLI 给每个槽位生成带编号的候选图。花钱之前会弹出审批卡，写明服务、张数和预估费用。你在聊天里附上的图片可以作为参考图。 |
| 🤖 **自动试玩** | `game_studio_playtest` 在无界面的 Chrome 或 Edge 里玩最新代码，报告阶段、得分、帧率、脚本错误并附截图。不靠方向键操作的游戏（格子、卡牌、瞄准、节奏……）定义 `window.__autoplay`，试玩就能玩到真正的玩法。 |
| 🕰️ **版本历史** | 每次让游戏发生变化的构建都会保存；`game_studio_restore_version` 把代码、规则和美术一起恢复。 |
| 📦 **单文件导出** | `game_studio_export` 生成一个不联网、自包含的 HTML 文件，用任何浏览器打开，或放到任意静态托管上。 |
| 📱 **在手机上试玩** | `game_studio_share` 在本地网络上开一个临时只读链接，侧栏里会显示二维码。 |
| 🗂️ **游戏墙** | 点右栏的 **+**，选 **游戏工坊 · 游戏墙**：工作区里做过的游戏铺满一面墙，封面是最近一次试玩的画面，可按 2D/3D 筛选，按最近修改、版本数或名称排序。点一下就能玩，不经过 agent，也不花 token。**导出游戏墙**会把墙上的游戏打包成一个离线网页，发给朋友就能玩。 |

## 用它做出来的游戏

下面是实测中做出的四个游戏。每个都是新会话里用图下那一句话开始的；有几个后来在同一会话里又提了修改，已注明。游戏画面用游戏自带的自动驾驶录制。

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="《月光狐狸：灯笼岛》——3D 体素模板，实机画面" width="640" />
</p>
<p align="center"><sub>《月光狐狸：灯笼岛》——3D 体素模板，实机画面</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="做一个小游戏：小狐狸在月光森林里收集灯笼，躲开荆棘怪。" width="100%" /><br /><sub>「做一个小游戏：小狐狸在月光森林里收集灯笼，躲开荆棘怪。」<br />2D 模板；角色后来换成了挑选的 AI 美术</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="做一个 3D 小游戏：小狐狸在体素小岛上收集灯笼，躲开荆棘怪。" width="100%" /><br /><sub>「做一个 3D 小游戏：小狐狸在体素小岛上收集灯笼，躲开荆棘怪。」<br />3D 体素模板；灯笼模型在后续请求里重做过</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="做一个 3D 小游戏：小企鹅在冰山上收集小鱼，躲开海豹。" width="100%" /><br /><sub>「做一个 3D 小游戏：小企鹅在冰山上收集小鱼，躲开海豹。」<br />3D；红帽子是后续请求加的</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="做一个 3D 小游戏：小熊猫在竹林里收集竹笋，躲开野猪。" width="100%" /><br /><sub>「做一个 3D 小游戏：小熊猫在竹林里收集竹笋，躲开野猪。」<br />3D；角色后来换成 AI 美术，竹林仍是 3D</sub></td>
</tr>
</table>

## 实际效果

在真实 DSH 里用 DeepSeek-V4.1-Flash 实测，每个游戏都在新会话里用一句话做出来，再由独立试玩打分（2026-11-04/05）：

- **收集 + 躲避类游戏**（模板最擅长的类型）：10 句不同的需求，10 个首轮就能玩，每个游戏中位用时约 14 分钟。
- **其他类型**：消除、推箱子、塔防、投篮、横版跳跃、节奏、赛车、卡牌对战、种菜、咖啡店经营。10 个都做出了能玩的游戏，但中位用时约 26 分钟。加入 `__autoplay`、自定义美术槽位和横屏支持后，复跑其中 4 个，用时降到 8–18 分钟。样本较小。

## 工具

| 工具 | 作用 |
| --- | --- |
| `game_studio_create` | 从 `collector`（2D）或 `voxel`（3D）模板创建能玩的游戏，构建并显示在侧栏。参数包括标题、美术风格、`orientation`（竖屏或横屏）和 `slots`：游戏自己的美术槽位，用用户的语言命名。 |
| `game_studio_build` | 改完 `game.json` 或 `game.js` 后重新构建、刷新预览，并附一句说明存成一个版本。 |
| `game_studio_playtest` | 无界面地玩最新代码（手机竖屏或 960×540 横屏），报告阶段、最高分、剩余生命、帧率、错误和截图；`characters: true` 只返回角色特写。 |
| `game_studio_generate_asset` | 用 `openai` 或 `codex` 给一个槽位生成 1–4 张候选图，可选参考图。花钱前先审批；Codex 在后台运行。 |
| `game_studio_apply_asset` | 按编号把候选图放进游戏，重新构建并刷新。 |
| `game_studio_revert_asset` | 把某个槽位恢复成上一张美术。 |
| `game_studio_versions` | 列出已保存的版本，最新的在前。 |
| `game_studio_restore_version` | 把整个游戏恢复到较早的版本。 |
| `game_studio_export` | 导出一个自包含、可离线游玩的 HTML 文件。 |
| `game_studio_share` | 在本地网络开启（或关闭）一个临时只读链接，让手机也能玩。 |
| `game_studio_list` | 列出工作区里的游戏（标题、2D/3D、是否已构建、版本数），agent 能按名字找到「那个企鹅游戏」。 |
| `game_studio_export_wall` | 导出游戏墙：一个离线 HTML 页面，每个已构建的游戏一个格子，点格子就能玩。 |

侧栏上的按钮（应用、撤回、构建、导出、恢复、分享）通过 `/game-studio` 命令调用同样的操作。

## 生图服务与费用

| 服务 | 需要什么 | 费用 | 说明 |
| --- | --- | --- | --- |
| **OpenAI**（GPT Image） | DSH 凭据或环境变量里的 API key（默认 `OPENAI_API_KEY`） | 按张计费到你的 key，审批卡上会显示预估 | 每批约一分钟。`openaiBaseUrl` 可以指向兼容 OpenAI 的网关。 |
| **Codex CLI** | 已安装并登录 Codex（`codex login`） | 计入你的 Codex 订阅额度，不需要 API key | 每张几分钟，在后台运行，完成后通知。 |

`imageProvider: auto`（默认）在配置了 OpenAI key 时用 OpenAI，否则用 Codex。`confirmSpending` 开启时（默认），你批准审批卡之前不会生成任何东西。角色图在交给你之前会检查透明背景和构图，并按槽位尺寸裁好。

## 安全与隐私

- 游戏在沙箱 iframe 里运行，内容安全策略禁止联网；导出的文件不发出任何网络请求。
- 离开你电脑的只有提示词，以及你提供的参考图，发往你选择的生图服务。
- 分享链接只读，只提供这个游戏的构建产物，只在本地网络上监听，到你设定的时间（默认 30 分钟）自动关闭。
- API key 从 DSH 凭据或环境变量读取，不会写进项目、日志或工具结果。

## 环境要求

- DeepSeek Harness `0.2.1` 或更新（网页版或桌面版），Node.js `24.11` 或更新。
- 同一台电脑上装有 Google Chrome 或 Microsoft Edge，用于自动试玩。
- 生成 AI 美术需要 OpenAI API key 或已登录的 Codex CLI。都没有时，游戏仍可用代码画的角色正常运行。

## 安装到 DSH

从 npm 安装到 DSH profile：

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## 快速开始

在一个工作区文件夹里开个会话，比如这样说：

- `做一个小游戏：小猫在厨房里偷鱼干，别被扫地机器人撞到。`
- `做一个 3D 小游戏：小骑士在城堡里收集金币，躲开骷髅兵，60 秒内收集 20 枚金币就算胜利。`
- `做一个消除小游戏：在 6×6 的格子里交换相邻的宝石，60 秒内拿到 1000 分就赢。`

接着试试：

- `用 AI 给主角生成 2 张新美术，我在右栏挑。`
- `主角照着我附的这张图来画。`
- `导出成一个 HTML 文件。`

## 配置

在 profile 的 `cordis.patch.yml` 里的 `config` 下设置：

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`、`openai` 或 `codex`。 |
| `openaiModel` | `gpt-image-2.5-flare` | OpenAI 图像模型；固定下来，结果才有可比性。 |
| `openaiBaseUrl` | OpenAI | 兼容 OpenAI 的接口地址，例如公司网关。 |
| `openaiCredential` | `OPENAI_API_KEY` | 存放 key 的凭据名或环境变量名。 |
| `codexPath` | 从 `PATH` 或登录 shell 中查找 | Codex CLI 可执行文件。 |
| `codexModel` | Codex 的默认值 | Codex 生图用的模型。 |
| `codexReasoningEffort` | `low` | Codex 生图的推理强度。 |
| `codexTimeoutMinutes` | `15` | 单张 Codex 图超过这个时间就放弃。 |
| `confirmSpending` | `true` | 每次生成前都请求批准。 |

## 游戏项目格式

每个游戏就是工作区里的一个普通文件夹：

- `game.json`：标题、美术风格、横竖屏、美术槽位和规则。规则是自由格式，任何键都会以 `window.GAME.rules` 传给游戏。
- `game.js`：agent 编辑的游戏代码。它提供 `window.__gameState()` 供试玩读取；不靠方向键操作的游戏可选提供 `window.__autoplay(state)`；提供 `window.__renderSlots(size)` 后，侧栏能显示代码画的角色（2D 模板在 `drawCharacter()` 里画角色）。
- `assets/`：每个槽位的图片，以及记录每张图来源的 `ASSETS.json`。你可以直接改槽位文件，工坊会把它记为你的修改。
- `dist/index.html` 是当前构建；`.studio/` 里存放版本、候选图和试玩记录。

## 开发

```sh
npm ci
npm run build   # 生成 lib/index.js、lib/client.js 和打包好的 three.js 运行时
npm test        # node --test；找不到 Chrome 或 Edge 时跳过试玩相关测试
```

## 生态

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) —— 从 Claude Code / Codex 把任务派给 DSH agent
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) —— 在对话里直接操作 iOS 模拟器或 USB 连接的 iPhone
- [DSH Android](https://github.com/ZSeven-W/dsh-android) —— 在对话里直接操作 Android 模拟器或 USB 设备
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) —— DSH 的长期记忆
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) —— 在对话里查看和编辑 `.op` 设计文档

## 致谢与许可证

- [three.js](https://github.com/mrdoob/three.js) —— 打包进体素游戏的 3D 运行时（MIT）。
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) —— Kazuhiko Arase —— 侧栏分享面板里的二维码（MIT）。
- [Playwright](https://github.com/microsoft/playwright)（`playwright-core`）—— 自动试玩时驱动浏览器（Apache-2.0，运行时依赖）。
- 模板、角色图和体素模型均为本项目原创。
- 完整声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

**许可证**：MIT
