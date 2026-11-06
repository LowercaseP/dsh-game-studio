<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Deskripsikan game kecil dalam satu kalimat — mainkan di bilah sisi percakapan <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>, ganti dengan seni AI, ekspor sebagai satu file HTML.</strong><br />
  <sub>10 alat agen &bull; pratinjau bilah sisi langsung &bull; templat 2D dan voksel 3D &bull; seni OpenAI atau Codex dengan pemeriksaan biaya terlebih dahulu &bull; uji main otomatis &bull; riwayat versi &bull; ekspor satu file</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <b>Bahasa Indonesia</b>
</p>

<p align="center">
  <sub>Paket: <code>@zseven-w/dsh-game-studio</code> &middot; Rilis plugin saat ini: <code>0.1.0-rc.3</code> &middot; Diuji dengan DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — satu kalimat, satu game siap dimainkan" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Game 3D berjalan di bilah sisi Game Studio, dengan kandidat seni AI yang siap diterapkan" width="100%" />
</p>
<p align="center"><sub>Game berjalan di bilah sisi kanan sementara agen bekerja; kandidat seni AI bernomor menunggu di bawahnya untuk Anda pilih</sub></p>

## Mengapa DSH Game Studio

Mintalah sebuah game kepada agen dengan kata-kata sederhana — "game 3D: seekor panda merah mengumpulkan rebung di hutan dan menghindari babi hutan" — dan agen akan membuatnya dari templat, memainkannya untuk memastikan game berjalan dengan baik, lalu menampilkannya di bilah sisi yang bisa langsung Anda mainkan. Karakter dimulai sebagai model yang digambar melalui kode; saat Anda menginginkan seni sesungguhnya, agen menghasilkan kandidat gambar menggunakan OpenAI atau akun Codex Anda, Anda memilih salah satu berdasarkan nomornya, dan game langsung menggantinya. Setiap perubahan disimpan sebagai versi yang dapat Anda pulihkan kapan saja, dan game yang sudah jadi dapat diekspor sebagai satu file HTML offline.

| | |
| --- | --- |
| 🎮 **Dapat dimainkan sejak jawaban pertama** | Dua templat — game 2D tampak atas (top-down) dan alur permainan yang sama di dunia voksel 3D (three.js) — yang dibentuk ulang oleh agen menjadi game yang Anda deskripsikan: karakter, aturan, level, layar. |
| 🖥️ **Pratinjau bilah sisi langsung** | Game berjalan di panel ber-sandbox di sebelah percakapan, dibangun ulang setiap ada perubahan, serta mencantumkan slot seni, kandidat, dan versi di bawahnya. Game lanskap mendapatkan area panggung yang lebar. |
| 🎨 **Seni Anda sendiri, dengan pemeriksaan biaya terlebih dahulu** | `game_studio_generate_asset` membuat kandidat bernomor untuk setiap slot menggunakan API gambar OpenAI atau Codex CLI lokal. Sebelum ada biaya yang dikeluarkan, Anda akan mendapatkan kartu persetujuan berisi layanan, jumlah gambar, dan perkiraan biaya. Gambar yang Anda lampirkan di obrolan dapat dijadikan referensi. |
| 🤖 **Uji main otomatis** | `game_studio_playtest` memainkan kode terbaru di Chrome atau Edge tanpa antarmuka (headless) dan melaporkan fase, skor, laju bingkai (frame rate), kesalahan skrip, dan tangkapan layar. Game yang tidak dikendalikan dengan tombol panah (grid, kartu, membidik, ritme…) mendefinisikan `window.__autoplay`, sehingga uji main menjalankan alur permainan yang sebenarnya. |
| 🕰️ **Riwayat versi** | Setiap build yang mengubah game akan disimpan; `game_studio_restore_version` mengembalikan kode, aturan, dan seni secara bersamaan. |
| 📦 **Ekspor satu file** | `game_studio_export` menulis file HTML mandiri tanpa akses jaringan — buka di browser apa pun atau unggah ke layanan hosting statis mana pun. |
| 📱 **Coba di ponsel Anda** | `game_studio_share` membuka tautan baca-saja sementara di jaringan lokal Anda, lengkap dengan kode QR di bilah sisi. |
| 🗂️ **Game saya** | Buka **+** di bilah samping dan pilih **Game Studio · My games**: setiap game di ruang kerja tampil sebagai ubin dengan gambar uji main terakhir, bisa disaring 2D/3D dan diurutkan menurut waktu, jumlah versi, atau nama. Klik untuk bermain, tanpa agent dan tanpa token. **Export wall** mengemas game yang tampil menjadi satu halaman offline untuk dikirim ke teman. |

## Game yang dibuat dengannya

Empat game dari uji coba kami. Masing-masing dimulai dari satu kalimat di bawahnya, dalam sesi baru (prompt diterjemahkan dari bahasa Mandarin); beberapa kemudian disempurnakan lewat permintaan lanjutan di sesi yang sama, seperti dicatat. Gameplay direkam dengan autoplay bawaan tiap game.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Rubah Cahaya Bulan: Pulau Lentera — templat voxel 3D, gameplay asli" width="640" />
</p>
<p align="center"><sub>Rubah Cahaya Bulan: Pulau Lentera — templat voxel 3D, gameplay asli</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Buat game kecil: anak rubah mengumpulkan lentera di hutan bercahaya bulan dan menghindari monster duri." width="100%" /><br /><sub>“Buat game kecil: anak rubah mengumpulkan lentera di hutan bercahaya bulan dan menghindari monster duri.”<br />Templat 2D; karakter kemudian diganti dengan seni AI pilihan</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="Buat game 3D: anak rubah mengumpulkan lentera di pulau voxel dan menghindari monster duri." width="100%" /><br /><sub>“Buat game 3D: anak rubah mengumpulkan lentera di pulau voxel dan menghindari monster duri.”<br />Templat voxel 3D; model lentera dibuat ulang di permintaan berikutnya</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="Buat game 3D: anak penguin mengumpulkan ikan di gunung es dan menghindari anjing laut." width="100%" /><br /><sub>“Buat game 3D: anak penguin mengumpulkan ikan di gunung es dan menghindari anjing laut.”<br />3D; topi merah ditambahkan di permintaan berikutnya</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="Buat game 3D: panda merah mengumpulkan rebung di hutan bambu dan menghindari babi hutan." width="100%" /><br /><sub>“Buat game 3D: panda merah mengumpulkan rebung di hutan bambu dan menghindari babi hutan.”<br />3D; karakter kemudian diganti dengan seni AI, hutannya tetap 3D</sub></td>
</tr>
</table>

## Seberapa baik kinerjanya

Diukur pada DSH nyata dengan DeepSeek-V4.1-Flash, setiap game dibuat dari satu kalimat dalam sesi baru, dan dinilai melalui uji main independen (2026-11-04/05):

- **Game kumpul-dan-hindar** (fokus utama templat): 10 dari 10 permintaan berbeda dapat langsung dimainkan pada percobaan pertama, dengan median waktu sekitar 14 menit per game.
- **Genre lainnya** — match-3, dorong kotak, pertahanan menara (tower defense), bola basket, platformer, ritme, balapan, pertarungan kartu, pertanian, manajemen kafe: ke-10 game berhasil dibuat dan dapat dimainkan, tetapi membutuhkan median waktu sekitar 26 menit. Setelah menambahkan `__autoplay`, slot seni khusus, dan dukungan lanskap, empat di antaranya dijalankan ulang dan memakan waktu 8–18 menit. Ukuran sampel ini masih kecil.

## Alat

| Alat | Fungsi |
| --- | --- |
| `game_studio_create` | Membuat game yang dapat dimainkan dari templat `collector` (2D) atau `voxel` (3D), membangunnya, dan menampilkannya di bilah sisi. Menerima judul, gaya seni, `orientation` (potret atau lanskap), dan `slots` — slot seni milik game itu sendiri, yang dinamai dalam bahasa pengguna. |
| `game_studio_build` | Membangun ulang setelah mengedit `game.json` atau `game.js`, menyegarkan pratinjau, dan menyimpan versi dengan catatan singkat. |
| `game_studio_playtest` | Memainkan kode terbaru secara headless (potret seukuran ponsel atau lanskap 960×540) dan melaporkan fase, skor terbaik, nyawa (hearts), fps, kesalahan, dan tangkapan layar; `characters: true` hanya mengembalikan gambar jarak dekat dari karakter. |
| `game_studio_generate_asset` | Menghasilkan 1–4 gambar kandidat untuk satu slot dengan `openai` atau `codex`, secara opsional mengikuti gambar referensi. Meminta persetujuan sebelum mengeluarkan biaya. Codex berjalan di latar belakang. |
| `game_studio_apply_asset` | Memasang kandidat ke dalam game berdasarkan nomornya, membangun ulang, dan menyegarkan pratinjau. |
| `game_studio_revert_asset` | Mengembalikan seni sebelumnya pada suatu slot. |
| `game_studio_versions` | Menampilkan daftar versi yang disimpan, dari yang terbaru. |
| `game_studio_restore_version` | Memulihkan versi sebelumnya dari keseluruhan game. |
| `game_studio_export` | Mengekspor satu file HTML mandiri yang dapat dijalankan secara offline. |
| `game_studio_share` | Membuka (atau menutup) tautan baca-saja sementara di jaringan lokal agar ponsel dapat memainkan game tersebut. |
| `game_studio_list` | Mendaftar game di ruang kerja beserta judul, 2D/3D, status build, dan jumlah versi, agar agent menemukan "game penguin itu" dari namanya. |
| `game_studio_export_wall` | Mengekspor dinding game: satu halaman HTML offline dengan satu ubin per game yang sudah di-build; klik ubin untuk bermain. |

Tombol-tombol di bilah sisi (terapkan, kembalikan, bangun, ekspor, pulihkan, bagikan) memanggil operasi yang sama melalui perintah `/game-studio`.

## Layanan gambar dan pengeluaran biaya

| Layanan | Yang diperlukan | Biaya | Catatan |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | Kunci API di kredensial DSH atau variabel lingkungan (default `OPENAI_API_KEY`) | Ditagih per gambar ke kunci Anda; kartu persetujuan menampilkan perkiraan biaya | Sekitar satu menit per batch. `openaiBaseUrl` menerima gateway yang kompatibel dengan OpenAI. |
| **Codex CLI** | Codex terinstal dan sudah masuk (`codex login`) | Dihitung dalam paket Codex Anda; tanpa kunci API | Beberapa menit per gambar, berjalan di latar belakang dan melaporkan hasilnya setelah selesai. |

`imageProvider: auto` (default) menggunakan OpenAI jika kuncinya diatur, dan menggunakan Codex jika tidak. Saat `confirmSpending` aktif (default), tidak ada gambar yang dibuat sampai Anda menyetujui kartu tersebut. Sprite diperiksa untuk memastikan latar belakang transparan serta pembingkaian yang tepat, lalu disesuaikan dengan ukuran slot sebelum ditawarkan.

## Keamanan dan privasi

- Game berjalan di dalam iframe ber-sandbox dengan kebijakan keamanan konten (CSP) yang memblokir akses jaringan; file yang diekspor tidak melakukan permintaan jaringan apa pun.
- Satu-satunya hal yang dikirim keluar dari perangkat Anda adalah prompt — serta gambar referensi, jika Anda memberikannya — ke layanan gambar yang Anda pilih.
- Tautan berbagi bersifat baca-saja, hanya menyajikan build game tersebut, hanya mendengarkan di jaringan lokal Anda, dan otomatis ditutup setelah batas waktu yang Anda tentukan (default 30 menit).
- Kunci API dibaca dari kredensial DSH atau variabel lingkungan dan tidak pernah ditulis ke dalam proyek, log, atau hasil alat.

## Persyaratan

- DeepSeek Harness `0.2.1` atau versi lebih baru (web atau desktop), Node.js `24.11` atau versi lebih baru.
- Google Chrome atau Microsoft Edge di komputer yang sama untuk uji main.
- Untuk seni AI, diperlukan kunci API OpenAI atau Codex CLI yang sudah masuk. Tanpa keduanya, game tetap berfungsi dengan karakter yang digambar melalui kode.

## Instal ke DSH

Instal dari npm ke profil DSH:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Mulai cepat

Buka sesi di folder ruang kerja (workspace) dan mintalah, misalnya:

- `Buat game kecil: seekor anak kucing mencuri ikan kering di dapur tanpa menabrak robot penyedot debu.`
- `Buat game 3D: seorang ksatria kecil mengumpulkan koin di kastel dan menghindari tengkorak; mengumpulkan 20 koin dalam 60 detik akan menang.`
- `Buat game match-3 di grid 6×6; capai 1000 poin dalam 60 detik untuk menang.`

Lalu coba:

- `Buat 2 gambar seni baru untuk karakter utama dengan AI; saya akan memilihnya di bilah sisi.`
- `Ikuti gambar yang saya lampirkan untuk tampilan karakter utama.`
- `Ekspor sebagai satu file HTML.`

## Konfigurasi

Atur opsi berikut di bawah `config` dalam file `cordis.patch.yml` profil Anda:

| Opsi | Default | Arti |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` atau `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | Model gambar OpenAI; tetapkan agar hasilnya tetap sebanding. |
| `openaiBaseUrl` | OpenAI | URL dasar yang kompatibel dengan OpenAI, misalnya gateway perusahaan. |
| `openaiCredential` | `OPENAI_API_KEY` | Nama kredensial atau variabel lingkungan yang menyimpan kunci. |
| `codexPath` | ditemukan di `PATH` atau melalui login shell | File eksekusi Codex CLI. |
| `codexModel` | Default Codex | Model untuk pembuatan gambar Codex. |
| `codexReasoningEffort` | `low` | Tingkat upaya penalaran untuk pembuatan gambar Codex. |
| `codexTimeoutMinutes` | `15` | Batalkan pembuatan satu gambar Codex setelah durasi ini. |
| `confirmSpending` | `true` | Meminta persetujuan sebelum setiap pembuatan gambar. |

## Format proyek game

Setiap game adalah folder biasa di ruang kerja Anda:

- `game.json` — judul, gaya seni, orientasi, slot seni, dan aturan. Aturan bersifat bebas: setiap kunci diteruskan ke game sebagai `window.GAME.rules`.
- `game.js` — kode game yang diedit oleh agen. File ini mengekspos `window.__gameState()` untuk uji main, secara opsional `window.__autoplay(state)` untuk game yang tidak dikendalikan dengan tombol panah, dan `window.__renderSlots(size)` agar bilah sisi dapat menampilkan karakter yang digambar melalui kode (templat 2D menggambarnya di `drawCharacter()`).
- `assets/` — gambar untuk setiap slot beserta `ASSETS.json`, yaitu catatan asal-usul setiap gambar. Anda dapat menggambar langsung di atas file slot; studio akan mencatatnya sebagai hasil editan Anda.
- `dist/index.html` — build saat ini; `.studio/` menyimpan versi, kandidat, dan hasil uji main.

## Pengembangan

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Ekosistem

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — delegasikan pekerjaan ke agen DSH dari Claude Code / Codex
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — Simulator iOS langsung atau iPhone USB di dalam percakapan
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — emulator Android langsung atau perangkat USB di dalam percakapan
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memori jangka panjang untuk DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — periksa dan edit dokumen desain `.op` di dalam percakapan

## Kredit &amp; Lisensi

- [three.js](https://github.com/mrdoob/three.js) — runtime 3D yang dibundel ke dalam game voksel (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — kode QR di panel berbagi pada bilah sisi (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — mengendalikan browser untuk uji main (Apache-2.0; dependensi runtime).
- Templat, sprite, dan model voksel adalah karya asli proyek ini.
- Lihat [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) untuk pemberitahuan selengkapnya.

**Lisensi**: MIT
