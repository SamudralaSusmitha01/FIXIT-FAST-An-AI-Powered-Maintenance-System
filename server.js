require('dotenv').config();
require('express-async-errors');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { initFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// ── Route imports ──
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const propertyRoutes = require('./routes/properties');
const vendorRoutes = require('./routes/vendors');
const analyticsRoutes = require('./routes/analytics');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);

// ── Socket.io ──
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true), // allow all origins
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('join_request',  (requestId)  => socket.join(`request_${requestId}`));
  socket.on('join_landlord', (landlordId) => socket.join(`landlord_${landlordId}`));
  socket.on('disconnect',    ()           => console.log(`❌ Client disconnected: ${socket.id}`));
});

// ── Core Middleware ──
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, true), // allow all origins (dev mode)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter);

// ── Health Check ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FixIt Fast API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── API Routes ──
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/requests',   requestRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/vendors',    vendorRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/upload',     uploadRoutes);

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ──
app.use(errorHandler);

// ── Boot ──
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    initFirebase();
    server.listen(PORT, () => {
      console.log(`\n🔧 FixIt Fast API running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, server };