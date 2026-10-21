// Análise vertical (participação %) e horizontal (evolução %) das demonstrações.
import { normalize } from './util.js';

const MAIN_ROW = /^total|^(ativo|passivo) (nao )?circulante$|^circulante$|^realizavel a longo prazo$|^(ativo )?permanente$|^exigivel a longo prazo$|^patrimonio liquido$|^receita operacional (bruta|liquida)$|^(lucro|resultado) (bruto|operacional|liquido)|^lucro antes/;

const SECTION_TITLES = { ativo: 'Ativo', passivo: 'Passivo e patrimônio líquido', dre: 'Demonstração do resultado' };

// Linhas do arquivo original, com valores alinhados aos períodos escolhidos.
export function rowsFromDataset(dataset, periodKeys) {
  return dataset.rows
    .filter((r) => ['ativo', 'passivo', 'dre'].includes(r.section))
    .map((r) => ({
      section: r.section,
      code: r.code,
      label: r.label || 'Subtotal',
      values: periodKeys.map((k) => (r.values[k] === undefined ? null : r.values[k])),
      depth: r.code ? r.code.split('.').length : null,
      strong: !r.code && (r.subtotal || r.block === 'TOT' || MAIN_ROW.test(r.norm || normalize(r.label))),
      heading: periodKeys.every((k) => r.values[k] === null || r.values[k] === undefined),
    }))
    .filter((r) => !r.heading || r.label);
}

// Estrutura padronizada montada a partir dos dados revisados.
export function rowsFromFields(fields, P) {
  const g = (k) => fields[k] || Array(P).fill(null);
  const neg = (k) => g(k).map((v) => (v === null ? null : -Math.abs(v)));
  const sub = (a, b) => a.map((v, i) => (v === null || b[i] === null ? null : v - b[i]));
  const plus = (a, b) => a.map((v, i) => (v === null && b[i] === null ? null : (v ?? 0) + (b[i] ?? 0)));
  const ap = sub(g('ativoNaoCirculante'), g('realizavelLP').map((v) => v ?? 0));
  const ct = plus(g('passivoCirculante'), g('passivoNaoCirculante'));
  const L = (section, label, values, depth = 2) => ({ section, label, values, depth, strong: depth === 1 });
  return [
    L('ativo', 'Ativo circulante', g('ativoCirculante'), 1),
    L('ativo', 'Caixa e equivalentes', g('caixa')),
    L('ativo', 'Aplicações financeiras', g('aplicacoes')),
    L('ativo', 'Contas a receber de clientes', g('contasReceber')),
    L('ativo', 'Estoques', g('estoques')),
    L('ativo', 'Ativo não circulante', g('ativoNaoCirculante'), 1),
    L('ativo', 'Realizável a longo prazo', g('realizavelLP')),
    L('ativo', 'Ativo permanente', ap),
    L('ativo', 'Imobilizado', g('imobilizado'), 3),
    L('ativo', 'Ativo total', g('ativoTotal'), 1),
    L('passivo', 'Passivo circulante', g('passivoCirculante'), 1),
    L('passivo', 'Fornecedores', g('fornecedores')),
    L('passivo', 'Empréstimos e financiamentos (CP)', g('emprestimosCP')),
    L('passivo', 'Duplicatas descontadas', g('duplicatasDescontadas')),
    L('passivo', 'Passivo não circulante', g('passivoNaoCirculante'), 1),
    L('passivo', 'Empréstimos e financiamentos (LP)', g('emprestimosLP')),
    L('passivo', 'Capital de terceiros (PC + PNC)', ct, 1),
    L('passivo', 'Patrimônio líquido', g('patrimonioLiquido'), 1),
    L('passivo', 'Passivo total + PL', plus(ct, g('patrimonioLiquido')), 1),
    L('dre', 'Receita operacional bruta', g('receitaBruta'), 1),
    L('dre', 'Deduções da receita', neg('deducoes')),
    L('dre', 'Receita operacional líquida', g('receitaLiquida'), 1),
    L('dre', 'Custo dos produtos vendidos', neg('cpv')),
    L('dre', 'Lucro bruto', g('lucroBruto'), 1),
    L('dre', 'Lucro operacional', g('lucroOperacional'), 1),
    L('dre', 'Despesas financeiras', neg('despesasFinanceiras')),
    L('dre', 'Lucro líquido do exercício', g('lucroLiquido'), 1),
  ].filter((r) => r.values.some((v) => v !== null));
}

// Base 100%: ativo total para o balanço; receita bruta (ou líquida) para a DRE.
export function verticalBases(fields, P) {
  const at = fields.ativoTotal || Array(P).fill(null);
  const rb = fields.receitaBruta || Array(P).fill(null);
  const rl = fields.receitaLiquida || Array(P).fill(null);
  const useBruta = rb.some((v) => v);
  return {
    ativo: at,
    passivo: at,
    dre: useBruta ? rb : rl,
    dreLabel: useBruta ? 'receita operacional bruta' : 'receita operacional líquida',
  };
}

export function vertical(rows, bases) {
  return rows.map((r) => ({
    ...r,
    pct: r.values.map((v, i) => {
      const b = bases[r.section]?.[i];
      return v === null || !b ? null : (v / b) * 100;
    }),
  }));
}

// mode: 'anterior' (variação período a período) ou 'base' (índice em relação ao 1º período).
export function horizontal(rows, mode) {
  return rows.map((r) => ({
    ...r,
    pct: r.values.map((v, i) => {
      if (i === 0) return null;
      const b = mode === 'base' ? r.values[0] : r.values[i - 1];
      if (b === null || b === 0) return null;
      if (v === null) return -100; // conta zerada no período ("-"), como na tabela da aula
      return ((v - b) / b) * 100;
    }),
  }));
}

export { SECTION_TITLES };
