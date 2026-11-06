<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Mô tả một trò chơi nhỏ chỉ trong một câu — chơi ngay ở thanh bên của cuộc trò chuyện <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>, thay đồ họa AI vào và xuất ra một tệp HTML duy nhất.</strong><br />
  <sub>10 công cụ agent &bull; xem trước trực tiếp ở thanh bên &bull; mẫu 2D và voxel 3D &bull; đồ họa OpenAI hoặc Codex có kiểm tra chi phí trước &bull; tự động chơi thử &bull; lịch sử phiên bản &bull; xuất một tệp duy nhất</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <b>Tiếng Việt</b> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>Gói: <code>@zseven-w/dsh-game-studio</code> &middot; Bản phát hành plugin hiện tại: <code>0.1.0-rc.3</code> &middot; Đã thử nghiệm với DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — một câu mô tả, một trò chơi chơi được ngay" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Một trò chơi 3D đang chạy trong thanh bên Game Studio, cùng các phương án đồ họa AI sẵn sàng để áp dụng" width="100%" />
</p>
<p align="center"><sub>Trò chơi chạy trong thanh bên phải trong khi agent làm việc; các phương án đồ họa AI được đánh số nằm chờ bên dưới để bạn chọn</sub></p>

## Tại sao chọn DSH Game Studio

Yêu cầu agent tạo một trò chơi bằng lời lẽ tự nhiên — "một trò chơi 3D: gấu trúc đỏ thu thập măng trong rừng và né heo rừng" — agent sẽ dựng trò chơi từ một mẫu có sẵn, tự chơi để kiểm tra hoạt động, rồi hiển thị trong thanh bên để bạn chơi được ngay. Các nhân vật ban đầu là mô hình vẽ bằng mã; khi bạn muốn có đồ họa thực sự, agent sẽ tạo các phương án bằng OpenAI hoặc tài khoản đăng nhập Codex của bạn, bạn chọn một phương án theo số thứ tự và trò chơi sẽ thay thế vào. Mọi thay đổi đều được lưu thành một phiên bản để bạn có thể quay lại, và trò chơi hoàn chỉnh sẽ được xuất ra dưới dạng một tệp HTML ngoại tuyến duy nhất.

| | |
| --- | --- |
| 🎮 **Chơi được ngay từ câu trả lời đầu tiên** | Hai mẫu — một trò chơi 2D góc nhìn từ trên xuống và cùng vòng lặp đó trong thế giới voxel 3D (three.js) — được agent biến đổi thành trò chơi bạn đã mô tả: nhân vật, luật chơi, màn chơi, giao diện. |
| 🖥️ **Xem trước trực tiếp ở thanh bên** | Trò chơi chạy trong một bảng điều khiển tách biệt (sandbox) cạnh cuộc trò chuyện, tự động dựng lại sau mỗi thay đổi, đồng thời liệt kê các ô đồ họa (slot), phương án ảnh và phiên bản ở bên dưới. Các trò chơi màn hình ngang sẽ có khung hiển thị rộng. |
| 🎨 **Đồ họa của riêng bạn, có kiểm tra chi phí trước** | `game_studio_generate_asset` tạo các phương án được đánh số cho từng ô bằng API hình ảnh của OpenAI hoặc Codex CLI cục bộ. Trước khi tốn bất kỳ chi phí nào, bạn sẽ nhận được thẻ phê duyệt hiển thị dịch vụ, số lượng ảnh và chi phí dự kiến. Hình ảnh bạn đính kèm trong cuộc trò chuyện có thể được dùng làm ảnh tham chiếu. |
| 🤖 **Tự động chơi thử (playtest)** | `game_studio_playtest` chạy bản mã mới nhất trong Chrome hoặc Edge chế độ không giao diện (headless) và báo cáo các giai đoạn, điểm số, tốc độ khung hình, lỗi kịch bản cùng ảnh chụp màn hình. Các trò chơi không điều khiển bằng phím mũi tên (lưới, thẻ bài, ngắm bắn, nhịp điệu…) định nghĩa `window.__autoplay`, nhờ đó quá trình chơi thử diễn ra đúng với vòng lặp thực tế của trò chơi. |
| 🕰️ **Lịch sử phiên bản** | Mọi bản dựng làm thay đổi trò chơi đều được lưu lại; `game_studio_restore_version` khôi phục đồng thời cả mã, luật chơi và đồ họa. |
| 📦 **Xuất một tệp duy nhất** | `game_studio_export` ghi ra một tệp HTML độc lập không cần kết nối mạng — mở được trên mọi trình duyệt hoặc đưa lên bất kỳ máy chủ tĩnh nào. |
| 📱 **Thử ngay trên điện thoại** | `game_studio_share` mở một liên kết chỉ đọc tạm thời trên mạng cục bộ của bạn, kèm mã QR ở thanh bên. |
| 🗂️ **Trò chơi của tôi** | Mở nút **+** ở thanh bên và chọn **Game Studio · My games**: mỗi trò chơi trong không gian làm việc là một ô kèm ảnh lần chơi thử gần nhất, lọc theo 2D/3D và sắp xếp theo thời gian, số phiên bản hoặc tên. Bấm là chơi, không cần agent, không tốn token. **Export wall** gói các trò đang hiển thị thành một trang ngoại tuyến để gửi cho bạn bè. |

## Những trò chơi làm bằng nó

Bốn trò chơi từ các lần thử nghiệm. Mỗi trò bắt đầu từ một câu ghi bên dưới, trong một phiên mới (lời nhắc dịch từ tiếng Trung); một vài trò sau đó được chỉnh thêm bằng yêu cầu khác trong cùng phiên, như đã ghi chú. Cảnh chơi được ghi bằng chế độ tự chơi có sẵn của từng trò.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Cáo ánh trăng: Đảo đèn lồng — mẫu voxel 3D, cảnh chơi thật" width="640" />
</p>
<p align="center"><sub>Cáo ánh trăng: Đảo đèn lồng — mẫu voxel 3D, cảnh chơi thật</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Làm một trò chơi nhỏ: cáo con nhặt đèn lồng trong khu rừng dưới ánh trăng và né quái gai." width="100%" /><br /><sub>“Làm một trò chơi nhỏ: cáo con nhặt đèn lồng trong khu rừng dưới ánh trăng và né quái gai.”<br />Mẫu 2D; nhân vật sau đó được thay bằng ảnh AI đã chọn</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="Làm một trò chơi 3D: cáo con nhặt đèn lồng trên hòn đảo voxel và né quái gai." width="100%" /><br /><sub>“Làm một trò chơi 3D: cáo con nhặt đèn lồng trên hòn đảo voxel và né quái gai.”<br />Mẫu voxel 3D; mô hình đèn lồng được làm lại ở một yêu cầu sau</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="Làm một trò chơi 3D: chim cánh cụt con nhặt cá trên tảng băng trôi và né hải cẩu." width="100%" /><br /><sub>“Làm một trò chơi 3D: chim cánh cụt con nhặt cá trên tảng băng trôi và né hải cẩu.”<br />3D; chiếc mũ đỏ được thêm ở một yêu cầu sau</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="Làm một trò chơi 3D: gấu trúc đỏ nhặt măng trong rừng tre và né lợn rừng." width="100%" /><br /><sub>“Làm một trò chơi 3D: gấu trúc đỏ nhặt măng trong rừng tre và né lợn rừng.”<br />3D; nhân vật sau đó được thay bằng ảnh AI, khu rừng vẫn là 3D</sub></td>
</tr>
</table>

## Hiệu quả hoạt động

Đo lường trong môi trường DSH thực tế với DeepSeek-V4.1-Flash, mỗi trò chơi được tạo từ một câu duy nhất trong một phiên mới và được chấm điểm bằng một lượt chơi thử độc lập (2026-11-04/05):

- **Trò chơi thu thập và né tránh** (sở trường của các mẫu): 10 trên 10 yêu cầu khác nhau đều chơi được ngay từ lần thử đầu tiên, trung vị khoảng 14 phút mỗi trò chơi.
- **Các thể loại khác** — ghép 3 (match-3), đẩy hộp, thủ thành, bóng rổ, đi cảnh (platformer), nhịp điệu, đua xe, đấu thẻ bài, nông trại, quản lý quán cà phê: cả 10 trò chơi đều chơi được, nhưng mất trung vị khoảng 26 phút. Sau khi bổ sung `__autoplay`, các ô đồ họa tùy chỉnh và hỗ trợ màn hình ngang, bốn trò chơi trong số đó đã được chạy lại và mất 8–18 phút. Cỡ mẫu này còn nhỏ.

## Công cụ

| Công cụ | Chức năng |
| --- | --- |
| `game_studio_create` | Tạo một trò chơi chơi được từ mẫu `collector` (2D) hoặc `voxel` (3D), dựng và hiển thị trong thanh bên. Nhận tiêu đề, phong cách đồ họa, `orientation` (dọc hoặc ngang) và `slots` — các ô đồ họa riêng của trò chơi, được đặt tên bằng ngôn ngữ của người dùng. |
| `game_studio_build` | Dựng lại sau khi chỉnh sửa `game.json` hoặc `game.js`, làm mới bản xem trước và lưu một phiên bản kèm ghi chú ngắn. |
| `game_studio_playtest` | Chơi thử mã mới nhất ở chế độ không giao diện (dọc cỡ điện thoại hoặc ngang 960×540) và báo cáo các giai đoạn, điểm cao nhất, số mạng (tim), fps, lỗi và ảnh chụp màn hình; `characters: true` chỉ trả về ảnh chụp cận cảnh các nhân vật. |
| `game_studio_generate_asset` | Tạo 1–4 hình ảnh phương án cho một ô bằng `openai` hoặc `codex`, có thể tùy chọn làm theo ảnh tham chiếu. Yêu cầu phê duyệt trước khi chi tiêu. Codex chạy trong nền. |
| `game_studio_apply_asset` | Đưa một phương án ảnh vào trò chơi theo số thứ tự, dựng lại và làm mới. |
| `game_studio_revert_asset` | Quay lại đồ họa trước đó của một ô. |
| `game_studio_versions` | Liệt kê các phiên bản đã lưu, mới nhất xếp trước. |
| `game_studio_restore_version` | Khôi phục một phiên bản trước đó của toàn bộ trò chơi. |
| `game_studio_export` | Xuất ra một tệp HTML độc lập, chạy ngoại tuyến. |
| `game_studio_share` | Mở (hoặc đóng) một liên kết chỉ đọc tạm thời trên mạng cục bộ để điện thoại có thể chơi trò chơi. |
| `game_studio_list` | Liệt kê các trò chơi trong không gian làm việc với tên, 2D/3D, trạng thái build và số phiên bản, để agent tìm "trò chim cánh cụt đó" theo tên. |
| `game_studio_export_wall` | Xuất bức tường trò chơi: một trang HTML ngoại tuyến, mỗi trò đã build một ô; bấm vào ô để chơi. |

Các nút ở thanh bên (áp dụng, hoàn tác, dựng, xuất, khôi phục, chia sẻ) cũng gọi cùng các thao tác này thông qua lệnh `/game-studio`.

## Dịch vụ hình ảnh và chi phí

| Dịch vụ | Yêu cầu | Chi phí | Ghi chú |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | Khóa API trong thông tin xác thực DSH hoặc biến môi trường (mặc định là `OPENAI_API_KEY`) | Tính phí theo từng ảnh vào khóa của bạn; thẻ phê duyệt sẽ hiển thị mức ước tính | Khoảng một phút mỗi đợt. `openaiBaseUrl` chấp nhận cổng kết nối tương thích với OpenAI. |
| **Codex CLI** | Đã cài đặt và đăng nhập Codex (`codex login`) | Tính vào gói Codex của bạn; không cần khóa API | Vài phút mỗi ảnh, chạy trong nền và báo lại khi hoàn tất. |

`imageProvider: auto` (mặc định) sẽ sử dụng OpenAI khi khóa của dịch vụ này được thiết lập, và dùng Codex trong trường hợp ngược lại. Khi bật `confirmSpending` (mặc định), không có gì được tạo ra cho đến khi bạn phê duyệt thẻ. Các ảnh sprite được kiểm tra nền trong suốt, căn khung và điều chỉnh vừa với ô trước khi được đưa ra cho bạn chọn.

## Bảo mật và quyền riêng tư

- Trò chơi chạy trong một iframe tách biệt (sandbox) với chính sách bảo mật nội dung chặn truy cập mạng; các tệp đã xuất không thực hiện bất kỳ yêu cầu mạng nào.
- Những thứ duy nhất được gửi ra khỏi máy của bạn là các câu lệnh tạo ảnh (prompt) — và ảnh tham chiếu, nếu bạn cung cấp — tới dịch vụ hình ảnh mà bạn chọn.
- Liên kết chia sẻ ở chế độ chỉ đọc, chỉ phục vụ bản dựng của trò chơi đó, chỉ lắng nghe trên mạng cục bộ của bạn và tự đóng sau khoảng thời gian bạn đặt (mặc định là 30 phút).
- Khóa API được đọc từ thông tin xác thực DSH hoặc biến môi trường và không bao giờ được ghi vào dự án, nhật ký hay kết quả của công cụ.

## Yêu cầu hệ thống

- DeepSeek Harness `0.2.1` trở lên (bản web hoặc máy tính), Node.js `24.11` trở lên.
- Google Chrome hoặc Microsoft Edge trên cùng máy tính để chạy tự động chơi thử.
- Đối với đồ họa AI, cần có khóa API OpenAI hoặc Codex CLI đã đăng nhập. Nếu không có cả hai, trò chơi vẫn hoạt động với các nhân vật được vẽ bằng mã.

## Cài đặt vào DSH

Cài đặt từ npm vào một hồ sơ (profile) DSH:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Bắt đầu nhanh

Mở một phiên trong thư mục không gian làm việc (workspace) và thử yêu cầu, ví dụ:

- `Hãy tạo một trò chơi nhỏ: một chú mèo con ăn vụng cá khô trong bếp mà không va phải robot hút bụi.`
- `Hãy tạo một trò chơi 3D: một hiệp sĩ nhỏ thu thập tiền xu trong lâu đài và tránh các bộ xương; thu thập đủ 20 đồng xu trong 60 giây sẽ thắng.`
- `Hãy tạo một trò chơi ghép 3 trên lưới 6×6; đạt 1000 điểm trong 60 giây để chiến thắng.`

Sau đó thử tiếp:

- `Tạo 2 mẫu đồ họa mới cho nhân vật chính bằng AI; tôi sẽ chọn trong thanh bên.`
- `Hãy làm theo hình ảnh tôi đã đính kèm cho ngoại hình của nhân vật chính.`
- `Xuất trò chơi thành một tệp HTML duy nhất.`

## Cấu hình

Thiết lập các tùy chọn này dưới mục `config` trong tệp `cordis.patch.yml` của hồ sơ:

| Tùy chọn | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` hoặc `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | Mô hình tạo ảnh của OpenAI; cố định mô hình này để kết quả luôn đồng nhất khi so sánh. |
| `openaiBaseUrl` | OpenAI | URL cơ sở tương thích với OpenAI, ví dụ như cổng kết nối của công ty. |
| `openaiCredential` | `OPENAI_API_KEY` | Tên thông tin xác thực hoặc biến môi trường lưu giữ khóa. |
| `codexPath` | tìm trên `PATH` hoặc thông qua login shell | Tệp thực thi Codex CLI. |
| `codexModel` | Mặc định của Codex | Mô hình dùng cho các lượt tạo ảnh bằng Codex. |
| `codexReasoningEffort` | `low` | Mức độ suy luận cho các lượt tạo ảnh bằng Codex. |
| `codexTimeoutMinutes` | `15` | Hủy bỏ một lượt tạo ảnh Codex sau khoảng thời gian này (tính bằng phút). |
| `confirmSpending` | `true` | Yêu cầu phê duyệt trước mỗi lần tạo ảnh. |

## Định dạng dự án trò chơi

Mỗi trò chơi là một thư mục thông thường trong không gian làm việc của bạn:

- `game.json` — tiêu đề, phong cách đồ họa, hướng màn hình, các ô đồ họa và luật chơi. Luật chơi có định dạng tự do: bất kỳ khóa nào cũng được truyền vào trò chơi dưới dạng `window.GAME.rules`.
- `game.js` — mã trò chơi mà agent chỉnh sửa. Tệp này cung cấp `window.__gameState()` cho việc chơi thử, tùy chọn `window.__autoplay(state)` cho các trò chơi không điều khiển bằng phím mũi tên, và `window.__renderSlots(size)` để thanh bên hiển thị các nhân vật được vẽ bằng mã (mẫu 2D vẽ chúng trong `drawCharacter()`).
- `assets/` — hình ảnh cho từng ô cùng với `ASSETS.json`, nơi ghi lại nguồn gốc của từng ảnh. Bạn có thể vẽ đè trực tiếp lên tệp của một ô; studio sẽ ghi nhận đó là chỉnh sửa của bạn.
- `dist/index.html` — bản dựng hiện tại; `.studio/` lưu trữ các phiên bản, phương án ảnh và các lượt chạy chơi thử.

## Phát triển

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Hệ sinh thái

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — giao việc cho các agent DSH từ Claude Code / Codex
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — iOS Simulator hoặc iPhone kết nối USB trực tiếp ngay trong cuộc trò chuyện
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — trình giả lập Android hoặc thiết bị kết nối USB trực tiếp ngay trong cuộc trò chuyện
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — bộ nhớ dài hạn cho DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — kiểm tra và chỉnh sửa tài liệu thiết kế `.op` ngay trong cuộc trò chuyện

## Ghi công &amp; Giấy phép

- [three.js](https://github.com/mrdoob/three.js) — runtime 3D được đóng gói sẵn vào các trò chơi voxel (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — mã QR trong bảng chia sẻ ở thanh bên (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — điều khiển trình duyệt cho các lượt chơi thử (Apache-2.0; phụ thuộc runtime).
- Các mẫu, ảnh sprite và mô hình voxel là tài nguyên gốc của dự án này.
- Xem [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) để biết toàn bộ thông báo bản quyền bên thứ ba.

**Giấy phép**: MIT
