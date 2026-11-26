# Cruzadinhas matemáticas interconectadas

Data: 2026-11-26 (revisado após estudo do Crossmath)

## Objetivo

Transformar os 39 níveis publicados do curso em cruzadinhas matemáticas no estilo do Crossmath (https://crossmath.net/): contas horizontais e verticais que se cruzam e formam uma única rede, onde o jogador descobre os números faltantes usando as contas vizinhas. Os layouts 2×2, 2H+3V e 3H+2V já aprovados continuam disponíveis como estruturas de nível.

## Estado atual

O catálogo publicado em `infra/data/course-catalog.json` organiza os níveis como listas de equações horizontais. A validação atual confirma que as equações estão corretas, mas não exige cruzamentos. A tela `PuzzleScreen` já renderiza matrizes 2D, aceita células verticais e associa o preenchimento a `inputId`. `lib/game/levels.js` e `lib/game/generatePuzzle.js` já fornecem exemplos locais e diários com números compartilhados.

## Estudo de referência: Crossmath

Observações feitas jogando o tutorial e partidas Fácil, Médio e Expert em 2026-11-26:

- **Tutorial (cruz):** uma conta horizontal e uma vertical se cruzam no segundo operando (`8 + ? = ?` com `7 + ? = 9`). Primeiro o jogador resolve a lacuna do cruzamento e depois usa esse valor para achar a lacuna que está em uma só conta. O tutorial ensina a dedução em cadeia.
- **Fácil (grade 6×7, 4 contas, 5 lacunas):** forma de "serpente". O resultado de uma conta vertical vira o primeiro operando de uma conta horizontal, e o operando de uma conta horizontal é também o topo de uma vertical. Os cruzamentos podem ficar em qualquer posição numérica: operando esquerdo, operando direito ou resultado. Há muitos números dados, e várias lacunas aparecem numa única conta, resolvida depois do cruzamento vizinho.
- **Médio (grade 11×9, cerca de 11 contas, 14 lacunas):** várias redes em forma de anel e de escada, unidas numa só rede, com as quatro operações misturadas.
- **Expert (grade 11×9, cerca de 11 contas, 17 lacunas):** quase só os resultados são dados. As lacunas ficam principalmente nos operandos, e algumas contas têm duas lacunas, que só se resolvem com as contas vizinhas e o banco.
- **Banco:** contém exatamente as respostas, com repetições, e cada peça é usada uma vez. Não há distratores.
- **Símbolos compartilhados:** às vezes um mesmo `+` ou `=` serve às duas direções.

### Análise técnica com REA

O Crossmath serve apenas como estudo. Nenhum código, dado de puzzle, grade ou arte do site é copiado para o projeto: os níveis são criados do zero, e só os princípios gerais observados orientam o desenho.

Analisei o jogo publicado em `https://crossmath.net/play/` com o REA (captura de rede com `capture_browser_scenario`) e com a leitura direta do banco que a página carrega. Resultados:

- O jogo é um app Flutter Web (`main.dart.js` com CanvasKit). Os puzzles vêm de um SQLite de 20 KB (`assets/packages/cross_math/assets/raw/cm4.db`) com uma tabela `cm_all` de 200 puzzles, 50 por dificuldade. O desenho de cada grade não está no banco: o código gera a grade a partir dos campos `board` e `puzzle`, provavelmente uma semente.
- Colunas de `cm_all`: `board`, `puzzle`, `plus`, `minus`, `multi`, `div` (contagem de cada operação), `equal` (número de contas), `num50`, `num120`, `stuck`, `diff` (1–4), `holes` (índices das lacunas em base64) e `size` (lado da grade: 9, 11 ou 13).
- Estatísticas por dificuldade (média, com mínimo e máximo):

| Dificuldade | Contas | Lacunas | Lacunas por conta | `stuck` | Grade |
| --- | --- | --- | --- | --- | --- |
| 1 Fácil | 14,1 (11–23) | 14,3 (11–23) | 1,01 | 0 | 9, 11, 13 |
| 2 Médio | 15,0 (11–23) | 16,2 (11–25) | 1,08 | 1–2 | 9, 11, 13 |
| 3 Difícil | 15,7 (11–24) | 18,9 (14–27) | 1,21 | 3–4 | 9, 11, 13 |
| 4 Expert | 17,4 (12–23) | 22,7 (16–27) | 1,32 | 5–8 | 11, 13 |

- **O que define a dificuldade é `stuck`, não o tamanho.** Os valores crescem estritamente com a dificuldade (0 / 1–2 / 3–4 / 5–8), e a partida Fácil observada se resolve inteira por cadeia. A interpretação provável é: quantas vezes a dedução em cadeia trava, ou seja, quantas vezes nenhuma conta tem uma só lacuna e é preciso cruzar contas ou usar o banco. Essa leitura é uma inferência a partir dos dados; o código Dart não foi decompilado.
- **Operações:** `+` e `−` predominam (cerca de 6 de cada por puzzle). `×` e `÷` aparecem em média 1,5 a 2 vezes.
- **Valores:** a maioria dos números é pequena. `num50` (provavelmente números até 50) fica em torno de 25 a 30 por puzzle, e `num120` (números maiores, até 120) em torno de 2.

### Estruturas adotadas

Toda estrutura é uma rede conectada de contas de cinco células (número, operador, número, igual, número). As contas se ligam apenas por células numéricas compartilhadas.

| Estrutura | Contas | Descrição | Uso sugerido |
| --- | --- | --- | --- |
| Cruz | 1H + 1V | Duas contas que se cruzam num operando ou num resultado (inspirada no tutorial) | Níveis difíceis com 3 lacunas (gera 1 travamento) |
| Gancho / escada | 3 | O resultado de uma conta é operando da próxima, alternando direções (inspirada no Fácil) | Capítulos 1–2 |
| Anel 2×2 | 2H + 2V | Quatro contas fechando um quadrado (layout aprovado) | Capítulos 1–4 |
| Grade 2H+3V / 3H+2V | 5 | Quadrado com uma linha ou coluna a mais, onde os resultados viram operandos (layouts aprovados) | Capítulos 3–5 |
| Anel + cauda | 5–6 | Anel 2×2 com uma conta extra saindo de um resultado (inspirada no Médio) | Capítulos 4–5 |

A grade pode passar de 5×5, mas fica com **no máximo 7 colunas e 7 linhas**. Com células de 40 px, 7 colunas cabem numa tela de 375 px sem rolagem horizontal. As grades 11×9 do Crossmath só caberiam com rolagem, por isso ficam de fora.

### Diferenças deliberadas em relação ao Crossmath

- **Sem símbolos compartilhados:** apenas células numéricas são compartilhadas. Operadores e `=` pertencem a uma única direção, porque o renderizador usa `isVertical` para desenhar símbolos verticais.
- **Banco com distratores:** o banco atual permite reutilizar peças e inclui distratores. Isso continua, porque o contrato da API e a tela já funcionam assim.
- **Quantidade de lacunas:** fica menor que a do Crossmath (3, 4 e 6), preservando os `inputIds` existentes.

## Decisão de arquitetura

Manter o formato atual do catálogo (`grid`, `inputIds`, `answerKey`, `bank`) e redesenhar os dados de cada nível usando as estruturas acima. Não introduzir outro formato de puzzle nem alterar rotas, banco de dados ou estado do jogo. Cada célula de entrada continua tendo um `inputId` único.

## Regras do puzzle

- Toda entrada de `inputIds` aparece em exatamente uma célula numérica da grade e participa de pelo menos uma equação.
- As equações do puzzle formam uma única rede conectada por células numéricas compartilhadas.
- Cada nível tem pelo menos uma lacuna num cruzamento (célula de uma conta horizontal e de uma vertical).
- O puzzle tem **uma única solução** usando os números do banco.
- A dificuldade segue o modelo `stuck` do Crossmath: conta-se quantas vezes a dedução em cadeia trava. Níveis `easy` têm 0 travamentos e níveis `medium` têm no máximo 1. Níveis `hard` com 4 ou mais lacunas têm pelo menos 1. Nos níveis `hard` com 3 lacunas, só a Cruz consegue travar (ver apêndice), então a dificuldade deles vem da estrutura maior, das operações misturadas e de valores maiores.
- Valores ficam majoritariamente até 50, com poucos números acima, e `×` e `÷` aparecem com menos frequência que `+` e `−` nos capítulos mistos.
- Cada equação completa continua no formato número, operador, número, igualdade, resultado e deve ser matematicamente correta. A subtração não fica negativa e a divisão é exata.
- Cada resposta continua presente no banco de números.
- IDs de níveis, capítulos, sessões e IDs das entradas são preservados. Cada nível mantém sua quantidade de lacunas (3 nos níveis 1–29, 4 nos níveis 30–38 e 6 no nível 39), com operações adequadas ao capítulo.
- Os títulos dos níveis não descrevem a estrutura. Não há complementos como "— 2H+3V (3 lacunas)": a tela mostra apenas "Nível 13" ou o título temático do catálogo.
- A instrução de cada nível explica que os números completam as contas horizontais e verticais que se cruzam.
- O desafio diário gerado e os níveis locais continuam determinísticos e conectados.

## Experiência e compatibilidade

Manter seleção, arrastar e soltar números, feedback por célula, tentativas e verificação. A interface deve ser conferida com as estruturas novas em telas estreitas (375 px). A semeadura existente já remove `answerKey` dos dados públicos e grava as respostas separadamente; não é necessária migração nem mudança no contrato da API.

## Apêndice A — Estruturas desenhadas

Legenda: `N` número (dado ou lacuna), `o` operador horizontal, `=` igual horizontal, `|` operador vertical, `‖` igual vertical, `.` célula vazia. As letras marcam as células numéricas compartilhadas. Os exemplos citados estão em `lib/game/previewSamples.mjs` (temporário) e foram conferidos com um verificador: solução única no banco, rede conectada e contagem de travamentos.

**Cruz (5×5, 2 contas).** Inspirada no tutorial. O cruzamento `X` é o segundo operando das duas contas. Com 3 lacunas sempre sobram duas numa mesma conta, então há exatamente 1 travamento, e o banco precisa garantir a solução única. Exemplo: Nível 6, `14 − X = Y`, `Z + X = 9`.

```
. . N . .
. . | . .
N o X = N
. . ‖ . .
. . N . .
```

**Gancho (5×5, 3 contas).** Inspirado na serpente do Fácil. A vertical liga o primeiro operando da linha de cima ao primeiro operando da linha de baixo. Resolve-se em cadeia (0 travamentos). Exemplo: Nível 1.

```
A o N = N
| . . . .
N . . . .
‖ . . . .
B o N = N
```

**Escada (5×7, 3 contas).** O resultado de cada conta vira operando da seguinte, descendo em degrau. 0 travamentos. Exemplo: Nível 2.

```
N o N = A . .
. . . . | . .
. . . . N . .
. . . . ‖ . .
. . N o B = N
```

**Anel 2×2 (5×5, 4 contas).** Layout aprovado. Com 3 lacunas, 0 travamentos. Com as 4 lacunas nos cantos, toda conta tem duas lacunas e há 1 travamento. Exemplo: Nível 3.

```
A o B = N
| . | . .
C o D = N
‖ . ‖ . .
N . N . .
```

**2H+3V e 3H+2V (5×5, 5 contas).** Layouts aprovados. Na 2H+3V, os resultados das linhas são operandos da terceira coluna. Na 3H+2V, os resultados das colunas formam a terceira linha. Exemplos: Níveis 13, 14 e 39 (6 lacunas, 2 travamentos).

```
2H+3V        3H+2V
A o B = C    A o B = N
| . | . |    | . | . .
D o E = F    C o D = N
‖ . ‖ . ‖    ‖ . ‖ . .
N . N . N    E o F = N
```

**Anel + cauda (5×7, 5 contas).** Anel 2×2 com uma conta horizontal que parte do resultado da coluna direita. Inspirada nas redes de anel do Médio. Exemplo: Nível 21.

```
A o B = N . .
| . | . . . .
C o D = N . .
‖ . ‖ . . . .
N . E o N = N
```

**Conclusões da verificação:**

- Com 3 lacunas, só a Cruz produz travamento. Em estruturas com 3 ou mais contas sempre existe uma conta com uma única lacuna a cada passo. Por isso a regra de dificuldade foi ajustada: travamento mínimo só para níveis difíceis com 4 ou mais lacunas.
- Em 375 px, as grades de 7 colunas (Escada, Anel + cauda) cabem sem rolagem horizontal. A largura da página fica em 375 px.

## Apêndice B — Estrutura por nível

`T` = travamentos alvo. As operações vêm do catálogo atual. Os capítulos mistos usam estruturas com contas suficientes para todas as operações do nível.

| Nível | Dif. | Lacunas | Operações | Estrutura | T |
| --- | --- | --- | --- | --- | --- |
| 1 | fácil | 3 | + | Gancho | 0 |
| 2 | fácil | 3 | + | Escada | 0 |
| 3 | médio | 3 | + | Anel 2×2 | 0 |
| 4 | fácil | 3 | − + | Gancho | 0 |
| 5 | médio | 3 | − + | Escada | 0 |
| 6 | difícil | 3 | − + | Cruz | 1 |
| 7 | fácil | 3 | + − | Anel 2×2 | 0 |
| 8 | médio | 3 | − + | Escada | 0 |
| 9 | difícil | 3 | + − | Cruz | 1 |
| 10 | fácil | 3 | − + | Gancho | 0 |
| 11 | médio | 3 | − + | Anel 2×2 | 0 |
| 12 | difícil | 3 | + − | Anel + cauda | 0 |
| 13 | fácil | 3 | × + | Anel 2×2 | 0 |
| 14 | médio | 3 | × + | 2H+3V | 0 |
| 15 | difícil | 3 | × + | Cruz | 1 |
| 16 | fácil | 3 | × − + | Escada | 0 |
| 17 | médio | 3 | × − + | 3H+2V | 0 |
| 18 | difícil | 3 | × − + | Anel + cauda | 0 |
| 19 | fácil | 3 | × + − | Anel 2×2 | 0 |
| 20 | médio | 3 | × + − | 2H+3V | 0 |
| 21 | difícil | 3 | × + − | Anel + cauda | 0 |
| 22 | fácil | 3 | ÷ + | Anel 2×2 | 0 |
| 23 | médio | 3 | ÷ + | 3H+2V | 0 |
| 24 | difícil | 3 | ÷ + | Cruz | 1 |
| 25 | fácil | 3 | ÷ × + | Escada | 0 |
| 26 | médio | 3 | ÷ × + | 2H+3V | 0 |
| 27 | difícil | 3 | ÷ × + | Anel + cauda | 0 |
| 28 | fácil | 3 | ÷ + − | Gancho | 0 |
| 29 | médio | 3 | × − ÷ + | 3H+2V | 0 |
| 30 | difícil | 4 | × ÷ + − | Anel 2×2 (4 cantos) | 1 |
| 31 | fácil | 4 | + − × ÷ | 2H+3V | 0 |
| 32 | médio | 4 | + − × ÷ | Anel 2×2 (4 cantos) | 1 |
| 33 | difícil | 4 | + − × ÷ | Anel + cauda | ≥1 |
| 34 | fácil | 4 | + − × ÷ | 3H+2V | 0 |
| 35 | médio | 4 | + − × ÷ | Anel + cauda | ≤1 |
| 36 | difícil | 4 | + − × ÷ | 2H+3V | ≥1 |
| 37 | fácil | 4 | + − × ÷ | 2H+3V | 0 |
| 38 | médio | 4 | + − × ÷ | 3H+2V | ≤1 |
| 39 | difícil | 6 | + − × ÷ | 2H+3V (6 lacunas) | ≥1 |
