const mongoose = require('mongoose');

const BankVerificationSchema = new mongoose.Schema({
    accountNumber: { type: String, required: true, index: true },
    ifscCode: { type: String, required: true, uppercase: true },
    referenceId: { type: String, default: '' },
    accountExists: { type: Boolean, default: false },
    nameAtBank: { type: String, default: '' },
    message: { type: String, default: '' }
}, { timestamps: true });

// Compound unique index
BankVerificationSchema.index({ accountNumber: 1, ifscCode: 1 }, { unique: true });

module.exports = mongoose.model('BankVerification', BankVerificationSchema);