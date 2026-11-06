<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Küçük bir oyunu tek cümleyle tarif edin — <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> sohbetinin kenar çubuğunda oynayın, yapay zeka görselleriyle değiştirin, tek bir HTML dosyası olarak dışa aktarın.</strong><br />
  <sub>10 ajan aracı &bull; canlı kenar çubuğu önizlemesi &bull; 2D ve 3D voksel şablonları &bull; önce maliyet kontrolü yapan OpenAI veya Codex görselleri &bull; kendi kendine oynayan oynanış testleri &bull; sürüm geçmişi &bull; tek dosya dışa aktarma</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <b>Türkçe</b> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>Paket: <code>@zseven-w/dsh-game-studio</code> &middot; Güncel eklenti sürümü: <code>0.1.0-rc.3</code> &middot; DSH <code>0.2.1-rc.5</code> ile test edildi</sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — tek cümle, oynanabilir bir oyun" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Game Studio kenar çubuğunda çalışan 3D bir oyun ve uygulanmaya hazır yapay zeka görsel adayları" width="100%" />
</p>
<p align="center"><sub>Ajan çalışırken oyun sağ kenar çubuğunda oynanır; altında seçmeniz için numaralandırılmış yapay zeka görsel adayları bekler</sub></p>

## Neden DSH Game Studio

Ajandan günlük dille bir oyun isteyin — "3D bir oyun: kırmızı bir panda ormanda bambu filizleri toplar ve yaban domuzlarından kaçar" — ajan da şablondan bir oyun oluşturur, çalıştığını kontrol etmek için oynar ve hemen oynayabileceğiniz bir kenar çubuğunda gösterir. Karakterler kodla çizilmiş modeller olarak başlar; gerçek görseller istediğinizde ajan OpenAI veya Codex oturumunuzla aday görseller üretir, numarasıyla birini seçersiniz ve oyun onu yerine koyar. Her değişiklik geri dönebileceğiniz bir sürümdür ve bitmiş oyun çevrimdışı tek bir HTML dosyası olarak dışa aktarılır.

| | |
| --- | --- |
| 🎮 **İlk yanıttan itibaren oynanabilir** | İki şablon — 2D üstten görünüşlü bir oyun ve aynı döngünün 3D voksel dünyasındaki hali (three.js) — ajan bunları tarif ettiğiniz oyuna dönüştürür: karakterler, kurallar, seviyeler, ekranlar. |
| 🖥️ **Canlı kenar çubuğu önizlemesi** | Oyun sohbetin yanındaki korumalı bir panelde çalışır, her değişiklikte yeniden derlenir ve altında görsel yuvalarını, adayları ve sürümleri listeler. Yatay oyunlar geniş bir sahne alır. |
| 🎨 **Önce maliyet kontrolüyle kendi görselleriniz** | `game_studio_generate_asset`, OpenAI görsel API'si veya yerel Codex CLI ile yuva başına numaralandırılmış adaylar üretir. Herhangi bir harcama yapılmadan önce hizmeti, görsel sayısını ve beklenen maliyeti gösteren bir onay kartı alırsınız. Sohbete eklediğiniz bir resim referans olabilir. |
| 🤖 **Kendi kendine oynayan oynanış testleri** | `game_studio_playtest` en son kodu başsız (headless) bir Chrome veya Edge'de oynar ve aşamaları, skoru, kare hızını, betik hatalarını ve ekran görüntülerini raporlar. Yön tuşlarıyla yönetilmeyen oyunlar (ızgaralar, kartlar, nişan alma, ritim…) `window.__autoplay` tanımlar, böylece oynanış testi oyunun gerçek döngüsünü oynar. |
| 🕰️ **Sürüm geçmişi** | Oyunu değiştiren her derleme kaydedilir; `game_studio_restore_version` kodu, kuralları ve görselleri birlikte geri getirir. |
| 📦 **Tek dosya dışa aktarma** | `game_studio_export` ağ erişimi olmayan, bağımsız bir HTML dosyası yazar — istediğiniz tarayıcıda açın veya herhangi bir statik barındırma hizmetine koyun. |
| 📱 **Telefonunuzda deneyin** | `game_studio_share` kenar çubuğunda bir QR koduyla yerel ağınızda geçici, salt okunur bir bağlantı açar. |
| 🗂️ **Oyunlarım** | Kenar çubuğundaki **+** ile **Game Studio · My games**'i seçin: çalışma alanındaki her oyun son test görüntüsüyle bir kutucuk olarak listelenir; 2D/3D süzgeci ve tarih, sürüm ya da ada göre sıralama vardır. Tıklayıp oynayın; agent da token da gerekmez. **Export wall**, gösterilen oyunları arkadaşlarınıza gönderebileceğiniz tek bir çevrimdışı sayfada toplar. |

## Onunla yapılan oyunlar

Testlerimizden dört oyun. Her biri yeni bir oturumda, altındaki tek cümleyle başladı (istemler Çinceden çevrildi); bazıları sonradan aynı oturumdaki isteklerle düzeltildi, belirtildiği gibi. Oynanış, her oyunun kendi otomatik oynatıcısıyla kaydedildi.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Ay Işığı Tilkisi: Fener Adası — 3D voksel şablonu, gerçek oynanış" width="640" />
</p>
<p align="center"><sub>Ay Işığı Tilkisi: Fener Adası — 3D voksel şablonu, gerçek oynanış</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Küçük bir oyun yap: yavru bir tilki ay ışığındaki ormanda fener toplasın ve dikenli canavarlardan kaçsın." width="100%" /><br /><sub>“Küçük bir oyun yap: yavru bir tilki ay ışığındaki ormanda fener toplasın ve dikenli canavarlardan kaçsın.”<br />2D şablon; karakterler sonra seçilen yapay zekâ görselleriyle değiştirildi</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="3D bir oyun yap: yavru bir tilki voksel bir adada fener toplasın ve dikenli canavarlardan kaçsın." width="100%" /><br /><sub>“3D bir oyun yap: yavru bir tilki voksel bir adada fener toplasın ve dikenli canavarlardan kaçsın.”<br />3D voksel şablon; fener modeli sonraki bir istekte yeniden yapıldı</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="3D bir oyun yap: yavru bir penguen buzdağında balık toplasın ve foklardan kaçsın." width="100%" /><br /><sub>“3D bir oyun yap: yavru bir penguen buzdağında balık toplasın ve foklardan kaçsın.”<br />3D; kırmızı şapka sonraki bir istekle eklendi</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="3D bir oyun yap: bir kızıl panda bambu ormanında bambu filizi toplasın ve yaban domuzlarından kaçsın." width="100%" /><br /><sub>“3D bir oyun yap: bir kızıl panda bambu ormanında bambu filizi toplasın ve yaban domuzlarından kaçsın.”<br />3D; karakterler sonra yapay zekâ görselleriyle değiştirildi, orman 3D kaldı</sub></td>
</tr>
</table>

## Ne kadar iyi çalışıyor

Gerçek bir DSH içinde DeepSeek-V4.1-Flash ile ölçüldü; her oyun yeni bir oturumda tek bir cümleden üretildi ve bağımsız bir oynanış testiyle puanlandı (2026-11-04/05):

- **Topla ve kaç oyunları** (şablonların kendi alanı): 10 farklı isteğin 10'u da ilk denemede oynanabilir durumdaydı; oyun başına ortanca süre yaklaşık 14 dakika.
- **Diğer türler** — 3'lü eşleştirme, kutu itme, kule savunma, basketbol, platform, ritim, yarış, kart savaşı, çiftçilik, kafe yönetimi: 10'unun tamamı oynanabilir çıktı ancak ortanca yaklaşık 26 dakika sürdü. `__autoplay`, özel görsel yuvaları ve yatay mod desteği eklendikten sonra dördü yeniden çalıştırıldı ve 8–18 dakika sürdü. Örneklem küçüktür.

## Araçlar

| Araç | Ne yapar |
| --- | --- |
| `game_studio_create` | `collector` (2D) veya `voxel` (3D) şablonundan oynanabilir bir oyun oluşturur, derler ve kenar çubuğunda gösterir. Başlığı, bir görsel stilini, `orientation` (dikey veya yatay) değerini ve `slots` — oyunun kullanıcının dilinde adlandırılmış kendi görsel yuvalarını — alır. |
| `game_studio_build` | `game.json` veya `game.js` düzenlendikten sonra yeniden derler, önizlemeyi yeniler ve kısa bir notla bir sürüm kaydeder. |
| `game_studio_playtest` | En son kodu başsız (headless) modda (telefon boyutunda dikey veya 960×540 yatay) oynar ve aşamaları, en iyi skoru, canları, fps değerini, hataları ve ekran görüntülerini raporlar; `characters: true` yalnızca karakterlerin yakın çekimlerini döndürür. |
| `game_studio_generate_asset` | İsteğe bağlı olarak bir referans resmi takip ederek `openai` veya `codex` ile bir yuva için 1–4 aday görsel üretir. Harcama yapmadan önce onay ister. Codex arka planda çalışır. |
| `game_studio_apply_asset` | Bir adayı numarasına göre oyuna yerleştirir, yeniden derler ve yeniler. |
| `game_studio_revert_asset` | Bir yuvanın önceki görseline geri döner. |
| `game_studio_versions` | Kaydedilen sürümleri en yeniden başlayarak listeler. |
| `game_studio_restore_version` | Tüm oyunun daha önceki bir sürümünü geri yükler. |
| `game_studio_export` | Tek bir bağımsız, çevrimdışı HTML dosyası dışa aktarır. |
| `game_studio_share` | Bir telefonun oyunu oynayabilmesi için yerel ağda geçici, salt okunur bir bağlantı açar (veya kapatır). |
| `game_studio_list` | Çalışma alanındaki oyunları başlık, 2D/3D, derleme durumu ve sürüm sayısıyla listeler; agent "o penguen oyununu" adından bulur. |
| `game_studio_export_wall` | Oyun duvarını dışa aktarır: derlenmiş her oyun için bir kutucuk içeren çevrimdışı bir HTML sayfası; kutucuğa tıklayınca oyun açılır. |

Kenar çubuğunun düğmeleri (uygula, geri al, derle, dışa aktar, geri yükle, paylaş) aynı işlemleri `/game-studio` komutu üzerinden çağırır.

## Görsel hizmetleri ve harcama

| Hizmet | Gereksinimler | Maliyet | Notlar |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | DSH kimlik bilgilerinde veya ortamda bir API anahtarı (varsayılan olarak `OPENAI_API_KEY`) | Görsel başına anahtarınıza faturalandırılır; onay kartı bir tahmin gösterir | Parti başına yaklaşık bir dakika. `openaiBaseUrl`, OpenAI uyumlu bir ağ geçidini kabul eder. |
| **Codex CLI** | Kurulu ve oturum açılmış Codex (`codex login`) | Codex planınıza sayılır; API anahtarı gerekmez | Görsel başına birkaç dakika sürer, arka planda çalışır ve bittiğinde bildirir. |

`imageProvider: auto` (varsayılan), anahtarı ayarlandığında OpenAI'ı, aksi halde Codex'i kullanır. `confirmSpending` açıkken (varsayılan) siz kartı onaylayana kadar hiçbir şey üretilmez. Sprite'lar sunulmadan önce şeffaf arka plan ve kadraj açısından kontrol edilir ve yuvaya sığdırılır.

## Güvenlik ve gizlilik

- Oyunlar, ağ erişimini engelleyen bir içerik güvenlik politikasına sahip korumalı bir iframe içinde çalışır; dışa aktarılan dosyalar hiçbir ağ isteği yapmaz.
- Makinenizin dışına gönderilen tek şey, seçtiğiniz görsel hizmetine gönderilen istemler — ve verirseniz referans resimdir.
- Paylaşım bağlantısı salt okunurdur, yalnızca o oyunun derlemesini sunar, yalnızca yerel ağınızı dinler ve belirlediğiniz sürenin sonunda (varsayılan olarak 30 dakika) kapanır.
- API anahtarları DSH kimlik bilgilerinden veya ortamdan okunur ve asla projelere, günlüklere veya araç sonuçlarına yazılmaz.

## Gereksinimler

- DeepSeek Harness `0.2.1` veya üzeri (web veya masaüstü), Node.js `24.11` veya üzeri.
- Oynanış testleri için aynı bilgisayarda Google Chrome veya Microsoft Edge.
- Yapay zeka görselleri için bir OpenAI API anahtarı veya oturum açılmış Codex CLI. İkisi de olmadan oyunlar kodla çizilmiş karakterleriyle çalışmaya devam eder.

## DSH'ye kurulum

npm'den bir DSH profiline kurun:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Hızlı başlangıç

Bir çalışma alanı klasöründe oturum açın ve örneğin şunları isteyin:

- `Küçük bir oyun yap: bir yavru kedi mutfakta robot süpürgeye çarpmadan kurutulmuş balıkları çalsın.`
- `3D bir oyun yap: küçük bir şövalye kalede altın toplasın ve iskeletlerden kaçsın; 60 saniyede 20 altın toplamak kazandırsın.`
- `6×6 ızgarada bir 3'lü eşleştirme oyunu yap; kazanmak için 60 saniyede 1000 puana ulaşılsın.`

Ardından şunları deneyin:

- `Kahraman için yapay zekayla 2 yeni görsel üret; kenar çubuğundan seçeceğim.`
- `Kahramanın görünümü için eklediğim resmi takip et.`
- `Tek bir HTML dosyası olarak dışa aktar.`

## Yapılandırma

Bunları profilinizin `cordis.patch.yml` dosyasındaki `config` altında ayarlayın:

| Seçenek | Varsayılan | Anlamı |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` veya `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | OpenAI görsel modeli; sonuçların karşılaştırılabilir kalması için sabitleyin. |
| `openaiBaseUrl` | OpenAI | OpenAI uyumlu temel URL, örn. bir şirket ağ geçidi. |
| `openaiCredential` | `OPENAI_API_KEY` | Anahtarı tutan kimlik bilgisinin veya ortam değişkeninin adı. |
| `codexPath` | `PATH` üzerinde veya giriş kabuğu aracılığıyla bulunur | Codex CLI çalıştırılabilir dosyası. |
| `codexModel` | Codex'in varsayılanı | Codex görsel çalıştırmaları için model. |
| `codexReasoningEffort` | `low` | Codex görsel çalıştırmaları için akıl yürütme çabası. |
| `codexTimeoutMinutes` | `15` | Bu sürenin sonunda bir Codex görselinden vazgeç. |
| `confirmSpending` | `true` | Her üretimden önce onay iste. |

## Oyun projesi biçimi

Her oyun, çalışma alanınızda düz bir klasördür:

- `game.json` — başlık, görsel stili, yönelim, görsel yuvaları ve kurallar. Kurallar serbest biçimlidir: her anahtar oyuna `window.GAME.rules` olarak iletilir.
- `game.js` — ajanın düzenlediği oyun kodu. Oynanış testleri için `window.__gameState()` işlevini, yön tuşlarıyla yönetilmeyen oyunlar için isteğe bağlı olarak `window.__autoplay(state)` işlevini ve kenar çubuğunun kodla çizilmiş karakterleri göstermesi için `window.__renderSlots(size)` işlevini dışa açar (2D şablonu bunları `drawCharacter()` içinde çizer).
- `assets/` — her yuvanın resmi ve her birinin nereden geldiğinin kaydı olan `ASSETS.json`. Bir yuvanın dosyasının üzerine doğrudan çizim yapabilirsiniz; stüdyo bunu sizin düzenlemeniz olarak kaydeder.
- `dist/index.html` — güncel derleme; `.studio/` sürümleri, adayları ve oynanış testi çalıştırmalarını tutar.

## Geliştirme

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Ekosistem

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / Codex üzerinden DSH ajanlarına iş gönderin
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — sohbet içinde canlı bir iOS Simülatörü veya USB iPhone
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — sohbet içinde canlı bir Android emülatörü veya USB cihazı
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH için uzun süreli bellek
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — bir sohbet içinde `.op` tasarım belgelerini inceleyin ve düzenleyin

## Teşekkür &amp; Lisans

- [three.js](https://github.com/mrdoob/three.js) — voksel oyunlarına dahil edilen 3D çalışma zamanı (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — kenar çubuğunun paylaşım panelindeki QR kodu (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — oynanış testleri için tarayıcıyı yönetir (Apache-2.0; çalışma zamanı bağımlılığı).
- Şablonlar, sprite'lar ve voksel modelleri bu projeye özgüdür.
- Tam bildirimler için [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) dosyasına bakın.

**Lisans**: MIT
