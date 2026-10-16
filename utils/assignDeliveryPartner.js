import { Order } from '../models/OrderSchema.js';
import DeliveryPartner from '../models/DeliveryPartner.js';

// Assign an order to the least-busy approved partner in the same city or PIN code.
// Pass location as { city, pincode } when the checkout address has structured fields.
export default async function assignDeliveryPartner(orderId, location = {}) {
  const order = await Order.findById(orderId);
  if (!order || order.deliveryPartnerId || order.deliveryPartnerStatus === 'delivered') return order;

  const pincode = String(location.pincode || location.postalCode || location.zipCode || '').trim();
  const city = String(location.city || '').trim();
  if (!pincode && !city) return order;

  const query = { status: 'approved', isAvailable: true };
  if (pincode) query.pincode = pincode;
  else query.city = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  const partner = await DeliveryPartner.findOne(query).sort({ activeDeliveries: 1, createdAt: 1 });
  if (!partner) return order;

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, deliveryPartnerId: null, deliveryPartnerStatus: 'assigned' },
    { $set: { deliveryPartnerId: String(partner._id), deliveryPartnerStatus: 'assigned' } },
    { new: true }
  );
  if (updated) await DeliveryPartner.updateOne({ _id: partner._id }, { $inc: { activeDeliveries: 1 } });
  return updated || Order.findById(orderId);
}