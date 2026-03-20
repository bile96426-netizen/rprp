const express = require('express');
const path = require('path');
const { startBot, stopBot, getStatus } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/status', (req, res) => {
  res.json({ running: getStatus() });
});

app.post('/start', async (req, res) => {
  try {
    await startBot();
    res.json({ success: true, running: true });
  } catch (err) {
    console.error('[Server] Start error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/stop', (req, res) => {
  try {
    stopBot();
    res.json({ success: true, running: false });
  } catch (err) {
    console.error('[Server] Stop error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Control panel running at http://localhost:${PORT}`);
});
