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
  source: `const greet = (n = 'world') => \`Hello, \${n}!\`;\nconsole.log(greet('Orbit'));\n`,
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

// ---------------------------------------------------------------------------
// Mobile-native snippet templates (Kotlin, Swift, Dart, Objective-C)

const kotlinHello: CodeTemplate = {
  id: "kt-hello", kind: "code", name: "Kotlin · Hello", icon: "kotlin",
  description: "Variables, functions, and string templates.", language: "kotlin",
  source: `fun greet(name: String = "Kotlin") = "Hello, $name!"\n\nfun main() {\n  println(greet())\n  println(greet("Android"))\n}\n`,
};
const kotlinOop: CodeTemplate = {
  id: "kt-oop", kind: "code", name: "Kotlin · Classes & OOP", icon: "kotlin",
  description: "Data classes, inheritance, and collections.", language: "kotlin",
  source: `open class Animal(val name: String) { open fun speak() = "..." }\nclass Dog(name: String) : Animal(name) { override fun speak() = "Woof!" }\n\nfun main() {\n  val pets = listOf(Dog("Rex"), Dog("Bella"))\n  pets.forEach { println("\${it.name}: \${it.speak()}") }\n}\n`,
};
const kotlinAndroid: CodeTemplate = {
  id: "kt-android", kind: "code", name: "Kotlin · Android Activity", icon: "android",
  description: "Snippet of an Android Activity with a Compose UI.", language: "kotlin",
  source: `// Snippet — paste into an Android Studio project.\n// import androidx.compose.material3.*\n// import androidx.compose.runtime.*\n\nclass MainActivity /* : ComponentActivity() */ {\n  fun onCreate() {\n    // setContent { Greeting("Android") }\n  }\n}\n\n// @Composable fun Greeting(name: String) { Text(text = "Hello \$name!") }\n`,
};
const javaAndroid: CodeTemplate = {
  id: "java-android", kind: "code", name: "Java · Android Activity", icon: "android",
  description: "Classic Android Activity in Java with a button + TextView.", language: "java",
  source: `// Snippet — paste into an Android Studio (Java) project.\n// import android.app.Activity;\n// import android.os.Bundle;\n// import android.view.View;\n// import android.widget.Button;\n// import android.widget.TextView;\n\npublic class MainActivity /* extends Activity */ {\n  int count = 0;\n  // TextView label;\n\n  public void onCreate(/* Bundle savedInstanceState */) {\n    // super.onCreate(savedInstanceState);\n    // setContentView(R.layout.activity_main);\n    // label = findViewById(R.id.label);\n    // Button btn = findViewById(R.id.btn);\n    // btn.setOnClickListener(v -> { count++; label.setText("Taps: " + count); });\n  }\n}\n`,
};
const javaMobileHello: CodeTemplate = {
  id: "java-mobile-hello", kind: "code", name: "Java · Hello (Mobile)", icon: "java",
  description: "Plain Java starter — great for Android logic & algorithms.", language: "java",
  source: `class Main {\n  public static void main(String[] args) {\n    String platform = \"Android\";\n    System.out.println(\"Hello from Java on \" + platform);\n  }\n}\n`,
};
const swiftHello: CodeTemplate = {
  id: "swift-hello", kind: "code", name: "Swift · Hello", icon: "swift",
  description: "Variables, functions, and string interpolation.", language: "swift",
  source: `func greet(_ name: String = "Swift") -> String { "Hello, \\(name)!" }\nprint(greet())\nprint(greet("iOS"))\n`,
};
const swiftStruct: CodeTemplate = {
  id: "swift-struct", kind: "code", name: "Swift · Structs & Classes", icon: "swift",
  description: "Value types vs reference types in Swift.", language: "swift",
  source: `struct Point { var x: Double; var y: Double\n  func distance(to o: Point) -> Double { ((x-o.x)*(x-o.x) + (y-o.y)*(y-o.y)).squareRoot() }\n}\nlet a = Point(x: 0, y: 0); let b = Point(x: 3, y: 4)\nprint("distance =", a.distance(to: b))\n`,
};
const dartHello: CodeTemplate = {
  id: "dart-hello", kind: "code", name: "Dart · Hello", icon: "dart",
  description: "Functions, named args, and null-safety.", language: "dart",
  source: `String greet({String name = 'Dart'}) => 'Hello, \$name!';\n\nvoid main() {\n  print(greet());\n  print(greet(name: 'Flutter'));\n}\n`,
};
const flutterWidget: CodeTemplate = {
  id: "flutter-widget", kind: "code", name: "Flutter · Counter Widget", icon: "flutter",
  description: "Classic StatefulWidget counter snippet.", language: "dart",
  source: `// Snippet — paste into a Flutter project.\nimport 'package:flutter/material.dart';\n\nclass Counter extends StatefulWidget {\n  const Counter({super.key});\n  @override State<Counter> createState() => _CounterState();\n}\n\nclass _CounterState extends State<Counter> {\n  int _n = 0;\n  @override Widget build(BuildContext context) => Scaffold(\n    body: Center(child: Text('Count: \$_n', style: const TextStyle(fontSize: 32))),\n    floatingActionButton: FloatingActionButton(\n      onPressed: () => setState(() => _n++),\n      child: const Icon(Icons.add),\n    ),\n  );\n}\n`,
};
const objcHello: CodeTemplate = {
  id: "objc-hello", kind: "code", name: "Objective-C · Hello", icon: "objc",
  description: "NSLog from a classic Objective-C main.", language: "objc",
  source: `#import <Foundation/Foundation.h>\nint main(int argc, const char * argv[]) {\n  @autoreleasepool {\n    NSString *name = @"Objective-C";\n    NSLog(@"Hello from %@", name);\n  }\n  return 0;\n}\n`,
};

// ---------------------------------------------------------------------------
// Backend snippet templates — runnable in snippet mode, paired with API tester

const nodeExpress: CodeTemplate = {
  id: "be-express", kind: "code", name: "Express · REST API", icon: "express",
  description: "Minimal Express server with GET/POST routes.", language: "javascript",
  source: `// Snippet — run locally with: npm i express && node server.js\nconst express = require('express');\nconst app = express();\napp.use(express.json());\n\nconst todos = [];\napp.get('/api/todos', (_req, res) => res.json(todos));\napp.post('/api/todos', (req, res) => {\n  const t = { id: Date.now(), text: req.body.text, done: false };\n  todos.push(t); res.status(201).json(t);\n});\napp.delete('/api/todos/:id', (req, res) => {\n  const i = todos.findIndex(x => String(x.id) === req.params.id);\n  if (i >= 0) todos.splice(i, 1);\n  res.status(204).end();\n});\n\napp.listen(3000, () => console.log('http://localhost:3000'));\n`,
};
const nodeAuth: CodeTemplate = {
  id: "be-auth", kind: "code", name: "Express · Auth API", icon: "express",
  description: "JWT login + protected route with bcrypt hashing.", language: "javascript",
  source: `// Snippet — npm i express jsonwebtoken bcryptjs\nconst express = require('express');\nconst jwt = require('jsonwebtoken');\nconst bcrypt = require('bcryptjs');\nconst app = express(); app.use(express.json());\nconst SECRET = process.env.JWT_SECRET || 'dev-secret';\nconst users = new Map();\n\napp.post('/auth/register', async (req, res) => {\n  const { email, password } = req.body;\n  if (users.has(email)) return res.status(409).json({ error: 'exists' });\n  users.set(email, await bcrypt.hash(password, 10));\n  res.json({ ok: true });\n});\napp.post('/auth/login', async (req, res) => {\n  const { email, password } = req.body;\n  const hash = users.get(email);\n  if (!hash || !(await bcrypt.compare(password, hash))) return res.status(401).json({ error: 'invalid' });\n  res.json({ token: jwt.sign({ sub: email }, SECRET, { expiresIn: '1h' }) });\n});\napp.get('/me', (req, res) => {\n  const t = (req.headers.authorization || '').replace('Bearer ', '');\n  try { res.json(jwt.verify(t, SECRET)); } catch { res.status(401).end(); }\n});\napp.listen(3000);\n`,
};
const flaskApi: CodeTemplate = {
  id: "be-flask", kind: "code", name: "Flask · REST API", icon: "flask",
  description: "Minimal Flask CRUD API.", language: "python",
  source: `# Snippet — pip install flask && python app.py\nfrom flask import Flask, request, jsonify\napp = Flask(__name__)\nnotes = []\n\n@app.get("/api/notes")\ndef list_notes(): return jsonify(notes)\n\n@app.post("/api/notes")\ndef add_note():\n    n = { "id": len(notes)+1, "text": request.json["text"] }\n    notes.append(n)\n    return jsonify(n), 201\n\n@app.delete("/api/notes/<int:nid>")\ndef del_note(nid):\n    notes[:] = [n for n in notes if n["id"] != nid]\n    return "", 204\n\nif __name__ == "__main__":\n    app.run(port=5000, debug=True)\n`,
};
const fastapiApi: CodeTemplate = {
  id: "be-fastapi", kind: "code", name: "FastAPI · Typed API", icon: "fastapi",
  description: "Async FastAPI service with Pydantic models.", language: "python",
  source: `# Snippet — pip install fastapi uvicorn && uvicorn main:app --reload\nfrom fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Item(BaseModel):\n    id: int\n    name: str\n    price: float\n\nitems: dict[int, Item] = {}\n\n@app.get("/items")\ndef list_items(): return list(items.values())\n\n@app.post("/items", status_code=201)\ndef create(item: Item):\n    items[item.id] = item\n    return item\n\n@app.get("/items/{item_id}")\ndef read(item_id: int):\n    if item_id not in items: raise HTTPException(404)\n    return items[item_id]\n`,
};
const phpApi: CodeTemplate = {
  id: "be-php", kind: "code", name: "PHP · JSON API", icon: "php",
  description: "Single-file PHP REST endpoint.", language: "php",
  source: `<?php\nheader("Content-Type: application/json");\n$method = $_SERVER["REQUEST_METHOD"];\n$body = json_decode(file_get_contents("php://input"), true) ?? [];\n\n$db = json_decode(@file_get_contents("/tmp/items.json"), true) ?? [];\n\nswitch ($method) {\n  case "GET":  echo json_encode($db); break;\n  case "POST": $db[] = $body; file_put_contents("/tmp/items.json", json_encode($db));\n               http_response_code(201); echo json_encode($body); break;\n  default: http_response_code(405);\n}\n`,
};
const springBoot: CodeTemplate = {
  id: "be-spring", kind: "code", name: "Spring Boot · Controller", icon: "spring",
  description: "Spring Boot REST controller snippet.", language: "java",
  source: `// Snippet — paste into a Spring Boot project.\nimport org.springframework.web.bind.annotation.*;\nimport java.util.*;\n\n@RestController\n@RequestMapping("/api/users")\nclass UserController {\n  private final Map<Long, String> users = new HashMap<>();\n\n  @GetMapping public Collection<String> list() { return users.values(); }\n\n  @PostMapping public String create(@RequestBody Map<String,String> body) {\n    long id = users.size() + 1L;\n    users.put(id, body.get("name"));\n    return "Created " + id;\n  }\n\n  @DeleteMapping("/{id}") public void delete(@PathVariable long id) { users.remove(id); }\n}\n`,
};
const aspnetApi: CodeTemplate = {
  id: "be-aspnet", kind: "code", name: "ASP.NET · Minimal API", icon: "dotnet",
  description: "ASP.NET Core minimal API snippet.", language: "csharp",
  source: `// Snippet — dotnet new web && dotnet run\nvar builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\n\nvar todos = new List<string>();\napp.MapGet("/todos", () => todos);\napp.MapPost("/todos", (string text) => { todos.Add(text); return Results.Created($"/todos/{todos.Count}", text); });\napp.MapDelete("/todos/{i}", (int i) => { todos.RemoveAt(i); return Results.NoContent(); });\n\napp.Run();\n`,
};
const ginGo: CodeTemplate = {
  id: "be-gin", kind: "code", name: "Go · Gin REST API", icon: "go",
  description: "Gin web framework JSON CRUD.", language: "go",
  source: `// Snippet — go get github.com/gin-gonic/gin\npackage main\n\nimport (\n  "github.com/gin-gonic/gin"\n  "net/http"\n)\n\ntype Book struct{ ID int; Title string }\n\nfunc main() {\n  r := gin.Default()\n  books := []Book{{1, "Go in Action"}}\n  r.GET("/books", func(c *gin.Context) { c.JSON(http.StatusOK, books) })\n  r.POST("/books", func(c *gin.Context) {\n    var b Book\n    if err := c.BindJSON(&b); err != nil { return }\n    books = append(books, b); c.JSON(http.StatusCreated, b)\n  })\n  r.Run(":8080")\n}\n`,
};

// Database (SQL) templates — load into Database playground.

const dbStudent: CodeTemplate = {
  id: "db-student", kind: "code", name: "Students DB", icon: "database",
  description: "Schema + sample query for a student management system.", language: "sql",
  source: `-- Student Management System\nDROP TABLE IF EXISTS enrollments;\nDROP TABLE IF EXISTS students;\nDROP TABLE IF EXISTS courses;\n\nCREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, grade INTEGER);\nCREATE TABLE courses  (id INTEGER PRIMARY KEY, title TEXT NOT NULL, credits INTEGER);\nCREATE TABLE enrollments (\n  student_id INTEGER REFERENCES students(id),\n  course_id  INTEGER REFERENCES courses(id),\n  score      INTEGER\n);\n\nINSERT INTO students VALUES (1,'Ada Lovelace','ada@uni.edu',12),(2,'Alan Turing','alan@uni.edu',11),(3,'Grace Hopper','grace@uni.edu',12);\nINSERT INTO courses  VALUES (1,'Algorithms',4),(2,'Compilers',3),(3,'Databases',4);\nINSERT INTO enrollments VALUES (1,1,95),(1,3,90),(2,2,88),(3,1,92),(3,3,98);\n\n-- Top students per course\nSELECT c.title, s.name, e.score\nFROM enrollments e\nJOIN students s ON s.id = e.student_id\nJOIN courses  c ON c.id = e.course_id\nORDER BY c.title, e.score DESC;\n`,
};
const dbEmployee: CodeTemplate = {
  id: "db-employee", kind: "code", name: "Employees DB", icon: "database",
  description: "Departments + salaries with aggregates.", language: "sql",
  source: `DROP TABLE IF EXISTS employees;\nDROP TABLE IF EXISTS departments;\nCREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE employees  (id INTEGER PRIMARY KEY, name TEXT, salary REAL, dept_id INTEGER REFERENCES departments(id));\n\nINSERT INTO departments VALUES (1,'Engineering'),(2,'Design'),(3,'Sales');\nINSERT INTO employees VALUES\n (1,'Alex',95000,1),(2,'Sam',82000,1),(3,'Jordan',78000,2),(4,'Riley',120000,3),(5,'Kai',88000,3);\n\nSELECT d.name AS dept, COUNT(*) AS people, ROUND(AVG(e.salary),2) AS avg_salary\nFROM employees e JOIN departments d ON d.id = e.dept_id\nGROUP BY d.name ORDER BY avg_salary DESC;\n`,
};
const dbEcommerce: CodeTemplate = {
  id: "db-ecom", kind: "code", name: "E-commerce DB", icon: "database",
  description: "Products, orders, line items with revenue rollup.", language: "sql",
  source: `DROP TABLE IF EXISTS order_items;\nDROP TABLE IF EXISTS orders;\nDROP TABLE IF EXISTS products;\nCREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);\nCREATE TABLE orders   (id INTEGER PRIMARY KEY, customer TEXT, created_at TEXT);\nCREATE TABLE order_items (\n  order_id INTEGER REFERENCES orders(id),\n  product_id INTEGER REFERENCES products(id),\n  qty INTEGER\n);\n\nINSERT INTO products VALUES (1,'Headphones',129.99),(2,'Keyboard',89.50),(3,'Mouse',49.00);\nINSERT INTO orders VALUES (1,'Alice','2026-01-10'),(2,'Bob','2026-01-12'),(3,'Alice','2026-02-03');\nINSERT INTO order_items VALUES (1,1,1),(1,3,2),(2,2,1),(3,1,1),(3,2,1);\n\nSELECT p.name, SUM(i.qty) AS units_sold, ROUND(SUM(i.qty*p.price),2) AS revenue\nFROM order_items i JOIN products p ON p.id = i.product_id\nGROUP BY p.name ORDER BY revenue DESC;\n`,
};
const dbLibrary: CodeTemplate = {
  id: "db-library", kind: "code", name: "Library DB", icon: "database",
  description: "Books, members, and checkout history.", language: "sql",
  source: `DROP TABLE IF EXISTS loans;\nDROP TABLE IF EXISTS books;\nDROP TABLE IF EXISTS members;\nCREATE TABLE books   (id INTEGER PRIMARY KEY, title TEXT, author TEXT);\nCREATE TABLE members (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE loans   (book_id INTEGER, member_id INTEGER, borrowed_on TEXT, returned_on TEXT);\n\nINSERT INTO books VALUES (1,'Dune','Herbert'),(2,'Sapiens','Harari'),(3,'1984','Orwell');\nINSERT INTO members VALUES (1,'Mia'),(2,'Noah');\nINSERT INTO loans VALUES (1,1,'2026-03-01','2026-03-10'),(2,1,'2026-03-12',NULL),(3,2,'2026-02-20','2026-03-02');\n\nSELECT m.name AS member, b.title, l.borrowed_on,\n  CASE WHEN l.returned_on IS NULL THEN 'on loan' ELSE 'returned' END AS status\nFROM loans l JOIN books b ON b.id = l.book_id JOIN members m ON m.id = l.member_id;\n`,
};
const dbHospital: CodeTemplate = {
  id: "db-hospital", kind: "code", name: "Hospital DB", icon: "database",
  description: "Patients, doctors, and appointments.", language: "sql",
  source: `DROP TABLE IF EXISTS appointments;\nDROP TABLE IF EXISTS doctors;\nDROP TABLE IF EXISTS patients;\nCREATE TABLE patients (id INTEGER PRIMARY KEY, name TEXT, dob TEXT);\nCREATE TABLE doctors  (id INTEGER PRIMARY KEY, name TEXT, specialty TEXT);\nCREATE TABLE appointments (\n  id INTEGER PRIMARY KEY, patient_id INTEGER, doctor_id INTEGER, scheduled_at TEXT\n);\n\nINSERT INTO patients VALUES (1,'Jane','1990-05-01'),(2,'Mark','1985-12-22');\nINSERT INTO doctors  VALUES (1,'Dr. Lee','Cardiology'),(2,'Dr. Patel','Pediatrics');\nINSERT INTO appointments VALUES (1,1,1,'2026-04-01 09:30'),(2,2,2,'2026-04-02 14:00'),(3,1,2,'2026-04-05 11:15');\n\nSELECT p.name AS patient, d.name AS doctor, d.specialty, a.scheduled_at\nFROM appointments a\nJOIN patients p ON p.id = a.patient_id\nJOIN doctors  d ON d.id = a.doctor_id\nORDER BY a.scheduled_at;\n`,
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
  // Mobile-only web shells
  tag(bottomNavApp, ["mobile"]),
  tag(feedApp, ["mobile"]),
  tag(pwaTodo, ["mobile"]),
  tag(onboarding, ["mobile"]),
  // Mobile-native snippets
  tag(kotlinHello, ["mobile", "code"]),
  tag(kotlinOop, ["mobile", "code"]),
  tag(kotlinAndroid, ["mobile"]),
  tag(javaMobileHello, ["mobile"]),
  tag(javaAndroid, ["mobile"]),
  tag(swiftHello, ["mobile", "code"]),
  tag(swiftStruct, ["mobile", "code"]),
  tag(dartHello, ["mobile", "code"]),
  tag(flutterWidget, ["mobile"]),
  tag(objcHello, ["mobile", "code"]),
  // Code (general) templates
  tag(pythonHello, ["code"]),
  tag(pyFizzBuzz, ["code"]),
  tag(nodeHello, ["code"]),
  tag(tsDemo, ["code"]),
  tag(javaHello, ["code"]),
  tag(javaCalc, ["code"]),
  tag(cppDemo, ["code"]),
  tag(goDemo, ["code"]),
  tag(rustDemo, ["code"]),
  // Backend snippets
  tag(nodeExpress, ["backend"]),
  tag(nodeAuth, ["backend"]),
  tag(flaskApi, ["backend"]),
  tag(fastapiApi, ["backend"]),
  tag(phpApi, ["backend"]),
  tag(springBoot, ["backend"]),
  tag(aspnetApi, ["backend"]),
  tag(ginGo, ["backend"]),
  // Database (SQL) templates
  tag(dbStudent, ["database"]),
  tag(dbEmployee, ["database"]),
  tag(dbEcommerce, ["database"]),
  tag(dbLibrary, ["database"]),
  tag(dbHospital, ["database"]),
];

export const WEB_TEMPLATES = TEMPLATES.filter((t): t is WebTemplate => t.kind === "web");
export const CODE_TEMPLATES = TEMPLATES.filter((t): t is CodeTemplate => t.kind === "code");

export function templatesForTrack(track: Track): Template[] {
  return TEMPLATES.filter((t) => (t.tracks ?? []).includes(track));
}

