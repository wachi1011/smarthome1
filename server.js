const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let autoScheduleEnabled = true; 
let isSunnyMorning = false;
let checkedToday = false; 

let airState = {
  air1: false, // Pin 32
  air2: false, // Pin 33
  air3: false  // Pin 25 (LDR Control)
};

function updateSchedule() {
  const now = new Date();
  const thaiTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const thaiDate = new Date(thaiTimeString);

  const hours = thaiDate.getHours();
  const minutes = thaiDate.getMinutes();
  const currentTimeDecimal = hours + minutes / 60;

  // จำลองค่าแสง LDR (0 - 4095)
  const ldrValue = Math.floor(Math.random() * 4096);
  const LDR_THRESHOLD = 2000; 

  // 1. ตรวจสอบค่าแสงตอน 10:50 น. พอดี
  if (hours === 10 && minutes >= 50 && !checkedToday) {
    isSunnyMorning = (ldrValue >= LDR_THRESHOLD);
    checkedToday = true;
  }

  // รีเซ็ตสถานะตอนเที่ยงคืน
  if (hours === 0 && minutes === 0) {
    checkedToday = false;
    isSunnyMorning = false;
  }

  // ค่าเริ่มต้นตั้งต้นเป็นปิดทั้งหมด
  let on1 = false;
  let on2 = false;
  let on3 = false;

  // ถือว่าอยู่ในช่วงเวลาทำงาน (08:00 - 16:00 น.) และเปิดโหมด Auto Schedule
  if (autoScheduleEnabled && currentTimeDecimal >= 8.0 && currentTimeDecimal <= 16.0) {
    
    // --- 1. เงื่อนไขการทำงานของ Air 1 ---
    if (
      (currentTimeDecimal >= 8.0 && currentTimeDecimal < 8.5) ||
      (currentTimeDecimal >= 9.0 && currentTimeDecimal < 9.5) ||
      (currentTimeDecimal >= 10.0 && currentTimeDecimal < 11.0) ||
      (currentTimeDecimal >= 14.0 && currentTimeDecimal < 14.5) ||
      (currentTimeDecimal >= 15.5 && currentTimeDecimal <= 16.0)
    ) {
      on1 = true;
    }

    // --- 2. เงื่อนไขการทำงานของ Air 2 (รองรับช่วงเวลาทับซ้อนได้อย่างอิสระ) ---
    if (
      (currentTimeDecimal >= 8.5 && currentTimeDecimal < 9.0) ||
      (currentTimeDecimal >= 9.5 && currentTimeDecimal < 10.0) ||
      (currentTimeDecimal >= 10.5 && currentTimeDecimal < 11.5) ||
      (currentTimeDecimal >= 12.0 && currentTimeDecimal < 14.5) ||
      (currentTimeDecimal >= 15.0 && currentTimeDecimal < 15.5)
    ) {
      on2 = true;
    }

    // --- 3. เงื่อนไขการทำงานของ Air 3 (อิง LDR ตอน 10:50 น.) ---
    if (isSunnyMorning) {
      // ถ้าแดดดี Air 3 จะทำงานในช่วง 11:30-14:00 และ 14:30-15:30
      if (
        (currentTimeDecimal >= 11.5 && currentTimeDecimal < 14.0) ||
        (currentTimeDecimal >= 14.5 && currentTimeDecimal < 15.5)
      ) {
        on3 = true;
      }
    } else {
      // ถ้าแดดไม่พอ ให้ Air 1 และ Air 2 ทำงานสำรองแทนในช่วงเวลาดังกล่าว
      if (
        (currentTimeDecimal >= 11.5 && currentTimeDecimal < 14.0) ||
        (currentTimeDecimal >= 14.5 && currentTimeDecimal < 15.5)
      ) {
        on1 = true;
        on2 = true;
      }
    }
  }

  // อัปเดตสถานะกลับเข้าไปยังตัวแปรหลัก
  airState.air1 = on1;
  airState.air2 = on2;
  airState.air3 = on3;

  return { ldrValue, thaiTimeFormatted: thaiDate.toLocaleTimeString('th-TH') };
}
// API ดึงสถานะ
app.get('/api/status', (req, res) => {
  const { ldrValue, thaiTimeFormatted } = updateSchedule();
  res.json({
    ldrValue,
    thaiTimeFormatted,
    autoScheduleEnabled,
    isSunnyMorning,
    checkedToday,
    airState
  });
});

app.post('/api/toggle-auto', (req, res) => {
  autoScheduleEnabled = req.body.auto;
  res.json({ success: true, autoScheduleEnabled });
});

app.post('/api/control', (req, res) => {
  const { air, state } = req.body;
  if (!autoScheduleEnabled && airState.hasOwnProperty(air)) {
    airState[air] = state;
    res.json({ success: true, airState });
  } else {
    res.status(400).json({ success: false, message: 'Auto mode is enabled or invalid device' });
  }
});

app.post('/api/control-all', (req, res) => {
  const state = req.body.state;
  autoScheduleEnabled = false;
  airState.air1 = state;
  airState.air2 = state;
  airState.air3 = state;
  res.json({ success: true, airState, autoScheduleEnabled });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
