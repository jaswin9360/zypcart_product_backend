import express from 'express';
import DeliveryApplication from '../models/DeliveryApplication.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import { auth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(auth, requireAdmin);

router.get('/applications', async (_req, res, next) => {
  try {
    const applications = await DeliveryApplication.find().select('-documents.path').sort({ createdAt: -1 }).populate('userId', 'name email').lean();
    res.json({ success: true, applications });
  } catch (error) { next(error); }
});

router.patch('/applications/:id/review', async (req, res, next) => {
  try {
    const { status, reviewNote = '' } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected.' });
    const application = await DeliveryApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    application.status = status;
    application.reviewNote = String(reviewNote).trim().slice(0, 500);
    application.reviewedAt = new Date();
    application.reviewedBy = req.user._id;
    await application.save();

    const partnerStatus = status.toLowerCase();
    await DeliveryPartner.findByIdAndUpdate(application.userId, { $set: {
      status: partnerStatus,
      application: application._id,
      name: application.fullName,
      email: application.email,
      phone: application.phone,
      city: application.city,
      address: application.address,
      pincode: application.pincode,
      vehicleType: application.vehicleType,
      isAvailable: status === 'Approved',
    } });

    res.json({ success: true, message: `Application ${status.toLowerCase()}.`, application: { _id: application._id, id: application._id, status: application.status, reviewNote: application.reviewNote } });
  } catch (error) { next(error); }
});

export default router;