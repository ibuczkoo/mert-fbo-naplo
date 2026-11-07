import { z } from "zod";
import { roleSchema } from "./permissions.js";

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, "Adja meg a felhasználónevet").max(120),
  password: z.string().min(1, "Adja meg a jelszót").max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  employee: z
    .object({
      id: z.string().uuid(),
      fullName: z.string(),
      badgeNumber: z.string().nullable(),
    })
    .nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const passwordPolicySchema = z
  .string()
  .min(10, "Legalább 10 karakter")
  .max(200)
  .refine((p) => /[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(p) && /\d/.test(p), "Betűt és számot is tartalmazzon");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,59}$/, "3–60 karakter: kisbetű, szám, pont, kötőjel (ékezet nélkül)");

export const userCreateSchema = z.object({
  username: usernameSchema,
  role: roleSchema,
  password: passwordPolicySchema,
  employeeId: z.string().uuid().nullable().default(null),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    role: roleSchema,
    active: z.boolean(),
    password: passwordPolicySchema,
    employeeId: z.string().uuid().nullable(),
  })
  .partial();
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const userListItemSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  active: z.boolean(),
  employeeId: z.string().uuid().nullable(),
});
export type UserListItem = z.infer<typeof userListItemSchema>;
