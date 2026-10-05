import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { marked } from 'marked';
import { parse } from 'yaml';

// The folder. In production this is the vault's Public/ folder, mounted read-only.
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

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function splitFrontmatter(src: string) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  return { data: (parse(m[1]) ?? {}) as Record<string, unknown>, body: src.slice(m[0].length) };
}

async function readDoc(abs: string): Promise<Doc | undefined> {
  try {
    const { data, body } = splitFrontmatter(await readFile(abs, 'utf8'));
    // The gate: only `publish: true` (a real boolean) ever leaves the folder.
    if (data.publish !== true) return;
    const file = relative(CONTENT_DIR, abs);
    const dir = dirname(file) === '.' ? '' : dirname(file);
    const name = basename(file, '.md');
    const slug = name === 'README' && !dir ? '' : slugify(name);
    const heading = body.match(/^#\s+(.+)$/m)?.[1];
    return {
      path: [dir, slug].filter(Boolean).join('/'),
      file,
      dir,
      title: String(data.title ?? heading ?? name),
      date: data.date ?? data.updated ?? data.year ? String(data.date ?? data.updated ?? data.year) : undefined,
      data,
      body,
      modified: (await stat(abs)).mtime,
    };
  } catch {
    return; // unreadable or broken frontmatter → treated as unpublished
  }
}

let cache: { at: number; docs: Doc[] } | undefined;

/** Every published doc, newest first. Re-reads the folder at most every 5 seconds. */
export async function load(): Promise<Doc[]> {
  if (cache && Date.now() - cache.at < 5_000) return cache.docs;
  const entries = await readdir(CONTENT_DIR, { withFileTypes: true, recursive: true }).catch(() => []);
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !join(e.parentPath, e.name).includes('/.'))
    .map((e) => join(e.parentPath, e.name));
  const docs = (await Promise.all(files.map(readDoc))).filter((d) => d !== undefined);
  docs.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || +b.modified - +a.modified);
  cache = { at: Date.now(), docs };
  return docs;
}

/** Markdown with Obsidian [[wikilinks]] resolved: links to public docs, plain text for anything else. */
export function toMarkdown(doc: Doc, docs: Doc[]) {
  const byName = new Map(docs.map((d) => [basename(d.file, '.md').toLowerCase(), d]));
  return doc.body.replace(/(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, embed, target, label) => {
    if (embed) return ''; // embeds (images, transclusions) aren't supported yet
    const d = byName.get(target.trim().toLowerCase());
    const text = label ?? target;
    return d ? `[${text}](/${d.path})` : text;
  });
}

export const toHtml = (markdown: string) => marked.parse(markdown) as string;
