# Resource Signal Readers (Sandustry)

Três blocos na aba **Logic**: **Gold Reader**, **Energy Reader**,
**Fluxite Reader**. Cada um emite sinal `true` pros fios de lógica
conectados quando o recurso correspondente guardado (`store.resources.gold`
/ `.energy` / `.fluxite`) está no valor configurado ou acima. Cada bloco é
fixo num recurso só — quer ler os três, usa os três blocos.

O limiar (X) agora é **por instância**: clique num bloco já colocado
(sem estar com a Signal Linker ou o Demolisher ativos) pra abrir um
painel e definir o valor daquele bloco especificamente. Cada bloco
guarda o próprio número — dois "Gold Reader" podem ter limiares
diferentes ao mesmo tempo. **Opções → Mods → Resource Signal Readers**
ainda existe, mas agora só define o valor **inicial** de blocos recém
colocados (antes de você clicar neles pela primeira vez).

## Instalar

Copie a pasta `resource-signal-readers` para `%APPDATA%\sandustry\mods\`.
Já está instalado lá pra você testar.

Removidos todos os logs de diagnóstico (o relatório em `api.ui.alert`, os
`console.log`/`console.error`) agora que tudo está confirmado
funcionando — o mod carrega em silêncio, sem popup nenhum.

## Verifiquei o Workshop antes de criar

Não achei nada assim pronto. O mais próximo é o **Battery Sensor**
(Electric, 164 inscritos) — só energia, e o próprio autor reporta
problema de performance porque ele recalcula tudo via floodfill toda
hora. O nosso lê `store.resources.*` direto, sem esse custo.

## Achado técnico (pesquisa em repositório da comunidade)

Clonei dois repositórios oficiais da comunidade
([sandkit-surface-map](https://github.com/sandustry-mods/sandkit-surface-map)
e [mods](https://github.com/sandustry-mods/mods)) que documentam/exemplificam
a API do Sandkit extraída direto do jogo. Isso confirmou duas coisas
importantes:

1. `sandkit.state.store.resources.{gold,energy,fluxite}` é o jeito
   correto de ler os totais guardados (usado pelo mod oficial
   "Power Monitor" da comunidade).
2. A API pública **só expõe registrar um bloco como receptor de sinal**
   (`api.signals.targets.register` — usado por lâmpadas, portas). Não
   existe função pública pra registrar um bloco como **fonte** de sinal,
   mesmo o motor do jogo tendo um mecanismo interno completo pra isso
   (usado pelos sensores nativos como `signalSensor`).

## O que o patch faz

Um único patch, **puramente aditivo**, em `js/bundle.js`: adiciona um
método novo (`registerSenderType`) do lado do método já existente
(`targets.register`), sem alterar nem remover nada da lógica original.
Esse método novo replica exatamente o mecanismo interno que o próprio
jogo usa pros sensores nativos (`senderTypes.add` /
`senderOutputGetters.set`), confirmado lendo o código que **consome**
esses dados (`senderOutputGetters.get(structure.type)` na hora de
calcular o sinal de um fio).

## Bug: blocos não apareciam no menu de construção

**Tentativa 1** (não resolveu): supus que faltava marcar as estruturas
como sempre desbloqueadas (`alwaysUnlocked: true`). O log do jogo
confirmou que o patch aplicou certinho, mas os blocos continuaram sem
aparecer, então essa não era a causa raiz (ou não a única).

**Tentativa 2** (não resolveu): troquei pra pendurar os 3 blocos na tech
**"Signal Devices"** (paga com tickets dos bichinhos, a mesma que libera
o `signalSensor` nativo) via `api.tech.updateDefinition`. Você confirmou
que já tem Signal Devices pesquisado (sensores nativos aparecem), então
descartei a hipótese de "tech não pesquisada" — mas os blocos continuaram
sumidos, o que apontava pra um bug na minha chamada, não no conceito.

**Tentativa 3** (não resolveu): troquei o id da tech de string
(`"signalDevices"`) pra número (`sandkit.enums.Tech.SignalDevices` = 97,
confirmei esse valor batendo com o código do jogo), já que tech usa id
numérico internamente. O toast que você me mandou mostrou que o número
estava certo, mas `tech.getDefinitionById(97)` mesmo assim **"returned
nothing"**. Isso indica que esse par de funções específico
(`getDefinitionById`/`updateDefinition`) tem algum problema na própria
API do jogo — não era erro meu de id.

**Tentativa 4** (versão atual): abandonei `getDefinitionById` por
completo. Em vez de tentar editar a tech "Signal Devices" existente,
registro uma tech **nova e pequena** ("Resource Signal Readers") via
`api.tech.registerNode` — a mesma função que o mod de referência "Atomic
Age" usa com sucesso comprovado pra desbloquear as máquinas dele. Essa
tech nova exige "Signal Devices" como pré-requisito e custa só 1 ticket
— aparece do lado dela na árvore de tecnologia, e uma vez pesquisada
libera os 3 blocos. Não é exatamente "libera sozinho junto com Logic"
como você pediu, mas é bem próximo: aparece disponível assim que você já
tem Signal Devices, custando quase nada.

Adicionei um **relatório na tela** (sem precisar de DevTools): o mod
mostra, ao carregar cada save, uma linha OK/FAIL pra cada etapa (sprite,
estrutura, sender, unlock). Trocado de toast (some rápido demais) pra
`api.ui.alert` — um diálogo modal que fica aberto até você fechar, dá pra
ler com calma e tirar print sem pressa.

**Tentativa 5** (versão atual): `registerNode` também falhou —
"missing parent 97". Achei a causa lendo a validação interna: o
sistema só reconhece como pai um nó que **também** foi registrado via
`registerNode` (guarda tudo num dicionário separado dos ~110 techs
nativos do jogo) — ou seja, não dá pra pendurar uma tech nova embaixo de
uma tech nativa como "Signal Devices" por esse caminho. É uma limitação
real da API nessa versão do jogo, não bug meu.

Desisti de integrar com a árvore de tecnologia. Agora uso **dois
mecanismos redundantes** pra garantir que os blocos fiquem desbloqueados
desde o início: `alwaysUnlocked: true` na definição da estrutura, **e**
`api.player.buildings.unlockByType(id)` (grava direto na lista de
construções desbloqueadas do jogador — o mesmo dado que o menu de
construção consulta). Se um dos dois não for respeitado, o outro deve
segurar. O toast agora também confirma com `isUnlockedByType` se cada
bloco ficou marcado como desbloqueado de fato.

## Bloco apareceu e ligou, mas a lâmpada não acendia

Isso confirmou que o desbloqueio e o link funcionaram! O problema era
outro: descobri, lendo o código de propagação de sinal, que
`registerSenderType` só é consultado **uma vez** — no exato momento em
que você puxa o fio com a Signal Linker, pra dar um valor inicial ao
link. Depois disso, o "tick" que roda todo frame só relê o valor
**guardado em cache** naquele link (`.on`), sem chamar a função de novo.
Os sensores nativos ficam "vivos" porque cada um tem seu próprio
processamento periódico que fica reescrevendo esse cache constantemente
— e o nosso não tinha nada assim.

**Correção 1** (não resolveu certo — lâmpada ficava sempre ligada):
mexi eu mesmo, na mão, no array de links (`session.mods.signals.links`),
copiando o `.on` e marcando "sujo". Tinha bug em algum lugar dessa parte
manual.

**Correção 2** (versão atual, seguindo sua sugestão): rastreei como o
`signalPresenceSensor` **nativo** faz isso e usei exatamente o mesmo
caminho. Ele chama `sandkit.api.signals.setAll(posição, true/false)` toda
vez que detecta mudança — essa função não aparece na doc pública, mas
**já existe de verdade** em `sandkit.api.signals` (o próprio jogo
pluga ela lá quando o sistema de sinais inicializa, só não aparece numa
extração estática da API porque isso acontece em tempo de execução).
Troquei meu código manual por uma chamada a essa mesma função oficial,
disparada pelo evento `"frame:update"` — o **mesmo evento que o tick de
propagação de sinal do próprio jogo usa** — em vez de um `setInterval`
separado no meu próprio relógio. A comparação roda todo frame (é barata,
só um número), mas `setAll` só é chamado quando o true/false realmente
muda, igual um sensor nativo só avisa em transições reais.

## Tooltip com o limiar (pedido novo)

Adicionei: passar o mouse em cima de um bloco já colocado mostra uma
frase tipo "Outputs true when stored gold is >= 1000 (currently 640)."
— usando o mesmo mecanismo (`tooltipHover` + `structure.data.summary`)
que o mod de referência "Atomic Age" usa pro status das máquinas dele. A
tooltip atualiza sozinha se você mudar o limiar nas configurações do mod
enquanto o jogo está aberto.

## Achei o bug de verdade: setAll não existe ainda quando o mod carrega

O relatório na tela mostrou a linha que faltava: **`api.signals.setAll is
MISSING at load time`**. `setAll` só é conectado em `sandkit.api.signals`
depois que o próprio sistema de sinais do jogo termina de inicializar —
não existe ainda no instante em que o `main.js` do mod roda.

O bug: meu código marcava um valor como "já enviei" **mesmo quando a
chamada falhava** (porque `setAll` ainda não existia) — então nunca
tentava de novo, mesmo depois do `setAll` ficar disponível de verdade.
Por isso a lâmpada ficava travada no valor da primeiríssima leitura (a
do momento em que você ligou o fio, via `registerSenderType`), pra
sempre.

**Corrigido:** agora só marca "enviado" depois de uma chamada que
realmente funcionou. Continua rodando todo frame, então assim que o
`setAll` do jogo fica pronto (alguns frames depois de carregar), a
próxima tentativa já pega e passa a atualizar normalmente daí pra frente.

## Lâmpada nunca acendia mais (com threshold certo)

Com o threshold certo confirmado, o novo sintoma era o oposto do
anterior: nunca acendia, nem passando do limiar. Reconsiderei o
`setAll`: `sandkit.api` provavelmente é um retrato/wrapper montado **uma
vez**, no exato instante em que o script do mod começa a rodar — antes
do próprio jogo terminar de inicializar o sistema de sinais e adicionar
`setAll` no objeto real. Isso significa que a cópia que o mod enxerga
**nunca** ganha esse método, em frame nenhum — meu "espera ficar
disponível" jamais teria sucesso.

**Corrigido:** voltei a escrever direto em `session.mods.signals`
(através de `sandkit.state`, o mesmo canal de leitura/escrita que já uso
pra ler `store.resources.*`) — esse SIM é o objeto real que o jogo usa
pra propagar sinal, não um retrato. Reproduzo exatamente o que o
`setAll` faz por dentro (`.on = valor` em cada link de saída, marca cada
receptor como "sujo"), sem a lógica de "só se mudou" — sempre escreve,
todo frame, mais simples e mais parecido com o comportamento real do
`setAll`.

Também adicionei ao relatório quantos blocos de cada tipo estão
colocados e quantos fios de saída foram encontrados agora mesmo — se o
número de fios for 0, o problema é a ligação/detecção do link, não a
comparação de valor.

## Painel de configuração ao clicar (pedido novo)

Clicar num bloco já colocado abre um painel (React, via `api.ui.inject`,
o mesmo mecanismo do mod "Power Monitor" da comunidade) com um campo
numérico pra definir o limiar daquele bloco. `Enter` salva, `Esc` ou
clicar fora cancela. O valor fica salvo em `structure.data.threshold`
(dado por instância da estrutura), lido tanto pelo cálculo do sinal
quanto pela tooltip.

Pra detectar o clique, usei o hook público `action:intercept` (não o
sistema interno `interactableHandlers` que os blocos clicáveis nativos
usam — esse é montado em tempo de execução do mesmo jeito problemático
que o `setAll`, então evitei por precaução). O clique é ignorado se a
Signal Linker ou o Demolisher estiverem ativos, pra não atrapalhar ligar
fio nem derrubar o bloco.

## Ponto de honestidade

Isso mexe em território não documentado nem usado por nenhum mod da
comunidade que encontrei (`registerSenderType`, e escrever direto em
`session.mods.signals` pra manter o sinal ao vivo) — foi a parte mais
arriscada de todo o processo, com várias tentativas erradas pelo caminho
(documentadas acima). **Confirmado funcionando de ponta a ponta** pelo
usuário: bloco aparece, desbloqueado desde o início, sinal liga/desliga
corretamente conforme o limiar, painel de configuração por clique
funciona. Os logs de diagnóstico que ajudaram a chegar até aqui foram
removidos do código depois de tudo confirmado — se precisar depurar de
novo no futuro, esse histórico acima mostra exatamente as armadilhas já
mapeadas (`sandkit.api` como retrato tirado cedo demais, `setAll` nunca
aparecendo nele, etc).

## Publicar no Steam Workshop

O mod está pronto pra publicar:

- `preview.png` (512x512) incluso — os três ícones dos blocos (lingote,
  raio, diamante) com fios convergindo pra uma lâmpada de sinal acesa,
  comunicando o conceito "leem recurso, emitem sinal".
- `modinfo.json` já tem `name`, `description` e `version` preenchidos,
  refletindo o comportamento atual (configuração por clique no bloco, não
  mais só pelas configurações do mod).

Pra publicar: com o Steam aberto, abra o Sandustry, vá na aba de Mods,
ache "Resource Signal Readers" na lista de mods locais e use a opção de
publicar/upload. A primeira publicação sai como **Unlisted** — depois é
só ir na página do item no Workshop e marcar como Public quando quiser
divulgar. O jogo grava um `workshop.json` na pasta na primeira
publicação; não edite nem apague esse arquivo — é o que liga esta pasta
local ao item publicado pras próximas atualizações (suba a `version` no
`modinfo.json` e publique de novo pra atualizar o mesmo item).
