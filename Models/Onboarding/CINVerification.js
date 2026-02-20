const mongoose = require('mongoose');

const DirectorSchema = new mongoose.Schema({
    din: { type: String, default: '' },
    name: { type: String, default: '' },
    begin_date: { type: String, default: '' },
    end_date: { type: String, default: null }
}, { _id: false });

const ChargeSchema = new mongoose.Schema({
    amount: { type: String, default: null },
    asset: { type: String, default: '' },
    date_of_creation: { type: String, default: null },
    date_of_modification: { type: String, default: null },
    status: { type: String, default: null }
}, { _id: false });

const CINVerificationSchema = new mongoose.Schema({
    cin: { type: String, required: true, unique: true, uppercase: true, index: true },
    referenceId: { type: String, default: '' },
    companyName: { type: String, default: '' },
    registeredAddress: { type: String, default: '' },
    registrationNumber: { type: String, default: null },
    classOfCompany: { type: String, default: '' },
    companyCategory: { type: String, default: '' },
    companySubcategory: { type: String, default: '' },
    companyStatus: { type: String, default: '' },
    emailId: { type: String, default: '' },
    rocCode: { type: String, default: null },
    source: { type: String, default: '' },
    dateOfIncorporation: { type: String, default: '' },
    dateOfBalanceSheet: { type: String, default: null },
    dateOfLastAgm: { type: String, default: null },
    authorisedCapital: { type: String, default: '0' },
    paidUpCapital: { type: String, default: '0' },
    whetherListedOrNot: { type: String, default: '' },
    directors: [DirectorSchema],
    charges: [ChargeSchema],
    numberOfMembers: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('CINVerification', CINVerificationSchema);