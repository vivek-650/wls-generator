import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import * as searchService from "../services/searchService";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchService.search(req.user!, q);
    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
