// ~/matt: the prompt, the keys, the themes and the clock. No framework, no build.
const $ = (s) => document.querySelector(s);
const idx = JSON.parse($('#idx').textContent); // [{ p: 'notes/x', t: 'Title', d: 'notes' }]
const input = $('.bar input');
const out = $('.out');
const help = $('#help');
const here = document.body.dataset.path;
const dirs = [...new Set(idx.map((e) => e.d).filter(Boolean))];
const cwd = dirs.includes(here) ? here : here.split('/').length > 1 ? here.split('/')[0] : '';

const go = (p) => (location.href = '/' + p);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const label = (e) => (e.p ? `${e.p}.md` : 'README.md');
const norm = (a) =>
  a
    .trim()
    .toLowerCase()
    .replace(/^~\/?/, '')
    .replace(/^(\.\/)+/, '')
    .replace(/\.md$/, '')
    .replace(/\/+$/, '');

function show(html) {
  out.innerHTML = html;
  out.hidden = !html;
}

function findDoc(arg) {
  const a = norm(arg);
  if (a === 'readme' || a === '') return idx.find((e) => e.p === '');
  return (
    idx.find((e) => e.p === a || e.p === `${cwd}/${a}`) ??
    idx.find((e) => e.p.split('/').pop() === a) ??
    idx.find((e) => e.t.toLowerCase() === a)
  );
}

function search(q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return idx.filter((e) => e.t.toLowerCase().includes(s) || e.p.includes(s.replace(/\s+/g, '-'))).slice(0, 8);
}

const results = (list) =>
  list.map((e) => `<a href="/${e.p}">${esc(label(e))}  <span class="m">${esc(e.t)}</span></a>`).join('');

const commands = {
  ls: (a) => (!norm(a) ? go('') : dirs.includes(norm(a)) ? go(norm(a)) : `ls: ${a}: No such file or directory`),
  cd: (a) => {
    const d = norm(a);
    if (d === '' || d === '..' || d === '~') return go(''); // every folder lives in ~
    return dirs.includes(d) ? go(d) : `cd: no such directory: ${a}`;
  },
  cat: (a) =>
    /^(llms(-full)?\.txt|rss\.xml|sitemap\.xml|robots\.txt)$/.test(norm(a))
      ? go(norm(a))
      : findDoc(a)
        ? go(findDoc(a).p)
        : `cat: ${a || '?'}: No such file or directory`,
  pwd: () => `~/matt${here ? '/' + here : ''}`,
  whoami: () => go(''),
  echo: (a) => a,
  hello: () => go('hello'),
  help: () => (help.showModal(), ''),
  clear: () => '',
  ask: () =>
    'My copy is still learning to talk. Soon you can ask it anything.\nUntil then: <a href="/now">cat now.md</a> · <a href="/hello">cat hello.md</a>',
  theme: (a) => {
    const name = a ? THEMES.find((t) => t.startsWith(a.trim().toLowerCase())) : nextTheme();
    if (!name) return `theme: ${esc(a)}: try ${THEMES.join(' · ')}`;
    setTheme(name);
  },
  sudo: () => 'nice try 🙃',
  rm: () => 'rm: read-only file system. (Really: the server can only read this folder.)',
  exit: () => 'there is no exit, only <a href="/">cd ~</a>',
};
for (const alias of ['open', 'less', 'more', 'vim', 'nano', 'head', 'tail']) commands[alias] = commands.cat;
commands['?'] = commands.man = commands.help;
commands.colo = commands.colorscheme = commands.theme;
commands.mail = commands.contact = commands.hello;

function run(line) {
  const [cmd = '', ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(' ');
  if (!cmd) return show('');
  if (commands[cmd]) return show(commands[cmd](arg) ?? '');
  const hits = search(line);
  if (hits.length) return go(hits[0].p);
  show(`<span class="m">command not found: ${esc(cmd)} · type</span> help`);
}

input.addEventListener('input', () => {
  const v = input.value;
  const cmd = v.trim().split(/\s+/)[0];
  if (!v.trim()) return show('');
  if (commands[cmd]) return show(`<span class="m">↵ to run</span>`);
  const hits = search(v);
  show(hits.length ? results(hits) : `<span class="m">no match · ↵ to run as a command · ? for help</span>`);
});
$('.bar').addEventListener('submit', (e) => {
  e.preventDefault();
  run(input.value);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
    show('');
    input.blur();
  }
});

// ---- keys ----
const rows = [...document.querySelectorAll('.ls a.row')]; // drafts can't be opened, so j/k skips them
let pos = rows.findIndex((r) => r.classList.contains('active'));
function move(d) {
  rows[pos]?.classList.remove('focus');
  pos = Math.max(0, Math.min(rows.length - 1, (pos < 0 ? (d > 0 ? -1 : rows.length) : pos) + d));
  rows[pos].classList.add('focus');
  rows[pos].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target === input || help.open) return;
  if (e.key === 'j' || e.key === 'ArrowDown') return (e.preventDefault(), move(1));
  if (e.key === 'k' || e.key === 'ArrowUp') return (e.preventDefault(), move(-1));
  if (e.key === 'Enter' && rows[pos]?.classList.contains('focus')) return rows[pos].click();
  if ((e.key === '-' || e.key === 'h') && here) return go(here.includes('/') ? here.split('/')[0] : ''); // up a folder
  if (e.key === '?') return (e.preventDefault(), help.showModal());
  if (e.key === '/' || e.key === ':') return (e.preventDefault(), input.focus());
  if (e.key.length === 1 && /\S/.test(e.key)) {
    // just start typing: the prompt catches it
    e.preventDefault();
    input.focus();
    input.value += e.key;
    input.dispatchEvent(new Event('input'));
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.bar')) show('');
});

// ---- themes: day, night and synthwave '84. The colours live in site.css; the choice is remembered on this device. ----
const THEMES = ['day', 'night', 'synthwave'];
const root = document.documentElement;
const syncThemeColor = () =>
  ($('meta[name=theme-color]').content = getComputedStyle(root).getPropertyValue('--bg').trim());
function setTheme(name) {
  const apply = () => ((root.dataset.theme = name), syncThemeColor());
  if (document.startViewTransition)
    document.startViewTransition(apply).ready.catch(() => {}); // crossfade; skipped is fine
  else apply();
  try {
    localStorage.theme = name;
  } catch {}
}
const nextTheme = () => THEMES[(THEMES.indexOf(root.dataset.theme) + 1) % THEMES.length];
$('.status .theme').addEventListener('click', () => setTheme(nextTheme()));
syncThemeColor();

// ---- live: watch me write. A note I'm writing says so in the list; once I pause, its page types out what's new. ----
if (!document.body.classList.contains('page-missing')) {
  const article = $('.preview');
  let finish = () => {};
  const live = new EventSource(`/live/${here}`);
  live.addEventListener('writing', (e) => {
    for (const p of e.data.split('\n'))
      document
        .querySelectorAll(`.ls [data-path="${p}"], .ls [data-path="${p.split('/')[0]}"]`) // the note, and its folder
        .forEach((row) => row.classList.add('writing'));
  });
  live.addEventListener('saved', (e) => {
    document.querySelectorAll('.ls .writing').forEach((row) => row.classList.remove('writing'));
    if (!e.data) return; // something else changed, not this page
    finish(); // a new save while the last one is still typing: show that one whole first
    const next = document.createElement('template');
    next.innerHTML = e.data;
    const old = [...article.children].filter((el) => !el.matches('.file, .sibs'));
    const fresh = [...next.content.children];
    let i = 0;
    while (i < old.length && i < fresh.length && old[i].isEqualNode(fresh[i])) i++; // unchanged blocks stay put
    const before = old
      .slice(i)
      .map((b) => b.textContent)
      .join('');
    old.slice(i).forEach((b) => b.remove());
    fresh.slice(i).forEach((b) => article.insertBefore(b, $('.sibs')));
    finish = type(fresh.slice(i), before);
  });
}

/** Types out what changed in `blocks` letter by letter; text they share with `before`, at the start or the end, shows at once. Returns a function that finishes it now. */
function type(blocks, before) {
  const parts = [];
  const starts = []; // where each block's text begins
  let at = 0;
  for (const block of blocks) {
    starts.push(at);
    const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const node = walk.currentNode;
      parts.push({ node, text: node.data, at, rest: document.createTextNode('') }); // rest: the unchanged end, after the cursor
      at += node.data.length;
    }
  }
  const text = parts.map((p) => p.text).join('');
  let shown = 0; // typed so far: everything before this is on screen
  while (shown < before.length && before[shown] === text[shown]) shown++;
  let tail = 0;
  while (tail < before.length - shown && tail < text.length - shown && before.at(-1 - tail) === text.at(-1 - tail))
    tail++;
  const end = text.length - tail; // and everything from here on, too
  if (shown >= end || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  for (const p of parts) p.node.after(p.rest);
  const draw = () => {
    cursor.remove();
    for (const p of parts) {
      p.node.data = p.text.slice(0, Math.max(0, shown - p.at));
      p.rest.data = p.text.slice(Math.max(p.node.data.length, end - p.at));
      if (shown >= p.at && shown <= p.at + p.text.length && !cursor.isConnected) p.node.after(cursor);
    }
    // a block waits its turn until the typing reaches it
    blocks.forEach((b, i) =>
      starts[i] <= shown || starts[i] >= end ? b.removeAttribute('style') : (b.style.display = 'none'),
    );
  };
  const step = Math.ceil((end - shown) / 120); // ~30 letters a second; a long paste still takes under 4 seconds
  const timer = setInterval(() => {
    shown = Math.min(end, shown + step);
    draw();
    if (shown < end) return;
    clearInterval(timer);
    setTimeout(() => cursor.remove(), 4_000); // the cursor lingers a moment, as if I'm still thinking
  }, 30);
  draw();
  return () => {
    clearInterval(timer);
    cursor.remove();
    for (const p of parts) ((p.node.data = p.text), p.rest.remove());
    for (const b of blocks) b.removeAttribute('style');
  };
}

// ---- clock: what time it is where I am ----
const clock = $('.clock');
const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' });
const tick = () => (clock.textContent = `Gent ${time.format(new Date())}`);
tick();
setInterval(tick, 30_000);
