# Análise de Demonstrações Financeiras

Site estático que gera a análise das demonstrações financeiras de uma empresa a partir de um arquivo enviado pelo usuário: análise vertical, horizontal e os principais indicadores econômico-financeiros.

Tudo roda no navegador: nenhum arquivo é enviado a servidores.

## O que o site calcula

- **Análise vertical**: participação de cada conta no ativo total (balanço) e na receita bruta ou líquida (DRE).
- **Análise horizontal**: variação de cada conta em relação ao período anterior ou ao primeiro período (base fixa).
- **Estrutura de capital e endividamento**: NE, CE, EG, IPL, IRNC, ECP, EOE, EOPL, EOCP, NDD, OAI.
- **Capacidade de pagamento (liquidez)**: LG, LC, LS, LI.
- **Rentabilidade**: RPL (ROE), RAT (ROA), GAT, MB, MO, ML, ENV e **análise DuPont**.
- **Atividade (prazos médios)**: PMRV, PMRE, PMPC, ciclo operacional (COC), ciclo financeiro (CFC), giro dos estoques e das duplicatas.
- **Gestão do capital de giro**: GIR, margem EBITDA, cobertura de dívidas, despesas financeiras/EBITDA, DBF, PMRAO, PMPPO, CFO.

Cada indicador traz a fórmula, uma leitura em linguagem simples (“para cada R$ 1,00 de…”), a avaliação intrínseca (bom, atenção ou ruim), a tendência entre períodos e um campo opcional para comparar com a média do setor. O resumo destaca os indicadores mais relevantes para cada objetivo de análise (concessão de crédito, compra de ações, desempenho, capital de giro).

## Formatos aceitos

| Formato | Como funciona |
|---|---|
| **Excel / CSV** (.xlsx, .xls, .ods, .csv) | Uma coluna com o nome das contas e uma coluna de valores por período. Os nomes são reconhecidos automaticamente. A [planilha-modelo](modelo/modelo-demonstracoes.csv) (também disponível em .xlsx pelo site) dá o melhor resultado. |
| **Dados abertos da CVM** | CSVs da [DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp) (BPA, BPP, DRE, DFC_MI). Envie vários de uma vez; se houver várias companhias, o site pede para escolher uma. |
| **PDF** | PDFs com texto selecionável são lidos por aproximação (colunas por ano). PDFs digitalizados não são suportados. |
| **Manual** | Preenchimento direto dos valores na tela de revisão. |

Antes de gerar a análise, a tela **Revisar dados** mostra cada conta identificada, a linha do arquivo de onde ela veio e permite corrigir qualquer valor.

### Convenções de cálculo

- Médias (ativo total, duplicatas a receber, estoques, fornecedores, ativos e passivos operacionais) usam (saldo inicial + saldo final) ÷ 2. No primeiro período, sem saldo anterior, usa-se o saldo final (o site sinaliza).
- Ativo permanente = Ativo não circulante − Realizável a longo prazo. Exigível a longo prazo = Passivo não circulante.
- Recursos onerosos = empréstimos, financiamentos e debêntures (curto e longo prazo) + duplicatas descontadas.
- Compras = CPV + estoque final − estoque inicial (se não informadas).
- EBITDA = lucro operacional + depreciação e amortização (informe a D&A da DFC para um valor exato).
- Ativos operacionais = AC − disponível; passivos operacionais = PC − recursos onerosos de curto prazo (ambos editáveis).
- Prazos médios em ano comercial de 360 dias (pode mudar para 365).

## Rodar localmente

Não há etapa de build. Sirva a pasta com qualquer servidor estático (módulos ES não funcionam abrindo o arquivo direto):

```bash
python -m http.server 8000
```

Acesse http://localhost:8000. Para conferir os cálculos com os dados de exemplo:

```bash
node tests/verify.mjs
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra **Settings → Pages** e em **Source** escolha **GitHub Actions**.
3. A cada push na `main`, o workflow `.github/workflows/pages.yml` roda os testes e publica o site em `https://<usuario>.github.io/<repositorio>/`.

Alternativa sem Actions: em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.

## Estrutura

```
index.html            página única (3 etapas: carregar → revisar → resultados)
css/style.css         estilos (tema claro/escuro, impressão)
js/app.js             interface e fluxo
js/parsers.js         leitura de Excel/CSV, CVM e PDF
js/mapping.js         identificação das contas (código CVM ou nome)
js/indicators.js      fórmulas, leituras e avaliações dos indicadores
js/analysis.js        análises vertical e horizontal
js/model.js           campos padronizados e planilha-modelo
js/sample.js          dados de exemplo (empresa fictícia, 2023–2025)
tests/verify.mjs      testes dos cálculos
```

Bibliotecas carregadas sob demanda via CDN: [SheetJS](https://sheetjs.com/) (planilhas) e [PDF.js](https://mozilla.github.io/pdf.js/) (PDF).

## Aviso

Ferramenta educacional. Os resultados dependem da qualidade dos dados informados e não constituem recomendação de investimento ou de crédito.
