const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
    name: { type: String, required: true },       
    username: { type: String, required: true, unique: true },
    useremail: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    img: { type: String, default: '' },
    permissions: {
        docsVerification: { type: Boolean, default: false },
    },
    accessAssigned: { type: Array, default: [] },
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', AdminUserSchema);