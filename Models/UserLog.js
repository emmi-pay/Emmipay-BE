const mongoose = require('mongoose');

const UserLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    date: { type: String, required: true },
    logs: [
        {
            time: { type: String },
            taskType: { type: String },
            taskDescription: { type: String }
        }
    ]
});

// Compound index — one doc per user per day
UserLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('UserLog', UserLogSchema);