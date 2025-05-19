const { ObjectId } = require("mongodb");

const Quiz = {
  collectionName: "quizzes",
  schema: {
    courseId: { type: ObjectId, ref: "courses" },
    name: String,
    questions: [
      {
        questionText: String,
        options: [String], // 4 lựa chọn
        correctOption: Number, // Chỉ số của đáp án đúng (0-3)
      },
    ],
    createdAt: Date,
  },
};

module.exports = Quiz;
