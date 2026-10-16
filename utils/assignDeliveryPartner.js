import DeliveryPartner from '../models/DeliveryPartner.js';
import Order from '../models/Order.js'; // Change this path to your existing Order model.

export default async function assignDeliveryPartner(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.deliveryPartner || order.deliveryStatus === 'delivered') return order;
  const address = order.deliveryAddress || order.shippingAddress || {};
  const pincode = String(address.pincode || address.postalCode || address.zipCode || '').trim();
  const city = String(address.city || '').trim();
  const locationQuery = { status: 'approved', isAvailable: true };
  if (pincode) locationQuery.pincode = pincode;
  else if (city) locationQuery.city = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  else return order;

  const candidates = await DeliveryPartner.find(locationQuery).sort({ activeDeliveries: 1, createdAt: 1 }).limit(10);
  if (!candidates.length) return order;
  // Re-check order before assigning to reduce duplicate assignment races.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, deliveryPartner: null, deliveryStatus: 'unassigned' },
    { $set: { deliveryPartner: candidates[0]._id, deliveryStatus: 'assigned' } },
    { new: true }
  );
  if (updated) await DeliveryPartner.updateOne({ _id: candidates[0]._id }, { $inc: { activeDeliveries: 1 } });
  return updated || Order.findById(orderId);
}