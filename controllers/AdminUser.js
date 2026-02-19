const { v4: uuidv4 } = require("uuid");
const AdminUser = require("../Models/AdminUsers");
const bcrypt = require("bcrypt");
const { JWT_SECRET } = require("../utilities/config");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const UserOTP = require('../Models/OTP');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const UserLog = require("../Models/UserLog");
const logAdminActivity = async ({ userId, taskType, taskDescription }) => {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toLocaleTimeString();

        const user = await AdminUser.findById(userId);
        if (!user) {
            console.error('User not found for logging');
            return;
        }

        const taskEntry = {
            time: currentTime,
            taskType,
            taskDescription
        };

        // Find today's doc for this user, if not exists → create it
        await UserLog.findOneAndUpdate(
            { userId, date: currentDate },
            {
                $setOnInsert: {
                    userName: user.username,
                },
                $push: {
                    logs: taskEntry
                }
            },
            { upsert: true, new: true }
        );

    } catch (error) {
        console.error('Error logging admin activity:', error);
    }
};

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const uploadProfile = async (file, userId) => {
    const fileExtension = file.originalname.split(".").pop();
    const key = `${userId}.${fileExtension}`;

    const params = {
        Bucket: "emmi-profiles",
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    try {
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
        return `https://${params.Bucket}.s3.ap-south-1.amazonaws.com/${key}`;
    } catch (err) {
        console.error("Error uploading profile img to S3:", err);
        throw err;
    }
};


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const AdminUserController = {

    // Admin Login and Forgot Password
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: "Username/email and password are required" });
            }

            const input = username.trim().toLowerCase();

            const explainQuery = AdminUser.findOne({
                $or: [
                    { username: input },
                    { useremail: input }
                ]
            });
            const explanation = await explainQuery.explain("executionStats");

            const admin = await AdminUser.findOne({
                $or: [
                    { username: input },
                    { useremail: input }
                ]
            });

            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            const isMatch = await bcrypt.compare(password, admin.password);

            if (!isMatch) {
                return res.status(400).json({ message: "Invalid credentials" });
            }

            await logAdminActivity({
                userId: admin._id,
                taskType: "Admin Login",
                taskDescription: `'${admin.username}' logged in to the Emmipay Admin Dashboard.`
            });

            const token = jwt.sign(
                {
                    username: admin.username,
                    id: admin._id,
                    accessAssigned: admin.accessAssigned
                },
                JWT_SECRET,
                { expiresIn: "3h" }
            );


            return res.status(200).json({
                user: admin._id,
                username: admin.username,
                accessAssigned: admin.accessAssigned,
                token,
                loginTime: Date.now(),
                message: "Admin Login success",
            });

        } catch (error) {
            console.error("SignIn error:", error);
            return res.status(500).json({ message: "Sign In error" });
        }
    },
    forgotSendOtp: async (req, res) => {
        try {
            const { email } = req.body;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({ message: "Email or username is required" });
            }

            const input = email.trim().toLowerCase();

            const admin = await AdminUser.findOne({
                $or: [
                    { username: input },
                    { useremail: input }
                ]
            });

            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            const OTP = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedOTP = await bcrypt.hash(OTP, 10);
            const expiryTime = new Date(Date.now() + 5 * 60 * 1000);
            const emailToUse = admin.useremail;

            let otpRecord = await UserOTP.findOne({ email: emailToUse });

            if (otpRecord) {
                otpRecord.OTP = hashedOTP;
                otpRecord.expiryTime = expiryTime;
                otpRecord.verified = false;
                await otpRecord.save();
            } else {
                await UserOTP.create({
                    email: emailToUse,
                    OTP: hashedOTP,
                    expiryTime,
                    verified: false
                });
            }

            const mailOptions = {
                from: 'noreply@emmipay.com',
                to: emailToUse,
                subject: 'Reset Your EmmiPay Admin Dashboard Password',
                html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2c3e50; font-size: 28px; margin-bottom: 10px;">Password Reset Request 🔐</h1>
                        <div style="width: 50px; height: 3px; background-color: #3498db; margin: 0 auto;"></div>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                            Hey <strong>${admin.username}</strong>! 👋
                        </p>
                        <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                            We received a request to reset the password for your EmmiPay Admin Dashboard account. 
                        </p>
                    </div>

                    <div style="background-color: #ecf0f1; padding: 25px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                        <h3 style="color: #2c3e50; margin-bottom: 15px; font-size: 18px;">🔑 Your One-Time Password (OTP)</h3>
                        <div style="background-color: #2c3e50; color: #ffffff; font-size: 36px; font-family: monospace; letter-spacing: 12px; padding: 20px 30px; border-radius: 8px; display: inline-block; font-weight: bold;">
                            ${OTP}
                        </div>
                        <p style="color: #e74c3c; font-size: 14px; margin-top: 15px; font-weight: bold;">
                            ⏱️ This OTP expires in 5 minutes
                        </p>
                    </div>

                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="color: #856404; margin-bottom: 15px; font-size: 16px;">⚠️ Important Security Notice:</h3>
                        <ul style="color: #856404; margin: 0; padding-left: 20px;">
                            <li style="margin-bottom: 8px;"><strong>Never share</strong> this OTP with anyone — EmmiPay team will never ask for it</li>
                            <li style="margin-bottom: 8px;"><strong>Time-sensitive:</strong> This OTP is valid for <strong>5 minutes only</strong></li>
                            <li style="margin-bottom: 8px;"><strong>Single use:</strong> This OTP can only be used once</li>
                            <li style="margin-bottom: 8px;"><strong>Didn't request this?</strong> Please ignore this email — your account is safe</li>
                        </ul>
                    </div>

                    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="color: #721c24; margin-bottom: 10px; font-size: 16px;">🚨 Didn't Request This?</h3>
                        <p style="color: #721c24; margin: 0; line-height: 1.6;">
                            If you didn't request a password reset, please ignore this email. Your password will remain unchanged. 
                            If you suspect any unauthorized activity on your account, contact us immediately.
                        </p>
                    </div>

                    <p style="font-size: 0.9rem; line-height: 1.5; color: #34495e; margin: 20px 0 10px;">
                        Need help? We're always here for you — reach out anytime at 
                        <a href="mailto:emmipayofficial@gmail.com" style="color: #3498db; text-decoration: none;">emmipayofficial@gmail.com</a>.
                    </p>

                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; text-align: center;">
                        <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                            Stay secure,<br>
                            <strong>The EmmiPay Team</strong>
                        </p>
                        <p style="color: #bdc3c7; font-size: 11px; margin-top: 10px;">
                            This is an automated email. Please do not reply directly to this message.
                        </p>
                    </div>

                </div>
            </div>
            `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("Email send error:", error);
                    return res.status(500).json({ message: 'Error sending OTP email' });
                } else {
                    return res.status(200).json({ message: 'OTP sent to email successfully' });
                }
            });

        } catch (error) {
            console.error('signInOtp error:', error);
            return res.status(500).json({ message: "Error generating OTP" });
        }
    },
    forgotVerifyOtp: async (req, res) => {
        try {
            const { email, otp, newPassword } = req.body;

            if (!email || !otp || !newPassword) {
                return res.status(400).json({ message: "Email, OTP and New Password are required" });
            }

            const sanitizedInput = email.trim().toLowerCase();

            const admin = await AdminUser.findOne({
                $or: [
                    { username: sanitizedInput },
                    { useremail: sanitizedInput }
                ]
            });

            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            const emailToUse = admin.useremail;

            const otpRecord = await UserOTP.findOne({
                email: emailToUse,
                expiryTime: { $gt: new Date() }
            });

            if (!otpRecord) {
                return res.status(400).json({ message: "Invalid or expired OTP" });
            }

            if (otpRecord.verified) {
                return res.status(400).json({ message: "OTP already used" });
            }

            const isValid = await bcrypt.compare(otp.toString(), otpRecord.OTP);
            if (!isValid) {
                return res.status(400).json({ message: "Invalid OTP" });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            admin.password = hashedPassword;
            await admin.save();

            otpRecord.verified = true;
            await otpRecord.save();

            await logAdminActivity({
                userId: admin._id,
                taskType: "Password Reset",
                taskDescription: `'${admin.username}' changed their password via OTP verification.`
            });

            return res.status(200).json({ message: "Password changed successfully" });

        } catch (error) {
            console.error("verifyOtp error:", error);
            return res.status(500).json({ message: "OTP verification error" });
        }
    },

    // AdminUserController.js
    refreshToken: async (req, res) => {
        try {
            const userId = req.user.id; // From middleware

            const admin = await AdminUser.findById(userId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Generate new token
            const newToken = jwt.sign(
                {
                    username: admin.username,
                    id: admin._id,
                    accessAssigned: admin.accessAssigned
                },
                JWT_SECRET,
                { expiresIn: "3h" }
            );

            await logAdminActivity({
                userId: admin._id,
                taskType: "Session Refreshed",
                taskDescription: `${admin.username} refreshed their session.`
            });

            return res.status(200).json({
                success: true,
                token: newToken,
                loginTime: Date.now(),
                message: "Session refreshed successfully"
            });

        } catch (error) {
            console.error("Token refresh error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to refresh session"
            });
        }
    },



    // Admin User Management
    addUserAdmin: async (req, res) => {
        const userId = req.user.id;
        console.log('userId:', userId)

        try {
            const { username, useremail, role } = req.body;
            console.log('req.body:', req.body)

            if (!username || !useremail || !role) {
                return res.status(400).json({
                    message: 'Username, email, and role are required'
                });
            }

            const creatorUser = await AdminUser.findById(userId);
            if (!creatorUser) {
                return res.status(404).json({ message: 'Creator user not found' });
            }

            if (creatorUser.role !== 'admin') {
                console.log('creatorUser:', creatorUser)
                return res.status(400).json({
                    message: 'You do not have permission to add users. Only admins can perform this action.'
                });
            }

            const existingUser = await AdminUser.findOne({
                $or: [{ username }, { useremail }]
            });

            if (existingUser) {
                return res.status(400).json({ message: 'User with this username or email already exists' });
            }

            const newPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            const newAdminUser = new AdminUser({
                username,
                useremail,
                password: hashedPassword,
                role,
            });

            await newAdminUser.save();

            await logAdminActivity({
                userId,
                taskType: "Admin User Creation",
                taskDescription: `An admin user account was successfully created for '${username}' (Email: ${useremail}, Role: ${role}) by '${creatorUser.username}'.`
            });

            const dashboardLink = `
            <div style="margin-bottom: 10px;">
                <strong style="color: #34495e;">Dashboard Link:</strong> 
                <a href="https://admin-dashboard.emmipay.com/" style="color: #3498db; text-decoration: none;">
                    https://admin-dashboard.emmipay.com/
                </a>
            </div>
        `;

            const mailOptions = {
                from: 'noreply@emmipay.com',
                to: useremail,
                subject: 'Welcome to the EmmiPay Family!',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #2c3e50; font-size: 28px; margin-bottom: 10px;">Welcome to the EmmiPay Family! 🎊</h1>
                            <div style="width: 50px; height: 3px; background-color: #3498db; margin: 0 auto;"></div>
                        </div>

                        <div style="margin-bottom: 25px;">
                            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                                Hey <strong>${username}</strong>! 👋
                            </p>
                            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                                We're thrilled to have you on board! You've been granted access to the EmmiPay Admin Dashboard — 
                                a powerful tool that puts you at the heart of our operations. Your skills and dedication are going to make a real difference here.
                            </p>
                        </div>

                        <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                            <h3 style="color: #2c3e50; margin-bottom: 15px; font-size: 18px;">🔑 Your Login Credentials:</h3>
                            ${dashboardLink}
                            <div style="margin-bottom: 10px;">
                                <strong style="color: #34495e;">Username:</strong> <span style="color: #2c3e50;">${username}</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong style="color: #34495e;">Email:</strong> <span style="color: #2c3e50;">${useremail}</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong style="color: #34495e;">Password:</strong> <span style="color: #e74c3c; font-family: monospace;">${newPassword}</span>
                            </div>
                        </div>

                        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                            <h3 style="color: #155724; margin-bottom: 15px; font-size: 16px;">💪 You're Part of Something Big!</h3>
                            <p style="color: #155724; margin: 0; line-height: 1.6;">
                                At EmmiPay, we believe in empowering our team to do their best work. 
                                Your contribution matters, and we're confident you'll excel in your role. 
                                Let's build something amazing together!
                            </p>
                        </div>

                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                            <h3 style="color: #856404; margin-bottom: 15px; font-size: 16px;">🔒 A Few Important Guidelines:</h3>
                            <ul style="color: #856404; margin: 0; padding-left: 20px;">
                                <li style="margin-bottom: 8px;"><strong>Keep it private:</strong> Your credentials are yours alone — never share them with anyone</li>
                                <li style="margin-bottom: 8px;"><strong>Stay aware:</strong> All activities on the dashboard are monitored for everyone's safety</li>
                                <li style="margin-bottom: 8px;"><strong>Use responsibly:</strong> Access is for authorized business operations only</li>
                                <li style="margin-bottom: 8px;"><strong>Own your actions:</strong> Every action under your account reflects on you — make it count!</li>
                                <li style="margin-bottom: 8px;"><strong>Protect data:</strong> Handle all information with care and follow our security standards</li>
                                <li style="margin-bottom: 8px;"><strong>Speak up:</strong> Notice something unusual? Report it immediately — your vigilance keeps us safe</li>
                            </ul>
                        </div>

                        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                            <h3 style="color: #0c5460; margin-bottom: 15px; font-size: 16px;">🛡️ Quick Security Tip:</h3>
                            <p style="color: #0c5460; margin: 0; line-height: 1.6;">
                                We highly recommend changing your password right after your first login. 
                                A strong password is your first line of defense!
                            </p>
                        </div>

                        <div style="margin-bottom: 25px;">
                            <p style="color: #34495e; font-size: 14px; line-height: 1.6;">
                                <strong>FYI:</strong> Your access was set up by <strong>${creatorUser.username}</strong>. 
                                If you have any questions about your role or access, feel free to reach out to them.
                            </p>
                        </div>

                        <p style="font-size: 0.9rem; line-height: 1.5; margin: 20px 0 10px;">
                            Got questions? We're always here to help — reach out anytime at 
                            <a href="mailto:emmipayofficial@gmail.com" style="color: #3498db; text-decoration: none;">emmipayofficial@gmail.com</a>.
                        </p>

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; text-align: center;">
                            <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                                Cheers,<br>
                                <strong>The EmmiPay Team</strong>
                            </p>
                        </div>

                    </div>
                </div>
            `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("Email send error:", error);
                    return res.status(500).json({ message: 'User created but error sending email' });
                } else {
                    console.log("Credentials email sent successfully for the new admin user.");
                    return res.status(200).json({ message: 'User added successfully and credentials sent via email' });
                }
            });

        } catch (error) {
            console.error("Error adding user:", error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },
    updateUserAdmin: async (req, res) => {
        const userId = req.user.id;
        const targetUserId = req.params.id;

        try {
            const { username, role, permissions } = req.body;

            if (!username || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and role are required'
                });
            }

            const requestingUser = await AdminUser.findById(userId);
            if (!requestingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Requesting user not found'
                });
            }

            if (requestingUser.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to update users. Only admins can perform this action.'
                });
            }

            const userToUpdate = await AdminUser.findById(targetUserId);
            if (!userToUpdate) {
                return res.status(404).json({
                    success: false,
                    message: 'User to update not found'
                });
            }

            if (username !== userToUpdate.username) {
                const existingUser = await AdminUser.findOne({
                    username,
                    _id: { $ne: targetUserId }
                });

                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'Username already exists'
                    });
                }
            }

            const oldRole = userToUpdate.role;
            const oldPermissions = { ...userToUpdate.permissions };

            userToUpdate.username = username;
            userToUpdate.role = role;
            userToUpdate.permissions = {
                ...userToUpdate.permissions,
                docsVerification: permissions?.docsVerification || false,
            };

            await userToUpdate.save();

            const changes = [];

            if (oldRole !== role) {
                const roleNames = {
                    'admin': 'Admin',
                    'admin-users': 'Admin User'
                };
                changes.push(`Changed role from ${roleNames[oldRole]} to ${roleNames[role]}`);
            }

            const oldDocsVerification = oldPermissions.docsVerification || false;
            const newDocsVerification = userToUpdate.permissions.docsVerification;

            if (oldDocsVerification !== newDocsVerification) {
                changes.push(
                    newDocsVerification
                        ? 'Enabled permission for Document Verification'
                        : 'Disabled permission for Document Verification'
                );
            }

            const taskDescription = changes.length > 0
                ? `${requestingUser.username} updated ${userToUpdate.username}'s account. ${changes.join('. ')}.`
                : `${requestingUser.username} updated ${userToUpdate.username}'s account with no changes.`;

            await logAdminActivity({
                userId,
                taskType: "Admin User Update",
                taskDescription
            });

            return res.status(200).json({
                success: true,
                message: 'User updated successfully',
                data: {
                    username: userToUpdate.username,
                    useremail: userToUpdate.useremail,
                    role: userToUpdate.role,
                    permissions: userToUpdate.permissions
                }
            });

        } catch (error) {
            console.error('Error updating user:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },
    deleteUserAdmin: async (req, res) => {
        const userId = req.user.id;
        const targetUserId = req.params.id;

        try {
            // Check if requesting user is admin
            const requestingUser = await AdminUser.findById(userId);
            if (!requestingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Requesting user not found'
                });
            }

            if (requestingUser.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to delete users. Only admins can perform this action.'
                });
            }

            // Prevent self-deletion
            if (userId === targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot delete your own account'
                });
            }

            // Find the user to delete
            const userToDelete = await AdminUser.findById(targetUserId);
            if (!userToDelete) {
                return res.status(404).json({
                    success: false,
                    message: 'User to delete not found'
                });
            }

            const deletedUserInfo = {
                username: userToDelete.username,
                useremail: userToDelete.useremail,
                role: userToDelete.role,
                accessAssigned: userToDelete.accessAssigned
            };

            // Delete the user
            await AdminUser.findByIdAndDelete(targetUserId);

            // Log admin activity
            await logAdminActivity({
                userId,
                taskType: "Admin User Deletion",
                taskDescription: `Admin user '${deletedUserInfo.username}' (Email: ${deletedUserInfo.useremail}, Role: ${deletedUserInfo.role}) was deleted by '${requestingUser.username}'.`
            });

            return res.status(200).json({
                success: true,
                message: 'User deleted successfully',
                data: deletedUserInfo
            });

        } catch (error) {
            console.error('Error deleting user:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },
    getAllAdminUsers: async (req, res) => {
        try {
            const userId = req.user.id;

            // Check if requesting user exists
            const requestingUser = await AdminUser.findById(userId);
            if (!requestingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Only admin can view others
            if (requestingUser.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to view users. Only admins can perform this action.'
                });
            }

            // Fetch all admin users except current
            let users = await AdminUser.find({ _id: { $ne: userId } })
                .select('-password')
                .sort({ createdAt: -1 });

            // Step 1: Define access level rank
            const getAccessRank = (user) => {
                const access = user.accessAssigned || [];
                const hasAdmin = access.includes('admin');
                const hasAudit = access.includes('audit');

                if (hasAdmin && hasAudit) return 1; // both admin & audit
                if (hasAdmin) return 2;             // only admin
                if (hasAudit) return 3;             // only audit
                return 4;                           // no access (rare)
            };

            // Step 2: Define role rank
            const getRoleRank = (role) => {
                if (role === 'admin') return 1;
                if (role === 'admin-users') return 2;
                return 3;
            };

            // Step 3: Sort based on access first, then role
            users = users.sort((a, b) => {
                const accessDiff = getAccessRank(a) - getAccessRank(b);
                if (accessDiff !== 0) return accessDiff;
                return getRoleRank(a.role) - getRoleRank(b.role);
            });

            return res.status(200).json({
                success: true,
                data: users
            });

        } catch (error) {
            console.error('Error fetching admin users:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },
    getFilterOptions: async (req, res) => {
        try {
            const userId = req.user.id;

            const currentUser = await AdminUser.findById(userId, 'username role');
            if (!currentUser) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            const isAdmin = currentUser.role === 'admin';

            // ---- Admin Users List ----
            // Admin → all users, Non-admin → only themselves
            let adminUsers = [];
            if (isAdmin) {
                const allUsers = await AdminUser.find({}, 'username _id').sort({ username: 1 });
                adminUsers = allUsers.map(user => ({
                    userId: user._id,
                    username: user.username
                }));
            } else {
                adminUsers = [{
                    userId: currentUser._id,
                    username: currentUser.username
                }];
            }

            // ---- Task Types ----
            // Admin → all task types from all users
            // Non-admin → only their task types
            let taskTypePipeline = [];

            if (!isAdmin) {
                taskTypePipeline.push({ $match: { userId: userId } });
            }

            taskTypePipeline.push(
                { $unwind: "$logs" },
                {
                    $group: {
                        _id: "$logs.taskType"
                    }
                },
                { $match: { _id: { $ne: null } } },
                { $sort: { _id: 1 } }
            );

            const taskTypes = await UserLog.aggregate(taskTypePipeline);
            const uniqueTaskTypes = taskTypes.map(item => item._id);

            return res.status(200).json({
                success: true,
                data: {
                    adminUsers,
                    taskTypes: uniqueTaskTypes,
                    currentUser: {
                        userId: userId,
                        username: currentUser.username,
                        isAdmin: isAdmin
                    }
                }
            });

        } catch (error) {
            console.error("Error fetching filter options:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message,
            });
        }
    },

    getUserActivity: async (req, res) => {
        try {
            const userId = req.user.id;

            const currentUser = await AdminUser.findById(userId, 'username role');
            if (!currentUser) {
                return res.status(404).json({ success: false, message: "Admin user not found" });
            }

            const isAdmin = currentUser.role === 'admin';
            const { startDate, endDate, filterUserId, taskType } = req.query;

            // Build query
            let query = {};

            // ---- User Filter ----
            if (isAdmin) {
                if (filterUserId && filterUserId !== 'all') {
                    query.userId = filterUserId;
                }
            } else {
                query.userId = userId;
            }

            // ---- Date Filter ----
            if (startDate && endDate) {
                query.date = { $gte: startDate, $lte: endDate };
            } else if (startDate) {
                query.date = { $gte: startDate };
            } else if (endDate) {
                query.date = { $lte: endDate };
            }

            // Fetch logs
            let logs = await UserLog.find(query)
                .sort({ date: -1 })
                .limit(100)
                .lean();

            // ---- Task Type Filter ----
            if (taskType && taskType !== '' && taskType !== 'all') {
                logs = logs
                    .map((doc) => ({
                        ...doc,
                        logs: doc.logs.filter((log) => log.taskType === taskType),
                    }))
                    .filter((doc) => doc.logs.length > 0);
            }

            return res.status(200).json({
                success: true,
                message: "User activities fetched successfully",
                data: logs,
                count: logs.length,
                adminType: isAdmin ? 'admin' : 'regular'
            });

        } catch (error) {
            console.error("Error fetching user activity:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message,
            });
        }
    },

    // Admin Users
    getAdminUsers: async (req, res) => {
        try {
            const adminUsers = await AdminUser.find({}, { _id: 1, username: 1 });

            return res.json({
                success: true,
                data: adminUsers
            });
        } catch (error) {
            console.error("Error in getAdminUsers:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },

    // Profile
    getProfile: async (req, res) => {
        try {
            const userId = req.user.id;

            const admin = await AdminUser.findById(userId)
                .select('img username useremail');

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    username: admin.username,
                    useremail: admin.useremail,
                    img: admin.img || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg", // ✅ Default image
                }
            });

        } catch (error) {
            console.error("Get profile error:", error);
            return res.status(500).json({
                success: false,
                message: "Error fetching profile"
            });
        }
    },
    editProfileImg: async (req, res) => {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No image file provided"
                });
            }

            // Upload to S3
            const imageUrl = await uploadProfile(req.file, userId);

            // Update database
            const updatedAdmin = await AdminUser.findByIdAndUpdate(
                userId,
                { img: imageUrl },
                { new: true }
            ).select('img username useremail');

            if (!updatedAdmin) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Profile image updated successfully",
                data: {
                    username: updatedAdmin.username,
                    useremail: updatedAdmin.useremail,
                    img: updatedAdmin.img
                }
            });

        } catch (error) {
            console.error("Edit profile image error:", error);
            return res.status(500).json({
                success: false,
                message: "Error updating profile image"
            });
        }
    },


};

module.exports = AdminUserController;