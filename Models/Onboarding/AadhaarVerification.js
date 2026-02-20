const mongoose = require('mongoose');

const AadhaarVerificationSchema = new mongoose.Schema({
    aadhaarNumber: { type: String, required: true, index: true },
    referenceId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['otp_sent', 'completed', 'failed'], default: 'otp_sent' },
    nameOnDocument: { type: String, default: '' },
    gender: { type: String, default: '' },
    dateOfBirth: { type: String, default: null },
    mobileNumber: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    pinCode: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    landmark: { type: String, default: '' },
    photo: { type: String, default: '' },
    downloadUrl: { type: String, default: '' },
    shareCode: { type: String, default: '' },
    errorMessage: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('AadhaarVerification', AadhaarVerificationSchema);