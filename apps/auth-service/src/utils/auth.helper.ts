import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../../../packages/error-handler/src/lib/index";
import redis from "@monorepo/redis";
import { sendEmail } from "./sendMail";
import prisma from "@monorepo/prisma";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ValidationRegistrationData = (
  data: any,
  userType: "user" | "seller"
) => {
  const { name, email, password, phone_number, country } = data;

  if (
    !name ||
    !email ||
    !password ||
    (userType === "seller" && (!phone_number || !country))
  ) {
    throw new ValidationError(`Missing required fields`);
  }

  if (!emailRegex.test(email)) {
    throw new ValidationError(`Invalid email format!`);
  }
};

export const checkOtpRestrictions = async (
  email: string,
  next: NextFunction
) => {
  if (await redis.get(`otp_lock:${email}`)) {
    return next(
      new ValidationError(
        "Account locked due to multiple failed login attempts. Please try again later."
      )
    );
  }
  if (await redis.get(`otp_spam_lock:${email}`)) {
    return next(
      new ValidationError("Too many OTP requests. Please try again later.")
    );
  }

  if (await redis.get(`otp_cooldown:${email}`)) {
    return next(
      new ValidationError("Plese wait 1 minute before requesting a new OTP.")
    );
  }
};

export const sendOtp = async (
  name: string,
  email: string,
  template: string
) => {
  const otp = crypto.randomInt(1000, 9999).toString();
  await sendEmail(email, "Verify Your Email", template, { name, otp });
  await redis.set(`otp:${email}`, otp, "EX", 300);
  await redis.set(`otp_cooldown:${email}`, "true", "EX", 60);
};

export const trackOtpRequests = async (email: string, next: NextFunction) => {
  const otpRequestKey = `otp_request_count:${email}`;
  let otpRequests = parseInt((await redis.get(otpRequestKey)) || "0");

  if (otpRequests >= 2) {
    await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600); // Locked for 1 hour
    return next(
      new ValidationError("Too many OTP requests. Please try again later.")
    );
  }

  await redis.set(otpRequestKey, otpRequests + 1, "EX", 3600); // Track requests for 1 hour
};

export const verifyOtp = async (
  email: string,
  otp: string,
  next: NextFunction
) => {
  const storedOtp = await redis.get(`otp:${email}`);

  if (!storedOtp) {
    throw new ValidationError("Invalid or expired OTP!");
  }
  const failedAttemptsKey = `otp_attempts:${email}`;
  const failedAttempts = parseInt((await redis.get(failedAttemptsKey)) || "0");

  if (storedOtp !== otp) {
    if (failedAttempts >= 2) {
      await redis.set(`otp_lock:${email}`, "locked", "EX", 1800); // Locked for4 mins
      await redis.del(`otp_attempts:${email}`, failedAttemptsKey);
      throw new ValidationError(
        "Account locked due to multiple failed login attempts. Please try again later."
      );
    }
    await redis.set(failedAttemptsKey, failedAttempts + 1, "EX", 300); // Track failed attempts for 5 minutes
    throw new ValidationError(
      `'Invalid OTP! ${2 - failedAttempts} attempts left.`
    );
  }

  await redis.del(`otp:${email}`, failedAttemptsKey);
};

export const handleForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
  userType: "user" | "seller"
) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError(`Email is required!`);
    }

    // Find user/seller in DB
    const user =
      userType === "user" &&
      (await prisma.users.findFirst({ where: { email } }));

    if (!user) {
      throw new ValidationError(`${userType} not found!`);
    }

    // Check otp restrictions
    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);

    // Generate OTP and send Email
    await sendOtp(user.name, email, "forgot-password-user-mail");

    res
      .status(200)
      .json({ message: "OTP sent to email. Please verify yuor account." });
  } catch (error) {
    next(error);
  }
};

export const verifyUserForgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      throw new ValidationError(`Email and OTP are required!`);
    }

    await verifyOtp(email, otp, next);
    res
      .status(200)
      .json({ message: "OTP verified. You can now reset your password!" });
  } catch (error) {
    next(error);
  }
};
