import path from "path";
import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../errors/AppError";
import { updateCandidateSchema } from "../validation/candidateValidation";
import * as candidateService from "../services/candidateService";

const router = Router();

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIMETYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(AppError.badRequest("Only .pdf and .docx resume files are accepted"));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);
router.use(requireRole("COMPANY_ADMIN", "COMPANY_MEMBER"));

router.post("/upload", resumeUpload.single("file"), async (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      throw AppError.badRequest("A resume file (field name 'file') is required");
    }
    const candidate = await candidateService.uploadCandidate(req.user!, {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    res.status(201).json(candidate);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const candidates = await candidateService.listCandidates(req.user!);
    res.status(200).json(candidates);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: Request, res: Response, next) => {
  try {
    const candidate = await candidateService.getCandidate(req.user!, req.params.id);
    res.status(200).json(candidate);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: Request, res: Response, next) => {
  try {
    const input = updateCandidateSchema.parse(req.body);
    const candidate = await candidateService.updateCandidate(req.user!, req.params.id, input);
    res.status(200).json(candidate);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next) => {
  try {
    await candidateService.deleteCandidate(req.user!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/export", async (req: Request, res: Response, next) => {
  try {
    const generated = await candidateService.exportCandidate(req.user!, req.params.id);
    res.status(200).json(generated);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/exports", async (req: Request, res: Response, next) => {
  try {
    const exports = await candidateService.listExports(req.user!, req.params.id);
    res.status(200).json(exports);
  } catch (err) {
    next(err);
  }
});

export default router;
