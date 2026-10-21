// Utilitários: normalização de texto, leitura e formatação de números (pt-BR).

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isDash(s) {
  return typeof s === 'string' && /^\s*[-–—]+\s*$/.test(s);
}

// Converte "1.234,56", "(1.234)", "-1,234.5", "R$ 10", 1234 → número. Retorna null se não for número.
export function parseNum(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (!s || isDash(s)) return null;
  let neg = false;
  const flipParens = () => {
    if (/^\(.*\)$/.test(s)) { neg = !neg; s = s.slice(1, -1).trim(); }
  };
  flipParens();
  s = s.replace(/^r\$\s*/i, '').replace(/\s+/g, '');
  if (/^[-−–]/.test(s)) { neg = !neg; s = s.slice(1); }
  if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
  flipParens();
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, '');
    else if (s.split(',').length > 2) return null;
    else s = s.replace(',', '.');
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (s.split('.').length > 2) return null;
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const nfCache = {};
function nf(min, max) {
  const k = min + ':' + max;
  if (!nfCache[k]) nfCache[k] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
  return nfCache[k];
}

export function fmtNum(v, dec = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return nf(dec, dec).format(v);
}

// Valor monetário compacto para tabelas (sem casas decimais quando grande).
export function fmtMoney(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Math.abs(v) >= 100 ? nf(0, 0).format(v) : nf(0, 2).format(v);
}

export function fmtInput(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  return nf(0, 2).format(v);
}

// Formata o valor de um indicador conforme o tipo.
export function fmtInd(v, type) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  switch (type) {
    case 'pct': return nf(1, 1).format(v * 100) + '%';
    case 'dias': return nf(0, 0).format(v) + ' dias';
    case 'meses': return nf(1, 1).format(v) + ' meses';
    case 'vezes': return nf(2, 2).format(v) + 'x';
    default: return nf(2, 2).format(v);
  }
}

export function fmtPct(v, dec = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return nf(dec, dec).format(v) + '%';
}

// Comparação natural de códigos contábeis ("1.10" depois de "1.9").
export function compareCodes(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}
