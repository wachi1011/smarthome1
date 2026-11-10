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
      // 08.30 -
