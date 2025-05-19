const { ObjectId } = require('mongodb');

const Comment = {
  collectionName: 'comments',
  schema: {
    lessonId: { type: ObjectId, ref: 'lessons' },
    userId: { type: ObjectId, ref: 'users' },
    content: String,
    createdAt: Date
  }
};

module.exports = Comment;