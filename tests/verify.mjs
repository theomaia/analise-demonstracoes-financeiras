// Verifica os cálculos com os dados de exemplo (node tests/verify.mjs).
import { sampleDataset } from '../js/sample.js';
import { annotate, mapFields } from '../js/mapping.js';
import { computeIndicators, computeDupont } from '../js/indicators.js';
import { PARAM_DEFAULTS } from '../js/model.js';
import { parseNum } from '../js/util.js';

let fails = 0;
const check = (name, got, exp, tol = 0.01) => {
  const ok = got !== null && Math.abs(got - exp) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got} (esperado ${exp})`);
};

// Números
check('parseNum (1.234,5)', parseNum('(1.234,5)'), -1234.5);
check('parseNum 1.234.567', parseNum('1.234.567'), 1234567);
check('parseNum -26.319', parseNum('-26.319'), -26319);
check('parseNum CVM', parseNum('1234.5600000000'), 1234.56);

const ds = sampleDataset();
annotate(ds.rows);
const { fields, sources } = mapFields(ds);
for (const [k, v] of Object.entries(fields)) console.log(k.padEnd(24), JSON.stringify(v), '←', sources[k] || '');

check('ANC x3 (derivado)', fields.ativoNaoCirculante[0], 127137);
check('PNC x5', fields.passivoNaoCirculante[2], 6045);
check('Empréstimos LP x5', fields.emprestimosLP[2], 6045);

const ind = Object.fromEntries(computeIndicators(fields, ds.periods, PARAM_DEFAULTS).map((r) => [r.def.id, r]));
const v = (id, i = 2) => ind[id].values[i];
check('NE x5', v('NE'), 56028 / 250362, 1e-6);
check('LC x5', v('LC'), 205632 / 49983, 1e-6);
check('LS x5', v('LS'), (205632 - 67922) / 49983, 1e-6);
check('LI x5', v('LI'), (5720 + 21288) / 49983, 1e-6);
check('LG x5', v('LG'), (205632 + 15178) / 56028, 1e-6);
check('IPL x5', v('IPL'), 85580 / 250362, 1e-6);
check('IRNC x5', v('IRNC'), 85580 / (250362 + 6045), 1e-6);
check('RPL x5', v('RPL'), 9545 / 250362, 1e-6);
check('RAT x5', v('RAT'), 9545 / ((317269 + 306390) / 2), 1e-6);
check('GAT x5', v('GAT'), 263307 / ((317269 + 306390) / 2), 1e-6);
check('ML x5', v('ML'), 9545 / 263307, 1e-6);
check('ENV x5', v('ENV'), (263307 - 326050) / 326050, 1e-6);
check('PMRV x5', v('PMRV'), ((94284 + 84611) / 2) * 360 / 355135, 1e-6);
check('PMRE x5', v('PMRE'), ((71653 + 67922) / 2) * 360 / 177001, 1e-6);
check('PMPC x5', v('PMPC'), ((23782 + 15046) / 2) * 360 / (177001 + 67922 - 71653), 1e-6);
check('CFC x5', v('CFC'), v('PMRV') + v('PMRE') - v('PMPC'), 1e-6);
check('EOE x5', v('EOE'), 6045 / 56028, 1e-6);
check('ENV x3 (sem anterior)', v('ENV', 0) === null ? 0 : 1, 0);
const dp = computeDupont(fields, 3)[2];
check('DuPont ROE = RPL', dp.roe, v('RPL'), 1e-9);

// Exemplo de prazos médios calculado à mão (PME 60, PMR 20, PMPF ≈ 26,7)
const f2 = { estoques: [45000, 65000], fornecedores: [24000, 28000], cpv: [null, 330000], receitaBruta: [null, 900000], contasReceber: [30000, 50000] };
const ind2 = Object.fromEntries(computeIndicators(f2, ['2024', '2025'], { ...PARAM_DEFAULTS, pctVendasPrazo: 80 }).map((r) => [r.def.id, r]));
check('PME', ind2.PMRE.values[1], 60);
check('PMR', ind2.PMRV.values[1], 20);
check('PMPF', ind2.PMPC.values[1], 26000 * 360 / 350000, 1e-6);
check('Giro dos estoques', ind2.GE.values[1], 6);
check('Giro das duplicatas', ind2.GDR.values[1], 18);

console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
