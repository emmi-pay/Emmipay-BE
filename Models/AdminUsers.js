const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    useremail: { type: String, unique: true, required: true },
    img: { type: String },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'admin-users'] },
    permissions: {
        docsVerification: { type: Boolean, default: false },
    }
});
const AdminUser = mongoose.model('AdminUser', adminSchema);
module.exports = AdminUser;