const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const dataFile = path.join(__dirname, 'problems.json');
const publicDir = path.join(__dirname, 'public');

// quick check so setup mistakes show a clear message instead of a random crash
if (!fs.existsSync(dataFile)) {
  console.error('problems.json not found. It must be in the project root, next to server.js');
  process.exit(1);
}
if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
  console.error('public/index.html not found. Put index.html, style.css and app.js inside a folder named "public"');
  process.exit(1);
}

const problems = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

app.use(express.static(publicDir));

app.get('/api/problems', (req, res) => {
  res.json(problems);
});

app.get('/api/problems/:id', (req, res) => {
  const found = problems.find((p) => p.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Problem not found' });
  res.json(found);
});

app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`CodeDock running on http://localhost:${PORT}`);
});
