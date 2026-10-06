const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// สร้าง WebSocket Server ให้รับ Path /esp ตามที่ ESP32 ต่อเข้ามา
const wss = new WebSocket.Server({ server, path: '/esp' });

// เก็บสถานะของ Relay ทั้ง 4 ช่อง (default: false ทั้งหมด)
let relayStates = [false, false, false, false];

app.use(express.json());

// Broadcast ข้อความหาทุก Client ที่เชื่อมต่ออยู่
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket Event Handling
wss.on('connection', (ws) => {
  console.log('[WS] มีอุปกรณ์เชื่อมต่อเข้ามาใหม่');

  // ส่งสถานะปัจจุบันให้ ESP32 ทันทีที่ต่อสำเร็จ
  ws.send(JSON.stringify({ type: 'INIT_STATE', relays: relayStates }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WS] รับข้อความ:', data);

      // รองรับคำสั่ง GET_STATE ที่ ESP32 ส่งมาขอสถานะ
      if (data.type === 'GET_STATE') {
        ws.send(JSON.stringify({ type: 'STATE_UPDATE', relays: relayStates }));
      }
    } catch (err) {
      console.error('[WS] ไม่สามารถแปลง JSON ได้:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[WS] อุปกรณ์ตัดการเชื่อมต่อ');
  });
});

// ==========================================
// REST APIs สำหรับสั่งงานผ่าน Web / App / Postman
// ==========================================

// 1. ดึงสถานะรีเลย์ปัจจุบัน
app.get('/api/relays', (req, res) => {
  res.json({ relays: relayStates });
});

// 2. ควบคุมรีเลย์รายช่อง (Body: { "ch": 0, "state": true })
app.post('/api/control', (req, res) => {
  const { ch, state } = req.body;

  if (typeof ch === 'number' && ch >= 0 && ch < 4 && typeof state === 'boolean') {
    relayStates[ch] = state;
    
    // ส่งคำสั่ง CONTROL ไปยัง ESP32
    broadcast({ type: 'CONTROL', ch: ch, state: state });

    return res.json({ success: true, ch: ch, state: state, relays: relayStates });
  }

  res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง (ระบุ ch: 0-3 และ state: true/false)' });
});

// 3. ควบคุมรีเลย์ทั้งหมดพร้อมกัน (Body: { "state": true })
app.post('/api/control-all', (req, res) => {
  const { state } = req.body;

  if (typeof state === 'boolean') {
    relayStates = [state, state, state, state];

    // ส่งคำสั่ง CONTROL_ALL ไปยัง ESP32
    broadcast({ type: 'CONTROL_ALL', state: state });

    return res.json({ success: true, state: state, relays: relayStates });
  }

  res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง (ระบุ state: true/false)' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Server] ทำงานอยู่ที่พอร์ต ${PORT}`);
});
