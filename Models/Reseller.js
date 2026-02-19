const mongoose = require('mongoose')

const resellerSchema = mongoose.Schema({
  username: { type: String, unique: true },
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
const Reseller = mongoose.model('Reseller', resellerSchema)
module.exports = Reseller;