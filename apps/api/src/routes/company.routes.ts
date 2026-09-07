import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../errors/AppError";
import { createCompanyUserSchema, updateBrandingSchema } from "../validation/companyValidation";
import * as companyService from "../services/companyService";

const router = Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(AppError.badRequest("Logo must be an image file"));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const company = await companyService.getCompany(req.user!);
    res.status(200).json(company);
  } catch (err) {
    next(err);
  }
});

router.patch("/branding", requireRole("COMPANY_ADMIN"), async (req: Request, res: Response, next) => {
  try {
    const input = updateBrandingSchema.parse(req.body);
    const company = await companyService.updateBranding(req.user!, input);
    res.status(200).json(company);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/logo",
  requireRole("COMPANY_ADMIN"),
  logoUpload.single("logo"),
  async (req: Request, res: Response, next) => {
    try {
      if (!req.file) {
        throw AppError.badRequest("A logo image file is required");
      }
      const company = await companyService.uploadLogo(req.user!, { buffer: req.file.buffer });
      res.status(200).json(company);
    } catch (err) {
      next(err);
    }
  }
);

router.get("/users", requireRole("COMPANY_ADMIN"), async (req: Request, res: Response, next) => {
  try {
    const users = await companyService.listUsers(req.user!);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
});

router.post("/users", requireRole("COMPANY_ADMIN"), async (req: Request, res: Response, next) => {
  try {
    const input = createCompanyUserSchema.parse(req.body);
    const user = await companyService.createCompanyUser(req.user!, input);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id", requireRole("COMPANY_ADMIN"), async (req: Request, res: Response, next) => {
  try {
    await companyService.deleteUser(req.user!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
