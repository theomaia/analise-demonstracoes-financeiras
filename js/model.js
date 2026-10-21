// Campos padronizados usados no cálculo dos indicadores.
// req: necessário para a maioria dos indicadores. auto: calculado automaticamente se ficar vazio.

export const FIELD_GROUPS = [
  { id: 'ativo', title: 'Balanço Patrimonial — Ativo' },
  { id: 'passivo', title: 'Balanço Patrimonial — Passivo e PL' },
  { id: 'dre', title: 'Demonstração do Resultado (DRE)' },
  { id: 'extra', title: 'Informações complementares (notas explicativas / DFC)' },
  { id: 'ajustes', title: 'Ajustes opcionais (deixe vazio para cálculo automático)' },
];

export const FIELDS = [
  { key: 'ativoTotal', group: 'ativo', label: 'Ativo total', req: true },
  { key: 'ativoCirculante', group: 'ativo', label: 'Ativo circulante', req: true },
  { key: 'caixa', group: 'ativo', label: 'Caixa e equivalentes (caixa + bancos)', req: true },
  { key: 'aplicacoes', group: 'ativo', label: 'Aplicações financeiras de curto prazo' },
  { key: 'contasReceber', group: 'ativo', label: 'Contas a receber de clientes (duplicatas a receber)', req: true },
  { key: 'estoques', group: 'ativo', label: 'Estoques', req: true },
  { key: 'ativoNaoCirculante', group: 'ativo', label: 'Ativo não circulante', req: true },
  { key: 'realizavelLP', group: 'ativo', label: 'Realizável a longo prazo' },
  { key: 'imobilizado', group: 'ativo', label: 'Imobilizado (líquido)' },

  { key: 'passivoCirculante', group: 'passivo', label: 'Passivo circulante', req: true },
  { key: 'fornecedores', group: 'passivo', label: 'Fornecedores (duplicatas a pagar)', req: true },
  { key: 'emprestimosCP', group: 'passivo', label: 'Empréstimos, financiamentos e debêntures — curto prazo' },
  { key: 'duplicatasDescontadas', group: 'passivo', label: 'Duplicatas descontadas' },
  { key: 'passivoNaoCirculante', group: 'passivo', label: 'Passivo não circulante (exigível a longo prazo)', req: true },
  { key: 'emprestimosLP', group: 'passivo', label: 'Empréstimos, financiamentos e debêntures — longo prazo' },
  { key: 'patrimonioLiquido', group: 'passivo', label: 'Patrimônio líquido', req: true },

  { key: 'receitaBruta', group: 'dre', label: 'Receita operacional bruta' },
  { key: 'deducoes', group: 'dre', label: 'Deduções da receita' },
  { key: 'receitaLiquida', group: 'dre', label: 'Receita operacional líquida', req: true },
  { key: 'cpv', group: 'dre', label: 'Custo dos produtos/mercadorias/serviços vendidos (CPV/CMV)', req: true },
  { key: 'lucroBruto', group: 'dre', label: 'Lucro bruto', req: true },
  { key: 'lucroOperacional', group: 'dre', label: 'Lucro operacional (antes do resultado financeiro)', req: true },
  { key: 'despesasFinanceiras', group: 'dre', label: 'Despesas financeiras' },
  { key: 'lucroLiquido', group: 'dre', label: 'Lucro (prejuízo) líquido do exercício', req: true },

  { key: 'depreciacaoAmortizacao', group: 'extra', label: 'Depreciação e amortização do exercício (DFC)' },
  { key: 'depreciacaoAcumulada', group: 'extra', label: 'Depreciação acumulada do imobilizado (notas)' },

  { key: 'compras', group: 'ajustes', label: 'Compras do período', auto: true },
  { key: 'ativosOperacionais', group: 'ajustes', label: 'Ativos operacionais', auto: true },
  { key: 'passivosOperacionais', group: 'ajustes', label: 'Passivos operacionais', auto: true },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export const PARAM_DEFAULTS = { pctVendasPrazo: 100, pctComprasPrazo: 100, dias: 360 };

// Linhas da planilha-modelo (códigos compatíveis com o plano de contas da CVM).
export const TEMPLATE_ROWS = [
  ['1', 'Ativo total'],
  ['1.01', 'Ativo circulante'],
  ['1.01.01', 'Caixa e equivalentes de caixa'],
  ['1.01.02', 'Aplicações financeiras'],
  ['1.01.03', 'Contas a receber de clientes'],
  ['1.01.04', 'Estoques'],
  ['1.01.05', 'Impostos a recuperar'],
  ['1.01.06', 'Outros ativos circulantes'],
  ['1.02', 'Ativo não circulante'],
  ['1.02.01', 'Realizável a longo prazo'],
  ['1.02.02', 'Investimentos'],
  ['1.02.03', 'Imobilizado'],
  ['1.02.04', 'Intangível'],
  ['2', 'Passivo total (passivo + patrimônio líquido)'],
  ['2.01', 'Passivo circulante'],
  ['2.01.01', 'Obrigações sociais e trabalhistas'],
  ['2.01.02', 'Fornecedores'],
  ['2.01.03', 'Obrigações fiscais'],
  ['2.01.04', 'Empréstimos e financiamentos'],
  ['2.01.05', 'Duplicatas descontadas'],
  ['2.01.06', 'Outras obrigações de curto prazo'],
  ['2.02', 'Passivo não circulante'],
  ['2.02.01', 'Empréstimos e financiamentos'],
  ['2.02.02', 'Outras obrigações de longo prazo'],
  ['2.03', 'Patrimônio líquido'],
  ['2.03.01', 'Capital social'],
  ['2.03.02', 'Reservas'],
  ['2.03.03', 'Lucros ou prejuízos acumulados'],
  ['3.00.01', 'Receita operacional bruta'],
  ['3.00.02', 'Deduções da receita'],
  ['3.01', 'Receita operacional líquida'],
  ['3.02', 'Custo dos produtos vendidos'],
  ['3.03', 'Lucro bruto'],
  ['3.04', 'Despesas operacionais'],
  ['3.04.01', 'Despesas com vendas'],
  ['3.04.02', 'Despesas gerais e administrativas'],
  ['3.04.03', 'Outras receitas e despesas operacionais'],
  ['3.05', 'Lucro operacional'],
  ['3.06', 'Resultado financeiro'],
  ['3.06.01', 'Receitas financeiras'],
  ['3.06.02', 'Despesas financeiras'],
  ['3.07', 'Lucro antes do IR e da CSLL'],
  ['3.08', 'IR e CSLL'],
  ['3.11', 'Lucro líquido do exercício'],
  ['9.01', 'Depreciação e amortização do exercício (DFC)'],
  ['9.02', 'Depreciação acumulada do imobilizado (notas explicativas)'],
  ['9.03', 'Compras do período (opcional)'],
];
