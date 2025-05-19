const { ObjectId } = require('mongodb');

const User = {
  collectionName: 'users',
  schema: {
    username: String,
    password: String, // Mật khẩu đã mã hóa
    email: String,
    role: String, // 'admin' hoặc 'user'
    registeredCourses: [{ type: ObjectId, ref: 'courses' }], // Danh sách khóa học đã đăng ký
    createdAt: Date
  }
};

module.exports = User;