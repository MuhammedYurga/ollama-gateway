let cfg = null, tab = 'genel', modelMode = 'local', modeSel = 'local';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => n == null ? '?' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n);
const hm = t => { try { return new Date(t).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); } catch(_) { return ''; } };

// Şifre yalnızca sekme oturumunda tutulur; kalıcı depoya yazılmaz.
async function api(ep, o = {}, retry = true) {
  const h = {'content-type':'application/json'};
  const t = sessionStorage.getItem('gwToken');
  if (t) h['x-admin-token'] = t;
  const r = await fetch(ep, {...o, headers:h});
  if (r.status === 401 && retry) {
    const p = prompt('Panel şifresi:');
    if (p === null) throw new Error('şifre gerekli');
    sessionStorage.setItem('gwToken', p);
    return api(ep, o, false);
  }
  if (!r.ok) throw new Error((await r.text()) || ('HTTP ' + r.status));
  return r.json();
}

function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg;
  t.style.borderColor = ok ? 'var(--ac)' : 'var(--bad)';
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 2600);
}

async function postConfig(partial) {
  if (partial) cfg = {...cfg, ...partial};
  const r = await api('/admin/api/config', {method:'POST', body: JSON.stringify(cfg)});
  cfg = r.config;
  if (r.warnings && r.warnings.length) toast('Kaydedildi. Uyarı: ' + r.warnings.join(' | '));
  else toast('Kaydedildi');
  return r;
}
function chip(el, txt, cls) {
  el.textContent = txt;
  el.className = 'chip' + (cls ? ' ' + cls : '');
}
function modeWord(m) { return m === 'cloud' ? 'bulut' : 'yerel'; }

function cloudUsesPlainHttp(url) {
  return /^http:\/\//i.test(url || '') && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(url || '');
}

function applyModeUI() {
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === modeSel));
  $('localFields').hidden = modeSel === 'cloud';
  $('cloudFields').hidden = modeSel !== 'cloud';
  $('clKeyClearRow').hidden = !(modeSel === 'cloud' && cfg.cloud.apiKeySet);
  if (modeSel === 'cloud') {
    let note = cfg.cloud.apiKeySet
      ? 'İstekler ' + (cfg.cloud.baseUrl || 'ollama.com') + ' adresine, kayıtlı API anahtarıyla gider.'
      : 'Anahtar yok: bulut isteği 401 döner. Aşağıya anahtarı yazıp kaydet.';
    if (cloudUsesPlainHttp($('clUrl').value)) {
      note += ' Dikkat: http adresi kullanıyorsun, API anahtarı şifresiz gider.';
    }
    $('modeNote').textContent = note;
  } else {
    $('modeNote').textContent = 'İstekler doğrudan yerel Ollama daemon\'ına gider.';
  }
}

async function refreshStatus() {
  try {
    const s = await api('/admin/api/status');
    chip($('cMode'), modeWord(s.mode), 'mode');
    chip($('cOllama'), (s.upstream.label || 'bağlantı') + (s.upstream.up === true ? ' bağlı' : (s.upstream.up === false ? ' bağlı değil' : ' ?')),
      s.upstream.up === true ? 'ok' : (s.upstream.up === false ? 'bad' : ''));
    const h = Math.floor(s.uptimeSec / 3600), m = Math.floor((s.uptimeSec % 3600) / 60);
    chip($('cUptime'), h ? (h + ' sa ' + (m % 60) + ' dk') : (m + ' dk'));
    $('cLogout').hidden = !s.adminTokenSet;
    $('foot').textContent = 'ollama-gateway v' + (s.version || '?') + ' · resmî olmayan topluluk aracı';
    $('capNote').textContent = (s.caps && s.caps.paused) ? 'captures sınırı doldu, tam kayıt durdu' : '';
    if (tab !== 'genel') return;
    const t9 = s.stats;
    $('tiles').innerHTML = [
      ['istek', t9.total], ['engellenen', t9.blocked], ['sayım', t9.counted],
      ['hata', t9.errors], ['giriş tokeni', fmt(t9.inTok)], ['çıkış tokeni', fmt(t9.outTok)]
    ].map(x => '<div class="tile"><b>' + esc(x[1]) + '</b><span>' + x[0] + '</span></div>').join('');
    $('tbody').innerHTML = (s.recent || []).map(e =>
      '<tr><td>' + hm(e.t) + '</td><td>' + esc(modeWord(e.m)) + '</td><td>' + (e.mt == null ? '' : esc(e.mt)) + '</td><td>' + (e.inp == null ? '?' : e.inp) + '</td><td>' + (e.out == null ? '?' : e.out) + '</td><td>' + (e.dur == null ? '?' : (+e.dur) + 'ms') + '</td><td>' + esc(e.bucket || '') + '</td><td>' + esc(e.st || '') + '</td></tr>'
    ).join('') || '<tr><td colspan="8" style="color:var(--mut)">henüz istek yok</td></tr>';
  } catch(e) { chip($('cOllama'), 'panel hatası', 'bad'); }
}

async function refreshLog() {
  try {
    const r = await api('/admin/api/log?lines=' + $('logLines').value);
    $('logTail').textContent = r.lines.join('\n') || 'log boş';
    $('logNote').textContent = r.lines.length + ' satır gösteriliyor';
  } catch(e) { $('logTail').textContent = 'log okunamadı: ' + e.message; }
}

async function refreshCaptures() {
  try {
    const r = await api('/admin/api/captures');
    $('capInfo').textContent = r.files.length + ' dosya, toplam ' + fmt(r.total) + ' bayt.' + (r.paused ? ' Sınır dolduğu için tam kayıt durdu.' : '');
  } catch(e) { $('capInfo').textContent = 'okunamadı: ' + e.message; }
}
function guard(fn) {
  return function() {
    fn.apply(null, arguments).catch(e => toast('Hata: ' + e.message, false));
  };
}

function renderModels() {
  const sec = cfg[modelMode] || {};
  $('fallback').value = sec.fallbackModel || '';
  document.querySelectorAll('#mmSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === modelMode));
  $('mmNote').textContent = modelMode === 'cloud'
    ? 'Bulut haritası düzenleniyor: ollama.com API\'sine giden model adları.'
    : 'Yerel harita düzenleniyor: yerel Ollama daemon\'ındaki model adları.';
  $('mrows').innerHTML = '';
  Object.entries(sec.modelMap || {}).forEach(kv => addMRow(kv[0], kv[1]));
}

function addMRow(k, v) {
  const d = document.createElement('div');
  d.className = 'mrow';
  d.innerHTML = '<input type="text" placeholder="claude model adı"><span class="arr">→</span><input type="text" placeholder="ollama modeli"><button class="del">sil</button>';
  d.children[0].value = k || '';
  d.children[2].value = v || '';
  d.children[3].onclick = () => d.remove();
  $('mrows').appendChild(d);
}

function renderRules() {
  $('rrows').innerHTML = '';
  (cfg.blockRules || []).forEach(r => addRRow(r));
}

function addRRow(r) {
  const d = document.createElement('div');
  d.className = 'rrow';
  d.innerHTML = '<input type="checkbox" class="ren"' + (r.enabled === false ? '' : ' checked') + '>' +
    '<input type="text" class="rn" placeholder="ad" value="' + esc(r.name || '') + '">' +
    '<input type="number" class="rmt" placeholder="mt" value="' + (r.maxTokens == null ? '' : esc(r.maxTokens)) + '">' +
    '<input type="text" class="rsys" placeholder="system içinde geçmeli" value="' + esc(r.sysContains || '') + '"><button class="del">sil</button>';
  d.querySelector('.del').onclick = () => d.remove();
  $('rrows').appendChild(d);
}

function fillSettings() {
  $('tFixOn').checked = cfg.titleFix.enabled;
  $('tFixSys').value = cfg.titleFix.sysContains;
  $('tFixMin').value = cfg.titleFix.minTokens;
  $('ctOn').checked = cfg.countTokens.enabled;
  $('ctFactor').value = cfg.countTokens.charsPerToken;
  $('lgOn').checked = cfg.logging.usageLog;
  $('lgCap').value = cfg.logging.fullCapturePerBucket;
  $('lgLimit').value = cfg.logging.capFileLimit;
  $('lgProbe').value = cfg.logging.probeOutValue;
  $('lgPrompt').checked = cfg.logging.promptHeads === true;

  modeSel = cfg.mode === 'cloud' ? 'cloud' : 'local';
  $('olHost').value = cfg.local.host;
  $('olPort').value = cfg.local.port;
  $('clUrl').value = cfg.cloud.baseUrl;
  $('clKey').value = '';
  $('clKey').placeholder = cfg.cloud.apiKeySet ? 'kayıtlı anahtar, değiştirmek için yaz' : 'API anahtarı';
  $('clKeyState').textContent = cfg.cloud.apiKeySet ? '(kayıtlı)' : '(yok)';
  $('clKeyClear').checked = false;
  $('pxPort').value = cfg.port;

  $('pwToken').value = '';
  $('pwToken').placeholder = cfg.admin.tokenSet ? 'kayıtlı şifre, değiştirmek için yaz' : 'panel şifresi (boş = şifresiz)';
  $('pwTokenState').textContent = cfg.admin.tokenSet ? '(kayıtlı)' : '(yok)';
  $('pwTokenClear').checked = false;
  $('pwTokenClearRow').hidden = !cfg.admin.tokenSet;
  $('cLogout').hidden = !cfg.admin.tokenSet;

  applyModeUI();
}

$('modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  modeSel = b.dataset.m;
  applyModeUI();
});
$('mmSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  modelMode = b.dataset.m;
  renderModels();
});
$('cLogout').addEventListener('click', () => {
  sessionStorage.removeItem('gwToken');
  location.reload();
});

async function runUpstreamTest(outEl) {
  const r = await api('/admin/api/upstream/check', {method:'POST'});
  const txt = (r.up ? 'bağlı' : 'bağlı değil') + ' · ' + modeWord(r.mode) + ' · ' + r.label + (r.reason ? ' (' + r.reason + ')' : '') + ' · ' + hm(new Date().toISOString());
  outEl.textContent = txt;
  outEl.style.color = r.up ? 'var(--ok)' : 'var(--bad)';
}

$('btnTest').onclick = guard(() => runUpstreamTest($('testOut')));
$('sTest').onclick = guard(() => runUpstreamTest($('sTestOut')));

$('mAdd').onclick = () => addMRow('', '');
$('rAdd').onclick = () => addRRow({ enabled: true });

$('mSave').onclick = guard(async () => {
  const rows = $('mrows').querySelectorAll('.mrow');
  const map = {};
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i].children;
    const a = c[0].value.trim(), b = c[2].value.trim();
    if (a && b) map[a] = b;
  }
  const patch = {};
  patch[modelMode] = { modelMap: map, fallbackModel: $('fallback').value.trim() };
  await postConfig(patch);
  renderModels();
});

$('rSave').onclick = guard(async () => {
  const rows = $('rrows').querySelectorAll('.rrow');
  const rs = [];
  for (let i = 0; i < rows.length; i++) {
    const q = s => rows[i].querySelector(s).value.trim();
    rs.push({
      name: q('.rn'),
      enabled: rows[i].querySelector('.ren').checked,
      maxTokens: q('.rmt') === '' ? null : Number(q('.rmt')),
      sysContains: q('.rsys')
    });
  }
  await postConfig({ blockRules: rs });
  renderRules();
});

$('aSave').onclick = guard(async () => {
  const lines = $('addon').value.split('\n').map(s => s.trim()).filter(Boolean);
  await postConfig({ systemAddon: lines });
  $('addon').value = (cfg.systemAddon || []).join('\n');
});

$('sSave').onclick = guard(async () => {
  const newToken = $('pwToken').value.trim();
  const patch = {
    mode: modeSel,
    titleFix: { enabled: $('tFixOn').checked, sysContains: $('tFixSys').value.trim(), minTokens: Number($('tFixMin').value) || 1024 },
    countTokens: { enabled: $('ctOn').checked, charsPerToken: Number($('ctFactor').value) || 3.3 },
    logging: {
      usageLog: $('lgOn').checked,
      promptHeads: $('lgPrompt').checked,
      fullCapturePerBucket: Number($('lgCap').value) || 0,
      capFileLimit: Number($('lgLimit').value) || 0,
      probeOutValue: Number($('lgProbe').value) || 0
    },
    local: {
      host: $('olHost').value.trim(),
      port: Number($('olPort').value) || 11434
    },
    cloud: {
      baseUrl: $('clUrl').value.trim(),
      apiKey: $('clKey').value
    },
    port: Number($('pxPort').value) || 8799,
    admin: { token: newToken }
  };
  if ($('clKeyClear').checked) patch.clearApiKey = true;
  if ($('pwTokenClear').checked) patch.clearAdminToken = true;
  await postConfig(patch);
  if (newToken) sessionStorage.setItem('gwToken', newToken);
  if (patch.clearAdminToken) sessionStorage.removeItem('gwToken');
  fillSettings();
  renderModels();
  refreshStatus();
});

$('lgRefresh').onclick = refreshLog;
$('lgClear').onclick = guard(async () => {
  if (!confirm('usage-log içeriği tamamen silinecek. Emin misin?')) return;
  await api('/admin/api/log/clear', {method:'POST'});
  toast('Log temizlendi');
  refreshLog();
});
$('capRefresh').onclick = refreshCaptures;
$('capClear').onclick = guard(async () => {
  if (!confirm('captures içindeki bütün dosyalar silinecek. Emin misin?')) return;
  await api('/admin/api/captures/clear', {method:'POST'});
  toast('Yakalama dosyaları silindi');
  refreshCaptures();
});

$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.t;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  const ids = ['genel','modeller','engelleme','stil','loglar','ayarlar'];
  for (const t of ids) { const sec = $('s-' + t); if (sec) sec.hidden = (t !== tab); }
  if (tab === 'genel') refreshStatus();
  if (tab === 'loglar') { refreshLog(); refreshCaptures(); }
  if (tab === 'modeller') renderModels();
  if (tab === 'engelleme') renderRules();
  if (tab === 'stil') $('addon').value = (cfg.systemAddon || []).join('\n');
});

async function init() {
  cfg = (await api('/admin/api/config')).config;
  if (cfg.mode) modeSel = cfg.mode;
  renderModels();
  renderRules();
  $('addon').value = (cfg.systemAddon || []).join('\n');
  fillSettings();
  refreshStatus();
  refreshCaptures();
  refreshLog();
  setInterval(() => {
    refreshStatus();
    if (tab === 'loglar' && $('logAuto').checked) refreshLog();
  }, 5000);
}

init();
