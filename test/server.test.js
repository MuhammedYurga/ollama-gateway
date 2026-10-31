'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createServer, sanitizeConfig, mergeDeep } = require('../anthropic-proxy.js');

function jsonResponse(res, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function startUpstream(handler) {
  return new Promise((resolve) => {
    const seen = [];
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const rec = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        };
        seen.push(rec);
        handler(req, res, rec);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, seen }));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function request(port, target, opts = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(opts.headers || {}) };
    const body = opts.body;
    if (body != null) headers['content-length'] = Buffer.byteLength(body);
    const rq = http.request({ host: '127.0.0.1', port, path: target, method: opts.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    rq.on('error', reject);
    if (body != null) rq.write(body);
    rq.end();
  });
}

function baseConfig(overrides) {
  const base = {
    mode: 'local',
    port: 8799,
    local: {
      host: '127.0.0.1',
      port: 11434,
      modelMap: { 'claude-opus-5': 'mapped-model' },
      fallbackModel: 'fallback-model',
    },
    cloud: {
      baseUrl: 'https://ollama.com',
      apiKey: '',
      modelMap: {},
      fallbackModel: 'cloud-model',
    },
    systemAddon: [],
    blockRules: [],
    titleFix: { enabled: false, sysContains: 'never', minTokens: 1 },
    countTokens: { enabled: true, charsPerToken: 4 },
    logging: { usageLog: false, promptHeads: false, fullCapturePerBucket: 0, capFileLimit: 0, probeOutValue: 0 },
    admin: { token: '' },
  };
  return sanitizeConfig(mergeDeep(base, overrides || {})).config;
}

async function withProxy(overrides, fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omg-'));
  const config = baseConfig(overrides);
  const server = createServer(config, dataDir, path.join(dataDir, 'config.json'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    return await fn({ config, port });
  } finally {
    await closeServer(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test('local mode maps the model, applies the addon and strips client credentials', async () => {
  const up = await startUpstream((req, res, rec) => {
    const parsed = JSON.parse(rec.body);
    jsonResponse(res, {
      id: 'msg_test', type: 'message', role: 'assistant', model: parsed.model,
      content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn',
      usage: { input_tokens: 4, output_tokens: 1 },
    });
  });
  try {
    await withProxy({ local: { port: up.port }, systemAddon: ['TEST-ADDON'] }, async ({ port }) => {
      const r = await request(port, '/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'client-anthropic-key',
          authorization: 'Bearer client-secret',
        },
        body: JSON.stringify({
          model: 'claude-opus-5',
          max_tokens: 32,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      assert.equal(r.status, 200);
      assert.equal(up.seen.length, 1);
      const sent = JSON.parse(up.seen[0].body);
      assert.equal(sent.model, 'mapped-model');
      assert.match(sent.system, /TEST-ADDON/);
      assert.equal(up.seen[0].headers['x-api-key'], undefined);
      assert.equal(up.seen[0].headers.authorization, undefined);
      assert.equal(JSON.parse(r.body).content[0].text, 'ok');
    });
  } finally {
    await closeServer(up.server);
  }
});

test('streaming responses pass through unchanged', async () => {
  const up = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('event: message_start\ndata: {"type":"message_start"}\n\n');
    res.end('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  });
  try {
    await withProxy({ local: { port: up.port } }, async ({ port }) => {
      const r = await request(port, '/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-5', max_tokens: 8, stream: true,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      assert.equal(r.status, 200);
      assert.match(r.body, /message_start/);
      assert.match(r.body, /message_stop/);
    });
  } finally {
    await closeServer(up.server);
  }
});

test('count_tokens is estimated locally without calling the upstream', async () => {
  const up = await startUpstream((req, res) => jsonResponse(res, { input_tokens: 999 }));
  try {
    await withProxy({ local: { port: up.port } }, async ({ port }) => {
      const r = await request(port, '/v1/messages/count_tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hello world' }] }),
      });
      assert.equal(r.status, 200);
      assert.ok(JSON.parse(r.body).input_tokens > 0);
      assert.equal(up.seen.length, 0);
    });
  } finally {
    await closeServer(up.server);
  }
});

test('a matching request filter returns an empty valid answer and skips the upstream', async () => {
  const up = await startUpstream((req, res) => jsonResponse(res, { ok: true }));
  try {
    const rules = [{ name: 'filter', enabled: true, maxTokens: 64, sysContains: 'FILTER-ME' }];
    await withProxy({ local: { port: up.port }, blockRules: rules }, async ({ port }) => {
      const blocked = await request(port, '/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-5', max_tokens: 64, system: 'FILTER-ME',
          messages: [{ role: 'user', content: 'x' }],
        }),
      });
      assert.equal(blocked.status, 200);
      assert.equal(JSON.parse(blocked.body).content[0].text, '');
      assert.equal(up.seen.length, 0);

      const allowed = await request(port, '/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-5', max_tokens: 32, system: 'FILTER-ME',
          messages: [{ role: 'user', content: 'x' }],
        }),
      });
      assert.equal(allowed.status, 200);
      assert.equal(up.seen.length, 1);
    });
  } finally {
    await closeServer(up.server);
  }
});

test('cloud mode sends the Ollama bearer key and uses the cloud model map', async () => {
  const up = await startUpstream((req, res, rec) => {
    const parsed = JSON.parse(rec.body);
    jsonResponse(res, {
      id: 'msg_cloud', type: 'message', role: 'assistant', model: parsed.model,
      content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  try {
    await withProxy({
      mode: 'cloud',
      cloud: { baseUrl: 'http://127.0.0.1:' + up.port, apiKey: 'cloud-key', modelMap: {}, fallbackModel: 'cloud-model' },
    }, async ({ port }) => {
      const r = await request(port, '/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'client-key', authorization: 'Bearer client' },
        body: JSON.stringify({ model: 'claude-opus-5', max_tokens: 8, messages: [{ role: 'user', content: 'hi' }] }),
      });
      assert.equal(r.status, 200);
      assert.equal(up.seen.length, 1);
      assert.equal(up.seen[0].headers.authorization, 'Bearer cloud-key');
      assert.equal(up.seen[0].headers['x-api-key'], undefined);
      assert.equal(JSON.parse(up.seen[0].body).model, 'cloud-model');
    });
  } finally {
    await closeServer(up.server);
  }
});

test('admin config hides the API key and the panel password', async () => {
  await withProxy({ cloud: { apiKey: 'top-secret-key' }, admin: { token: 'panel-pw' } }, async ({ port }) => {
    const r = await request(port, '/admin/api/config', { headers: { 'x-admin-token': 'panel-pw' } });
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.equal(body.config.cloud.apiKey, '');
    assert.equal(body.config.cloud.apiKeySet, true);
    assert.equal(body.config.admin.token, '');
    assert.equal(body.config.admin.tokenSet, true);
    assert.equal(r.body.includes('top-secret-key'), false);
    assert.equal(r.body.includes('panel-pw'), false);
  });
});

test('admin auth accepts only the header token', async () => {
  await withProxy({ admin: { token: 'panel-pw' } }, async ({ port }) => {
    assert.equal((await request(port, '/admin/api/config')).status, 401);
    assert.equal((await request(port, '/admin/api/config', { headers: { 'x-admin-token': 'wrong' } })).status, 401);
    assert.equal((await request(port, '/admin/api/config?token=panel-pw')).status, 401);
    assert.equal((await request(port, '/admin/api/config', { headers: { 'x-admin-token': 'panel-pw' } })).status, 200);
  });
});

test('admin write endpoints reject cross-origin and non-JSON requests', async () => {
  await withProxy({}, async ({ port }) => {
    const plain = await request(port, '/admin/api/config', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ mode: 'cloud' }),
    });
    assert.equal(plain.status, 415);

    const evil = await request(port, '/admin/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
      body: JSON.stringify({ mode: 'cloud' }),
    });
    assert.equal(evil.status, 403);

    const ok = await request(port, '/admin/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:' + port },
      body: JSON.stringify({ mode: 'cloud' }),
    });
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body).config.mode, 'cloud');
  });
});

test('saving a model map replaces it instead of merging old rows back in', async () => {
  const up = await startUpstream((req, res, rec) => {
    if (req.method === 'GET') return jsonResponse(res, { object: 'list', data: [] });
    const parsed = JSON.parse(rec.body);
    jsonResponse(res, {
      id: 'msg_map', type: 'message', role: 'assistant', model: parsed.model,
      content: [], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  try {
    await withProxy({
      local: { port: up.port, modelMap: { 'claude-opus-5': 'old-model' }, fallbackModel: 'old-model' },
    }, async ({ port }) => {
      const save = await request(port, '/admin/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:' + port },
        body: JSON.stringify({ local: { modelMap: { 'claude-opus-5': 'new-model' }, fallbackModel: 'new-model' } }),
      });
      assert.equal(save.status, 200);
      assert.deepEqual(JSON.parse(save.body).config.local.modelMap, { 'claude-opus-5': 'new-model' });

      await request(port, '/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-5', max_tokens: 8, messages: [{ role: 'user', content: 'hi' }] }),
      });
      const sent = up.seen.find((s) => s.method === 'POST' && s.url === '/v1/messages');
      assert.ok(sent);
      assert.equal(JSON.parse(sent.body).model, 'new-model');
    });
  } finally {
    await closeServer(up.server);
  }
});

test('admin endpoints reject a foreign Host header', async () => {
  await withProxy({}, async ({ port }) => {
    const r = await request(port, '/admin/api/config', { headers: { host: 'evil.example:' + port } });
    assert.equal(r.status, 403);
  });
});

test('panel HTML uses an external script and is served with a strict CSP', async () => {
  await withProxy({}, async ({ port }) => {
    const html = await request(port, '/admin');
    assert.equal(html.status, 200);
    assert.match(html.body, /src="\/admin\/panel\.js"/);
    assert.equal(html.body.includes('<script>'), false);
    assert.match(html.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(html.headers['x-frame-options'], 'DENY');

    const js = await request(port, '/admin/panel.js');
    assert.equal(js.status, 200);
    assert.match(js.headers['content-type'], /application\/javascript/);
    assert.match(js.body, /sessionStorage/);
  });
});
