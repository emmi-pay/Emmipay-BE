const mongoose = require('mongoose');

const PANVerificationSchema = new mongoose.Schema({
    panNumber: { type: String, required: true, unique: true, uppercase: true, index: true },
    referenceId: { type: String, default: '' },
    nameOnDocument: { type: String, default: '' },
    firstName: { type: String, default: '' },
    middleName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    mobileNumber: { type: String, default: null },
    dateOfBirth: { type: String, default: null },
    gender: { type: String, default: null },
    state: { type: String, default: null },
    source: { type: String, default: null },
    aadhaarSeedingStatus: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('PANVerification', PANVerificationSchema);