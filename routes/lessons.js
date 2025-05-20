const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const Lesson = require("../models/Lesson");
const Comment = require("../models/Comment");
const Course = require("../models/Course");

const router = express.Router();

// Middleware kiểm tra đăng nhập
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Chỉ admin được phép thực hiện");
  }
  next();
}

// GET: Liệt kê bài học của khóa học
router.get("/:courseId", isAuthenticated, async (req, res) => {
  const db = getDB();
  const lessons = db.collection(Lesson.collectionName);
  const courses = db.collection(Course.collectionName);
  const courseId = new ObjectId(req.params.courseId);

  try {
    // Kiểm tra khóa học tồn tại
    const course = await courses.findOne({ _id: courseId });
    if (!course) {
      return res.status(404).send("Khóa học không tồn tại");
    }

    // Lấy danh sách bài học
    const lessonList = await lessons.find({ courseId }).toArray();
    res.render("course", {
      user: req.session.user,
      course,
      lessons: lessonList,
      quizzes: [], // Để tích hợp với trang chi tiết khóa học
    });
  } catch (err) {
    console.error("Error fetching lessons:", err);
    res.status(500).send("Lỗi khi lấy danh sách bài học");
  }
});

// GET: Form tạo bài học (admin)
router.get("/create/:courseId", isAdmin, async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  try {
    const course = await courses.findOne({
      _id: new ObjectId(req.params.courseId),
    });
    if (!course) {
      return res.status(404).send("Khóa học không tồn tại");
    }
    res.render("admin", {
      user: req.session.user,
      action: "create-lesson",
      course,
    });
  } catch (err) {
    console.error("Error fetching course information:", err);
    res.status(500).send("Lỗi khi lấy thông tin khóa học");
  }
});

// POST: Tạo bài học mới (admin) - root lesson
router.post("/", isAdmin, async (req, res) => {
  // get data from Client
  const { courseId, name, documentLink, videoLink } = req.body;
  const db = getDB();
  const lessons = db.collection(Lesson.collectionName);
  const courses = db.collection(Course.collectionName);

  try {
    // Kiểm tra khóa học tồn tại
    const course = await courses.findOne({ _id: new ObjectId(courseId) });
    if (!course) {
      return res.status(404).render("admin", {
        user: req.session.user,
        action: "create-lesson",
        error: "Khóa học không tồn tại",
      });
    }

    // Tạo bài học mới
    await lessons.insertOne({
      courseId: new ObjectId(courseId),
      name,
      documentLink,
      videoLink,
      createdAt: new Date(),
    });

    res.redirect(`/courses/${courseId}`);
  } catch (err) {
    console.error("Error creating lesson:", err);
    res.status(500).render("admin", {
      user: req.session.user,
      action: "create-lesson",
      error: "Lỗi khi tạo bài học",
    });
  }
});

// GET: Form chỉnh sửa bài học (admin)
router.get("/edit/:id", isAdmin, async (req, res) => {
  const db = getDB();
  const lessons = db.collection(Lesson.collectionName);
  try {
    const lesson = await lessons.findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).send("Bài học không tồn tại");
    }
    res.render("admin", {
      user: req.session.user,
      action: "edit-lesson",
      lesson,
    });
  } catch (err) {
    console.error("Error fetching lesson for edit:", err);
    res.status(500).send("Lỗi khi lấy thông tin bài học");
  }
});

// POST: Cập nhật bài học (admin)
router.post("/edit/:id", isAdmin, async (req, res) => {
  const { name, documentLink, videoLink } = req.body;
  const db = getDB();
  const lessons = db.collection(Lesson.collectionName);

  try {
    const lesson = await lessons.findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).send("Bài học không tồn tại");
    }
    await lessons.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { name, documentLink, videoLink } }
    );
    res.redirect(`/courses/${lesson.courseId}`);
  } catch (err) {
    console.error("Error updating lesson:", err);
    res.status(500).render("admin", {
      user: req.session.user,
      action: "edit-lesson",
      error: "Lỗi khi cập nhật bài học",
    });
  }
});

// POST: Xóa bài học (admin)
router.post("/delete/:id", isAdmin, async (req, res) => {
  const db = getDB();
  const lessons = db.collection(Lesson.collectionName);
  const comments = db.collection(Comment.collectionName);

  try {
    const lesson = await lessons.findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).send("Bài học không tồn tại");
    }

    // Xóa bài học
    await lessons.deleteOne({ _id: new ObjectId(req.params.id) });
    // Xóa bình luận liên quan
    await comments.deleteMany({ lessonId: new ObjectId(req.params.id) });
    res.redirect(`/courses/${lesson.courseId}`);
  } catch (err) {
    console.error("Error deleting lesson:", err);
    res.status(500).send("Lỗi khi xóa bài học");
  }
});

// GET: Xem chi tiết bài học
router.get("/view/:id", isAuthenticated, async (req, res) => {
  const db = getDB();
  const lessons = db.collection(Lesson.collectionName);
  const comments = db.collection(Comment.collectionName);
  const users = db.collection("users");

  try {
    const lesson = await lessons.findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).send("Bài học không tồn tại");
    }

    // Lấy danh sách bình luận và thông tin người dùng
    const commentList = await comments
      .aggregate([
        { $match: { lessonId: new ObjectId(req.params.id) } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $project: { content: 1, createdAt: 1, "user.username": 1 } },
      ])
      .toArray();

    res.render("lesson", {
      user: req.session.user,
      lesson,
      comments: commentList,
    });
  } catch (err) {
    console.error("Error fetching lesson details:", err);
    res.status(500).send("Lỗi khi lấy chi tiết bài học");
  }
});

// POST: Thêm bình luận cho bài học
router.post("/:id/comments", isAuthenticated, async (req, res) => {
  const { content } = req.body;
  const db = getDB();
  const comments = db.collection(Comment.collectionName);
  const lessons = db.collection(Lesson.collectionName);

  try {
    const lesson = await lessons.findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).send("Bài học không tồn tại");
    }

    await comments.insertOne({
      lessonId: new ObjectId(req.params.id),
      userId: new ObjectId(req.session.user._id),
      content,
      createdAt: new Date(),
    });
    res.redirect(`/lessons/view/${req.params.id}`);
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).send("Lỗi khi thêm bình luận");
  }
});

module.exports = router;
