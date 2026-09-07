import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { updateCompanyStatusSchema } from "../validation/adminValidation";
import * as adminService from "../services/adminService";

const router = Router();

router.use(requireAuth, requireRole("SUPER_ADMIN"));

router.get("/companies", async (_req: Request, res: Response, next) => {
  try {
    const companies = await adminService.listCompanies();
    res.status(200).json(companies);
  } catch (err) {
    next(err);
  }
});

router.get("/companies/:id", async (req: Request, res: Response, next) => {
  try {
    const company = await adminService.getCompany(req.params.id);
    res.status(200).json(company);
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/status", async (req: Request, res: Response, next) => {
  try {
    const input = updateCompanyStatusSchema.parse(req.body);
    const company = await adminService.updateCompanyStatus(req.params.id, input.status);
    res.status(200).json(company);
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (_req: Request, res: Response, next) => {
  try {
    const stats = await adminService.getPlatformStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
