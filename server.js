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
  // ดึงเวลาประเทศไทยจริง (UTC+7)
  const now = new Date();
  const thaiTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const thaiDate = new Date(thaiTimeString);

  const hours = thaiDate.getHours();
  const minutes = thaiDate.getMinutes();
  const currentTimeDecimal = hours + minutes / 60;

  // จำลองค่าแสง LDR (0 - 4095)
  const ldrValue = Math.floor(Math.random() * 4096);
  const LDR_THRESHOLD = 2000; 

  // 1. ตรวจสอบค่าแสงตอน 10:50 น. พอดี เพื่อเตรียมพร้อมสำหรับ Air 3 ช่วง 11:30 - 14:00 น.
  if (hours === 10 && minutes >= 50 && !checkedToday) {
    isSunnyMorning = (ldrValue >= LDR_THRESHOLD);
    checkedToday = true;
  }

  // รีเซ็ตสถานะตอนเที่ยงคืน
  if (hours === 0 && minutes === 0) {
    checkedToday = false;
    isSunnyMorning = false;
  }

  // ค่าเริ่มต้นตั้งแต่นอกเวลาทำงาน (ก่อน 08:00 หรือหลัง 16:00 น.) คือปิดทั้งหมด (หยุดพักเลิกงาน)
  airState.air1 = false;
  airState.air2 = false;
  airState.air3 = false;

  // ถือว่าอยู่ในช่วงเวลาทำงาน (08:00 - 16:00 น.) และเปิดโหมด Auto Schedule
  if (autoScheduleEnabled && currentTimeDecimal >= 8.0 && currentTimeDecimal <= 16.0) {
    
    // 08:00 - 08:30 น. -> Air 1 ทำงาน
    if (currentTimeDecimal >= 8.0 && currentTimeDecimal < 8.5) {
      airState.air1 = true;
      airState.air2 = false;
      airState.air3 = false;
    }
    // 08:30 - 09:00 น. -> Air 2 ทำงาน
    else if (currentTimeDecimal >= 8.5 && currentTimeDecimal < 9.0) {
      airState.air1 = false;
      airState.air2 = true;
      airState.air3 = false;
    }
    // 09:00 - 09:30 น. -> Air 1 ทำงาน
    else if (currentTimeDecimal >= 9.0 && currentTimeDecimal < 9.5) {
      airState.air1 = true;
      airState.air2 = false;
      airState.air3 = false;
    }
    // 09:30 - 10:00 น. -> Air 2 ทำงาน
    else if (currentTimeDecimal >= 9.5 && currentTimeDecimal < 10.0) {
      airState.air1 = false;
      airState.air2 = true;
      airState.air3 = false;
    }
    // 10:00 - 11:00 น. -> Air 1 ทำงานยาว
    else if (currentTimeDecimal >= 10.0 && currentTimeDecimal < 11.0) {
      airState.air1 = true;
      airState.air2 = false;
      airState.air3 = false;
    }
    // 10:30 - 11:30 น. -> Air 2 ทำงานร่วมด้วยในช่วงนี้ (ทับซ้อนตามโจทย์)
    else if (currentTimeDecimal >= 10.5 && currentTimeDecimal < 11.5) {
      // ช่วง 10.30-11.00 Air 1 และ Air 2 อาจทำงานร่วมกัน
      if (currentTimeDecimal < 11.0) {
        airState.air1 = true;
      }
      airState.air2 = true;
      airState.air3 = false;
    }
    // 11:30 - 14:00 น. -> Air 3 ทำงาน (อิงหลักการ LDR ที่เช็กตอน 10:50 น.)
    else if (currentTimeDecimal >= 11.5 && currentTimeDecimal < 14.0) {
      if (isSunnyMorning) {
        airState.air3 = true; // แดดดี เปิด Air 3
        airState.air1 = false;
        airState.air2 = false;
      } else {
        // ถ้าแดดไม่พอ ให้ Air 1 และ Air 2 ทำงานสำรองแทน
        airState.air3 = false;
        airState.air1 = true;
        airState.air2 = true;
      }
    }
    // 12:00 - 14:30 น. -> Air 2 ทำงานร่วมในช่วงนี้ด้วย
    else if (currentTimeDecimal >= 12.0 && currentTimeDecimal < 14.5) {
      airState.air2 = true;
      // Air 3 ยังคงทำงานอยู่หากอยู่ในช่วง 11.30-14.00 หลังจากนั้น Air 3 จะเปลี่ยนสถานะตามช่วงถัดไป
      if (currentTimeDecimal >= 14.0) {
        airState.air3 = false;
      }
    }
    // 14:00 - 14:30 น. -> สลับ Air 1 มาทำงานแทน Air 3
    else if (currentTimeDecimal >= 14.0 && currentTimeDecimal < 14.5) {
      airState.air1 = true;
      airState.air3 = false;
    }
    // 14:30 - 15:30 น. -> Air 3 กลับมาทำงาน
    else if (currentTimeDecimal >= 14.5 && currentTimeDecimal < 15.5) {
      airState.air3 = true;
      airState.air1 = false;
      airState.air2 = false;
    }
    // 15:00 - 15:30 น. -> Air 2 ทำงานในช่วงนี้ร่วมด้วย
    else if (currentTimeDecimal >= 15.0 && currentTimeDecimal < 15.5) {
      airState.air2 = true;
    }
    // 15:30 - 16:00 น. -> สลับให้ Air 1 ทำงาน
    else if (currentTimeDecimal >= 15.5 && currentTimeDecimal <= 16.0) {
      airState.air1 = true;
      airState.air2 = false;
      airState.air3 = false;
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
