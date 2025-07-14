import express, { Request, Response } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";
import rateLimite from "express-rate-limit";

import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());
app.set("trust proxy", 1);

// Apply rate limiting
const limiter = rateLimite({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: any) => (req.user ? 1000 : 100), // 1000 requests for authenticated users, 100 for unauthenticated users
  message: "Too many requests, please try again later.",
  legacyHeaders: true, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: any) => req.ip, // Use IP address as the key
});

app.use(limiter);

app.get("/gateway-health", (req, res) => {
  res.send({ message: "Welcome to gateway-api!" });
});

const proxy = createProxyMiddleware<Request, Response>({
  target: "http://localhost:6001",
  changeOrigin: true,
});

app.use("/", proxy);

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
