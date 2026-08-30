# Resize Grabber While Holding (Sandustry)

Deixa redimensionar o Grabber (Ctrl+Scroll ou os botões de tamanho) mesmo
segurando material. Diminuir só acontece se tudo que está sendo segurado
ainda couber no tamanho menor — o material é reempacotado sem buracos nem
vazamento pelas bordas. Se não couber, o mod simplesmente recusa o
redimensionamento e nada muda. Aumentar o tamanho segurando algo já era
seguro no jogo original e também foi desbloqueado do mesmo jeito.

## Instalar

Copie a pasta `grabber-safe-resize` para `%APPDATA%\sandustry\mods\`. Já
está instalado lá pra você testar.

## O problema original (achei lendo o próprio código do jogo)

O jogo guarda o conteúdo do Grabber numa matriz linear por célula
(`item.data.matrix`), onde `matrix[0]` é o tipo do material sendo
segurado, `matrix[1]` é a contagem de células preenchidas, e
`matrix[2..]` é o conteúdo célula a célula (0 = vazia). A função nativa
`setGrabberSize` que redimensiona essa matriz faz um "corte" ingênuo: ao
diminuir, ela só mantém o **canto superior esquerdo** da grade antiga que
couber na nova grade menor, e **descarta silenciosamente** qualquer célula
preenchida fora desse canto — exatamente o vazamento/perda que você
descreveu. Por causa disso, os desenvolvedores simplesmente **desabilitam**
os botões de tamanho e cancelam o Ctrl+Scroll sempre que `matrix[1]>0`
(algo segurado), em vez de consertar a lógica.

## O que este mod muda (tudo em `js/bundle.js`, 4 patches)

1. **`setGrabberSize` fica seguro**: antes de mexer em qualquer coisa,
   guarda quantas células estavam preenchidas. Se for diminuir e essa
   contagem for maior que a nova capacidade (novo tamanho x novo tamanho),
   a função simplesmente **retorna sem alterar nada** — o "não permita"
   que você pediu. Se couber, ela ainda roda o corte original (que já
   funciona certo pra manter tudo que sobra no canto), e **depois**
   redistribui qualquer célula que o corte descartou nos espaços vazios
   que sobraram dentro da nova grade — cobrindo exatamente o caso que você
   descreveu (encolher de 8 pra 7 deixaria buracos e itens de fora, mesmo
   cabendo no total).
2. **Ctrl+Scroll desbloqueado**: removida a linha que cancelava o scroll
   assim que havia algo segurado. Agora ele sempre tenta redimensionar, e
   quem decide se aceita ou recusa é o `setGrabberSize` já corrigido.
3. **Botões de tamanho (Min/−/+/Max) desbloqueados**: removida a condição
   que desabilitava/bloqueava os 4 botões enquanto segurando algo. Mesma
   lógica: a decisão de aceitar/recusar fica só no `setGrabberSize`.

## Ponto de honestidade

Isso mexe direto no `bundle.js` minificado do jogo (não existe hook
público documentado no Sandkit pra esse caso específico), então é mais
frágil a updates do que um mod baseado só na API — se uma atualização do
jogo mudar essa área do código, os patches podem parar de bater e o mod
simplesmente não vai carregar (o jogo reporta patch com erro e ignora,
não trava nada). Validei os 4 patches rodando o validador/aplicador real
do jogo (`workshop-mods.js` extraído) contra o `bundle.js` da sua
instalação atual, e o resultado bateu sintaticamente — mas só o teste
dentro do jogo confirma 100%. Testa aí: encolhe segurando pouco material
(deve funcionar e reempacotar), tenta encolher segurando mais do que cabe
(deve recusar, sem perder nada), e aumenta segurando algo (deve continuar
funcionando como sempre funcionou).

## Publicar no Steam Workshop

O mod está pronto pra publicar:

- `preview.png` (512x512) incluso — ícone do Grabber do próprio jogo com
  um diagrama mostrando a grade 8x8 espalhada virando uma 6x6 compacta,
  sem buracos.
- `modinfo.json` já tem `name`, `description` e `version` preenchidos —
  viram o título, a descrição e a nota de versão do item no Workshop.

Pra publicar: com o Steam aberto, abra o Sandustry, vá na aba de Mods,
ache "Resize Grabber While Holding" na lista de mods locais e use a opção
de publicar/upload. A primeira publicação sai como **Unlisted** — depois
é só ir na página do item no Workshop e marcar como Public quando quiser
divulgar. O jogo grava um `workshop.json` na pasta na primeira
publicação; não edite nem apague esse arquivo — é o que liga esta pasta
local ao item publicado pras próximas atualizações (suba a `version` no
`modinfo.json` e publique de novo pra atualizar o mesmo item).
