const AdminUserController = require('../controllers/AdminUser');
const { admin_middleware } = require('../middleware/auth');
const AdminUserRoutes = require('express').Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });


// Admin Login and Forgot Password
AdminUserRoutes.post('/login', AdminUserController.login);
AdminUserRoutes.post('/send/otp/forgot', AdminUserController.forgotSendOtp);
AdminUserRoutes.post('/verifyotp/forgot', AdminUserController.forgotVerifyOtp);

// AdminUserRoutes.js
AdminUserRoutes.post('/refresh-token', admin_middleware, AdminUserController.refreshToken);

// Admin user management
AdminUserRoutes.post('/add-user-admin', admin_middleware, AdminUserController.addUserAdmin);
AdminUserRoutes.put('/update-user-admin/:id', admin_middleware, AdminUserController.updateUserAdmin);
AdminUserRoutes.delete('/delete-user-admin/:id', admin_middleware, AdminUserController.deleteUserAdmin);
AdminUserRoutes.get('/get-all-admin-users', admin_middleware, AdminUserController.getAllAdminUsers);
AdminUserRoutes.get('/get/filter/options', admin_middleware, AdminUserController.getFilterOptions);
AdminUserRoutes.get('/get/user/activity', admin_middleware, AdminUserController.getUserActivity);

// Admin Users
AdminUserRoutes.get('/get/admin-users', admin_middleware, AdminUserController.getAdminUsers);

// Profile
AdminUserRoutes.get('/profile', admin_middleware, AdminUserController.getProfile);
AdminUserRoutes.put('/edit-profile/img', admin_middleware, upload.single('img'), AdminUserController.editProfileImg);
AdminUserRoutes.put('/edit-profile/username', admin_middleware, AdminUserController.editProfileUsername);
AdminUserRoutes.get('/check-username', admin_middleware, AdminUserController.checkUsernameAvailability);


module.exports = AdminUserRoutes;