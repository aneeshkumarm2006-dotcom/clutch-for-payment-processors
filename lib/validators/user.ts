import { z } from "zod";
import { USER_ROLES } from "@/lib/enums";

/**
 * Admin user creation (PRD §8.7 / §11). Accepts a plaintext `password`; the API
 * (and the seed script) bcrypt-hash it into `passwordHash` before persisting.
 * The user-management UI itself is Phase 2.
 */
export const userInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  role: z.enum(USER_ROLES).default("admin"),
});

export type UserInput = z.infer<typeof userInput>;
