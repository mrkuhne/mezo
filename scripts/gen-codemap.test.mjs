// =============================================================================
// gen-codemap.test.mjs — fixture-tree tests for the CODEMAP generator
// =============================================================================
// Run:  node --test scripts/
//
// The generator is convention-driven, so the contract worth pinning is
// "given this tree shape, these facts land in the map". Each test builds a
// throwaway repo skeleton under os.tmpdir() and asserts on the rendered body.
// Dependencies: NONE (node:test + node:assert).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildBody, codemapIssue, renderHeader } from './gen-codemap.mjs';

// ── Fixture helpers ─────────────────────────────────────────────────────────
function write(root, rel, content) {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

const BE = 'backend/src/main/java/io/mrkuhne/mezo/feature';
const BE_TEST = 'backend/src/test/java/io/mrkuhne/mezo/feature';

/** A repo skeleton with one fully-wired `demo` feature across both spaces (backend + contract). */
function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'codemap-'));

  write(root, `${BE}/demo/entity/DemoEntity.java`,
    '@Entity\n@Table(name = "demo_thing")\npublic class DemoEntity extends OwnedEntity {}\n');
  write(root, `${BE}/demo/service/DemoService.java`, 'public class DemoService {}\n');
  write(root, `${BE}/demo/controller/DemoController.java`,
    '@RestController\npublic class DemoController implements DemoApi {}\n');
  write(root, `${BE}/demo/repository/DemoRepository.java`, 'public interface DemoRepository {}\n');
  write(root, `${BE}/demo/mapper/DemoMapper.java`, 'public interface DemoMapper {}\n');
  write(root, `${BE}/demo/config/DemoProperties.java`, 'public record DemoProperties() {}\n');
  write(root, `${BE}/demo/DemoCreated.java`, 'public record DemoCreated() {}\n');

  write(root, 'api/feature/demo/demo.yml', [
    'openapi: 3.0.3',
    'paths:',
    '  /api/demo:',
    '    get:',
    '      tags: [Demo]',
    '      operationId: listDemos',
    '    post:',
    '      tags: [Demo]',
    '      operationId: createDemo',
    '  /api/demo/{id}:',
    '    delete:',
    '      tags: [Demo]',
    '      operationId: deleteDemo',
    '',
  ].join('\n'));

  write(root, `${BE_TEST}/demo/DemoIT.java`,
    'class DemoIT extends ApiIntegrationTest {\n  @Autowired DemoPopulator demoPopulator;\n}\n');

  write(root, 'docs/features/demo.md', [
    '---',
    'title: Demo',
    'status: done',
    'updated: 2026-08-20',
    'key_files:',
    `  - ${BE}/demo`,
    'related: [today]',
    '---',
    '',
    '# Demo',
    '',
  ].join('\n'));

  return root;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('a feature block collects the backend package, its entities and their @Table names', () => {
  const root = makeFixture();
  try {
    const body = buildBody(root);
    assert.match(body, /^### demo\b/m);
    assert.ok(body.includes(`${BE}/demo`), 'backend package path is listed');
    assert.ok(body.includes('`DemoEntity`→`demo_thing`'), 'entity maps to its @Table name');
    assert.ok(body.includes('`DemoService`'), 'services are listed');
    assert.ok(body.includes('`DemoRepository`'), 'repositories are listed');
    assert.ok(body.includes('`DemoMapper`'), 'mappers are listed');
    assert.ok(body.includes('`DemoProperties`'), 'config records are listed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a controller is listed with the generated contract interface it implements', () => {
  const root = makeFixture();
  try {
    assert.ok(buildBody(root).includes('`DemoController`→`DemoApi`'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the contract fragment is bound to the feature via its tag, with method+path lines', () => {
  const root = makeFixture();
  try {
    const body = buildBody(root);
    assert.ok(body.includes('api/feature/demo/demo.yml'), 'fragment path is listed');
    assert.ok(body.includes('GET /api/demo'), 'GET endpoint is listed');
    assert.ok(body.includes('POST /api/demo'), 'POST endpoint is listed');
    assert.ok(body.includes('DELETE /api/demo/{id}'), 'DELETE endpoint is listed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a leftover frontend/ tree is not mapped — the web app is retired (#52)', () => {
  const root = makeFixture();
  try {
    write(root, 'frontend/src/data/ghost/ghostHooks.ts', 'export function useGhost() {}\n');
    write(root, 'frontend/src/features/ghost/pages/GhostPage.tsx', 'export function GhostPage() {}\n');
    const body = buildBody(root);
    assert.ok(!/^### ghost\b/m.test(body), 'a frontend-only directory does not become a feature block');
    assert.ok(!body.includes('frontend/'), 'no frontend path appears anywhere in the map');
    assert.ok(!body.includes('FE data') && !body.includes('FE ui'), 'no FE columns or sections');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('backend integration tests and the populators they use are listed per feature', () => {
  const root = makeFixture();
  try {
    const body = buildBody(root);
    assert.ok(body.includes('`DemoIT`'), 'the IT class is listed');
    assert.ok(body.includes('`DemoPopulator`'), 'populators referenced by the ITs are listed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the feature doc is bound through its key_files paths and carries its updated date', () => {
  const root = makeFixture();
  try {
    const body = buildBody(root);
    assert.ok(body.includes('docs/features/demo.md'), 'the doc is linked from the block');
    assert.ok(body.includes('2026-08-20'), 'the doc updated: date is shown');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a contract fragment whose tag no-one implements is reported under Unaligned', () => {
  const root = makeFixture();
  try {
    write(root, 'api/feature/orphan/orphan.yml', [
      'openapi: 3.0.3',
      'paths:',
      '  /api/orphan:',
      '    get:',
      '      tags: [Orphan]',
      '      operationId: listOrphans',
      '',
    ].join('\n'));
    const body = buildBody(root);
    const unaligned = body.slice(body.indexOf('## Unaligned'));
    assert.ok(body.includes('## Unaligned'), 'the Unaligned section exists');
    assert.ok(unaligned.includes('api/feature/orphan/orphan.yml'), 'the orphan fragment is listed there');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the body is deterministic — the same tree renders byte-identical output', () => {
  const root = makeFixture();
  try {
    assert.equal(buildBody(root), buildBody(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Whole-file validation (mezo-ag1b) ───────────────────────────────────────
// `--check` used to compare only the generated BODY, so unresolved merge-conflict
// markers in the HEADER passed both the local regeneration and CI — twice, onto main.

const BODY = 'generated body\n';
const good = () => renderHeader() + BODY;

test('a byte-identical file is accepted', () => {
  assert.equal(codemapIssue(good(), BODY), null);
});

test('conflict markers in the header are rejected — the case that shipped to main', () => {
  const conflicted = good().replace(
    '# mezo — Codebase Map',
    '<<<<<<< HEAD\n# mezo — Codebase Map\n=======\n# mezo — Codebase Map\n>>>>>>> origin/main',
  );
  assert.notEqual(codemapIssue(conflicted, BODY), null);
  assert.match(codemapIssue(conflicted, BODY), /conflict markers/);
});

test('conflict markers in the body are rejected too', () => {
  const conflicted = renderHeader() + '<<<<<<< HEAD\ngenerated body\n=======\nother\n>>>>>>> origin/main\n';
  assert.match(codemapIssue(conflicted, BODY), /conflict markers/);
});

test('a hand-edited header is rejected even when the body is current', () => {
  const edited = good().replace('# mezo — Codebase Map', '# mezo — Codebase Map (edited by hand)');
  assert.match(codemapIssue(edited, BODY), /header/);
});

test('a missing header block is rejected rather than silently accepted', () => {
  assert.match(codemapIssue(BODY, BODY), /CODEMAP:BODY marker/);
});

test('a stale body is still reported as stale, not as a header problem', () => {
  assert.match(codemapIssue(renderHeader() + 'old body\n', BODY), /stale/);
});

test('a setext heading underline is not mistaken for a conflict marker', () => {
  const body = 'Title\n=======\n';
  assert.equal(codemapIssue(renderHeader() + body, body), null);
});
