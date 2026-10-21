// Controlador da página: carregamento → revisão → resultados.
import { FIELDS, FIELD_GROUPS, FIELD_BY_KEY, PARAM_DEFAULTS, TEMPLATE_ROWS } from './model.js';
import { parseFiles, mergeDatasets, buildCvmDataset, cvmCompanies, getXLSX } from './parsers.js';
import { annotate, mapFields, emptyFields } from './mapping.js';
import { GROUPS, OBJECTIVES, INDICATORS, INDICATOR_BY_ID, computeIndicators, computeDupont, computeDerived } from './indicators.js';
import { rowsFromDataset, rowsFromFields, verticalBases, vertical, horizontal, SECTION_TITLES } from './analysis.js';
import { sampleDataset } from './sample.js';
import { esc, fmtMoney, fmtInput, fmtInd, fmtPct, fmtNum, parseNum } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = {
  dataset: null,      // { name, periods, rows }
  keys: [],           // chaves originais dos períodos (rótulos do arquivo)
  names: [],          // nomes exibidos (editáveis)
  include: [],
  fields: {},
  sources: {},
  warnings: [],
  params: { ...PARAM_DEFAULTS },
  sector: {},
  objective: 'credito',
  tab: 'resumo',
  vSource: 'arquivo',
  hMode: 'anterior',
  shallow: true,
  res: null,
  cvmRecords: null,
};

// ───────── Navegação ─────────
function go(view) {
  for (const v of ['upload', 'review', 'results']) $(`#view-${v}`).hidden = v !== view;
  $$('.step').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  $('.step[data-go="review"]').disabled = !state.dataset;
  $('.step[data-go="results"]').disabled = !state.res;
  window.scrollTo({ top: 0 });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b && !b.disabled) {
    if (b.dataset.go === 'review') renderReview();
    go(b.dataset.go);
  }
});

// ───────── Tema ─────────
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* sem armazenamento */ }
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  $('#themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignora */ }
  });
}

// ───────── Tooltip genérico (data-tip) ─────────
function initTooltip() {
  const tip = $('#tooltip');
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (tip.hidden) return;
    const x = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + 'px';
    tip.style.top = e.clientY + 14 + 'px';
  });
}

// ───────── Etapa 1: carregar ─────────
function setStatus(msg, error = false) {
  const el = $('#uploadStatus');
  el.textContent = msg;
  el.classList.toggle('error', error);
}

function loadDataset(ds, warnings = []) {
  state.dataset = ds;
  state.keys = [...ds.periods];
  state.names = [...ds.periods];
  state.include = ds.periods.map(() => true);
  const m = ds.rows.length ? mapFields(ds) : { fields: emptyFields(ds.periods.length), sources: {} };
  state.fields = m.fields;
  state.sources = m.sources;
  state.warnings = warnings;
  state.res = null;
  // Muitos períodos (ex.: controladora + consolidado): pré-seleciona os sem sufixo.
  if (ds.periods.some((p) => / \(\d+\)$/.test(p))) state.include = ds.periods.map((p) => !/ \(\d+\)$/.test(p));
  renderReview();
  go('review');
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  $('#companyPicker').hidden = true;
  setStatus('Lendo arquivos…');
  try {
    const { datasets, cvmRecords, warnings } = await parseFiles(files, (m) => setStatus(m));
    if (cvmRecords.length) {
      const cos = cvmCompanies(cvmRecords);
      state.cvmRecords = cvmRecords;
      if (cos.length === 1) {
        loadDataset(mergeDatasets([buildCvmDataset(cvmRecords, cos[0]), ...datasets]), warnings);
        setStatus('');
        return;
      }
      $('#companyList').innerHTML = cos.map((c) => `<option value="${esc(c)}">`).join('');
      $('#companyPicker').hidden = false;
      $('#companyInput').value = '';
      $('#companyInput').focus();
      state.pendingDatasets = datasets;
      state.pendingWarnings = warnings;
      setStatus(`${cos.length} companhias encontradas no arquivo da CVM.`);
      return;
    }
    if (!datasets.length) throw new Error('Não encontramos contas com valores nos arquivos. Confira o formato ou use a planilha-modelo.');
    loadDataset(mergeDatasets(datasets), warnings);
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), true);
  }
}

function initUpload() {
  const dz = $('#dropzone');
  const input = $('#fileInput');
  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  $('#companyGo').addEventListener('click', () => {
    const name = $('#companyInput').value.trim();
    const cos = cvmCompanies(state.cvmRecords || []);
    const pick = cos.find((c) => c === name) || cos.find((c) => c.toLowerCase().includes(name.toLowerCase()));
    if (!name || !pick) { setStatus('Companhia não encontrada. Escolha um nome da lista.', true); return; }
    $('#companyPicker').hidden = true;
    loadDataset(mergeDatasets([buildCvmDataset(state.cvmRecords, pick), ...(state.pendingDatasets || [])]), state.pendingWarnings || []);
    setStatus('');
  });
  $('#companyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#companyGo').click(); });

  $('#btnSample').addEventListener('click', () => {
    const ds = sampleDataset();
    annotate(ds.rows);
    loadDataset(ds, ['Dados de exemplo de uma empresa fictícia, em R$ mil.']);
  });
  $('#btnManual').addEventListener('click', () => {
    loadDataset({ name: 'Preenchimento manual', periods: ['Ano 1', 'Ano 2'], rows: [] });
  });
  const tpl = (e) => { e.preventDefault(); downloadTemplate().catch((err) => setStatus(err.message, true)); };
  $('#btnTemplate').addEventListener('click', tpl);
  $('#linkTemplate').addEventListener('click', tpl);
}

async function downloadTemplate() {
  const XLSX = await getXLSX();
  const y = new Date().getFullYear();
  const years = [String(y - 3), String(y - 2), String(y - 1)];
  const aoa = [['Código', 'Conta', ...years], ...TEMPLATE_ROWS.map(([c, l]) => [c, l, null, null, null])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 10 }, { wch: 58 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const info = XLSX.utils.aoa_to_sheet([
    ['Como preencher'],
    ['1. Na aba "Demonstrações", troque os anos do cabeçalho se precisar (do mais antigo para o mais recente) e preencha os valores.'],
    ['2. Use a mesma unidade em todo o arquivo (ex.: R$ mil). Custos, despesas e deduções podem ser positivos ou negativos.'],
    ['3. Pode acrescentar ou apagar contas de detalhe; mantenha as linhas de totais (Ativo total, Ativo circulante, Passivo circulante etc.).'],
    ['4. As linhas 9.xx são opcionais: depreciação do exercício (DFC), depreciação acumulada (notas explicativas) e compras.'],
    ['5. Salve e envie o arquivo no site. Você poderá revisar todos os valores antes de gerar a análise.'],
  ]);
  info['!cols'] = [{ wch: 120 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Demonstrações');
  XLSX.utils.book_append_sheet(wb, info, 'Instruções');
  XLSX.writeFile(wb, 'modelo-demonstracoes-financeiras.xlsx');
}

// ───────── Etapa 2: revisão ─────────
function autoValues() {
  // Valores calculados automaticamente para os campos "auto" (placeholder).
  const derived = computeDerived(state.fields, state.keys, state.params);
  const byLabel = Object.fromEntries(derived.map((d) => [d.label, d.values]));
  return { compras: byLabel['Compras do período'], ativosOperacionais: byLabel['Ativos operacionais'], passivosOperacionais: byLabel['Passivos operacionais'] };
}

function renderReview() {
  if (!state.dataset) return;
  const P = state.keys.length;
  const ds = state.dataset;
  $('#reviewSummary').textContent = ds.rows.length
    ? `${ds.name} — ${P} período(s) e ${ds.rows.length} linhas lidas.`
    : `${ds.name} — preencha os valores abaixo.`;

  const missingReq = FIELDS.filter((f) => f.req && state.fields[f.key].every((v) => v === null));
  let warn = '';
  if (state.warnings.length) warn += `<div class="notice info">${state.warnings.map(esc).join('<br>')}</div>`;
  if (ds.rows.length && missingReq.length) {
    warn += `<div class="notice warn"><strong>Não identificamos ${missingReq.length} conta(s) importante(s).</strong> Preencha abaixo para liberar todos os indicadores:<ul>${missingReq.map((f) => `<li>${esc(f.label)}</li>`).join('')}</ul></div>`;
  }
  $('#reviewWarnings').innerHTML = warn;

  $('#periodList').innerHTML = state.keys.map((k, i) => `
    <div class="period-chip">
      <input type="checkbox" data-inc="${i}" ${state.include[i] ? 'checked' : ''} aria-label="Incluir período">
      <input type="text" data-name="${i}" value="${esc(state.names[i])}" aria-label="Nome do período">
      ${ds.rows.length ? '' : `<button type="button" data-del="${i}" aria-label="Remover período" title="Remover">×</button>`}
    </div>`).join('');

  $('#pVendas').value = state.params.pctVendasPrazo;
  $('#pCompras').value = state.params.pctComprasPrazo;
  $('#pDias').value = String(state.params.dias);

  const auto = autoValues();
  let html = `<thead><tr><th>Campo</th><th>Origem no arquivo</th>${state.names.map((n, i) => `<th class="${state.include[i] ? '' : 'dim'}">${esc(n)}</th>`).join('')}</tr></thead><tbody>`;
  for (const g of FIELD_GROUPS) {
    html += `<tr class="group-row"><td colspan="${P + 2}">${esc(g.title)}</td></tr>`;
    for (const f of FIELDS.filter((x) => x.group === g.id)) {
      const vals = state.fields[f.key];
      const missing = f.req && vals.every((v) => v === null);
      const src = state.sources[f.key] || (f.auto ? 'automático' : '—');
      html += `<tr class="${missing ? 'missing' : ''}"><td class="field">${f.req ? '<span class="req-dot" aria-label="necessário"></span>' : ''}${esc(f.label)}</td>`;
      html += `<td class="src" data-tip="${esc(src)}">${esc(src)}</td>`;
      vals.forEach((v, i) => {
        const ph = f.auto && auto[f.key] ? fmtInput(auto[f.key][i]) : '';
        html += `<td class="${state.include[i] ? '' : 'dim'}"><input class="cell" inputmode="decimal" data-key="${f.key}" data-i="${i}" value="${esc(fmtInput(v))}" placeholder="${esc(ph)}" aria-label="${esc(f.label)} — ${esc(state.names[i])}"></td>`;
      });
      html += '</tr>';
    }
  }
  $('#reviewTable').innerHTML = html + '</tbody>';
}

function initReview() {
  $('#reviewTable').addEventListener('change', (e) => {
    const inp = e.target.closest('input.cell');
    if (!inp) return;
    const raw = inp.value.trim();
    const v = raw === '' ? null : parseNum(raw);
    if (raw !== '' && v === null) { inp.setCustomValidity('Número inválido'); inp.reportValidity(); return; }
    inp.setCustomValidity('');
    state.fields[inp.dataset.key][Number(inp.dataset.i)] = v;
    state.sources[inp.dataset.key] = state.sources[inp.dataset.key]?.startsWith('editado') ? state.sources[inp.dataset.key] : 'editado manualmente';
    renderReview();
    const again = $(`input.cell[data-key="${inp.dataset.key}"][data-i="${inp.dataset.i}"]`);
    const next = again?.closest('tr')?.nextElementSibling?.querySelector(`input[data-i="${inp.dataset.i}"]`);
    (next || again)?.focus();
  });
  $('#periodList').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.inc !== undefined) state.include[Number(t.dataset.inc)] = t.checked;
    if (t.dataset.name !== undefined) state.names[Number(t.dataset.name)] = t.value.trim() || state.keys[Number(t.dataset.name)];
    renderReview();
  });
  $('#periodList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || state.keys.length <= 1) return;
    const i = Number(b.dataset.del);
    for (const arr of [state.keys, state.names, state.include]) arr.splice(i, 1);
    for (const k of Object.keys(state.fields)) state.fields[k].splice(i, 1);
    renderReview();
  });
  $('#btnReverse').addEventListener('click', () => {
    for (const arr of [state.keys, state.names, state.include]) arr.reverse();
    for (const k of Object.keys(state.fields)) state.fields[k].reverse();
    renderReview();
  });
  $('#btnAddPeriod').addEventListener('click', () => {
    let n = state.keys.length + 1;
    while (state.keys.includes(`Ano ${n}`)) n++;
    state.keys.push(`Ano ${n}`);
    state.names.push(`Ano ${n}`);
    state.include.push(true);
    for (const k of Object.keys(state.fields)) state.fields[k].push(null);
    renderReview();
  });
  const param = (id, key, num = true) => $(id).addEventListener('change', (e) => {
    const v = Number(e.target.value);
    state.params[key] = num && Number.isFinite(v) ? Math.min(Math.max(v, 0), key === 'dias' ? 365 : 100) : PARAM_DEFAULTS[key];
    renderReview();
  });
  param('#pVendas', 'pctVendasPrazo');
  param('#pCompras', 'pctComprasPrazo');
  param('#pDias', 'dias');
  $('#btnAnalyze').addEventListener('click', analyze);
  $('#btnAnalyze2').addEventListener('click', analyze);
}

// ───────── Etapa 3: análise ─────────
function analyze() {
  const idx = state.include.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) { alert('Selecione ao menos um período.'); return; }
  const pick = (arr) => idx.map((i) => arr[i]);
  const fields = Object.fromEntries(Object.entries(state.fields).map(([k, v]) => [k, pick(v)]));
  const periods = pick(state.names);
  const keys = pick(state.keys);
  const P = periods.length;
  const fileRows = state.dataset.rows.length ? rowsFromDataset(state.dataset, keys) : [];
  state.res = {
    periods,
    fields,
    indicators: computeIndicators(fields, periods, state.params),
    dupont: computeDupont(fields, P),
    derived: computeDerived(fields, periods, state.params),
    fileRows,
    stdRows: rowsFromFields(fields, P),
    bases: verticalBases(fields, P),
  };
  if (!fileRows.length) state.vSource = 'padrao';
  $('#resultsTitle').textContent = state.dataset.name;
  $('#resultsSub').textContent = `Períodos analisados: ${periods.join(' · ')}. Valores na mesma unidade do arquivo.`;
  renderResults();
  go('results');
}

function setTab(tab) {
  state.tab = tab;
  $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('.tab-panel').forEach((p) => { p.hidden = p.id !== `tab-${tab}`; });
}

function renderResults() {
  renderResumo();
  renderIndicadores();
  renderDupont();
  renderVertical();
  renderHorizontal();
  renderDados();
  setTab(state.tab);
}

const STATUS_LABEL = { bom: 'Bom', atencao: 'Atenção', ruim: 'Ruim' };
const TREND_LABEL = { melhora: '▲ melhorou', piora: '▼ piorou', estavel: '■ estável', subiu: '▲ subiu', caiu: '▼ caiu' };
const chip = (s) => (s ? `<span class="chip ${s}">${STATUS_LABEL[s]}</span>` : '');
const trend = (t) => (t ? `<span class="trend ${t}">${TREND_LABEL[t]}</span>` : '');
const betterText = (b) => (b === 'maior' ? 'quanto maior, melhor' : b === 'menor' ? 'quanto menor, melhor' : 'depende do setor');

function sectorCompare(r) {
  const s = state.sector[r.def.id];
  if (s === undefined || s === null || r.latest === null) return '';
  const target = r.def.fmt === 'pct' ? s / 100 : s;
  const better = r.def.better === 'maior' ? r.latest > target : r.def.better === 'menor' ? r.latest < target : null;
  if (better === null) return `<span class="muted small">setor: ${fmtInd(target, r.def.fmt)}</span>`;
  return `<span class="trend ${better ? 'melhora' : 'piora'}">${better ? 'melhor' : 'pior'} que o setor (${fmtInd(target, r.def.fmt)})</span>`;
}

function sparkline(values, fmt, periods) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v !== null);
  if (pts.length < 2) return '';
  const W = 96, H = 30, pad = 4;
  const ys = pts.map(([, v]) => v);
  const min = Math.min(...ys), max = Math.max(...ys);
  const sx = (i) => pad + (i / Math.max(values.length - 1, 1)) * (W - pad * 2);
  const sy = (v) => (max === min ? H / 2 : H - pad - ((v - min) / (max - min)) * (H - pad * 2));
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const [li, lv] = pts[pts.length - 1];
  const hits = pts.map(([i, v]) => `<circle class="hit" cx="${sx(i)}" cy="${sy(v)}" r="8" data-tip="${esc(periods[i])}: ${esc(fmtInd(v, fmt))}"></circle>`).join('');
  return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução"><path d="${d}"/><circle class="pt" cx="${sx(li)}" cy="${sy(lv)}" r="3.5"/>${hits}</svg>`;
}

function renderResumo() {
  const { indicators, periods, fields } = state.res;
  const byId = Object.fromEntries(indicators.map((r) => [r.def.id, r]));
  const kpiIds = ['LC', 'EG', 'RPL', 'ML', 'CFC', 'ME'];
  const kpis = kpiIds.map((id) => {
    const r = byId[id];
    const per = r.last >= 0 ? periods[r.last] : '';
    return `<div class="kpi">
      <div class="k-label">${esc(r.def.name)} (${r.def.id})</div>
      <div class="k-value">${esc(r.latestText)}${r.last >= 0 && r.notes[r.last].length ? `<sup class="small muted" data-tip="${esc(r.notes[r.last].join(' • '))}">*</sup>` : ''}</div>
      <div class="k-foot">${chip(r.status)} ${trend(r.trend)} <span>${esc(per)}</span></div>
    </div>`;
  }).join('');

  const obj = OBJECTIVES.find((o) => o.id === state.objective);
  const order = { ruim: 0, atencao: 1, bom: 2 };
  const diag = obj.groups.map((gid) => {
    const g = GROUPS.find((x) => x.id === gid);
    const items = indicators.filter((r) => r.def.group === gid && r.latest !== null)
      .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    if (!items.length) return `<div class="diag-group"><h3>${esc(g.title)}</h3><p class="muted small">Sem dados suficientes.</p></div>`;
    return `<div class="diag-group"><h3>${esc(g.title)}</h3><ul class="diag-list">${items.map((r) => `
      <li><div>${chip(r.status) || '<span class="chip" style="color:var(--muted)">Info</span>'}</div>
      <div><div class="d-title">${esc(r.def.id)} — ${esc(r.def.name)}: ${esc(r.latestText)} ${trend(r.trend)}</div>
      <div class="d-text">${esc(r.reading)}${r.statusText ? ' ' + esc(r.statusText) : ''}</div></div></li>`).join('')}</ul></div>`;
  }).join('');

  $('#tab-resumo').innerHTML = `
    <div class="kpis">${kpis}</div>
    <div class="two-col">
      <div class="card">
        <div class="objective"><label for="objSel"><strong>Objetivo da análise:</strong></label>
          <select id="objSel">${OBJECTIVES.map((o) => `<option value="${o.id}" ${o.id === state.objective ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
        <p class="muted small">Principais indicadores para este objetivo: ${obj.groups.map((g) => esc(GROUPS.find((x) => x.id === g).title.toLowerCase())).join(', ')}. Leitura do período mais recente; a avaliação intrínseca deve ser complementada pela evolução no tempo e pela média do setor.</p>
        ${diag}
      </div>
      <div class="card">
        <h3>Estrutura patrimonial</h3>
        <p class="muted small">Participação de cada grupo no total (análise vertical do balanço).</p>
        ${structureChart(fields, periods)}
      </div>
    </div>`;
  $('#objSel').addEventListener('change', (e) => { state.objective = e.target.value; renderResumo(); });
}

function structureChart(fields, periods) {
  const segsA = [['AC', 'Ativo circulante', 'ativoCirculante', '--s1'], ['ANC', 'Ativo não circulante', 'ativoNaoCirculante', '--s2']];
  const segsP = [['PC', 'Passivo circulante', 'passivoCirculante', '--s3'], ['PNC', 'Passivo não circulante', 'passivoNaoCirculante', '--s4'], ['PL', 'Patrimônio líquido', 'patrimonioLiquido', '--s5']];
  const legend = [...segsA, ...segsP].map(([, l, , c]) => `<span><i style="background:var(${c})"></i>${esc(l)}</span>`).join('');
  const bar = (segs, i) => {
    const vals = segs.map(([, , k]) => fields[k]?.[i]);
    const tot = vals.reduce((a, v) => a + (v > 0 ? v : 0), 0);
    if (!tot || vals.some((v) => v === null || v === undefined)) return '<div class="muted small">dados insuficientes</div>';
    return `<div class="bar">${segs.map(([s, l, , c], k) => {
      const p = Math.max(vals[k], 0) / tot * 100;
      return p > 0 ? `<div class="seg" style="width:${p}%;background:var(${c})" data-tip="${esc(l)}: ${fmtPct(p)}">${p >= 9 ? `${s} ${fmtNum(p, 0)}%` : ''}</div>` : '';
    }).join('')}</div>`;
  };
  return `<div class="legend">${legend}</div><div class="struct">${periods.map((p, i) => `
    <div class="per">${esc(p)}</div>
    <div class="lab">Ativo</div>${bar(segsA, i)}
    <div class="lab">Passivo + PL</div>${bar(segsP, i)}`).join('')}</div>`;
}

function renderIndicadores() {
  const { indicators, periods } = state.res;
  let html = `<p class="muted small">Clique em um indicador para ver a fórmula, a interpretação e comparar com a média do setor. <span aria-hidden="true">*</span> indica um cálculo com aproximação (passe o mouse para ver).</p>`;
  for (const g of GROUPS) {
    const rows = indicators.filter((r) => r.def.group === g.id);
    html += `<div class="card"><h2>${esc(g.title)}</h2><p class="group-intro">${esc(g.intro)}</p><div class="table-wrap"><table class="grid ind-table">
      <thead><tr><th>Indicador</th>${periods.map((p) => `<th>${esc(p)}</th>`).join('')}<th>Evolução</th><th>Situação</th></tr></thead><tbody>`;
    for (const r of rows) {
      const cells = r.values.map((v, i) => {
        const notes = r.notes[i];
        const miss = r.missing[i];
        if (miss) return `<td class="num muted" data-tip="${esc('Falta: ' + miss.join(', '))}">n/d</td>`;
        const mark = notes.length ? `<sup data-tip="${esc(notes.join(' • '))}">*</sup>` : '';
        return `<td class="num">${esc(fmtInd(v, r.def.fmt))}${mark}</td>`;
      }).join('');
      html += `<tr class="ind-row" data-ind="${r.def.id}" tabindex="0" aria-expanded="false">
        <td class="name"><span class="sigla">${esc(r.def.id)}</span>${esc(r.def.name)}<span class="better">${betterText(r.def.better)}</span></td>
        ${cells}<td>${sparkline(r.values, r.def.fmt, periods)}${trend(r.trend)}</td><td>${chip(r.status)} ${sectorCompare(r)}</td></tr>`;
      const allNotes = [...new Set(r.notes.flat())];
      const missAll = [...new Set(r.missing.filter(Boolean).flat())];
      const sv = state.sector[r.def.id];
      html += `<tr class="ind-detail" data-det="${r.def.id}" hidden><td colspan="${periods.length + 3}"><div class="det">
        <div><div><strong>Fórmula</strong></div><div class="formula">${esc(r.def.id)} = ${esc(r.def.formula)}</div>
          <p style="margin-top:8px"><strong>Como ler (${esc(r.last >= 0 ? periods[r.last] : '—')}):</strong> ${esc(r.reading || 'sem dados suficientes.')}</p>
          ${r.statusText ? `<p>${chip(r.status)} ${esc(r.statusText)}</p>` : ''}</div>
        <div>${allNotes.length ? `<strong>Observações do cálculo</strong><ul>${allNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
          ${missAll.length ? `<strong>Dados faltantes</strong><ul>${missAll.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
          <label>Média do setor ${r.def.fmt === 'pct' ? '(%)' : r.def.fmt === 'dias' ? '(dias)' : r.def.fmt === 'meses' ? '(meses)' : ''}:
            <input inputmode="decimal" data-sector="${r.def.id}" value="${sv !== undefined ? esc(fmtInput(sv)) : ''}" placeholder="opcional"> ${sectorCompare(r)}</label></div>
      </div></td></tr>`;
    }
    html += '</tbody></table></div></div>';
  }
  const el = $('#tab-indicadores');
  el.innerHTML = html;
}

function initIndicatorEvents() {
  const el = $('#tab-indicadores');
  const toggle = (row) => {
    const det = $(`tr[data-det="${row.dataset.ind}"]`, el);
    det.hidden = !det.hidden;
    row.classList.toggle('open', !det.hidden);
    row.setAttribute('aria-expanded', String(!det.hidden));
  };
  el.addEventListener('click', (e) => { const row = e.target.closest('tr.ind-row'); if (row) toggle(row); });
  el.addEventListener('keydown', (e) => {
    const row = e.target.closest('tr.ind-row');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(row); }
  });
  el.addEventListener('change', (e) => {
    const inp = e.target.closest('input[data-sector]');
    if (!inp) return;
    const v = parseNum(inp.value);
    if (v === null) delete state.sector[inp.dataset.sector]; else state.sector[inp.dataset.sector] = v;
    const open = $$('tr.ind-row.open', el).map((r) => r.dataset.ind);
    renderIndicadores();
    open.forEach((id) => toggle($(`tr.ind-row[data-ind="${id}"]`, el)));
    renderResumo();
  });
}

function renderDupont() {
  const { dupont, periods } = state.res;
  const li = dupont.map((d, i) => (d.roe !== null ? i : -1)).filter((i) => i >= 0).pop();
  const pctF = (v) => fmtInd(v, 'pct');
  let eq = '<p class="muted">Dados insuficientes (necessário: lucro líquido, receita líquida, ativo total e patrimônio líquido).</p>';
  if (li !== undefined) {
    const d = dupont[li];
    eq = `<p class="muted small">Período ${esc(periods[li])}</p><div class="dupont-eq">
      <div class="box"><b>${pctF(d.ml)}</b><span>Margem líquida<br>Lucro líquido ÷ Vendas</span></div><span class="op">×</span>
      <div class="box"><b>${fmtInd(d.giro, 'vezes')}</b><span>Giro do ativo<br>Vendas ÷ Ativo</span></div><span class="op">=</span>
      <div class="box result"><b>${pctF(d.roa)}</b><span>Retorno sobre ativos<br>(ROA)</span></div><span class="op">×</span>
      <div class="box"><b>${fmtInd(d.alav, 'vezes')}</b><span>Multiplicador de alavancagem<br>Ativo ÷ PL</span></div><span class="op">=</span>
      <div class="box result"><b>${pctF(d.roe)}</b><span>Retorno sobre o PL<br>(ROE)</span></div></div>`;
  }
  const rows = [['Margem líquida', 'ml', 'pct'], ['Giro do ativo', 'giro', 'vezes'], ['Retorno sobre ativos (ROA)', 'roa', 'pct'], ['Multiplicador de alavancagem financeira', 'alav', 'vezes'], ['Retorno sobre o PL (ROE)', 'roe', 'pct']];
  $('#tab-dupont').innerHTML = `<div class="card"><h2>Análise DuPont</h2>
    <p class="group-intro">Decompõe o retorno sobre o patrimônio líquido em lucratividade das vendas (margem), eficiência no uso dos ativos (giro) e alavancagem financeira: ROE = Margem líquida × Giro do ativo × (Ativo ÷ PL).</p>
    ${eq}
    <div class="table-wrap"><table class="grid"><thead><tr><th>Componente</th>${periods.map((p) => `<th>${esc(p)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(([l, k, f]) => `<tr class="${k === 'roe' || k === 'roa' ? 'strong' : ''}"><td>${l}</td>${dupont.map((d) => `<td class="num">${fmtInd(d[k], f)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <p class="muted small" style="margin-top:8px">O modelo DuPont usa o ativo total do fim do período; o RAT da aba Indicadores usa o ativo total médio, por isso os valores podem diferir.</p></div>`;
}

function statementControls(kind) {
  const hasFile = state.res.fileRows.length > 0;
  const hasCodes = state.res.fileRows.some((r) => r.code);
  let h = '<div class="row gap no-print" style="margin-bottom:12px">';
  if (hasFile) {
    h += `<label>Contas: <select data-ctl="vSource"><option value="arquivo" ${state.vSource === 'arquivo' ? 'selected' : ''}>do arquivo enviado</option><option value="padrao" ${state.vSource === 'padrao' ? 'selected' : ''}>estrutura padronizada (dados revisados)</option></select></label>`;
  }
  if (hasCodes && state.vSource === 'arquivo') {
    h += `<label><input type="checkbox" data-ctl="shallow" ${state.shallow ? 'checked' : ''}> Mostrar só contas até o 3º nível</label>`;
  }
  if (kind === 'h') {
    h += `<label>Comparar com: <select data-ctl="hMode"><option value="anterior" ${state.hMode === 'anterior' ? 'selected' : ''}>período anterior</option><option value="base" ${state.hMode === 'base' ? 'selected' : ''}>primeiro período (base fixa)</option></select></label>`;
  }
  return h + '</div>';
}

function statementRows() {
  const useFile = state.vSource === 'arquivo' && state.res.fileRows.length;
  let rows = useFile ? state.res.fileRows : state.res.stdRows;
  if (useFile && state.shallow && rows.some((r) => r.code)) rows = rows.filter((r) => !r.code || r.depth <= 3);
  return rows;
}

function statementTable(rows, periods, kind) {
  let html = '';
  for (const sec of ['ativo', 'passivo', 'dre']) {
    const rs = rows.filter((r) => r.section === sec);
    if (!rs.length) continue;
    const head = kind === 'v'
      ? periods.map((p) => `<th>${esc(p)}</th><th>AV%</th>`).join('')
      : periods.map((p, i) => `<th>${esc(p)}</th>${i ? `<th>AH%</th>` : ''}`).join('');
    html += `<div class="card"><h2>${SECTION_TITLES[sec]}</h2><div class="table-wrap"><table class="grid"><thead><tr><th>Conta</th>${head}</tr></thead><tbody>`;
    for (const r of rs) {
      const indent = r.depth ? Math.max(0, r.depth - 1) * 12 : 0;
      const cls = r.heading ? 'heading' : r.strong || r.depth === 1 ? 'strong' : '';
      const cells = r.values.map((v, i) => {
        const p = r.pct[i];
        const pc = p === null ? '—' : fmtPct(p);
        const sign = kind === 'h' && p !== null ? (p > 0 ? 'pos' : p < 0 ? 'neg' : '') : '';
        if (kind === 'v') return `<td class="num">${r.heading ? '' : fmtMoney(v)}</td><td class="num pct">${r.heading ? '' : pc}</td>`;
        return `<td class="num">${r.heading ? '' : fmtMoney(v)}</td>${i ? `<td class="num pct ${sign}">${r.heading ? '' : pc}</td>` : ''}`;
      }).join('');
      html += `<tr class="${cls}"><td style="padding-left:${8 + indent}px">${r.code ? `<span class="muted small">${esc(r.code)}</span> ` : ''}${esc(r.label)}</td>${cells}</tr>`;
    }
    html += '</tbody></table></div></div>';
  }
  return html || '<p class="muted">Sem contas para exibir.</p>';
}

function renderVertical() {
  const { periods, bases } = state.res;
  const rows = vertical(statementRows(), bases);
  $('#tab-vertical').innerHTML = `<p class="group-intro">Composição percentual de cada conta em relação a uma base (100%): o <strong>ativo total</strong> no balanço e a <strong>${bases.dreLabel}</strong> na DRE. Mostra a estrutura da empresa em cada período.</p>
    ${statementControls('v')}${statementTable(rows, periods, 'v')}`;
}

function renderHorizontal() {
  const { periods } = state.res;
  const rows = horizontal(statementRows(), state.hMode);
  $('#tab-horizontal').innerHTML = `<p class="group-intro">Variação percentual de cada conta ${state.hMode === 'base' ? 'em relação ao primeiro período da série (base fixa)' : 'em relação ao período anterior'}, para caracterizar tendências. Compare com a inflação, o crescimento do setor e da economia.</p>
    ${periods.length < 2 ? '<div class="notice warn">A análise horizontal precisa de pelo menos dois períodos.</div>' : ''}
    ${statementControls('h')}${statementTable(rows, periods, 'h')}`;
}

function initStatementEvents() {
  for (const id of ['#tab-vertical', '#tab-horizontal']) {
    $(id).addEventListener('change', (e) => {
      const ctl = e.target.dataset.ctl;
      if (!ctl) return;
      if (ctl === 'shallow') state.shallow = e.target.checked; else state[ctl] = e.target.value;
      renderVertical();
      renderHorizontal();
    });
  }
}

function renderDados() {
  const { periods, fields, derived } = state.res;
  const srcOf = (k) => state.sources[k] || '';
  let html = `<div class="card"><h2>Dados usados no cálculo</h2><div class="table-wrap"><table class="grid"><thead><tr><th>Campo</th><th>Origem</th>${periods.map((p) => `<th>${esc(p)}</th>`).join('')}</tr></thead><tbody>`;
  for (const f of FIELDS) {
    if (fields[f.key].every((v) => v === null)) continue;
    html += `<tr><td>${esc(f.label)}</td><td class="src" data-tip="${esc(srcOf(f.key))}">${esc(srcOf(f.key))}</td>${fields[f.key].map((v) => `<td class="num">${fmtMoney(v)}</td>`).join('')}</tr>`;
  }
  html += `</tbody></table></div></div><div class="card"><h2>Valores derivados</h2><div class="table-wrap"><table class="grid"><thead><tr><th>Item</th>${periods.map((p) => `<th>${esc(p)}</th>`).join('')}</tr></thead><tbody>`;
  for (const d of derived) html += `<tr><td>${esc(d.label)}</td>${d.values.map((v) => `<td class="num">${fmtMoney(v)}</td>`).join('')}</tr>`;
  html += `</tbody></table></div><p class="muted small" style="margin-top:8px">Parâmetros: vendas a prazo ${state.params.pctVendasPrazo}% · compras a prazo ${state.params.pctComprasPrazo}% · ano de ${state.params.dias} dias.</p></div>`;
  $('#tab-dados').innerHTML = html;
}

// ───────── Exportação ─────────
async function exportExcel() {
  const XLSX = await getXLSX();
  const { periods, indicators, dupont, fields, derived, bases } = state.res;
  const num = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : v);
  const wb = XLSX.utils.book_new();
  const ind = [['Grupo', 'Sigla', 'Indicador', 'Fórmula', 'Unidade', ...periods, 'Sentido', 'Situação', 'Leitura (último período)']];
  for (const r of indicators) {
    const g = GROUPS.find((x) => x.id === r.def.group).title;
    const unit = { pct: '%', dias: 'dias', meses: 'meses', vezes: 'vezes', x: 'índice' }[r.def.fmt];
    ind.push([g, r.def.id, r.def.name, r.def.formula, unit, ...r.values.map((v) => (v === null ? null : r.def.fmt === 'pct' ? v * 100 : v)), betterText(r.def.better), STATUS_LABEL[r.status] || '', r.reading || '']);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ind), 'Indicadores');
  const dp = [['Componente', ...periods]];
  [['Margem líquida (%)', 'ml', 100], ['Giro do ativo', 'giro', 1], ['ROA (%)', 'roa', 100], ['Alavancagem (Ativo/PL)', 'alav', 1], ['ROE (%)', 'roe', 100]]
    .forEach(([l, k, m]) => dp.push([l, ...dupont.map((d) => (d[k] === null ? null : d[k] * m))]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dp), 'DuPont');
  const st = (kind) => {
    const rows = kind === 'v' ? vertical(statementRows(), bases) : horizontal(statementRows(), state.hMode);
    const head = ['Seção', 'Conta', ...periods.flatMap((p, i) => (kind === 'v' ? [p, `AV% ${p}`] : i ? [p, `AH% ${p}`] : [p]))];
    return [head, ...rows.map((r) => [SECTION_TITLES[r.section], (r.code ? r.code + ' ' : '') + r.label,
      ...r.values.flatMap((v, i) => (kind === 'v' ? [num(v), num(r.pct[i])] : i ? [num(v), num(r.pct[i])] : [num(v)]))])];
  };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(st('v')), 'Análise vertical');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(st('h')), 'Análise horizontal');
  const dd = [['Campo', 'Origem', ...periods], ...FIELDS.map((f) => [f.label, state.sources[f.key] || '', ...fields[f.key].map(num)]), [], ['Valores derivados', '', ...periods], ...derived.map((d) => [d.label, '', ...d.values.map(num)])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dd), 'Dados');
  const safe = state.dataset.name.replace(/[^\w\- ]+/g, ' ').trim().slice(0, 40) || 'analise';
  XLSX.writeFile(wb, `analise-${safe}.xlsx`);
}

function initResults() {
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('#btnExcel').addEventListener('click', () => exportExcel().catch((err) => alert(err.message)));
  $('#btnPrint').addEventListener('click', () => {
    const tabs = $$('.tab-panel');
    tabs.forEach((t) => { t.hidden = false; });
    window.print();
    setTab(state.tab);
  });
  initIndicatorEvents();
  initStatementEvents();
}

initTheme();
initTooltip();
initUpload();
initReview();
initResults();
go('upload');

// Exposto para depuração no console.
window.__analise = { state, INDICATORS, INDICATOR_BY_ID, FIELD_BY_KEY };
