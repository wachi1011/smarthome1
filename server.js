const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let autoScheduleEnabled = true; 
let isSolarSufficient = false; // สถานะกระแส Solar Cell > 15A
let checkedToday = false; 

let airState = {
  air1: false, // Pin 32 (2kW 25,000 BTU)
  air2: false, // Pin 33 (2kW 25,000 BTU)
  air3: false  // Pin 25 (4.5kW 53,000 BTU - 3 เฟส)
};

function updateSchedule() {
  // 1. ดึงเวลาประเทศไทยจริง (Asia/Bangkok / UTC+7)
  const now = new Date();
  const thaiTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const thaiDate = new Date(thaiTimeString);

  const hours = thaiDate.getHours();
  const minutes = thaiDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes; // แปลงเวลาทั้งหมดเป็นนาทีเพื่อเช็กช่วงเวลาง่ายขึ้น

  // จำลองค่ากระแสจาก Solar Cell (หน่วยเป็น Ampere: 0 - 30A)
  const solarCurrent = parseFloat((Math.random() * 25).toFixed(1)); 
  const SOLAR_CURRENT_THRESHOLD = 15.0; // เกณฑ์กระแส > 15A

  // 2. ตรวจสอบกระแส Solar Cell ก่อน 11:30 น. (วัดช่วง 11:00 - 11:29 น.)
  if (timeInMinutes >= (11 * 60) && timeInMinutes < (11 * 60 + 30) && !checkedToday) {
    isSolarSufficient = (solarCurrent >= SOLAR_CURRENT_THRESHOLD);
    checkedToday = true;
  }

  // รีเซ็ตการบันทึกสถานะเมื่อเริ่มต้นวันใหม่ (เที่ยงคืน)
  if (hours === 0 && minutes === 0) {
    checkedToday = false;
    isSolarSufficient = false;
  }

  // 3. กำหนดตารางการทำงานของแอร์ตามเวลาไทยจริง (เวลาเริ่ม 08:00 ถึง 16:00 น.)
  if (autoScheduleEnabled) {
    // รีเซ็ตสถานะเป็นปิดทั้งหมดก่อนเช็กช่วงเวลา
    let a1 = false;
    let a2 = false;
    let a3 = false;

    // --- ช่วงเช้า ---
    if (timeInMinutes >= 8 * 60 && timeInMinutes < 8 * 60 + 30) {
      // 08.00 - 08.30 น. : Air 1 ทำงาน
      a1 = true;
    } 
    else if (timeInMinutes >= 8 * 60 + 30 && timeInMinutes < 9 * 60) {
      // 08.30 - 09.00 น. : Air 2 ทำงาน
      a2 = true;
    } 
    else if (timeInMinutes >= 9 * 60 && timeInMinutes < 9 * 60 + 30) {
      // 09.00 - 09.30 น. : Air 1 ทำงาน
      a1 = true;
    } 
    else if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 10 * 60) {
      // 09.30 - 10.00 น. : Air 2 ทำงาน
      a2 = true;
    } 
    else if (timeInMinutes >= 10 * 60 && timeInMinutes < 10 * 60 + 30) {
      // 10.00 - 10.30 น. : Air 1 ทำงาน
      a1 = true;
    } 
    else if (timeInMinutes >= 10 * 60 + 30 && timeInMinutes < 11 * 60) {
      // 10.30 - 11.00 น. : Air 2 ทำงาน
      a2 = true;
    } 
    else if (timeInMinutes >= 11 * 60 && timeInMinutes < 11 * 60 + 30) {
      // 11.00 - 11.30 น. : Air 1 และ Air 2 ทำงานควบคู่กัน (ช่วงสลับจาก 10.30-11.30)
      a1 = true;
      a2 = true;
    } 

    // --- ช่วงกลางวัน & บ่าย ---
    else if (timeInMinutes >= 11 * 60 + 30 && timeInMinutes < 12 * 60) {
      // 11.30 - 12.00 น. : Air 3 ทำงาน (ถ้ากระแส > 15A)
      if (isSolarSufficient) a3 = true;
    } 
    else if (timeInMinutes >= 12 * 60 && timeInMinutes < 14 * 60) {
      // 12.00 - 14.00 น. : Air 2 ทำงานควบคู่กับ Air 3 (ถ้ากระแส > 15A)
      a2 = true;
      if (isSolarSufficient) a3 = true;
    } 
    else if (timeInMinutes >= 14 * 60 && timeInMinutes < 14 * 60 + 30) {
      // 14.00 - 14.30 น. : สลับ Air 1 มาแทน Air 3 + Air 2 ยังคงทำงานอยู่ (Air 1 & Air 2)
      a1 = true;
      a2 = true;
    } 
    else if (timeInMinutes >= 14 * 60 + 30 && timeInMinutes < 15 * 60) {
      // 14.30 - 15.00 น. : Air 3 กลับมาทำงาน (ถ้ากระแส > 15A)
      if (isSolarSufficient) a3 = true;
    } 
    else if (timeInMinutes >= 15 * 60 && timeInMinutes < 15 * 60 + 30) {
      // 15.00 - 15.30 น. : Air 2 ทำงานควบคู่กับ Air 3
      a2 = true;
      if (isSolarSufficient) a3 = true;
    } 
    else if (timeInMinutes >= 15 * 60 + 30 && timeInMinutes < 16 * 60) {
      // 15.30 - 16.00 น. : สลับ Air 1 ทำงานส่งท้ายก่อนเลิกงาน
      a1 = true;
    }
    // ตั้งแต่ 16.00 น. เป็นต้นไป : หยุดพักระบบ (a1, a2, a3 เป็น false ทั้งหมด)

    airState.air1 = a1;
    airState.air2 = a2;
    airState.air3 = a3;
  }

  return { solarCurrent, thaiTimeFormatted: thaiDate.toLocaleTimeString('th-TH') };
}

// API ดึงสถานะระบบ
app.get('/api/status', (req, res) => {
  const { solarCurrent, thaiTimeFormatted } = updateSchedule();
  res.json({
    solarCurrent,
    thaiTimeFormatted,
    autoScheduleEnabled,
    isSolarSufficient,
    checkedToday,
    airState
  });
});

// API เปิด-ปิดโหมด Auto
app.post('/api/toggle-auto', (req, res) => {
  autoScheduleEnabled = req.body.auto;
  res.json({ success: true, autoScheduleEnabled });
});

// API ควบคุมแบบ Manual
app.post('/api/control', (req, res) => {
  const { air, state } = req.body;
  if (!autoScheduleEnabled && airState.hasOwnProperty(air)) {
    airState[air] = state;
    res.json({ success: true, airState });
  } else {
    res.status(400).json({ success: false, message: 'Auto mode is enabled' });
  }
});

// API ควบคุมทั้งหมด
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
