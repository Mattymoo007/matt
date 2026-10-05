// The publish gate is the wall between my vault and the internet. These tests guard it.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

// A folder with one published note, one image, and every way a note can fail to be published.
const dir = await mkdtemp(join(tmpdir(), 'matt-gate-'));
const files: Record<string, string> = {
  'README.md': '---\npublish: true\n---\n# Matt\n\nSee [[Hello world]] and [[Secret plan]].\n',
  'notes/Hello world.md': '---\ntitle: Hello world\ndate: 2026-10-05\npublish: true\n---\nFirst note. ![[photo.jpg]]\n',
  'notes/Secret plan.md': '---\npublish: false\n---\nSECRET-draft\n',
  'notes/stringy.md': '---\npublish: "true"\n---\nSECRET-string\n',
  'notes/broken.md': '---\npublish: true\n  bad: [yaml\n---\nSECRET-broken\n',
  'notes/nofm.md': 'SECRET-no-frontmatter\n',
  '.hidden/leak.md': '---\npublish: true\n---\nSECRET-hidden\n',
  'img/photo.jpg': 'jpg',
  '.secret.jpg': 'SECRET-image',
};
for (const [file, src] of Object.entries(files)) {
  await mkdir(dirname(join(dir, file)), { recursive: true });
  await writeFile(join(dir, file), src);
}
process.env.CONTENT_DIR = dir;
const { load } = await import('../src/content.ts');
const { app } = await import('../src/server.ts');

async function get(path: string, accept = 'text/html') {
  const res = await app.request(path, { headers: { accept } });
  return { status: res.status, body: await res.text() };
}

test('only publish: true (a real boolean) is loaded', async () => {
  const { docs, images } = await load();
  assert.deepEqual(docs.map((d) => d.path).sort(), ['', 'notes/hello-world']);
  assert.deepEqual(images, ['img/photo.jpg']);
});

test('nothing private is reachable, as HTML or as markdown', async () => {
  const paths = [
    '/',
    '/README.md',
    '/notes',
    '/notes/hello-world',
    '/notes/hello-world.md',
    '/notes/secret-plan',
    '/notes/secret-plan.md',
    '/notes/stringy',
    '/notes/broken',
    '/notes/nofm',
    '/.hidden/leak',
    '/.hidden/leak.md',
    '/.secret.jpg',
    '/img/%2e%2e/.secret.jpg',
    '/%2e%2e/%2e%2e/etc/passwd',
  ];
  for (const path of paths) {
    for (const accept of ['text/html', '*/*']) {
      const { body } = await get(path, accept);
      assert.ok(!body.includes('SECRET'), `${path} (${accept}) leaked`);
    }
  }
});

test('unpublished notes are 404, published ones 200', async () => {
  for (const path of ['/notes/secret-plan', '/notes/stringy', '/notes/broken', '/notes/nofm', '/.secret.jpg']) {
    assert.equal((await get(path)).status, 404, path);
  }
  for (const path of ['/', '/notes', '/notes/hello-world', '/img/photo.jpg'])
    assert.equal((await get(path)).status, 200, path);
});

test('links to private notes become plain text; images embed', async () => {
  assert.match((await get('/README.md', '*/*')).body, /\[Hello world\]\(\/notes\/hello-world\) and Secret plan\./);
  assert.match((await get('/notes/hello-world.md', '*/*')).body, /!\[photo\]\(\/img\/photo\.jpg\)/);
});

test('curl gets markdown, browsers get HTML', async () => {
  const curl = await app.request('/notes/hello-world', { headers: { accept: '*/*' } });
  assert.match(curl.headers.get('content-type') ?? '', /text\/markdown/);
  assert.match(await curl.text(), /^# Hello world/);
  assert.match((await get('/notes/hello-world')).body, /^<!doctype html>/);
});
