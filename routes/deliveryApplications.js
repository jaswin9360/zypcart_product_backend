import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import DeliveryApplication from '../models/DeliveryApplication.js';
import { auth, requireDeliveryPartner } from '../middleware/deliveryAuth.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'private-uploads', 'delivery');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
});
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const upload = multer({
  storage,
  limits: { files: 3, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => allowedMimeTypes.has(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, and PDF files are allowed.')),
});
const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch((error) => {
    console.error('Delivery application submission failed:', {
      name: error.name,
      code: error.code,
      message: error.message,
      stack: error.stack
    });

    next(error);
  });

// Partner must register/log in before submitting an application.
router.post('/apply', auth, requireDeliveryPartner, applicationLimiter, upload.array('documents', 3), asyncHandler(async (req, res) => {
  const { fullName, email, phone, city, address, pincode, vehicleType, licenseNumber, experience, availability, message } = req.body;
  if (![fullName, email, phone, city, address, pincode, vehicleType].every((v) => String(v || '').trim())) {
    for (const file of req.files || []) fs.promises.unlink(file.path).catch(() => {});
    return res.status(400).json({ success: false, message: 'Please complete all required fields.' });
  }
  const existing = await DeliveryApplication.findOne({ userId: req.user._id });
  if (existing && existing.status !== 'Rejected') {
    for (const file of req.files || []) fs.promises.unlink(file.path).catch(() => {});
    return res.status(409).json({ success: false, message: 'You already have an application. Check your application status.' });
  }
  const documents = (req.files || []).map((file) => ({ filename: file.filename, originalName: path.basename(file.originalname), mimetype: file.mimetype, path: file.path }));
  const values = {
    userId: req.user._id, fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(), phone: String(phone).trim(),
    city: String(city).trim(), address: String(address).trim(), pincode: String(pincode).trim(), vehicleType,
    licenseNumber: String(licenseNumber || '').trim(), experience: String(experience || ''), availability: String(availability || ''),
    message: String(message || '').trim(), documents, status: 'Pending', reviewNote: '', reviewedAt: null, reviewedBy: null,
  };
  const application = existing
    ? await DeliveryApplication.findByIdAndUpdate(existing._id, { $set: values }, { new: true, runValidators: true })
    : await DeliveryApplication.create(values);
  await (await import('../models/DeliveryPartner.js')).default.findByIdAndUpdate(req.user._id, { $set: { name: String(fullName).trim(), status: 'pending', application: application._id, phone: String(phone).trim(), city: String(city).trim(), address: String(address).trim(), pincode: String(pincode).trim(), vehicleType, isAvailable: false } });
  res.status(201).json({ success: true, message: 'Application submitted and pending review.', application: { _id: application._id, id: application._id, status: application.status, createdAt: application.createdAt } });
})) ;

export default router;