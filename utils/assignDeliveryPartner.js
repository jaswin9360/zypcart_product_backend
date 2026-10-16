import DeliveryPartner from "../models/DeliveryPartner.js";
import Order from "../models/Order.js";

export default async function assignDeliveryPartner(order) {
  const address = order.shippingAddress || order.deliveryAddress || {};

  const pincode = String(
    address.pincode || address.postalCode || ""
  ).trim();

  if (!pincode) return null;

  const candidates = await DeliveryPartner.find({
    pincode,
    status: "approved",
    isAvailable: true,
  }).lean();

  if (!candidates.length) return null;

  const workloads = await Order.aggregate([
    {
      $match: {
        deliveryPartner: {
          $in: candidates.map((partner) => partner._id),
        },
        deliveryStatus: { $in: ["assigned", "picked_up"] },
      },
    },
    {
      $group: {
        _id: "$deliveryPartner",
        count: { $sum: 1 },
      },
    },
  ]);

  const workloadMap = new Map(
    workloads.map((item) => [String(item._id), item.count])
  );

  candidates.sort(
    (a, b) =>
      (workloadMap.get(String(a._id)) || 0) -
      (workloadMap.get(String(b._id)) || 0)
  );

  // Atomically assign only if the order is still unassigned.
  const selected = candidates[0];

  return Order.findOneAndUpdate(
    {
      _id: order._id,
      deliveryStatus: "unassigned",
      $or: [
        { deliveryPartner: null },
        { deliveryPartner: { $exists: false } },
      ],
    },
    {
      $set: {
        deliveryPartner: selected._id,
        deliveryStatus: "assigned",
      },
    },
    { new: true }
  );
}