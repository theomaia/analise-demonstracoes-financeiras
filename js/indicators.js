// Indicadores econômico-financeiros da Aula 11 (Análise das Demonstrações Financeiras).
import { FIELD_BY_KEY } from './model.js';
import { fmtNum, fmtInd } from './util.js';

export const GROUPS = [
  { id: 'endividamento', title: 'Estrutura de capital e endividamento', intro: 'Participação do capital de terceiros na empresa. Em visão isolada, de modo geral, quanto maior, pior.' },
  { id: 'liquidez', title: 'Capacidade de pagamento (liquidez)', intro: 'Capacidade de saldar as obrigações. Referência intrínseca: acima de 1 a empresa tem mais direitos que obrigações.' },
  { id: 'rentabilidade', title: 'Rentabilidade', intro: 'Taxas de retorno obtidas pela empresa sob diversos aspectos. De modo geral, quanto maior, melhor.' },
  { id: 'atividade', title: 'Atividade (prazos médios)', intro: 'Aspectos do capital de giro através do ciclo operacional e financeiro.' },
  { id: 'capitalGiro', title: 'Gestão do capital de giro', intro: 'Geração de caixa, cobertura de dívidas e prazos dos ativos e passivos operacionais.' },
];

export const OBJECTIVES = [
  { id: 'credito', label: 'Concessão de crédito', groups: ['liquidez', 'endividamento'] },
  { id: 'acoes', label: 'Comprar quotas/ações da empresa', groups: ['rentabilidade'] },
  { id: 'desempenho', label: 'Análise de desempenho', groups: ['atividade', 'rentabilidade'] },
  { id: 'giro', label: 'Análise de capital de giro', groups: ['endividamento', 'capitalGiro', 'atividade'] },
];

class Missing extends Error {
  constructor(keys) { super('missing'); this.keys = keys; }
}

const R$ = (v) => 'R$ ' + fmtNum(v, 2);
const P100 = (v) => fmtNum(v * 100, 1) + '%';
const D = (v) => fmtNum(v, 0);

// Cada indicador: sigla, nome, grupo, fórmula, sentido (maior/menor/depende), formato, cálculo, leitura e avaliação intrínseca.
export const INDICATORS = [
  // ── Estrutura de capital e endividamento ──
  { id: 'NE', group: 'endividamento', name: 'Nível de endividamento', formula: 'Capital de terceiros ÷ Patrimônio líquido', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.ct(), c.f('patrimonioLiquido')),
    read: (v) => `Para cada R$ 1,00 de capital próprio, a empresa captou ${R$(v)} de capital de terceiros.`,
    judge: (v) => v > 1 ? ['atencao', 'Mais capital de terceiros do que próprio (alavancagem alta). Bom ou ruim depende do custo das dívidas e do retorno obtido.'] : ['bom', 'Predomina o capital próprio.'] },
  { id: 'CE', group: 'endividamento', name: 'Composição do endividamento', formula: 'Passivo circulante ÷ Capital de terceiros', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.f('passivoCirculante'), c.ct()),
    read: (v) => `De cada R$ 1,00 de dívidas totais, ${R$(v)} vencem no curto prazo.`,
    judge: (v) => v >= 0.7 ? ['atencao', 'Dívidas concentradas no curto prazo: os recursos devem ser aplicados em ativos de rápida recuperação.'] : null },
  { id: 'EG', group: 'endividamento', name: 'Endividamento geral', formula: 'Capital de terceiros ÷ Ativo total', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.ct(), c.f('ativoTotal')),
    read: (v) => `De cada R$ 1,00 aplicado no ativo, ${R$(v)} vieram de terceiros e ${R$(1 - v)} de capital próprio.`,
    judge: (v) => v > 0.5 ? ['atencao', 'Maior dependência de capital de terceiros do que de capital próprio.'] : null },
  { id: 'IPL', group: 'endividamento', name: 'Imobilização do patrimônio líquido', formula: 'Ativo permanente ÷ Patrimônio líquido', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.ap(), c.f('patrimonioLiquido')),
    read: (v) => `Para cada R$ 1,00 de patrimônio líquido, ${R$(v)} estão aplicados no ativo permanente.`,
    judge: (v) => v > 1 ? ['ruim', 'Parte do permanente é financiada por terceiros: a empresa opera com capital de giro de terceiros.'] : ['bom', 'Sobra capital próprio para o giro: a empresa opera com capital de giro próprio.'] },
  { id: 'IRNC', group: 'endividamento', name: 'Imobilização dos recursos não correntes', formula: 'Ativo permanente ÷ (Patrimônio líquido + Exigível a LP)', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.ap(), c.f('patrimonioLiquido') + c.f('passivoNaoCirculante')),
    read: (v) => `Para cada R$ 1,00 de recursos de longo prazo, ${R$(v)} estão imobilizados no ativo permanente.`,
    judge: (v) => v > 1 ? ['ruim', 'Ativo de longo prazo financiado em parte com recursos de curto prazo. Não é uma boa situação.'] : ['bom', 'Os recursos de longo prazo cobrem o permanente e ainda financiam parte do giro.'] },
  { id: 'ECP', group: 'endividamento', name: 'Endividamento de curto prazo', formula: 'Passivo circulante ÷ Patrimônio líquido', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.f('passivoCirculante'), c.f('patrimonioLiquido')),
    read: (v) => `Para cada R$ 1,00 de capital próprio, a empresa tem ${R$(v)} de dívidas com vencimento no curto prazo.`,
    judge: (v) => v > 1 ? ['atencao', 'As dívidas de curto prazo superam o capital próprio.'] : null },
  { id: 'EOE', group: 'endividamento', name: 'Endividamento oneroso / endividamento', formula: 'Recursos onerosos ÷ (Passivo circulante + Exigível a LP)', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.oner(), c.ct()),
    read: (v) => `De cada R$ 1,00 de capital de terceiros, ${R$(v)} geram encargos financeiros (empréstimos, financiamentos, títulos descontados).`,
    judge: (v) => v >= 0.5 ? ['atencao', 'Grande parte das dívidas é onerosa, exigindo maior margem de lucro das operações.'] : null },
  { id: 'EOPL', group: 'endividamento', name: 'Endividamento oneroso / patrimônio líquido', formula: 'Recursos onerosos ÷ Patrimônio líquido', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.oner(), c.f('patrimonioLiquido')),
    read: (v) => `Para cada R$ 1,00 de capital próprio, a empresa captou ${R$(v)} de recursos onerosos.`,
    judge: (v) => v > 1 ? ['atencao', 'Os recursos onerosos superam o capital próprio.'] : null },
  { id: 'EOCP', group: 'endividamento', name: 'Endividamento oneroso de curto prazo / ativo circulante', formula: 'Recursos onerosos de curto prazo ÷ Ativo circulante', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.onerCP(), c.f('ativoCirculante')),
    read: (v) => `${R$(v)} de recursos onerosos de curto prazo para cada R$ 1,00 de ativo circulante.`,
    judge: (v) => v > 1 ? ['ruim', 'Todo o ativo circulante é financiado por recursos onerosos de curto prazo.'] : null },
  { id: 'NDD', group: 'endividamento', name: 'Nível de desconto de duplicatas', formula: 'Duplicatas descontadas ÷ Duplicatas a receber', better: 'menor', fmt: 'x',
    calc: (c) => c.div(c.z('duplicatasDescontadas', 'Nenhuma conta de duplicatas descontadas identificada (considerado 0)'), c.f('contasReceber')),
    read: (v) => `De cada R$ 1,00 de duplicatas a receber, ${R$(v)} foram descontados em bancos.`,
    judge: (v) => v >= 0.5 ? ['atencao', 'Alta dependência de capital oneroso para financiar as vendas a prazo.'] : null },
  { id: 'OAI', group: 'endividamento', name: 'Obsolescência do ativo imobilizado', formula: 'Depreciação acumulada ÷ Imobilizado bruto (custo)', better: 'menor', fmt: 'pct',
    calc: (c) => { const d = Math.abs(c.f('depreciacaoAcumulada')); return c.div(d, c.f('imobilizado') + d); },
    read: (v) => `${P100(v)} do imobilizado já foi depreciado.`,
    judge: (v) => v >= 0.6 ? ['atencao', 'Imobilizado próximo do fim da vida útil: indica necessidade de atualização tecnológica.'] : null },

  // ── Liquidez ──
  { id: 'LG', group: 'liquidez', name: 'Liquidez geral', formula: '(Ativo circulante + Realizável a LP) ÷ (Passivo circulante + Exigível a LP)', better: 'maior', fmt: 'x',
    calc: (c) => c.div(c.f('ativoCirculante') + c.rlp(), c.ct()),
    read: (v) => `A empresa possui ${R$(v)} de ativos realizáveis no curto e longo prazos para cada R$ 1,00 de dívidas totais.`,
    judge: (v) => v >= 1 ? ['bom', 'Opera com capital de giro próprio.'] : ['ruim', 'Os direitos não cobrem as dívidas: o capital de giro é de terceiros.'] },
  { id: 'LC', group: 'liquidez', name: 'Liquidez corrente', formula: 'Ativo circulante ÷ Passivo circulante', better: 'maior', fmt: 'x',
    calc: (c) => c.div(c.f('ativoCirculante'), c.f('passivoCirculante')),
    read: (v) => `${R$(v)} de ativo circulante para cada R$ 1,00 de passivo circulante.`,
    judge: (v) => v >= 1 ? ['bom', 'Capital circulante líquido próprio (positivo).'] : ['ruim', 'Capital circulante líquido negativo: as dívidas de curto prazo superam os direitos de curto prazo.'] },
  { id: 'LS', group: 'liquidez', name: 'Liquidez seca', formula: '(Ativo circulante − Estoques) ÷ Passivo circulante', better: 'maior', fmt: 'x',
    calc: (c) => c.div(c.f('ativoCirculante') - c.f('estoques'), c.f('passivoCirculante')),
    read: (v) => `Mesmo sem vender os estoques, a empresa dispõe de ${R$(v)} para cada R$ 1,00 de obrigações de curto prazo.`,
    judge: (v) => v >= 1 ? ['bom', 'Paga as dívidas de curto prazo sem depender da venda dos estoques.'] : ['atencao', 'Depende da venda dos estoques para quitar as dívidas de curto prazo.'] },
  { id: 'LI', group: 'liquidez', name: 'Liquidez imediata', formula: 'Disponível (caixa + bancos + aplicações) ÷ Passivo circulante', better: 'maior', fmt: 'x',
    calc: (c) => c.div(c.disp(), c.f('passivoCirculante')),
    read: (v) => `${R$(v)} de disponibilidades para cada R$ 1,00 de passivo circulante.`,
    judge: (v) => v >= 1 ? ['bom', 'O caixa cobre todo o passivo circulante.'] : ['atencao', 'O caixa não cobriria todo o passivo circulante se vencesse de imediato.'] },

  // ── Rentabilidade ──
  { id: 'RPL', group: 'rentabilidade', name: 'Rentabilidade do patrimônio líquido (ROE)', formula: 'Lucro líquido ÷ Patrimônio líquido', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('lucroLiquido'), c.f('patrimonioLiquido')),
    read: (v) => `Cada R$ 1,00 de patrimônio líquido teve ${R$(v)} de retorno (${P100(v)}).`,
    judge: (v) => v > 0 ? ['bom', 'Retorno positivo aos sócios; compare com a expectativa do investidor e a média do setor.'] : ['ruim', 'Prejuízo: retorno negativo sobre o capital dos sócios.'] },
  { id: 'RAT', group: 'rentabilidade', name: 'Rentabilidade do ativo total (ROA)', formula: 'Lucro líquido ÷ Ativo total médio', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('lucroLiquido'), c.avg('ativoTotal')),
    read: (v) => `Cada R$ 1,00 de ativo total teve ${R$(v)} de retorno (${P100(v)}).`,
    judge: (v) => v > 0 ? ['bom', 'Os recursos administrados geraram lucro.'] : ['ruim', 'Os ativos não geraram lucro no período.'] },
  { id: 'GAT', group: 'rentabilidade', name: 'Giro do ativo total', formula: 'Receita líquida ÷ Ativo total médio', better: 'maior', fmt: 'vezes',
    calc: (c) => c.div(c.f('receitaLiquida'), c.avg('ativoTotal')),
    read: (v) => `O ativo girou ${fmtNum(v, 2)} vez(es) no período: cada R$ 1,00 de ativo gerou ${R$(v)} de receita líquida.`,
    judge: () => null },
  { id: 'MB', group: 'rentabilidade', name: 'Margem bruta', formula: 'Lucro bruto ÷ Receita líquida', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('lucroBruto'), c.f('receitaLiquida')),
    read: (v) => `A cada R$ 100 de receita líquida, sobram R$ ${fmtNum(v * 100, 2)} de lucro bruto.`,
    judge: (v) => v > 0 ? null : ['ruim', 'O custo das vendas supera a receita líquida.'] },
  { id: 'MO', group: 'rentabilidade', name: 'Margem operacional', formula: 'Lucro operacional ÷ Receita líquida', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('lucroOperacional'), c.f('receitaLiquida')),
    read: (v) => `Após as despesas operacionais, sobram R$ ${fmtNum(v * 100, 2)} a cada R$ 100 de receita líquida.`,
    judge: (v) => v > 0 ? ['bom', 'A operação é lucrativa.'] : ['ruim', 'Prejuízo operacional.'] },
  { id: 'ML', group: 'rentabilidade', name: 'Margem líquida', formula: 'Lucro líquido ÷ Receita líquida', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('lucroLiquido'), c.f('receitaLiquida')),
    read: (v) => `O que “sobra” no final: R$ ${fmtNum(v * 100, 2)} de lucro líquido a cada R$ 100 de receita líquida.`,
    judge: (v) => v > 0 ? ['bom', 'Lucro líquido positivo.'] : ['ruim', 'Prejuízo líquido no período.'] },
  { id: 'ENV', group: 'rentabilidade', name: 'Evolução nominal das vendas', formula: '(Receita líquida atual − Receita líquida anterior) ÷ Receita líquida anterior', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('receitaLiquida') - c.prev('receitaLiquida'), Math.abs(c.prev('receitaLiquida'))),
    read: (v) => `A receita líquida ${v >= 0 ? 'cresceu' : 'caiu'} ${P100(Math.abs(v))} em relação ao período anterior (variação nominal, sem descontar a inflação).`,
    judge: (v) => v < 0 ? ['atencao', 'Queda nominal das vendas.'] : null },

  // ── Atividade (prazos médios) ──
  { id: 'PMRV', group: 'atividade', name: 'Prazo médio de recebimento de vendas', formula: 'Média de duplicatas a receber × dias ÷ Receita bruta de vendas a prazo', better: 'menor', fmt: 'dias',
    calc: (c) => c.pmrv(),
    read: (v) => `A empresa concede, em média, ${D(v)} dias de prazo aos clientes. Quanto maior o prazo, maior a necessidade de capital de giro.`,
    judge: () => null },
  { id: 'PMRE', group: 'atividade', name: 'Prazo médio de renovação dos estoques', formula: 'Estoque médio × dias ÷ CPV', better: 'menor', fmt: 'dias',
    calc: (c) => c.pmre(),
    read: (v) => `Os produtos ficam, em média, ${D(v)} dias parados no estoque.`,
    judge: () => null },
  { id: 'PMPC', group: 'atividade', name: 'Prazo médio de pagamento das compras', formula: 'Média de fornecedores × dias ÷ Compras a prazo', better: 'maior', fmt: 'dias',
    calc: (c) => c.pmpc(),
    read: (v) => `A empresa obtém, em média, ${D(v)} dias de prazo dos fornecedores.`,
    judge: () => null },
  { id: 'COC', group: 'atividade', name: 'Ciclo operacional comercial', formula: 'PMRE + PMRV', better: 'menor', fmt: 'dias',
    calc: (c) => c.pmre() + c.pmrv(),
    read: (v) => `Da compra da mercadoria ao recebimento da venda decorrem, em média, ${D(v)} dias.`,
    judge: () => null },
  { id: 'CFC', group: 'atividade', name: 'Ciclo financeiro comercial', formula: 'PMRV + PMRE − PMPC', better: 'menor', fmt: 'dias',
    calc: (c) => c.pmrv() + c.pmre() - c.pmpc(),
    read: (v) => v >= 0 ? `A empresa financia suas operações (e seus clientes) por ${D(v)} dias com recursos próprios ou de terceiros.` : `Os fornecedores financiam as operações da empresa por ${D(-v)} dias.`,
    judge: (v) => v > 0 ? ['atencao', `Necessidade de capital de giro para cobrir ${D(v)} dias.`] : ['bom', 'Os fornecedores financiam todo o ciclo operacional.'] },
  { id: 'GE', group: 'atividade', name: 'Giro dos estoques', formula: 'Dias ÷ PMRE', better: 'maior', fmt: 'vezes',
    calc: (c) => c.div(c.days, c.pmre()),
    read: (v) => `Os estoques foram comprados e vendidos ${fmtNum(v, 1)} vez(es) no período.`,
    judge: () => null },
  { id: 'GDR', group: 'atividade', name: 'Giro das duplicatas a receber', formula: 'Dias ÷ PMRV', better: 'maior', fmt: 'vezes',
    calc: (c) => c.div(c.days, c.pmrv()),
    read: (v) => `A carteira de duplicatas a receber girou ${fmtNum(v, 1)} vez(es) no período.`,
    judge: () => null },

  // ── Gestão do capital de giro ──
  { id: 'GIR', group: 'capitalGiro', name: 'Geração interna de recursos / faturamento líquido', formula: '(Lucro líquido + Depreciação e amortização) ÷ Receita líquida', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.f('lucroLiquido') + c.da(), c.f('receitaLiquida')),
    read: (v) => `A cada R$ 100 de receita líquida, a atividade gerou R$ ${fmtNum(v * 100, 2)} de recursos (lucro ajustado pela depreciação).`,
    judge: (v) => v > 0 ? ['bom', 'A atividade gera recursos internamente.'] : ['ruim', 'A atividade consome recursos.'] },
  { id: 'ME', group: 'capitalGiro', name: 'Margem EBITDA', formula: 'EBITDA ÷ Receita líquida', better: 'maior', fmt: 'pct',
    calc: (c) => c.div(c.ebitda(), c.f('receitaLiquida')),
    read: (v) => `O EBITDA equivale a ${P100(v)} da receita líquida.`,
    judge: (v) => v > 0 ? null : ['ruim', 'EBITDA negativo: a atividade não gera resultado para pagar o custo das dívidas.'] },
  { id: 'CD', group: 'capitalGiro', name: 'Cobertura de dívidas (em meses)', formula: 'Capital de terceiros ÷ (EBITDA ÷ 12)', better: 'menor', fmt: 'meses',
    calc: (c) => { const e = c.ebitda(); if (e <= 0) { c.note('EBITDA ≤ 0: a geração operacional não cobre as dívidas'); return null; } return c.ct() / (e / 12); },
    read: (v) => `Seriam necessários ${fmtNum(v, 1)} meses de EBITDA para honrar todas as dívidas.`,
    judge: () => null },
  { id: 'DFE', group: 'capitalGiro', name: 'Despesas financeiras / EBITDA', formula: 'Despesas financeiras ÷ EBITDA', better: 'menor', fmt: 'pct',
    calc: (c) => c.div(Math.abs(c.f('despesasFinanceiras')), c.ebitda()),
    read: (v) => `As despesas financeiras absorvem ${P100(v)} do EBITDA.`,
    judge: (v) => v >= 1 || v < 0 ? ['ruim', 'O EBITDA não cobre as despesas financeiras.'] : v >= 0.5 ? ['atencao', 'Metade ou mais do EBITDA vai para despesas financeiras.'] : null },
  { id: 'DBF', group: 'capitalGiro', name: 'Dívida bancária em dias de faturamento', formula: 'Recursos onerosos do passivo circulante × dias ÷ Receita líquida', better: 'menor', fmt: 'dias',
    calc: (c) => c.div(c.onerCP() * c.days, c.f('receitaLiquida')),
    read: (v) => `São necessários ${D(v)} dias de faturamento para amortizar os recursos onerosos de curto prazo.`,
    judge: () => null },
  { id: 'PMRAO', group: 'capitalGiro', name: 'Prazo médio de recebimento de ativos operacionais', formula: 'Ativos operacionais médios × dias ÷ Receita líquida', better: 'menor', fmt: 'dias',
    calc: (c) => c.div(c.avgOf('ativOp') * c.days, c.f('receitaLiquida')),
    read: (v) => `Os ativos operacionais levam, em média, ${D(v)} dias para se transformar em caixa.`,
    judge: () => null },
  { id: 'PMPPO', group: 'capitalGiro', name: 'Prazo médio de pagamento de passivos operacionais', formula: 'Passivos operacionais médios × dias ÷ Receita líquida', better: 'maior', fmt: 'dias',
    calc: (c) => c.div(c.avgOf('passOp') * c.days, c.f('receitaLiquida')),
    read: (v) => `Os passivos operacionais vencem, em média, em ${D(v)} dias.`,
    judge: () => null },
  { id: 'CFO', group: 'capitalGiro', name: 'Ciclo financeiro operacional', formula: 'PMRAO − PMPPO', better: 'menor', fmt: 'dias',
    calc: (c) => c.div(c.avgOf('ativOp') * c.days, c.f('receitaLiquida')) - c.div(c.avgOf('passOp') * c.days, c.f('receitaLiquida')),
    read: (v) => v >= 0 ? `A empresa precisa financiar ${D(v)} dias de capital de giro.` : `Folga financeira de ${D(-v)} dias: os passivos operacionais financiam os ativos operacionais.`,
    judge: (v) => v > 0 ? ['atencao', 'PMRAO maior que PMPPO: há necessidade de financiamento do capital de giro.'] : ['bom', 'Folga financeira: não precisa de recursos onerosos para financiar a operação.'] },
];

export const INDICATOR_BY_ID = Object.fromEntries(INDICATORS.map((d) => [d.id, d]));

// Monta o contexto de cálculo para o período i.
function makeContext(fields, P, params, i, notes) {
  const raw = (k, j = i) => {
    const v = (fields[k] || [])[j];
    return v === null || v === undefined || !Number.isFinite(v) ? null : v;
  };
  const c = {
    days: params.dias,
    note: (s) => notes.add(s),
    f: (k) => { const v = raw(k); if (v === null) throw new Missing([k]); return v; },
    z: (k, msg) => { const v = raw(k); if (v === null) { notes.add(msg || `${FIELD_BY_KEY[k].label} não identificado (considerado 0)`); return 0; } return v; },
    prev: (k) => { if (i === 0) throw new Missing(['__prev']); const v = raw(k, i - 1); if (v === null) throw new Missing([k]); return v; },
    div: (a, b) => (b === 0 ? NaN : a / b),
  };
  // Média entre saldo inicial (período anterior) e final.
  const avgFn = (fn) => {
    const cur = fn(c);
    if (i > 0) {
      try {
        const pc = makeContext(fields, P, params, i - 1, new Set());
        return (cur + fn(pc)) / 2;
      } catch (e) { if (!(e instanceof Missing)) throw e; }
    }
    notes.add('Média calculada só com o saldo final (sem saldo do período anterior)');
    return cur;
  };
  Object.assign(c, {
    avg: (k) => avgFn((x) => x.f(k)),
    avgOf: (name) => avgFn((x) => x[name]()),
    ct: () => c.f('passivoCirculante') + c.f('passivoNaoCirculante'),
    rlp: () => c.z('realizavelLP', 'Realizável a longo prazo não identificado (considerado 0)'),
    ap: () => c.f('ativoNaoCirculante') - c.rlp(),
    disp: () => {
      const a = raw('caixa'), b = raw('aplicacoes');
      if (a === null && b === null) throw new Missing(['caixa']);
      return (a ?? 0) + (b ?? 0);
    },
    onerCP: () => Math.abs(c.z('emprestimosCP', 'Empréstimos de curto prazo não identificados (considerado 0)')) + Math.abs(c.z('duplicatasDescontadas', 'Duplicatas descontadas não identificadas (considerado 0)')),
    oner: () => c.onerCP() + Math.abs(c.z('emprestimosLP', 'Empréstimos de longo prazo não identificados (considerado 0)')),
    cpv: () => Math.abs(c.f('cpv')),
    da: () => {
      const v = raw('depreciacaoAmortizacao');
      if (v === null) { notes.add('Depreciação/amortização não informada (considerada 0)'); return 0; }
      return Math.abs(v);
    },
    ebitda: () => c.f('lucroOperacional') + c.da(),
    ativOp: () => { const o = raw('ativosOperacionais'); return o !== null ? o : c.f('ativoCirculante') - c.disp(); },
    passOp: () => { const o = raw('passivosOperacionais'); return o !== null ? o : c.f('passivoCirculante') - c.onerCP(); },
    compras: () => {
      const o = raw('compras');
      if (o !== null) return Math.abs(o);
      const ef = raw('estoques'), ei = i > 0 ? raw('estoques', i - 1) : null;
      if (ef !== null && ei !== null) { notes.add('Compras estimadas = CPV + estoque final − estoque inicial'); return c.cpv() + ef - ei; }
      notes.add('Compras aproximadas pelo CPV (sem estoque inicial)');
      return c.cpv();
    },
    vendasPrazo: () => {
      let rb = raw('receitaBruta');
      if (rb === null) { rb = c.f('receitaLiquida'); notes.add('Receita bruta não informada: usada a receita líquida'); }
      if (params.pctVendasPrazo !== 100) notes.add(`Vendas a prazo = ${params.pctVendasPrazo}% da receita`);
      return Math.abs(rb) * params.pctVendasPrazo / 100;
    },
    pmrv: () => c.div(c.avg('contasReceber') * c.days, c.vendasPrazo()),
    pmre: () => c.div(c.avg('estoques') * c.days, c.cpv()),
    pmpc: () => {
      if (params.pctComprasPrazo !== 100) notes.add(`Compras a prazo = ${params.pctComprasPrazo}% das compras`);
      return c.div(c.avg('fornecedores') * c.days, c.compras() * params.pctComprasPrazo / 100);
    },
  });
  return c;
}

// Calcula todos os indicadores para os períodos (já filtrados e em ordem cronológica).
export function computeIndicators(fields, periods, params) {
  const P = periods.length;
  return INDICATORS.map((def) => {
    const values = [], notes = [], missing = [];
    for (let i = 0; i < P; i++) {
      const n = new Set();
      let v = null, miss = null;
      try {
        v = def.calc(makeContext(fields, P, params, i, n));
        if (v !== null && !Number.isFinite(v)) { v = null; n.add('Resultado indefinido (divisão por zero)'); }
      } catch (e) {
        if (!(e instanceof Missing)) throw e;
        miss = e.keys.includes('__prev') ? ['período anterior'] : e.keys.map((k) => FIELD_BY_KEY[k]?.label || k);
        v = null;
      }
      values.push(v);
      notes.push([...n]);
      missing.push(miss);
    }
    const last = lastIndex(values);
    const prevIdx = last > 0 ? lastIndex(values.slice(0, last)) : -1;
    const latest = last >= 0 ? values[last] : null;
    const judged = latest !== null ? def.judge(latest) : null;
    let trend = null;
    if (latest !== null && prevIdx >= 0) {
      const d = latest - values[prevIdx];
      const rel = Math.abs(values[prevIdx]) > 1e-9 ? Math.abs(d / values[prevIdx]) : Math.abs(d);
      if (rel < 0.005) trend = 'estavel';
      else if (def.better === 'maior') trend = d > 0 ? 'melhora' : 'piora';
      else if (def.better === 'menor') trend = d < 0 ? 'melhora' : 'piora';
      else trend = d > 0 ? 'subiu' : 'caiu';
    }
    return {
      def, values, notes, missing, last, latest, trend,
      status: judged ? judged[0] : null,
      statusText: judged ? judged[1] : null,
      reading: latest !== null ? def.read(latest) : null,
      latestText: fmtInd(latest, def.fmt),
    };
  });
}

function lastIndex(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return i;
  return -1;
}

// Modelo DuPont: ROE = Margem líquida × Giro do ativo × Multiplicador de alavancagem.
export function computeDupont(fields, P) {
  const out = [];
  for (let i = 0; i < P; i++) {
    const g = (k) => { const v = fields[k]?.[i]; return v === null || v === undefined ? null : v; };
    const ll = g('lucroLiquido'), rl = g('receitaLiquida'), at = g('ativoTotal'), pl = g('patrimonioLiquido');
    const ml = ll !== null && rl ? ll / rl : null;
    const giro = rl !== null && at ? rl / at : null;
    const alav = at !== null && pl ? at / pl : null;
    const roa = ml !== null && giro !== null ? ml * giro : null;
    const roe = roa !== null && alav !== null ? roa * alav : null;
    out.push({ ml, giro, roa, alav, roe });
  }
  return out;
}

// Valores derivados exibidos na aba "Dados".
export function computeDerived(fields, periods, params) {
  const P = periods.length;
  const items = [
    ['Disponível (caixa + aplicações)', (c) => c.disp()],
    ['Capital de terceiros (PC + PNC)', (c) => c.ct()],
    ['Ativo permanente (ANC − RLP)', (c) => c.ap()],
    ['Recursos onerosos — curto prazo', (c) => c.onerCP()],
    ['Recursos onerosos — total', (c) => c.oner()],
    ['Capital circulante líquido (AC − PC)', (c) => c.f('ativoCirculante') - c.f('passivoCirculante')],
    ['EBITDA (lucro operacional + D&A)', (c) => c.ebitda()],
    ['Compras do período', (c) => c.compras()],
    ['Ativos operacionais', (c) => c.ativOp()],
    ['Passivos operacionais', (c) => c.passOp()],
  ];
  return items.map(([label, fn]) => ({
    label,
    values: Array.from({ length: P }, (_, i) => {
      try { return fn(makeContext(fields, P, params, i, new Set())); } catch (e) { if (e instanceof Missing) return null; throw e; }
    }),
  }));
}
