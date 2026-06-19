// One-tap project templates for the mobile IDE.
// Web templates are multi-file (HTML/CSS/JS) and render in the live preview.
// Script templates are single-file and run via Wandbox/Piston.
import type { LangKey } from "@/lib/executors";

export type TemplateKind = "web" | "code";
export type Track = "code" | "web" | "mobile" | "backend" | "database";

export interface WebTemplate {
  id: string;
  kind: "web";
  name: string;
  icon: string;
  description: string;
  tracks?: Track[];
  files: { html: string; css: string; js: string };
}

export interface CodeTemplate {
  id: string;
  kind: "code";
  name: string;
  icon: string;
  description: string;
  tracks?: Track[];
  language: LangKey;
  source: string;
}

export type Template = WebTemplate | CodeTemplate;

const calculator: WebTemplate = {
  id: "calculator",
  kind: "web",
  name: "Calculator",
  icon: "calculator",
  description: "Touch-friendly calculator with a colorful keypad.",
  files: {
    html: `<div class="calc">
  <output id="display">0</output>
  <div class="keys">
    <button data-k="C" class="op">C</button>
    <button data-k="±" class="op">±</button>
    <button data-k="%" class="op">%</button>
    <button data-k="÷" class="op accent">÷</button>
    <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>
    <button data-k="×" class="op accent">×</button>
    <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
    <button data-k="−" class="op accent">−</button>
    <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
    <button data-k="+" class="op accent">+</button>
    <button data-k="0" class="zero">0</button>
    <button data-k=".">.</button>
    <button data-k="=" class="eq">=</button>
  </div>
</div>`,
    css: `:root { color-scheme: dark; }
body { margin:0; min-height:100vh; display:grid; place-items:center;
  background:linear-gradient(160deg,#0b1020,#1a1330); font-family:system-ui,sans-serif; }
.calc { width:min(360px,92vw); background:#0f152b; padding:18px; border-radius:24px;
  box-shadow:0 30px 60px rgba(0,0,0,.5); }
#display { display:block; padding:18px 14px; font-size:42px; text-align:right;
  color:#e8ecff; background:#070a18; border-radius:16px; min-height:64px; overflow:hidden; }
.keys { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:14px; }
button { border:0; padding:18px 0; font-size:20px; border-radius:16px; cursor:pointer;
  background:#1a2244; color:#e8ecff; transition:transform .08s ease, filter .15s; }
button:active { transform:scale(.96); filter:brightness(1.15); }
.op { background:#22305c; }
.accent { background:linear-gradient(160deg,#ff7849,#ff3d6e); color:#fff; }
.eq { background:linear-gradient(160deg,#4f8cff,#5b3bff); color:#fff; }
.zero { grid-column: span 2; text-align:center; }`,
    js: `const display = document.getElementById('display');
let cur = '0', prev = null, op = null, justEval = false;
const ops = { '+': (a,b)=>a+b, '−': (a,b)=>a-b, '×': (a,b)=>a*b, '÷': (a,b)=>a/b };
function fmt(n){ return Number.isFinite(n) ? String(+n.toFixed(10)) : 'Err'; }
function render(){ display.textContent = cur; }
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.k;
  if (/[0-9]/.test(k)) { cur = justEval ? k : (cur === '0' ? k : cur + k); justEval=false; }
  else if (k === '.') { if (!cur.includes('.')) cur += '.'; }
  else if (k === 'C') { cur='0'; prev=null; op=null; }
  else if (k === '±') { cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; }
  else if (k === '%') { cur = fmt(parseFloat(cur)/100); }
  else if (k === '=') { if (op && prev !== null) { cur = fmt(ops[op](parseFloat(prev), parseFloat(cur))); op=null; prev=null; justEval=true; } }
  else { if (op && prev !== null && !justEval) cur = fmt(ops[op](parseFloat(prev), parseFloat(cur))); prev = cur; op = k; justEval = true; }
  render();
}));
console.log('Calculator ready. Tap buttons or open DevTools.');`,
  },
};

const todo: WebTemplate = {
  id: "todo",
  kind: "web",
  name: "Todo App",
  icon: "todo",
  description: "Add, complete, and delete tasks. Saves to localStorage.",
  files: {
    html: `<main>
  <header><h1>Today</h1><span id="count">0</span></header>
  <form id="add"><input id="text" placeholder="Add a task…" autocomplete="off" /><button>Add</button></form>
  <ul id="list"></ul>
</main>`,
    css: `:root { color-scheme: dark; }
body { margin:0; min-height:100vh; font-family:system-ui,sans-serif;
  background:radial-gradient(circle at top,#1b2750,#06080f); color:#e8ecff; }
main { max-width:480px; margin:0 auto; padding:32px 20px; }
header { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; }
h1 { font-size:32px; margin:0; }
#count { color:#7a86b8; font-variant-numeric:tabular-nums; }
form { display:flex; gap:8px; margin-bottom:18px; }
input { flex:1; padding:14px 16px; border-radius:14px; border:0;
  background:#1a2143; color:inherit; font-size:16px; outline:none; }
button { padding:0 18px; border-radius:14px; border:0; cursor:pointer;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); color:#fff; font-weight:600; }
ul { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
li { display:flex; align-items:center; gap:10px; padding:14px 16px; background:#141a36;
  border-radius:14px; }
li.done span { text-decoration:line-through; color:#7a86b8; }
li span { flex:1; }
li button { background:transparent; color:#ff6f8a; padding:4px 8px; }`,
    js: `const KEY = 'todo:v1';
let items = JSON.parse(localStorage.getItem(KEY) || '[]');
const list = document.getElementById('list');
const count = document.getElementById('count');
const form = document.getElementById('add');
const text = document.getElementById('text');
function save(){ localStorage.setItem(KEY, JSON.stringify(items)); }
function render(){
  list.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li');
    if (it.done) li.classList.add('done');
    li.innerHTML = '<input type="checkbox"' + (it.done?' checked':'') + '/><span></span><button>✕</button>';
    li.querySelector('span').textContent = it.text;
    li.querySelector('input').onchange = () => { items[i].done = !items[i].done; save(); render(); };
    li.querySelector('button').onclick = () => { items.splice(i,1); save(); render(); };
    list.appendChild(li);
  });
  count.textContent = items.filter(x=>!x.done).length + ' left';
}
form.onsubmit = (e) => { e.preventDefault(); const v = text.value.trim(); if (!v) return;
  items.unshift({ text:v, done:false }); text.value=''; save(); render(); };
render();`,
  },
};

const login: WebTemplate = {
  id: "login",
  kind: "web",
  name: "Login Page",
  icon: "login",
  description: "Glassmorphic sign-in screen with validation.",
  files: {
    html: `<div class="bg">
  <form class="card">
    <h1>Welcome back</h1>
    <p class="sub">Sign in to continue to your dashboard</p>
    <label>Email<input type="email" required placeholder="you@example.com"/></label>
    <label>Password<input type="password" required minlength="6"/></label>
    <button type="submit">Sign in →</button>
    <p class="meta">No account? <a href="#">Create one</a></p>
  </form>
</div>`,
    css: `:root { color-scheme: dark; }
body { margin:0; }
.bg { min-height:100vh; display:grid; place-items:center; padding:24px;
  background: radial-gradient(circle at 20% 10%, #5b3bff33, transparent 60%),
              radial-gradient(circle at 80% 90%, #ff3d6e33, transparent 60%),
              #06080f;
  font-family:system-ui,sans-serif; color:#e8ecff; }
.card { width:min(380px,100%); padding:32px; border-radius:24px;
  background:rgba(20,26,54,.55); backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,.08); box-shadow:0 30px 60px rgba(0,0,0,.5);
  display:grid; gap:14px; }
h1 { margin:0; font-size:26px; }
.sub { margin:-6px 0 8px; color:#9aa3cf; }
label { display:grid; gap:6px; font-size:13px; color:#9aa3cf; }
input { padding:14px 16px; border-radius:14px; border:1px solid rgba(255,255,255,.08);
  background:#0d1330; color:#e8ecff; font-size:16px; outline:none; }
input:focus { border-color:#4f8cff; }
button { padding:14px; border-radius:14px; border:0; cursor:pointer; font-weight:600;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); color:#fff; font-size:15px; }
.meta { color:#9aa3cf; font-size:13px; text-align:center; margin:0; }
a { color:#7eb2ff; }`,
    js: `document.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = e.target.elements[0].value;
  console.log('Signing in', email);
  alert('Signed in as ' + email);
});`,
  },
};

const chat: WebTemplate = {
  id: "chat",
  kind: "web",
  name: "Chat UI",
  icon: "chat",
  description: "Mobile-style chat thread with bubbles.",
  files: {
    html: `<header><div class="avatar">A</div><div><b>Alex</b><span>online</span></div></header>
<main id="thread"></main>
<form id="composer"><input id="msg" placeholder="Message…" autocomplete="off"/><button>↑</button></form>`,
    css: `:root { color-scheme: dark; }
body { margin:0; height:100vh; display:grid; grid-template-rows:auto 1fr auto;
  background:#06080f; color:#e8ecff; font-family:system-ui,sans-serif; }
header { display:flex; align-items:center; gap:12px; padding:14px 18px;
  border-bottom:1px solid #181f3d; background:#0a0f23; }
.avatar { width:36px; height:36px; border-radius:50%; display:grid; place-items:center;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); font-weight:700; }
header span { display:block; font-size:11px; color:#5fd38a; }
#thread { overflow:auto; padding:18px; display:flex; flex-direction:column; gap:8px; }
.bubble { max-width:75%; padding:10px 14px; border-radius:18px; line-height:1.35; word-wrap:break-word; }
.bubble.me { align-self:flex-end; background:linear-gradient(160deg,#4f8cff,#7e5bff); }
.bubble.them { align-self:flex-start; background:#1a2143; }
#composer { display:flex; gap:8px; padding:12px; border-top:1px solid #181f3d; background:#0a0f23; }
#msg { flex:1; padding:12px 16px; border-radius:999px; border:0; background:#1a2143; color:inherit; outline:none; }
#composer button { width:44px; border-radius:50%; border:0; cursor:pointer;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); color:#fff; font-size:18px; }`,
    js: `const thread = document.getElementById('thread');
function add(text, who){ const b=document.createElement('div'); b.className='bubble '+who; b.textContent=text; thread.appendChild(b); thread.scrollTop=thread.scrollHeight; }
add('Hey! Loving the new playground 🎉','them');
add('Right? It feels like VS Code on mobile.','me');
add('Try sending a message below.','them');
document.getElementById('composer').onsubmit = (e) => { e.preventDefault();
  const i = document.getElementById('msg'); const v = i.value.trim(); if (!v) return;
  add(v,'me'); i.value=''; setTimeout(() => add('Got it: "' + v + '"','them'), 600);
};`,
  },
};

const notes: WebTemplate = {
  id: "notes",
  kind: "web",
  name: "Notes",
  icon: "notes",
  description: "Quick scratchpad with autosave.",
  files: {
    html: `<header><h1>Notes</h1><span id="status">Saved</span></header><textarea id="pad" placeholder="Start typing…"></textarea>`,
    css: `:root { color-scheme: dark; } body { margin:0; height:100vh; display:grid; grid-template-rows:auto 1fr;
  background:#06080f; color:#e8ecff; font-family:ui-sans-serif,system-ui,sans-serif; }
header { display:flex; align-items:baseline; justify-content:space-between; padding:18px 20px;
  border-bottom:1px solid #181f3d; }
h1 { margin:0; font-size:22px; } #status { color:#5fd38a; font-size:12px; }
textarea { border:0; resize:none; padding:20px; background:transparent; color:inherit;
  font:16px/1.6 ui-monospace,monospace; outline:none; }`,
    js: `const pad = document.getElementById('pad'); const status = document.getElementById('status');
pad.value = localStorage.getItem('notes') || '';
let t; pad.oninput = () => { status.textContent='Saving…'; clearTimeout(t);
  t = setTimeout(() => { localStorage.setItem('notes', pad.value); status.textContent='Saved'; }, 400); };`,
  },
};

const expense: WebTemplate = {
  id: "expense",
  kind: "web",
  name: "Expense Tracker",
  icon: "expense",
  description: "Track income and expenses with a running total.",
  files: {
    html: `<main>
  <h1>Wallet</h1>
  <div class="total" id="total">$0.00</div>
  <form id="add"><input id="label" placeholder="Coffee" required/><input id="amt" type="number" step="0.01" placeholder="0.00" required/><button>Add</button></form>
  <ul id="list"></ul>
</main>`,
    css: `:root { color-scheme: dark; } body { margin:0; font-family:system-ui,sans-serif;
  background:linear-gradient(160deg,#06080f,#101840); color:#e8ecff; min-height:100vh; }
main { max-width:440px; margin:0 auto; padding:32px 20px; } h1 { margin:0 0 4px; }
.total { font-size:44px; font-weight:700; margin:6px 0 18px;
  background:linear-gradient(160deg,#5fd38a,#4f8cff); -webkit-background-clip:text; color:transparent; }
form { display:grid; grid-template-columns:1fr 110px auto; gap:8px; margin-bottom:18px; }
input { padding:12px 14px; border-radius:12px; border:0; background:#141a36; color:inherit; outline:none; }
button { padding:0 18px; border-radius:12px; border:0; cursor:pointer; font-weight:600;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); color:#fff; }
ul { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
li { display:flex; justify-content:space-between; align-items:center; padding:12px 14px;
  background:#141a36; border-radius:12px; }
li b { color:#ff7e9a; } li b.pos { color:#5fd38a; }`,
    js: `const KEY='wallet:v1'; let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list'), total=document.getElementById('total');
function render(){ list.innerHTML=''; let s=0;
  items.forEach((it,i)=>{ s+=it.amt; const li=document.createElement('li');
    const sign = it.amt>=0 ? 'pos' : '';
    li.innerHTML = '<span></span><b class="'+sign+'"></b>';
    li.querySelector('span').textContent=it.label;
    li.querySelector('b').textContent = (it.amt>=0?'+$':'-$') + Math.abs(it.amt).toFixed(2);
    li.onclick = () => { items.splice(i,1); localStorage.setItem(KEY,JSON.stringify(items)); render(); };
    list.appendChild(li);
  });
  total.textContent = (s<0?'-$':'$') + Math.abs(s).toFixed(2);
}
document.getElementById('add').onsubmit=(e)=>{ e.preventDefault();
  const l=document.getElementById('label'), a=document.getElementById('amt');
  items.unshift({ label:l.value, amt:parseFloat(a.value)||0 });
  localStorage.setItem(KEY,JSON.stringify(items)); l.value=''; a.value=''; render(); };
render();`,
  },
};

const blank: WebTemplate = {
  id: "blank-web",
  kind: "web",
  name: "Blank Web",
  icon: "blank-web",
  description: "Empty HTML/CSS/JS project.",
  files: {
    html: `<h1>Hello, world</h1>\n<p>Edit me in the editor.</p>`,
    css: `body { font-family: system-ui, sans-serif; padding: 32px; background:#0b1020; color:#e8ecff; }`,
    js: `console.log('Hello from JS');`,
  },
};


// ---------------------------------------------------------------------------
// Mobile-app-flavored web templates (PWAs, bottom-nav shells, mobile UIs)

const bottomNavApp: WebTemplate = {
  id: "bottom-nav", kind: "web", name: "Bottom Nav App", icon: "bottom-nav",
  description: "Mobile app shell with tab bar navigation between Home, Search, and Profile.",
  files: {
    html: `<div class="app">
  <main id="view"></main>
  <nav class="tabbar">
    <button data-tab="home" class="active"><span>🏠</span><b>Home</b></button>
    <button data-tab="search"><span>🔍</span><b>Search</b></button>
    <button data-tab="profile"><span>👤</span><b>Profile</b></button>
  </nav>
</div>`,
    css: `:root { color-scheme: dark; }
body { margin:0; font-family:system-ui,sans-serif; background:#06080f; color:#e8ecff; }
.app { display:grid; grid-template-rows:1fr auto; height:100vh; }
main { overflow:auto; padding:24px 18px 80px; }
h1 { margin:8px 0 14px; font-size:26px; }
.card { background:#141a36; border-radius:18px; padding:18px; margin-bottom:12px; }
.tabbar { display:grid; grid-template-columns:repeat(3,1fr); gap:4px;
  position:fixed; bottom:0; left:0; right:0; background:#0a0f23;
  border-top:1px solid #181f3d; padding:8px 8px calc(8px + env(safe-area-inset-bottom)); }
.tabbar button { background:transparent; border:0; padding:8px; color:#7a86b8;
  display:grid; place-items:center; gap:2px; cursor:pointer; border-radius:12px; }
.tabbar button.active { color:#7eb2ff; background:#141a36; }
.tabbar span { font-size:18px; } .tabbar b { font-size:11px; font-weight:600; }
input[type=search] { width:100%; padding:14px 16px; border-radius:14px; border:0;
  background:#141a36; color:inherit; font-size:16px; outline:none; box-sizing:border-box; }`,
    js: `const view = document.getElementById('view');
const views = {
  home: '<h1>Home</h1><div class="card"><b>Welcome 👋</b><p>Tap the tabs below to navigate.</p></div><div class="card">Build mobile apps right in your browser.</div>',
  search: '<h1>Search</h1><input type="search" placeholder="Search anything…"/><p style="color:#7a86b8;margin-top:14px">Type above to begin.</p>',
  profile: '<h1>Profile</h1><div class="card" style="text-align:center"><div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(160deg,#4f8cff,#7e5bff);margin:0 auto 10px"></div><b>Alex Doe</b><p style="color:#7a86b8;margin:6px 0 0">alex@example.com</p></div>'
};
function show(t){ view.innerHTML = views[t];
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
}
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => show(b.dataset.tab));
show('home');`,
  },
};

const feedApp: WebTemplate = {
  id: "feed", kind: "web", name: "Photo Feed", icon: "feed",
  description: "Instagram-style scrollable mobile photo feed with likes.",
  files: {
    html: `<header><b>Feed</b><span>❤️</span></header>
<main id="feed"></main>`,
    css: `:root { color-scheme: dark; }
body { margin:0; font-family:system-ui,sans-serif; background:#000; color:#e8ecff; }
header { display:flex; justify-content:space-between; align-items:center;
  padding:14px 18px; border-bottom:1px solid #181f3d; position:sticky; top:0; background:#000; }
header b { font-size:20px; }
main { padding:0 0 40px; }
.post { margin-bottom:18px; }
.post .top { display:flex; align-items:center; gap:10px; padding:10px 14px; }
.avatar { width:34px; height:34px; border-radius:50%;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); }
.img { aspect-ratio:1; background-size:cover; background-position:center; }
.actions { display:flex; gap:14px; padding:10px 14px; font-size:22px; }
.actions button { background:transparent; border:0; color:inherit; cursor:pointer; padding:0; }
.like.on { color:#ff3d6e; }
.meta { padding:0 14px; font-size:14px; }
.meta b { display:block; margin-bottom:2px; }`,
    js: `const posts = [
  { user:'alex', likes:128, img:'https://picsum.photos/seed/a/600' },
  { user:'maya', likes:543, img:'https://picsum.photos/seed/b/600' },
  { user:'sam',  likes:91,  img:'https://picsum.photos/seed/c/600' },
];
const feed = document.getElementById('feed');
posts.forEach((p,i) => {
  const el = document.createElement('article'); el.className='post';
  el.innerHTML = '<div class="top"><div class="avatar"></div><b>'+p.user+'</b></div>'
    + '<div class="img" style="background-image:url('+p.img+')"></div>'
    + '<div class="actions"><button class="like" data-i="'+i+'">♡</button><button>💬</button><button>↗</button></div>'
    + '<div class="meta"><b>'+p.likes+' likes</b><span>@'+p.user+' shared a moment</span></div>';
  feed.appendChild(el);
});
feed.addEventListener('click', e => {
  const b = e.target.closest('.like'); if (!b) return;
  b.classList.toggle('on'); b.textContent = b.classList.contains('on') ? '♥' : '♡';
});`,
  },
};

const pwaTodo: WebTemplate = {
  id: "pwa-todo", kind: "web", name: "PWA Todo", icon: "pwa",
  description: "Installable mobile todo app with offline-friendly storage.",
  files: {
    html: `<header><h1>Tasks</h1><button id="add">＋</button></header>
<ul id="list"></ul>
<dialog id="dlg"><form method="dialog"><input id="t" placeholder="New task" autofocus required/><menu><button value="cancel">Cancel</button><button id="ok" value="ok">Add</button></menu></form></dialog>`,
    css: `:root { color-scheme: dark; }
body { margin:0; font-family:system-ui,sans-serif; background:#06080f; color:#e8ecff;
  min-height:100vh; padding-bottom:env(safe-area-inset-bottom); }
header { display:flex; justify-content:space-between; align-items:center; padding:24px 20px 8px; }
h1 { margin:0; font-size:32px; }
#add { width:48px; height:48px; border-radius:50%; border:0; cursor:pointer; font-size:24px;
  background:linear-gradient(160deg,#4f8cff,#7e5bff); color:#fff; }
ul { list-style:none; padding:0 16px; margin:0; display:grid; gap:8px; }
li { display:flex; align-items:center; gap:12px; padding:16px; background:#141a36;
  border-radius:16px; }
li.done { opacity:.5; text-decoration:line-through; }
li button { margin-left:auto; background:transparent; border:0; color:#ff6f8a; font-size:18px; cursor:pointer; }
dialog { border:0; border-radius:18px; background:#141a36; color:inherit; padding:18px; }
dialog::backdrop { background:#000a; }
input { padding:12px 14px; border-radius:12px; border:0; background:#06080f; color:inherit; outline:none; font-size:16px; width:240px; }
menu { display:flex; justify-content:flex-end; gap:8px; padding:0; margin:12px 0 0; }
menu button { padding:8px 14px; border:0; border-radius:10px; cursor:pointer; background:#1a2143; color:inherit; }
menu #ok { background:linear-gradient(160deg,#4f8cff,#7e5bff); color:#fff; }`,
    js: `const KEY='pwa-todo'; let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list'), dlg=document.getElementById('dlg'), t=document.getElementById('t');
function save(){ localStorage.setItem(KEY, JSON.stringify(items)); }
function render(){ list.innerHTML='';
  items.forEach((it,i)=>{ const li=document.createElement('li'); if(it.done) li.classList.add('done');
    li.innerHTML = '<input type="checkbox"'+(it.done?' checked':'')+'/><span></span><button>✕</button>';
    li.querySelector('span').textContent=it.text;
    li.querySelector('input').onchange=()=>{ items[i].done=!items[i].done; save(); render(); };
    li.querySelector('button').onclick=()=>{ items.splice(i,1); save(); render(); };
    list.appendChild(li);
  });
}
document.getElementById('add').onclick=()=>{ t.value=''; dlg.showModal(); };
dlg.addEventListener('close', ()=>{ if(dlg.returnValue==='ok' && t.value.trim()){ items.unshift({text:t.value.trim(),done:false}); save(); render(); } });
render();`,
  },
};

const onboarding: WebTemplate = {
  id: "onboarding", kind: "web", name: "Onboarding", icon: "onboarding",
  description: "Swipable 3-step mobile onboarding screen.",
  files: {
    html: `<div class="wrap"><div id="slides" class="slides">
  <section style="background:linear-gradient(160deg,#4f8cff,#7e5bff)"><div class="ico">🚀</div><h1>Move fast</h1><p>Ship ideas without leaving your phone.</p></section>
  <section style="background:linear-gradient(160deg,#ff7849,#ff3d6e)"><div class="ico">🎨</div><h1>Design freely</h1><p>Beautiful UI in one tap from templates.</p></section>
  <section style="background:linear-gradient(160deg,#5fd38a,#4f8cff)"><div class="ico">🤖</div><h1>AI built-in</h1><p>Explain, fix, and improve your code.</p></section>
</div>
<div class="dots"><b></b><b></b><b></b></div>
<button id="next">Next →</button></div>`,
    css: `:root { color-scheme: dark; } body { margin:0; font-family:system-ui,sans-serif; color:#fff; }
.wrap { height:100vh; display:grid; grid-template-rows:1fr auto auto; }
.slides { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; }
.slides::-webkit-scrollbar { display:none; }
section { min-width:100%; scroll-snap-align:start; display:grid; place-items:center; text-align:center; padding:32px; }
.ico { font-size:80px; margin-bottom:20px; }
h1 { margin:0 0 10px; font-size:32px; } p { margin:0; opacity:.9; max-width:280px; }
.dots { display:flex; justify-content:center; gap:8px; padding:20px; background:#000; }
.dots b { width:8px; height:8px; border-radius:50%; background:#333; transition:all .2s; }
.dots b.on { width:24px; background:#fff; }
#next { margin:0 20px 28px; padding:16px; border:0; border-radius:14px; cursor:pointer;
  background:#fff; color:#000; font-weight:600; font-size:16px; }`,
    js: `const slides=document.getElementById('slides');
const dots=document.querySelectorAll('.dots b');
function update(){ const i=Math.round(slides.scrollLeft/slides.clientWidth);
  dots.forEach((d,j)=>d.classList.toggle('on', j===i)); }
slides.addEventListener('scroll', update); update();
document.getElementById('next').onclick=()=>{ const i=Math.round(slides.scrollLeft/slides.clientWidth);
  if (i<2) slides.scrollTo({left:(i+1)*slides.clientWidth, behavior:'smooth'});
  else alert('Welcome aboard! 🎉'); };`,
  },
};

const pythonHello: CodeTemplate = {
  id: "py-hello", kind: "code", name: "Python · Hello", icon: "python",
  description: "Classic Hello World in Python.", language: "python",
  source: `name = input("Your name? ") or "world"\nprint(f"Hello, {name}!")\n`,
};
const pyFizzBuzz: CodeTemplate = {
  id: "py-fizz", kind: "code", name: "Python · FizzBuzz", icon: "fizzbuzz",
  description: "Classic FizzBuzz in Python.", language: "python",
  source: `for i in range(1, 21):\n    if i % 15 == 0: print("FizzBuzz")\n    elif i % 3 == 0: print("Fizz")\n    elif i % 5 == 0: print("Buzz")\n    else: print(i)\n`,
};
const nodeHello: CodeTemplate = {
  id: "node-hello", kind: "code", name: "Node · Hello", icon: "nodejs",
  description: "Hello World in Node.js.", language: "javascript",
  source: `const greet = (n = 'world') => \`Hello, \${n}!\`;\nconsole.log(greet('Lovable'));\n`,
};
const tsDemo: CodeTemplate = {
  id: "ts-demo", kind: "code", name: "TypeScript · Types", icon: "typescript",
  description: "A small typed example with interfaces.", language: "typescript",
  source: `interface User { name: string; age: number }\nconst u: User = { name: 'Ada', age: 30 };\nconsole.log(\`\${u.name} is \${u.age}\`);\n`,
};
const javaHello: CodeTemplate = {
  id: "java-hello", kind: "code", name: "Java · Hello", icon: "java",
  description: "Hello World in Java.", language: "java",
  source: `class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from Java\");\n  }\n}\n`,
};
const cppDemo: CodeTemplate = {
  id: "cpp-demo", kind: "code", name: "C++ · Vector sum", icon: "cpp",
  description: "Sum elements of a vector in C++.", language: "cpp",
  source: `#include <iostream>\n#include <vector>\n#include <numeric>\nint main(){\n  std::vector<int> v{1,2,3,4,5};\n  std::cout << "sum = " << std::accumulate(v.begin(), v.end(), 0) << std::endl;\n}\n`,
};
const goDemo: CodeTemplate = {
  id: "go-demo", kind: "code", name: "Go · Hello", icon: "go",
  description: "Hello World in Go.", language: "go",
  source: `package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello from Go") }\n`,
};
const rustDemo: CodeTemplate = {
  id: "rust-demo", kind: "code", name: "Rust · Hello", icon: "rust",
  description: "Hello World in Rust.", language: "rust",
  source: `fn main(){\n  let name = "Rust";\n  println!("Hello, {name}!");\n}\n`,
};
const javaCalc: CodeTemplate = {
  id: "java-calc", kind: "code", name: "Java · Calculator", icon: "calculator",
  description: "Simple Java class with add/sub methods.", language: "java",
  source: `class Calc {\n  static int add(int a, int b){ return a+b; }\n  static int sub(int a, int b){ return a-b; }\n  public static void main(String[] a){\n    System.out.println("3+4 = " + add(3,4));\n    System.out.println("9-2 = " + sub(9,2));\n  }\n}\n`,
};

// Assign tracks. Default: a web template appears in Web, a code template in Code.
// Mobile-friendly UIs appear in BOTH Web and Mobile.
function tag<T extends Template>(t: T, tracks: Track[]): T { return { ...t, tracks }; }

export const TEMPLATES: Template[] = [
  // Web essentials
  tag(blank, ["web"]),
  tag(notes, ["web"]),
  // Mobile-flavored web templates (show on Web + Mobile)
  tag(calculator, ["web", "mobile"]),
  tag(todo, ["web", "mobile"]),
  tag(login, ["web", "mobile"]),
  tag(chat, ["web", "mobile"]),
  tag(expense, ["web", "mobile"]),
  // Mobile-only templates
  tag(bottomNavApp, ["mobile"]),
  tag(feedApp, ["mobile"]),
  tag(pwaTodo, ["mobile"]),
  tag(onboarding, ["mobile"]),
  // Code (script) templates
  tag(pythonHello, ["code"]),
  tag(pyFizzBuzz, ["code"]),
  tag(nodeHello, ["code"]),
  tag(tsDemo, ["code"]),
  tag(javaHello, ["code"]),
  tag(javaCalc, ["code"]),
  tag(cppDemo, ["code"]),
  tag(goDemo, ["code"]),
  tag(rustDemo, ["code"]),
];

export const WEB_TEMPLATES = TEMPLATES.filter((t): t is WebTemplate => t.kind === "web");
export const CODE_TEMPLATES = TEMPLATES.filter((t): t is CodeTemplate => t.kind === "code");

export function templatesForTrack(track: Track): Template[] {
  return TEMPLATES.filter((t) => (t.tracks ?? []).includes(track));
}
