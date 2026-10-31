'use strict';

// ollama-gateway admin panel.
// English is the source language; Turkish is a full translation. Static text
// lives in panel.html with data-i18n keys, dynamic text goes through t().

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => n == null ? '?' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
const LANGS = ['en', 'tr'];
const TABS = ['overview', 'models', 'filters', 'style', 'logs', 'settings'];

const STR = {
  en: {
    'a11y.skip': 'Skip to content',
    'app.sub': 'A local gateway that lets Anthropic Messages API clients use Ollama models. Saved settings apply without a restart.',
    'app.logout': 'Sign out',
    'tab.overview': 'Overview', 'tab.models': 'Models', 'tab.filters': 'Filters',
    'tab.style': 'Style addon', 'tab.logs': 'Logs', 'tab.settings': 'Settings',
    'mode.local': 'Local', 'mode.cloud': 'Cloud',
    'setup.title': 'Getting started',
    'setup.note': 'Three steps take you from a fresh install to a working client.',
    'setup.step1': '1. Reach the upstream',
    'setup.step2': '2. Map the model name your client sends',
    'setup.step3': '3. Send a test message',
    'setup.run': 'Run the checks',
    'setup.hide': 'Hide',
    'setup.connOk': 'Reachable: {l}',
    'setup.connBad': 'Not reachable: {r}',
    'setup.connUnknown': 'Not checked yet',
    'setup.mapOk': '{n} mapping(s) defined',
    'setup.mapEmpty': 'No mapping yet',
    'setup.msgOk': 'Replied in {ms} ms',
    'setup.msgPending': 'Not tried yet',
    'setup.msgBad': 'Failed: {e}',
    'setup.allOk': 'All checks passed.',
    'client.title': 'Connect a client',
    'client.note': 'Paste this into a terminal. Any client that accepts an Anthropic-compatible base URL works the same way.',
    'client.copy': 'Copy',
    'client.copied': 'Copied',
    'recent.title': 'Recent requests',
    'recent.caption': 'Recent requests seen by the gateway',
    'recent.time': 'Time', 'recent.mode': 'Mode', 'recent.mt': 'Max tokens',
    'recent.in': 'In', 'recent.out': 'Out', 'recent.dur': 'Duration',
    'recent.bucket': 'Bucket', 'recent.result': 'Result',
    'recent.note': 'Counters cover this process only. Full history is in usage-log.txt.',
    'recent.empty': 'No requests yet',
    'tile.requests': 'Requests', 'tile.blocked': 'Blocked', 'tile.counted': 'Token counts',
    'tile.errors': 'Errors', 'tile.in': 'Input tokens', 'tile.out': 'Output tokens',
    'overview.testConn': 'Test the connection',
    'models.title': 'Model maps',
    'models.note': 'Left is the model name your client sends, right is the model the upstream serves. Unmapped names fall back to the fallback model. Local and cloud maps are separate.',
    'models.discover': 'Discover models',
    'models.addRow': 'Add row',
    'models.fallback': 'Fallback model',
    'models.source': 'model name your client sends',
    'models.target': 'model on the upstream',
    'models.delete': 'Remove',
    'models.notFound': 'This model is not in the upstream list',
    'models.mapEmpty': 'No mapping yet. Discover the models and add a row.',
    'models.unknown': '{n} mapping(s) are not in the upstream list',
    'models.ok': 'All mappings match the upstream list',
    'cap.tools': 'tools',
    'cap.noTools': 'no tools',
    'discover.title': 'Models on the upstream',
    'discover.caption': 'Models reported by the upstream',
    'discover.name': 'Name', 'discover.family': 'Family', 'discover.params': 'Parameters',
    'discover.quant': 'Quantization', 'discover.size': 'Size', 'discover.actions': 'Actions',
    'discover.use': 'Use',
    'discover.useNote': '"Use" fills the next empty target field in the map above.',
    'discover.loading': 'Loading...',
    'discover.empty': 'No models reported',
    'discover.checked': '{n} model(s) · checked {t}',
    'discover.filter': 'Filter by name or family',
    'discover.noMatch': 'No model matches the filter',
    'filters.title': 'Request filters',
    'filters.note': 'A matching request is not sent upstream; the client receives a valid empty answer. Off by default. Do not filter requests with max_tokens 8192, because the client session may stop itself.',
    'filters.add': 'Add rule',
    'filters.name': 'name',
    'filters.maxTokens': 'max tokens',
    'filters.systemContains': 'system prompt contains',
    'filters.delete': 'Remove',
    'filters.enabled': 'Rule enabled',
    'style.title': 'Style addon',
    'style.note': 'Instructions appended to the system prompt of every request. Changing them rebuilds the prompt cache once. Empty by default.',
    'style.label': 'Instructions, one per line',
    'style.placeholder': 'one instruction per line',
    'logs.lines': 'Lines',
    'logs.auto': 'Auto refresh',
    'logs.refresh': 'Refresh',
    'logs.clear': 'Clear log',
    'logs.empty': 'the log is empty',
    'logs.lineCount': '{n} line(s)',
    'logs.readError': 'could not read the log: {e}',
    'logs.cleared': 'Log cleared',
    'logs.confirmClear': 'The whole usage-log will be deleted. Continue?',
    'captures.title': 'Capture files',
    'captures.note': 'Full request and response bodies are written here only when body capture is enabled in Settings.',
    'captures.clear': 'Delete all',
    'captures.confirm': 'Every file in captures/ will be deleted. Continue?',
    'captures.info': '{n} file(s), {s} bytes in total.',
    'captures.paused': ' The file limit was reached, so capture stopped.',
    'captures.cleared': 'Capture files deleted',
    'settings.connection': 'Connection',
    'settings.connectionNote': 'Chooses which Ollama the requests go to. Saving applies immediately; the gateway does not restart.',
    'settings.modeLocal': 'Local Ollama',
    'settings.modeCloud': 'Ollama Cloud',
    'settings.host': 'Ollama host',
    'settings.port': 'Ollama port',
    'settings.baseUrl': 'Cloud base URL',
    'settings.apiKey': 'API key',
    'settings.apiKeyPh': 'API key',
    'settings.clearKey': 'Remove the stored API key',
    'settings.stored': '(stored)',
    'settings.notStored': '(none)',
    'settings.replaceKey': 'stored, type to replace',
    'settings.replacePassword': 'stored, type to replace',
    'settings.server': 'Gateway and panel',
    'settings.portHint': 'Gateway port (restart needed when changed)',
    'settings.adminPassword': 'Panel password',
    'settings.adminPasswordPh': 'panel password (empty means no password)',
    'settings.clearPassword': 'Remove the stored panel password',
    'settings.passwordNote': 'The panel keeps the password in this tab only. Closing the tab signs you out.',
    'settings.fixes': 'Request fixes',
    'settings.titleFix': 'Session title fix',
    'settings.titleFixNote': 'Drops thinking and raises a small max_tokens for title-generation requests, where some models otherwise return nothing.',
    'settings.titleFixMatch': 'System prompt contains',
    'settings.titleFixMin': 'Minimum max_tokens',
    'settings.countTokens': 'Answer count_tokens locally',
    'settings.countTokensNote': 'Ollama does not implement the endpoint; the gateway estimates characters divided by the factor.',
    'settings.charsPerToken': 'Characters per token',
    'settings.logging': 'Logging',
    'settings.usageLog': 'Write usage-log.txt',
    'settings.promptHeads': 'Also write the first 300 characters of the system and user text',
    'settings.promptHeadsNote': 'Privacy risk: prompt text reaches the log file.',
    'settings.capturePerBucket': 'Full captures per bucket (0 is off)',
    'settings.captureLimit': 'Capture file limit (0 stops capturing)',
    'settings.probe': 'Diagnostic probe (0 is off)',
    'settings.saveTitle': 'Save settings',
    'settings.saveNote': 'Save writes every setting on this tab: connection, server, fixes and logging.',
    'configCard.title': 'Configuration file',
    'configCard.note': 'Export never includes the API key or the panel password. Import accepts a file produced by Export, or a hand-written config.',
    'configCard.export': 'Export config',
    'configCard.import': 'Import config',
    'configCard.keepSecrets': 'Keep the API key and panel password on reset',
    'configCard.reset': 'Reset to defaults',
    'configCard.resetConfirm': 'The configuration will return to its defaults. Continue?',
    'configCard.importConfirm': 'This file replaces the current configuration. Continue?',
    'configCard.importError': 'The file is not valid JSON',
    'configCard.imported': 'Configuration imported',
    'configCard.exported': 'Configuration exported',
    'common.save': 'Save',
    'common.saved': 'Saved',
    'common.savedWarn': 'Saved. Warning: {w}',
    'common.error': 'Error: {e}',
    'conn.connected': 'connected',
    'conn.down': 'not connected',
    'conn.unknown': '?',
    'uptime.hm': '{h}h {m}m',
    'uptime.m': '{m}m',
    'status.count': 'count',
    'status.block': 'blocked',
    'status.error': 'error',
    'prompt.password': 'Panel password:',
    'warn.capsPaused': 'the capture limit is full, full capture stopped',
    'foot.text': 'ollama-gateway v{v} · unofficial community tool',
    'modeNote.local': 'Requests go straight to the local Ollama daemon.',
    'modeNote.cloudSet': 'Requests go to {u} with the stored API key.',
    'modeNote.cloudMissing': 'No key yet: cloud requests return 401. Paste the key and save.',
    'modeNote.httpWarn': ' Careful: this is an http address, so the API key travels unencrypted.',
  },
  tr: {
    'a11y.skip': 'İçeriğe geç',
    'app.sub': 'Anthropic Messages API istemcilerinin Ollama modellerini kullanmasını sağlayan yerel geçit. Kaydedilen ayarlar yeniden başlatmadan uygulanır.',
    'app.logout': 'Oturumu kapat',
    'tab.overview': 'Genel', 'tab.models': 'Modeller', 'tab.filters': 'Filtreler',
    'tab.style': 'Stil eki', 'tab.logs': 'Loglar', 'tab.settings': 'Ayarlar',
    'mode.local': 'Yerel', 'mode.cloud': 'Bulut',
    'setup.title': 'Başlangıç',
    'setup.note': 'Üç adımda kurulumdan çalışan istemciye ulaş.',
    'setup.step1': '1. Arka uca ulaş',
    'setup.step2': '2. İstemcinin gönderdiği modeli eşle',
    'setup.step3': '3. Test mesajı gönder',
    'setup.run': 'Kontrolleri çalıştır',
    'setup.hide': 'Gizle',
    'setup.connOk': 'Ulaşılıyor: {l}',
    'setup.connBad': 'Ulaşılamıyor: {r}',
    'setup.connUnknown': 'Henüz kontrol edilmedi',
    'setup.mapOk': '{n} eşleşme tanımlı',
    'setup.mapEmpty': 'Henüz eşleşme yok',
    'setup.msgOk': '{ms} ms içinde yanıt geldi',
    'setup.msgPending': 'Henüz denenmedi',
    'setup.msgBad': 'Başarısız: {e}',
    'setup.allOk': 'Bütün kontroller geçti.',
    'client.title': 'İstemci bağla',
    'client.note': 'Bunu bir terminale yapıştır. Anthropic uyumlu adres kabul eden her istemci aynı şekilde çalışır.',
    'client.copy': 'Kopyala',
    'client.copied': 'Kopyalandı',
    'recent.title': 'Son istekler',
    'recent.caption': 'Geçitten geçen son istekler',
    'recent.time': 'Saat', 'recent.mode': 'Mod', 'recent.mt': 'Max token',
    'recent.in': 'Giriş', 'recent.out': 'Çıkış', 'recent.dur': 'Süre',
    'recent.bucket': 'Bucket', 'recent.result': 'Sonuç',
    'recent.note': 'Sayaçlar yalnız bu süreç için. Tüm geçmiş usage-log.txt içinde.',
    'recent.empty': 'Henüz istek yok',
    'tile.requests': 'İstek', 'tile.blocked': 'Engellenen', 'tile.counted': 'Sayım',
    'tile.errors': 'Hata', 'tile.in': 'Giriş tokeni', 'tile.out': 'Çıkış tokeni',
    'overview.testConn': 'Bağlantıyı test et',
    'models.title': 'Model eşleşmeleri',
    'models.note': 'Sol taraf istemcinin gönderdiği model adı, sağ taraf arka ucun sunduğu model. Eşleşmeyen adlar yedek modele düşer. Yerel ve bulut haritaları ayrı tutulur.',
    'models.discover': 'Modelleri keşfet',
    'models.addRow': 'Satır ekle',
    'models.fallback': 'Yedek model',
    'models.source': 'istemcinin gönderdiği model adı',
    'models.target': 'arka uçtaki model',
    'models.delete': 'Sil',
    'models.notFound': 'Bu model arka uç listesinde görünmüyor',
    'models.mapEmpty': 'Henüz eşleşme yok. Modelleri keşfet ve bir satır ekle.',
    'models.unknown': '{n} eşleşme arka uç listesinde yok',
    'models.ok': 'Bütün eşleşmeler arka uç listesiyle uyuşuyor',
    'cap.tools': 'araçlar',
    'cap.noTools': 'araç yok',
    'discover.title': 'Arka uçtaki modeller',
    'discover.caption': 'Arka ucun bildirdiği modeller',
    'discover.name': 'Ad', 'discover.family': 'Aile', 'discover.params': 'Parametre',
    'discover.quant': 'Niceleme', 'discover.size': 'Boyut', 'discover.actions': 'İşlem',
    'discover.use': 'Kullan',
    'discover.useNote': '"Kullan" yukarıdaki haritada ilk boş hedef alanı doldurur.',
    'discover.loading': 'Yükleniyor...',
    'discover.empty': 'Model bildirilmedi',
    'discover.checked': '{n} model · kontrol {t}',
    'discover.filter': 'Ada veya aileye göre filtrele',
    'discover.noMatch': 'Filtreye uyan model yok',
    'filters.title': 'İstek filtreleri',
    'filters.note': 'Kurala uyan istek arka uca gönderilmez, istemciye boş ama geçerli cevap döner. Varsayılan olarak kapalı. max_tokens 8192 isteklerini filtreleme, istemci oturumu kendini durdurabilir.',
    'filters.add': 'Kural ekle',
    'filters.name': 'ad',
    'filters.maxTokens': 'max token',
    'filters.systemContains': 'system içinde geçmeli',
    'filters.delete': 'Sil',
    'filters.enabled': 'Kural etkin',
    'style.title': 'Stil eki',
    'style.note': 'Her isteğin system prompt una eklenen talimatlar. Değiştirirsen önbellek bir kez yeniden kurulur. Varsayılan olarak boş.',
    'style.label': 'Talimatlar, her satır bir tane',
    'style.placeholder': 'her satır bir talimat',
    'logs.lines': 'Satır',
    'logs.auto': 'Otomatik yenile',
    'logs.refresh': 'Yenile',
    'logs.clear': 'Logu temizle',
    'logs.empty': 'log boş',
    'logs.lineCount': '{n} satır',
    'logs.readError': 'log okunamadı: {e}',
    'logs.cleared': 'Log temizlendi',
    'logs.confirmClear': 'usage-log içeriği tamamen silinecek. Emin misin?',
    'captures.title': 'Yakalama dosyaları',
    'captures.note': 'Tam istek ve yanıt gövdeleri yalnızca Ayarlar\'da gövde yakalama açıksa buraya yazılır.',
    'captures.clear': 'Tümünü sil',
    'captures.confirm': 'captures içindeki bütün dosyalar silinecek. Emin misin?',
    'captures.info': '{n} dosya, toplam {s} bayt.',
    'captures.paused': ' Dosya sınırı dolduğu için kayıt durdu.',
    'captures.cleared': 'Yakalama dosyaları silindi',
    'settings.connection': 'Bağlantı',
    'settings.connectionNote': 'İsteklerin hangi Ollama\'ya gideceğini seçer. Kaydedince anında geçerli olur, geçit yeniden başlatılmaz.',
    'settings.modeLocal': 'Yerel Ollama',
    'settings.modeCloud': 'Ollama Cloud',
    'settings.host': 'Ollama adresi',
    'settings.port': 'Ollama portu',
    'settings.baseUrl': 'Bulut adresi',
    'settings.apiKey': 'API anahtarı',
    'settings.apiKeyPh': 'API anahtarı',
    'settings.clearKey': 'Kayıtlı anahtarı sil',
    'settings.stored': '(kayıtlı)',
    'settings.notStored': '(yok)',
    'settings.replaceKey': 'kayıtlı, değiştirmek için yaz',
    'settings.replacePassword': 'kayıtlı, değiştirmek için yaz',
    'settings.server': 'Geçit ve panel',
    'settings.portHint': 'Geçit portu (değişince yeniden başlat)',
    'settings.adminPassword': 'Panel şifresi',
    'settings.adminPasswordPh': 'panel şifresi (boş = şifresiz)',
    'settings.clearPassword': 'Kayıtlı panel şifresini sil',
    'settings.passwordNote': 'Panel şifreyi yalnız bu sekmede tutar. Sekmeyi kapatınca oturum kapanır.',
    'settings.fixes': 'İstek düzeltmeleri',
    'settings.titleFix': 'Oturum başlığı düzeltmesi',
    'settings.titleFixNote': 'Başlık üretimi isteklerinde thinking alanını düşürür ve küçük max_tokens değerini yükseltir; bazı modeller aksi hâlde boş dönüyordu.',
    'settings.titleFixMatch': 'System prompt içinde geçen',
    'settings.titleFixMin': 'En az max_tokens',
    'settings.countTokens': 'count_tokens isteklerini yerel tahminle yanıtla',
    'settings.countTokensNote': 'Ollama bu ucu tanımlamıyor; geçit karakteri katsayıya bölerek tahmin eder.',
    'settings.charsPerToken': 'Karakter / token',
    'settings.logging': 'Loglama',
    'settings.usageLog': 'usage-log.txt yazımı',
    'settings.promptHeads': 'System ve kullanıcı metninin ilk 300 karakterini de yaz',
    'settings.promptHeadsNote': 'Gizlilik riski: istem metni log dosyasına girer.',
    'settings.capturePerBucket': 'Bucket başına tam kayıt (0 kapalı)',
    'settings.captureLimit': 'Yakalama dosya sınırı (0 yakalama kapalı)',
    'settings.probe': 'Tanılama filtresi (0 kapalı)',
    'settings.saveTitle': 'Ayarları kaydet',
    'settings.saveNote': 'Kaydet bu sekmedeki bütün ayarları yazar: bağlantı, sunucu, düzeltmeler ve loglama.',
    'configCard.title': 'Ayar dosyası',
    'configCard.note': 'Dışa aktarım API anahtarını ve panel şifresini içermez. İçe aktarma, dışa aktarılan dosyayı ya da elle yazılmış bir ayarı kabul eder.',
    'configCard.export': 'Ayarı dışa aktar',
    'configCard.import': 'Ayarı içe aktar',
    'configCard.keepSecrets': 'Sıfırlarken API anahtarını ve panel şifresini koru',
    'configCard.reset': 'Varsayılanlara dön',
    'configCard.resetConfirm': 'Ayar dosyası varsayılanlara dönecek. Emin misin?',
    'configCard.importConfirm': 'Bu dosya mevcut ayarların yerine geçecek. Emin misin?',
    'configCard.importError': 'Dosya geçerli JSON değil',
    'configCard.imported': 'Ayar içe aktarıldı',
    'configCard.exported': 'Ayar dışa aktarıldı',
    'common.save': 'Kaydet',
    'common.saved': 'Kaydedildi',
    'common.savedWarn': 'Kaydedildi. Uyarı: {w}',
    'common.error': 'Hata: {e}',
    'conn.connected': 'bağlı',
    'conn.down': 'bağlı değil',
    'conn.unknown': '?',
    'uptime.hm': '{h} sa {m} dk',
    'uptime.m': '{m} dk',
    'status.count': 'sayım',
    'status.block': 'blok',
    'status.error': 'hata',
    'prompt.password': 'Panel şifresi:',
    'warn.capsPaused': 'captures sınırı doldu, tam kayıt durdu',
    'foot.text': 'ollama-gateway v{v} · resmî olmayan topluluk aracı',
    'modeNote.local': 'İstekler doğrudan yerel Ollama daemon\'ına gider.',
    'modeNote.cloudSet': 'İstekler {u} adresine, kayıtlı API anahtarıyla gider.',
    'modeNote.cloudMissing': 'Anahtar yok: bulut isteği 401 döner. Anahtarı yazıp kaydet.',
    'modeNote.httpWarn': ' Dikkat: http adresi kullanıyorsun, API anahtarı şifresiz gider.',
  },
};

let lang = detectLang();
let cfg = null;
let tab = 'overview';
let modelMode = 'local';
let modeSel = 'local';
let discovered = [];
let modelsError = '';
let modelsCheckedAt = null;
let modelFilter = '';
const modelInfo = new Map();
let lastMessageTest = null;

function detectLang() {
  try {
    const saved = localStorage.getItem('gwLang');
    if (LANGS.includes(saved)) return saved;
  } catch (_) {}
  return String(navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

function t(key, vars) {
  const table = STR[lang] || STR.en;
  let s = table[key] != null ? table[key] : (STR.en[key] != null ? STR.en[key] : key);
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

function applyLang(next, persist) {
  lang = LANGS.includes(next) ? next : 'en';
  if (persist !== false) { try { localStorage.setItem('gwLang', lang); } catch (_) {} }
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('#langSeg button').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.title = 'ollama-gateway';
  localizeRows();
  renderUpstreamResult();
  if (cfg) { renderSnippet(); refreshStatus(); renderModelsTable(); updateMapHints(); applyModeUI(); }
}

// Row inputs are created from JavaScript, so their labels are refreshed here
// instead of being rebuilt, which would discard unsaved edits.
function localizeRows() {
  document.querySelectorAll('#mrows .mrow').forEach((row) => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]) inputs[0].placeholder = t('models.source');
    if (inputs[1]) inputs[1].placeholder = t('models.target');
    const del = row.querySelector('.del');
    if (del) { del.textContent = t('models.delete'); del.setAttribute('aria-label', t('models.delete')); }
  });
  document.querySelectorAll('#rrows .rrow').forEach((row) => {
    const q = (sel) => row.querySelector(sel);
    if (q('.rn')) q('.rn').placeholder = t('filters.name');
    if (q('.rmt')) q('.rmt').placeholder = t('filters.maxTokens');
    if (q('.rsys')) q('.rsys').placeholder = t('filters.systemContains');
    const del = row.querySelector('.del');
    if (del) { del.textContent = t('filters.delete'); del.setAttribute('aria-label', t('filters.delete')); }
    if (q('.ren')) q('.ren').setAttribute('aria-label', t('filters.enabled'));
  });
}

// ---- transport ----

async function api(ep, o = {}, retry = true) {
  const h = { 'content-type': 'application/json' };
  const tok = sessionStorage.getItem('gwToken');
  if (tok) h['x-admin-token'] = tok;
  const r = await fetch(ep, { ...o, headers: h });
  if (r.status === 401 && retry) {
    const p = prompt(t('prompt.password'));
    if (p === null) throw new Error(t('common.error', { e: 'HTTP 401' }));
    sessionStorage.setItem('gwToken', p);
    return api(ep, o, false);
  }
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return r.json();
}

function toast(msg, ok = true) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', !ok);
  el.classList.add('on');
  clearTimeout(el._h);
  el._h = setTimeout(() => el.classList.remove('on'), 2800);
}

function guard(fn) {
  return function () {
    return Promise.resolve(fn.apply(null, arguments)).catch((e) => toast(t('common.error', { e: e.message }), false));
  };
}

async function postConfig(partial) {
  if (partial) cfg = { ...cfg, ...partial };
  const r = await api('/admin/api/config', { method: 'POST', body: JSON.stringify(cfg) });
  cfg = r.config;
  if (r.warnings && r.warnings.length) toast(t('common.savedWarn', { w: r.warnings.join(' | ') }), false);
  else toast(t('common.saved'));
  return r;
}

// ---- status ----

function chip(el, text, cls) {
  el.textContent = text;
  el.className = 'chip' + (cls ? ' ' + cls : '');
}

function modeWord(m) { return m === 'cloud' ? t('mode.cloud') : t('mode.local'); }

function statusWord(st) {
  if (st === 'count') return t('status.count');
  if (st === 'block') return t('status.block');
  if (st === 'error') return t('status.error');
  return st;
}

function timeOf(iso) {
  try { return new Date(iso).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (_) { return ''; }
}

async function refreshStatus() {
  try {
    const s = await api('/admin/api/status');
    chip($('cMode'), modeWord(s.mode), 'mode');
    const up = s.upstream.up;
    chip($('cUpstream'), (s.upstream.label || 'upstream') + ' · ' + (up === true ? t('conn.connected') : up === false ? t('conn.down') : t('conn.unknown')),
      up === true ? 'ok' : up === false ? 'bad' : '');
    const h = Math.floor(s.uptimeSec / 3600), m = Math.floor((s.uptimeSec % 3600) / 60);
    chip($('cUptime'), h ? t('uptime.hm', { h, m }) : t('uptime.m', { m }));
    $('cLogout').hidden = !s.adminTokenSet;
    $('verNo').textContent = 'v' + (s.version || '?');
    $('foot').textContent = t('foot.text', { v: s.version || '?' });
    $('capNote').textContent = (s.caps && s.caps.paused) ? t('warn.capsPaused') : '';
    lastStatus = s;
    updateSetup();
    if (tab !== 'overview') return;
    const st = s.stats;
    $('tiles').innerHTML = [
      [t('tile.requests'), st.total], [t('tile.blocked'), st.blocked], [t('tile.counted'), st.counted],
      [t('tile.errors'), st.errors], [t('tile.in'), fmt(st.inTok)], [t('tile.out'), fmt(st.outTok)],
    ].map((x) => '<div class="tile"><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>').join('');
    const rows = (s.recent || []).map((e) => '<tr>' +
      '<td>' + esc(timeOf(e.t)) + '</td>' +
      '<td>' + esc(modeWord(e.m)) + '</td>' +
      '<td>' + (e.mt == null ? '' : esc(e.mt)) + '</td>' +
      '<td>' + (e.inp == null ? '?' : esc(e.inp)) + '</td>' +
      '<td>' + (e.out == null ? '?' : esc(e.out)) + '</td>' +
      '<td>' + (e.dur == null ? '?' : esc(e.dur) + 'ms') + '</td>' +
      '<td>' + esc(e.bucket || '') + '</td>' +
      '<td>' + esc(statusWord(e.st || '')) + '</td>' +
      '</tr>').join('');
    $('tbody').innerHTML = rows || '<tr><td class="empty" colspan="8">' + esc(t('recent.empty')) + '</td></tr>';
  } catch (e) {
    chip($('cUpstream'), t('common.error', { e: e.message }), 'bad');
  }
}

let lastStatus = null;

function updateSetup() {
  const card = $('setupCard');
  let hidden = false;
  try { hidden = localStorage.getItem('gwSetupHidden') === '1'; } catch (_) {}
  card.hidden = hidden;
  if (hidden || !cfg) return;

  const up = lastStatus && lastStatus.upstream ? lastStatus.upstream.up : null;
  setDot('dotConn', up === true ? 'ok' : up === false ? 'bad' : '');
  $('detConn').textContent = up === true
    ? t('setup.connOk', { l: lastStatus.upstream.label })
    : up === false ? t('setup.connBad', { r: lastStatus.upstream.reason || t('conn.down') })
      : t('setup.connUnknown');

  const n = Object.keys((cfg[cfg.mode] || {}).modelMap || {}).length;
  setDot('dotMap', n ? 'ok' : 'warn');
  $('detMap').textContent = n ? t('setup.mapOk', { n }) : t('setup.mapEmpty');

  const msg = lastMessageTest;
  setDot('dotMsg', msg ? (msg.ok ? 'ok' : 'bad') : '');
  $('detMsg').textContent = msg
    ? (msg.ok ? t('setup.msgOk', { ms: msg.latencyMs }) : t('setup.msgBad', { e: msg.error || msg.status }))
    : t('setup.msgPending');

  const allOk = up === true && n > 0 && !!msg && msg.ok;
  card.classList.toggle('complete', allOk);
  $('setupDone').hidden = !allOk;
  $('setupDone').textContent = allOk ? t('setup.allOk') : '';
}

function setDot(id, state) {
  const el = $(id);
  el.className = 'dot' + (state ? ' ' + state : '');
}

// ---- snippet ----

function renderSnippet() {
  if (!cfg) return;
  const port = cfg.port || 8799;
  const map = (cfg[cfg.mode] || {}).modelMap || {};
  const model = Object.keys(map)[0] || 'claude-opus-5';
  $('snippet').textContent = [
    '# macOS / Linux',
    'export ANTHROPIC_BASE_URL="http://127.0.0.1:' + port + '"',
    'export ANTHROPIC_AUTH_TOKEN="ollama"',
    'claude --model ' + model,
    '',
    '# Windows (cmd)',
    'set ANTHROPIC_BASE_URL=http://127.0.0.1:' + port,
    'set ANTHROPIC_AUTH_TOKEN=ollama',
    'claude --model ' + model,
  ].join('\n');
}

async function copySnippet() {
  const text = $('snippet').textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }
  toast(t('client.copied'));
}

// ---- models ----

function renderModels() {
  if (!cfg) return;
  const sec = cfg[modelMode] || {};
  $('fallback').value = sec.fallbackModel || '';
  document.querySelectorAll('#mmSeg button').forEach((b) => {
    const on = b.dataset.m === modelMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('mrows').innerHTML = '';
  Object.entries(sec.modelMap || {}).forEach(([k, v]) => addMRow(k, v));
  localizeRows();
  updateMapHints();
  fetchModelInfoForTargets();
}

function addMRow(k, v) {
  const row = document.createElement('div');
  row.className = 'mrow';
  row.innerHTML = '<input type="text" list="modelList" autocomplete="off" spellcheck="false">' +
    '<span class="arr" aria-hidden="true">→</span>' +
    '<div class="tgt"><input type="text" list="modelList" autocomplete="off" spellcheck="false">' +
    '<span class="cap" hidden></span></div>' +
    '<button type="button" class="del"></button>';
  const inputs = row.querySelectorAll('input');
  inputs[0].value = k || '';
  inputs[1].value = v || '';
  inputs[0].placeholder = t('models.source');
  inputs[1].placeholder = t('models.target');
  inputs[0].setAttribute('aria-label', t('models.source'));
  inputs[1].setAttribute('aria-label', t('models.target'));
  inputs[1].addEventListener('input', updateMapHints);
  const del = row.querySelector('.del');
  del.textContent = t('models.delete');
  del.setAttribute('aria-label', t('models.delete'));
  del.onclick = () => { row.remove(); updateMapHints(); };
  $('mrows').appendChild(row);
}

function currentTargets() {
  return [...$('mrows').querySelectorAll('.mrow input')].filter((_, i) => i % 2 === 1);
}

function updateMapHints() {
  if (!cfg) return;
  const known = new Set(discovered.map((m) => m.name));
  const check = discovered.length > 0;
  let unknown = 0;

  currentTargets().forEach((inp) => {
    const v = inp.value.trim();
    const miss = check && v && !known.has(v);
    inp.classList.toggle('warn', !!miss);
    inp.title = miss ? t('models.notFound') : '';
    if (miss) unknown++;
  });

  const fb = $('fallback');
  const fbMiss = check && fb.value.trim() && !known.has(fb.value.trim());
  fb.classList.toggle('warn', !!fbMiss);
  fb.title = fbMiss ? t('models.notFound') : '';
  if (fbMiss) unknown++;

  const rows = currentTargets().length;
  let text = '', cls = '';
  if (!rows) text = t('models.mapEmpty');
  else if (unknown) { text = t('models.unknown', { n: unknown }); cls = 'warn'; }
  else if (check) { text = t('models.ok'); cls = 'ok'; }
  const el = $('mmStatus');
  el.textContent = text;
  el.className = 'statusline' + (cls ? ' ' + cls : '');
  renderCaps();
}

// Capability badges come from /api/show and are fetched only for the models
// that are actually mapped, so discovery stays cheap.
function mappedNames() {
  return [...new Set(currentTargets()
    .map((inp) => inp.value.trim())
    .concat([$('fallback').value.trim()])
    .filter(Boolean))];
}

function fetchModelInfoForTargets() {
  const names = mappedNames();
  const missing = names.filter((n) => !modelInfo.has(n));
  if (!missing.length) return Promise.resolve();
  return api('/admin/api/model-info', { method: 'POST', body: JSON.stringify({ models: missing }) })
    .then((r) => {
      (r.models || []).forEach((m) => modelInfo.set(m.model, m));
      renderCaps();
    })
    .catch(() => {});
}

function renderCaps() {
  document.querySelectorAll('#mrows .mrow').forEach((row) => {
    const target = row.querySelectorAll('input')[1];
    const cap = row.querySelector('.cap');
    if (!cap) return;
    const info = modelInfo.get(target.value.trim());
    if (!info) { cap.hidden = true; return; }
    cap.hidden = false;
    if (!info.ok) {
      cap.textContent = '?';
      cap.className = 'cap warn';
      cap.title = info.error || '';
      return;
    }
    const tools = info.capabilities.includes('tools');
    cap.textContent = tools ? t('cap.tools') : t('cap.noTools');
    cap.className = 'cap ' + (tools ? 'ok' : 'warn');
    cap.title = info.capabilities.join(', ');
  });
}

function renderModelsTable() {
  const body = $('modelBody');
  const status = $('modelStatus');
  if (modelsError) {
    status.textContent = modelsError;
    status.className = 'statusline bad';
  } else if (discovered.length) {
    status.textContent = t('discover.checked', {
      n: discovered.length,
      t: modelsCheckedAt ? timeOf(modelsCheckedAt) : '?',
    });
    status.className = 'statusline';
  } else {
    status.textContent = '';
    status.className = 'statusline';
  }
  if (!discovered.length) {
    body.innerHTML = '<tr><td class="empty" colspan="6">' + esc(modelsError || t('discover.empty')) + '</td></tr>';
    $('modelList').innerHTML = '';
    return;
  }
  const q = modelFilter.trim().toLowerCase();
  const visible = q
    ? discovered.filter((m) => (m.name + ' ' + m.family).toLowerCase().includes(q))
    : discovered;
  if (!visible.length) {
    body.innerHTML = '<tr><td class="empty" colspan="6">' + esc(t('discover.noMatch')) + '</td></tr>';
    $('modelList').innerHTML = discovered.map((m) => '<option value="' + esc(m.name) + '"></option>').join('');
    return;
  }
  body.innerHTML = visible.map((m) => '<tr>' +
    '<td><code>' + esc(m.name) + '</code></td>' +
    '<td>' + esc(m.family || '') + '</td>' +
    '<td>' + esc(m.parameterSize || '') + '</td>' +
    '<td>' + esc(m.quantization || '') + '</td>' +
    '<td>' + (m.size == null ? '' : esc(bytes(m.size))) + '</td>' +
    '<td><button type="button" class="ghost" data-use="' + esc(m.name) + '">' + esc(t('discover.use')) + '</button></td>' +
    '</tr>').join('');
  $('modelList').innerHTML = discovered.map((m) => '<option value="' + esc(m.name) + '"></option>').join('');
}

function bytes(n) {
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(0) + ' MB';
  return (n / 1024).toFixed(0) + ' KB';
}

async function loadModels(refresh) {
  const status = $('modelStatus');
  status.textContent = t('discover.loading');
  status.className = 'statusline';
  try {
    const r = await api('/admin/api/models' + (refresh ? '?refresh=1' : ''));
    discovered = r.models || [];
    modelsError = r.error || '';
    modelsCheckedAt = r.checkedAt;
  } catch (e) {
    discovered = [];
    modelsError = e.message;
  }
  renderModelsTable();
  updateMapHints();
  fetchModelInfoForTargets();
}

function useModel(name) {
  const target = currentTargets().find((inp) => !inp.value.trim());
  if (target) target.value = name;
  else addMRow('', name);
  localizeRows();
  updateMapHints();
  fetchModelInfoForTargets();
}

// ---- filters ----

function renderRules() {
  if (!cfg) return;
  $('rrows').innerHTML = '';
  (cfg.blockRules || []).forEach((r) => addRRow(r));
  localizeRows();
}

function addRRow(r) {
  const row = document.createElement('div');
  row.className = 'rrow';
  row.innerHTML = '<input type="checkbox" class="ren">' +
    '<input type="text" class="rn" autocomplete="off" spellcheck="false">' +
    '<input type="number" class="rmt" min="1">' +
    '<input type="text" class="rsys" autocomplete="off" spellcheck="false">' +
    '<button type="button" class="del"></button>';
  row.querySelector('.ren').checked = r.enabled !== false;
  row.querySelector('.rn').value = r.name || '';
  row.querySelector('.rmt').value = r.maxTokens == null ? '' : r.maxTokens;
  row.querySelector('.rsys').value = r.sysContains || '';
  const del = row.querySelector('.del');
  del.textContent = t('filters.delete');
  del.setAttribute('aria-label', t('filters.delete'));
  del.onclick = () => row.remove();
  $('rrows').appendChild(row);
}

// ---- settings ----

function cloudUsesPlainHttp(url) {
  return /^http:\/\//i.test(url || '') && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(url || '');
}

function applyModeUI() {
  document.querySelectorAll('#modeSeg button').forEach((b) => {
    const on = b.dataset.m === modeSel;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('localFields').hidden = modeSel === 'cloud';
  $('cloudFields').hidden = modeSel !== 'cloud';
  $('clKeyClearRow').hidden = !(modeSel === 'cloud' && cfg && cfg.cloud.apiKeySet);
  const note = $('modeNote');
  if (!cfg) return;
  if (modeSel === 'cloud') {
    let text = cfg.cloud.apiKeySet
      ? t('modeNote.cloudSet', { u: cfg.cloud.baseUrl || 'ollama.com' })
      : t('modeNote.cloudMissing');
    if (cloudUsesPlainHttp($('clUrl').value)) text += t('modeNote.httpWarn');
    note.textContent = text;
    note.className = 'statusline' + (cfg.cloud.apiKeySet ? '' : ' warn');
  } else {
    note.textContent = t('modeNote.local');
    note.className = 'statusline';
  }
}

function fillSettings() {
  if (!cfg) return;
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
  $('clKey').placeholder = cfg.cloud.apiKeySet ? t('settings.replaceKey') : t('settings.apiKeyPh');
  $('clKeyState').textContent = cfg.cloud.apiKeySet ? t('settings.stored') : t('settings.notStored');
  $('clKeyClear').checked = false;
  $('pxPort').value = cfg.port;

  $('pwToken').value = '';
  $('pwToken').placeholder = cfg.admin.tokenSet ? t('settings.replacePassword') : t('settings.adminPasswordPh');
  $('pwTokenState').textContent = cfg.admin.tokenSet ? t('settings.stored') : t('settings.notStored');
  $('pwTokenClear').checked = false;
  $('pwTokenClearRow').hidden = !cfg.admin.tokenSet;
  $('cLogout').hidden = !cfg.admin.tokenSet;

  applyModeUI();
}

// ---- logs ----

async function refreshLog() {
  try {
    const r = await api('/admin/api/log?lines=' + $('logLines').value);
    $('logTail').textContent = r.lines.join('\n') || t('logs.empty');
    $('logNote').textContent = t('logs.lineCount', { n: r.lines.length });
  } catch (e) {
    $('logTail').textContent = t('logs.readError', { e: e.message });
  }
}

async function refreshCaptures() {
  try {
    const r = await api('/admin/api/captures');
    $('capInfo').textContent = t('captures.info', { n: r.files.length, s: fmt(r.total) }) + (r.paused ? t('captures.paused') : '');
  } catch (e) {
    $('capInfo').textContent = t('logs.readError', { e: e.message });
  }
}

// ---- connection tests ----

let lastUpstream = null;

function renderUpstreamResult() {
  if (!lastUpstream) return;
  const text = (lastUpstream.up ? t('conn.connected') : t('conn.down')) + ' · ' +
    modeWord(lastUpstream.mode) + ' · ' + lastUpstream.label +
    (lastUpstream.reason ? ' (' + lastUpstream.reason + ')' : '') + ' · ' + timeOf(lastUpstream.at);
  for (const id of ['testOut', 'sTestOut']) {
    const el = $(id);
    el.textContent = text;
    el.className = 'statusline ' + (lastUpstream.up ? 'ok' : 'bad');
  }
}

async function runUpstreamTest() {
  const r = await api('/admin/api/upstream/check', { method: 'POST' });
  lastUpstream = { up: r.up, mode: r.mode, label: r.label, reason: r.reason, at: new Date().toISOString() };
  renderUpstreamResult();
  return r;
}

async function runMessageTest() {
  const r = await api('/admin/api/test-message', { method: 'POST', body: '{}' });
  lastMessageTest = r;
  updateSetup();
  return r;
}

// ---- config file ----

function exportConfig() {
  return api('/admin/api/config/export').then((r) => {
    const blob = new Blob([JSON.stringify(r.config, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ollama-gateway-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('configCard.exported'));
  });
}

function afterConfigSwap(next) {
  cfg = next;
  fillSettings();
  renderModels();
  renderRules();
  renderSnippet();
  refreshStatus();
  loadModels(true);
}

// ---- tabs ----

function showTab(name) {
  const prev = tab;
  tab = TABS.includes(name) ? name : 'overview';
  document.querySelectorAll('#tabs [role=tab]').forEach((b) => {
    const on = b.dataset.t === tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  TABS.forEach((id) => { const s = $('s-' + id); if (s) s.hidden = id !== tab; });
  if (tab === 'overview') refreshStatus();
  if (tab === 'logs') { refreshLog(); refreshCaptures(); }
  if (tab === 'models' && prev !== 'models') { renderModels(); if (!discovered.length) loadModels(false); }
  if (tab === 'filters' && prev !== 'filters') renderRules();
  if (tab === 'style') $('addon').value = (cfg.systemAddon || []).join('\n');
}

// ---- wiring ----

$('langSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) applyLang(b.dataset.lang);
});

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role=tab]');
  if (b) showTab(b.dataset.t);
});

$('tabs').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...$('tabs').querySelectorAll('[role=tab]')];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  let n = i;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
  if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
  if (e.key === 'Home') n = 0;
  if (e.key === 'End') n = tabs.length - 1;
  tabs[n].focus();
  showTab(tabs[n].dataset.t);
});

$('modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  modeSel = b.dataset.m;
  applyModeUI();
});

$('mmSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  modelMode = b.dataset.m;
  renderModels();
});

$('modelBody').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-use]');
  if (b) useModel(b.dataset.use);
});

$('modelFilter').addEventListener('input', (e) => {
  modelFilter = e.target.value;
  renderModelsTable();
});

$('cLogout').addEventListener('click', () => {
  sessionStorage.removeItem('gwToken');
  location.reload();
});

$('copySnippet').addEventListener('click', guard(copySnippet));
$('btnTest').addEventListener('click', guard(() => runUpstreamTest()));
$('sTest').addEventListener('click', guard(() => runUpstreamTest()));

$('setupRun').addEventListener('click', guard(async () => {
  await runUpstreamTest();
  await loadModels(true);
  await runMessageTest();
  refreshStatus();
}));

$('setupHide').addEventListener('click', () => {
  try { localStorage.setItem('gwSetupHidden', '1'); } catch (_) {}
  $('setupCard').hidden = true;
});

$('mmDiscover').addEventListener('click', guard(() => loadModels(true)));
$('mAdd').addEventListener('click', () => { addMRow('', ''); localizeRows(); updateMapHints(); });
$('rAdd').addEventListener('click', () => { addRRow({ enabled: true }); localizeRows(); });
$('fallback').addEventListener('input', updateMapHints);

$('mSave').addEventListener('click', guard(async () => {
  const map = {};
  [...$('mrows').querySelectorAll('.mrow')].forEach((row) => {
    const a = row.querySelectorAll('input')[0].value.trim();
    const b = row.querySelectorAll('input')[1].value.trim();
    if (a && b) map[a] = b;
  });
  const patch = {};
  patch[modelMode] = { modelMap: map, fallbackModel: $('fallback').value.trim() };
  await postConfig(patch);
  renderModels();
  loadModels(false);
}));

$('rSave').addEventListener('click', guard(async () => {
  const rs = [...$('rrows').querySelectorAll('.rrow')].map((row) => ({
    name: row.querySelector('.rn').value.trim(),
    enabled: row.querySelector('.ren').checked,
    maxTokens: row.querySelector('.rmt').value === '' ? null : Number(row.querySelector('.rmt').value),
    sysContains: row.querySelector('.rsys').value.trim(),
  }));
  await postConfig({ blockRules: rs });
  renderRules();
}));

$('aSave').addEventListener('click', guard(async () => {
  const lines = $('addon').value.split('\n').map((s) => s.trim()).filter(Boolean);
  await postConfig({ systemAddon: lines });
  $('addon').value = (cfg.systemAddon || []).join('\n');
}));

$('sSave').addEventListener('click', guard(async () => {
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
      probeOutValue: Number($('lgProbe').value) || 0,
    },
    local: { host: $('olHost').value.trim(), port: Number($('olPort').value) || 11434 },
    cloud: { baseUrl: $('clUrl').value.trim(), apiKey: $('clKey').value },
    port: Number($('pxPort').value) || 8799,
    admin: { token: newToken },
  };
  if ($('clKeyClear').checked) patch.clearApiKey = true;
  if ($('pwTokenClear').checked) patch.clearAdminToken = true;
  await postConfig(patch);
  if (newToken) sessionStorage.setItem('gwToken', newToken);
  if (patch.clearAdminToken) sessionStorage.removeItem('gwToken');
  fillSettings();
  renderModels();
  renderSnippet();
  refreshStatus();
  loadModels(true);
}));

$('lgRefresh').addEventListener('click', refreshLog);
$('lgClear').addEventListener('click', guard(async () => {
  if (!confirm(t('logs.confirmClear'))) return;
  await api('/admin/api/log/clear', { method: 'POST' });
  toast(t('logs.cleared'));
  refreshLog();
}));

$('capRefresh').addEventListener('click', refreshCaptures);
$('capClear').addEventListener('click', guard(async () => {
  if (!confirm(t('captures.confirm'))) return;
  await api('/admin/api/captures/clear', { method: 'POST' });
  toast(t('captures.cleared'));
  refreshCaptures();
}));

$('cfgExport').addEventListener('click', guard(exportConfig));
$('cfgImport').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', guard(async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const text = await file.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) { return toast(t('configCard.importError'), false); }
  if (!confirm(t('configCard.importConfirm'))) return;
  const r = await api('/admin/api/config/import', { method: 'POST', body: JSON.stringify(data) });
  afterConfigSwap(r.config);
  toast(t('configCard.imported'));
}));

$('cfgReset').addEventListener('click', guard(async () => {
  if (!confirm(t('configCard.resetConfirm'))) return;
  const r = await api('/admin/api/config/reset', {
    method: 'POST',
    body: JSON.stringify({ keepSecrets: $('resetKeep').checked }),
  });
  if (r.newAdminToken) sessionStorage.setItem('gwToken', r.newAdminToken);
  afterConfigSwap(r.config);
  toast(t('common.saved'));
}));

// ---- start ----

async function init() {
  applyLang(lang, false);
  cfg = (await api('/admin/api/config')).config;
  if (cfg.mode) modeSel = cfg.mode;
  fillSettings();
  renderModels();
  renderRules();
  $('addon').value = (cfg.systemAddon || []).join('\n');
  renderSnippet();
  await refreshStatus();
  refreshCaptures();
  refreshLog();
  loadModels(false);
  setInterval(() => {
    refreshStatus();
    if (tab === 'logs' && $('logAuto').checked) refreshLog();
  }, 5000);
}

init().catch((e) => toast(t('common.error', { e: e.message }), false));
