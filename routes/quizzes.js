const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const Course = require('../models/Course');

const router = express.Router();

// Middleware kiểm tra đăng nhập
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Chỉ admin được phép thực hiện');
  }
  next();
}

// GET: Liệt kê bài kiểm tra của khóa học
router.get('/:courseId', isAuthenticated, async (req, res) => {
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  const courses = db.collection(Course.collectionName);
  const courseId = new ObjectId(req.params.courseId);

  try {
    // Kiểm tra khóa học tồn tại
    const course = await courses.findOne({ _id: courseId });
    if (!course) {
      return res.status(404).send('Khóa học không tồn tại');
    }

    // Lấy danh sách bài kiểm tra
    const quizList = await quizzes.find({ courseId }).toArray();
    res.render('course', {
      user: req.session.user,
      course,
      lessons: [], // Để tích hợp với trang chi tiết khóa học
      quizzes: quizList
    });
  } catch (err) {
    console.error('Error fetching quiz list:', err);
    res.status(500).send('Lỗi khi lấy danh sách bài kiểm tra');
  }
});

// GET: Form tạo bài kiểm tra (admin)
router.get('/create/:courseId', isAdmin, async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  try {
    const course = await courses.findOne({ _id: new ObjectId(req.params.courseId) });
    if (!course) {
      return res.status(404).send('Khóa học không tồn tại');
    }
    res.render('admin', {
      user: req.session.user,
      action: 'create-quiz',
      course
    });
  } catch (err) {
    console.error('Error fetching course information:', err);
    res.status(500).send('Lỗi khi lấy thông tin khóa học');
  }
});

// POST: Tạo bài kiểm tra mới (admin)
router.post('/', isAdmin, async (req, res) => {
  const { courseId, name, questions } = req.body;
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  const courses = db.collection(Course.collectionName);

  try {
    // Kiểm tra khóa học tồn tại
    const course = await courses.findOne({ _id: new ObjectId(courseId) });
    if (!course) {
      return res.status(404).render('admin', {
        user: req.session.user,
        action: 'create-quiz',
        error: 'Khóa học không tồn tại'
      });
    }

    // Chuyển đổi questions từ JSON (nếu gửi qua form)
    const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;

    // Tạo bài kiểm tra mới
    await quizzes.insertOne({
      courseId: new ObjectId(courseId),
      name,
      questions: parsedQuestions.map(q => ({
        questionText: q.questionText,
        options: q.options,
        correctOption: parseInt(q.correctOption)
      })),
      createdAt: new Date()
    });
    res.redirect(`/courses/${courseId}`);
  } catch (err) {
    console.error('Error creating quiz:', err);
    res.status(500).render('admin', {
      user: req.session.user,
      action: 'create-quiz',
      error: 'Lỗi khi tạo bài kiểm tra'
    });
  }
});

// GET: Form chỉnh sửa bài kiểm tra (admin)
router.get('/edit/:id', isAdmin, async (req, res) => {
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  try {
    const quiz = await quizzes.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) {
      return res.status(404).send('Bài kiểm tra không tồn tại');
    }
    res.render('admin', {
      user: req.session.user,
      action: 'edit-quiz',
      quiz
    });
  } catch (err) {
    console.error('Error fetching quiz for edit:', err);
    res.status(500).send('Lỗi khi lấy thông tin bài kiểm tra');
  }
});

// POST: Cập nhật bài kiểm tra (admin)
router.post('/edit/:id', isAdmin, async (req, res) => {
  const { name, questions } = req.body;
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);

  try {
    const quiz = await quizzes.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) {
      return res.status(404).send('Bài kiểm tra không tồn tại');
    }

    // Chuyển đổi questions từ JSON (nếu gửi qua form)
    const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;

    await quizzes.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          name,
          questions: parsedQuestions.map(q => ({
            questionText: q.questionText,
            options: q.options,
            correctOption: parseInt(q.correctOption)
          }))
        }
      }
    );
    res.redirect(`/courses/${quiz.courseId}`);
  } catch (err) {
    console.error('Error updating quiz:', err);
    res.status(500).render('admin', {
      user: req.session.user,
      action: 'edit-quiz',
      error: 'Lỗi khi cập nhật bài kiểm tra'
    });
  }
});

// POST: Xóa bài kiểm tra (admin)
router.post('/delete/:id', isAdmin, async (req, res) => {
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  const quizResults = db.collection(QuizResult.collectionName);

  try {
    const quiz = await quizzes.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) {
      return res.status(404).send('Bài kiểm tra không tồn tại');
    }
    // Xóa bài kiểm tra
    await quizzes.deleteOne({ _id: new ObjectId(req.params.id) });
    // Xóa kết quả liên quan
    await quizResults.deleteMany({ quizId: new ObjectId(req.params.id) });
    res.redirect(`/courses/${quiz.courseId}`);
  } catch (err) {
    console.error('Error deleting quiz:', err);
    res.status(500).send('Lỗi khi xóa bài kiểm tra');
  }
});

// GET: Hiển thị bài kiểm tra để làm bài
router.get('/view/:id', isAuthenticated, async (req, res) => {
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  const users = db.collection('users');

  try {
    const quiz = await quizzes.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) {
      return res.status(404).send('Bài kiểm tra không tồn tại');
    }

    const user = await users.findOne({ _id: new ObjectId(req.session.user._id) });
    if (!user || !user.registeredCourses) {
      return res.status(403).send('Bạn cần đăng ký khóa học để làm bài kiểm tra');
    }

    // So sánh ObjectId dưới dạng string
    const registeredCourseIds = user.registeredCourses.map(id => id.toString());
    if (!registeredCourseIds.includes(quiz.courseId.toString())) {
      return res.status(403).send('Bạn cần đăng ký khóa học để làm bài kiểm tra');
    }

    res.render('quiz', {
      user: req.session.user,
      quiz
    });
  } catch (err) {
    console.error('Error fetching quiz:', err);
    res.status(500).send('Lỗi khi lấy bài kiểm tra');
  }
});

// POST: Nộp bài kiểm tra
router.post('/:id/submit', isAuthenticated, async (req, res) => {
  const { answers } = req.body; // answers là mảng các lựa chọn (0-3)
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  const quizResults = db.collection(QuizResult.collectionName);

  try {
    const quiz = await quizzes.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) {
      return res.status(404).send('Bài kiểm tra không tồn tại');
    }

    // Tính điểm
    let score = 0;
    const parsedAnswers = answers.map(a => parseInt(a));
    quiz.questions.forEach((q, index) => {
      if (parsedAnswers[index] === q.correctOption) {
        score += 1;
      }
    });

    // Lưu kết quả
    await quizResults.insertOne({
      userId: new ObjectId(req.session.user._id),
      quizId: new ObjectId(req.params.id),
      answers: parsedAnswers,
      score,
      createdAt: new Date()
    });

    res.redirect(`/quizzes/results/${req.params.id}`);
  } catch (err) {
    console.error('Error submitting quiz:', err);
    res.status(500).send('Lỗi khi nộp bài kiểm tra');
  }
});

// GET: Xem kết quả bài kiểm tra
router.get('/results/:id', isAuthenticated, async (req, res) => {
  const db = getDB();
  const quizzes = db.collection(Quiz.collectionName);
  const quizResults = db.collection(QuizResult.collectionName);

  try {
    const quiz = await quizzes.findOne({ _id: new ObjectId(req.params.id) });
    if (!quiz) {
      return res.status(404).send('Bài kiểm tra không tồn tại');
    }

    // Lấy kết quả mới nhất của người dùng
    const result = await quizResults.findOne(
      {
        quizId: new ObjectId(req.params.id),
        userId: new ObjectId(req.session.user._id)
      },
      { sort: { createdAt: -1 } }
    );

    if (!result) {
      return res.status(404).send('Bạn chưa làm bài kiểm tra này');
    }

    res.render('quiz-result', {
      user: req.session.user,
      quiz,
      result
    });
  } catch (err) {
    console.error('Error fetching quiz result:', err);
    res.status(500).send('Lỗi khi lấy kết quả bài kiểm tra');
  }
});

module.exports = router;