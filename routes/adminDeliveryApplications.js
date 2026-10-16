import express from 'express';
import DeliveryApplication from '../models/DeliveryApplication.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import { auth, requireAdmin } from '../middleware/deliveryAuth.js';

const router = express.Router();
router.use(auth, requireAdmin);

router.get('/applications', async (_req, res, next) => {
  try {
    const applications = await DeliveryApplication.find().select('-documents.path').sort({ createdAt: -1 }).populate('user', 'name email').lean();
    res.json({ success: true, applications });
  } catch (error) { next(error); }
});

router.patch('/applications/:id/review', async (req, res, next) => {
  try {
    const { status, reviewNote = '' } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected.' });
    const application = await DeliveryApplication.findByIdAndUpdate(req.params.id, {
      $set: { status, reviewNote: String(reviewNote).trim().slice(0, 500), reviewedAt: new Date(), reviewedBy: req.user._id },
    }, { new: true, runValidators: true });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    if (status === 'Approved') {
      await DeliveryPartner.findOneAndUpdate({ user: application.user }, {
        $set: {
          user: application.user, application: application._id, fullName: application.fullName, email: application.email,
          phone: application.phone, city: application.city, address: application.address, pincode: application.pincode,
          vehicleType: application.vehicleType, status: 'approved', isAvailable: true,
        },
      }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    } else {
      await DeliveryPartner.findOneAndUpdate({ user: application.user }, { $set: { status: 'rejected', isAvailable: false } });
    }
    res.json({ success: true, message: `Application ${status.toLowerCase()}.`, application: { id: application._id, status: application.status, reviewNote: application.reviewNote } });
  } catch (error) { next(error); }
});

export default router;
