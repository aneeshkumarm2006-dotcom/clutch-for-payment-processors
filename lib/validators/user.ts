import { z } from "zod";
import { USER_ROLES } from "@/lib/enums";

/**
 * Admin user creation (PRD §8.7 / §10.10 / §11). Accepts a plaintext `password`
 * (temp password for the new account); the API (and the seed script) bcrypt-hash
 * it into `passwordHash` before persisting. Used by `POST /api/users`.
 */
export const userInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  role: z.enum(USER_ROLES).default("admin"),
});

export type UserInput = z.infer<typeof userInput>;

/**
 * Partial update for `PATCH /api/users/[id]` — set role, (de)activate, rename,
 * or reset the password. Every field is optional; the handler enforces the
 * "can't strand the last admin" guards (PRD §10.10).
 */
export const userUpdate = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8, "Use at least 8 characters").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });

export type UserUpdate = z.infer<typeof userUpdate>;
