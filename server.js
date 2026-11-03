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
  air3: false  // Pin 25
};

function updateSchedule() {
  const now = new Date();
  const thaiTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const thaiDate = new Date(thaiTimeString);

  const hours = thaiDate.getHours();
  const minutes = thaiDate.getMinutes();
  const currentTimeDecimal = hours + minutes / 60;

  // จำลองค่าแสง LDR (0 - 4095) ในหน้างานจริงเปลี่ยนเปน analogRead()
  const ldrValue = Math.floor(Math.random() * 4096);
  const LDR_THRESHOLD = 2000; 

  // 1. LDR วัดแสงช่วงเวลา 10:50 น. (10:50 - 10:59 น.) เพื่อเตรียมให้ตัวที่ 3 ทำงานตอน 11:00 น.
  if (hours === 10 && minutes >= 50 && !checkedToday) {
    isSunnyMorning = (ldrValue >= LDR_THRESHOLD);
    checkedToday = true;
  }

  // รีเซ็ตสถานะการเช็กตอนเที่ยงคืน
  if (hours === 0 && minutes === 0) {
    checkedToday = false;
    isSunnyMorning = false;
  }

  // ถ้าเปิดโหมด Auto Schedule
  if (autoScheduleEnabled) {
    // กำหนดสถานะเริ่มต้นเป็นปิดทั้งหมดก่อน
    airState.air1 = false;
    airState.air2 = false;
    airState.air3 = false;

    // แปลงเวลาปัจจุบันเป็นนาทีตั้งแต่เที่ยงคืน เพื่อให้เปรียบเทียบช่วงเวลาได้แม่นยำ
    const totalMinutes = hours * 60 + minutes;

    // 08:00 - 08:30 น. -> Air 1 ทำงาน
    if (totalMinutes >= (8 * 60) && totalMinutes < (8 * 60 + 30)) {
      airState.air1 = true;
    }
    // 08:30 - 09:00 น. -> Air 2 ทำงาน
    else if (totalMinutes >= (8 * 60 + 30) && totalMinutes < (9 * 60)) {
      airState.air2 = true;
    }
    // 09:00 - 09:30 น. -> Air 1 ทำงาน
    else if (totalMinutes >= (9 * 60) && totalMinutes < (9 * 60 + 30)) {
      airState.air1 = true;
    }
    // 09:30 - 10:00 น. -> Air 2 ทำงาน
    else if (totalMinutes >= (9 * 60 + 30) && totalMinutes < (10 * 60)) {
      airState.air2 = true;
    }
    // 10:00 - 11:00 น. -> Air 1 ทำงาน (และช่วง 10:00 - 10:30 น. ให้ Air 2 ทำงานพร้อมกัน)
    else if (totalMinutes >= (10 * 60) && totalMinutes < (11 * 60)) {
      airState.air1 = true;
      if (totalMinutes < (10 * 60 + 30)) {
        airState.air2 = true; // ทำงานพร้อมกันช่วง 10:00 - 10:30 น.
      }
    }
    // 11:00 - 14:00 น. -> Air 3 ทำงาน (อิงจาก LDR ที่วัดตอน 10:50 น.)
    else if (totalMinutes >= (11 * 60) && totalMinutes < (14 * 60)) {
      if (isSunnyMorning) {
        airState.air3 = true; // ถ้าแดดถึงเกณฑ์ Air 3 ทำงาน
      } else {
        // ถ้าแดดไม่ถึงเกณฑ์ ให้ Air 1 และ Air 2 ทำงานปกติแทน (ยกเว้นช่วง 12:00-14:00 ที่ต้องหยุดพักตามโจทย์)
        if (totalMinutes < (12 * 60)) {
          airState.air1 = true;
          airState.air2 = true;
        }
      }
      
      // เงื่อนไขเพิ่มเติม: ระหว่างเวลา 12:00 - 14:00 น. ให้ Air 1 กับ Air 2 หยุดพัก (เป็น 0 เสมอ)
      if (totalMinutes >= (12 * 60)) {
        airState.air1 = false;
        airState.air2 = false;
      }
    }
    // 14:00 - 14:30 น. -> Air 1 ทำงาน (Air 3 หยุดพัก)
    else if (totalMinutes >= (14 * 60) && totalMinutes < (14 * 60 + 30)) {
      airState.air1 = true;
      airState.air3 = false;
    }
    // 14:30 - 15:00 น. -> Air 2 ทำงาน
    else if (totalMinutes >= (14 * 60 + 30) && totalMinutes < (15 * 60)) {
      airState.air2 = true;
      airState.air3 = false;
    }
    // หลัง 15:00 น. เป็นต้นไป -> หยุดทำงานทั้งหมด (เวลาเลิกงาน)
    else {
      airState.air1 = false;
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
  printMessage = `Server is running on http://localhost:${PORT}`;
});
