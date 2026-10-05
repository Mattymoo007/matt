// ~/matt: the prompt, the keys and the clock. No framework, no build.
const $ = (s) => document.querySelector(s);
const idx = JSON.parse($('#idx').textContent); // [{ p: 'notes/x', t: 'Title', d: 'notes' }]
const input = $('.bar input');
const out = $('.out');
const help = $('#help');
const mode = $('.status .mode');
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
  cat: (a) => (findDoc(a) ? go(findDoc(a).p) : `cat: ${a || '?'}: No such file or directory`),
  pwd: () => `~/matt${here ? '/' + here : ''}`,
  whoami: () => go(''),
  echo: (a) => a,
  hello: () => go('hello'),
  help: () => (help.showModal(), ''),
  clear: () => '',
  ask: () =>
    'My copy is still learning to talk. Soon you can ask it anything.\nUntil then: <a href="/now">cat now.md</a> · <a href="/hello">cat hello.md</a>',
  sudo: () => 'nice try 🙃',
  rm: () => 'rm: read-only file system. (Really: the server can only read this folder.)',
  exit: () => 'there is no exit, only <a href="/">cd ~</a>',
};
for (const alias of ['open', 'less', 'more', 'vim', 'nano', 'head', 'tail']) commands[alias] = commands.cat;
commands['?'] = commands.man = commands.help;
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
input.addEventListener('focus', () => (mode.textContent = 'INSERT'));
input.addEventListener('blur', () => (mode.textContent = 'NORMAL'));
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
    show('');
    input.blur();
  }
});

// ---- keys ----
const rows = [...document.querySelectorAll('.ls .row')];
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

// ---- clock: what time it is where I am ----
const clock = $('.clock');
const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' });
const tick = () => (clock.textContent = `Gent ${time.format(new Date())}`);
tick();
setInterval(tick, 30_000);
