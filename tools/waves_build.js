// Converte as leituras do Waves (um .txt por pico, gerado por tools/waves_extract.js) em waves.json.
// Uso: node tools/waves_build.js <pasta-com-txt> <ano> <mes> [arquivo-mares]  -> grava waves.json na raiz.
const fs = require('fs'), path = require('path');
const [dir, year, month, tidesFile] = process.argv.slice(2);
const PICOS = [
  ['joaquina', 'Joaquina'], ['mole-gravata', 'Mole (Gravatá)'], ['mole', 'Mole'], ['novo-campeche', 'Novo Campeche'],
  ['barra-da-lagoa', 'Barra da Lagoa'], ['camping-da-barra', 'Camping da Barra'], ['campeche', 'Campeche'],
  ['morro-das-pedras', 'Morro das Pedras'], ['praia-do-caldeirao', 'Praia do Caldeirão'], ['mocambique-meio', 'Moçambique Meio'], ['mocambique', 'Moçambique']
];
const out = { year: +year, month: +month, d0: null, picos: [], tides: {} };
for (const [slug, name] of PICOS) {
  const f = path.join(dir, slug + '.txt'); if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');
  const dl = txt.split('\n').find(l => l.startsWith('D')), jl = txt.split('\n').find(l => l.startsWith('J'));
  if (!dl) continue;
  const parts = dl.split('|'), d0 = +parts[0].slice(1);
  const rows = parts.slice(1).map(r => { if (r === 'x') return null; const a = r.split(','); return [+a[0] / 10, +a[1] / 10, a[2], +a[3], a[4]]; });
  if (rows.filter(Boolean).length < 21) continue;
  if (out.d0 == null) out.d0 = d0;
  const today = jl ? jl.slice(2).trim().split(/\s+/).map(x => { const a = x.split(','); return [+a[0], +a[1]]; }) : [];
  out.picos.push({ slug, name, d0, rows, today });
}
if (tidesFile && fs.existsSync(tidesFile)) {
  for (const l of fs.readFileSync(tidesFile, 'utf8').trim().split('\n')) {
    const a = l.trim().split(/\s+/); out.tides[+a[0]] = a.slice(1).map(x => { const b = x.split(','); return [b[0], +b[1]]; });
  }
}
const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const p = n => (n < 10 ? '0' : '') + n;
out.updated = p(now.getDate()) + '/' + p(now.getMonth() + 1) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes());
if (out.picos.length < 6) { console.error('Poucos picos lidos: ' + out.picos.length); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '..', 'waves.json'), JSON.stringify(out));
console.log('ok', out.picos.length, 'picos', out.updated);
