const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');

const router = express.Router();

// Middleware kiểm tra đăng nhập
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// GET: Hiển thị danh sách khóa học đã đăng ký
router.get('/courses', isAuthenticated, async (req, res) => {
  const db = getDB();
  const users = db.collection(User.collectionName);
  const courses = db.collection(Course.collectionName);

  try {
    // Lấy thông tin người dùng
    const user = await users.findOne({ _id: new ObjectId(req.session.user._id) });
    if (!user) {
      return res.status(404).send('Người dùng không tồn tại');
    }

    // Lấy danh sách khóa học đã đăng ký
    const registeredCourses = await courses
      .find({ _id: { $in: user.registeredCourses } })
      .toArray();

    res.render('user-courses', {
      user: req.session.user,
      courses: registeredCourses
    });
  } catch (err) {
    console.error('Error fetching registered courses:', err);
    res.status(500).send('Lỗi khi lấy danh sách khóa học đã đăng ký');
  }
});

// POST: Đăng ký khóa học (tích hợp với courses.js, cung cấp để đảm bảo hoàn chỉnh)
router.post('/register-course/:courseId', isAuthenticated, async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  const users = db.collection(User.collectionName);
  const courseId = new ObjectId(req.params.courseId);

  try {
    // Kiểm tra khóa học tồn tại
    const course = await courses.findOne({ _id: courseId });
    if (!course) {
      return res.status(404).send('Khóa học không tồn tại');
    }

    // Kiểm tra người dùng đã đăng ký khóa học chưa
    const user = await users.findOne({ _id: new ObjectId(req.session.user._id) });
    if (user.registeredCourses.some(id => id.equals(courseId))) {
      return res.status(400).send('Bạn đã đăng ký khóa học này');
    }

    // Cập nhật danh sách khóa học của người dùng
    await users.updateOne(
      { _id: new ObjectId(req.session.user._id) },
      { $addToSet: { registeredCourses: courseId } }
    );

    // Tăng số lượng người đăng ký trong khóa học
    await courses.updateOne(
      { _id: courseId },
      { $inc: { enrolledCount: 1 } }
    );

    res.redirect('/users/courses');
  } catch (err) {
    console.error('Error during course registration:', err);
    res.status(500).send('Lỗi khi đăng ký khóa học');
  }
});

module.exports = router;