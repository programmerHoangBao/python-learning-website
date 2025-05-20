const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db"); // Đường dẫn tới file db.js

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Chỉ admin được phép thực hiện");
  }
  next();
}

// Route dashboard
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const db = await getDB();

    // Pipeline 1: Số bài học theo khóa học
    const lessonStats = await db
      .collection("lessons")
      .aggregate([
        { $group: { _id: "$courseId", totalLessons: { $sum: 1 } } },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: "$course" },
        { $project: { courseName: "$course.name", totalLessons: 1 } },
        { $sort: { totalLessons: -1 } },
      ])
      .toArray();

    // Pipeline 2: Thống kê bài kiểm tra
    const quizStats = await db
      .collection("quizResults")
      .aggregate([
        {
          $group: {
            _id: "$quizId",
            avgScore: { $avg: "$score" },
            totalAttempts: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "quizzes",
            localField: "_id",
            foreignField: "_id",
            as: "quiz",
          },
        },
        { $unwind: "$quiz" },
        {
          $project: {
            quizName: "$quiz.name",
            avgScore: { $round: ["$avgScore", 2] },
            totalAttempts: 1,
          },
        },
        { $sort: { avgScore: -1 } },
      ])
      .toArray();

    // Pipeline 3: Top 5 học viên xuất sắc
    const userStats = await db
      .collection("quizResults")
      .aggregate([
        {
          $group: {
            _id: "$userId",
            totalScore: { $sum: "$score" },
            totalAttempts: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            username: "$user.username",
            totalScore: 1,
            totalAttempts: 1,
            avgScore: {
              $round: [{ $divide: ["$totalScore", "$totalAttempts"] }, 2],
            },
          },
        },
        { $sort: { totalScore: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    res.render("dashboard", {
      lessonStats,
      quizStats,
      userStats,
      user: req.user,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).send("Lỗi khi tải dashboard");
  }
});

module.exports = router;
