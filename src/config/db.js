import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set in environment variables");
    }
    mongoose.set("strictQuery", true);
    const conn = await mongoose.connect(uri);
    console.log(`âœ… MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`âŒ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};