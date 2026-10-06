const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.json());

// 1. ให้ Express ค้นหาไฟล์ทั้งในโฟลเดอร์หลัก และโฟลเดอร์ public
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// 2. ส่งไฟล์ index.html ออกไป (ลองหาจากทั้งใน public และใน root)
app.get('/', (req, res) => {
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  const rootIndexPath = path.join(__dirname, 'index.html');

  // ตรวจสอบว่าไฟล์อยู่ข้างใน public หรือไม่อยู่ข้างนอก
  const fs = require('fs');
  if (fs.existsSync(publicIndexPath)) {
    res.sendFile(publicIndexPath);
  } else if (fs.existsSync(rootIndexPath)) {
    res.sendFile(rootIndexPath);
  } else {
    res.status(404).send('ไม่พบไฟล์ index.html ในโปรเจกต์');
  }
});

// ==========================================
// ส่วนโค้ด WebSocket และ API ด้านล่างคงไว้ตามเดิม
// ==========================================
const wss = new WebSocket.Server({ server, path: '/esp' });
let relayStates = [false, false, false, false];

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.send(JSON.stringify({ type: 'INIT_STATE', relays: relayStates }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'GET_STATE') {
        ws.send(JSON.stringify({ type: 'STATE_UPDATE', relays: relayStates }));
      }
    } catch (err) {
      console.error('[WS] Error:', err.message);
    }
  });
});

app.get('/api/relays', (req, res) => {
  res.json({ relays: relayStates });
});

app.post('/api/control', (req, res) => {
  const { ch, state } = req.body;
  if (typeof ch === 'number' && ch >= 0 && ch < 4 && typeof state === 'boolean') {
    relayStates[ch] = state;
    broadcast({ type: 'CONTROL', ch: ch, state: state });
    return res.json({ success: true, ch: ch, state: state, relays: relayStates });
  }
  res.status(400).json({ success: false });
});

app.post('/api/control-all', (req, res) => {
  const { state } = req.body;
  if (typeof state === 'boolean') {
    relayStates = [state, state, state, state];
    broadcast({ type: 'CONTROL_ALL', state: state });
    return res.json({ success: true, state: state, relays: relayStates });
  }
  res.status(400).json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
