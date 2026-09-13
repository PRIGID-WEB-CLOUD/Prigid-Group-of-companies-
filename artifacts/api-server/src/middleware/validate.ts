import { z } from "zod";
import { type Request, type Response, type NextFunction } from "express";

export function validate(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return res.status(400).json({ error: "Validation failed", issues });
    }
    req.body = result.data;
    return next();
  };
}
