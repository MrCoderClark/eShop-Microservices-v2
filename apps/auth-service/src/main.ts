import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "@monorepo/error-handler";
import router from "./routes/auth.router";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "100mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send({ message: "Welcome to auth-service!" });
});

// Routes
app.use("/api", router);

app.use(errorHandler);

const port = process.env.PORT || 6001;

const server = app.listen(port, () => {
  console.log(`Auth service is running at at http://localhost:${port}/api`);
});

server.on("error", (err) => {
  console.log("Server Error", err);
});
