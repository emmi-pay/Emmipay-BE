const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utilities/config');
const AdminUser = require('../Models/AdminUsers');


const auth = {
    auth_middleware: async (req, res, next) => {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ message: 'Invalid Token' });
        }
        
        const getToken = (request) => {
            const Auth = request.get('authorization');
            if (Auth && Auth.toLowerCase().startsWith('bearer ')) {
                return Auth.substring(7);
            }
            return null;
        };

        try {
            jwt.verify(getToken(req), JWT_SECRET, (error, decoded) => {
                if (error) {
                    return res.status(400).json({ message: 'Token error' });
                }
                req.user = decoded;
                next();
            });
        } catch (e) {
            console.log('Token error', e);
        }
    },
    admin_middleware: async (req, res, next) => {
        const token = req.headers.authorization;
      
        if (!token) {
          return res.status(400).json({ message: 'Invalid Token' });
        }
      
        const getToken = (request) => {
          const Auth = request.get('authorization');
          if (Auth && Auth.toLowerCase().startsWith('bearer ')) {
            return Auth.substring(7);
          }
          return null;
        };
      
        try {
          jwt.verify(getToken(req), JWT_SECRET, async (error, decoded) => {
            if (error) {
              return res.status(400).json({ message: 'Token error' });
            }
      
            const { username } = decoded;
            
      
            const admin = await AdminUser.findOne({ username });
  
            if (!admin) {
              return res.status(404).json({ message: 'Admin not found' });
            }
      
            if (admin.role !== 'admin' && admin.role !== 'admin-users') {
              return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
            }
      
            req.user = decoded; 
            next();
          });
        } catch (e) {
          console.error('Token error', e);
          return res.status(500).json({ message: 'Internal Server Error' });
        }
      }
};

module.exports = auth;