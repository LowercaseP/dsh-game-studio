<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Descreva um pequeno jogo em uma frase — jogue na barra lateral de uma conversa do <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>, troque por arte gerada por IA e exporte um único arquivo HTML.</strong><br />
  <sub>10 ferramentas de agente &bull; prévia ao vivo na barra lateral &bull; modelos 2D e voxel 3D &bull; arte via OpenAI ou Codex com verificação prévia de custo &bull; playtests automáticos &bull; histórico de versões &bull; exportação em arquivo único</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <b>Português</b> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>Pacote: <code>@zseven-w/dsh-game-studio</code> &middot; Versão atual do plugin: <code>0.1.0-rc.3</code> &middot; Testado com DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — uma frase, um jogo jogável" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Um jogo 3D rodando na barra lateral do Game Studio, com opções de arte de IA prontas para aplicar" width="100%" />
</p>
<p align="center"><sub>O jogo roda na barra lateral direita enquanto o agente trabalha; opções numeradas de arte de IA ficam logo abaixo para você escolher</sub></p>

## Por que usar o DSH Game Studio

Peça um jogo ao agente em palavras simples — "um jogo 3D: um panda-vermelho coleta brotos de bambu em uma floresta e desvia de javalis" — e ele cria um a partir de um modelo, joga para verificar se funciona e o exibe em uma barra lateral onde você pode jogar na hora. Os personagens começam como modelos desenhados por código; quando você quiser arte de verdade, o agente gera opções com a OpenAI ou com o seu login do Codex, você escolhe uma pelo número e o jogo faz a troca. Cada alteração é uma versão para a qual você pode voltar, e o jogo finalizado é exportado como um único arquivo HTML offline.

| | |
| --- | --- |
| 🎮 **Jogável desde a primeira resposta** | Dois modelos — um jogo 2D visto de cima e o mesmo ciclo em um mundo voxel 3D (three.js) — que o agente molda no jogo que você descreveu: personagens, regras, fases e telas. |
| 🖥️ **Prévia ao vivo na barra lateral** | O jogo roda em um painel em sandbox ao lado da conversa, é reconstruído a cada alteração e lista os espaços de arte, as opções geradas e as versões logo abaixo. Jogos em modo paisagem ganham um palco mais largo. |
| 🎨 **Sua própria arte, com verificação prévia de custo** | `game_studio_generate_asset` cria opções numeradas por espaço de arte com a API de imagens da OpenAI ou com a CLI local do Codex. Antes de qualquer gasto, você recebe um cartão de aprovação com o serviço, a quantidade de imagens e o custo esperado. Uma imagem anexada por você no chat pode servir de referência. |
| 🤖 **Playtests automáticos** | `game_studio_playtest` joga o código mais recente em um Chrome ou Edge em modo headless e informa fases, pontuação, taxa de quadros, erros de script e capturas de tela. Jogos que não são guiados pelas setas do teclado (grades, cartas, mira, ritmo…) definem `window.__autoplay`, para que o playtest jogue o ciclo real deles. |
| 🕰️ **Histórico de versões** | Cada build que alterou o jogo é salvo; `game_studio_restore_version` traz de volta código, regras e arte juntos. |
| 📦 **Exportação em arquivo único** | `game_studio_export` grava um arquivo HTML autossuficiente sem acesso à rede — abra em qualquer navegador ou coloque em qualquer hospedagem estática. |
| 📱 **Teste no seu celular** | `game_studio_share` abre um link temporário somente leitura na sua rede local, com um QR code na barra lateral. |
| 🗂️ **Meus jogos** | Abra o **+** da barra lateral e escolha **Game Studio · My games**: cada jogo do espaço de trabalho como um bloco com a imagem do último teste, com filtro 2D/3D e ordem por data, versões ou nome. Um clique para jogar, sem agente e sem tokens. **Export wall** junta os jogos exibidos numa única página offline para enviar aos amigos. |

## Jogos feitos com ele

Quatro jogos dos nossos testes. Cada um começou com a frase abaixo dele, numa sessão nova (prompts traduzidos do chinês); em alguns, pedidos posteriores na mesma sessão fizeram ajustes, como indicado. As partidas foram gravadas com o piloto automático de cada jogo.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Raposa ao luar: Ilha das Lanternas — template voxel 3D, partida real" width="640" />
</p>
<p align="center"><sub>Raposa ao luar: Ilha das Lanternas — template voxel 3D, partida real</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Faça um joguinho: uma raposinha coleta lanternas numa floresta ao luar e desvia de monstros de espinhos." width="100%" /><br /><sub>“Faça um joguinho: uma raposinha coleta lanternas numa floresta ao luar e desvia de monstros de espinhos.”<br />Template 2D; personagens trocados depois por arte de IA escolhida</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="Faça um jogo 3D: uma raposinha coleta lanternas numa ilha de voxels e desvia de monstros de espinhos." width="100%" /><br /><sub>“Faça um jogo 3D: uma raposinha coleta lanternas numa ilha de voxels e desvia de monstros de espinhos.”<br />Template voxel 3D; o modelo da lanterna foi refeito num pedido posterior</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="Faça um jogo 3D: um pinguinzinho coleta peixes num iceberg e desvia de focas." width="100%" /><br /><sub>“Faça um jogo 3D: um pinguinzinho coleta peixes num iceberg e desvia de focas.”<br />3D; o gorro vermelho veio de um pedido posterior</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="Faça um jogo 3D: um panda-vermelho coleta brotos de bambu num bambuzal e desvia de javalis." width="100%" /><br /><sub>“Faça um jogo 3D: um panda-vermelho coleta brotos de bambu num bambuzal e desvia de javalis.”<br />3D; personagens trocados depois por arte de IA, a floresta continua 3D</sub></td>
</tr>
</table>

## Quão bem funciona

Medido em um DSH real com DeepSeek-V4.1-Flash, cada jogo feito a partir de uma frase em uma sessão nova, avaliado por um playtest independente (2026-11-04/05):

- **Jogos de coletar e desviar** (a especialidade dos modelos): 10 de 10 pedidos diferentes ficaram jogáveis na primeira tentativa, com mediana de cerca de 14 minutos por jogo.
- **Outros gêneros** — combinar 3 (match-3), empurrar caixas, tower defense, basquete, plataforma, ritmo, corrida, batalha de cartas, fazenda, gerenciamento de cafeteria: todos os 10 saíram jogáveis, mas levaram uma mediana de cerca de 26 minutos. Após adicionar `__autoplay`, espaços de arte personalizados e suporte a modo paisagem, quatro deles foram executados novamente e levaram de 8 a 18 minutos. A amostra é pequena.

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `game_studio_create` | Cria um jogo jogável a partir do modelo `collector` (2D) ou `voxel` (3D), faz o build e o exibe na barra lateral. Recebe o título, um estilo de arte, `orientation` (retrato ou paisagem) e `slots` — os espaços de arte próprios do jogo, nomeados no idioma do usuário. |
| `game_studio_build` | Reconstrói após editar `game.json` ou `game.js`, atualiza a prévia e salva uma versão com uma nota curta. |
| `game_studio_playtest` | Joga o código mais recente em modo headless (retrato no formato de celular ou paisagem em 960×540) e informa fases, melhor pontuação, corações, fps, erros e capturas de tela; `characters: true` retorna apenas closes dos personagens. |
| `game_studio_generate_asset` | Gera de 1 a 4 imagens candidatas para um espaço de arte com `openai` ou `codex`, opcionalmente seguindo uma imagem de referência. Pede aprovação antes de gastar. O Codex roda em segundo plano. |
| `game_studio_apply_asset` | Coloca uma opção gerada no jogo pelo número, reconstrói e atualiza. |
| `game_studio_revert_asset` | Volta para a arte anterior de um espaço. |
| `game_studio_versions` | Lista as versões salvas, da mais recente para a mais antiga. |
| `game_studio_restore_version` | Restaura uma versão anterior do jogo inteiro. |
| `game_studio_export` | Exporta um único arquivo HTML autossuficiente e offline. |
| `game_studio_share` | Abre (ou fecha) um link temporário somente leitura na rede local para que um celular possa jogar o jogo. |
| `game_studio_list` | Lista os jogos do espaço de trabalho com título, 2D/3D, estado do build e versões, para o agente achar "o jogo do pinguim" pelo nome. |
| `game_studio_export_wall` | Exporta o mural de jogos: uma página HTML offline com um bloco por jogo compilado; clique num bloco para jogar. |

Os botões da barra lateral (aplicar, reverter, construir, exportar, restaurar, compartilhar) chamam as mesmas operações por meio do comando `/game-studio`.

## Serviços de imagem e gastos

| Serviço | O que precisa | Custo | Notas |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | Uma chave de API nas credenciais do DSH ou no ambiente (`OPENAI_API_KEY` por padrão) | Cobrado por imagem na sua chave; o cartão de aprovação mostra uma estimativa | Cerca de um minuto por lote. `openaiBaseUrl` aceita um gateway compatível com a OpenAI. |
| **Codex CLI** | Codex instalado e autenticado (`codex login`) | Conta na franquia do seu plano do Codex; sem chave de API | Vários minutos por imagem, roda em segundo plano e avisa quando termina. |

`imageProvider: auto` (o padrão) usa a OpenAI quando a chave está definida e o Codex caso contrário. Com `confirmSpending` ativado (o padrão), nada é gerado até que você aprove o cartão. Os sprites têm o fundo transparente e o enquadramento verificados e são ajustados ao espaço antes de serem oferecidos.

## Segurança e privacidade

- Os jogos rodam em um iframe em sandbox com uma política de segurança de conteúdo (CSP) que bloqueia o acesso à rede; os arquivos exportados não fazem requisições de rede.
- As únicas coisas enviadas para fora da sua máquina são os prompts — e a imagem de referência, se você fornecer uma — para o serviço de imagem que você escolher.
- O link de compartilhamento é somente leitura, serve apenas o build daquele jogo, escuta somente na sua rede local e fecha após o tempo que você definir (30 minutos por padrão).
- As chaves de API são lidas das credenciais do DSH ou do ambiente e nunca são gravadas em projetos, logs ou resultados de ferramentas.

## Requisitos

- DeepSeek Harness `0.2.1` ou superior (web ou desktop), Node.js `24.11` ou superior.
- Google Chrome ou Microsoft Edge no mesmo computador para os playtests.
- Para arte com IA, uma chave de API da OpenAI ou a CLI do Codex autenticada. Sem nenhum dos dois, os jogos ainda funcionam com seus personagens desenhados por código.

## Instalar no DSH

Instale a partir do npm em um perfil do DSH:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Início rápido

Abra uma sessão em uma pasta de workspace e peça, por exemplo:

- `Faça um jogo pequeno: um gatinho rouba peixe seco em uma cozinha sem esbarrar no robô aspirador.`
- `Faça um jogo 3D: um pequeno cavaleiro coleta moedas em um castelo e evita esqueletos; coletar 20 moedas em 60 segundos vence.`
- `Faça um jogo de combinar 3 em uma grade 6×6; alcance 1000 pontos em 60 segundos para vencer.`

Depois experimente:

- `Gere 2 novas artes para o herói com IA; vou escolher na barra lateral.`
- `Siga a imagem que anexei para o visual do herói.`
- `Exporte como um único arquivo HTML.`

## Configuração

Defina estas opções em `config` no arquivo `cordis.patch.yml` do seu perfil:

| Opção | Padrão | Significado |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` ou `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | Modelo de imagem da OpenAI; fixe-o para que os resultados permaneçam comparáveis. |
| `openaiBaseUrl` | OpenAI | URL base compatível com a OpenAI, por exemplo, um gateway corporativo. |
| `openaiCredential` | `OPENAI_API_KEY` | Nome da credencial ou variável de ambiente que guarda a chave. |
| `codexPath` | encontrado no `PATH` ou pelo shell de login | Executável da CLI do Codex. |
| `codexModel` | Padrão do Codex | Modelo para execuções de imagem do Codex. |
| `codexReasoningEffort` | `low` | Esforço de raciocínio para execuções de imagem do Codex. |
| `codexTimeoutMinutes` | `15` | Desiste de uma imagem do Codex após esse tempo. |
| `confirmSpending` | `true` | Pede aprovação antes de cada geração. |

## Formato do projeto de jogo

Cada jogo é uma pasta simples no seu workspace:

- `game.json` — título, estilo de arte, orientação, espaços de arte e regras. As regras têm formato livre: qualquer chave é passada para o jogo como `window.GAME.rules`.
- `game.js` — o código do jogo que o agente edita. Ele expõe `window.__gameState()` para os playtests, opcionalmente `window.__autoplay(state)` para jogos não guiados pelas setas do teclado, e `window.__renderSlots(size)` para que a barra lateral mostre os personagens desenhados em código (o modelo 2D os desenha em `drawCharacter()`).
- `assets/` — a imagem de cada espaço mais `ASSETS.json`, o registro de onde cada uma veio. Você pode desenhar diretamente sobre o arquivo de um espaço; o estúdio registra isso como uma edição sua.
- `dist/index.html` — o build atual; `.studio/` guarda versões, opções geradas e execuções de playtest.

## Desenvolvimento

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Ecossistema

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — envie tarefas para agentes do DSH a partir do Claude Code / Codex
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — um Simulador de iOS ou iPhone via USB ao vivo dentro da conversa
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — um emulador de Android ou dispositivo via USB ao vivo dentro da conversa
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memória de longo prazo para o DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspecione e edite documentos de design `.op` dentro de uma conversa

## Créditos e Licença

- [three.js](https://github.com/mrdoob/three.js) — o runtime 3D embutido nos jogos voxel (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — o QR code no painel de compartilhamento da barra lateral (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — controla o navegador para os playtests (Apache-2.0; dependência de execução).
- Os modelos, sprites e modelos voxel são originais deste projeto.
- Veja [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) para os avisos completos.

**Licença**: MIT
