import { Schema, model, models, type Model } from "mongoose";
import { USER_ROLES, type UserRole } from "@/lib/enums";

/**
 * User (PRD §8.7) — admin accounts only in MVP. `passwordHash` is a bcrypt hash;
 * the plaintext password never touches the DB. `editor` role is Phase 2.
 */
export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
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
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// `email` already has a unique index from the field option above.

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);

export default User;
