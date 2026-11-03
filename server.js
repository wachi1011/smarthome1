const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// เก็บค่า LDR ก่อน 11 โมง เพื่อใช้ตัดสินใจ
let morningLdrRecorded = false;
let isSunnyMorning = false; 

// สถานะรีเลย์ 3 ตัว (Pin 32, 33, 25 ตามลำดับ)
let relayState = {
  relay1: false, // Pin 32
  relay2: false, // Pin 33
  relay3: false  // Pin 25 (ตัวที่ 3 ควบคุมด้วย LDR)
};

// ฟังก์ชันจำลองเวลาและเงื่อนไขตามโจทย์
function updateRelaySchedule() {
  const now = new Date();
  // สมมติเวลาปัจจุบัน (สามารถเปลี่ยนมาใช้เวลาจริงจากบอร์ด Hardware ได้)
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTimeDecimal = hours + minutes / 60;

  // จำลองค่าแสง LDR (0 - 4095)
  const ldrValue = Math.floor(Math.random() * 4096); 

  // 1. ตรวจสอบค่า LDR ก่อน 11:00 น. (เช่น ช่วง 10:00 - 11:00 น.)
  if (hours === 10 && !morningLdrRecorded) {
    if (ldrValue > 2000) { // สมมติค่า > 2000 คือแดดเยอะ
      isSunnyMorning = true;
    } else {
      isSunnyMorning = false;
    }
    morningLdrRecorded = true;
  }

  // รีเซ็ตค่าบันทึกตอนเที่ยงคืน เพื่อให้วัดใหม่ในวันถัดไป
  if (hours === 0) {
    morningLdrRecorded = false;
  }

  // 2. ควบคุมรีเลย์ตัวที่ 3 (ช่วง 11:00 - 14:00 น.)
  if (currentTimeDecimal >= 11.0 && currentTimeDecimal < 14.0) {
    if (isSunnyMorning) {
      // ถ้าแดดดีก่อน 11 โมง ให้รีเลย์ตัวที่ 3 ทำงานในช่วงนี้
      relayState.relay3 = true;
      relayState.relay1 = false;
      relayState.relay2 = false;
    } else {
      // ถ้าแดดไม่เยอะ ให้รีเลย์ 1 และ 2 ทำงานปกติตามตาราง
      relayState.relay3 = false;
      // ตัวอย่างการสลับการทำงาน 1 และ 2 ตามช่วงเวลา
      relayState.relay1 = Math.floor(currentTimeDecimal) % 2 === 0;
      relayState.relay2 = !relayState.relay1;
    }
  } else {
    // นอกช่วง 11:00 - 14:00 น. ให้รีเลย์ตัวที่ 3 ปิด และ 1, 2 สลับทำงานตามตารางปกติ
    relayState.relay3 = false;
    relayState.relay1 = Math.floor(currentTimeDecimal * 2) % 2 === 0;
    relayState.relay2 = !relayState.relay1;
  }

  return ldrValue;
}

app.get('/api/status', (req, res) => {
  const ldrValue = updateRelaySchedule();
  res.json({
    ldrValue,
    isSunnyMorning,
    relayState
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
