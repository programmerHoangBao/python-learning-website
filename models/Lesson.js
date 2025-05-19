const { ObjectId } = require("mongodb");

const Lesson = {
  collectionName: "lessons",
  schema: {
    courseId: { type: ObjectId, ref: "courses" },
    name: String,
    documentLink: String,
    videoLink: String,
    createdAt: Date,
  },
};

module.exports = Lesson;
