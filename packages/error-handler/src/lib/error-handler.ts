import { NextFunction, Request, Response } from "express";
import { AppError } from "./index";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    console.log(`Error ${req.method} ${req.url} - ${err.message}`);
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(err.details && { detials: err.details }),
    });
  }

  console.log("Unhandled error", err);

  return res.status(500).json({
    status: "error",
    message: "Something went wrong, please try again later.",
  });
};
