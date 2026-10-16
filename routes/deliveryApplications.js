import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import DeliveryApplication from '../models/DeliveryApplication.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import {
  auth,
  requireDeliveryPartner,
} from '../middleware/deliveryAuth.js';

const router = express.Router();

const uploadDir = path.join(
  process.cwd(),
  'private-uploads',
  'delivery'
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName =
      `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;

    callback(null, uniqueName);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const upload = multer({
  storage,
  limits: {
    files: 3,
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error(
        'Only JPG, PNG, and PDF files are allowed.'
      );
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
});

// Rate limiting is applied after authentication.
// The app must configure its trusted proxy setting first.
const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
});

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function removeUploadedFiles(files = []) {
  for (const file of files) {
    fs.promises.unlink(file.path).catch((error) => {
      console.error('Unable to remove uploaded file:', error.message);
    });
  }
}

router.post(
  '/apply',
  auth,
  requireDeliveryPartner,
  applicationLimiter,
  upload.array('documents', 3),
  asyncHandler(async (req, res) => {
    const {
      fullName,
      email,
      phone,
      city,
      address,
      pincode,
      vehicleType,
      licenseNumber,
      experience,
      availability,
      message,
    } = req.body;

    const requiredFields = [
      fullName,
      email,
      phone,
      city,
      address,
      pincode,
      vehicleType,
    ];

    if (
      requiredFields.some(
        (value) => !String(value ?? '').trim()
      )
    ) {
      removeUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: 'Please complete all required fields.',
      });
    }

    const validVehicleTypes = [
      'Bike',
      'Scooter',
      'Bicycle',
      'Car',
      'Other',
    ];

    if (!validVehicleTypes.includes(vehicleType)) {
      removeUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: 'Please select a valid vehicle type.',
      });
    }

    // The authenticated partner ID must match the schema's userId.
    const userId = req.user?._id;

    if (!userId) {
      removeUploadedFiles(req.files);

      return res.status(401).json({
        success: false,
        message: 'Please log in again.',
      });
    }

    const partner = await DeliveryPartner.findById(userId);

    if (!partner) {
      removeUploadedFiles(req.files);

      return res.status(404).json({
        success: false,
        message: 'Delivery partner account was not found.',
      });
    }

    // Look up the application using the same field as the schema.
    const existing = await DeliveryApplication.findOne({ userId });

    if (existing && existing.status !== 'Rejected') {
      removeUploadedFiles(req.files);

      return res.status(409).json({
        success: false,
        message:
          'You already have an application. Please check its status.',
        application: {
          id: existing._id,
          status: existing.status,
        },
      });
    }

    const documents = (req.files || []).map((file) => ({
      filename: file.filename,
      originalName: path.basename(file.originalname),
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
    }));

    const values = {
      userId,
      fullName: String(fullName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      address: String(address).trim(),
      pincode: String(pincode).trim(),
      vehicleType,
      licenseNumber: String(licenseNumber || '').trim(),
      experience: String(experience || ''),
      availability: String(availability || 'Full-time'),
      message: String(message || '').trim(),
      documents,
      status: 'Pending',
      reviewNote: '',
      reviewedAt: null,
      reviewedBy: null,
    };

    let application;

    if (existing) {
      // A rejected application can be resubmitted.
      application = await DeliveryApplication.findByIdAndUpdate(
        existing._id,
        { $set: values },
        {
          new: true,
          runValidators: true,
        }
      );
    } else {
      application = await DeliveryApplication.create(values);
    }

    await DeliveryPartner.findByIdAndUpdate(userId, {
      $set: {
        name: values.fullName,
        status: 'pending',
        application: application._id,
        phone: values.phone,
        city: values.city,
        address: values.address,
        pincode: values.pincode,
        vehicleType: values.vehicleType,
        isAvailable: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted and pending review.',
      application: {
        id: application._id,
        _id: application._id,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  })
);

export default router;