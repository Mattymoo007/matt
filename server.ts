import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { CONTENT_DIR, findImage, imageUrl, images, isImage, load, toHtml, toMarkdown, type Doc } from './content.ts';
import { describe, dirBody, fileName, homeBody, missingBody, page, textDoc, textLs } from './view.ts';

const app = new Hono();

// Shown until README.md in the folder is published.
const PLACEHOLDER: Doc = {
  path: '', file: 'README.md', dir: '', title: 'Matt Bracke', data: {}, modified: new Date(),
  body: '# Matt Bracke\n\n`~/matt` is being built in public: [github.com/Mattymoo007/matt](https://github.com/Mattymoo007/matt).\n',
};

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif',
};

// curl, agents and anything else that doesn't ask for HTML get markdown.
const wantsText = (c: Context) => !(c.req.header('accept') ?? '').includes('text/html');
const md = (c: Context, text: string, status: 200 | 404 = 200) =>
  c.body(text, status, { 'content-type': 'text/markdown; charset=utf-8' });

app.get('/health', (c) => c.text('ok'));

app.use('/assets/*', async (c, next) => {
  await next();
  if (c.res.ok) c.header('cache-control', 'public, max-age=31536000, immutable'); // urls carry ?v=
});
app.use('/assets/*', serveStatic({ root: './' }));

// Every URL is looked up among published docs and scanned images only; nothing reads the disk by URL path.
app.get('*', async (c) => {
  const [docs, imgs] = await Promise.all([load(), images()]);
  let path = decodeURIComponent(c.req.path).replace(/^\/+|\/+$/g, '');

  if (isImage(path)) {
    if (!imgs.includes(path)) return c.text('not found\n', 404);
    return c.body(await readFile(join(CONTENT_DIR, path)), 200, {
      'content-type': IMAGE_TYPES[extname(path).toLowerCase()],
      'cache-control': 'public, max-age=3600',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    });
  }

  const raw = path.endsWith('.md');
  if (raw) path = path.slice(0, -3);
  if (path === 'README') path = '';
  const text = raw || wantsText(c);
  const host = c.req.header('host') ?? 'matthewbracke.com';
  const origin = `${c.req.header('x-forwarded-proto') ?? 'http'}://${host}`;
  const find = (p: string) => docs.find((d) => d.path === p);
  const markdownOf = (d: Doc) => textDoc(d, toMarkdown(d, docs, imgs));

  const doc = find(path) ?? (path === '' ? PLACEHOLDER : undefined);
  if (doc) {
    const markdown = markdownOf(doc);
    const now = find('now');
    if (text) {
      if (path !== '') return md(c, markdown);
      return md(c, `~/matt $ ls\n${textLs(docs)}\n\n${markdown}${now ? `\n${markdownOf(now).replace(/^# .*/, '## now')}` : ''}`);
    }
    const common = { docs, path, origin, cmd: `cat ${fileName(doc)}`, file: fileName(doc), modified: doc.modified };
    if (path !== '') {
      return c.html(page({ ...common, kind: 'file', body: toHtml(markdown), title: `${doc.title} · Matt Bracke`, description: describe(doc.body) || doc.title }));
    }
    const readme = toMarkdown(doc, docs, imgs);
    const photo = doc.data.photo ? findImage(String(doc.data.photo), imgs) : undefined;
    const hello = find('hello');
    const body = homeBody({
      docs,
      readme,
      photo: photo ? { src: imageUrl(photo), caption: String(doc.data.caption ?? '') } : undefined,
      now,
      hello: hello && toMarkdown(hello, docs, imgs),
      host,
      nowText: now && markdownOf(now),
    });
    return c.html(page({ ...common, kind: 'home', body, title: 'Matt Bracke', description: describe(readme), image: photo && imageUrl(photo) }));
  }

  if (docs.some((d) => d.dir === path)) {
    if (text) return md(c, `~/matt/${path} $ ls\n${textLs(docs, path)}\n`);
    return c.html(page({ docs, path, origin, kind: 'dir', cmd: `ls ${path}/`, file: `${path}/`, body: dirBody(docs, path), title: `${path}/ · Matt Bracke`, description: `${path}/ · Matt Bracke` }));
  }

  if (text) return md(c, `cat: ${path}: No such file or directory\n`, 404);
  return c.html(page({ docs, path, origin, kind: 'missing', cmd: `cat ${path}`, file: path, body: missingBody(path), title: 'Not found · Matt Bracke', description: 'Not found' }), 404);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`~/matt listening on :${port}, reading ${CONTENT_DIR}`));
