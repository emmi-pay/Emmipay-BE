const mongoose = require('mongoose')

const OTPSchema = mongoose.Schema({
    email: String,
    OTP: String,
    expiryTime: Date,
    verified: { type: 'boolean', default: false },
}
)
const UserOTP = mongoose.model('OTPs', OTPSchema)
module.exports = UserOTP