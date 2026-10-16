import express from 'express';
import { Order } from '../models/OrderSchema.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import { auth, requireDeliveryPartner } from '../middleware/deliveryAuth.js';

const router = express.Router();
router.use(auth, requireDeliveryPartner);

async function getApprovedPartner(req, res) {
  const partner = await DeliveryPartner.findById(req.user._id);
  if (!partner || partner.status !== 'approved') {
    res.status(403).json({ success: false, message: 'Your application must be approved before accessing delivery orders.' });
    return null;
  }
  return partner;
}

router.get('/orders', async (req, res, next) => {
  try {
    const partner = await getApprovedPartner(req, res);
    if (!partner) return;
    const orders = await Order.find({
      deliveryPartnerId: String(partner._id),
      deliveryPartnerStatus: { $in: ['assigned', 'accepted', 'picked_up'] },
    }).select('items address totalAmountPaid status deliveryPartnerId deliveryPartnerStatus deliveredAt createdAt').sort({ createdAt: -1 }).lean();
    res.json({ success: true, orders });
  } catch (error) { next(error); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const partner = await getApprovedPartner(req, res);
    if (!partner) return;
    const { status } = req.body;
    const transitions = { assigned: 'accepted', accepted: 'picked_up', picked_up: 'delivered' };
    if (!['accepted', 'picked_up', 'delivered'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid delivery status.' });
    const order = await Order.findOne({ _id: req.params.id, deliveryPartnerId: String(partner._id) });
    if (!order) return res.status(404).json({ success: false, message: 'Assigned order not found.' });
    if (transitions[order.deliveryPartnerStatus] !== status) return res.status(409).json({ success: false, message: `Cannot change ${order.deliveryPartnerStatus} to ${status}.` });

    order.deliveryPartnerStatus = status;
    if (status === 'picked_up') order.status = 'Shipped';
    if (status === 'delivered') {
      order.status = 'Delivered';
      order.deliveredAt = new Date();
      await DeliveryPartner.updateOne({ _id: partner._id, activeDeliveries: { $gt: 0 } }, { $inc: { activeDeliveries: -1 } });
    }
    await order.save();
    res.json({ success: true, message: 'Order status updated successfully.', order: { id: order._id, status: order.status, deliveryStatus: order.deliveryPartnerStatus, deliveredAt: order.deliveredAt } });
  } catch (error) { next(error); }
});

export default router;