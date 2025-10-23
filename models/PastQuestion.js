const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Add UUID for default question IDs

const pastQuestionSchema = new mongoose.Schema({
  course: {
    type: String,
    required: true,
  },
  semester: {
    type: String,
  },
  year: {
    type: Number,
    required: true,
  },
  examSession: {
    type: String,
  },
  questions: {
    type: [
      {
        id: {
          type: String,
          default: uuidv4, // Automatically generate UUID if not provided
          required: true,
        },
        number: {
          type: String,
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
      },
    ],
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0; // Ensure at least one question exists
      },
      message: 'Questions array cannot be empty',
    },
  },
});

module.exports = mongoose.model('PastQuestion', pastQuestionSchema);