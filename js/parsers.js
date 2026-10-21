// Leitura de arquivos: Excel (.xlsx/.xls/.ods), CSV, dados abertos da CVM e PDF.
// Tudo roda no navegador; nenhum arquivo é enviado a servidores.
import { normalize, parseNum, isDash, compareCodes } from './util.js';
import { annotate, periodSortKey } from './mapping.js';

const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const scripts = {};
function loadScript(url) {
  if (!scripts[url]) {
    scripts[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => { delete scripts[url]; reject(new Error('Não foi possível carregar a biblioteca ' + url + '. Verifique sua conexão.')); };
      document.head.appendChild(s);
    });
  }
  return scripts[url];
}

export async function getXLSX() {
  await loadScript(SHEETJS_URL);
  return window.XLSX;
}

async function getPdfjs() {
  await loadScript(PDFJS_URL);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return window.pdfjsLib;
}

const CODE_RX = /^\d+(\.\d+)*$/;
const HEADER_SKIP = /^(nota|notas|nota explicativa|ref|av|ah|av ?%|ah ?%|%|var.*|analise (vertical|horizontal))$/;

function sheetHint(name) {
  const n = normalize(name);
  if (/passivo|bpp/.test(n)) return 'passivo';
  if (/ativo|bpa|balanc|^bp\b/.test(n)) return 'ativo';
  if (/fluxo|dfc/.test(n)) return 'dfc';
  if (/dre|resultado/.test(n)) return 'dre';
  return null;
}

function uniqueLabels(labels) {
  const seen = {};
  return labels.map((l) => {
    seen[l] = (seen[l] || 0) + 1;
    return seen[l] > 1 ? `${l} (${seen[l]})` : l;
  });
}

function headerText(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') {
    if (cell > 20000 && cell < 80000) {
      const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
      return d.getUTCMonth() === 11 ? String(d.getUTCFullYear()) : `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    }
    return String(cell);
  }
  if (cell instanceof Date) return String(cell.getFullYear());
  return String(cell).replace(/\s+/g, ' ').trim();
}

// Tabela "larga": uma coluna de contas e uma coluna de valores por período.
export function parseAoaWide(aoa, sheetName = '') {
  const rows = aoa.filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== ''));
  if (rows.length < 2) return null;
  const ncol = Math.max(...rows.map((r) => r.length));
  const isNum = (c) => parseNum(c) !== null;
  const isYear = (c) => (typeof c === 'number' && Number.isInteger(c) && c >= 1900 && c <= 2100) || (typeof c === 'string' && /^\s*(19|20)\d{2}\s*$/.test(c));
  const isCode = (c) => (typeof c === 'string' && CODE_RX.test(c.trim())) || (typeof c === 'number' && Number.isInteger(c) && c >= 1 && c <= 9);

  const stats = Array.from({ length: ncol }, () => ({ text: 0, num: 0, code: 0 }));
  for (const r of rows) {
    for (let j = 0; j < ncol; j++) {
      const c = r[j];
      if (c === null || c === undefined || c === '') continue;
      if (typeof c === 'string' && CODE_RX.test(c.trim()) && c.includes('.')) stats[j].code++;
      else if (isNum(c)) stats[j].num++;
      else if (typeof c === 'string' && c.trim().length >= 3) stats[j].text++;
    }
  }
  let labelCol = 0;
  stats.forEach((s, j) => { if (s.text > stats[labelCol].text) labelCol = j; });
  let codeCol = -1;
  stats.forEach((s, j) => { if (j !== labelCol && s.code >= 3 && s.code >= rows.length * 0.2 && (codeCol < 0 || s.code > stats[codeCol].code)) codeCol = j; });

  const dataRowMin = rows.filter((r) => typeof r[labelCol] === 'string').length;
  let valueCols = [];
  for (let j = 0; j < ncol; j++) {
    if (j === labelCol || j === codeCol) continue;
    if (stats[j].num >= 2 && stats[j].num >= dataRowMin * 0.25) valueCols.push(j);
  }
  if (!valueCols.length) return null;

  // Linha de cabeçalho: anos ou textos acima da primeira linha com valores.
  const isHeaderRow = (r) => valueCols.every((j) => r[j] === null || r[j] === undefined || r[j] === '' || isYear(r[j]) || (typeof r[j] === 'string' && !isNum(r[j])));
  let firstData = rows.findIndex((r) => valueCols.some((j) => isNum(r[j])) && !isHeaderRow(r));
  if (firstData < 0) return null;
  const headers = valueCols.map((j) => {
    for (let i = firstData - 1; i >= 0; i--) {
      const t = headerText(rows[i][j]);
      if (t) return t;
    }
    return '';
  });
  // Descarta colunas de notas e de AV%/AH%.
  const keep = valueCols.map((j, k) => !HEADER_SKIP.test(normalize(headers[k])) && !/%/.test(headers[k]));
  valueCols = valueCols.filter((_, k) => keep[k]);
  const hdrs = headers.filter((_, k) => keep[k]);
  if (!valueCols.length) return null;
  const periods = uniqueLabels(hdrs.map((h, k) => h || `Período ${k + 1}`));

  const out = [];
  for (let i = firstData; i < rows.length; i++) {
    const r = rows[i];
    let label = typeof r[labelCol] === 'string' ? r[labelCol].trim() : (r[labelCol] ?? '') + '';
    let code = codeCol >= 0 && r[codeCol] !== null && r[codeCol] !== undefined && isCode(r[codeCol]) ? String(r[codeCol]).trim() : null;
    const m = label.match(/^(\d+(?:\.\d+)+)\s*[-–—]?\s+(.*)$/);
    if (!code && m) { code = m[1]; label = m[2]; }
    const values = {};
    let any = false;
    valueCols.forEach((j, k) => {
      const v = parseNum(r[j]);
      values[periods[k]] = v;
      if (v !== null) any = true;
    });
    if (!label && !any) continue;
    if (isHeaderRow(r) && !any && !label) continue;
    out.push({ code, label, values, subtotal: !label && any });
  }
  annotate(out, sheetHint(sheetName));
  return { periods, rows: out };
}

// ── CSV ──
function parseCsv(text) {
  const sample = text.slice(0, 5000);
  const count = (ch) => sample.split(ch).length - 1;
  const delim = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => (c.trim() === '' ? null : c.trim())));
}

async function readText(file) {
  const buf = await file.arrayBuffer();
  const utf = new TextDecoder('utf-8').decode(buf);
  return utf.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf.replace(/^﻿/, '');
}

// ── Dados abertos da CVM (formato "longo": CD_CONTA, DS_CONTA, VL_CONTA) ──
function isCvmHeader(row) {
  if (!row) return false;
  const h = row.map((c) => String(c ?? '').trim().toUpperCase());
  return h.includes('CD_CONTA') && h.includes('VL_CONTA') && h.includes('DS_CONTA');
}

function parseCvmLong(aoa) {
  const h = aoa[0].map((c) => String(c ?? '').trim().toUpperCase());
  const ix = (n) => h.indexOf(n);
  const I = { code: ix('CD_CONTA'), desc: ix('DS_CONTA'), val: ix('VL_CONTA'), fim: ix('DT_FIM_EXERC'), ini: ix('DT_INI_EXERC'), cia: ix('DENOM_CIA'), cvm: ix('CD_CVM'), ref: ix('DT_REFER'), ver: ix('VERSAO'), esc: ix('ESCALA_MOEDA'), ord: ix('ORDEM_EXERC') };
  const recs = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || !r[I.code]) continue;
    const fim = String(r[I.fim] ?? r[I.ref] ?? '');
    const m = fim.match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const raw = String(r[I.val] ?? '').replace(',', '.');
    let val = Number(raw);
    if (!Number.isFinite(val)) continue;
    if (I.esc >= 0 && String(r[I.esc]).toUpperCase() === 'MIL') val *= 1000;
    recs.push({
      cia: I.cia >= 0 ? String(r[I.cia]).trim() : 'Companhia',
      code: String(r[I.code]).trim(),
      desc: String(r[I.desc] ?? '').trim(),
      val,
      period: m[2] === '12' ? m[1] : `${m[2]}/${m[1]}`,
      ini: I.ini >= 0 ? String(r[I.ini] ?? '') : '',
      ref: I.ref >= 0 ? String(r[I.ref] ?? '') : '',
      ver: I.ver >= 0 ? Number(r[I.ver]) || 0 : 0,
    });
  }
  return recs;
}

export function cvmCompanies(records) {
  return [...new Set(records.map((r) => r.cia))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function buildCvmDataset(records, cia) {
  const best = new Map();
  const desc = new Map();
  for (const r of records) {
    if (r.cia !== cia) continue;
    const k = r.code + '|' + r.period;
    const cur = best.get(k);
    // Prefere a publicação mais recente (reapresentações) e o período acumulado mais longo.
    const better = !cur || r.ref > cur.ref || (r.ref === cur.ref && (r.ver > cur.ver || (r.ver === cur.ver && r.ini && r.ini < cur.ini)));
    if (better) best.set(k, r);
    if (!desc.has(r.code) || r.ref >= (desc.get(r.code).ref || '')) desc.set(r.code, r);
  }
  const periods = [...new Set([...best.values()].map((r) => r.period))].sort((a, b) => periodSortKey(a) - periodSortKey(b));
  const codes = [...desc.keys()].sort(compareCodes);
  const rows = codes.map((code) => ({
    code,
    label: desc.get(code).desc,
    values: Object.fromEntries(periods.map((p) => [p, best.get(code + '|' + p)?.val ?? null])),
  }));
  annotate(rows);
  return { name: cia, periods, rows };
}

// ── PDF ──
const PERIOD_TOKEN = /^((19|20)\d{2}|\d{2}[/.]\d{2}[/.](19|20)\d{2}|(19|20)\d{2}-\d{2}-\d{2}|\d\.?\d?x\d|\d{2}x\d)$/i;

function periodLabel(tok) {
  let m = tok.match(/^(\d{2})[/.](\d{2})[/.]((19|20)\d{2})$/);
  if (m) return m[2] === '12' ? m[3] : `${m[2]}/${m[3]}`;
  m = tok.match(/^((19|20)\d{2})-(\d{2})-\d{2}$/);
  if (m) return m[3] === '12' ? m[1] : `${m[3]}/${m[1]}`;
  return tok.toUpperCase();
}

async function pdfLines(file, onProgress) {
  const lib = await getPdfjs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`Lendo página ${p} de ${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || 8 }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const pageLines = [];
    for (const it of items) {
      const line = pageLines.find((l) => Math.abs(l.y - it.y) < Math.max(2, it.h * 0.45));
      if (line) line.items.push(it); else pageLines.push({ y: it.y, items: [it] });
    }
    pageLines.sort((a, b) => b.y - a.y);
    for (const l of pageLines) {
      l.items.sort((a, b) => a.x - b.x);
      const tokens = [];
      let prevEndsSpace = true;
      for (const it of l.items) {
        const parts = it.str.split(/(\s+)/);
        let off = 0;
        const len = it.str.length || 1;
        parts.forEach((part, k) => {
          if (part.trim()) {
            const t = { s: part, x0: it.x + (it.w * off) / len, x1: it.x + (it.w * (off + part.length)) / len };
            const prev = tokens[tokens.length - 1];
            // Fragmentos colados (o PDF quebra "2.0x3" em "2.0" "x" "3"): junta ao token anterior.
            if (k === 0 && prev && !prevEndsSpace && t.x0 - prev.x1 < it.h * 0.15) { prev.s += t.s; prev.x1 = t.x1; }
            else tokens.push(t);
          }
          off += part.length;
        });
        prevEndsSpace = /\s$/.test(it.str);
      }
      // Junta parênteses soltos: "(" "1.234" ")" → "(1.234)"
      const merged = [];
      for (const t of tokens) {
        const prev = merged[merged.length - 1];
        if (prev && (prev.s === '(' || prev.s === '-' && /^[\d(]/.test(t.s)) && t.x0 - prev.x1 < 6) { prev.s += t.s; prev.x1 = t.x1; }
        else if (prev && t.s === ')' && /\d$/.test(prev.s)) { prev.s += ')'; prev.x1 = t.x1; }
        else merged.push({ ...t });
      }
      lines.push({ page: p, tokens: merged });
    }
  }
  return lines;
}

const SKIP_COL = /^(av|ah)\s*%?$|^%$|^notas?$/i;
const SUBHEADER = /^(atual|anterior|av\s*%?|ah\s*%?|%|notas?|controladora|consolidado|r\$|mil|em|reais|milhares|de)$/i;

function parsePdfLines(lines) {
  const isNumTok = (s) => parseNum(s) !== null || isDash(s);
  let cols = null;
  const headerOrder = [];
  const rows = [];
  const fallback = [];

  for (const line of lines) {
    const toks = line.tokens;
    if (!toks.length) continue;
    const pTok = toks.filter((t) => PERIOD_TOKEN.test(t.s));
    const numToks = toks.filter((t) => isNumTok(t.s) && !PERIOD_TOKEN.test(t.s));
    const textToks = toks.filter((t) => !isNumTok(t.s) && !PERIOD_TOKEN.test(t.s) && !SKIP_COL.test(t.s));
    const textLen = textToks.map((t) => t.s).join(' ').length;
    const smallInts = numToks.every((t) => { const v = parseNum(t.s); return v !== null && Number.isInteger(v) && v >= 0 && v <= 31; });

    // Cabeçalho com os períodos (anos/datas).
    if (pTok.length && smallInts && (pTok.length >= 2 || textLen <= 25)) {
      const labels = uniqueLabels(pTok.map((t) => periodLabel(t.s)));
      cols = pTok.map((t, k) => ({ label: labels[k], xc: (t.x0 + t.x1) / 2, x1: t.x1 }));
      toks.filter((t) => SKIP_COL.test(t.s)).forEach((t) => cols.push({ skip: true, xc: (t.x0 + t.x1) / 2, x1: t.x1 }));
      for (const l of labels) if (!headerOrder.includes(l)) headerOrder.push(l);
      const title = textToks.filter((t) => !SUBHEADER.test(t.s)).map((t) => t.s).join(' ').trim();
      if (title) rows.push({ code: null, label: title, values: {} });
      continue;
    }
    // Sub-cabeçalho ("Atual AV% Atual AV%"): marca colunas a ignorar.
    if (cols && !numToks.length && toks.every((t) => SUBHEADER.test(t.s))) {
      toks.filter((t) => SKIP_COL.test(t.s)).forEach((t) => {
        const xc = (t.x0 + t.x1) / 2;
        let best = null, bd = Infinity;
        for (const c of cols) { const d = Math.abs(c.xc - xc); if (d < bd) { bd = d; best = c; } }
        if (best && !best.skip && bd < 25) best.skip = true;
        else if (!best || bd >= 25) cols.push({ skip: true, xc, x1: t.x1 });
      });
      continue;
    }
    const text = toks.map((t) => t.s).join(' ');
    if (!numToks.length) {
      if (text.length <= 90) rows.push({ code: null, label: text, values: {} });
      continue;
    }
    if (cols) {
      const sorted = [...cols].sort((a, b) => a.xc - b.xc);
      const gap = sorted.length > 1 ? Math.min(...sorted.slice(1).map((c, k) => c.xc - sorted[k].xc)) : 120;
      const tol = Math.max(30, gap * 0.75);
      const values = {};
      let firstAssigned = Infinity;
      for (const t of toks) {
        if (!isNumTok(t.s)) continue;
        const xc = (t.x0 + t.x1) / 2;
        let best = null, bd = Infinity;
        for (const c of cols) {
          const d = Math.min(Math.abs(c.xc - xc), Math.abs(c.x1 - t.x1));
          if (d < bd) { bd = d; best = c; }
        }
        if (!best || bd > tol) continue;
        firstAssigned = Math.min(firstAssigned, t.x0);
        if (!best.skip && !(best.label in values)) values[best.label] = parseNum(t.s);
      }
      const labelToks = toks.filter((t) => t.x1 <= firstAssigned + 1);
      while (labelToks.length && /^(\d{1,2}([.,]\d{1,2})?[a-z]?|nota)$/i.test(labelToks[labelToks.length - 1].s)) labelToks.pop();
      const label = labelToks.map((t) => t.s).join(' ').trim();
      const nVals = Object.values(values).filter((v) => v !== null).length;
      if (!label && nVals < Math.min(2, cols.filter((c) => !c.skip).length)) continue;
      if (Object.keys(values).length) rows.push({ code: null, label, values, subtotal: !label });
      else if (label && label.length <= 90) rows.push({ code: null, label, values: {} });
    } else {
      // Sem cabeçalho de períodos: usa os números finais da linha.
      const trail = [];
      for (let k = toks.length - 1; k >= 0 && isNumTok(toks[k].s); k--) trail.unshift(toks[k]);
      const label = toks.slice(0, toks.length - trail.length).map((t) => t.s).join(' ').trim();
      if (label && trail.length) fallback.push({ label, nums: trail.map((t) => parseNum(t.s)) });
    }
  }

  // Períodos efetivamente usados, na ordem dos cabeçalhos.
  const used = new Set(rows.flatMap((r) => Object.keys(r.values).filter((k) => r.values[k] !== null)));
  const periods = headerOrder.filter((p) => used.has(p));

  if (!periods.length && fallback.length) {
    const counts = {};
    fallback.forEach((f) => { counts[f.nums.length] = (counts[f.nums.length] || 0) + 1; });
    const K = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    for (let k = 0; k < K; k++) periods.push(`Coluna ${k + 1}`);
    for (const f of fallback) {
      const vals = f.nums.slice(-K);
      const values = {};
      vals.forEach((v, k) => { values[periods[K - vals.length + k]] = v; });
      rows.push({ code: null, label: f.label, values });
    }
  }

  for (const r of rows) {
    const m = r.label.match(/^(\d+(?:\.\d+)+)\s*[-–—]?\s+(.*)$/);
    if (m) { r.code = m[1]; r.label = m[2]; }
  }
  annotate(rows);
  return { periods, rows: rows.filter((r) => r.section && r.section !== 'outro') };
}

// ── Entrada principal ──
export async function parseFiles(files, onProgress) {
  const datasets = [];
  const cvmRecords = [];
  const warnings = [];
  for (const file of files) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    onProgress?.(`Lendo ${file.name}…`);
    if (ext === 'pdf') {
      const lines = await pdfLines(file, onProgress);
      const textLines = lines.filter((l) => l.tokens.length).length;
      if (textLines < 5) throw new Error(`"${file.name}" não tem texto selecionável (parece um PDF digitalizado). Use uma planilha ou preencha os dados manualmente.`);
      const ds = parsePdfLines(lines);
      if (!ds.periods.length) throw new Error(`Não encontramos colunas de períodos (anos) em "${file.name}".`);
      warnings.push(`PDF lido por aproximação: confira os valores na etapa de revisão.`);
      datasets.push({ name: file.name, ...ds });
    } else if (['xlsx', 'xlsm', 'xls', 'ods'].includes(ext)) {
      const XLSX = await getXLSX();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      for (const sn of wb.SheetNames) {
        if (/instru|leia|readme/i.test(sn)) continue;
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false });
        if (isCvmHeader(aoa[0])) { cvmRecords.push(...parseCvmLong(aoa)); continue; }
        const ds = parseAoaWide(aoa, sn);
        if (ds && ds.rows.length) datasets.push({ name: `${file.name} › ${sn}`, ...ds });
      }
    } else if (['csv', 'txt', 'tsv'].includes(ext)) {
      const aoa = parseCsv(await readText(file));
      if (isCvmHeader(aoa[0])) cvmRecords.push(...parseCvmLong(aoa));
      else {
        const ds = parseAoaWide(aoa, file.name);
        if (ds && ds.rows.length) datasets.push({ name: file.name, ...ds });
      }
    } else {
      throw new Error(`Formato não suportado: "${file.name}". Use .xlsx, .xls, .csv ou .pdf.`);
    }
  }
  return { datasets, cvmRecords, warnings };
}

// Junta vários conjuntos (ex.: BP e DRE em arquivos ou abas diferentes).
export function mergeDatasets(list) {
  const periods = [];
  const rows = [];
  for (const ds of list) {
    for (const p of ds.periods) if (!periods.includes(p)) periods.push(p);
    rows.push(...ds.rows);
  }
  const keys = periods.map(periodSortKey);
  if (keys.every((k) => k !== null)) {
    const idx = periods.map((p, i) => i).sort((a, b) => keys[a] - keys[b] || a - b);
    return { name: list.map((d) => d.name).join(' + '), periods: idx.map((i) => periods[i]), rows };
  }
  return { name: list.map((d) => d.name).join(' + '), periods, rows };
}
