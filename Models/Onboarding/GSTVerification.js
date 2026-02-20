const mongoose = require('mongoose');

const GSTVerificationSchema = new mongoose.Schema({
    gstin: { type: String, required: true, unique: true, uppercase: true, index: true },
    referenceId: { type: String, default: '' },
    tradeName: { type: String, default: '' },
    legalName: { type: String, default: '' },
    gstinStatus: { type: String, default: '' },
    taxpayerType: { type: String, default: '' },
    constitutionOfBusiness: { type: String, default: '' },
    address: { type: String, default: '' },
    dateOfRegistration: { type: String, default: null },
    dateOfCancellation: { type: String, default: null },
    natureOfPrincipalPlaceOfBusiness: { type: String, default: '' },
    lastUpdatedDate: { type: String, default: null },
    primaryBusinessContact: { type: String, default: null },
    additionalPlacesOfBusiness: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('GSTVerification', GSTVerificationSchema);