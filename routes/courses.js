const express = require("express");
const multer = require("multer");
const path = require("path");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const Course = require("../models/Course");
const User = require("../models/User");

const router = express.Router();

// Cấu hình multer để upload logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Chỉ chấp nhận file JPEG hoặc PNG"));
  },
});

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Chỉ admin được phép thực hiện");
  }
  next();
}

// GET: Hiển thị danh sách khóa học
router.get("/", async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  try {
    const courseList = await courses.find({}).toArray();
    res.render("home", {
      user: req.session.user,
      courses: courseList,
    });
  } catch (err) {
    console.error("Error fetching course list:", err);
    res.status(500).send("Lỗi khi lấy danh sách khóa học");
  }
});

// GET: Form tạo khóa học (admin)
router.get("/create", isAdmin, (req, res) => {
  res.render("admin", {
    user: req.session.user,
    action: "create-course",
  });
});

// GET: Tìm kiếm khóa học theo tên
router.get("/search", async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  const users = db.collection(User.collectionName);
  const query = req.query.query;

  try {
    if (!query) {
      return res.render("home", {
        user: req.session.user,
        courses: [],
        error: "Vui lòng nhập từ khóa tìm kiếm",
      });
    }

    const courseList = await courses
      .find({ $text: { $search: query } })
      .toArray();
    let user = req.session.user || null;

    // Nếu người dùng đã đăng nhập, lấy thông tin đầy đủ từ collection users
    if (user) {
      user = await users.findOne({ _id: new ObjectId(user._id) });
    }

    res.render("home", {
      user: user,
      courses: courseList,
      searchQuery: query,
    });
  } catch (err) {
    console.error("Error searching courses:", err);
    res.status(500).render("home", {
      user: req.session.user,
      courses: [],
      error: "Lỗi khi tìm kiếm khóa học",
    });
  }
});


// POST: Tạo khóa học mới (admin)
router.post("/", isAdmin, upload.single("logo"), async (req, res) => {
  const { name, startDate, duration } = req.body;
  const logo = req.file ? `/images/${req.file.filename}` : "";
  const db = getDB();
  const courses = db.collection(Course.collectionName);

  try {
    await courses.insertOne({
      name,
      startDate: new Date(startDate),
      duration: parseInt(duration),
      enrolledCount: 0,
      users: [],
      logo,
      createdAt: new Date(),
    });
    res.redirect("/courses");
  } catch (err) {
    console.error("Error creating course:", err);
    res.status(500).render("admin", {
      user: req.session.user,
      action: "create-course",
      error: "Lỗi khi tạo khóa học",
    });
  }
});

// GET: Form chỉnh sửa khóa học (admin)
router.get("/edit/:id", isAdmin, async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  try {
    const course = await courses.findOne({ _id: new ObjectId(req.params.id) });
    if (!course) {
      return res.status(404).send("Khóa học không tồn tại");
    }
    res.render("admin", {
      user: req.session.user,
      action: "edit-course",
      course,
    });
  } catch (err) {
    console.error("Error fetching course info:", err);
    res.status(500).send("Lỗi khi lấy thông tin khóa học");
  }
});

// PUT: Cập nhật khóa học (admin)
router.post("/edit/:id", isAdmin, upload.single("logo"), async (req, res) => {
  const { name, startDate, duration } = req.body;
  const db = getDB();
  const courses = db.collection(Course.collectionName);

  try {
    const updateData = {
      name,
      startDate: new Date(startDate),
      duration: parseInt(duration),
    };
    if (req.file) {
      updateData.logo = `/images/${req.file.filename}`;
    }
    await courses.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );
    res.redirect("/courses");
  } catch (err) {
    console.error("Error updating course:", err);
    res.status(500).render("admin", {
      user: req.session.user,
      action: "edit-course",
      error: "Lỗi khi cập nhật khóa học",
    });
  }
});

// DELETE: Xóa khóa học (admin)
router.post("/delete/:id", isAdmin, async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  const lessons = db.collection("lessons");
  const quizzes = db.collection("quizzes");

  try {
    const courseId = new ObjectId(req.params.id);
    // Xóa khóa học
    await courses.deleteOne({ _id: courseId });
    // Xóa bài học liên quan
    await lessons.deleteMany({ courseId });
    // Xóa bài kiểm tra liên quan
    await quizzes.deleteMany({ courseId });
    res.redirect("/courses");
  } catch (err) {
    console.error("Error deleting course:", err);
    res.status(500).send("Lỗi khi xóa khóa học");
  }
});

// GET: Hiển thị chi tiết khóa học
router.get("/:id", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  const lessons = db.collection("lessons");
  const quizzes = db.collection("quizzes");

  try {
    const course = await courses.findOne({ _id: new ObjectId(req.params.id) });
    if (!course) {
      return res.status(404).send("Khóa học không tồn tại");
    }
    const lessonList = await lessons
      .find({ courseId: new ObjectId(req.params.id) })
      .toArray();
    const quizList = await quizzes
      .find({ courseId: new ObjectId(req.params.id) })
      .toArray();
    res.render("course", {
      user: req.session.user,
      course,
      lessons: lessonList,
      quizzes: quizList,
    });
  } catch (err) {
    console.error("Error fetching course details:", err);
    res.status(500).send("Lỗi khi lấy chi tiết khóa học");
  }
});

// POST: Người dùng đăng ký khóa học
router.post("/register/:id", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }

  const db = getDB();
  const courses = db.collection(Course.collectionName);
  const users = db.collection(User.collectionName);
  const courseId = new ObjectId(req.params.id);
  const userId = new ObjectId(req.session.user._id);

  try {
    // Kiểm tra khóa học tồn tại
    const course = await courses.findOne({ _id: courseId });
    if (!course) {
      return res.status(404).send("Khóa học không tồn tại");
    }

    // Cập nhật danh sách khóa học đã đăng ký của người dùng (tránh trùng)
    await users.updateOne(
      { _id: userId },
      { $addToSet: { registeredCourses: courseId } }
    );

    // Thêm userId vào trường users của khóa học, nếu chưa có
    await courses.updateOne(
      { _id: courseId },
      { $addToSet: { users: userId } }
    );

    // Lấy lại khóa học để cập nhật enrolledCount dựa vào độ dài mảng users
    const updatedCourse = await courses.findOne({ _id: courseId });

    // Cập nhật enrolledCount chính xác
    await courses.updateOne(
      { _id: courseId },
      { $set: { enrolledCount: updatedCourse.users.length } }
    );

    res.redirect(`/courses/${req.params.id}`);
  } catch (err) {
    console.error("Error during course registration:", err);
    res.status(500).send("Lỗi khi đăng ký khóa học");
  }
});

module.exports = router;
