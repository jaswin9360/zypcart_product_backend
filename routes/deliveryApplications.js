
import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";

import DeliveryApplication from "../models/DeliveryApplication.js";
import auth from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

const uploadDir = path.join(
  process.cwd(),
  "private-uploads",
  "delivery"
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${path.extname(file.originalname).toLowerCase()}`;

    cb(null, safeName);
  },
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const upload = multer({
  storage,
  limits: {
    files: 3,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(
        new Error("Only JPG, PNG, and PDF files are allowed.")
      );
    }

    cb(null, true);
  },
});

const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many applications. Please try again later.",
  },
});

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

// Public: submit a delivery partner application.
router.post(
  "/apply",
  applicationLimiter,
  upload.array("documents", 3),
  asyncHandler(async (req, res) => {
    const {
      fullName,
      email,
      phone,
      city,
      address,
      vehicleType,
      licenseNumber,
      experience,
      availability,
      message,
    } = req.body;

    if (
      !fullName?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !city?.trim() ||
      !address?.trim() ||
      !vehicleType
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingApplication = await DeliveryApplication.findOne({
      email: normalizedEmail,
      status: "Pending",
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message:
          "A pending application already exists for this email.",
      });
    }

    const documents = (req.files || []).map((file) => ({
      filename: file.filename,
      originalName: path.basename(file.originalname),
      mimetype: file.mimetype,
      path: file.path,
    }));

    const application = await DeliveryApplication.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      city: city.trim(),
      address: address.trim(),
      vehicleType,
      licenseNumber: licenseNumber?.trim() || "",
      experience: experience || "",
      availability: availability || "",
      message: message?.trim() || "",
      documents,
    });

    return res.status(201).json({
      success: true,
      message: "Your delivery partner application has been submitted.",
      application: {
        id: application._id,
        status: application.status,
      },
    });
  })
);

// Admin: list all applications.
// Authentication runs before the admin role check.
router.get(
  "/admin/applications",
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const applications = await DeliveryApplication.find()
      .select("-documents.path")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      applications,
    });
  })
);

// Admin: approve or reject an application.
router.patch(
  "/admin/applications/:id/review",
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, reviewNote } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Approved or Rejected.",
      });
    }

    const application = await DeliveryApplication.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewNote: reviewNote?.trim() || "",
        reviewedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-documents.path");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    return res.json({
      success: true,
      message: `Application ${status.toLowerCase()}.`,
      application,
    });
  })
);

export default router;
