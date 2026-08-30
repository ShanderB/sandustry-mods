# Molten Gold Density (Sandustry)

Ouro que entra na Smelter **sempre** vira ouro líquido — nunca "some sem
virar nada" — e o líquido resultante ocupa metade do espaço do sólido: a
cada 2 pixels de ouro sólido consumidos, exatamente 1 pixel de ouro
líquido é criado, sempre, determinístico (sem sorteio). Cada pixel de
ouro líquido gerado pela smelter vale o dobro na hora de vender/coletar,
então **o valor total não muda** — só o espaço físico ocupado.

## Instalar

Copie a pasta `gold-smelting-loss` para `%APPDATA%\sandustry\mods\`. Já
está instalado lá pra você testar.

## Histórico

- **v1**: usava o sistema de receitas nativo da smelter com `chance: 0.5`
  (sorteio por célula). Às vezes o ouro sólido era consumido e não virava
  ouro líquido nenhum — perda real e aleatória. Errado.
- **v2**: contador determinístico (2 sólido -> sempre 1 líquido, nunca
  falha), mas cada pixel de líquido valia o mesmo que 1 de sólido, então
  fundir 1000 de ouro rendia só 500 de valor — perda de 50% do valor.
- **v3 (atual)**: mesmo contador determinístico da v2, mas agora cada
  célula de ouro líquido criada pela smelter é marcada (via um data field
  por célula) como valendo o dobro. Fundir 1000 de ouro sólido agora
  sempre gera 500 pixels de líquido que juntos valem 1000 — nem perde nem
  ganha valor, só compacta o espaço.

## Como funciona (mod checando `sandustry.com/sandkit.html` como referência)

1. **Compactação**: hook `cell:process` (evento de baixo nível disparado
   quando uma estrutura periódica como a smelter processa uma célula),
   filtrado por `guard:{elementType:"gold"}`. Cada chamada confirma que a
   estrutura é uma `smelter`, sempre remove a célula de ouro sólido, e um
   contador por smelter decide quando criar a célula de líquido (a cada
   2ª chamada). O sistema de receita nativo (`chance`) é ignorado —
   `context.cancel()` impede que ele rode em paralelo.
2. **Preservação de valor**: ao criar a célula de líquido, o mod grava
   `2` num data field livre da célula
   (`api.elements.setDataFieldAtCell`). O hook `resource:collection:prepare`
   (disparado quando qualquer coleta de recurso "gold" acontece) lê esse
   data field e, se marcado, dobra `args.amount` pra aquela célula
   específica. Ouro normal (nunca fundido) não tem a marca e continua
   valendo 1.

## Sobre o mod "Gold Safe" que você linkou

Dei uma olhada — é um mod diferente (do mesmo autor do Vertical Conveyor
Portal), que cria um **cofre/estrutura de armazenamento** pra guardar
ouro sólido e líquido como valor guardado, evitando perder ouro em save/
load ou organização de inventário. Não mexe em densidade/conversão da
smelter, então não faz o que você pediu — mas não conflita com este mod
também (funcionalidades independentes).

## Ponto de honestidade

`cell:process` **não tem a estrutura dos argumentos documentada
oficialmente** — só o nome do hook e que ele aceita `guard:{elementType}`.
Tive que supor os nomes dos campos (tentei `cellX`/`cellY`,
`position.x/y`, `cellPosition.x/y`, nessa ordem). Se não funcionar, o mod
loga um aviso (`log("warn", ...)`) com o conteúdo real do objeto `args`
na primeira vez que o hook dispara — se puder me colar essa linha do log
do jogo, eu ajusto certeiro. O hook `resource:collection:prepare`, por
outro lado, **é** totalmente documentado, então a parte de dobrar o valor
tem bem mais chance de já funcionar de primeira.

## Publicar no Steam Workshop

O mod está pronto pra publicar:

- `preview.png` (512x512) incluso — ícone da Smelter do próprio jogo com
  um diagrama "2 sólido -> 1 líquido, mesmo valor".
- `modinfo.json` já tem `name`, `description` e `version` preenchidos —
  viram o título, a descrição e a nota de versão do item no Workshop. O
  nome foi trocado pra **Molten Gold Density**, já que "Loss" não reflete
  mais o comportamento (não tem perda de valor desde a v3).

Pra publicar: com o Steam aberto, abra o Sandustry, vá na aba de Mods,
ache o mod na lista de mods locais e use a opção de publicar/upload.
A primeira publicação sai como **Unlisted** — depois é só ir na página do
item no Workshop e marcar como Public quando quiser divulgar. O jogo
grava um `workshop.json` na pasta na primeira publicação; não edite nem
apague esse arquivo — é o que liga esta pasta local ao item publicado
pras próximas atualizações (suba a `version` no `modinfo.json` e publique
de novo pra atualizar o mesmo item).
