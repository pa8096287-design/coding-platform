// CodeDock frontend
// Code is run inside a Web Worker so the page never freezes on infinite loops.

let problems = [];
let current = null;

const els = {
  list: document.getElementById('problemList'),
  title: document.getElementById('title'),
  difficulty: document.getElementById('difficulty'),
  description: document.getElementById('description'),
  example: document.getElementById('example'),
  editor: document.getElementById('editor'),
  results: document.getElementById('results'),
  runBtn: document.getElementById('runBtn'),
  resetBtn: document.getElementById('resetBtn'),
  progressText: document.getElementById('progressText'),
  progressFill: document.getElementById('progressFill'),
};

// ---------- saved progress (localStorage) ----------
function getSaved() {
  try {
    return JSON.parse(localStorage.getItem('codedock') || '{}');
  } catch (e) {
    return {};
  }
}

function save(data) {
  localStorage.setItem('codedock', JSON.stringify(data));
}

function isSolved(id) {
  return !!(getSaved()[id] && getSaved()[id].solved);
}

function saveCode(id, code) {
  const data = getSaved();
  data[id] = { ...(data[id] || {}), code };
  save(data);
}

function markSolved(id) {
  const data = getSaved();
  data[id] = { ...(data[id] || {}), solved: true };
  save(data);
}

// ---------- UI ----------
function renderList() {
  els.list.innerHTML = '';
  problems.forEach((p) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = p.title;
    if (current && current.id === p.id) btn.classList.add('active');
    if (isSolved(p.id)) {
      const tick = document.createElement('span');
      tick.className = 'check';
      tick.textContent = '✓';
      btn.appendChild(tick);
    }
    btn.addEventListener('click', () => openProblem(p.id));
    li.appendChild(btn);
    els.list.appendChild(li);
  });

  const done = problems.filter((p) => isSolved(p.id)).length;
  els.progressText.textContent = `${done} / ${problems.length} solved`;
  els.progressFill.style.width = problems.length ? (done / problems.length) * 100 + '%' : '0';
}

function openProblem(id) {
  current = problems.find((p) => p.id === id);
  els.title.textContent = current.title;
  els.difficulty.textContent = current.difficulty;
  els.difficulty.className = 'tag ' + current.difficulty;
  els.description.textContent = current.description;
  els.example.textContent = current.example;

  const saved = getSaved()[id];
  els.editor.value = saved && saved.code ? saved.code : current.starter;
  els.results.innerHTML = '<p class="muted">Write your solution and press Run tests.</p>';
  renderList();
}

function showResults(data) {
  if (data.error) {
    els.results.innerHTML = `<p class="summary bad">Error</p><div class="case fail">${escapeHtml(data.error)}</div>`;
    return;
  }

  const passed = data.results.filter((r) => r.ok).length;
  const all = passed === data.results.length;
  let html = `<p class="summary ${all ? 'ok' : 'bad'}">${
    all ? 'All tests passed 🎉' : passed + ' of ' + data.results.length + ' tests passed'
  }</p>`;

  data.results.forEach((r, i) => {
    html += `<div class="case ${r.ok ? 'pass' : 'fail'}"><b>Test ${i + 1}: ${r.ok ? 'passed' : 'failed'}</b><br>`;
    html += `input: ${escapeHtml(r.input)}<br>`;
    if (!r.ok) html += `expected: ${escapeHtml(r.expected)}<br>got: ${escapeHtml(r.got)}`;
    html += '</div>';
  });
  els.results.innerHTML = html;

  if (all) {
    markSolved(current.id);
    renderList();
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- running code ----------
const workerSource = `
  self.onmessage = (e) => {
    const { code, fn, cases } = e.data;
    try {
      const userFn = new Function(code + '\\nreturn ' + fn + ';')();
      const results = cases.map((c) => {
        let got;
        try {
          got = userFn(...JSON.parse(JSON.stringify(c.args)));
        } catch (err) {
          got = 'Error: ' + err.message;
        }
        const ok = JSON.stringify(got) === JSON.stringify(c.expected);
        return {
          ok,
          input: c.args.map((a) => JSON.stringify(a)).join(', '),
          expected: JSON.stringify(c.expected),
          got: got === undefined ? 'undefined' : JSON.stringify(got),
        };
      });
      self.postMessage({ results });
    } catch (err) {
      self.postMessage({ error: err.message });
    }
  };
`;

function runTests() {
  saveCode(current.id, els.editor.value);
  els.runBtn.disabled = true;
  els.runBtn.textContent = 'Running...';

  const blob = new Blob([workerSource], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));

  // kill the worker if the code runs too long
  const timer = setTimeout(() => {
    worker.terminate();
    finish({ error: 'Time limit exceeded (3 seconds). Check for an infinite loop.' });
  }, 3000);

  function finish(data) {
    clearTimeout(timer);
    worker.terminate();
    els.runBtn.disabled = false;
    els.runBtn.textContent = 'Run tests';
    showResults(data);
  }

  worker.onmessage = (e) => finish(e.data);
  worker.onerror = (e) => finish({ error: e.message });
  worker.postMessage({ code: els.editor.value, fn: current.fn, cases: current.cases });
}

// ---------- events ----------
els.runBtn.addEventListener('click', runTests);

els.resetBtn.addEventListener('click', () => {
  if (confirm('Reset your code to the starter template?')) {
    els.editor.value = current.starter;
    saveCode(current.id, current.starter);
  }
});

// tab key should insert spaces instead of moving focus
els.editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = els.editor.selectionStart;
    els.editor.setRangeText('  ', start, els.editor.selectionEnd, 'end');
  }
});

els.editor.addEventListener('input', () => {
  if (current) saveCode(current.id, els.editor.value);
});

// ---------- start ----------
fetch('/api/problems')
  .then((res) => res.json())
  .then((data) => {
    problems = data;
    openProblem(problems[0].id);
  })
  .catch(() => {
    els.results.innerHTML = '<p class="summary bad">Could not load problems. Is the server running?</p>';
  });
