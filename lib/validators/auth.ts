import { z } from "zod";

/** Admin login credentials (PRD §11). Shared by the login form + NextAuth `authorize`. */
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
