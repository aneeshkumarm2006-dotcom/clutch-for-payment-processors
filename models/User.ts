import { Schema, model, models, type Model } from "mongoose";
import { USER_ROLES, type UserRole } from "@/lib/enums";

/**
 * User (PRD §8.7) — admin/editor accounts. `passwordHash` is a bcrypt hash;
 * the plaintext password never touches the DB. The `editor` role + the Users
 * admin (PRD §10.10) are Phase 2.
 *
 * `isActive` is a Phase 2 addition (logged in NOTES.md + PRD §8.7 note): the
 * Users admin "Deactivate" action sets it false instead of deleting the
 * account, and `lib/auth.ts` refuses sign-in for deactivated users.
 */
export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "admin" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// `email` already has a unique index from the field option above.

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);

export default User;
