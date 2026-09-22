import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import * as notificationService from "../services/notificationService";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const result = await notificationService.listNotifications(req.user!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/read", async (req: Request, res: Response, next) => {
  try {
    await notificationService.markNotificationRead(req.user!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/read-all", async (req: Request, res: Response, next) => {
  try {
    await notificationService.markAllNotificationsRead(req.user!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
