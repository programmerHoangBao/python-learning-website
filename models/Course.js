const { ObjectId } = require("mongodb");

const Course = {
  collectionName: "courses",
  schema: {
    name: String,
    startDate: Date,
    duration: Number, // Số tháng
    enrolledCount: Number,
    users: [{ type: ObjectId, ref: "users" }],
    logo: String, // Đường dẫn đến file logo
    createdAt: Date,
  },
};

module.exports = Course;
