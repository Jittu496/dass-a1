import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri);
  console.log("✅ MongoDB Connected");
}
