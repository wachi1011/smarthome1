const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ตัวแปรควบคุมโหมด Auto Schedule และสถานะแอร์
let autoScheduleEnabled = true; 
let isSunnyMorning = false;
let checkedToday = false; 

let airState = {
  air1: false, // Pin 32
  air2: false, // Pin 33
  air3: false  // Pin 25 (ควบคุมด้วย LDR ช่วง 11:00-14:00)
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

  // ถ้าเปิดโหมด Auto Schedule ให้คำนวณตามเวลาและ LDR
  if (autoScheduleEnabled) {
    // ช่วง 11:00 - 14:00 น.
    if (currentTimeDecimal >= 11.0 && currentTimeDecimal < 14.0) {
      if (isSunnyMorning) {
        // แสงดี -> เปิด Air 3 / ปิด Air 1, Air 2
        airState.air3 = true;
        airState.air1 = false;
        airState.air2 = false;
      } else {
        // แสงน้อย -> ปิด Air 3 / เปิด Air 1 และ Air 2 พร้อมกัน
        airState.air3 = false;
        airState.air1 = true;
        airState.air2 = true;
      }
    } else {
      // นอกช่วง 11:00 - 14:00 น. (เช่นช่วงอื่นๆ ตามตารางกราฟ)
      airState.air3 = false;
      // Air 1 และ Air 2 ทำงานสลับหรือพร้อมกันตามช่วงเวลาในกราฟ
      const activePeriod = Math.floor(currentTimeDecimal * 2) % 2 === 0;
      airState.air1 = activePeriod;
      airState.air2 = activePeriod;
    }
  }

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

// API เปิด-ปิดโหมด Auto
app.post('/api/toggle-auto', (req, res) => {
  autoScheduleEnabled = req.body.auto;
  res.json({ success: true, autoScheduleEnabled });
});

// API ควบคุมแอร์แบบ Manual (กรณีปิด Auto)
app.post('/api/control', (req, res) => {
  const { air, state } = req.body;
  if (!autoScheduleEnabled && airState.hasOwnProperty(air)) {
    airState[air] = state;
    res.json({ success: true, airState });
  } else {
    res.status(400).json({ success: false, message: 'Auto mode is enabled or invalid device' });
  }
});

// API ควบคุมทั้งหมด (เปิด/ปิดทั้งหมด)
app.post('/api/control-all', (req, res) => {
  const state = req.body.state;
  autoScheduleEnabled = false; // ปิด auto ชั่วคราวเมื่อกดควบคุมทั้งหมด
  airState.air1 = state;
  airState.air2 = state;
  airState.air3 = state;
  res.json({ success: true, airState, autoScheduleEnabled });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
