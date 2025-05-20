const express = require("express");
const session = require("express-session");
const path = require("path");
const { connectDB, getDB } = require("./config/db");
const Course = require("./models/Course");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courses");
const lessonRoutes = require("./routes/lessons");
const quizRoutes = require("./routes/quizzes");
const userRoutes = require("./routes/users");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/auth", authRoutes);
app.use("/courses", courseRoutes);
app.use("/lessons", lessonRoutes);
app.use("/quizzes", quizRoutes);
app.use("/users", userRoutes);

// Trang chủ
app.get("/", async (req, res) => {
  const db = getDB();
  const courses = db.collection(Course.collectionName);
  const users = db.collection(User.collectionName);

  try {
    const courseList = await courses.find({}).toArray();
    let user = req.session.user || null;

    // Nếu người dùng đã đăng nhập, lấy thông tin đầy đủ từ collection users
    if (user) {
      user = await users.findOne({ _id: new require("mongodb").ObjectId(user._id) });
    }

    res.render("home", {
      user: user,
      courses: courseList,
    });
  } catch (err) {
    console.error("Error fetching course list:", err);
    res.status(500).send("Lỗi khi lấy danh sách khóa học");
  }
});

// Khởi động server
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
