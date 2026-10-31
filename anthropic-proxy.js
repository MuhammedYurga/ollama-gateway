#!/usr/bin/env node
'use strict';

// ollama-gateway
//
// Anthropic Messages API uyumlu istemcileri (orn. Claude Code / Claude Desktop
// gateway modu) Ollama modellerine baglayan tek dosyalik yerel gecit.
//
// Iki upstream, panelden secilir (Ayarlar > Baglanti yontemi):
//   yerel : http://<adres>:<port>   orn. 127.0.0.1:11434 (Ollama daemon)
//   bulut : https://ollama.com      Bearer API anahtari ile
// Secim kaydedilince canli uygulanir; tek porttan hizmet edilir. Model
// eslesmeleri moda gore ayridir.
//
// Calistir: ollama-gateway            (npm kurulumu)
//            node anthropic-proxy.js  (kaynak kopyasi)
// Panel:    http://127.0.0.1:8799/admin
//
// Ortam degiskenleri: PROXY_CFG, PROXY_DATA_DIR, PROXY_PORT, PROXY_MODE,
// OLLAMA_API_KEY. Komut satiri bayraklari ortam degiskenlerini ezer.
//
// Bu yazilim resmi degildir; Anthropic veya Ollama ile baglantili degildir.
// Ayrintilar: LEGAL.md

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');

const BASE_DIR = __dirname;
const VERSION = readVersion();
const LEGACY_LOCAL_CFG = path.join(BASE_DIR, 'proxy-config.json');
const LEGACY_CLOUD_CFG = path.join(BASE_DIR, 'proxy-config-cloud.json');
const PANEL_FILE = path.join(BASE_DIR, 'panel.html');
const PANEL_JS = path.join(BASE_DIR, 'panel.js');

const MAX_BODY = 32 * 1024 * 1024;     // istek govdesi ust siniri (bayt)
const RESP_CAP = 8 * 1024 * 1024;     // yanit tamponu ust siniri; asilirsa son delta kacabilir

// Calisma zamani yollari; setPaths() doldurur.
let CFG_FILE = null;
let DATA_DIR = BASE_DIR;
let CAP_DIR = path.join(BASE_DIR, 'captures');
let USAGE_LOG = path.join(BASE_DIR, 'usage-log.txt');
let LOG_FILE = path.join(BASE_DIR, 'probe-log.txt');

// Panelden guncellenen canli ayarlar; loadConfig() doldurur.
let cfg = null;
const buckets = new Map();        // fingerprint (bucket) -> yakalanan istek sayisi

// ---- Varsayilanlar (yayin icin notr) ----
// local/cloud bolumleri kendi model eslesmesini ve baglanti bilgisini tasir.
// Kisisel talimatlar, engelleme kurallari ve govde yakalama varsayilan olarak kapalidir.
const DEFAULTS = {
  mode: 'local',                    // 'local' | 'cloud'
  port: 8799,
  upstreamTimeoutMs: 600000,        // uzun stream'ler kesilmesin
  local: {
    host: '127.0.0.1',
    port: 11434,
    modelMap: {},
    fallbackModel: 'qwen3:8b',
  },
  cloud: {
    baseUrl: 'https://ollama.com',
    apiKey: '',                     // bos ise OLLAMA_API_KEY ortam degiskenine bakilir
    modelMap: {},
    fallbackModel: 'gpt-oss:120b',
  },
  systemAddon: [],
  blockRules: [],
  titleFix: { enabled: true, sysContains: 'short session titles', minTokens: 1024 },
  countTokens: { enabled: true, charsPerToken: 3.3 },
  logging: {
    usageLog: true,
    promptHeads: false,             // log satirina sys/usr basi yazilsin mi
    fullCapturePerBucket: 0,        // 0 = tam govde yakalama kapali
    capFileLimit: 400,
    probeOutValue: 0,               // 0 = teshis probe kapali
    maxLogBytes: 50 * 1024 * 1024,
  },
  admin: { token: '' },            // bos = sifresiz; yalniz 127.0.0.1'den erisilir
};

// ---- Kucuk yardimcilar ----
function readVersion() {
  try {
    return String(require(path.join(BASE_DIR, 'package.json')).version || '0.0.0');
  } catch (_) { return '0.0.0'; }
}

function deep(v) { return JSON.parse(JSON.stringify(v)); }

function cfgNum(v, lo, hi, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function cfgMode(v) { return (v === 'cloud' || v === 'local') ? v : null; }

function cleanModelMap(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const m = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof k === 'string' && k.trim() && typeof val === 'string' && val.trim()) m[k.trim()] = val.trim();
  }
  return m;
}

// Kismi panel kayitlarinda ic ice alanlar kaybolmasin diye derin birlestirme.
// Diziler ve ilkel degerler oldugu gibi degistirilir.
function mergeDeep(base, patch) {
  if (Array.isArray(patch)) return patch.slice();
  if (!patch || typeof patch !== 'object') return patch;
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) out[k] = mergeDeep(out[k], v);
  return out;
}

function sameToken(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// ---- Yollar ----
function userConfigDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ollama-gateway');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ollama-gateway');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ollama-gateway');
}

// Ayar dosyasi sirasi: --config > PROXY_CFG > betik dizinindeki proxy-config.json
// > kullanici ayar dizini. Boylece kaynak kopyasi eski davranisi korur, npm
// kurulumu ise paket dizinine yazmaz.
function resolvePaths(args) {
  const envCfg = process.env.PROXY_CFG ? path.resolve(process.env.PROXY_CFG) : null;
  const localCfg = LEGACY_LOCAL_CFG;
  const cfgPath = args.config
    ? path.resolve(args.config)
    : envCfg || (fs.existsSync(localCfg) ? localCfg : path.join(userConfigDir(), 'config.json'));
  const dataDir = args.dataDir
    ? path.resolve(args.dataDir)
    : (process.env.PROXY_DATA_DIR ? path.resolve(process.env.PROXY_DATA_DIR) : path.dirname(cfgPath));
  return { cfgPath, dataDir };
}

function setPaths(dataDir) {
  DATA_DIR = path.resolve(dataDir || BASE_DIR);
  CAP_DIR = path.join(DATA_DIR, 'captures');
  USAGE_LOG = path.join(DATA_DIR, 'usage-log.txt');
  LOG_FILE = path.join(DATA_DIR, 'probe-log.txt');
  try { fs.mkdirSync(CAP_DIR, { recursive: true }); } catch (_) {}
}

// ---- Komut satiri ----
function usage() {
  return [
    'ollama-gateway ' + VERSION,
    '',
    'Kullanim: ollama-gateway [secenekler]',
    '',
    '  --config <dosya>   Ayar dosyasi (varsayilan: betik dizini ya da kullanici ayar dizini)',
    '  --data-dir <dizin> Log ve yakalama dosyalarinin dizini (varsayilan: ayar dosyasinin dizini)',
    '  --port <sayi>      Proxy portu (varsayilan 8799)',
    '  --mode <mod>       local | cloud',
    '  -h, --help         Bu yardimi goster',
    '  -v, --version      Surumu yazdir',
    '',
    'Ortam: PROXY_CFG, PROXY_DATA_DIR, PROXY_PORT, PROXY_MODE, OLLAMA_API_KEY',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { config: null, dataDir: null, port: null, mode: null, help: false, version: false };
  const value = (i, name) => {
    if (i + 1 >= argv.length) throw new Error(name + ' icin deger gerekli');
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-v' || a === '--version') out.version = true;
    else if (a === '--config') { out.config = value(i, '--config'); i++; }
    else if (a.startsWith('--config=')) out.config = a.slice('--config='.length);
    else if (a === '--data-dir') { out.dataDir = value(i, '--data-dir'); i++; }
    else if (a.startsWith('--data-dir=')) out.dataDir = a.slice('--data-dir='.length);
    else if (a === '--port') { out.port = Number(value(i, '--port')); i++; }
    else if (a.startsWith('--port=')) out.port = Number(a.slice('--port='.length));
    else if (a === '--mode') { out.mode = String(value(i, '--mode')).toLowerCase(); i++; }
    else if (a.startsWith('--mode=')) out.mode = a.slice('--mode='.length).toLowerCase();
    else throw new Error('bilinmeyen secenek: ' + a);
  }
  if (out.mode && !cfgMode(out.mode)) throw new Error('--mode local veya cloud olmali');
  if (out.port !== null && (!Number.isFinite(out.port) || out.port < 1 || out.port > 65535)) {
    throw new Error('--port 1..65535 araliginda olmali');
  }
  return out;
}

// ---- Ayar dosyasi ----
// Eski (tek modlu) ayar dosyalarini birlesik yapiya cevirir.
function normalizeLegacy(c) {
  if (!c || typeof c !== 'object') return c;
  const out = deep(c);
  if (out.local || out.cloud) return out;
  const wasCloud = typeof out.apiKey === 'string' || typeof out.ollamaHost !== 'string';
  if (wasCloud) {
    out.cloud = {
      baseUrl: 'https://ollama.com',
      apiKey: typeof out.apiKey === 'string' ? out.apiKey : '',
      modelMap: out.modelMap,
      fallbackModel: out.fallbackModel,
    };
    out.mode = 'cloud';
  } else {
    out.local = {
      host: out.ollamaHost,
      port: out.ollamaPort,
      modelMap: out.modelMap,
      fallbackModel: out.fallbackModel,
    };
    out.mode = 'local';
  }
  delete out.apiKey;
  delete out.ollamaHost;
  delete out.ollamaPort;
  delete out.modelMap;
  delete out.fallbackModel;
  return out;
}

// Kullanicinin yazdigi config'i dogrular; bozuk alanlari varsayilana dondurur.
// Kosulsuz (mt'siz ve icermesiz) engelleme kurallari "her seyi engeller"
// oldugundan atlanir.
function sanitizeConfig(raw) {
  const c = normalizeLegacy(raw);
  const d = deep(DEFAULTS);
  const warn = [];
  if (!c || typeof c !== 'object') return { config: d, warnings: warn };

  const m = cfgMode(c.mode);
  if (m) d.mode = m;
  d.port = cfgNum(c.port, 1, 65535, d.port);
  d.upstreamTimeoutMs = cfgNum(c.upstreamTimeoutMs, 1000, 3600000, d.upstreamTimeoutMs);

  if (c.local && typeof c.local === 'object') {
    const l = c.local;
    if (typeof l.host === 'string' && l.host.trim()) {
      const h = l.host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (h) d.local.host = h;
    }
    d.local.port = cfgNum(l.port, 1, 65535, d.local.port);
    const mm = cleanModelMap(l.modelMap);
    if (mm) d.local.modelMap = mm;
    if (typeof l.fallbackModel === 'string' && l.fallbackModel.trim()) d.local.fallbackModel = l.fallbackModel.trim();
  }

  if (c.cloud && typeof c.cloud === 'object') {
    const cl = c.cloud;
    if (typeof cl.baseUrl === 'string' && cl.baseUrl.trim()) {
      const b = cl.baseUrl.trim().replace(/\/+$/, '');
      d.cloud.baseUrl = /^https?:\/\//i.test(b) ? b : 'https://' + b;
      if (!parseBaseUrl(d.cloud.baseUrl)) {
        warn.push('bulut adresi gecersiz, varsayilana donuldu');
        d.cloud.baseUrl = DEFAULTS.cloud.baseUrl;
      }
    }
    if (typeof cl.apiKey === 'string') d.cloud.apiKey = cl.apiKey.trim();
    const mm = cleanModelMap(cl.modelMap);
    if (mm) d.cloud.modelMap = mm;
    if (typeof cl.fallbackModel === 'string' && cl.fallbackModel.trim()) d.cloud.fallbackModel = cl.fallbackModel.trim();
  }

  if (Array.isArray(c.systemAddon)) {
    d.systemAddon = c.systemAddon.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());
  }
  if (Array.isArray(c.blockRules)) {
    d.blockRules = [];
    const seen = new Set();
    for (const r of c.blockRules) {
      if (!r || typeof r !== 'object') continue;
      let mt = (r.maxTokens === null || r.maxTokens === undefined || r.maxTokens === '') ? null : Number(r.maxTokens);
      if (mt !== null && (!Number.isFinite(mt) || mt <= 0)) {
        warn.push('geçersiz max_tokens alanlı kural atlandı');
        continue;
      }
      const sys = typeof r.sysContains === 'string' ? r.sysContains.trim() : '';
      let name = (typeof r.name === 'string' && r.name.trim()) ? r.name.trim() : ('kural-' + (d.blockRules.length + 1));
      if (mt === null && !sys) {
        warn.push('"' + name + '" kuralı koşulsuz olduğu için atlandı (her şeyi engellerdi)');
        continue;
      }
      let nn = name, i = 2;
      while (seen.has(nn)) nn = name + '-' + (i++);
      name = nn;
      seen.add(name);
      d.blockRules.push({ name, enabled: r.enabled !== false, maxTokens: mt, sysContains: sys });
    }
  }
  if (c.titleFix && typeof c.titleFix === 'object') {
    d.titleFix.enabled = c.titleFix.enabled !== false;
    if (typeof c.titleFix.sysContains === 'string' && c.titleFix.sysContains.trim()) {
      d.titleFix.sysContains = c.titleFix.sysContains.trim();
    }
    d.titleFix.minTokens = cfgNum(c.titleFix.minTokens, 1, 1e9, d.titleFix.minTokens);
  }
  if (c.countTokens && typeof c.countTokens === 'object') {
    d.countTokens.enabled = c.countTokens.enabled !== false;
    const f = Number(c.countTokens.charsPerToken);
    if (Number.isFinite(f) && f > 0) d.countTokens.charsPerToken = f;
  }
  if (c.logging && typeof c.logging === 'object') {
    d.logging.usageLog = c.logging.usageLog !== false;
    d.logging.promptHeads = c.logging.promptHeads === true;
    d.logging.fullCapturePerBucket = cfgNum(c.logging.fullCapturePerBucket, 0, 1000, d.logging.fullCapturePerBucket);
    d.logging.capFileLimit = cfgNum(c.logging.capFileLimit, 0, 100000, d.logging.capFileLimit);
    d.logging.probeOutValue = cfgNum(c.logging.probeOutValue, 0, 1e9, d.logging.probeOutValue);
    d.logging.maxLogBytes = cfgNum(c.logging.maxLogBytes, 1024 * 1024, 2 * 1024 * 1024 * 1024, d.logging.maxLogBytes);
  }
  if (c.admin && typeof c.admin === 'object') {
    if (typeof c.admin.token === 'string') d.admin.token = c.admin.token.trim();
  }
  return { config: d, warnings: warn };
}

function saveConfigFile(c) {
  try {
    try { fs.mkdirSync(path.dirname(CFG_FILE), { recursive: true }); } catch (_) {}
    const tmp = CFG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(c, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, CFG_FILE);
    try { fs.chmodSync(CFG_FILE, 0o600); } catch (_) {}   // Windows'ta etkisiz
    return true;
  } catch (e) {
    console.log('[config] yazilamadi: ' + e.message);
    return false;
  }
}

function readJsonFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

// Ayar dosyasi yoksa eski iki dosyadan (yerel + bulut) birlesik ayar uretir.
function bootstrapConfig() {
  const legacyLocal = readJsonFile(LEGACY_LOCAL_CFG);
  const legacyCloud = readJsonFile(LEGACY_CLOUD_CFG);
  if (!legacyLocal && !legacyCloud) return null;
  const d = deep(DEFAULTS);
  const base = legacyLocal || legacyCloud || {};
  for (const k of ['systemAddon', 'blockRules', 'titleFix', 'countTokens', 'logging', 'admin']) {
    if (base[k] !== undefined) d[k] = base[k];
  }
  if (legacyLocal) {
    const l = normalizeLegacy(legacyLocal).local || {};
    d.local = mergeDeep(d.local, l);
    const p = Number(legacyLocal.port);
    if (Number.isFinite(p) && p > 0) d.port = Math.floor(p);
    d.mode = 'local';
  }
  if (legacyCloud) {
    const cl = normalizeLegacy(legacyCloud).cloud || {};
    d.cloud = mergeDeep(d.cloud, cl);
    d.mode = legacyLocal ? d.mode : 'cloud';
  }
  return d;
}

let capPaused = false;
function recheckCapPaused() {
  if (!cfg || cfg.logging.capFileLimit === 0) { capPaused = true; return; }
  try {
    fs.readdir(CAP_DIR, (e, fl) => {
      if (e) { capPaused = false; return; }
      capPaused = fl.length >= cfg.logging.capFileLimit;
    });
  } catch (_) { capPaused = false; }
}

function applyConfig(c) {
  cfg = c;
  recheckCapPaused();
}

function loadConfig(cfgPath) {
  CFG_FILE = path.resolve(cfgPath);
  let raw;
  try {
    raw = fs.readFileSync(CFG_FILE, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // Okunamayan dosyayi ezme; bellekteki varsayilanlarla devam et.
      console.log('[config] okunamadi (' + (e.code || '?') + '): ' + e.message);
      applyConfig(sanitizeConfig(deep(DEFAULTS)).config);
      return;
    }
    const boot = bootstrapConfig();
    const fresh = sanitizeConfig(boot || deep(DEFAULTS)).config;
    if (!fresh.admin.token) {
      fresh.admin.token = crypto.randomBytes(16).toString('hex');
      console.log('[config] panel sifresi olusturuldu: ' + fresh.admin.token);
    }
    applyConfig(fresh);
    if (saveConfigFile(fresh)) console.log('[config] olusturuldu: ' + CFG_FILE);
    return;
  }
  try {
    applyConfig(sanitizeConfig(JSON.parse(raw)).config);
  } catch (e) {
    try { fs.copyFileSync(CFG_FILE, CFG_FILE.replace(/\.json$/, '') + '.bozuk.json'); } catch (_) {}
    console.log('[config] dosya bozuk, varsayilanlarla yeniden kurdum (yedek: *.bozuk.json)');
    const fresh = sanitizeConfig(deep(DEFAULTS)).config;
    if (!fresh.admin.token) {
      fresh.admin.token = crypto.randomBytes(16).toString('hex');
      console.log('[config] panel sifresi olusturuldu: ' + fresh.admin.token);
    }
    applyConfig(fresh);
    saveConfigFile(fresh);
  }
}

// ---- Upstream secimi ve istekleri ----
function isCloud(c) { return !!c && c.mode === 'cloud'; }

function activeSection(c) { return isCloud(c) ? c.cloud : c.local; }

function parseBaseUrl(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname) return null;
    return {
      proto: u.protocol === 'http:' ? 'http' : 'https',
      hostname: u.hostname,
      port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
      prefix: u.pathname.replace(/\/+$/, ''),
    };
  } catch (_) { return null; }
}

function upstreamLabel(c) {
  if (isCloud(c)) {
    try { return 'bulut ' + new URL(c.cloud.baseUrl).host; } catch (_) { return 'bulut'; }
  }
  return 'yerel ' + c.local.host + ':' + c.local.port;
}

// Tek tasima noktasi: secili moda gore http (yerel) ya da https (bulut).
// Bulutta istemcinin kimlik basliklari atilir, proxy'nin API anahtari konur.
function upstreamRequest(c, opts, cb) {
  const headers = { ...(opts.headers || {}) };
  delete headers['host'];
  delete headers['accept-encoding'];   // sikistirmasiz, temiz passthrough
  // Istemcinin kimlik basliklari hicbir modda upstream'e gitmez; bulutta
  // yerine Ollama API anahtari konur. Yerelde Ollama kimlik dogrulamaz.
  delete headers['authorization'];
  delete headers['x-api-key'];

  let mod, reqOpts;
  if (isCloud(c)) {
    const b = parseBaseUrl(c.cloud.baseUrl) || { proto: 'https', hostname: 'ollama.com', port: 443, prefix: '' };
    if (c.cloud.apiKey) headers['authorization'] = 'Bearer ' + c.cloud.apiKey;
    mod = b.proto === 'http' ? http : https;
    reqOpts = {
      hostname: b.hostname,
      port: b.port,
      path: b.prefix + opts.path,
      method: opts.method || 'POST',
      headers,
      timeout: opts.timeout || c.upstreamTimeoutMs,
    };
  } else {
    mod = http;
    reqOpts = {
      host: c.local.host,
      port: c.local.port,
      path: opts.path,
      method: opts.method || 'POST',
      headers,
      timeout: opts.timeout || c.upstreamTimeoutMs,
    };
  }
  const rq = mod.request(reqOpts, cb);
  rq.on('timeout', () => rq.destroy(new Error('upstream timeout')));
  return rq;
}

// Aktarimda hop-by-hop basliklar disarida birakilir; node kendi chunked
// kodlamasini ve baglanti yonetimini uygular.
function responseHeaders(h) {
  const out = { ...(h || {}) };
  for (const k of ['connection', 'keep-alive', 'transfer-encoding', 'upgrade',
                   'proxy-authenticate', 'proxy-authorization', 'te', 'trailer']) {
    delete out[k];
  }
  return out;
}

// ---- Upstream saglik kontrolu (panel durum cubugu icin) ----
let LISTEN_PORT = null;              // panel Host/Origin kontrolu fiili portu kullanir
let upstreamUp = null;
let upstreamCheckedAt = null;
let upstreamReason = '';
let upstreamMode = null;
function upstreamCheckNow(c) {
  const conf = c || cfg;
  return new Promise((resolve) => {
    if (!conf) return resolve({ up: false, reason: 'config yok' });
    if (isCloud(conf) && !conf.cloud.apiKey) {
      upstreamUp = false; upstreamCheckedAt = Date.now(); upstreamReason = 'api anahtarı yok'; upstreamMode = conf.mode;
      return resolve({ up: false, reason: upstreamReason });
    }
    const done = (up, reason) => {
      upstreamUp = up; upstreamCheckedAt = Date.now(); upstreamReason = reason || ''; upstreamMode = conf.mode;
      resolve({ up, reason: upstreamReason });
    };
    try {
      const rq = upstreamRequest(conf,
        { path: '/v1/models', method: 'GET', headers: { accept: 'application/json' }, timeout: 5000 },
        (r) => {
          r.resume();
          const ok = isCloud(conf)
            ? (r.statusCode >= 200 && r.statusCode < 500 && r.statusCode !== 401 && r.statusCode !== 403)
            : (r.statusCode < 500);
          done(ok, ok ? '' : ('HTTP ' + r.statusCode));
        }
      );
      rq.on('error', (e) => done(false, e.message));
      rq.end();
    } catch (e) { done(false, e.message); }
  });
}

// ---- Canli istatistik (panel "Genel" sekmesi; sadece proxy acilisindan beri) ----
const stats = { startedAt: Date.now(), total: 0, blocked: 0, counted: 0, errors: 0, inTok: 0, outTok: 0, recent: [] };
function statPush(e, mode) {
  try {
    e.t = new Date().toISOString();
    e.m = mode || (cfg && cfg.mode);
    stats.recent.unshift(e);
    if (stats.recent.length > 60) stats.recent.pop();
  } catch (_) {}
}

// ---- Teshis probe (varsayilan kapali) ----
function writeProbe(line) {
  fs.appendFile(LOG_FILE, line + '\n', 'utf8', (e) => {
    if (e) console.log('[probe-log] yazma hatasi: ' + e.message);
  });
}

function tsStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function appendLine(file, line) {
  try { fs.appendFile(file, line + '\n', 'utf8', () => {}); } catch (_) {}
}

function maybeRotateLogs() {
  try {
    const limit = (cfg && cfg.logging.maxLogBytes) || DEFAULTS.logging.maxLogBytes;
    const st = fs.statSync(USAGE_LOG);
    if (st.size < limit) return;
    const old = USAGE_LOG.replace(/\.txt$/, '.1.txt');
    try { fs.unlinkSync(old); } catch (_) {}
    fs.renameSync(USAGE_LOG, old);
    console.log('[log] usage-log donduruldu -> ' + old);
  } catch (_) {}
}

// Yanit govdesi (string) kullanimini okur; SSE'de son eslesme nihai toplamdir.
function parseUsage(body) {
  try {
    if (body.trimStart().startsWith('{')) {
      try {
        const r = JSON.parse(body);
        const u = r.usage || {};
        return { inp: typeof u.input_tokens === 'number' ? u.input_tokens : null,
                 out: typeof u.output_tokens === 'number' ? u.output_tokens : null };
      } catch (_) { /* regex yedegi asagida */ }
    }
    const firstNum = (re) => { const m = body.match(re); return m ? parseInt(m[1], 10) : null; };
    const lastNum = (re) => {
      const ms = body.match(new RegExp(re.source, 'g'));
      return ms && ms.length ? parseInt(ms[ms.length - 1].replace(/\D+/g, ''), 10) : null;
    };
    return { inp: firstNum(/"input_tokens"\s*:\s*(\d+)/), out: lastNum(/"output_tokens"\s*:\s*(\d+)/) };
  } catch (_) { return { inp: null, out: null }; }
}

// Teshis kodu veri yolunu asla bozmasin: tum govde try/catch icinde.
function checkProbe(c, p, body, elapsedMs) {
  try {
    const pv = c.logging.probeOutValue;
    if (!pv) return;
    const firstNum = (re) => { const m = body.match(re); return m ? parseInt(m[1], 10) : null; };
    const lastNum = (re) => {
      const ms = body.match(new RegExp(re.source, 'g'));
      return ms && ms.length ? parseInt(ms[ms.length - 1].replace(/\D+/g, ''), 10) : null;
    };
    const inp = firstNum(/"input_tokens"\s*:\s*(\d+)/);
    const out = lastNum(/"output_tokens"\s*:\s*(\d+)/);
    if (inp === null || out === null) return;
    if (out !== pv) return;
    let stop = '';
    const sm = body.match(/"stop_reason"\s*:\s*"([^"]*)"/);
    if (sm) stop = sm[1];
    let respHead = '';
    if (body.trimStart().startsWith('{')) {
      respHead = body.slice(0, 400).replace(/\s+/g, ' ').trim();
    }
    writeProbe('[' + new Date().toISOString() + '] MATCH in=' + inp + ' out=' + out +
      ' | mode=' + p.mode +
      ' | model=' + (p.model || '?') +
      ' | stream=' + p.stream +
      ' | stop=' + stop +
      ' | max_tokens=' + (p.maxTokens === null ? '' : p.maxTokens) +
      ' | ' + elapsedMs + 'ms' +
      ' | ua=' + p.ua +
      ' | meta=' + p.meta +
      ' | sys="' + p.sys + '"' +
      ' | usr="' + p.usr + '"' +
      (respHead ? ' | resp=' + respHead : ''));
  } catch (_) { /* teshis kodu veri yolunu asla bozmasin */ }
}

function capPath(stamp, mode, bucket, name) {
  // Windows dosya adlarina izin verilmeyen karakterler (orn. bucket'taki '?') sanitize edilir
  const safe = String(bucket).replace(/[^A-Za-z0-9_-]/g, 'x');
  return path.join(CAP_DIR, `${stamp}_${mode}_${safe}_${name}`);
}

// SYSTEM_ADDON: iletilen her istegin system prompt'una sabit eklenen talimatlar.
function addonText(c) {
  return '# STIL TALIMATLARI (gateway eki)\n' + c.systemAddon.map((s) => '- ' + s).join('\n');
}

// Eki system'e uygular; system string, blok dizisi, tek blok veya tanimsiz olabilir.
// Onbellek dostu: son sistem blogunda cache_control varsa eki YENI blok olarak ekler,
// eski blok bayt aynen kalir (cache surmesin diye).
function applySystemAddon(j, c) {
  try {
    if (!j || !c.systemAddon.length) return 0;
    const a = addonText(c);
    if (typeof j.system === 'string') {
      j.system = j.system + '\n\n' + a;
      return 1;
    }
    if (Array.isArray(j.system)) {
      const last = j.system.length ? j.system[j.system.length - 1] : null;
      if (last && last.type === 'text' && !last.cache_control) {
        last.text = (last.text || '') + '\n\n' + a;
      } else {
        j.system.push({ type: 'text', text: a });
      }
      return 1;
    }
    if (j.system && typeof j.system === 'object' && typeof j.system.text === 'string') {
      j.system = [j.system, { type: 'text', text: a }];
      return 1;
    }
    j.system = a;   // system hic yoktu: sadece eki koy
    return 1;
  } catch (_) { return 0; }
}

// Istemcinin gonderdigi model adi -> secili modun gercek Ollama modeli.
// Eslesme ve yedek yoksa isim oldugu gibi birakilir; upstream net hata dondurur.
function resolveModelFor(section, name) {
  if (!section) return name;
  return (section.modelMap && section.modelMap[name]) || section.fallbackModel || name;
}

// Baslik uretici: system "string", blok dizisi veya tek blok nesnesi olabilir.
function textHead(v, n) {
  try {
    let s = '';
    if (typeof v === 'string') s = v;
    else if (Array.isArray(v)) s = v.map(b => (b && typeof b.text === 'string') ? b.text : '').join(' ');
    else if (v && typeof v.text === 'string') s = v.text;
    s = s.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
    return s.slice(0, n);
  } catch (_) { return ''; }
}

function firstUserHead(messages, n) {
  try {
    if (!Array.isArray(messages)) return '';
    for (const m of messages) {
      if (!m || m.role !== 'user') continue;
      if (typeof m.content === 'string') return textHead(m.content, n);
      if (Array.isArray(m.content)) {
        for (const b of m.content)
          if (b && b.type === 'text' && typeof b.text === 'string') return textHead(b.text, n);
      }
      return '';
    }
    return '';
  } catch (_) { return ''; }
}

function matchBlock(j, c) {
  try {
    if (!j) return null;
    for (const r of c.blockRules) {
      try {
        if (r.enabled === false) continue;
        const mtOk = (r.maxTokens === null) ? true : (j.max_tokens === r.maxTokens);
        if (!mtOk) continue;
        if (r.sysContains && !textHead(j.system, 3000).includes(r.sysContains)) continue;
        return r.name;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function bucketOf(j) {
  try {
    const head = textHead(j.system, 120);
    let h = 0;
    for (let i = 0; i < head.length; i++) h = (h * 31 + head.charCodeAt(i)) >>> 0;
    return 'mt' + (typeof j.max_tokens === 'number' ? j.max_tokens : '?') + '_' + h.toString(36);
  } catch (_) { return 'mt?_x'; }
}

function logUsageLine(c, pr, upRes, usage, elapsedMs) {
  try {
    if (!c.logging.usageLog) return;
    const { inp, out } = usage;
    appendLine(USAGE_LOG, `[${new Date().toISOString()}] in=${inp === null ? '?' : inp} out=${out === null ? '?' : out}` +
      ` mt=${pr.maxTokens === null ? '' : pr.maxTokens} dur=${elapsedMs}ms status=${upRes.statusCode}` +
      ` mode=${pr.mode} stream=${pr.stream} model=${pr.model} bucket=${pr.bucket} ad=${pr.ad}` +
      ` url="${pr.url}" ua="${pr.ua}"` +
      (c.logging.promptHeads ? ` sys="${pr.sys}" usr="${pr.usr}"` : ''));
  } catch (_) { /* loglama veri yolunu asla bozmasin */ }
}

// Engellenen istek icin sentetik cevap: gecerli Anthropic mesaji, bos metin, end_turn.
function sendBlocked(j, res, rule, modelWas) {
  try {
    const id = 'msg_blocked_' + crypto.randomBytes(6).toString('hex');
    const model = modelWas || 'unknown';
    if (j && j.stream === true) {
      const ev = [
        'event: message_start\ndata: ' + JSON.stringify({
          type: 'message_start',
          message: { id, type: 'message', role: 'assistant', model, content: [],
                     stop_reason: null, stop_sequence: null,
                     usage: { input_tokens: 0, output_tokens: 1 } } }),
        'event: content_block_start\ndata: ' + JSON.stringify({
          type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
        'event: content_block_stop\ndata: ' + JSON.stringify({ type: 'content_block_stop', index: 0 }),
        'event: message_delta\ndata: ' + JSON.stringify({
          type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 1 } }),
        'event: message_stop\ndata: ' + JSON.stringify({ type: 'message_stop' })
      ];
      const body = ev.join('\n\n') + '\n\n';
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.end(body);
      return body;
    }
    const body = JSON.stringify({
      id, type: 'message', role: 'assistant', model,
      content: [{ type: 'text', text: '' }],
      stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 1 }
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(body);
    return body;
  } catch (e) {
    try { if (!res.headersSent) res.writeHead(502); res.end('blocked response error: ' + e.message); } catch (_) {}
    return '';
  }
}

// Istek govdesini sinirli sekilde okur. Asimda EToolarge dondurur.
function readBody(req, limit, cb) {
  const chunks = [];
  let size = 0, done = false;
  const finish = (err, buf) => {
    if (done) return;
    done = true;
    cb(err, buf);
  };
  req.on('data', (ch) => {
    if (done) return;
    size += ch.length;
    if (size > limit) {
      const e = new Error('govde cok buyuk');
      e.code = 'ETOOLARGE';
      return finish(e);
    }
    chunks.push(ch);
  });
  req.on('end', () => finish(null, Buffer.concat(chunks)));
  req.on('error', (e) => finish(e));
  req.on('aborted', () => finish(new Error('istek iptal edildi')));
}

function bodyError(res, req, err) {
  const code = err && err.code === 'ETOOLARGE' ? 413 : 400;
  const msg = code === 413 ? 'govde cok buyuk' : ('istek okunamadi: ' + (err && err.message));
  try {
    if (!res.headersSent) res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: code === 413 ? 'request_too_large' : 'invalid_request_error', message: msg } }), () => {
      try { req.destroy(); } catch (_) {}
    });
  } catch (_) {}
}

function forwardModels(req, res) {
  const c = cfg;
  const up = upstreamRequest(c,
    { path: '/v1/models', method: 'GET', headers: { accept: req.headers.accept || 'application/json' } },
    (upRes) => { res.writeHead(upRes.statusCode, responseHeaders(upRes.headers)); upRes.pipe(res); }
  );
  up.on('error', (e) => { if (!res.headersSent) res.writeHead(502); res.end('models upstream error: ' + e.message); });
  res.on('close', () => { if (!res.writableEnded) up.destroy(); });
  up.end();
}

// count_tokens icin duz metin uzunlugu (string degerlerin toplami; anahtarlar haric).
function textLen(v) {
  try {
    let n = 0;
    if (typeof v === 'string') return v.length;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v).length;
    if (Array.isArray(v)) { for (const x of v) n += textLen(x); return n; }
    if (v && typeof v === 'object') { for (const k in v) n += textLen(v[k]); return n; }
    return n;
  } catch (_) { return 0; }
}

// POST /v1/messages/count_tokens: Ollama bu ucu tanimiyor, hepsi 400'e dusuyordu.
// Tahmin kapaliysa istek oldugu gibi upstream'e iletilir.
function countTokens(req, res) {
  const c = cfg;
  const startedAt = Date.now();
  readBody(req, MAX_BODY, (err, raw) => {
    if (err) return bodyError(res, req, err);
    if (c.countTokens.enabled) {
      let est = 0, chars = 0;
      try {
        const j = JSON.parse(raw.toString('utf8'));
        chars = textLen(j);
        est = Math.max(1, Math.ceil(chars / c.countTokens.charsPerToken));
      } catch (_) { est = 0; }
      try {
        if (c.logging.usageLog) {
          appendLine(USAGE_LOG,
            `[${new Date().toISOString()}] COUNTED in=${est} out=0 mt=0 dur=${Date.now() - startedAt}ms` +
            ` status=200 mode=${c.mode} stream=0 model=count_tokens-estimate bucket=ct url="${String(req.url || '')}"` +
            ` chars=${chars} ua="${req.headers['user-agent'] || ''}"`);
        }
      } catch (_) {}
      stats.counted++;
      stats.total++;
      statPush({ st: 'sayım', mt: 0, inp: est, out: 0, dur: Date.now() - startedAt, bucket: 'ct' }, c.mode);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ input_tokens: est }));
    }
    const h = { ...req.headers };
    h['content-length'] = raw.length;
    const up = upstreamRequest(c,
      { path: req.url, method: 'POST', headers: h },
      (upRes) => {
        res.writeHead(upRes.statusCode, responseHeaders(upRes.headers));
        upRes.pipe(res);
        upRes.on('error', () => { try { res.end(); } catch (_) {} });
      }
    );
    up.on('error', (e) => { if (!res.headersSent) res.writeHead(502); res.end('upstream error: ' + e.message); });
    res.on('close', () => { if (!res.writableEnded) up.destroy(); });
    up.write(raw);
    up.end();
  });
}

function forwardMessages(req, res) {
  const c = cfg;                     // istek boyunca sabit kalsin (canli mod degisimi karistirmasin)
  const startedAt = Date.now();
  readBody(req, MAX_BODY, (err, raw) => {
    if (err) return bodyError(res, req, err);

    let outBody = raw;
    let modelWas = null;
    let probe = null;
    let parsed = null;
    let rule = null;
    try {
      const j = JSON.parse(raw.toString('utf8'));
      parsed = j;
      if (j && typeof j.model === 'string') {
        modelWas = j.model;
        j.model = resolveModelFor(activeSection(c), j.model);
      }
      // Baslik uretimi istekleri: bazi modellerde thinking blogu kucuk
      // max_tokens'i yutup <title> ciktisini engelliyordu. Thinking'i dusur,
      // alt siniri cek. Panelden acilip kapanabilir.
      try {
        if (c.titleFix.enabled && textHead(j.system, 300).includes(c.titleFix.sysContains)) {
          if (j.thinking) delete j.thinking;
          if (typeof j.max_tokens === 'number' && j.max_tokens < c.titleFix.minTokens) {
            j.max_tokens = c.titleFix.minTokens;
          }
        }
      } catch (_) {}
      probe = {
        mode: c.mode,
        model: modelWas,
        stream: j.stream === true ? 1 : 0,
        maxTokens: typeof j.max_tokens === 'number' ? j.max_tokens : null,
        meta: (j.metadata && typeof j.metadata.user_id === 'string') ? j.metadata.user_id : '',
        ua: req.headers['user-agent'] || '',
        url: String(req.url || ''),
        sys: c.logging.promptHeads ? textHead(j.system, 300) : '',
        usr: c.logging.promptHeads ? firstUserHead(j.messages, 300) : '',
        bucket: bucketOf(j),
        capStamp: null,
      };
      rule = matchBlock(j, c);
      try { probe.ad = applySystemAddon(j, c); } catch (_) { probe.ad = 0; }
      const per = c.logging.fullCapturePerBucket;
      const seen = buckets.get(probe.bucket) || 0;
      if (per > 0 && !capPaused && seen < per) {
        const stamp = tsStamp();
        buckets.set(probe.bucket, seen + 1);
        probe.capStamp = stamp;
        try { fs.writeFileSync(capPath(stamp, probe.mode, probe.bucket, 'req.json'), raw, 'utf8'); } catch (_) {}
        recheckCapPaused();
        console.log(`[loglama] ${probe.bucket} istek kaydedildi (${seen + 1}/${per})`);
      }
      outBody = Buffer.from(JSON.stringify(j), 'utf8');
    } catch (_) { /* JSON degil: aynen ilet */ }

    if (rule) {
      const dur = Date.now() - startedAt;
      stats.blocked++;
      stats.total++;
      statPush({ st: 'blok', mt: probe ? probe.maxTokens : null, inp: null, out: null, dur, bucket: probe ? probe.bucket : '?' }, c.mode);
      console.log(`[blocked] ${rule} model=${modelWas} mt=${probe ? probe.maxTokens : '?'} dur=${dur}ms`);
      const sent = sendBlocked(parsed, res, rule, modelWas);
      if (probe) {
        try {
          if (c.logging.usageLog) {
            appendLine(USAGE_LOG,
              `[${new Date().toISOString()}] BLOCKED rule=${rule} in=? out=? mt=${probe.maxTokens}` +
              ` dur=${dur}ms mode=${probe.mode} stream=${probe.stream} model=${modelWas} bucket=${probe.bucket} ad=${probe.ad}` +
              ` url="${probe.url}" ua="${probe.ua}"` +
              (c.logging.promptHeads ? ` sys="${probe.sys}" usr="${probe.usr}"` : ''));
          }
          if (probe.capStamp) {
            fs.writeFileSync(capPath(probe.capStamp, probe.mode, probe.bucket, 'res.txt'), sent, 'utf8');
          }
        } catch (_) {}
      }
      return;
    }

    const outHeaders = { ...req.headers };
    delete outHeaders['content-length'];
    outHeaders['content-type'] = 'application/json';
    outHeaders['content-length'] = Buffer.byteLength(outBody);

    const upReq = upstreamRequest(c,
      { path: '/v1/messages', method: 'POST', headers: outHeaders },
      (upRes) => {
        res.writeHead(upRes.statusCode, responseHeaders(upRes.headers));
        const buf = []; let bytes = 0;
        upRes.on('data', (ch) => { if (bytes < RESP_CAP) { buf.push(ch); bytes += ch.length; } });
        upRes.pipe(res);
        upRes.on('end', () => {
          const elapsed = Date.now() - startedAt;
          if (probe) {
            stats.total++;
            if (upRes.statusCode >= 400) stats.errors++;
            try {
              const bodyStr = Buffer.concat(buf).toString('utf8');
              const usage = parseUsage(bodyStr);
              logUsageLine(c, probe, upRes, usage, elapsed);
              if (usage.inp !== null) stats.inTok += usage.inp;
              if (usage.out !== null) stats.outTok += usage.out;
              checkProbe(c, probe, bodyStr, elapsed);
              if (probe.capStamp) {
                try {
                  fs.writeFileSync(capPath(probe.capStamp, probe.mode, probe.bucket, 'res.txt'),
                    bodyStr.slice(0, 2 * 1024 * 1024), 'utf8');
                } catch (_) {}
              }
              statPush({ st: String(upRes.statusCode), mt: probe.maxTokens,
                         inp: usage.inp, out: usage.out, dur: elapsed, bucket: probe.bucket }, c.mode);
            } catch (_) {}
          }
        });
        upRes.on('error', () => { try { res.end(); } catch (_) {} });
      }
    );
    upReq.on('error', (e) => {
      stats.errors++;
      const dur = Date.now() - startedAt;
      statPush({ st: 'hata', mt: probe ? probe.maxTokens : null, inp: null, out: null, dur, bucket: probe ? probe.bucket : '?' }, c.mode);
      if (!res.headersSent) res.writeHead(502);
      res.end('upstream error: ' + e.message);
    });
    // Istemci vazgecerse upstream istegini de kes (bosa token harcanmasin).
    res.on('close', () => { if (!res.writableEnded) upReq.destroy(); });
    upReq.write(outBody);
    upReq.end();
  });
}

// ---- Yonetim paneli (/admin) ----

function sendJson(res, code, obj) {
  try {
    if (!res.headersSent) {
      res.writeHead(code, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
    }
    res.end(JSON.stringify(obj));
  } catch (_) {}
}

// Panelin gordugu ayar: API anahtari ve panel sifresi asla geri gonderilmez.
function publicConfig(c) {
  const out = deep(c);
  out.cloud.apiKey = '';
  out.cloud.apiKeySet = !!c.cloud.apiKey;
  out.admin.token = '';
  out.admin.tokenSet = !!c.admin.token;
  return out;
}

function qparam(u, k) {
  try { return new URL(u, 'http://x').searchParams.get(k); } catch (_) { return null; }
}

// Token yalnizca basliktan kabul edilir; query string tarayici gecmisine sizar.
function authed(req, c) {
  if (!c.admin.token) return true;
  const h = req.headers['x-admin-token'];
  return typeof h === 'string' && sameToken(h, c.admin.token);
}

// panel.js icin guvenlik basliklari; script-src 'self' oldugu icin HTML'de
// satir ici script yoktur.
const PANEL_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function panelHeaders(type) {
  return {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': PANEL_CSP,
  };
}

// DNS rebinding ve CSRF savunmasi: Host ve Origin yalnizca yerel adres olabilir.
function adminOriginOk(req, c) {
  const host = String(req.headers.host || '');
  const m = host.match(/:(\d+)$/);
  const hostPort = m ? Number(m[1]) : 80;
  const hostName = host.replace(/:\d+$/, '');
  const port = LISTEN_PORT || Number(c.port);
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostName)) return false;
  if (hostPort !== port) return false;
  const origin = req.headers.origin;
  if (!origin) return true;        // curl / ayni kaynak gezinme
  try {
    const u = new URL(origin);
    const p = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
    const okName = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname);
    return okName && p === port;
  } catch (_) { return false; }
}

function serveFile(res, file, type) {
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, panelHeaders(type));
    res.end(data);
  } catch (_) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><body>dosya bulunamadi: ' + file + '</body>');
  }
}

function servePanel(res) {
  serveFile(res, PANEL_FILE, 'text/html; charset=utf-8');
}

function servePanelJs(res) {
  serveFile(res, PANEL_JS, 'application/javascript; charset=utf-8');
}

function tailLines(file, n) {
  try {
    const st = fs.statSync(file);
    const read = Math.min(st.size, 256 * 1024);
    const fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(read);
    fs.readSync(fd, b, 0, read, st.size - read);
    fs.closeSync(fd);
    return b.toString('utf8').split('\n').filter(l => l.trim()).slice(-n);
  } catch (_) { return []; }
}

function readCaptures() {
  try {
    const files = fs.readdirSync(CAP_DIR).map((f) => {
      try {
        const st = fs.statSync(path.join(CAP_DIR, f));
        return { name: f, size: st.size, mtime: st.mtimeMs };
      } catch (_) { return null; }
    }).filter(Boolean).sort((a, b) => b.mtime - a.mtime);
    return { files, total: files.reduce((s, f) => s + f.size, 0) };
  } catch (_) { return { files: [], total: 0 }; }
}

function clearCaptures() {
  try {
    for (const f of fs.readdirSync(CAP_DIR)) {
      try { fs.unlinkSync(path.join(CAP_DIR, f)); } catch (_) {}
    }
  } catch (_) {}
}

function handleSaveConfig(req, res) {
  const c = cfg;
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  // Basit (preflight'siz) capraz kaynak POST'lari reddet: text/plain form saldirisi.
  if (!ct.startsWith('application/json')) {
    return sendJson(res, 415, { ok: false, error: 'content-type application/json olmali' });
  }
  readBody(req, 2 * 1024 * 1024, (err, raw) => {
    if (err) {
      const code = err.code === 'ETOOLARGE' ? 413 : 400;
      return sendJson(res, code, { ok: false, error: err.message });
    }
    try {
      const incoming = JSON.parse(raw.toString('utf8'));
      const merged = mergeDeep(c, incoming || {});
      // modelMap bir koleksiyondur: panel tam listeyi gonderir, silinen satirlar
      // geri gelmesin diye derin birlestirme yerine oldugu gibi alinir.
      if (incoming && incoming.local && typeof incoming.local === 'object' &&
          Object.prototype.hasOwnProperty.call(incoming.local, 'modelMap')) {
        merged.local.modelMap = incoming.local.modelMap;
      }
      if (incoming && incoming.cloud && typeof incoming.cloud === 'object' &&
          Object.prototype.hasOwnProperty.call(incoming.cloud, 'modelMap')) {
        merged.cloud.modelMap = incoming.cloud.modelMap;
      }
      // Panel sirri asla geri gonderilmez: bos alan "mevcut degeri koru" demek.
      if (!incoming || !incoming.cloud || typeof incoming.cloud !== 'object' || !incoming.cloud.apiKey) {
        merged.cloud.apiKey = c.cloud.apiKey;
      }
      if (incoming && incoming.clearApiKey === true) merged.cloud.apiKey = '';
      if (!incoming || !incoming.admin || typeof incoming.admin !== 'object' || !incoming.admin.token) {
        merged.admin.token = c.admin.token;
      }
      if (incoming && incoming.clearAdminToken === true) merged.admin.token = '';
      const { config, warnings } = sanitizeConfig(merged);
      if (!saveConfigFile(config)) {
        return sendJson(res, 500, { ok: false, error: 'ayar dosyasi yazilamadi' });
      }
      applyConfig(config);
      console.log('[config] panel ile guncellendi (mod: ' + config.mode + ', kurallar: ' + config.blockRules.length + ', addon: ' + config.systemAddon.length + ')');
      upstreamCheckNow(config);
      sendJson(res, 200, { ok: true, config: publicConfig(config), warnings });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: 'config okunamadi: ' + e.message });
    }
  });
}

function handleAdmin(req, res) {
  const c = cfg;
  const u = req.url || '/admin';
  const api = u.split('?')[0];

  if (!adminOriginOk(req, c)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('forbidden');
  }
  if (req.method === 'GET' && (u === '/admin' || u === '/admin/' || u.startsWith('/admin?'))) {
    return servePanel(res);
  }
  if (req.method === 'GET' && api === '/admin/panel.js') {
    return servePanelJs(res);
  }
  if (!api.startsWith('/admin/api/')) {
    res.writeHead(404); return res.end('not found');
  }
  if (!authed(req, c)) return sendJson(res, 401, { ok: false, error: 'panel şifresi gerekli' });
  try {
    if (req.method === 'GET') {
      if (api === '/admin/api/config') return sendJson(res, 200, { ok: true, config: publicConfig(c) });
      if (api === '/admin/api/status') {
        let capFiles = 0;
        try { capFiles = fs.readdirSync(CAP_DIR).length; } catch (_) {}
        return sendJson(res, 200, {
          ok: true,
          version: VERSION,
          mode: c.mode,
          port: c.port,
          uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000),
          upstream: {
            mode: upstreamMode,
            label: upstreamLabel(c),
            up: upstreamUp,
            reason: upstreamReason,
            checkedAt: upstreamCheckedAt ? new Date(upstreamCheckedAt).toISOString() : null,
            keySet: !!c.cloud.apiKey,
          },
          adminTokenSet: !!c.admin.token,
          caps: { files: capFiles, paused: capPaused, limit: c.logging.capFileLimit,
                  perBucket: c.logging.fullCapturePerBucket },
          stats: { total: stats.total, blocked: stats.blocked, counted: stats.counted,
                   errors: stats.errors, inTok: stats.inTok, outTok: stats.outTok },
          recent: stats.recent.slice(0, 40),
        });
      }
      if (api === '/admin/api/log') {
        const n = cfgNum(qparam(u, 'lines') || '200', 10, 2000, 200);
        return sendJson(res, 200, { ok: true, lines: tailLines(USAGE_LOG, n) });
      }
      if (api === '/admin/api/captures') {
        const cap = readCaptures();
        return sendJson(res, 200, { ok: true, files: cap.files, total: cap.total, paused: capPaused });
      }
      return sendJson(res, 404, { ok: false, error: 'bulunamadi' });
    }
    if (req.method === 'POST') {
      if (api === '/admin/api/config') return handleSaveConfig(req, res);
      if (api === '/admin/api/log/clear') {
        try { fs.writeFileSync(USAGE_LOG, '', 'utf8'); } catch (_) {}
        return sendJson(res, 200, { ok: true });
      }
      if (api === '/admin/api/captures/clear') {
        clearCaptures();
        recheckCapPaused();
        return sendJson(res, 200, { ok: true, files: [], total: 0 });
      }
      // /admin/api/ollama/check eski panel cagrilari icin takma ad.
      if (api === '/admin/api/upstream/check' || api === '/admin/api/ollama/check') {
        return void upstreamCheckNow(c).then((r) => sendJson(res, 200, {
          ok: true, up: r.up, reason: r.reason, mode: c.mode, label: upstreamLabel(c),
        }));
      }
      return sendJson(res, 404, { ok: false, error: 'bulunamadi' });
    }
    return sendJson(res, 404, { ok: false, error: 'bulunamadi' });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message });
  }
}

function handleRequest(req, res) {
  const u = req.url || '/';
  // ONEMLI sira: count_tokens /v1/messages ile basladigi icin once ve kesin eslesmeli.
  if (u.startsWith('/admin')) return handleAdmin(req, res);
  if (req.method === 'POST' && u.startsWith('/v1/messages/count_tokens')) return countTokens(req, res);
  if (req.method === 'GET' && u.startsWith('/v1/models')) return forwardModels(req, res);
  if (req.method === 'POST' && u.startsWith('/v1/messages')) return forwardMessages(req, res);
  if (req.method === 'GET' && (u === '/' || u === '/health')) {
    const c = cfg;
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({
      ok: true,
      name: 'ollama-gateway',
      version: VERSION,
      mode: c.mode,
      upstream: upstreamLabel(c),
      routes: activeSection(c).modelMap,
      fallback: activeSection(c).fallbackModel,
      port: c.port,
      panel: '/admin',
    }));
  }
  res.writeHead(404); res.end('not found');
}

// Test ve gomme icin: verilen ayar ve veri diziniyle sunucu olusturur.
function createServer(appCfg, dataDir, cfgPath) {
  cfg = appCfg;
  if (cfgPath) CFG_FILE = path.resolve(cfgPath);
  setPaths(dataDir);
  recheckCapPaused();
  const server = http.createServer(handleRequest);
  server.on('listening', () => {
    const a = server.address();
    if (a && typeof a === 'object' && a.port) LISTEN_PORT = a.port;
  });
  return server;
}

// ---- Baslatma ----
function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error('hata: ' + e.message + '\n\n' + usage()); process.exitCode = 2; return; }
  if (args.help) { console.log(usage()); return; }
  if (args.version) { console.log(VERSION); return; }

  const paths = resolvePaths(args);
  setPaths(paths.dataDir);
  loadConfig(paths.cfgPath);

  // Ortam degiskenleri dosyadaki degerleri yalnizca bos alanlarda doldurur;
  // komut satiri her ikisini de ezer.
  if (!cfg.cloud.apiKey && process.env.OLLAMA_API_KEY) {
    cfg.cloud.apiKey = String(process.env.OLLAMA_API_KEY).trim();
    console.log('[config] API anahtari OLLAMA_API_KEY ortam degiskeninden alindi');
  }
  const envMode = cfgMode(String(process.env.PROXY_MODE || '').toLowerCase());
  if (envMode) cfg.mode = envMode;
  if (args.mode) cfg.mode = args.mode;
  const envPort = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : null;
  if (envPort !== null) cfg.port = cfgNum(envPort, 1, 65535, cfg.port);
  if (args.port !== null) cfg.port = args.port;

  const server = createServer(cfg, paths.dataDir, paths.cfgPath);
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`[hata] port ${cfg.port} dolu. Eski proxy hala calisiyor olabilir.`);
    } else {
      console.log('[hata] ' + e.message);
    }
    process.exitCode = 1;
  });

  server.listen(cfg.port, '127.0.0.1', () => {
    console.log(`ollama-gateway ${VERSION}`);
    console.log(`proxy: http://127.0.0.1:${cfg.port}`);
    console.log(`mod: ${cfg.mode}  (${upstreamLabel(cfg)})` + (cfg.mode === 'cloud'
      ? `  api key: ${cfg.cloud.apiKey ? 'ayarli' : 'YOK - istekler 401 doner'}`
      : ''));
    console.log('routes (' + cfg.mode + '):');
    for (const [k, v] of Object.entries(activeSection(cfg).modelMap)) console.log(`  ${k} -> ${v}`);
    console.log(`  (fallback) -> ${activeSection(cfg).fallbackModel}`);
    console.log(`panel: http://127.0.0.1:${cfg.port}/admin` + (cfg.admin.token ? '  (sifreli)' : '  (sifresiz)'));
    console.log(`config: ${CFG_FILE}`);
    console.log(`veri: ${DATA_DIR}`);
    console.log(`usage-log: ${cfg.logging.usageLog ? USAGE_LOG : 'KAPALI'}` +
      `  (govde yakalama: ${cfg.logging.fullCapturePerBucket > 0 ? cfg.logging.fullCapturePerBucket + '/bucket' : 'kapali'}` +
      `, prompt basi: ${cfg.logging.promptHeads ? 'acik' : 'kapali'})`);
    if (cfg.logging.fullCapturePerBucket > 0) {
      console.log('[uyari] tam govde yakalama acik: istem ve yanitlar diskte duz metin tutulur -> ' + CAP_DIR);
    }
    console.log(`count_tokens: ${cfg.countTokens.enabled ? 'lokal tahmin' : 'upstream e iletilir'}`);
    console.log(`system-addon: ${cfg.systemAddon.length} talimat`);
    console.log(`block-rules: ${cfg.blockRules.length} kural`);
    maybeRotateLogs();
    upstreamCheckNow(cfg);
    setInterval(() => upstreamCheckNow(cfg), 30000);
    setInterval(maybeRotateLogs, 3600000).unref();
    setInterval(() => buckets.clear(), 6 * 3600000).unref();
  });
}

if (require.main === module) main();

module.exports = {
  VERSION,
  DEFAULTS,
  parseArgs,
  resolvePaths,
  userConfigDir,
  setPaths,
  normalizeLegacy,
  sanitizeConfig,
  mergeDeep,
  cleanModelMap,
  cfgNum,
  cfgMode,
  parseBaseUrl,
  resolveModelFor,
  sameToken,
  publicConfig,
  createServer,
  matchBlock,
  bucketOf,
  textLen,
  applySystemAddon,
  parseUsage,
};
