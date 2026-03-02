import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
      .join('; ');
    res.status(400).json({ success: false, error: message });
    return;
  }

  console.error('Error:', err.message || err);
  if (err.stack) {
    console.error('Stack:', err.stack);
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Ein Fehler ist aufgetreten'
      : (err.message || String(err)),
  });
}
