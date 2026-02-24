import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import http from "http";

import { connectDB } from "./config/db.js";
import { seedAdmin } from "./utils/seedAdmin.js";

import authRoutes from "./routes/authRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import forumRoutes from "./routes/forumRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import { Server } from "socket.io";
import { setIO } from "./utils/socket.js";

dotenv.config();

const app = express();

const FRONTEND = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: FRONTEND, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (req, res) => res.json({ ok: true, service: "Felicity Backend" }));

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    await seedAdmin();

    app.use("/api/auth", authRoutes);
    app.use("/api/events", eventRoutes);
    app.use("/api/tickets", ticketRoutes);
    app.use("/api/orders", orderRoutes);
    app.use("/api/teams", teamRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/forum", forumRoutes);
    app.use("/api/feedback", feedbackRoutes);
    app.use("/api/users", userRoutes);

    // Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: { origin: true, methods: ["GET", "POST"] }
    });

    // store io for other modules
    setIO(io);

    io.on("connection", (socket) => {
      // join room for event-based forum updates
      socket.on("join", (eventId) => {
        if (!eventId) return;
        socket.join(`event:${eventId}`);
      });
      socket.on("leave", (eventId) => {
        if (!eventId) return;
        socket.leave(`event:${eventId}`);
      });
    });

    server.listen(PORT, () => console.log(`✅ Server (with sockets) running on ${PORT}`));

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use. Run: fuser -k ${PORT}/tcp  then restart.`);
        process.exit(1);
      } else {
        throw err;
      }
    });

  } catch (err) {
    console.error("❌ Startup error:", err.message);
    process.exit(1);
  }
})();
