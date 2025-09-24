export default function loggingMiddleware(req, res, next) {
    const origin = req.get('origin') || 'no-origin';
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${origin}`);
    next();
  }