import { z } from 'zod';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Validates req.body against a Zod schema. Returns 400 with a readable error
 * message if validation fails; replaces req.body with the parsed (coerced) data
 * and calls next() on success.
 */
export function validate<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
        .join('; ');
      res.status(400).json({ success: false, error: message });
      return;
    }
    req.body = result.data;
    next();
  };
}
