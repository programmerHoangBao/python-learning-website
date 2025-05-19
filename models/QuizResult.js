const { ObjectId } = require("mongodb");

const QuizResult = {
  collectionName: "quizResults",
  schema: {
    userId: { type: ObjectId, ref: "users" },
    quizId: { type: ObjectId, ref: "quizzes" },
    answers: [Number], // Mảng đáp án người dùng chọn
    score: Number, // Điểm số
    createdAt: Date,
  },
};

module.exports = QuizResult;
