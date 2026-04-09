import { z } from "zod";

export class ValidationError extends Error {
  public readonly errors: { field: string; message: string }[];

  constructor(zodError: z.ZodError<unknown>) {
    const issues = zodError.issues;
    const errors = issues.map((e: z.ZodIssue) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    super(`Validation failed: ${errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join(", ")}`);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export function validateInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
}

export function sanitizeString(s: string, maxLength = 10000): string {
  return s
    .trim()
    .replace(/\0/g, "") // strip null bytes
    .slice(0, maxLength);
}
