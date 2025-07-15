import express, { Router } from "express";
import {
  loginUser,
  userForgotPassword,
  userRegistration,
  verifyUser,
} from "../controller/auth.controller";
import { verifyUserForgotPasswordOtp } from "../utils/auth.helper";

const router: Router = express.Router();

router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login-user", loginUser);
router.post("/forgot-password-user", userForgotPassword);
router.post("/verify-forgot-password-user", verifyUserForgotPasswordOtp);

export default router;
