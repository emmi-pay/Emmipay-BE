const mongoose = require('mongoose');

const merchantInfoSchema = new mongoose.Schema({
  merchant_id: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  onboardingStatus: { type: String },
  formData: { type: Object },
  docStatus: { type: Object },
  partners: { type: Array },
  files: [{
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    url: { type: String},
    status: { type: String, default: 'Pending' },
    remark: { type: String, default: '' },
    directorIndex: { type: Number },
    fileType: { type: String },
    directorId: { type: Number },
    cubDashShow: { type: Boolean, default: false },
    cubStatus: { type: String },
    cubRemark: { type: String },
  }],
  resellerId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  refResellerId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  isFinalSubmissionCompleted: {
    type: Boolean,
    default: false
  },
  isEditAllowded: {
    type: Boolean,
    default: true
  },
  isCubDashboard: {
    type: Boolean,
    default: false
  },
  cubService: {
    static: {
      enabled: { type: Boolean, default: false },
      status: { type: String },
      remark: { type: String },
      approverName: { type: String },
      approverLocation: { type: String },
      approverIp: { type: String },
      approvalTime: { type: Date }
    },
    intent: {
      enabled: { type: Boolean, default: false },
      status: { type: String },
      remark: { type: String },
      approverName: { type: String },
      approverLocation: { type: String },
      approverIp: { type: String },
      approvalTime: { type: Date }
    }
  }
}, {
  timestamps: true,
});

const MerchantInfo = mongoose.model('MerchantInfo', merchantInfoSchema);
module.exports = MerchantInfo;
