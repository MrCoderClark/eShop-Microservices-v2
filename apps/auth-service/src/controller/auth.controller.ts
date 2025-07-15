import { NextFunction, Request, Response } from "express";
import {
  checkOtpRestrictions,
  handleForgotPassword,
  sendOtp,
  trackOtpRequests,
  ValidationRegistrationData,
  verifyOtp,
  verifyUserForgotPasswordOtp,
} from "../utils/auth.helper";
import prisma from "@monorepo/prisma";
import {
  AuthError,
  PasswordError,
  ValidationError,
} from "@monorepo/error-handler";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { setCookie } from "../utils/cookies/setCookie";

// Register a new user
export const userRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    ValidationRegistrationData(req.body, "user");
    const { name, email } = req.body;

    const existingUser = await prisma.users.findFirst({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      throw new ValidationError(`User already exists with this email!`);
    }

    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);
    await sendOtp(name, email, "user-activation-mail");

    res
      .status(200)
      .json({ message: "OTP sent to email. Please verify your account." });
  } catch (error) {
    return next(error);
  }
};

// verify user with otp
export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp, password, name } = req.body;

    if (!email || !otp || !password || !name) {
      return next(new ValidationError(`All fields are required!`));
    }

    const existingUser = await prisma.users.findFirst({ where: { email } });

    if (existingUser) {
      return next(new ValidationError(`User already exists with this email!`));
    }
    await verifyOtp(email, otp, next);
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.users.create({
      data: { name, email, password: hashedPassword },
    });

    res
      .status(201)
      .json({ success: true, message: "User registered successfully!" });
  } catch (error) {
    return next(error);
  }
};

// login user
export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ValidationError(`Email and password are required!`));
    }

    const user = await prisma.users.findFirst({ where: { email } });

    if (!user) {
      return next(new AuthError("User account not found"));
    }

    // verify password
    if (!user.password) {
      return next(new PasswordError("Password is required"));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AuthError("Invalid email or password"));
    }

    // Generate access and refresh token
    const accessToken = jwt.sign(
      { id: user.id, role: "user" },
      process.env.ACCESS_TOKEN_SECRET as string,
      {
        expiresIn: "15m",
      }
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: "user" },
      process.env.REFRESH_TOKEN_SECRET as string,
      {
        expiresIn: "7d",
      }
    );

    // store the refresh and access token in an httpOnly secure cookie
    setCookie(res, "accessToken", accessToken);
    setCookie(res, "refreshToken", refreshToken);

    res.status(200).json({
      message: "Logged in successfully",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    return next(error);
  }
};

// user forgot password
export const userForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await handleForgotPassword(req, res, next, "user");
};

// Verify forgot password OTP
export const verifyUserForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await verifyUserForgotPasswordOtp(req, res, next);
};
