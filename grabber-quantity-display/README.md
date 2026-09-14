# Grabber Quantity Display (Sandustry)

Mostra quantas células de material o Grabber está segurando no momento,
bem ao lado do indicador de tamanho que já aparece na tela (ex: `42/64`
ao lado do `8x8`).

## Instalar

Copie a pasta `grabber-quantity-display` para `%APPDATA%\sandustry\mods\`.
Já está instalado lá pra você testar.

## Como funciona

O jogo já tem um overlay nativo (`mods|sizeOverlay|...` /
`mods|grabberSizeScroll|...`) que aparece acima da hotbar quando o
Grabber está ativo, mostrando o nome "Grabber", os botões Min/−/+/Max, o
tamanho atual (`8x8`) e a dica "Ctrl+Scroll". Esse overlay é registrado
via `se.FH.ui.overlays.register(e,"hotbar","grabber",...)` em
`js/bundle.js` e já tem em escopo, no momento de montar a UI, tanto o
item ativo (`i`, o próprio Grabber) quanto o tamanho total em células
(`o`, ex: 64 pra um Grabber 8x8).

O primeiro patch (`replace` em `js/bundle.js`) insere um `span` extra
logo depois do `span` que mostra o tamanho (`8x8`): quando o Grabber está
segurando algo (`data.matrix[1] > 0` — a mesma contagem de células
preenchidas usada em [[grabber-safe-resize]]), ele mostra
`quantidade/capacidade` em amarelo. Quando o Grabber está vazio, nada
extra aparece — o overlay continua exatamente como era.

### Bug encontrado no teste: o número não atualizava ao segurar

Na primeira versão o número aparecia mas ficava "congelado". O motivo:
esse overlay só re-renderiza quando o jogo chama explicitamente
`se.FH.ui.overlays.update(e,"hotbar")` (é um sinal manual, não um
refresh por frame). O código que processa pegar/soltar material dentro
do loop de arraste do Grabber (onde `matrix[1]` é incrementado/decrementado
célula a célula) nunca chamava esse `update` — só upgrades, os próprios
botões Min/Max e o checkbox de "Shaking" chamavam. Ou seja, o número só
ia atualizar em momentos meio aleatórios (ex: ao redimensionar), não
enquanto você estava efetivamente arrastando o mouse pra pegar/largar
material.

Os outros dois patches (`refresh-grabber-overlay-on-pickup` e
`refresh-grabber-overlay-on-drop`) adicionam uma chamada a
`r.FH.ui.overlays.update(e,"hotbar")` logo no fim de cada um dos dois
ramos desse handler (pickup e drop), então agora o overlay é marcado
pra re-renderizar em todo frame em que você está segurando o botão do
mouse com o Grabber ativo — o número passa a acompanhar em tempo real.

## Ponto de honestidade

Assim como o `grabber-safe-resize`, isso mexe direto num trecho do
`bundle.js` minificado (não achei uma API pública documentada do Sandkit
pra "adicionar um elemento a um overlay nativo já existente" sem
recriá-lo do zero), então é mais frágil a updates do jogo do que um mod
100% baseado em API. Validei o patch rodando o validador/aplicador real
do jogo (`node ../validate-mod.js grabber-quantity-display`) contra o
`bundle.js` da sua instalação atual — bateu 1 match e a sintaxe do
arquivo remendado ficou válida. Testa aí segurando material com o
Grabber: o número deve aparecer e atualizar em tempo real conforme você
pega/solta material.

## Publicar no Steam Workshop

O mod está pronto pra publicar:

- `preview.png` (512x512) incluso — o ícone real do Grabber (extraído do
  próprio `app.asar` do jogo, `dist/img/grabber_icon.png`) sobre um fundo
  com glow, com um diagrama abaixo mostrando uma grade parcialmente
  preenchida virando o número `28/36`. Gerado por `gen_preview.py`
  (mesma técnica dos outros mods da pasta: só sprite real do jogo +
  formas desenhadas com PIL, nada de imagem gerada por IA). Pra
  regenerar depois de mudar o diagrama: `python3 gen_preview.py` nesta
  pasta (precisa do `grabber_icon.png`, que já está aqui do lado).
- `modinfo.json` já tem `name`, `description` e `version` preenchidos —
  viram o título, a descrição e a nota de versão do item no Workshop.

Pra publicar: com o Steam aberto, abra o Sandustry, vá na aba de Mods,
ache "Grabber Quantity Display" na lista de mods locais e use a opção de
publicar/upload. A primeira publicação sai como **Unlisted** — depois é
só ir na página do item no Workshop e marcar como Public quando quiser
divulgar. O jogo grava um `workshop.json` na pasta na primeira
publicação; não edite nem apague esse arquivo — é o que liga esta pasta
local ao item publicado pras próximas atualizações (suba a `version` no
`modinfo.json` e publique de novo pra atualizar o mesmo item).
