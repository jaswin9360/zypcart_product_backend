// routes/deliveryApplications.js
const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const DeliveryApplication = require("../models/DeliveryApplication");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

const uploadDir = path.join(process.cwd(), "private-uploads", "delivery");

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
      return cb(new Error("Only JPG, PNG, and PDF files are allowed."));
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

// Public application endpoint: no customer login required.
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
        message: "A pending application already exists for this email.",
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

    res.status(201).json({
      success: true,
      message: "Your delivery partner application has been submitted.",
      application: {
        id: application._id,
        status: application.status,
      },
    });
  })
);

// Protect these routes with your real authentication middleware
// before requireAdmin. Never trust a client-provided role.
router.get(
  "/admin/applications",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const applications = await DeliveryApplication.find()
      .select("-documents.path")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      applications,
    });
  })
);

router.patch(
  "/admin/applications/:id/review",
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

    res.json({
      success: true,
      message: `Application ${status.toLowerCase()}.`,
      application,
    });
  })
);

module.exports = router;