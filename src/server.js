const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'standalone_app';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${INSTANCE_NAME}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API Routes
app.use('/api/v1', apiRoutes);

// Static Web Dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Root Route fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] [${INSTANCE_NAME}]`, err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message,
    instance: INSTANCE_NAME,
  });
});

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Smart Campus Platform Running [${INSTANCE_NAME}]`);
  console.log(` Listening on port: ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`=======================================================`);
});

// Graceful Termination
process.on('SIGTERM', () => {
  console.log(`[${INSTANCE_NAME}] SIGTERM received. Shutting down gracefully...`);
  server.close(() => {
    console.log(`[${INSTANCE_NAME}] Server closed.`);
    process.exit(0);
  });
});
