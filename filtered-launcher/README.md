# Filtered Launchers (Sandustry)

Dois blocos na aba **Logistics**: **Filtered Launcher** e **Advanced
Filtered Launcher**. Cada um constrói e arrasta exatamente como o
**Launcher** vanilla — arrasta pra cima vira o segmento Up, arrasta
pra um canto vira Left/Right, é o mesmo ícone único trocando de tipo
durante o arrasto, igual o jogo original faz. Cada um é, ao mesmo
tempo, um Filter de verdade: **equipe um deles igual ao Filter/Advanced
Filter vanilla correspondente** (hotbar ou menu de construção) e a
tela **nativa** do próprio jogo aparece pra você escolher que recursos
passam, antes mesmo de construir. Blocos já colocados ganham as mesmas
caixinhas clicáveis que um Filter vanilla mostra na tela enquanto você
tem o item equipado, pra redirecionar essa mesma tela e editar um já
existente. Passar o mouse por cima mostra "Filter" igual um Filter
vanilla, e segurando o **Grabber** mostra o resumo Allow/Block ao
vivo. Só o que estiver liberado é lançado; o resto simplesmente
**passa direto** pelo tile em vez de ficar bloqueado (ver item #12 —
não é um Filter tradicional, nunca impede nada de entrar).

- **Filtered Launcher** pareia com o **Filter** comum e lança na
  velocidade do **Launcher** vanilla padrão: um recurso por vez,
  sólidos por padrão (dá pra ligar líquidos/gases na config do mod).
  Ícone: o sprite do Launcher vanilla com uma barra + "F" em
  preto/cinza (as mesmas cores que o sprite já tem).
- **Advanced Filtered Launcher** pareia com o **Advanced Filter**
  (Filter Mk2) **e** lança na velocidade do **Launcher Mk2** (2x mais
  rápido) — as duas metades avançadas juntas, não só o filtro:
  múltiplos recursos ao mesmo tempo, líquidos e gases sempre ligados
  (igual o Advanced Filter vanilla, independente da config do mod).
  Mesmo ícone do Filtered Launcher, só que com algumas marcas
  **vermelhas** por cima, pra diferenciar os dois na hotbar/inventário.

## Por que um bloco só (por variante)

Hoje já dá pra fazer isso colocando um Filter (ou Advanced Filter) do
lado de um Launcher — isso já funciona, sem mod nenhum. Esses blocos
existem pra virar **um** bloco em vez de dois: economiza tile e
clique, que foi exatamente o que foi pedido (um launcher que também é
filter, não uma receita de combinar dois blocos vanilla) — e depois
estendido pra também cobrir a versão Advanced.

## Instalar

Copie a pasta `filtered-launcher` para `%APPDATA%\sandustry\mods\`.

## Verifiquei o Workshop antes de criar

Busquei "launcher" e "filter" nas ~30 entradas que batem com esses
termos (Fast Launchers, Rockets Expanded, Tiered Machinery and
Logistics, Filter Sensors, Sweeper Drone Material Filter, Filter
Mk2/Instant Filter, etc.) — nenhum combina os dois: ou é só ajuste de
velocidade/recarga de launcher, ou é só ferramenta de filtro/sensor.
Não achei nada que lance e filtre no mesmo bloco.

## Achado técnico principal (lendo bundle.js / simulation-worker.js)

Usei a mesma cópia extraída do jogo que o `validate-mod.js` usa
(`%TEMP%\sandustry-extract`) pra confirmar isso antes de escrever
qualquer linha:

1. **Lançar é um mecanismo público de verdade.** O próprio Launcher
   Mk2 vanilla (upgrade real, não mod) é implementado internamente
   chamando a mesma função que este mod chama:
   `sandkit.api.structureBehaviors.registerLauncherType({upType, leftType,
   rightType, velocity, softDropVelocity})`. Todo lugar do jogo que
   pergunta "essa célula é um launcher?" já consulta esse mesmo registro
   (`session.sandkit.registeredLauncherTypes`) — um tipo registrado
   assim é launcher de verdade pro jogo inteiro. `velocity`/
   `softDropVelocity` no código foram copiados literalmente dos dados
   de balanceamento do Launcher padrão (não-Mk2), então lança na mesma
   velocidade do vanilla.

2. **Filtro é propriedade do tile, não do tipo de estrutura.** Qualquer
   estrutura com um objeto `.filter` tem esse filtro codificado nos
   próprios bits da célula assim que é construída/atualizada — mesmo
   passo que Filter, Filter Wall, Critter Fence e Grower vanilla usam.
   A checagem "esse elemento pode atravessar essa célula" que roda a
   cada tick lê esses mesmos bits diretamente, sem saber (ou ligar) que
   tipo de estrutura é dona da célula. É isso que torna a combinação
   possível.

   A API pública não tem uma chamada direta "define o `.filter` dessa
   estrutura" (`api.structures.setData` só mexe em `.data`). Mas
   `api.structures.getAtCell` devolve o objeto de verdade, mutável, que
   a simulação lê — o mod pega esse objeto, define `.filter` nele
   direto e chama `api.structures.update(...)` em cima.

## Bugs reais, achados testando no jogo, e a causa de cada um

A primeira versão parecia certa lendo o código, mas testar no jogo de
verdade (por três rodadas de feedback) mostrou problemas diferentes.
Guardando aqui a causa raiz de cada um:

### 1. Apareciam 3 ícones no menu (Up/Left/Right), não 1

Causa: os três tipos eram desbloqueados via
`api.player.buildings.unlockByType()`, e o desbloqueio **não** é o que
decide se um tipo ganha ícone próprio no menu. O interruptor de
verdade — achado lendo o código de **outro** mod da comunidade dentro
do mesmo `bundle.js` (o "Earth Stratacore", que se esconde do menu
depois de construído uma vez) — é um campo explícito:
`hideFromBuildMenu: true`. Agora Left/Right declaram esse campo (e
continuam desbloqueados, pra ferramenta de arrasto poder construí-los
de verdade); só o Up fica sem ele.

### 2. Os blocos colocados ficavam invisíveis, depois gigantes

Duas causas, uma depois da outra:

- `render.imageName` apontava pros sprites vanilla
  (`"launcher"`/`"launcher_left"`/`"launcher_right"`), supondo que
  dava pra reaproveitar uma imagem que o próprio jogo já carrega.
  Errado — a renderização nativa das estruturas de enum não passa pelo
  registro de sprites de mod nenhuma vez; vem direto do atlas de
  textura interno do jogo, que o caminho genérico de mod nunca
  preenche com esses nomes. Corrigido carregando 3 PNGs próprios via
  `api.sprites.loadFromMod`.
- A correção acima **também** copiou o *tamanho* de render do Launcher
  vanilla (4x4/4x6 células em pixels), supondo que isso importava pra
  continuidade visual do jeito que importa pro Launcher de verdade
  (que arrasta um eixo multi-célula). Não se aplica aqui: este mod não
  tem matriz de "shape" nenhuma (ver nota do buildModes abaixo), então
  cada segmento colocado tem exatamente 1 célula de área — uma imagem
  de 4-6 células boiando sobre um bloco de 1 célula fica visualmente
  enorme comparado aos vizinhos. Corrigido renderizando cada segmento
  na proporção nativa do próprio sprite (18x18/18x26) encaixada numa
  caixa de 1 célula.

**Ícone (dois pedidos novos):** os PNGs agora são o **sprite de
verdade** do Launcher vanilla (`base_launcher_up/left/right.png`,
cópias literais de `launcher.png`/`launcher_left.png`/
`launcher_right.png` do próprio jogo, incluídas na pasta) — não é mais
um ícone desenhado do zero. Primeira versão desse sprite tinha marcas
azuis; trocado por pedido: agora é uma **barra cinza** atravessando o
interior transparente do sprite (ligando a borda esquerda à direita,
"soldada" no frame) com um **"F"** preto desenhado por cima, usando só
as duas cores que o próprio sprite vanilla já tem (preto do contorno,
cinza da faixa) — nenhuma cor nova. `gen_sprites.py` desenha isso (rode
`python3 gen_sprites.py` pra regenerar depois de mudar as coordenadas,
ou troque os `base_*.png` por outra arte inteiramente).

### 3. Não usava a tela de filtro nativa (quatro tentativas)

Essa foi a parte mais difícil de acertar — quatro rodadas até entender
como o jogo de verdade organiza isso:

**Tentativa 1:** troquei `tooltipHover` pra `type:"custom"` e construí
um painel do zero (overlay React via `action:intercept` +
`api.ui.inject`). Funcionou, mas era uma reimplementação, não a tela
real do jogo — você pediu especificamente pela tela nativa.

**Tentativa 2:** achei que o editor nativo (`filterGroupEditor`) só
precisava reconhecer o tipo, então rastreei uma lista fixa, escrita na
mão, de seis strings vanilla (`FilterLeft`, `FilterRight`,
`"filterLeftMk2"`, `"filterRightMk2"`, `"filterWall"`,
`"filterWallMk2"`) e acrescentei os três ids deste mod nela. Melhorou,
mas ainda não abria com um clique simples num bloco já colocado — o que
revelou o problema de verdade: **esse editor nunca abriu com um clique
simples, nem em Filter vanilla**. Ele é um overlay do **modo de
construção**, ligado a `session.building.activeStructureType` — só
aparece enquanto o item Filter está **equipado** como ferramenta ativa.

**Tentativa 3:** voltei pro painel próprio (igual Tentativa 1) só pra
reabrir a configuração de um bloco **já colocado** via clique, mantendo
`tooltipHover:{type:"filter"}` pelo hover/Grabber de graça. Só que o
`action:intercept` desse painel intercepta **todo** clique num bloco
deste mod, incondicionalmente — então mesmo com os dois patches abaixo
já aplicados, o painel deste mod sempre ganhava na frente de qualquer
coisa nativa tentando acontecer por baixo. Foi nessa hora que você
apontou que o pedido nunca foi sobre clicar num bloco já colocado, e
sim sobre a tela que aparece **ao selecionar** o item novo.

**Causa raiz de verdade, achada rastreando o código de seleção de
hotbar:** existe uma **segunda** lista fixa, separada da do editor,
que decide se selecionar aquele item liga a flag
`activeStructureType` (sem essa flag ligada, o editor nunca é
consultado). E os retângulos clicáveis que aparecem sobre Filters já
colocados na tela (pra redirecionar o editor pra eles) têm a **mesma
trava**: só ficam visíveis enquanto você está com um item de filtro
equipado — não é "sempre visível para qualquer Filter no mapa" como eu
supunha, é "só enquanto a ferramenta está ativa", igual o editor em si.

Isso explica tudo: com as duas listas certas estendidas, o fluxo nativo
completo (tela ao selecionar + caixinhas clicáveis sobre os já
colocados) já fica disponível de graça — a única coisa impedindo de
funcionar era o painel deste mod, que sempre capturava o clique antes.
**Solução final: removi o painel próprio inteiro.** `tooltipHover`
continua `{type:"filter"}` (hover "Filter" e resumo no Grabber, de
graça), e `patches.json` estende as duas listas — cada uma uma linha,
puramente aditiva, sem mudar nada de como são usadas:

- a lista que o editor (`bk()`) consulta pra saber se deve aparecer;
- a lista, separada, no código de seleção de hotbar, que liga
  `activeStructureType` quando você escolhe aquele item.

**Tentativa 4 (correção seguinte):** com as duas listas acima já
aplicadas, você reportou um bug novo: o item vinha com "Sand" marcado
por padrão, e escolher **qualquer outro** elemento na telinha fazia ele
"virar um filter normal". Rastreei o clique de escolher elemento na
tela e achei a causa: depois de aplicar o elemento escolhido, em modo
de seleção única, o código fecha a telinha e — **incondicionalmente**
— faz `activeStructureType = (é Mk2? "filterRightMk2" : FilterRight)`.
Ele só conhecia duas famílias possíveis (Filter comum e Advanced
Filter/Mk2) e sempre reseta pra uma das duas, não importa o que
realmente estava equipado — uma terceira família customizada nunca foi
prevista.

Corrigido com mais um patch pequeno e aditivo: só cai nesse reset
padrão quando o tipo equipado **não** é já um tipo de filtro reconhecido
(`bk(activeStructureType)`) — pra Filter/Advanced Filter vanilla isso é
exatamente o valor que já estava lá (comportamento idêntico, bit a
bit), e pros tipos deste mod (que já estão na lista do `bk()` graças ao
primeiro patch) simplesmente deixa o tipo certo no lugar em vez de
sobrescrever.

Um detalhe cosmético que sobra: o título da tela é decidido por um
`if/else` que só conhece os nomes "Filter"/"Filter Wall"/"Filter Mk2"
— pra qualquer outro tipo (o nosso incluso) ele cai no genérico
"Filter". Funcionalmente não muda nada (allow/block e a lista de
elementos funcionam normal), só o título da janela que não vai dizer
"Filtered Launcher".

### 4. O filtro não funcionava — bloqueava tudo, mesmo o que devia passar

Testado com Gold liberado no filtro: nunca era lançado, de jeito
nenhum. Rastreei a própria função de "devo lançar o que está em mim
agora" do launcher, em `simulation-worker.js`. Pra um tipo de launcher
**customizado**, se o material sentado nele ainda não é uma partícula
em voo, o código lê
`registeredLauncherTypes[...].runTickSharedBufferKey` e, se esse campo
não existir, **sempre** retorna sem fazer nada — pra sempre, todo
tick. Este mod nunca configurava esse campo (era exatamente a parte
sinalizada como "não confirmada" no ponto de honestidade da versão
anterior deste arquivo). O Launcher padrão nativo nem passa por esse
código — tipos nativos vão direto pra uma checagem simples de liga/
desliga (`machineryEngine.runLaunchers`). Só o upgrade Mk2 usa
`runTickSharedBufferKey`, junto de um gatilho de tick próprio do lado
do worker (`workers.triggers`, que não faz parte da API pública),
só pra poder disparar 2x mais rápido que o normal.

Como este mod só precisa da velocidade vanilla (não-Mk2) mesmo,
replicar toda a máquina de buffer-compartilhado/gatilho-de-worker do
Mk2 seria resolver o problema errado. Em vez disso, `patches.json` faz
um tipo de launcher customizado **sem** `runTickSharedBufferKey` cair
na mesma checagem `machineryEngine.runLaunchers` que o Launcher vanilla
já usa — uma mudança pequena e aditiva (um `if(!t){...}else{...}`
envolvendo o retorno antecipado que já existia) que não muda em nada o
comportamento de nenhum launcher vanilla ou Mk2 (Mk2 sempre tem a
chave, tipos nativos nem passam por esse trecho).

### 5. Item novo: Advanced Filtered Launcher

Pedido novo: um segundo bloco, mesma ideia, mas pareado com o
**Advanced Filter** (Filter Mk2) em vez do Filter comum — múltiplos
recursos ao mesmo tempo, líquidos/gases sempre ligados. Reaproveitando
tudo que já tinha sido descoberto no item #3, faltava só **mais uma**
lista fixa: `Uk`, separada de `mk`/`pk`, que decide se a tela de
filtro roda em "modo Mk2" (checkboxes de múltipla escolha em vez de
clique único) e — de brinde — escolhe o título "Advanced Filter" em
vez do genérico "Filter" (resolve sozinho a nota cosmética do item #3
pra esse bloco). Só estar na `Uk` não basta: os três ids também
precisam estar na `mk`/lista de hotbar do item #3, senão a tela nem
chega a reconhecer o tipo pra começar — `Uk` só muda o **comportamento**
da tela depois que ela já concordou em aparecer. Mais um patch pequeno
e aditivo, mesmo formato dos outros quatro.

O padrão de filtro inicial (`defaultFilterFor`) agora recebe se é a
variante avançada: pra ela, `affectsLiquid`/`affectsGas` sempre saem
`true`, **ignorando** a configuração do mod — igual o Advanced Filter
vanilla, que também não dá opção de desligar isso.

**Ícone (pedido novo):** o mesmo sprite do Filtered Launcher (barra +
"F" em preto/cinza), só que com algumas marcas vermelhas carimbadas
por cima — cor que não existe no sprite vanilla original, usada só
pra diferenciar os dois na hotbar/inventário à primeira vista.
`gen_sprites.py` agora gera os dois conjuntos de uma vez (3 sprites
`filteredLauncher*.png` + 3 `advancedFilteredLauncher*.png`) a partir
dos mesmos `base_launcher_*.png`.

**Velocidade (pedido seguinte):** a primeira versão do Advanced
Filtered Launcher lançava na mesma velocidade do Launcher padrão —
só o filtro tinha virado "avançado", não o launcher. Corrigido:
`registerLauncherType` agora recebe `velocity`/`softDropVelocity`
diferentes por família, copiados literalmente dos dados de
balanceamento do **Launcher Mk2** vanilla (o dobro do padrão) pra essa
variante. `runTickSharedBufferKey` continua de fora pras duas famílias
— esse campo só afeta a **cadência** (de quanto em quanto tempo o
launcher pode disparar), que é o motivo do Mk2 vanilla precisar dele
(pra disparar 2x mais rápido que o padrão); `velocity` é só a
velocidade de saída do material já lançado, e não depende disso — a
checagem de liga/desliga que o item #4 já cobre vale igual pras duas.

### 6. Aparecer na árvore de Research, com pré-requisito de verdade

Pedido novo: os dois blocos deviam aparecer na aba de Research —
Filtered Launcher exigindo o Filter comum pesquisado antes, Advanced
Filtered Launcher exigindo tanto o Advanced Filter quanto o Conveyors
Mk2 (o "Logistics Mk2"). Primeira reação foi "não dá" — bati exatamente
no mesmo beco sem saída que o mod Resource Signal Readers deste pacote
já tinha documentado: a função pública que cria uma tech nova
(`api.tech.registerNode`) **exige** que o `parentId` já tenha sido
registrado por ela mesma antes — li o código de validação de verdade e
a checagem é literal: só aceita como pai uma tech que **também** foi
criada via mod, nunca uma tech vanilla nativa como Filter ou Advanced
Filter. Falei isso pra você, e você perguntou "então não tem jeito
mesmo?" — fui checar de novo, com mais calma, e **tinha** jeito.

`registerNode` faz duas coisas de uma vez: define os dados da tech
(custo, pré-requisito, o que desbloqueia) **e** planta ela no grid
visual da árvore. `api.tech.addDefinition` faz só a primeira parte — lendo
o código dela, é literalmente só `L[id] = definição`, sem checar pai
nenhum. Um campo `requires` apontando direto pra uma tech vanilla
funciona por esse caminho sem patch nenhum — confirmei comparando com
uma tech vanilla que já faz exatamente isso (Drill exige tanto Rocket
quanto GoldBattery ao mesmo tempo, mesmo formato que preciso pro
Advanced Filtered Launcher). O que falta é só o **espaço na grade**: uma
definição sem posição no grid nunca aparece pra ninguém ver. Por isso
`patches.json` ganhou dois patches novos, bem pequenos — cada um troca
uma única célula `null`, já vazia, por uma string com o id da minha
tech nova, direto embaixo do pré-requisito de verdade (`shanderFilteredLauncherTech`
embaixo de `Filters`; `shanderAdvancedFilteredLauncherTech` embaixo de
`AdvancedFilters`, do lado de `ConveyorsMk2`) — e o resto (custo,
`requires`, `unlocks`) vem todo da chamada pública `addDefinition`, sem
patch nenhum.

Como o desbloqueio agora é de verdade, `alwaysUnlocked` e a chamada
incondicional de `unlockByType` saíram dos dois blocos — cada um só
fica disponível pra construir depois de pesquisar a tech certa. Só o
segmento Up de cada família entra na lista `unlocks.structures` da
tech (igual a própria tech "Conveyors" vanilla, que só lista
`LauncherUp`, nunca Left/Right) — Left/Right continuam construíveis
via arrasto assim que a família é desbloqueada, pela mesma resolução
genérica de ferramenta que o próprio jogo usa pros segmentos
diagonais do Launcher vanilla.

Custo escolhido meio arbitrariamente (100 pro Filtered Launcher, 400
pro Advanced) — ajuste em `main.js` (`registerTech(...)`) se quiser
outro valor.

### 7. Líquido/gás: primeiro achei que não dava, depois descobri que dava

Documentei aqui uma limitação ("filtra, mas não lança") que depois se
provou **não ser uma limitação real** — histórico completo porque foi
um giro de 180 graus só de olhar o código com mais calma.

Primeira versão desse item dizia: `affectsLiquid`/`affectsGas`
controlam só a filtragem (permitir ou bloquear a entrada na célula),
não o lançamento — testado no jogo, líquido/gás liberado no filtro
não saía voando, só sólido saía, igual o Launcher vanilla. Concluí que
era herdado do próprio `registerLauncherType` (item #1) e não mexi em
nada.

Pedido novo do usuário: "dá pra mudar isso?" — fui ler
`simulation-worker.js` de novo, mais a fundo, pra confirmar antes de
responder "não dá". E não é isso que o código mostra. Cada "tipo de
matéria" (Solid, Liquid, Gas, Slushy, Wisp, Powder, Static) tem sua
própria função de update por tick, numa tabela central só. Solid,
Slushy, Wisp e Powder chamam a mesma checagem de "posso ser pego por
um launcher" logo no início do próprio update — é isso que deixa
Sand, WetSand, Petalium, FreezingIce serem lançados. **Liquid e Gas
simplesmente nunca chamam essa checagem.** Não é `isTransportable:
false` (conferi: nem Water nem Steam têm esse campo definido — o
padrão sem ele já passaria na checagem), não é um bloqueio por
`matterType` em lugar nenhum do caminho do launcher — é só uma
chamada de função que nunca foi colocada ali pros dois. O mecanismo de
"virar um projétil físico voando com velocidade e voltar a ser o
elemento original ao pousar" já é genérico e usado por quatro tipos de
matéria diferentes hoje, então não tinha motivo pra esperar que não
funcionasse igual pra líquido/gás uma vez ligado.

**A mudança:** três patches pequenos e aditivos ligam essa mesma
checagem também nas funções de update de Liquid e Gas (mais um quarto
patch, só um `const` de apelido, necessário porque as duas funções já
usam a letra `a` como nome de parâmetro local, colidindo com o nome
que o import do módulo da checagem usa — puramente cosmético,
contorna uma colisão de minificação, não muda comportamento nenhum
por si só). Só isso já bastaria, mas deixaria **qualquer** launcher do
jogo (inclusive o vanilla) lançando líquido/gás — mudança de
balanceamento do jogo base, não só destes dois blocos novos. Por
isso, perguntei antes de mexer, e a resposta foi: só nestes dois
blocos. Um quinto patch resolve isso: dentro da própria checagem
compartilhada por todo launcher, se o elemento a pegar for líquido/gás
e o launcher não for um dos tipos registrados por este mod, ele
desiste antes de fazer qualquer coisa.

**Ajuste seguinte:** "esses dois blocos" virou "só o Advanced". Pedido
explícito: o MK1 (Filtered Launcher comum) não deveria lançar líquido
nem gás, só o MK2 (Advanced Filtered Launcher) — igual a separação
real entre Filter (só sólido) e Advanced Filter (sólido + líquido +
gás) que os dois blocos já espelham em tudo mais. Troquei a condição
do quinto patch: em vez de checar "é ou não é um tipo registrado por
este mod" (`!T`, verdadeiro pros dois blocos), ele agora checa o tipo
de estrutura (`S`) direto contra os três ids do Advanced
(`shanderAdvancedFilteredLauncherUp/Left/Right`) — só esses três
passam; qualquer outro (vanilla **ou** o Filtered Launcher comum deste
mesmo mod) cai no bloqueio. Um patch a menos de superfície de mudança
do que parece: é a mesma checagem de antes, só compara contra uma
lista de 3 nomes fixos em vez de "registrado ou não".

Resultado: só o Advanced Filtered Launcher realmente lança líquido/gás
quando o filtro permite (documentado nas descrições in-game e na
descrição do Workshop). O Filtered Launcher comum continua podendo
**filtrar** líquido/gás (a config `affectsLiquidsAndGases` ainda existe
e ainda controla se aquele material pode ocupar a célula), só não
lança — igual ao Filter vanilla, que também nunca lançou nada sozinho.
Launcher e Launcher Mk2 vanilla não mudam em nada.

## Sobre o arrastar escolher a direção

A troca de tipo durante o arrasto (reto pra cima = Up, pra um canto =
Left/Right, incluindo em qual canto encaixa) é lógica genérica do
próprio jogo baseada em `registeredLauncherTypes` — funcionou desde a
primeira versão sem nenhum código de arrasto próprio.

### 8. Build Modes: faltavam o Rect Up e o Rect Side do Launcher vanilla

`buildModes` só tinha `"line"` (arrastar em coluna/diagonal, um
segmento de 1 tile por célula). O Launcher vanilla também tem
`"launcherRectUp"` e `"launcherRectSide"` — arrasta um **retângulo**
inteiro de uma vez em vez de só uma coluna. Uma versão anterior deste
README dizia que isso "precisava de uma matriz de colisão (`shape`)
que não dava pra copiar com confiança" — pedido novo do usuário pra
adicionar isso me fez ler esse caminho de novo, e essa conclusão
estava **errada**.

O que descobri de fato: `LauncherUp` até referencia uma chave de shape
(`_["launcher-up"]`), só que essa chave **não existe** na tabela de
shapes do jogo — resolve pra `undefined` em tempo de execução. Ou
seja, o próprio Launcher vanilla também não tem shape nenhuma. Rastreei
o código de verdade que processa esses dois build modes (a função
genérica que transforma um arrasto do mouse numa lista de posições +
tipo de estrutura pra cada uma) e nenhum dos dois depende de `shape`:

- A escolha "retângulo inteiro vs. linha" só olha o próprio array
  `buildModes` da estrutura — mesmo mecanismo que já fazia `"line"`
  funcionar.
- Preencher o retângulo é um fill 2D simples entre o início do arrasto
  e a posição do mouse, sem shape nenhuma envolvida.
- Decidir se cada célula do retângulo vira Up, Left ou Right procura o
  tipo em `session.sandkit.registeredLauncherTypes` — o mesmo registro
  que o item #1 já usa pra registrar os tipos deste mod — sem nenhum
  caso especial pra ids vanilla.

Resultado: bastou adicionar `{type:"launcherRectUp"}` e
`{type:"launcherRectSide"}` no `buildModes` do segmento Up de cada
família em `main.js`, **sem patch nenhum** (API pública + comportamento
genérico do próprio jogo) — igual ao Launcher/Launcher Mk2 vanilla,
arrastar um retângulo agora planta um bloco inteiro de launchers de uma
vez (linha de cima vira o segmento reto, o resto vira Left/Right
alimentando ela) ou uma parede inteira de Left/Right de lado.

### 9. Relato real de usuário: a tela de filtro não aparecia (conflito com o Solaryum)

Um usuário baixou o mod, instalou junto com outros 66 mods, e reportou
que a tela de filtro nunca abria — o Filter vanilla dele funcionava
normal, só os blocos deste mod que não. Ele rodou o **Mod Inspector**
(mod de diagnóstico de terceiros) e me mandou a saída — e ela já
mostrava a causa exata, sem precisar adivinhar:

```
[patch_apply_failed] shander.filtered-launcher: Patch "recognize-filtered-launcher-for-filter-config-panel" failed (match_count_mismatch)
[patch_apply_failed] shander.filtered-launcher: Patch "activate-filter-config-panel-when-equipping-filtered-launcher" failed (match_count_mismatch)
[patch_apply_failed] shander.filtered-launcher: Patch "keep-filtered-launcher-active-after-picking-an-element" failed (match_count_mismatch)
[patch_apply_failed] shander.filtered-launcher: Patch "treat-advanced-filtered-launcher-as-mk2-tier" failed (match_count_mismatch)
[patch_apply_failed] shander.filtered-launcher: Patch "custom-launcher-types-without-a-tick-buffer-use-runLaunchers-gate" failed (match_count_mismatch)
```

5 dos 11 patches — justamente os que fazem o jogo reconhecer os
blocos deste mod como filtro — falharam com `match_count_mismatch`:
o texto original que cada patch procurava simplesmente não estava mais
lá. No mesmo relatório, dois outros mods instalados (**Auto Sorter** e
**Solaryum**) tinham patches com nomes claramente fazendo a mesma
coisa — estendendo as mesmas listas nativas de tipos de filtro pros
próprios blocos deles — e os patches **deles** também estavam
falhando. Pedi pro usuário testar desativando um mod de cada vez:
confirmou que era o **Solaryum**.

**Causa raiz:** todo patch afetado aqui originalmente exigia encontrar
uma linha **inteira e intacta** (um array literal terminando em `]`,
ou uma expressão completa). Se outro mod mexe nessa mesma linha
primeiro — mesmo que só pra adicionar o próprio item dele, do mesmo
jeito que a gente faz — o texto completo que nosso patch procurava
deixa de existir, e o patch falha, não importa quem "está certo". Não
é bug de nenhum dos dois mods isoladamente — é o que acontece quando
vários mods mexem, cada um por conta própria, nas mesmas poucas linhas
estreitas do vanilla, o que parece acontecer bastante aqui já que só
existem uns punhados de lugares no jogo inteiro que decidem "isso é um
tipo de filtro/launcher".

**A correção:** reescrevi os 5 patches afetados pra ancorar só no
menor pedaço único necessário, e só **adicionar** — nunca mais casar
com texto que inclui o `]` de fechamento ou o resto de uma expressão
que outro mod possa já ter estendido antes. Por exemplo, o patch da
whitelist agora ancora em `mk=["filterWall","filterWallMk2"` (sem o
`]` de fechamento) em vez do array inteiro
`mk=["filterWall","filterWallMk2"]` — então não importa se o patch
deste mod ou o do Solaryum roda primeiro, cada um planta sua adição
logo depois de `"filterWallMk2"`, e o que o outro adicionou (ou o `]`
original) simplesmente continua depois, sem ser tocado. A exceção são
o patch que mantém o bloco equipado ao trocar de elemento e o do
"tick buffer" do launcher, que mexem numa expressão de controle de
fluxo em vez de uma lista — esses agora envolvem/trocam só a
menor sub-expressão original que precisa sobreviver de qualquer jeito,
então uma correção equivalente de outro mod, mesmo em ordem diferente,
tem bem menos chance de apagá-la de vez. Isso não garante zero
conflito com qualquer combinação possível de mods — só tira a
fragilidade específica (depender de uma linha **inteira** ficar
intocada) que esse relato real expôs.

### 10. Pedido de um jogador: primeiro recusado, depois implementado (achei a peça que faltava)

Um jogador sugeriu: em vez de bloquear o que não bate no filtro, deixa
passar tudo, só **lança** o que bate — assim daria pra usar como
salvaguarda numa esteira com vários materiais, sem travar os que não
interessam. Levei a sério em vez de descartar de cara (mesma lição do
item #8 — reconferir em vez de só repetir "não dá").

**Primeira resposta (não implementada ainda):** o item #2 já
estabelece que filtro e launcher só se combinam *porque* o filtro
bloqueia a entrada no nível do tile — o launcher em si nunca olha a
lista do filtro, só lança o que já estiver sentado na célula.
Desacoplar "pode entrar" de "é lançado" significaria: o elemento que
não bate entra na célula mas não é lançado — e aí o quê? Conferi a
configuração de transporte (mesma fonte dos números de velocidade do
item #1): **Conveyor** tem `maxDisplacementCellsPerPass` (movimento
passivo de esteira); **Launcher não tem esse campo**. Concluí que sem
esse campo, o elemento não lançado ficaria **parado dentro do tile
pra sempre** — pior que hoje. Recomendei não implementar, e documentei
isso.

**O usuário pediu pra implementar mesmo assim.** Em vez de seguir com
uma explicação que eu mesmo já tinha marcado como possivelmente
incompleta, fui reler o código de codificação do filtro no tile (o
mesmo do item #2) com mais calma — e achei a peça que faltava: **isso
já existe no jogo, pronto, esperando ser usado.**

O código que grava o `.filter` de uma estrutura nos bits do tile
também lê `structure.data.filterPassThrough`. Se for `true`, ele liga
um bit **separado** (`FILTER_PASS_THROUGH_BIT`) junto com os bits do
filtro. Conferi o lado da leitura também: todo lugar que checa "esse
tile de filtro está bloqueando movimento" checa esse bit **primeiro**
e pula o bloqueio inteiro se ele estiver ligado — a configuração do
filtro continua intacta (a tela nativa continua funcionando igual),
só o efeito de bloqueio desliga. Não é um hack reconstruído do zero,
é um campo de verdade que já existe no jogo, só que este mod não
usava.

Isso sozinho não bastava: o launcher continua sem olhar o filtro pra
decidir se lança — sem o bloqueio, ele lançaria **qualquer coisa** que
estivesse na célula, filtrada ou não. Faltava a segunda metade: um
patch novo que, na hora de decidir se lança, lê os mesmos bits do
tile e — se estiver em modo filtrado — resolve a config do filtro e
confere se o elemento atual bate, usando exatamente as mesmas funções
(`getFilterConfig`/`isInElementMask`) que o próprio código de bloqueio
do jogo usa (já importadas no mesmo módulo, nenhum import novo
precisou ser adicionado). Se não bater, ele desiste de lançar sem
fazer mais nada.

**O buraco da primeira resposta:** sem o bloqueio, um elemento que não
bate no filtro e que o launcher se recusa a lançar não fica mais
suspenso artificialmente por nada — a gravidade normal (e o que
estiver fisicamente embaixo do tile) simplesmente continua agindo,
igual já acontece entre um tick de lançamento e outro. O "ficaria
parado pra sempre" da primeira resposta era exatamente a parte que
não se sustentava.

**Correção seguinte (relato real de novo):** testado numa esteira
horizontal — esteira → Filtered Launcher → esteira — com um elemento
que não batia no filtro (Bloom/Gloom). Resultado: ficava travado na
primeira esteira, não passava pra terceira. O bit de pass-through
continuava ligado certinho; o que faltava era mais estreito e fácil de
não perceber: existem **duas** funções separadas no jogo que decidem
"esse elemento pode se mover pra cá" — não uma só. A mais simples (a
que já tinha sido conferida, usada pelo movimento genérico por
gravidade) respeita `isFilterPassThrough` direitinho. Uma segunda
função, mais completa — a que o transporte de esteira/conveyor
especificamente consulta pra decidir se um elemento empurrado pode
continuar pra próxima célula — também consultava o pass-through, mas
só no ramo em que o elemento **já bate** no filtro (onde não faz
diferença nenhuma, já que bater já autoriza de qualquer jeito). No
ramo de **não bater**, ela sempre retornava "não autorizado", ponto
final, sem nenhum caminho de volta pra checar o pass-through — ou
seja, qualquer coisa chegando por esteira num tile filtrado-mas-
passante continuava sendo recusada, exatamente o que foi relatado.

Corrigi o retorno final dessa função pra também checar o pass-through
no ramo de não-correspondência, não só no de correspondência: antes
`bate ? (autorizado de um jeito ou de outro) : recusado`, agora
`bate ? (autorizado de um jeito ou de outro) : (pass-through ?
autorizado : recusado)` — mudança puramente aditiva, só muda o
resultado pra exata combinação que os blocos deste mod criam (filtro
com pass-through ligado **e** elemento que não bate) — nada mais no
jogo instalado hoje liga pass-through num filtro com lista não-vazia,
então não deveria mudar comportamento de mais nada.

**Aviso de honestidade:** essa segunda função é usada bem além de
esteiras (o mesmo módulo também controla zonas de restrição de
jetpack/build/grab/ferramenta), então esse é o patch de maior alcance
deste mod inteiro, mesmo a mudança em si sendo de duas palavras.
Conferi que as duas combinações relevantes (pass-through + filtro
vazio, pass-through + filtro não-vazio) não são usadas por mais nada
no jogo instalado antes de aplicar.

### 11. Item bom escapava numa esteira rápida — tentei uma correção, o jogador não gostou, revertido

Testando de novo: numa esteira, um item que **batia** no filtro (devia
ser lançado) às vezes simplesmente atravessava o launcher e chegava do
outro lado sem ser lançado — a menos que vários Filtered Launchers
fossem colocados em fileira. Causa: o launcher só realmente tenta
lançar numa cadência periódica (~683ms, a mesma do Launcher padrão
vanilla — item #6). Sem bloqueio nenhum (pass-through ligado pra tudo,
item bom incluso), uma esteira rápida (332ms por passo no MK1, menos
ainda no MK2) conseguia empurrar o item bom pra fora do tile **antes**
do próximo pulso do launcher ter chance de vê-lo. Antes do item #10
(quando ainda bloqueava tudo que não batia), esse problema não
existia — o item bom, uma vez dentro da célula, não tinha pra onde ir;
ficava esperando o próximo pulso. O pass-through tirou esse "segurar"
de todo mundo, inclusive do item que devia ser segurado.

**Tentativa de correção (revertida):** cheguei a trocar a abordagem
inteira — em vez de pass-through, inverter o **modo** do filtro só na
hora de codificar o bloqueio do tile (Allow vira Block com a mesma
lista, só na gravação, mantendo a tela nativa e o `.filter` de verdade
intocados), fazendo a lógica de bloqueio padrão do jogo segurar o
recurso desejado no lugar do indesejado. Isso fechava a brecha de
tempo pela raiz, e até permitia remover os dois patches do item #12
(a checagem de filtro no launcher e o patch de autorização de
movimento). **Só que, testado de verdade, o resultado ficou pior na
prática** do que o pequeno risco de escapar ocasionalmente numa
esteira muito rápida — revertido a pedido direto do usuário
("Ficou péssimo. Deixe do jeito que estava."), sem investigar mais a
fundo o motivo exato, já que o pedido foi claro. Registro aqui porque
é assim que a decisão de verdade foi tomada — inclusive o caminho que
não deu certo.

**O que fica valendo:** o design do item #10 (pass-through +
correção da função de autorização de movimento), com a limitação de
timing do parágrafo acima **aceita como conhecida**, não corrigida —
o pior caso é ocasionalmente um item bom escapar numa esteira muito
rápida, mitigável colocando mais de um Filtered Launcher em sequência
se isso incomodar. Prefiro essa limitação pequena e conhecida a uma
mudança que piorou a experiência real de jogo.

**Ponto separado, sem relação, relatado ao mesmo tempo:** se uma
camada de material indesejado está **em cima** do material desejado
numa pilha, o launcher não consegue "pegar" o que está embaixo, porque
esse material nunca chega a alcançar o tile pra ser avaliado. Isso não
é um bug deste mod — um Filter vanilla tem exatamente a mesma
limitação, já que nenhum dos dois consegue "enxergar" ou reorganizar
uma pilha por fora dela; é assim que a física do jogo funciona pra
qualquer estrutura desse tipo. Não é algo que dá pra corrigir só
mexendo nos blocos deste mod.

### 12. Relato real de usuário: com o mod ativo, um Filter Wall vanilla em Block deixava tudo passar

Um jogador removeu o bloco deste mod do mapa e recolocou só pra provar
o ponto: com este mod **ativo**, construir um Filter (Mk1 ou Mk2)
vanilla no **modo de construção "wall"**, configurado pra **Block**
(ex: bloquear Void Petal), deixava o Void Petal passar de qualquer
jeito. Confirmado alternando o mod desativado/ativado com a mesma
estrutura vanilla no lugar — só acontecia com o mod ligado.

**Causa raiz:** o patch de autorização de movimento do item #10 (o que
corrige esteira/conveyor) mexe numa função **compartilhada** por
qualquer tile em modo filtrado, não só pelos blocos deste mod — ele
muda o ramo de "não bate no filtro" pra também respeitar o bit de
pass-through, em vez de recusar sempre. O aviso de honestidade do item
#10 já dizia "conferi que nada mais no jogo liga pass-through num
filtro não-vazio" — só que essa checagem olhou só quem **lê** o bit,
não parou pra olhar se o **próprio jogo vanilla** já liga esse mesmo
bit em algo. Relendo o registro das estruturas vanilla direto em
`bundle.js` (não só o deste mod) achei a resposta: `filterWall`,
`filterWallMk2` e **`critterFence`** já vêm de fábrica com
`defaultData:{filterPassThrough:true}` — um mecanismo vanilla de
verdade, sem nenhuma relação com este mod, que existe justamente pra
deixar material caindo por gravidade atravessar a parede livremente
enquanto ainda **bloqueia** o que chega por esteira/conveyor (faz
sentido pra Critter Fence: precisa segurar criatura/material
transportado atravessando de lado, mas deixar cair material solto por
cima através dos vãos; Filter Wall segue o mesmo desenho assimétrico).
O patch do item #10 anulou essa assimetria pras três estruturas
vanilla em qualquer save com este mod instalado — mesmo sem nenhum
bloco deste mod sequer estar construído — derrubando silenciosamente
o modo Block delas contra material vindo por esteira.

**Correção:** removi esse patch por completo. A função de autorização
de movimento volta a ser exatamente a original do jogo, bit a bit. Os
próprios tiles deste mod agora seguem a mesma assimetria que essas três
estruturas vanilla já usam: pass-through continua 100% confiável pra
material caindo por gravidade, mas material vindo por esteira/conveyor
que não bate no filtro pode voltar a ser bloqueado no tile, igual um
Filter Wall ou Critter Fence vanilla já se comportam. Agora que o
desenho real do jogo é conhecido, isso deixa de ser uma limitação pra
contornar e passa a ser **paridade** com o que o próprio jogo já faz
pras estruturas dele que usam esse mesmo mecanismo — uma posição bem
mais defensável do que uma exceção só deste mod que, sem querer,
quebrava conteúdo de outra estrutura. A limitação de timing do item
#11 (item bom escapando ocasionalmente numa esteira rápida) não muda
em nada com isso — ela só existia no ramo de "bate no filtro", que
esse patch removido nunca tocava.

### 13. A remoção do item #12 corrigiu o vanilla, mas quebrou a esteira dos nossos próprios blocos — corrigido de vez

Reportado na hora: depois da remoção do item #12, material que **não
bate** no filtro voltou a ficar **travado antes de entrar** no
Filtered Launcher quando vem por esteira, em vez de atravessar — ou
seja, o item #12 trocou um bug real por outro. O comportamento certo,
como pedido, é: material que não bate **atravessa** o tile
normalmente (esteira ou gravidade, tanto faz); só o que **bate** é
lançado; o que está na lista de **Block** simplesmente não é lançado
(mas também não fica preso). Jogar fora o patch inteiro (item #12) foi
covardia demais — a correção certa era **restringir** esse mesmo patch
só aos blocos deste mod, não removê-lo.

O bloqueio até então era: "essa função só enxerga os bits do tile
(modo/id-do-filtro/bit de pass-through), sem nenhuma pista de qual
**tipo de estrutura** é dona do tile" — verdade pros bits crus, só que
a própria função já calcula `v`, o **tipo numérico de bloco** do tile,
uma linha antes (ela mesma precisa disso pra suas próprias checagens de
"tile vazio"/"é ouro"). O mesmo módulo que essa função já importa
(módulo `38394`, o mesmo por trás de `writeStructureToGrid`/
`getBlockAccess`/`isFilterPassThrough` etc.) também exporta
`getTypeFromIndex`, que transforma esse número de volta no **tipo de
verdade** da estrutura — confirmado achando esse mesmo padrão já usado
em outro lugar do próprio jogo pra uma checagem vanilla sem relação
nenhuma (`getTypeFromIndex(getBlockTypeAtPos(...))===Foundation`), e é
exatamente a mesma chamada que o patch do launcher deste mod (o
primeiro patch do item #10/12, `gate-launch-on-tile-filter-match...`)
já usa pra saber seu próprio tipo de estrutura — só que chegando lá por
um nome de variável local diferente, nessa segunda função.

**Correção:** reintroduzi o patch de autorização de movimento do item
#12, só que agora, em vez de respeitar pass-through incondicionalmente
no ramo de rejeição, ele também resolve `getTypeFromIndex(v)` e só
libera esse ramo quando o tipo do tile é **um dos seis ids registrados
por este mod**. `filterWall`/`filterWallMk2`/`critterFence` (ou
qualquer outra coisa que já venha ou ganhe pass-through ligado) caem no
comportamento vanilla original, intocado — sempre `p` (bloqueado)
numa rejeição de verdade — enquanto os tiles deste mod recuperam o
pass-through por esteira que tinham antes. Essa é a versão que devia
ter sido o item #12 desde o início; a remoção total do item anterior
fica registrada acima como o passo intermediário (que passou do ponto),
não como o design final.

### 14. Relato real de usuário: item lançado por um Launcher normal chega no nosso bloco e é relançado sem checar o filtro

Um jogador reportou: **jogar** um material em cima de um bloco deste
mod respeita o filtro certinho (o que não bate não é lançado); mas se
um **Launcher vanilla normal** lança esse mesmo material bem em cima
do nosso bloco, ele é relançado na hora, **ignorando o filtro
completamente**. Ou seja, o bug era específico de material chegando
**já voando**.

**Causa raiz:** o patch do item #10/12 que checa o filtro na hora de
lançar (`gate-launch-on-tile-filter-match...`) tinha a condição
`if(T&&y!==r.RJ.Particle){...checagem...}` — copiando um padrão que o
próprio código vanilla usa uma linha depois, só que por um motivo
diferente do nosso. Enquanto um item está **voando** (acabou de ser
lançado por qualquer launcher), o jogo troca o `type` dele pro valor
genérico `Particle` e guarda o material de verdade num índice separado
(`linkedElementIndex`) — só recupera a identidade real ao pousar
(confirmei esse mesmo par `type===Particle` + `linkedElementIndex`
sendo usado em vários outros lugares do próprio `simulation-worker.js`,
sempre pra descobrir "no que essa partícula vai virar quando pousar").
Comparar um `Particle` genérico contra a lista do filtro nunca ia
bater com nada de verdade — então a condição pulava a checagem inteira
nesse caso, achando que estava sendo cautelosa.

O problema: o código vanilla, logo depois, **também não tem nenhuma
trava de cadência** pra esse mesmo caso — uma partícula que pousa
exatamente em cima de qualquer launcher registrado é relançada **na
hora**, sem esperar o próprio ritmo de disparo do launcher (é assim
que "torres" de launchers empilhados conseguem lançar em cadeia sem
engasgar). Juntando os dois: um item chegando voando batia no nosso
bloco sem checagem de filtro **e** sem checagem de cadência nenhuma —
exatamente o relatado.

**Correção:** em vez de pular a checagem quando o item é uma
`Particle`, agora ela resolve o tipo **de verdade** primeiro
(`type[t]` quando não é partícula, ou `type[linkedElementIndex[t]]`
quando é — a mesma consulta que o próprio código de renderização do
jogo já faz) e compara **esse** valor com o filtro. Apliquei a mesma
correção nas duas checagens que tinham o mesmo problema: a do filtro
em si e a que restringe líquido/gás só ao Advanced. Material colocado
à mão e material chegando voando agora passam pela exata mesma decisão
de filtro.

### 15. Investigado, NÃO é bug: Sand afunda, Residue flutua, e a Sand fica presa embaixo do Residue

Terceiro relato do mesmo comentário: uma fileira larga (1x15) de
Filtered Launchers configurada pra lançar só Sand, cheia de uma mistura
de Sand + Residue. Residue é menos denso e flutua pra cima; Sand afunda
e se instala embaixo, exatamente onde estão os launchers — até aqui,
esperado. Só que, depois de assentar, a Sand parou de ser lançada de
vez, com uma camada sólida de Residue bem em cima de cada launcher.

**Investigação:** rastreei a chamada real de lançamento (`J` do módulo
`96245`, no fim da mesma função de "deve lançar" que este mod já
mexe): disparar não teleporta o material pra célula de cima — ele
transforma o que já está sentado na própria célula do launcher numa
partícula com velocidade, e essa partícula precisa **se mover** célula
por célula pra cima nos ticks seguintes, pelas mesmas regras de colisão
de qualquer outro objeto físico. Se a célula de cima já está
solidamente ocupada, ela não avança — e como o Residue (menos denso)
fica se reacomodando ali por cima assim que qualquer espaço abre, a
Sand fica permanentemente travada contra uma parede que se
"regenera" sozinha, feita exatamente do material que ela não devia
lançar.

Isso não tem nada a ver com a lógica de filtro deste mod — o mesmo
mecanismo de "virar partícula e se mover pra cima" é compartilhado com
o Launcher vanilla comum (item #1), e confirmei por teste direto: um
**Launcher vanilla sem filtro nenhum**, na mesma mistura Sand/Residue
já densamente separada, trava exatamente do mesmo jeito. É uma
consequência geral de separação por densidade + "não dá pra lançar pra
dentro de uma célula já ocupada", não algo que os patches deste mod
tocam ou têm como corrigir sem mexer em como o lançamento vanilla
funciona no jogo inteiro. Nenhum patch novo — só documentando a causa
confirmada pra não ser confundida com a lógica de pass-through/filtro
dos itens #12/#14.

## Ponto de honestidade

Tudo acima foi confirmado lendo o próprio código do jogo e, pros itens
3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 e 15 da lista de bugs, testando
de fato versões anteriores no jogo (ou, no caso do item #15, um
controle direto contra o Launcher vanilla) e rastreando a causa real de
cada relato. `structures.register` / `structureBehaviors.registerLauncherType`
/ `structures.getAtCell` / `structures.update` / `tech.addDefinition`
são chamadas públicas reais e atuais do Sandkit. Os **doze** patches em
`patches.json` (quatro do item #3/#5, dois do item #6, um do item #4,
quatro do item #7 — um deles reescrito pelo item #9 pra ficar
resistente a ordem —, um do item #10/#14 para a checagem de filtro no
launcher, e mais um do item #13 para a autorização de movimento
restrita aos blocos deste mod) mexem em território não documentado, do
mesmo jeito que `grabber-safe-resize`/`toggle-grab` deste pacote já
fazem por motivos parecidos. O item #11 registra uma tentativa de
simplificar esse mesmo conjunto de patches que foi testada, piorou a
experiência real e foi revertida; o item #12 registra um segundo patch
(o de autorização de movimento do item #10) que precisou ser removido
de vez depois de um relato real mostrar que ele quebrava o modo Block
de três estruturas vanilla (`filterWall`, `filterWallMk2`,
`critterFence`) que já usavam o mesmo campo por conta própria; o item
#13 mostra que essa remoção foi longe demais — quebrou a esteira dos
próprios blocos deste mod de novo — e reintroduz o mesmo patch de
autorização de movimento, agora restrito por tipo de estrutura via
`getTypeFromIndex`; e o item #14 corrige um buraco diferente no mesmo
patch de checagem de filtro do launcher, que pulava a checagem inteira
pra material chegando **já voando** (lançado por outro launcher). O
histórico de todas as versões fica registrado acima porque é assim que
a decisão de verdade foi tomada, mesmo tendo passado por um patch a
mais, depois a menos, depois de volta. Cada patch é validado com o
`validate-mod.js` deste repositório (que roda o aplicador de patch de
verdade do próprio jogo contra os arquivos instalados de verdade, e
confere que o resultado remendado ainda é JavaScript sintaticamente
válido), mas só jogar de fato confirma o comportamento em tempo de
execução ponta a ponta — principalmente os do item #3/#5 ("a tela
nativa, as caixinhas clicáveis, a escolha de elemento e o modo
avançado tratam este mod igual a um Filter/Advanced Filter vanilla"),
os do item #6 ("a tech nova aparece, trava/libera certo, e realmente
desbloqueia o bloco ao pesquisar"), os do item #7 ("líquido/gás
realmente sai voando só do Advanced Filtered Launcher, e o
Launcher/Launcher Mk2 vanilla e o Filtered Launcher comum continuam
recusando exatamente como antes"), o do item #8 ("arrastar um
retângulo realmente planta um bloco inteiro de launchers, com Up em
cima e Left/Right alimentando, ou uma parede inteira de lado"), o do
item #9 (a tela de filtro funciona mesmo com Solaryum ativado), os do
item #10/#12/#13 juntos ("material que não bate no filtro passa pelo
tile livremente por gravidade **e** por esteira nos blocos deste mod,
o que bate ainda é lançado corretamente na maior parte do tempo com a
limitação de timing conhecida do item #11 em esteiras muito rápidas,
**e** um Filter Wall/Filter Wall Mk2/Critter Fence vanilla configurado
pra Block continua bloqueando material vindo por esteira, com este mod
instalado e ativo"), e o do item #14 ("material lançado por um
Launcher vanilla normal em cima de um bloco deste mod recebe a mesma
checagem de filtro que material colocado à mão, nos dois sentidos —
tanto o que devia ser lançado quanto o que devia ficar parado") —
nenhum desses é algo que dá pra confirmar 100% só lendo código, e esse
mecanismo de pass-through/checagem de filtro em particular já passou
por uma rodada de redesenho e reversão via teste real, uma remoção que
corrigiu o vanilla mas quebrou o comportamento esperado deste mod, uma
reescrita restrita por tipo pra resolver as duas coisas de vez, e uma
correção separada pra um buraco na própria checagem de filtro que
nunca tinha sido testado com material chegando voando — então continua
sendo, de longe, a parte deste mod que mais merece atenção antes de
confiar cegamente.

**Testa isso:**

1. Abre a aba de Research **antes** de pesquisar Filter — os dois
   blocos não devem estar disponíveis pra construir ainda. Pesquisa
   **Filter**: confirma que uma tech nova aparece embaixo dela
   (mostrando o nome "Filtered Launcher") e que, depois de pesquisada,
   o Filtered Launcher passa a aparecer no menu de construção.
2. Pesquisa **Advanced Filter** sozinho (sem Conveyors Mk2 ainda):
   confirma que a tech do Advanced Filtered Launcher aparece mas
   continua **bloqueada/travada**. Pesquisa **Conveyors Mk2** também:
   confirma que ela libera, e que só depois disso o bloco aparece no
   menu de construção.
3. Seleciona/equipa o Filtered Launcher (hotbar ou menu de construção)
   e confirma que a tela de filtro **do jogo** aparece, igual acontece
   ao selecionar um Filter comum (o título vai dizer "Filter" mesmo,
   ver a nota cosmética no item #3 — funciona igual, só o texto que não
   bate). Escolhe um elemento **diferente** de Sand (ex: Gold) e
   confirma que o item continua sendo o Filtered Launcher.
4. Seleciona/equipa o **Advanced Filtered Launcher** e confirma que a
   tela aparece em **modo múltiplo** (checkboxes, não fecha ao clicar
   um elemento) e o título diz "Advanced Filter". Marca dois ou mais
   elementos.
5. Arrasta um de cada tipo reto pra cima e confirma que, com o item
   correspondente ainda equipado, aparecem caixinhas clicáveis sobre
   o(s) já colocado(s) — clique numa e confirma que a mesma tela passa
   a editar aquele em vez de configurar um novo.
6. Passa o mouse por cima de qualquer um sem nenhuma ferramenta
   equipada: deve mostrar "Filter"; segurando o Grabber, deve mostrar
   o resumo "Allow ↓ ...".
7. Joga os elementos liberados nos respectivos blocos e confirma que
   são lançados; joga outra coisa e confirma que fica bloqueada.
8. Libera um líquido (ex: Water) ou gás (ex: Steam) no filtro do
   **Advanced Filtered Launcher** e joga um pouco nele: confirma que
   **sai voando** igual um sólido lançado no passo 7, virando um
   "projétil" físico até pousar.
9. Liga `affectsLiquidsAndGases` na config do mod e libera o mesmo
   líquido/gás no filtro do **Filtered Launcher comum** (MK1) — confirma
   que ele entra/passa pela célula normalmente (a filtragem funciona),
   mas **não** sai voando. Testa o mesmo material também num **Launcher
   vanilla comum** (não deste mod) — confirma que ele também continua
   recusando, exatamente como sempre se comportou. Se qualquer um dos
   dois passar a lançar, o quinto patch do item #7 (o guard) não está
   restringindo direito.
10. Equipa qualquer um dos dois blocos e, em vez de arrastar em coluna,
    **arrasta um retângulo** (segura e puxa o mouse na diagonal) —
    confirma que aparecem os modos Rect Up/Rect Side (mesmo atalho de
    teclado que troca de modo no Launcher vanilla) e que um bloco
    inteiro é plantado de uma vez: Rect Up bota o segmento reto na
    fileira de cima e Left/Right alimentando embaixo; Rect Side planta
    uma parede inteira de Left ou Right.
11. Se tiver o **Solaryum** (ou o **Auto Sorter**) instalado junto:
    repete os passos 3-4 (tela de filtro nativa abrindo ao equipar) com
    ele ativado. Isso é o que estava quebrado no relato real que gerou
    o item #9 — confirma que voltou a funcionar mesmo com um desses
    dois mods ligados, sem precisar desativar nada.
12. Configura o filtro pra permitir só um recurso (ex: Gold) e **derruba
    por gravidade** outra coisa nele (ex: solta Sand de cima, sem
    esteira nenhuma envolvida) — confirma que o Sand **não** é
    bloqueado na frente do bloco: ele deve continuar se
    movendo/caindo através do tile normalmente, sem ser lançado. Joga
    Gold em seguida e confirma que esse sim é lançado. Testa também no
    **Filtered Launcher comum** com `affectsLiquidsAndGases` ligado e
    um líquido/gás não incluído no filtro: deve passar pelo tile sem
    ser bloqueado nem lançado (só o Advanced lança líquido/gás, item
    #7).
13. Monta uma **coluna vertical** de Filtered Launcher alimentada só
    por gravidade (sem esteira) com uma mistura de material que bate e
    material que não bate no filtro caindo nela — confirma que o que
    não bate atravessa livremente e o que bate é lançado corretamente
    na maior parte do tempo; um escape ocasional do que bate é a
    limitação **conhecida e aceita** do item #11 (mitigável colocando
    mais de um Filtered Launcher em fileira), não um patch quebrado.
14. Monta uma linha **esteira → Filtered Launcher → esteira**
    (horizontal, três tiles) e manda uma mistura de materiais pela
    esteira 1. Material que **não bate** no filtro deve **atravessar**
    o launcher normalmente e chegar na esteira 3 (voltou a funcionar
    graças ao item #13); material que **bate** deve continuar sendo
    lançado corretamente quando chega por esteira, com o mesmo escape
    ocasional **conhecido e aceito** do item #11 numa esteira bem
    rápida. Testa também numa coluna vertical de launchers empilhados.
15. Coloca uma camada de material que não bate no filtro **em cima**
    de material que bate, numa pilha, alimentando o Filtered Launcher
    por baixo — confirma que o launcher realmente não consegue pegar o
    material enterrado (comportamento esperado, igual um Filter
    vanilla faria - ver item #11) e não é um sinal de que algo quebrou.
16. **Regressão dos itens #12/#13:** construa um Filter (Mk1 ou Mk2)
    **vanilla**, no modo de construção **"wall"**, com este mod ativo.
    Configura pra **Block** um recurso específico (ex: bloquear Sand) e
    alimenta ele por **esteira/conveyor**. Confirma que o Sand continua
    **bloqueado** na frente da parede, exatamente como aconteceria sem
    este mod instalado — se ele passar direto, o bug do item #12
    voltou (o patch do item #13 deixou de restringir corretamente por
    tipo de estrutura). Repete o mesmo teste com um **Critter Fence**
    vanilla, se tiver acesso a ele.
17. **Regressão do item #14:** posiciona um **Launcher vanilla normal**
    apontado direto pra um bloco deste mod. Configura o filtro do bloco
    pra **não aceitar** um material X. Carrega o Launcher vanilla com
    X e dispara em cima do bloco deste mod — confirma que ele **não** é
    relançado (deve só cair/ficar ali, igual aconteceria se você tivesse
    colocado X à mão). Repete com um material que o filtro **aceita** —
    esse sim deve ser relançado normalmente, mesmo chegando voando.

Se os passos 1-2 não aparecerem certos, os patches do item #6 precisam
de outro olhar; se os passos 3-5 falharem, é o item #3/#5 (e, se só
falhar com Solaryum/Auto Sorter ativado, é o item #9); se o passo
7 não lançar nada mesmo liberado, é o patch do item #4; se o passo 8
não lançar líquido/gás no Advanced, é o item #7 (patches de
Liquid/Gas); se o passo 9 mostrar o Filtered Launcher comum ou o
Launcher vanilla lançando líquido/gás, é o guard do item #7 que
precisa de outro olhar; se o passo 10 não mostrar os modos Rect
Up/Rect Side ou plantar errado, é o `buildModes` do item #8; se o
passo 11 falhar, os patches reescritos do item #9 ainda não bastam
pra esse combo de mods específico; se o passo 12 mostrar o que não
bate no filtro sendo bloqueado por gravidade (em vez de passar) ou o
que bate nunca sendo lançado, os patches do item #10 precisam de outro
olhar; se o passo 13 mostrar material bom escapando **com muita
frequência** (não só ocasionalmente), é sinal de que algo além da
limitação conhecida do item #11 está errado; se o passo 14 mostrar
material que **não bate** ficando travado na esteira em vez de
atravessar, o patch restrito por tipo do item #13 não está reconhecendo
os blocos deste mod direito; se o que **bate** parar de ser lançado ao
chegar por esteira, é o mesmo patch que precisa de outro olhar; o passo
15 é esperado sempre dar esse resultado (ver item #11) — não é um
patch quebrado; se o passo 16 mostrar o Filter Wall/Filter Wall
Mk2/Critter Fence vanilla deixando material bloqueado passar, o patch
de autorização de movimento do item #13 não está restringindo pelo
tipo de estrutura corretamente e precisa de outro olhar; se o passo 17
mostrar o material bloqueado sendo relançado mesmo chegando por um
Launcher vanilla, a resolução de tipo real (`Particle` →
`linkedElementIndex`) do item #14 não está funcionando e precisa de
outro olhar.

## Publicar no Steam Workshop

`preview.png` (512x512) já está incluso, gerado por `gen_preview.py`:
os ícones reais dos dois blocos (o mesmo sprite usado no jogo, ampliado
com NEAREST pra manter o pixel art nítido) sobre um fundo escuro com
brilho, e embaixo de cada um um diagrama simples (seta + quadradinhos
coloridos, desenhados com formas geométricas simples via PIL) mostrando
"um recurso passa, o outro é bloqueado". Nenhuma parte da imagem foi
gerada por IA — é só o sprite de verdade do jogo mais formas
geométricas básicas, mesma técnica de `gen_sprites.py`. Rode
`python3 gen_preview.py` de novo se quiser reexportar depois de ajustar
as cores/layout no topo do próprio script.

`modinfo.json` já tem `name`, `description` e `version` preenchidos
(cobrindo os dois blocos). A `description` usa BBCode (`[h2]`, `[b]`,
`[list]`/`[*]`, `[i]`) com quebras de linha reais (`\n`) — o jogo manda
esse texto direto pro Steam via `workshop.updateItem` (confirmado lendo
`local-mod-publisher.js` do próprio instalador: `description:
manifest.description || ''`, sem nenhum reprocessamento), e a página do
Workshop renderiza BBCode nativamente, então o texto sai formatado com
títulos e listas em vez de um parágrafo só.

Pra publicar: com o Steam aberto, abra o Sandustry, vá na aba de Mods,
ache "Filtered Launchers" na lista de mods locais e use a opção de
publicar/upload — os dois blocos (Filtered Launcher e Advanced
Filtered Launcher) vêm juntos num mod só. A primeira publicação sai
como **Unlisted** — depois é só ir na página do item no Workshop e
marcar como Public quando quiser divulgar. O jogo grava um
`workshop.json` na pasta na primeira publicação; não edite nem apague
esse arquivo.

**Nota sobre a arte:** os sprites finais (`filteredLauncher*.png` /
`advancedFilteredLauncher*.png`) derivam de arte do próprio Sandustry
(o sprite do Launcher vanilla, com uma barra + "F" desenhados por
cima, e marcas vermelhas extras na versão Advanced) — mesma prática
comum em mods
que reaproveitam/recolorem sprites do jogo base, e o mod já exige o
jogo instalado pra funcionar de qualquer forma. Os `base_launcher_*.png`
inclusos são cópias literais dos arquivos do jogo, mantidos só pra
`gen_sprites.py` funcionar sozinho sem precisar apontar pra uma
instalação específica.
