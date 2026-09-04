# Visible Water on Map (Sandustry)

Faz elementos soltos aparecerem no mapa/minimapa — água, vapor, lava,
areia, gás, qualquer coisa com cor própria. O mapa nativo simplesmente
nunca desenhava nenhum elemento em nenhuma cor, só terreno/parede/
estrutura; esse mod corrige isso pra todos eles, e ainda dá pra água
especificamente um teal bem distinto do azul do céu, pra ela não se
confundir com o fundo do mapa depois de aparecer.

## Instalar

Copie a pasta `visible-water-map` para `%APPDATA%\sandustry\mods\`. Já
está instalado lá pra você testar.

## Verifiquei o Workshop antes de criar

Busquei por "water", "water map", "minimap", "map view" — nada trata de
visibilidade de água no mapa. Achei mods sobre editor de mapa (Map
Studio, Sandustry Map Editor), mas nenhum sobre cor/visibilidade da água
no próprio jogo.

## Por que a água "sumia"

Não é falta de recurso — é colisão de cor. O shader que desenha o céu do
jogo usa `rgb(15, 145, 255)` no topo do gradiente atmosférico. A água
(campo `metaColor` da definição do elemento, usado em todo lugar que
mostra a cor de um elemento: mapa, tooltip, seletor de filtro, barra de
tanque do vácuo) é `rgb(30, 144, 255)` — praticamente a mesma cor. No
mapa, água e céu aberto ficam quase indistinguíveis.

## O que o mod faz

Uma chamada só, na API pública documentada do Sandkit:

```js
api.elements.updateDefinition("water", { metaColor: 0x00c8b4 });
```

Troca a cor da água pra um teal bem distinto do azul do céu (diferença
de matiz, não só de brilho, pra não desaparecer de novo em outras
condições de luz/zoom). Como `metaColor` é lido em todo lugar que mostra
cor de elemento — não só o mapa — a mudança aparece em qualquer lugar
que já mostrava a cor da água antes.

Isso sozinho não é suficiente (ver bugs abaixo) — o mod também inclui
um patch pequeno no `bundle.js` pra fazer o mapa considerar elementos
soltos ao escolher a cor de cada célula, coisa que ele nunca fazia.

## Bug: nenhuma diferença visível

**Causa achada:** `updateDefinition("water", ...)` passando a **string**
diretamente não funciona pra elemento nativo. Por dentro, essa função só
procura o id em `sandkit.mods.elements` — a tabela de elementos
**registrados por mod**. Água nunca foi registrada ali (é conteúdo nativo
do jogo), então a busca falha silenciosamente e a função retorna sem
fazer nada — sem erro, sem efeito. É o mesmo tipo de armadilha que já
apareceu nos outros mods (`tech.getDefinitionById`, `registerNode`
"missing parent") — funções que só reconhecem coisa registrada via API
de mod, não conteúdo nativo do jogo.

**Corrigido:** em vez de passar a string, primeiro resolvo pro **tipo
numérico** com `api.elements.getTypeFromId("water")`, e chamo
`updateDefinition` com o número. Isso pula o lookup problemático e usa o
outro caminho da função — o mesmo que `getDefinitionByType`/
`isTypeAtCell` já usam pra qualquer elemento, nativo ou não.

## Bug: ainda sem aparecer, mesmo com muita água

**Causa real (a de verdade dessa vez):** mudar a cor nunca poderia ter
funcionado sozinho, porque a função que decide a cor de cada pixel do
mapa (`zc` no `bundle.js`) **nunca olha pra elementos soltos** (água,
areia, lava, o que for). Ela checa, nessa ordem, só três coisas por
célula: (1) tem uma estrutura ali? (2) é terreno? (3) é parede? Se
nenhuma bater, o pixel fica transparente — mesmo que a célula esteja
cheia de água. A paleta de cores por elemento (`bc`, montada a partir
do `metaColor` de cada elemento, água incluída) já existe e já tinha a
cor nova certinha — ela só nunca era consultada. Por isso a primeira
correção (trocar a cor) não fazia diferença nenhuma: o renderer do mapa
excluía água estruturalmente, não por causa de cor.

**Corrigido:** patch no `bundle.js` (`patches.json`, patch
`show-elements-on-map`) que adiciona um 4º passo em `zc`: se a célula
não é estrutura/terreno/parede, checa se é um elemento
(`ie.on.isCellIdElement`) e, se for, busca sua cor em `bc`
(`ie.on.getElementTypeFromCellId` + `bc.get(tipo)`) antes de desistir e
retornar transparente. Assim qualquer elemento com `metaColor` passa a
aparecer no mapa — e a mudança de cor da água (item acima) finalmente
tem efeito visível, porque agora a célula realmente é desenhada.

## Bug: mapa só atualiza reabrindo o jogo

**Causa:** o mapa não é redesenhado célula a célula toda hora — ele
mantém uma textura (`idBuffer`/`idTexture`) e só a atualiza em dois
momentos: (1) uma varredura completa do mapa inteiro, feita **uma
única vez**, quando a tela de mapa é montada pela primeira vez na
sessão (por isso o mundo inteiro aparece certinho logo depois de abrir
o jogo); (2) um refresh incremental, só num raio de ~24 células ao
redor do jogador, disparado pelo evento `"player:moved"` — mas esse
refresh só roda quando névoa **nova** é revelada (`Jc`, a função de
fog-of-war). Em área já explorada a névoa já está 100% revelada, então
`Jc` nunca retorna `true` de novo ali, e o refresh nunca dispara — o
que já foi desenhado uma vez fica congelado. Por isso água escoando,
lava se movendo etc. em área já visitada só aparecem certos depois de
reabrir o jogo (o que força aquela varredura completa de novo).

**Corrigido:** patch (`patches.json`, patch
`refresh-map-elements-on-player-move`) no handler do evento
`"player:moved"`: antes, o refresh incremental (`sd`, a função que
recalcula a cor de cada célula num raio do jogador) só rodava dentro do
`if` que checava névoa nova. Agora ele roda **sempre** que o jogador se
move, independente de ter névoa nova ou não — o resultado da própria
`sd` (que já informa se algo mudou) decide se vale a pena re-subir a
textura pra GPU. Assim, andar por uma área já explorada também
atualiza a cor das células ao redor com o estado atual do jogo, sem
precisar reabrir nada.

## Pergunta: dá pra usar o mesmo comportamento de blocos como o Foundation?

Sim, e é bem melhor que o fix anterior. Achei como o jogo atualiza o
mapa instantaneamente quando você constrói/desmonta um bloco: os
handlers dos eventos `"building:placed"`, `"building:removed"`,
`"structures:placed"` e `"structures:removed"` recalculam a cor daquela
célula específica na hora (sem depender de proximidade do jogador) e
sobem a textura pra GPU imediatamente. Isso é o que faz o Foundation
"atualizar sozinho" — não é mágica, é só que colocar/remover estrutura
dispara um refresh pontual daquela célula.

Elemento (água, lava...) não tem um evento equivalente — ele se move a
cada tick da simulação, em qualquer célula do mapa, então disparar um
evento por movimento de elemento seria caríssimo (a simulação roda
muito mais rápido que o render). Só que reparando melhor, achei que a
tela do mapa já roda um loop a cada frame (`requestAnimationFrame`) que,
entre outras coisas, processa uma fila de "células sujas" desses
eventos de construção. Aproveitei esse mesmo loop.

**Corrigido:** patch (`patches.json`, patch
`refresh-map-elements-every-frame`) que adiciona, dentro desse loop por
frame que já existe, uma chamada extra ao `sd` (a mesma função de
refresh incremental) num raio de ~24 células ao redor do jogador — a
cada frame, não só quando o jogador se move. Na prática, isso fica
indistinguível de "atualiza sozinho que nem o Foundation": qualquer
mudança perto de você (água escoando, lava avançando) aparece no
próximo frame, sem precisar andar, sem precisar sair e voltar pro mapa.

A ressalva do raio continua valendo — é a mesma limitação do próprio
sistema de névoa do jogo (o Foundation também só atualiza a célula onde
foi colocado, não o mapa inteiro). Uma mudança bem longe de onde você
está só aparece quando você chegar perto.

## Efeito colateral bom: não é só água

Como a checagem em `zc` foi adicionada pra "elemento" em geral, não só
água, todo elemento solto com `metaColor` passa a aparecer no mapa:
vapor, lava, areia, gás, óleo etc. Testado pelo usuário e confirmado
como comportamento desejado — não só não atrapalha, como deixa o mapa
bem mais informativo (dá pra ver flows de lava e bolsões de gás à
distância, por exemplo). Por isso o nome do mod ficou "Visible Water on
Map" mas o efeito real é mais amplo; a descrição no Workshop já deixa
isso explícito.
