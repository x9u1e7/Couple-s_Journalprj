const express = require('express');
const path = require('path');

const app = express();
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`情侶日記已啟動：http://localhost:${port}`);
  });
}

module.exports = app;
