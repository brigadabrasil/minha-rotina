// Minha Rotina · Surf
// 1) Busca a previsão do Open-Meteo e grava no Google Docs "surf-floripa-dados".
// 2) Lê as notas oficiais de hoje dos picos de Florianópolis no waves.com.br e guarda.
// 3) Publica as notas do Waves num link (Web App) que o app do celular lê.
// Uso: cole tudo, salve, rode "instalar" uma vez (autorize) e depois Implantar > Nova implantação > App da Web.

var MU = 'https://marine-api.open-meteo.com/v1/marine?latitude=-27.63&longitude=-48.40&hourly=wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,sea_level_height_msl,sea_surface_temperature&timezone=America%2FSao_Paulo&forecast_days=7';
var WU = 'https://api.open-meteo.com/v1/forecast?latitude=-27.60&longitude=-48.47&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover&current=wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=America%2FSao_Paulo&forecast_days=7';
var NOME = 'surf-floripa-dados';

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('atualizar').timeBased().everyHours(1).create();
  atualizar();
}

function atualizar() {
  try { atualizarWaves(); } catch (e) { console.log('Waves: ' + e); }
  var M = JSON.parse(UrlFetchApp.fetch(MU).getContentText());
  var W = JSON.parse(UrlFetchApp.fetch(WU).getContentText());
  var d = buildDays(M, W);
  if (!d.days || d.days.length < 3) throw new Error('Dados incompletos');
  var it = DriveApp.getFilesByName(NOME), doc;
  doc = it.hasNext() ? DocumentApp.openById(it.next().getId()) : DocumentApp.create(NOME);
  doc.getBody().setText('SURFDATA ' + JSON.stringify(d) + ' FIMSURF');
  doc.saveAndClose();
}

function buildDays(M, W) {
  var CARD = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  function cardOf(d) { return CARD[Math.round(((d % 360) + 360) % 360 / 22.5) % 16]; }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace('-', '−'); }
  function ang(a, b) { var d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; }
  function avg(a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0) / a.length; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var SPOTS = [
    { name: 'Joaquina', swell: 120, face: 100, note: 'aguenta tamanho' },
    { name: 'Praia Mole', swell: 105, face: 95, note: 'ondas cavadas' },
    { name: 'Campeche', swell: 150, face: 120, note: 'melhor com SE/S' },
    { name: 'Santinho', swell: 65, face: 70, note: 'protegido do S, bom para longboard' },
    { name: 'Moçambique', swell: 70, face: 80, note: 'exposto ao vento, melhor cedo' }
  ];
  var CONDS = ['Ruim', 'Ruim', 'Regular', 'Boa', 'Muito boa', 'Clássica'];
  var mh = M.hourly, wh = W.hourly, dl = W.daily, now = new Date(Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss"));
  var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var nDays = Math.min(dl.time.length, Math.floor(mh.wave_height.length / 24));
  function kind(x) { var d = ((x.windDir % 360) + 360) % 360; return d >= 200 && d <= 340 ? 'terral' : (ang(d, 90) <= 60 ? 'maral' : 'lateral'); }
  var days = [];
  for (var di = 0; di < nDays; di++) {
    var base = di * 24, date = dl.time[di], isToday = date === today;
    var hours = [6, 8, 10, 12, 14, 16, 18].map(function (h) {
      var i = base + h;
      return { h: pad(h) + 'h', swell: Math.round(mh.swell_wave_height[i] * 10) / 10, swellDir: mh.swell_wave_direction[i], swellPer: Math.round(mh.swell_wave_period[i] * 10) / 10, wind: Math.round(wh.wind_speed_10m[i]), gust: Math.round(wh.wind_gusts_10m[i]), windDir: wh.wind_direction_10m[i], rain: Math.round(((wh.precipitation[i] || 0) + (wh.precipitation[i + 1] || 0)) * 10) / 10, cloud: wh.cloud_cover[i] };
    });
    var waves = mh.wave_height.slice(base + 6, base + 19);
    var wmin = Math.min.apply(null, waves), wmax = Math.max.apply(null, waves);
    var start = base + Math.max(5, isToday ? now.getHours() : 0), sl = mh.sea_level_height_msl, tides = [];
    for (var j = Math.max(1, start); j < sl.length - 1 && tides.length < 2; j++) {
      var hh = pad(j % 24) + ':00' + (j >= base + 24 ? ' (+1)' : '');
      if (sl[j] < sl[j - 1] && sl[j] <= sl[j + 1]) tides.push({ k: 'MARÉ BAIXA', v: hh, s: f1(sl[j]) + ' m' });
      else if (sl[j] > sl[j - 1] && sl[j] >= sl[j + 1]) tides.push({ k: 'MARÉ ALTA', v: hh, s: f1(sl[j]) + ' m' });
    }
    var morning = hours.slice(0, 3), aft = hours.slice(4);
    var mSw = avg(morning, function (x) { return x.swell; }), mPer = avg(morning, function (x) { return x.swellPer; }), mDir = morning[1].swellDir;
    var picos = SPOTS.map(function (sp) {
      var sc = 1, dd = ang(mDir, sp.swell);
      sc += dd <= 35 ? 1.5 : (dd <= 70 ? 0.7 : 0);
      sc += Math.min(1.5, mSw / 0.8 * 0.75) + (mPer >= 10 ? 1 : (mPer >= 8 ? 0.5 : 0));
      sc += avg(morning, function (x) { var off = ang(x.windDir, (sp.face + 180) % 360); return x.wind < 8 ? 0.3 : (off <= 60 ? 0.6 : (ang(x.windDir, sp.face) <= 60 ? -0.8 : -0.2)); });
      if (sp.name === 'Santinho' && ang(morning[1].windDir, 180) <= 40) sc += 0.4;
      if (sp.name === 'Moçambique' && avg(morning, function (x) { return x.wind; }) > 15) sc -= 0.6;
      if (sp.name === 'Campeche' && ang(morning[1].windDir, 45) <= 35) sc -= 0.5;
      var why = 'Swell ' + cardOf(mDir) + (dd <= 35 ? ' entra bem' : (dd <= 70 ? ' entra de lado' : ' quase não entra')) + ' · ' + sp.note;
      return { name: sp.name, score: Math.max(1, Math.min(5, Math.round(sc))), note: why, raw: sc };
    }).sort(function (a, b) { return b.raw - a.raw; });
    var mk = kind(morning[0]), ak = kind(aft[aft.length - 1]);
    var dayRain = wh.precipitation.slice(base, base + 24).reduce(function (s, x) { return s + (x || 0); }, 0);
    var summary = 'Manhã ' + mk + ' (' + cardOf(morning[0].windDir) + ' ' + morning[0].wind + ' km/h)' + (ak !== mk ? ' · à tarde vira ' + ak + ' (' + cardOf(aft[aft.length - 1].windDir) + ')' : ' · tarde parecida') + (dayRain >= 1 ? ' · chuva ' + f1(dayRain) + ' mm no dia' : ' · sem chuva');
    var wi = isToday && W.current ? null : base + 8;
    var windTxt = wi === null ? cardOf(W.current.wind_direction_10m) + ' ' + Math.round(W.current.wind_speed_10m) + ' km/h' : cardOf(wh.wind_direction_10m[wi]) + ' ' + Math.round(wh.wind_speed_10m[wi]) + ' km/h';
    days.push({
      date: date, waveRange: f1(wmin) + '–' + f1(wmax) + ' m', condition: CONDS[picos[0].score], swellTxt: cardOf(mDir) + ' · ' + Math.round(mPer) + ' s',
      windTxt: windTxt, water: f1(mh.sea_surface_temperature[base + (isToday ? now.getHours() : 8)]) + ' °C', summary: summary, hours: hours, tides: tides,
      sunrise: (dl.sunrise[di] || '').slice(11, 16), sunset: (dl.sunset[di] || '').slice(11, 16),
      picos: picos.map(function (p) { return { name: p.name, score: p.score, note: p.note }; })
    });
  }
  return { updated: pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()), days: days };
}


// ---------- Waves (notas oficiais de hoje) ----------
var WV_PICOS = [
  ['joaquina', 'Joaquina'], ['mole-gravata', 'Mole (Gravatá)'], ['mole', 'Mole'], ['novo-campeche', 'Novo Campeche'],
  ['barra-da-lagoa', 'Barra da Lagoa'], ['camping-da-barra', 'Camping da Barra'], ['campeche', 'Campeche'],
  ['morro-das-pedras', 'Morro das Pedras'], ['praia-do-caldeirao', 'Praia do Caldeirão'], ['mocambique-meio', 'Moçambique Meio'], ['mocambique', 'Moçambique']
];
function atualizarWaves() {
  var picos = [];
  WV_PICOS.forEach(function (p) {
    try {
      var r = UrlFetchApp.fetch('https://www.waves.com.br/surf/ondas/picos/sc/florianopolis/' + p[0] + '/', { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (MinhaRotina; uso pessoal)' } });
      if (r.getResponseCode() !== 200) return;
      var h = r.getContentText(), m = h.match(/data-mark="janelas-payload"[^>]*>([\s\S]*?)<\//);
      if (!m) return;
      var j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      picos.push({ slug: p[0], name: p[1], today: j.janelas.map(function (x) {
        return [parseInt(x.horario, 10), x.nota, x.swellAlturaMin, x.swellAlturaMax, x.swellPeriodo, x.swellDirecao, x.ventoVelocidade, x.ventoDirecao, x.ventoTipo];
      }) });
    } catch (e) { console.log(p[0] + ': ' + e); }
  });
  if (picos.length < 6) throw new Error('Poucos picos lidos do Waves: ' + picos.length);
  var now = new Date();
  var out = { date: Utilities.formatDate(now, 'America/Sao_Paulo', 'yyyy-MM-dd'), updated: Utilities.formatDate(now, 'America/Sao_Paulo', 'dd/MM HH:mm'), picos: picos };
  PropertiesService.getScriptProperties().setProperty('WAVES_HOJE', JSON.stringify(out));
  return out;
}

// Link que o app lê: Implantar > Nova implantação > Tipo "App da Web" > Executar como "Eu" > Acesso "Qualquer pessoa".
function doGet() {
  var s = PropertiesService.getScriptProperties().getProperty('WAVES_HOJE');
  if (!s) { try { s = JSON.stringify(atualizarWaves()); } catch (e) { s = JSON.stringify({ erro: String(e) }); } }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
