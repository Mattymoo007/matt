// The folder: everything the site knows comes from here, and only through the publish gate.
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { marked } from 'marked';
import { parse } from 'yaml';

// In production this is the vault's Public/ folder, mounted read-only.
export const CONTENT_DIR = process.env.CONTENT_DIR ?? './content';

export type Doc = {
  path: string; // URL path: '' (README), 'now', 'notes/you-cannot-scroll-a-post-it'
  file: string; // source file relative to CONTENT_DIR
  dir: string; // '', 'notes', 'ideas', 'made', …
  title: string;
  date?: string;
  data: Record<string, unknown>;
  body: string; // markdown without frontmatter
  modified: Date;
};

/** A snapshot of the folder: published docs (newest first) and every image. */
export type Site = { docs: Doc[]; images: string[] };

const IMAGE = /\.(jpe?g|png|webp|gif|svg|avif)$/i;
export const isImage = (path: string) => IMAGE.test(path);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function splitFrontmatter(src: string) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  return { data: (parse(m[1]) ?? {}) as Record<string, unknown>, body: src.slice(m[0].length) };
}

async function readDoc(file: string): Promise<Doc | undefined> {
  const abs = join(CONTENT_DIR, file);
  try {
    const { data, body } = splitFrontmatter(await readFile(abs, 'utf8'));
    // The gate: only `publish: true` (a real boolean) ever leaves the folder.
    if (data.publish !== true) return;
    const dir = dirname(file) === '.' ? '' : dirname(file);
    const name = basename(file, '.md');
    const slug = name === 'README' && !dir ? '' : slugify(name);
    const date = data.date ?? data.updated ?? data.year;
    return {
      path: [dir, slug].filter(Boolean).join('/'),
      file,
      dir,
      title: String(data.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? name),
      date: date == null ? undefined : String(date),
      data,
      body,
      modified: (await stat(abs)).mtime,
    };
  } catch {
    return; // unreadable or broken frontmatter → treated as unpublished
  }
}

let cache: (Site & { at: number }) | undefined;

/** Reads the folder at most every 5 seconds. Hidden files and folders don't exist as far as the site knows. */
export async function load(): Promise<Site> {
  if (cache && Date.now() - cache.at < 5_000) return cache;
  const entries = await readdir(CONTENT_DIR, { withFileTypes: true, recursive: true }).catch(() => []);
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => relative(CONTENT_DIR, join(e.parentPath, e.name)))
    .filter((f) => !f.split('/').some((part) => part.startsWith('.')));
  const docs = (await Promise.all(files.filter((f) => f.endsWith('.md')).map(readDoc))).filter((d) => d !== undefined);
  docs.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || +b.modified - +a.modified);
  cache = { at: Date.now(), docs, images: files.filter(isImage) };
  return cache;
}

/** Resolves 'img/x.jpg', '[[x.jpg]]' or 'x.jpg' to an image in the folder, the way Obsidian does. */
export function findImage(ref: string, images: string[]) {
  const clean = ref
    .replace(/^!?\[\[|\]\]$/g, '')
    .split('|')[0]
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase();
  return (
    images.find((p) => p.toLowerCase() === clean) ?? images.find((p) => basename(p).toLowerCase() === basename(clean))
  );
}

export const imageUrl = (path: string) => '/' + path.split('/').map(encodeURIComponent).join('/');

export type Figure = { src: string; caption: string };

/** The doc's `images:` list ('[[x.jpg|caption]]' or 'img/x.jpg'), resolved to images in the folder; missing ones are skipped. */
export function figures(doc: Doc, site: Site): Figure[] {
  const refs = Array.isArray(doc.data.images) ? doc.data.images : [];
  return refs.flatMap((r) => {
    const ref = String(r); // also flattens an unquoted [[x]], which YAML reads as a list
    const img = findImage(ref, site.images);
    const caption = ref.match(/\|([^\]]*)/)?.[1]?.trim() ?? '';
    return img ? [{ src: imageUrl(img), caption }] : [];
  });
}

/** The doc's markdown with Obsidian syntax resolved: [[links]] to public docs (plain text otherwise), ![[image]] embeds. */
export function resolveLinks(doc: Doc, site: Site) {
  const byName = new Map(site.docs.map((d) => [basename(d.file, '.md').toLowerCase(), d]));
  return doc.body.replace(/(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, embed, target, label) => {
    if (embed) {
      const img = isImage(target) ? findImage(target, site.images) : undefined;
      return img ? `![${basename(img).replace(IMAGE, '')}](${imageUrl(img)})` : ''; // transclusions aren't supported
    }
    const d = byName.get(target.trim().toLowerCase());
    return d ? `[${label ?? target}](/${d.path})` : (label ?? target);
  });
}

export const toHtml = (markdown: string) => marked.parse(markdown, { async: false });
export const toInlineHtml = (markdown: string) => marked.parseInline(markdown, { async: false });
