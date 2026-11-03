const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ให้บริการไฟล์ Static จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// จำลองสถานะของรีเลย์ตามพิน 32, 33, 25, 26
let relayState = {
  relay1: false, // Pin 32
  relay2: false, // Pin 33
  relay3: false, // Pin 25
  relay4: false  // Pin 26
};

// API สำหรับดึงสถานะรีเลย์และค่า LDR ปัจจุบัน
app.get('/api/status', (req, res) => {
  // จำลองค่า LDR (ในหน้างานจริงเชื่อมต่อกับ Hardware เช่น ESP32)
  const ldrValue = Math.floor(Math.random() * 4096); 
  res.json({
    ldrValue,
    relayState
  });
});

// API สำหรับสั่งเปิด-ปิดรีเลย์
app.post('/api/control', (req, res) => {
  const { relay, state } = req.body;
  if (relayState.hasOwnProperty(relay)) {
    relayState[relay] = state;
    // หมายเหตุ: ตรงนี้สามารถเขียนโค้ดสั่งงาน GPIO จริงได้หากรันบนบอร์ด (เช่น Board Node.js / Johnny-Five / หรือส่ง MQTT ไป ESP32)
    res.json({ success: true, relayState });
  } else {
    res.status(400).json({ success: false, message: 'Invalid relay pin' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
