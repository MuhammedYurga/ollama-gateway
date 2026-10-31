'use strict';

// Static checks on the panel assets. They catch the mistakes that only show up
// in a browser: a missing translation, a reference to an element that does not
// exist, or markup the strict CSP would block.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'panel.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'panel.js'), 'utf8');

const TR_BLOCK = js.slice(js.indexOf('  tr: {'));
const EN_BLOCK = js.slice(js.indexOf('  en: {'), js.indexOf('  tr: {'));

function keysIn(section) {
  return new Set([...section.matchAll(/'([a-zA-Z0-9]+\.[a-zA-Z0-9.]+)':/g)].map((m) => m[1]));
}

test('every data-i18n key has an English and a Turkish string', () => {
  const htmlKeys = new Set([...html.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(htmlKeys.size > 40, 'the panel should carry a real number of keys');
  const en = keysIn(EN_BLOCK);
  const tr = keysIn(TR_BLOCK);
  for (const key of htmlKeys) {
    assert.ok(en.has(key), 'missing English string for ' + key);
    assert.ok(tr.has(key), 'missing Turkish string for ' + key);
  }
  for (const key of en) assert.ok(tr.has(key), 'the Turkish table is missing ' + key);
});

test('every element the panel script looks up exists in the markup', () => {
  const ids = new Set([...js.matchAll(/\$\('([a-zA-Z0-9_-]+)'\)/g)].map((m) => m[1]));
  const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...ids].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], 'panel.js references unknown ids: ' + missing.join(', '));
});

test('every tab has a panel section', () => {
  const literal = js.match(/const TABS = \[([^\]]+)\]/);
  assert.ok(literal, 'the TABS literal is missing');
  const tabs = [...literal[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['overview', 'models', 'filters', 'style', 'logs', 'settings']);
  for (const id of tabs) {
    assert.match(html, new RegExp('id="s-' + id + '"'), 'section missing: ' + id);
    assert.match(html, new RegExp('id="tab-' + id + '"'), 'tab button missing: ' + id);
  }
});

test('the markup keeps the strict CSP working', () => {
  assert.equal(html.includes('<script>'), false, 'no inline script');
  assert.equal(/<[^>]+\son[a-z]+=/i.test(html), false, 'no inline event handlers');
  assert.equal(/<style[^>]*>(?:(?!<\/style>)[\s\S])*?url\(/i.test(html), false, 'no external style url');
  assert.match(html, /<script src="\/admin\/panel\.js"><\/script>/);
});

test('the English markup carries no Turkish-only characters', () => {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.equal(/[çğıöşüÇĞİÖŞÜ]/.test(stripped), false);
});

test('the panel exposes the language switch and the theme metadata', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /data-lang="en"/);
  assert.match(html, /data-lang="tr"/);
  assert.match(html, /name="color-scheme" content="dark"/);
  assert.match(js, /localStorage\.getItem\('gwLang'\)/);
});

test('the panel signs in through a real gate, not a browser prompt', () => {
  assert.match(html, /id="authGate"/);
  assert.match(html, /id="gatePassword"/);
  assert.match(html, /id="gateConfirm"/);
  assert.equal(/\bprompt\(/.test(js), false, 'no blocking browser prompt');
  assert.match(js, /gwSession/);
  assert.match(js, /\/admin\/api\/login/);
  assert.match(js, /\/admin\/api\/public/);
});

test('destructive actions ask for confirmation first', () => {
  for (const id of ['lgClear', 'capClear', 'cfgReset']) {
    const start = js.indexOf("$('" + id + "')");
    const block = js.slice(start, start + 600);
    assert.match(block, /confirm\(/, id + ' should confirm before acting');
  }
});
