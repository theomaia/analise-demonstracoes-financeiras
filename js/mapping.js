// Classifica as linhas lidas (seção/grupo) e identifica as contas usadas nos indicadores.
import { normalize } from './util.js';
import { FIELDS } from './model.js';

const hasValues = (r) => Object.values(r.values || {}).some((v) => v !== null && v !== undefined);

const RX = {
  ativoTotal: /^(total (do |de |dos )?)?ativos?( total)?$/,
  circulante: /^(total (do |de )?)?(ativo |passivo )?circulante( total)?$/,
  rlp: /^(total (do |de )?)?(ativo )?realizavel a longo prazo/,
  anc: /^(total (do |de )?)?(ativo )?nao circulante( total)?$/,
  permanente: /^(total (do |de )?)?(ativo )?permanente$|^investimentos?$|^imobilizado|^intangivel|^diferido$/,
  pnc: /^(total (do |de )?)?(passivo )?(nao circulante|exigivel a longo prazo)( total)?$/,
  pl: /^(total (do |de )?)?patrimonio liquido/,
  passivoTotal: /^(total (do |de )?)?passivo( total)?$|passivo e (do )?patrimonio liquido$|^total geral/,
  dreStart: /^(receitas?|vendas|faturamento) (operacional |operacionais )?(bruta|brutas|liquida|liquidas|de vendas?|de venda de bens)/,
};

function sectionFromTitle(n, current) {
  if (/^balanc(o|os) patrimonia(l|is)/.test(n)) return n.includes('passivo') ? 'passivo' : current === 'passivo' ? 'passivo' : 'ativo';
  if (/^demonstrac(ao|oes) (do|dos) (fluxos? de caixa)/.test(n)) return 'dfc';
  if (/^demonstrac(ao|oes) (do resultado abrangente|dos resultados abrangentes|das mutacoes|do valor adicionado|dos valores adicionados)/.test(n)) return 'outro';
  if (/^notas explicativas/.test(n)) return 'outro';
  if (/^(demonstrac(ao|oes) (do|dos) resultados?|dre)( do exercicio| dos exercicios| do periodo)?$/.test(n)) return 'dre';
  if (current !== 'ativo' && current !== 'passivo' && /^ativo( total)?$|^ativo circulante$/.test(n)) return 'ativo';
  if (current === 'ativo' && /^passivo( e patrimonio liquido| total)?$|^passivo circulante$/.test(n)) return 'passivo';
  if ((current === null || current === 'ativo' || current === 'passivo') && RX.dreStart.test(n)) return 'dre';
  return null;
}

function blockFromCode(code) {
  const p = code.split('.');
  if (p[0] === '1') {
    if (p.length === 1) return 'TOT';
    if (p[1] === '01') return 'AC';
    if (p[1] === '02') return p.length === 2 ? 'ANC' : p[2] === '01' ? 'RLP' : 'AP';
  }
  if (p[0] === '2') {
    if (p.length === 1) return 'TOT';
    if (p[1] === '01') return 'PC';
    if (p[1] === '02') return 'PNC';
    return 'PL';
  }
  return null;
}

const SECTION_BY_CODE = { 1: 'ativo', 2: 'passivo', 3: 'dre', 6: 'dfc', 9: 'info' };

// Atribui seção (ativo/passivo/dre/dfc/info/outro) e grupo (AC, RLP, AP, PC, PNC, PL) a cada linha.
export function annotate(rows, hint = null) {
  let section = hint;
  let block = null;
  let seen = 0;
  for (const r of rows) {
    const n = (r.norm = normalize(r.label));
    const hv = hasValues(r);
    if (r.code) {
      section = SECTION_BY_CODE[r.code.split('.')[0]] || 'outro';
      r.section = section;
      r.block = blockFromCode(r.code);
      block = r.block;
      continue;
    }
    const sec = n ? sectionFromTitle(n, section) : null;
    if (sec && sec !== section) { section = sec; block = null; seen = 0; }
    if (!section && hv) section = 'ativo';
    if (section === 'ativo') {
      if (RX.circulante.test(n)) block = 'AC';
      else if (RX.rlp.test(n)) block = 'RLP';
      else if (RX.anc.test(n)) block = 'ANC';
      else if (RX.permanente.test(n)) block = 'AP';
      else if (RX.ativoTotal.test(n) && hv && seen > 2) {
        r.section = 'ativo'; r.block = 'TOT';
        section = 'passivo'; block = null; seen = 0;
        continue;
      }
      if (!block) block = 'AC';
    } else if (section === 'passivo') {
      if (RX.circulante.test(n)) block = 'PC';
      else if (RX.pnc.test(n)) block = 'PNC';
      else if (RX.pl.test(n)) block = 'PL';
      else if (RX.passivoTotal.test(n)) block = hv && seen > 2 ? 'TOT' : 'PC';
      if (!block) block = 'PC';
    } else {
      block = null;
    }
    r.section = section;
    r.block = block;
    if (hv) seen++;
  }
  return rows;
}

// Regras de identificação: código CVM, seção/grupo e padrões de nome.
const BORROW = /emprestimo|financiamento|debenture/;
const RULES = [
  { key: 'ativoTotal', sec: ['ativo'], code: ['1'], pat: [RX.ativoTotal] },
  { key: 'ativoCirculante', sec: ['ativo'], code: ['1.01'], pat: [/^(total (do |de )?)?(ativo )?circulante( total)?$/], sub: 'AC' },
  { key: 'caixa', blocks: ['AC'], code: ['1.01.01'], pat: [/^caixa|disponibilidades|^disponivel|^bancos/] },
  { key: 'aplicacoes', blocks: ['AC'], code: ['1.01.02'], pat: [/aplicac(oes|ao) (financeiras?|de liquidez)|titulos e valores mobiliarios/] },
  { key: 'contasReceber', blocks: ['AC'], code: ['1.01.03'], pat: [/contas a receber|clientes|duplicatas a receber|recebiveis/], exc: [/descontad/] },
  { key: 'estoques', blocks: ['AC'], code: ['1.01.04'], pat: [/^estoques?\b/] },
  { key: 'ativoNaoCirculante', sec: ['ativo'], code: ['1.02'], pat: [RX.anc] },
  { key: 'realizavelLP', sec: ['ativo'], code: ['1.02.01'], pat: [RX.rlp], sub: 'RLP' },
  { key: 'imobilizado', blocks: ['AP', 'ANC'], code: ['1.02.03'], pat: [/^imobilizado/] },
  { key: 'passivoCirculante', sec: ['passivo'], code: ['2.01'], pat: [/^(total (do |de )?)?(passivo )?circulante( total)?$/], sub: 'PC' },
  { key: 'fornecedores', blocks: ['PC'], code: ['2.01.02'], pat: [/fornecedores|duplicatas a pagar/] },
  { key: 'emprestimosCP', blocks: ['PC'], code: ['2.01.04'], pat: [BORROW], exc: [/partes relacionadas|coligad|controlad|descontad/], sum: true, abs: true },
  { key: 'duplicatasDescontadas', sec: ['ativo', 'passivo', 'info'], pat: [/(duplicatas|titulos) descontad/], abs: true },
  { key: 'passivoNaoCirculante', sec: ['passivo'], code: ['2.02'], pat: [RX.pnc], sub: 'PNC' },
  { key: 'emprestimosLP', blocks: ['PNC'], code: ['2.02.01'], pat: [BORROW], exc: [/partes relacionadas|coligad|controlad/], sum: true, abs: true },
  { key: 'patrimonioLiquido', sec: ['passivo'], code: ['2.03'], pat: [/^(total (do |de )?)?patrimonio liquido( consolidado| total)?$/], sub: 'PL' },
  { key: 'receitaBruta', sec: ['dre'], pat: [/^receitas? (operacional |operacionais )?brutas?|^faturamento bruto|^vendas brutas/] },
  { key: 'deducoes', sec: ['dre'], pat: [/^deduc(oes|ao)/], abs: true },
  { key: 'receitaLiquida', sec: ['dre'], code: ['3.01'], pat: [/^receitas? (operacional |operacionais )?liquidas?|^receitas? de vendas?( de bens| e servicos|$)|^receitas? liquidas? de vendas|^vendas liquidas|^receitas?$/] },
  { key: 'cpv', sec: ['dre'], code: ['3.02'], pat: [/^custos? (dos|das|de) (produtos|mercadorias|servicos|bens|vendas)|^cpv|^cmv|^custos? operacionais/], abs: true },
  { key: 'lucroBruto', sec: ['dre'], code: ['3.03'], pat: [/^(lucro|resultado) (operacional )?bruto/] },
  { key: 'lucroOperacional', sec: ['dre'], code: ['3.05'], pat: [/^(lucro|resultado) operacional|^(resultado|lucro) antes do resultado financeiro|^ebit$/], exc: [/bruto/] },
  { key: 'despesasFinanceiras', sec: ['dre', 'info'], code: ['3.06.02'], pat: [/^despesas? financeiras?/], abs: true },
  { key: 'lucroLiquido', sec: ['dre'], code: ['3.11'], pat: [/^(lucro|resultado|prejuizo)( liquido| prejuizo)*( consolidado)? (do|dos) (exercicio|exercicios|periodo)|^lucro liquido|^resultado liquido|^lucro prejuizo/], exc: [/por acao|atribuid|operacoes (continuadas|descontinuadas)|antes/] },
  { key: 'depreciacaoAmortizacao', sec: ['dfc', 'dre', 'info'], pat: [/deprecia|amortizac|exaust/], exc: [/acumulad|emprestim|financiament|debentur|arrendament|principal|juros/], sum: true, abs: true },
  { key: 'depreciacaoAcumulada', sec: ['ativo', 'info'], pat: [/deprecia\w*( e amortizac\w*)? acumulad/], abs: true },
  { key: 'compras', sec: ['info', 'dre'], pat: [/^compras( a prazo| do periodo| do exercicio)?( opcional)?$/], abs: true },
];

function rowArray(r, keys) {
  return keys.map((k) => {
    const v = r.values[k];
    return v === undefined ? null : v;
  });
}

const close = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.002);

// Soma linhas sem contar duas vezes uma conta e suas subcontas.
function dedupeSum(cands, keys) {
  let list = cands;
  if (list.some((r) => r.code)) {
    list = list.filter((r) => !list.some((o) => o !== r && o.code && r.code && r.code.startsWith(o.code + '.')));
  } else {
    const out = [];
    let i = 0;
    while (i < list.length) {
      const parent = list[i];
      out.push(parent);
      const pv = rowArray(parent, keys);
      const acc = keys.map(() => 0);
      let next = i + 1;
      for (let j = i + 1; j < list.length; j++) {
        rowArray(list[j], keys).forEach((v, k) => { acc[k] += v ?? 0; });
        if (pv.every((v, k) => v === null || close(acc[k], v))) { next = j + 1; break; }
      }
      i = next;
    }
    list = out;
  }
  return list;
}

function applyRule(rule, rows, keys, isCvm) {
  const ok = (r) => {
    if (!hasValues(r)) return false;
    if (rule.blocks && !rule.blocks.includes(r.block)) return false;
    if (rule.sec && !rule.sec.includes(r.section)) return false;
    if (!rule.blocks && !rule.sec) return false;
    if (r.section === 'dfc' && r.code && !r.code.startsWith('6.01')) return false;
    return true;
  };
  const sectionsOf = rule.sec || (rule.blocks.some((b) => ['AC', 'RLP', 'AP', 'ANC'].includes(b)) ? ['ativo'] : ['passivo']);

  let found = [];
  if (isCvm && rule.code) {
    found = rows.filter((r) => r.code && rule.code.includes(r.code) && sectionsOf.includes(r.section) && hasValues(r));
    if (found.length) found = [found[0]];
  }
  if (!found.length) {
    const cands = rows.filter((r) => ok(r) && r.norm && rule.pat.some((p) => p.test(r.norm)) && !(rule.exc || []).some((p) => p.test(r.norm)));
    if (cands.length) found = rule.sum ? dedupeSum(cands, keys) : [cands[0]];
  }
  if (!found.length && rule.sub) {
    const s = rows.find((r) => r.subtotal && r.block === rule.sub && hasValues(r));
    if (s) found = [s];
  }
  if (!found.length) return null;

  const values = keys.map((k) => {
    let any = false;
    let sum = 0;
    for (const r of found) {
      const v = r.values[k];
      if (v !== null && v !== undefined) { any = true; sum += rule.abs ? Math.abs(v) : v; }
    }
    return any ? sum : null;
  });
  const label = (r) => (r.subtotal ? `subtotal (${r.block})` : (r.code ? r.code + ' ' : '') + r.label);
  const source = found.length === 1 ? label(found[0]) : 'soma: ' + found.map(label).join(' + ');
  return { values, source };
}

export function detectCvm(rows) {
  return rows.some((r) => (r.code === '1.01' || r.code === '2.01') && /circulante/.test(r.norm || normalize(r.label)));
}

// Calcula campos faltantes a partir das identidades contábeis.
function deriveMissing(fields, sources, P) {
  const get = (k, i) => fields[k][i];
  const rules = [
    ['ativoTotal', ['ativoCirculante', 'ativoNaoCirculante'], (a, b) => a + b, 'AC + ANC'],
    ['ativoTotal', ['passivoCirculante', 'passivoNaoCirculante', 'patrimonioLiquido'], (a, b, c) => a + b + c, 'PC + PNC + PL'],
    ['ativoNaoCirculante', ['ativoTotal', 'ativoCirculante'], (a, b) => a - b, 'Ativo total − AC'],
    ['ativoCirculante', ['ativoTotal', 'ativoNaoCirculante'], (a, b) => a - b, 'Ativo total − ANC'],
    ['patrimonioLiquido', ['ativoTotal', 'passivoCirculante', 'passivoNaoCirculante'], (a, b, c) => a - b - c, 'Ativo total − PC − PNC'],
    ['passivoNaoCirculante', ['ativoTotal', 'passivoCirculante', 'patrimonioLiquido'], (a, b, c) => a - b - c, 'Ativo total − PC − PL'],
    ['passivoCirculante', ['ativoTotal', 'passivoNaoCirculante', 'patrimonioLiquido'], (a, b, c) => a - b - c, 'Ativo total − PNC − PL'],
    ['receitaLiquida', ['receitaBruta', 'deducoes'], (a, b) => a - Math.abs(b), 'Receita bruta − deduções'],
    ['lucroBruto', ['receitaLiquida', 'cpv'], (a, b) => a - Math.abs(b), 'Receita líquida − CPV'],
  ];
  for (let pass = 0; pass < 2; pass++) {
    for (const [target, deps, fn, desc] of rules) {
      let used = false;
      for (let i = 0; i < P; i++) {
        if (get(target, i) !== null) continue;
        const args = deps.map((d) => get(d, i));
        if (args.every((a) => a !== null)) { fields[target][i] = fn(...args); used = true; }
      }
      if (used && !sources[target]) sources[target] = 'calculado: ' + desc;
    }
  }
}

export function mapFields(dataset) {
  const keys = dataset.periods;
  const P = keys.length;
  const rows = dataset.rows;
  const isCvm = detectCvm(rows);
  const fields = {};
  const sources = {};
  for (const f of FIELDS) fields[f.key] = Array(P).fill(null);
  for (const rule of RULES) {
    const res = applyRule(rule, rows, keys, isCvm);
    if (res) { fields[rule.key] = res.values; sources[rule.key] = res.source; }
  }
  deriveMissing(fields, sources, P);
  return { fields, sources, isCvm };
}

export function emptyFields(P) {
  const fields = {};
  for (const f of FIELDS) fields[f.key] = Array(P).fill(null);
  return fields;
}

// Período cronológico: tenta extrair o ano do rótulo.
export function periodSortKey(label) {
  const m = String(label).match(/(19|20)\d{2}/);
  if (!m) return null;
  const mm = String(label).match(/^(\d{1,2})[/.-]/);
  return Number(m[0]) * 100 + (mm ? Number(mm[1]) : 12);
}
