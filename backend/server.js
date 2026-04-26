const http = require('http');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { initializeRealtimeDispatch } = require('./services/realtimeDispatch');

// Import routes
const authRoutes = require('./routes/auth');
const partnerRoutes = require('./routes/partner');
const jobsRoutes = require('./routes/jobs');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            success: true,
            message: 'Server is healthy',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Database connection failed',
            error: error.message,
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const startServer = async () => {
    await initializeRealtimeDispatch(server);

    server.listen(PORT, () => {
        console.log(
            [
                'Delivery Partner API Server',
                `Port: ${PORT}`,
                `Environment: ${process.env.NODE_ENV || 'development'}`,
                `Realtime Dispatch Window: ${
                    process.env.DISPATCH_REQUEST_WINDOW_SECONDS || 30
                }s`,
                `Time: ${new Date().toISOString()}`,
            ].join('\n')
        );
    });
};

void startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        pool.end(() => {
            console.log('Database pool closed');
            process.exit(0);
        });
    });
});

module.exports = app;
