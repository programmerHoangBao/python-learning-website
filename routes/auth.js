const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { getDB } = require('../config/db');
const User = require('../models/User');

const router = express.Router();

// Cấu hình nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Tạo mã OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Đăng ký
router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  const db = getDB();
  const users = db.collection(User.collectionName);

  // Kiểm tra email hợp lệ
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render('register', { error: 'Email không hợp lệ' });
  }

  // Kiểm tra username hoặc email đã tồn tại
  const existingUser = await users.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    return res.render('register', { error: 'Tên đăng nhập hoặc email đã tồn tại' });
  }

  // Tạo OTP và lưu vào session
  const otp = generateOTP();
  req.session.otp = otp;
  req.session.tempUser = { username, password: await bcrypt.hash(password, 10), email, role: 'user' };

  // Gửi OTP qua email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Mã OTP xác nhận đăng ký',
    text: `Mã OTP của bạn là: ${otp}. Hiệu lực trong 5 phút.`
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      return res.render('register', { error: 'Lỗi khi gửi email OTP' });
    }
    res.redirect('/auth/verify-otp');
  });
});

// Xác nhận OTP
router.get('/verify-otp', (req, res) => {
  res.render('verify-otp');
});

router.post('/verify-otp', async (req, res) => {
  const { otp } = req.body;
  const db = getDB();
  const users = db.collection(User.collectionName);

  if (otp === req.session.otp) {
    const { username, password, email, role } = req.session.tempUser;
    await users.insertOne({
      username,
      password,
      email,
      role,
      registeredCourses: [],
      createdAt: new Date()
    });
    delete req.session.otp;
    delete req.session.tempUser;
    res.redirect('/auth/login');
  } else {
    res.render('verify-otp', { error: 'Mã OTP không hợp lệ' });
  }
});

// Đăng nhập
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const users = db.collection(User.collectionName);

  const user = await users.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
  }

  req.session.user = user;
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;