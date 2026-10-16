import express from 'express';
import DeliveryPartner from '../models/DeliveryPartner.js';
import {Order} from '../models/OrderSchema.js';
import { auth, requireDeliveryPartner } from '../middleware/deliveryAuth.js';

const router = express.Router();
router.use(auth, requireDeliveryPartner);

async function approvedPartner(req, res) {
  const partner = await DeliveryPartner.findOne({ user: req.user._id, status: 'approved' });
  if (!partner) {
    res.status(403).json({ success: false, message: 'Your application must be approved before accessing delivery orders.' });
    return null;
  }
  return partner;
}

router.get('/orders', async (req, res, next) => {
  try {
    const partner = await approvedPartner(req, res);
    if (!partner) return;
    const orders = await Order.find({ deliveryPartner: partner._id, deliveryStatus: { $in: ['assigned', 'accepted', 'picked_up'] } })
      .select('orderNumber items totalAmount shippingAddress deliveryAddress deliveryStatus createdAt')
      .sort({ createdAt: -1 }).lean();
    res.json({ success: true, orders });
  } catch (error) { next(error); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const partner = await approvedPartner(req, res);
    if (!partner) return;
    const { status } = req.body;
    if (!['accepted', 'picked_up', 'delivered'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid delivery status.' });
    const order = await Order.findOne({ _id: req.params.id, deliveryPartner: partner._id });
    if (!order) return res.status(404).json({ success: false, message: 'Assigned order not found.' });
    const allowed = { assigned: ['accepted'], accepted: ['picked_up'], picked_up: ['delivered'] };
    if (!allowed[order.deliveryStatus]?.includes(status)) return res.status(409).json({ success: false, message: `Cannot change ${order.deliveryStatus} to ${status}.` });
    order.deliveryStatus = status;
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      await DeliveryPartner.updateOne({ _id: partner._id }, { $inc: { activeDeliveries: -1 } });
    }
    await order.save();
    res.json({ success: true, message: 'Order status updated.', order: { id: order._id, deliveryStatus: order.deliveryStatus } });
  } catch (error) { next(error); }
});

export default router;
