# Cruzadinhas matemáticas interconectadas

Data: 2026-11-26

## Objetivo

Transformar os 39 níveis publicados do curso em cruzadinhas matemáticas: cada número faltante deve ocupar uma célula compartilhada por pelo menos uma equação horizontal e uma vertical. O jogador deduz o número usando as duas contas que se cruzam naquela célula.

## Estado atual

O catálogo publicado em `infra/data/course-catalog.json` organiza os níveis como listas de equações horizontais. A validação atual confirma que as equações estão corretas, mas não exige cruzamentos. A tela `PuzzleScreen` já renderiza matrizes 2D, aceita células verticais e associa o preenchimento a `inputId`. `lib/game/levels.js` e `lib/game/generatePuzzle.js` já fornecem exemplos locais e diários com números compartilhados.

## Decisão de arquitetura

Manter o formato atual do catálogo (`grid`, `inputIds`, `answerKey`, `bank`) e redesenhar os dados de cada nível. Não introduzir outro formato de puzzle nem alterar rotas, banco de dados ou estado do jogo. Cada célula de entrada continua tendo um `inputId` único; a própria posição da célula é o cruzamento usado pelas duas equações.

Os níveis podem usar topologias personalizadas de acordo com o número de lacunas e a progressão: cruzamento 2×2 (quatro células compartilhadas e quatro equações), 2×3 ou 3×2 (seis células compartilhadas e cinco equações). Esses rótulos contam os números compartilhados nas linhas e colunas; a grade 2D usa o espaço necessário para as equações e seus resultados. Os níveis 1–12 usam o cruzamento 2×2; níveis 13–29 alternam 2×3 e 3×2; níveis 30–38 alternam 2×3 e 3×2 com mais lacunas; o nível 39 usa 2×3 com as seis células compartilhadas vazias. A grade permanece uma matriz esparsa de células.

## Regras do puzzle

- Toda entrada de `inputIds` aparece em exatamente uma célula numérica da grade.
- Toda célula de entrada participa de pelo menos uma equação horizontal e uma vertical.
- As equações do puzzle formam uma única rede conectada por células numéricas compartilhadas.
- Cada equação completa continua no formato número, operador, número, igualdade, resultado e deve ser matematicamente correta.
- Cada resposta continua presente no banco de números.
- IDs de níveis, capítulos, sessões e IDs das entradas são preservados. Respostas e distratores podem ser atualizados para formar cruzamentos válidos; cada nível mantém sua quantidade de lacunas (3 nos níveis 1–29, 4 nos níveis 30–38 e 6 no nível 39), com operações e progressão adequadas ao capítulo.
- A instrução de cada nível explica que o número completa as contas horizontal e vertical do cruzamento.
- O desafio diário gerado e os níveis locais já cruzados continuam determinísticos e conectados.

## Experiência e compatibilidade

Manter seleção, arrastar e soltar números, feedback por célula, tentativas e verificação. O estilo visual da imagem anexada serve como inspiração para cores e banco de números; o requisito funcional vem do pedido do usuário. A interface deve ser conferida com as topologias novas em telas estreitas. A semeadura existente já remove `answerKey` dos dados públicos e grava as respostas separadamente; não é necessária migração nem mudança no contrato da API.
