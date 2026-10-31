'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULTS,
  sanitizeConfig,
  mergeDeep,
  parseBaseUrl,
  resolveModelFor,
  sameToken,
  publicConfig,
  matchBlock,
  applySystemAddon,
  parseUsage,
  textLen,
  cfgNum,
} = require('../anthropic-proxy.js');

test('published defaults are neutral', () => {
  assert.deepEqual(DEFAULTS.systemAddon, []);
  assert.deepEqual(DEFAULTS.blockRules, []);
  assert.equal(DEFAULTS.logging.fullCapturePerBucket, 0);
  assert.equal(DEFAULTS.logging.promptHeads, false);
  assert.equal(DEFAULTS.logging.probeOutValue, 0);
  assert.equal(DEFAULTS.admin.token, '');
});

test('legacy local config is migrated', () => {
  const { config } = sanitizeConfig({
    port: 9001,
    ollamaHost: '10.0.0.2',
    ollamaPort: 1234,
    modelMap: { 'claude-opus-5': 'qwen3:8b' },
    fallbackModel: 'qwen3:8b',
    systemAddon: ['keep'],
  });
  assert.equal(config.mode, 'local');
  assert.equal(config.port, 9001);
  assert.equal(config.local.host, '10.0.0.2');
  assert.equal(config.local.port, 1234);
  assert.equal(config.local.modelMap['claude-opus-5'], 'qwen3:8b');
  assert.deepEqual(config.systemAddon, ['keep']);
});

test('legacy cloud config is migrated', () => {
  const { config } = sanitizeConfig({
    port: 8788,
    apiKey: 'k-123',
    modelMap: { 'claude-opus-5': 'gpt-oss:120b' },
    fallbackModel: 'gpt-oss:120b',
  });
  assert.equal(config.mode, 'cloud');
  assert.equal(config.cloud.apiKey, 'k-123');
  assert.equal(config.cloud.baseUrl, 'https://ollama.com');
  assert.equal(config.cloud.fallbackModel, 'gpt-oss:120b');
});

test('numeric values are clamped and the admin token is trimmed', () => {
  const { config } = sanitizeConfig({
    port: 70000,
    local: { port: -5 },
    admin: { token: '  secret  ' },
    upstreamTimeoutMs: 10,
  });
  assert.equal(config.port, 65535);
  assert.equal(config.local.port, 1);
  assert.equal(config.admin.token, 'secret');
  assert.equal(config.upstreamTimeoutMs, 1000);
  assert.equal(cfgNum('nope', 1, 10, 7), 7);
});

test('unconditional block rules are rejected', () => {
  const { config, warnings } = sanitizeConfig({
    blockRules: [{ name: 'everything' }],
  });
  assert.deepEqual(config.blockRules, []);
  assert.equal(warnings.length, 1);
});

test('block rules keep their matcher fields', () => {
  const { config } = sanitizeConfig({
    blockRules: [{ name: 'x', enabled: false, maxTokens: 64, sysContains: 'marker' }],
  });
  assert.deepEqual(config.blockRules, [
    { name: 'x', enabled: false, maxTokens: 64, sysContains: 'marker' },
  ]);
});

test('prompt heads are opt-in only', () => {
  assert.equal(sanitizeConfig({ logging: { promptHeads: 'yes' } }).config.logging.promptHeads, false);
  assert.equal(sanitizeConfig({ logging: { promptHeads: true } }).config.logging.promptHeads, true);
});

test('model maps are cleaned', () => {
  const { config } = sanitizeConfig({
    local: { modelMap: { ' claude-opus-5 ': ' qwen3:8b ', bad: 3, '': 'x' } },
  });
  assert.deepEqual(config.local.modelMap, { 'claude-opus-5': 'qwen3:8b' });
});

test('deep merge preserves nested fields', () => {
  const base = {
    local: { host: '127.0.0.1', port: 11434, modelMap: { a: 'b' }, fallbackModel: 'b' },
    logging: { usageLog: true, promptHeads: true },
  };
  const merged = mergeDeep(base, { local: { modelMap: { c: 'd' } }, logging: { usageLog: false } });
  assert.equal(merged.local.host, '127.0.0.1');
  assert.equal(merged.local.port, 11434);
  assert.deepEqual(merged.local.modelMap, { a: 'b', c: 'd' });
  assert.equal(merged.logging.usageLog, false);
  assert.equal(merged.logging.promptHeads, true);
});

test('base URL parsing handles prefixes and rejects non-http schemes', () => {
  assert.deepEqual(parseBaseUrl('https://ollama.com'), {
    proto: 'https', hostname: 'ollama.com', port: 443, prefix: '',
  });
  assert.deepEqual(parseBaseUrl('http://127.0.0.1:11434/api/'), {
    proto: 'http', hostname: '127.0.0.1', port: 11434, prefix: '/api',
  });
  assert.equal(parseBaseUrl('ftp://example.com'), null);
  assert.equal(parseBaseUrl('not a url'), null);
  assert.equal(parseBaseUrl(''), null);
});

test('model resolution uses the selected mode and falls back safely', () => {
  const section = { modelMap: { 'claude-opus-5': 'mapped' }, fallbackModel: 'fallback' };
  assert.equal(resolveModelFor(section, 'claude-opus-5'), 'mapped');
  assert.equal(resolveModelFor(section, 'unknown'), 'fallback');
  assert.equal(resolveModelFor({ modelMap: {}, fallbackModel: '' }, 'kept'), 'kept');
  assert.equal(resolveModelFor(null, 'kept'), 'kept');
});

test('token comparison is constant-time friendly and correct', () => {
  assert.equal(sameToken('abc', 'abc'), true);
  assert.equal(sameToken('abc', 'abd'), false);
  assert.equal(sameToken('abc', 'abcdef'), false);
});

test('public config never exposes secrets', () => {
  const cfg = {
    mode: 'cloud',
    port: 8799,
    local: { host: '127.0.0.1', port: 11434, modelMap: {}, fallbackModel: 'x' },
    cloud: { baseUrl: 'https://ollama.com', apiKey: 'secret', modelMap: {}, fallbackModel: 'x' },
    admin: { token: 'pw' },
  };
  const pub = publicConfig(cfg);
  assert.equal(pub.cloud.apiKey, '');
  assert.equal(pub.cloud.apiKeySet, true);
  assert.equal(pub.admin.token, '');
  assert.equal(pub.admin.tokenSet, true);
  assert.equal(cfg.cloud.apiKey, 'secret');
});

test('block matcher honours enabled, max_tokens and system marker', () => {
  const c = {
    blockRules: [
      { name: 'off', enabled: false, maxTokens: 64, sysContains: 'm' },
      { name: 'hit', enabled: true, maxTokens: 64, sysContains: 'marker' },
    ],
  };
  assert.equal(matchBlock({ max_tokens: 64, system: 'has marker' }, c), 'hit');
  assert.equal(matchBlock({ max_tokens: 32, system: 'has marker' }, c), null);
  assert.equal(matchBlock({ max_tokens: 64, system: 'other' }, c), null);
});

test('system addon keeps cached blocks byte-identical', () => {
  const c = { systemAddon: ['rule one'] };
  const j1 = { system: 'base' };
  applySystemAddon(j1, c);
  assert.match(j1.system, /^base\n\n# STYLE INSTRUCTIONS/);
  assert.match(j1.system, /rule one/);

  const cached = { type: 'text', text: 'cached', cache_control: { type: 'ephemeral' } };
  const j2 = { system: [cached] };
  applySystemAddon(j2, c);
  assert.equal(j2.system[0], cached);
  assert.equal(j2.system[1].type, 'text');
  assert.match(j2.system[1].text, /rule one/);

  const j3 = {};
  applySystemAddon(j3, c);
  assert.match(j3.system, /rule one/);
});

test('usage parsing handles JSON and SSE bodies', () => {
  assert.deepEqual(parseUsage(JSON.stringify({ usage: { input_tokens: 5, output_tokens: 2 } })),
    { inp: 5, out: 2 });
  const sse = 'event: x\ndata: {"usage":{"input_tokens":7,"output_tokens":1}}\n\n' +
              'event: y\ndata: {"usage":{"output_tokens":9}}\n\n';
  assert.deepEqual(parseUsage(sse), { inp: 7, out: 9 });
});

test('text length ignores object keys', () => {
  assert.equal(textLen({ a: 'hello', b: ['x', 12] }), 8);
  assert.equal(textLen(null), 0);
});
