const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// บันทึกสถานะว่าแสงพอดี ณ เวลา 10:50 น. หรือไม่
let isSunnyMorning = false;
let checkedToday = false; 

// สถานะรีเลย์ 3 ตัว (Pin 32, 33, 25 ตามลำดับ)
let relayState = {
  relay1: false, // Pin 32 (ทำงานพร้อม Pin 33)
  relay2: false, // Pin 33 (ทำงานพร้อม Pin 32)
  relay3: false  // Pin 25 (ควบคุมด้วย LDR)
};

function updateRelaySchedule() {
  // ดึงเวลาปัจจุบันอิงตามเขตเวลาประเทศไทย (Asia/Bangkok)
  const now = new Date();
  const thaiTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const thaiDate = new Date(thaiTimeString);

  const hours = thaiDate.getHours();
  const minutes = thaiDate.getMinutes();
  const currentTimeDecimal = hours + minutes / 60;

  // จำลองค่าแสง LDR (0 - 4095)
  const ldrValue = Math.floor(Math.random() * 4096);
  const LDR_THRESHOLD = 2000; // ค่าความเข้มแสงที่ถือว่าเพียงพอ (ปรับได้ตามหน้างานจริง)

  // 1. อ่านค่าแสง ณ เวลา 10:50 น. พอดี (ช่วง 10:50 - 10:59 น.)
  if (hours === 10 && minutes >= 50 && !checkedToday) {
    if (ldrValue >= LDR_THRESHOLD) {
      isSunnyMorning = true;
    } else {
      isSunnyMorning = false;
    }
    checkedToday = true; // บันทึกว่าเช็กแล้ววันนี้
  }

  // รีเซ็ตการเช็กเมื่อเริ่มต้นวันใหม่ (เที่ยงคืน)
  if (hours === 0 && minutes === 0) {
    checkedToday = false;
    isSunnyMorning = false;
  }

  // 2. เงื่อนไขการทำงานช่วง 11:00 - 14:00 น.
  if (currentTimeDecimal >= 11.0 && currentTimeDecimal < 14.0) {
    if (isSunnyMorning) {
      // แสงพอตอน 10:50 น. -> ตัวที่ 3 ทำงาน / ตัวที่ 1 และ 2 ปิด
      relayState.relay3 = true;
      relayState.relay1 = false;
      relayState.relay2 = false;
    } else {
      // แสงไม่พอ -> ตัวที่ 3 ปิด / ตัวที่ 1 และ 2 ทำงานพร้อมกันปกติ
      relayState.relay3 = false;
      relayState.relay1 = true;
      relayState.relay2 = true;
    }
  } else {
    // นอกช่วง 11:00 - 14:00 น. -> ตัวที่ 3 ปิด / ตัวที่ 1 และ 2 ทำงานพร้อมกันตามตารางปกติ
    relayState.relay3 = false;
    
    // ตัวอย่าง: เปิดทำงานพร้อมกันทุกๆ ครึ่งชั่วโมง สลับ ปิด (หรือปรับตามตารางเวลาจริงได้)
    const isWorkingPeriod = Math.floor(currentTimeDecimal * 2) % 2 === 0;
    relayState.relay1 = isWorkingPeriod;
    relayState.relay2 = isWorkingPeriod;
  }

  return { ldrValue, thaiTimeFormatted: thaiDate.toLocaleTimeString('th-TH') };
}

app.get('/api/status', (req, res) => {
  const { ldrValue, thaiTimeFormatted } = updateRelaySchedule();
  res.json({
    ldrValue,
    thaiTimeFormatted,
    isSunnyMorning,
    checkedToday,
    relayState
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
