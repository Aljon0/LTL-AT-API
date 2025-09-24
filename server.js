import dotenv from 'dotenv';
import express from 'express';
import { verifyEmailService } from './config/email.js';
import { startScheduledJobs } from './jobs/scheduledJobs.js';
import corsMiddleware from './middleware/cors.js';
import errorHandler from './middleware/errorHandler.js';
import loggingMiddleware from './middleware/logging.js';
import routes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
async function initializeServices() {
  await verifyEmailService();
  console.log('✅ All services initialized');
}

// Initialize app
async function startServer() {
  await initializeServices();
  
  // Middleware
  app.use(corsMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(loggingMiddleware);

  // Timeout middleware for specific routes
  app.use((req, res, next) => {
    if (req.path.includes('/generate-post') || req.path.includes('/trends')) {
      req.setTimeout(120000);
      res.setTimeout(120000);
    }
    next();
  });

  // Routes
  app.use('/api', routes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      message: 'ThoughtLeader AI API is running'
    });
  });

  // Error handling
  app.use(errorHandler);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Start scheduled jobs
  startScheduledJobs();

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ Server ready with all services');
  });
}

startServer();