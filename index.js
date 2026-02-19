const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const { PORT, MONGODB_URI } = require('./utilities/config');
const passport = require('passport');
const http = require('http');

const AdminUserRoutes = require('./Routes/AdminUserRoute');
// const AdminKYCRoutes = require('./Routes/AdminKYCRoutes');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', true);

app.use(passport.initialize());
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true, limit: '250mb' }));
app.use(xss());

app.use('/adminuser', AdminUserRoutes);
// app.use('/adminkyc', AdminKYCRoutes);

app.get('/ip', (req, res) => {
    const ipAddress = req.ip;
    res.send(`Your IP address is: ${ipAddress}`);
});

(async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 100,
        });
        console.log('Mongoose connection successful');
    } catch (error) {
        console.error('Mongoose connection error:', error.message);
        process.exit(1);
    }

    mongoose.connection.on('disconnected', () => {
        console.log('Mongoose connection is disconnected');
    });
})();

server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
