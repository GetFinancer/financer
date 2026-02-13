import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log full error for debugging
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
