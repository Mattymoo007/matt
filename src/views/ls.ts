// The file listing: shared by the HTML pane and the plain-text `ls`.
import type { Doc } from '../content.ts';

export const SECTIONS = ['made', 'notes', 'ideas', 'crew'];
const OPEN = new Set(['ideas']); // drwxrwxrwx: open to everyone
const ORDER = ['', 'now', ...SECTIONS, 'hello'];
const META: Record<string, string> = { '': 'who I am', hello: 'say hi' };
const rank = (path: string) => (ORDER.includes(path) ? ORDER.indexOf(path) : ORDER.length);

export type Row = { path: string; perm: string; name: string; meta: string; dir: boolean };

export const fileName = (d: Doc) => `${d.path || 'README'}.md`;
export const baseName = (d: Doc) => fileName(d).split('/').pop()!; // 'made/stickit.md' → 'stickit.md'

export function ago(date: Date) {
  const s = (Date.now() - +date) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return date.toISOString().slice(0, 10);
}

export const inDir = (docs: Doc[], dir: string) => docs.filter((d) => d.dir === dir);

/** Every doc in reading order: README, now, then each folder (newest first), then hello. */
export const ordered = (docs: Doc[]) => [...docs].sort((a, b) => rank(a.dir || a.path) - rank(b.dir || b.path));

/** The same folder, for agents and feed readers. */
export const MACHINES = [
  { path: 'llms.txt', meta: 'index for agents' },
  { path: 'llms-full.txt', meta: 'everything, one file' },
  { path: 'rss.xml', meta: 'feed' },
];

/** Top-level files, then the folders that have something in them, in mockup order. */
export function listing(docs: Doc[]): Row[] {
  const files = inDir(docs, '').map((d) => ({
    path: d.path,
    perm: '-rw-r--r--',
    name: fileName(d),
    meta: META[d.path] ?? `edited ${ago(d.modified)}`,
    dir: false,
  }));
  const dirs = SECTIONS.map((name) => ({ name, docs: inDir(docs, name) }))
    .filter((s) => s.docs.length)
    .map((s) => ({
      path: s.name,
      perm: OPEN.has(s.name) ? 'drwxrwxrwx' : 'drwxr-xr-x',
      name: s.name,
      meta: `${s.docs.length} · ${ago(s.docs[0].modified)}`,
      dir: true,
    }));
  return [...files, ...dirs].sort((a, b) => rank(a.path) - rank(b.path) || a.name.localeCompare(b.name));
}

/** The short detail next to a doc in a list: year · material, status, or date. */
export function aside(d: Doc) {
  if (d.dir === 'made') return [d.data.year, d.data.material].filter(Boolean).join(' · ');
  if (d.dir === 'ideas') return String(d.data.status ?? 'open');
  return d.date ?? ago(d.modified);
}
