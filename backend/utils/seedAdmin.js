import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const exists = await User.findOne({ email });
  if (exists) return;

  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    firstName: "Admin",
    lastName: "User",
    email,
    password: hashed,
    role: "admin"
  });

  console.log("✅ Admin seeded:", email);
}
