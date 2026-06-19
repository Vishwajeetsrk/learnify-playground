// One-tap project templates for the mobile IDE.
// Web templates are multi-file (HTML/CSS/JS) and render in the live preview.
// Script templates are single-file and run via Wandbox/Piston.
import type { LangKey } from "@/lib/executors";

export type TemplateKind = "web" | "code";
export type Track = "code" | "web" | "mobile";

export interface WebTemplate {
  id: string;
  kind: "web";
  name: string;
  emoji: string;
  description: string;
  tracks?: Track[];
  files: { html: string; css: string; js: string };
}

export interface CodeTemplate {
  id: string;
  kind: "code";
  name: string;
  emoji: string;
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
  emoji: "🧮",
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
  emoji: "✅",
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
  emoji: "🔐",
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
  emoji: "💬",
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
  emoji: "📝",
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
  emoji: "💸",
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
  emoji: "🆕",
  description: "Empty HTML/CSS/JS project.",
  files: {
    html: `<h1>Hello, world</h1>\n<p>Edit me in the editor.</p>`,
    css: `body { font-family: system-ui, sans-serif; padding: 32px; background:#0b1020; color:#e8ecff; }`,
    js: `console.log('Hello from JS');`,
  },
};

const pythonHello: CodeTemplate = {
  id: "py-hello", kind: "code", name: "Python · Hello", emoji: "🐍",
  description: "Classic Hello World in Python.", language: "python",
  source: `name = input("Your name? ") or "world"\nprint(f"Hello, {name}!")\n`,
};
const nodeHello: CodeTemplate = {
  id: "node-hello", kind: "code", name: "Node · Hello", emoji: "🟩",
  description: "Hello World in Node.js.", language: "javascript",
  source: `const greet = (n = 'world') => \`Hello, \${n}!\`;\nconsole.log(greet('Lovable'));\n`,
};
const javaHello: CodeTemplate = {
  id: "java-hello", kind: "code", name: "Java · Hello", emoji: "☕",
  description: "Hello World in Java.", language: "java",
  source: `class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from Java\");\n  }\n}\n`,
};

export const TEMPLATES: Template[] = [
  blank, calculator, todo, login, chat, notes, expense,
  pythonHello, nodeHello, javaHello,
];

export const WEB_TEMPLATES = TEMPLATES.filter((t): t is WebTemplate => t.kind === "web");
export const CODE_TEMPLATES = TEMPLATES.filter((t): t is CodeTemplate => t.kind === "code");
