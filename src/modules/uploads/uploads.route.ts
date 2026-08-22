import { Router } from "express";
import multer from "multer";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import { uploadsController } from "./uploads.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error("Only jpg, png or webp images are allowed"), {
          code: "INVALID_FILE_TYPE",
        }),
      );
    }
  },
});

const router = Router();

router.post(
  "/image",
  // USER included so customers can attach refund evidence (spec 26)
  auth(Role.USER, Role.AGENT, Role.ADMIN),
  upload.single("image"),
  uploadsController.uploadImage,
);

export const uploadRoutes = router;