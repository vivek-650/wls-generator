import { Router, Request, Response, CookieOptions } from "express";
import { AuthResponse } from "@wlr/shared-types";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { loginSchema, registerSchema } from "../validation/authValidation";
import * as authService from "../services/authService";

const router = Router();

const REFRESH_COOKIE_NAME = "refresh_token";

function refreshCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    path: "/api/auth",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(expiresAt));
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

router.post("/register", async (req: Request, res: Response, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    const body: AuthResponse = { user: result.authUser, accessToken: result.accessToken };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req: Request, res: Response, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    const body: AuthResponse = { user: result.authUser, accessToken: result.accessToken };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req: Request, res: Response, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await authService.refresh(rawToken);
    setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    res.status(200).json({ accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req: Request, res: Response, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await authService.logout(rawToken);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const me = await authService.getMe(req.user!.id);
    res.status(200).json(me);
  } catch (err) {
    next(err);
  }
});

export default router;
