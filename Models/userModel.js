const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
  name: String,
  email: String,
  passwordHash: String,
  phone: String,
  language: { type: String, default: "English" },
  pic: {
    type: "String",
    default:
      "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
  },
  reset_OTP: String,
  lastFailedAttempt: Date,
  googleId: String,
  failedAttemptsCount: Number,
}, {
  timestamps: true,
}
)
const User = mongoose.model('User', userSchema)
module.exports = User