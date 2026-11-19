import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── paths ────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCRIPT = path.join(REPO_ROOT, '.github', 'scripts', 'pr-hygiene.mjs');
const REAL_CONFIG = path.join(REPO_ROOT, '.github', 'pr-hygiene.json');
const REAL_TMPL_DIR = path.join(REPO_ROOT, '.github', 'PULL_REQUEST_TEMPLATE');

// ── helpers ──────────────────────────────────────────────────────────────

function runScript(env) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

/**
 * Create a temp fixture dir containing config.json + templates/<default>.md.
 * Returns { dir, configFile, tmplDir }.
 */
function createFixture(name, templateContent, configOverride = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), `pr-hygiene-${name}-`));
  const tmplDir = path.join(dir, 'templates');
  mkdirSync(tmplDir, { recursive: true });
  const config = { default: 'fixture.md', ...configOverride };
  writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config), 'utf8');
  writeFileSync(path.join(tmplDir, config.default), templateContent, 'utf8');
  return { dir, tmplDir };
}

function fixtureEnv(fixture, extra = {}) {
  return {
    PR_HYGIENE_CONFIG: path.join(fixture.dir, 'config.json'),
    PR_TEMPLATE_DIR: fixture.tmplDir,
    ...extra,
  };
}

// Parses headings from markdown text (strips front-matter first).
function parseHeadings(text) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const headings = [];
  let fence = null;
  for (const line of body.split('\n')) {
    const fm = /^\s*(```+|~~~+)/.exec(line);
    if (fm) {
      const m = fm[1][0];
      if (fence === null) fence = m;
      else if (fence === m) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) headings.push({ level: m[1].length, title: m[2].trim() });
  }
  return headings;
}

// ── fixture templates ────────────────────────────────────────────────────

const FLAT_TMPL = `---
name: Flat Test
about: flat template with 3 H2 + 2 H3 subsections
---

## Section A

> Section A hint.

## 需要人工测试的地方

> Manual test hint.

### 子段1

> Sub 1 hint.

### 子段2

> Sub 2 hint.

## Section C

> Section C hint.
`;

const WRAPPER_TMPL = `---
name: Wrapper Test
about: wrapper template (1 H2 + 3 H3, last optional)
---

## Wrapper Title

> Wrapper hint — title not checked, only H3 subsections matter.

### Wrapped A

> A hint.

### Wrapped B

> B hint.

### Wrapped C

<!-- optional -->

> C hint.
`;

const FENCED_TMPL = `---
name: Fenced Test
about: template with code fence containing a fake heading
---

## Real Section 1

> hint.

## Real Section 2

> hint.

\`\`\`markdown
## 这段不该被派生
\`\`\`

## Real Section 3

> hint.
`;

// ── body builders ────────────────────────────────────────────────────────

// Flat template: fill all 3 H2 sections + 2 H3 subsections with substance.
const FLAT_FILLED = `## Section A

This has real substance.

## 需要人工测试的地方

Manual test substance here.

### 子段1

Sub 1 filled.

### 子段2

Sub 2 filled.

## Section C

Also filled.
`;

// Flat template: missing "Section C"
const FLAT_MISSING_C = `## Section A

Filled.

## 需要人工测试的地方

Filled.

### 子段1

Filled.

### 子段2

Filled.
`;

// Wrapper template: all filled
const WRAPPER_FILLED = `## Any Wrapper

Intro text.

### Wrapped A

Content A.

### Wrapped B

Content B.

### Wrapped C

Content C.
`;

// Wrapper template: missing "Wrapped B"
const WRAPPER_MISSING_B = `## Any Wrapper

Intro text.

### Wrapped A

Content A.

### Wrapped C

Content C.
`;

// Wrapper template: "Wrapped C" present but empty (only > hints)
const WRAPPER_EMPTY_C = `## Any Wrapper

Intro text.

### Wrapped A

Content A.

### Wrapped B

Content B.

### Wrapped C

> Only hint, no substance.
`;

// Wrapper template: ALL sections except optional "Wrapped C", which is absent
const WRAPPER_NO_OPT = `## Any Wrapper

Intro text.

### Wrapped A

Content A.

### Wrapped B

Content B.
`;

// ── tests ────────────────────────────────────────────────────────────────

describe('pr-hygiene gate', { concurrency: false }, () => {
  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 1: artifacts — real repo files exist and are well-formed
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 1 · artifacts existence', () => {
    it('script file exists', () => {
      const s = spawnSync('test', ['-f', SCRIPT]);
      assert.equal(s.status, 0, 'script must exist');
    });

    it('config is valid JSON with default field', () => {
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      assert.ok(typeof cfg === 'object' && cfg !== null);
      assert.ok(typeof cfg.default === 'string' && cfg.default.length > 0,
        'config must have non-empty default');
    });

    it('default template file exists', () => {
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      const tmpl = path.join(REAL_TMPL_DIR, cfg.default);
      const s = spawnSync('test', ['-f', tmpl]);
      assert.equal(s.status, 0, `template ${cfg.default} must exist`);
    });

    it('config has NO byBase field (wechat-app only line: main)', () => {
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      assert.ok(!('byBase' in cfg), 'wechat-app config must not have byBase');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 2: flat template → H2 section derivation
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 2 · flat template H2 derivation', () => {
    /** @type {ReturnType<typeof createFixture>} */
    let fx;
    before(() => { fx = createFixture('flat', FLAT_TMPL); });

    it('all sections filled → exit 0', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: FLAT_FILLED,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落 3\/3 齐备/);
      assert.match(r.stdout, /子段 2\/2 有实质内容/);
    });

    it('missing Section C → exit 1 with section name', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: FLAT_MISSING_C,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1);
      assert.match(r.stdout, /缺少必需段落：.*Section C/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 3: wrapper template → H3 section derivation
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 3 · wrapper template H3 derivation', () => {
    /** @type {ReturnType<typeof createFixture>} */
    let fx;
    before(() => { fx = createFixture('wrap', WRAPPER_TMPL); });

    it('all H3 sections filled, wrapper title changed → exit 0', () => {
      // Body has a different wrapper H2 title than template; still passes
      // because wrapper title is not checked — only H3 sections matter.
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: WRAPPER_FILLED,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      // All 3 H3 sections present and filled (including optional Wrapped C) → 3/3
      assert.match(r.stdout, /✓ 必需段落 3\/3 齐备/);
    });

    it('missing Wrapped B → exit 1 with section name', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: WRAPPER_MISSING_B,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1);
      assert.match(r.stdout, /缺少必需段落：.*Wrapped B/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 4: <!-- optional --> marker
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 4 · optional sections', () => {
    /** @type {ReturnType<typeof createFixture>} */
    let fx;
    before(() => { fx = createFixture('opt', WRAPPER_TMPL); });

    it('optional section absent → exit 0', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: WRAPPER_NO_OPT,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落 2\/2 齐备/);
      assert.match(r.stdout, /optional 段缺席 1 个/);
    });

    it('optional section present but empty → exit 1', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: WRAPPER_EMPTY_C,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1);
      assert.match(r.stdout, /段落为空.*Wrapped C/);
    });

    it('non-optional section missing → exit 1 (control group)', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: WRAPPER_MISSING_B,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1);
      assert.match(r.stdout, /缺少必需段落：.*Wrapped B/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 5: base→template mapping (real config, no byBase)
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 5 · base → template mapping', () => {
    // Uses the real config (no byBase) → all base values use default.
    // We construct a filled body that matches the real template.
    // Because the real template is not yet written when this test file
    // is first run, these tests will naturally be RED in the TDD cycle.
    // After the template is created, they turn GREEN.

    it('PR_BASE=main → default template (exit 0 with filled body)', () => {
      // Read real template, derive sections, and construct a filled body.
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      const tmplText = readFileSync(path.join(REAL_TMPL_DIR, cfg.default), 'utf8');
      const headings = parseHeadings(tmplText);
      // Build a body that fills every heading with substance.
      let body = '';
      for (const h of headings) {
        body += `${'#'.repeat(h.level)} ${h.title}\n\nSubstance for ${h.title}.\n\n`;
      }
      const r = runScript({
        PR_BODY: body.trimEnd(),
        PR_BASE: 'main',
      });
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落/);
    });

    it('PR_BASE=staging → also uses default (no byBase)', () => {
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      const tmplText = readFileSync(path.join(REAL_TMPL_DIR, cfg.default), 'utf8');
      const headings = parseHeadings(tmplText);
      let body = '';
      for (const h of headings) {
        body += `${'#'.repeat(h.level)} ${h.title}\n\nSubstance for ${h.title}.\n\n`;
      }
      const r = runScript({
        PR_BODY: body.trimEnd(),
        PR_BASE: 'staging',
      });
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落/);
    });

    it('PR_BASE=feat/xxx (stacked PR) → also uses default', () => {
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      const tmplText = readFileSync(path.join(REAL_TMPL_DIR, cfg.default), 'utf8');
      const headings = parseHeadings(tmplText);
      let body = '';
      for (const h of headings) {
        body += `${'#'.repeat(h.level)} ${h.title}\n\nSubstance for ${h.title}.\n\n`;
      }
      const r = runScript({
        PR_BODY: body.trimEnd(),
        PR_BASE: 'feat/xxx',
      });
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 6: body level tolerance
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 6 · body level tolerance', () => {
    /** @type {ReturnType<typeof createFixture>} */
    let fx;
    before(() => { fx = createFixture('lvl', FLAT_TMPL); });

    it('H2 sections → passes (standard flat form)', () => {
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: FLAT_FILLED,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落 3\/3 齐备/);
    });

    it('H2 wrapper + H3 sections → also passes (tolerance)', () => {
      const nestedBody = `## Any Wrapper

Wrapper content.

### Section A

Content A.

### 需要人工测试的地方

Manual test content.

#### 子段1

Sub 1 content.

#### 子段2

Sub 2 content.

### Section C

Content C.
`;
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: nestedBody,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落 3\/3 齐备/);
      assert.match(r.stdout, /子段 2\/2 有实质内容/);
    });

    it('H4 section → not recognized (exit 1)', () => {
      // All sections at H4 — none match SECTION_LEVELS [2,3]
      const h4Body = `#### Section A

Content.

#### 需要人工测试的地方

Content.

#### Section C

Content.
`;
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: h4Body,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1);
      // All 3 sections missing because H4 is not recognized
      assert.match(r.stdout, /缺少必需段落：/);
    });

    it('subsection at any depth below parent → passes', () => {
      // Subsection at H5 (3 levels below H2 wrapper) still passes
      const deepBody = `## Any Wrapper

Intro.

### Section A

Content A.

### 需要人工测试的地方

Manual content.

##### 子段1

Sub 1 content.

##### 子段2

Sub 2 content.

### Section C

Content C.
`;
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: deepBody,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落 3\/3 齐备/);
      assert.match(r.stdout, /子段 2\/2 有实质内容/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 7: fail-open boundaries
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 7 · fail-open boundaries', () => {
    it('PR_BODY undefined → exit 0 + fail-open', () => {
      const r = runScript({ PR_BASE: 'main' });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fail-open/);
    });

    it('PR_BODY_FILE points to nonexistent file → exit 0 + fail-open', () => {
      const r = runScript({
        PR_BODY_FILE: '/tmp/nonexistent-pr-body-99999.md',
        PR_BASE: 'main',
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fail-open/);
    });

    it('config file missing → exit 0 + fail-open', () => {
      const r = runScript({
        PR_HYGIENE_CONFIG: '/tmp/nonexistent-config-99999.json',
        PR_BODY: 'anything',
        PR_BASE: 'main',
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fail-open/);
    });

    it('config is malformed JSON → exit 0 + fail-open', () => {
      const d = mkdtempSync(path.join(tmpdir(), 'pr-hygiene-mal-'));
      writeFileSync(path.join(d, 'bad.json'), 'not json {{{');
      const r = runScript({
        PR_HYGIENE_CONFIG: path.join(d, 'bad.json'),
        PR_BODY: 'anything',
        PR_BASE: 'main',
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fail-open/);
    });

    it('config missing default field → exit 0 + fail-open', () => {
      const d = mkdtempSync(path.join(tmpdir(), 'pr-hygiene-nodef-'));
      writeFileSync(path.join(d, 'cfg.json'), '{"byBase": {}}');
      const r = runScript({
        PR_HYGIENE_CONFIG: path.join(d, 'cfg.json'),
        PR_BODY: 'anything',
        PR_BASE: 'main',
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fail-open/);
      assert.match(r.stdout, /缺 default/);
    });

    it('default points to nonexistent template → exit 0 + fail-open', () => {
      const d = mkdtempSync(path.join(tmpdir(), 'pr-hygiene-notmpl-'));
      writeFileSync(path.join(d, 'cfg.json'), '{"default": "ghost.md"}');
      const r = runScript({
        PR_HYGIENE_CONFIG: path.join(d, 'cfg.json'),
        PR_TEMPLATE_DIR: d,
        PR_BODY: 'anything',
        PR_BASE: 'main',
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fail-open/);
    });

    it('PR_BODY empty string → exit 1 (not fail-open)', () => {
      /** @type {ReturnType<typeof createFixture>} */
      const fx = createFixture('emptybody', FLAT_TMPL);
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: '',
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1, 'empty body = missing all sections → exit 1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 8: real template self-check
  // ═══════════════════════════════════════════════════════════════════════
  describe('group 8 · real template self-check', () => {
    it('empty template as body → exit 1 + ≥7 missing sections', function () {
      // This test uses the real template and config. If they don't exist
      // yet, this naturally fails (RED in TDD cycle).
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      const tmplText = readFileSync(path.join(REAL_TMPL_DIR, cfg.default), 'utf8');
      const r = runScript({
        PR_BODY: tmplText,
        PR_BASE: 'main',
      });
      assert.equal(r.status, 1,
        `empty template must be rejected (exit 1), got ${r.status}\nstdout: ${r.stdout}`);
      // The output lists both empty sections and empty subsections:
      // "✗ 段落为空（只剩模板提示行或空白）：Sec1、Sec2、..."
      // "✗ 子段为空（只剩模板提示行或空白）：Parent → Sub1、Parent → Sub2"
      // Count items from both lines. Real template has 6 empty H2 sections
      // (需要人工测试的地方 passes because H3 heading text counts as substance)
      // + 2 empty H3 subsections = 8 ≥ 7.
      // 用 includes() + split() 逐行取段名，不用正则：输出行是
      // "✗ 段落为空（只剩模板提示行或空白）：Sec1、Sec2"，`段落为空` 与全角冒号之间
      // 还夹着括号说明，/段落为空[：:]/ 这种紧邻写法匹配不到。
      const named = [];
      for (const line of r.stdout.split('\n')) {
        if (line.includes('段落为空') || line.includes('子段为空') || line.includes('缺少必需段落')) {
          const idx = line.indexOf('：');
          if (idx >= 0) named.push(...line.slice(idx + 1).trim().split('、'));
        }
      }
      assert.ok(named.length >= 7,
        `expected ≥7 missing sections, got ${named.length}: ${named.join(', ')}\nstdout: ${r.stdout}`);
    });

    it('manual test section has exactly 2 subsections', () => {
      // Parse the real template and verify the "需要人工测试的地方" section
      // has exactly 2 H3 (or deeper) subsections.
      const cfg = JSON.parse(readFileSync(REAL_CONFIG, 'utf8'));
      const tmplText = readFileSync(path.join(REAL_TMPL_DIR, cfg.default), 'utf8');
      const headings = parseHeadings(tmplText);

      // Find the manual test section
      const manualIdx = headings.findIndex(
        h => h.title === '需要人工测试的地方' || h.title.startsWith('需要人工测试')
      );
      assert.ok(manualIdx >= 0, 'template must have 需要人工测试 section');

      const manualLevel = headings[manualIdx].level;
      // Count subsections: any heading after manualIdx, before next heading
      // at same or higher level, with level = manualLevel + 1
      let subCount = 0;
      for (let i = manualIdx + 1; i < headings.length; i++) {
        if (headings[i].level <= manualLevel) break;
        if (headings[i].level === manualLevel + 1) subCount++;
      }
      assert.equal(subCount, 2,
        `manual test subsections must be exactly 2, got ${subCount}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // BONUS: fenced template — code fences don't pollute section derivation
  // ═══════════════════════════════════════════════════════════════════════
  describe('fenced template · code fence isolation', () => {
    /** @type {ReturnType<typeof createFixture>} */
    let fx;
    before(() => { fx = createFixture('fence', FENCED_TMPL); });

    it('only real sections are derived (3, not 4)', () => {
      // The fixture has 3 real H2 sections + 1 fake inside a code fence.
      // The body fills all 3 real sections.
      const filled = `## Real Section 1

Content 1.

## Real Section 2

Content 2.

## Real Section 3

Content 3.
`;
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: filled,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 0, `exit 0 expected, got ${r.status}\n${r.stdout}`);
      assert.match(r.stdout, /✓ 必需段落 3\/3 齐备/);
    });

    it('missing a real section → exit 1', () => {
      const missing2 = `## Real Section 1

Content 1.

## Real Section 3

Content 3.
`;
      const r = runScript(fixtureEnv(fx, {
        PR_BODY: missing2,
        PR_BASE: 'main',
      }));
      assert.equal(r.status, 1);
      assert.match(r.stdout, /缺少必需段落：.*Real Section 2/);
    });
  });
});
