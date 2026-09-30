import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./config/db";
import authRoutes from "./routes/authRoutes";
import propertyRoutes from "./routes/propertyRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Real Estate API is running"
  });
});

const PORT = process.env.PORT || 5000;

pool.query("SELECT NOW()")
  .then(() => console.log("Database connection successful"))
  .catch((err: any) => console.error("Database connection failed:", err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});