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
vivo. Só o que estiver liberado chega a ser lançado; o resto fica
bloqueado, no mesmo tile que faz o lançamento.

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

`buildModes` usa só `"line"` (vertical/diagonal) — não os
`"launcherRectUp"`/`"launcherRectSide"` do Launcher vanilla (a versão
que planta um bloco retangular largo de uma vez), porque esses dois
dependem de uma matriz de colisão interna que, diferente das de
conveyor/splitter/foundation, não é uma das formas que aparecem nos
dados de forma legíveis do jogo — não deu pra copiar com confiança.
`"line"` não precisa de matriz nenhuma — confirmado pelo próprio Shaker
vanilla, que usa `buildModes:[{type:"line",...}]` sem shape própria —
então arrastar em coluna (o jeito normal de construir um eixo de
launcher) funciona igual ao vanilla, cada célula arrastada um segmento
de 1 tile separado; só falta a variante retangular larga.

A troca de tipo durante o arrasto (reto pra cima = Up, pra um canto =
Left/Right, incluindo em qual canto encaixa) é lógica genérica do
próprio jogo baseada em `registeredLauncherTypes` — funcionou desde a
primeira versão sem nenhum código de arrasto próprio.

## Ponto de honestidade

Tudo acima foi confirmado lendo o próprio código do jogo e, pros itens
3, 4, 5, 6 e 7 da lista de bugs, testando de fato versões anteriores no
jogo e rastreando a causa real de cada relato. `structures.register` /
`structureBehaviors.registerLauncherType` / `structures.getAtCell` /
`structures.update` / `tech.addDefinition` são chamadas públicas reais
e atuais do Sandkit. Os onze patches em `patches.json` (quatro do item
#3/#5, dois do item #6, um do item #4, quatro do item #7) mexem em
território não documentado, do mesmo jeito que
`grabber-safe-resize`/`toggle-grab` deste pacote já fazem por motivos
parecidos — cada um validado com o `validate-mod.js` deste
repositório (que roda o aplicador de patch de verdade do próprio jogo
contra os arquivos instalados de verdade, e confere que o resultado
remendado ainda é JavaScript sintaticamente válido), mas só jogar de
fato confirma o comportamento em tempo de execução ponta a ponta —
principalmente os do item #3/#5 ("a tela nativa, as caixinhas
clicáveis, a escolha de elemento e o modo avançado tratam este mod
igual a um Filter/Advanced Filter vanilla"), os do item #6 ("a tech
nova aparece, trava/libera certo, e realmente desbloqueia o bloco ao
pesquisar") e os do item #7 ("líquido/gás realmente sai voando só do
Advanced Filtered Launcher, e o Launcher/Launcher Mk2 vanilla e o
Filtered Launcher comum continuam recusando exatamente como antes") —
nenhum dos três é algo que dá pra confirmar 100% só lendo código.

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

Se os passos 1-2 não aparecerem certos, os patches do item #6 precisam
de outro olhar; se os passos 3-5 falharem, é o item #3/#5; se o passo
7 não lançar nada mesmo liberado, é o patch do item #4; se o passo 8
não lançar líquido/gás no Advanced, é o item #7 (patches de
Liquid/Gas); se o passo 9 mostrar o Filtered Launcher comum ou o
Launcher vanilla lançando líquido/gás, é o guard do item #7 que
precisa de outro olhar.

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
