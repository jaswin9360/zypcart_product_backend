import express from "express";
import {Order} from "../models/OrderSchema.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import {
  requireLogin,
  requireApprovedPartner,
} from "../middleware/deliveryAuth.js";

const router = express.Router();

router.get("/status", requireLogin, async (req, res) => {
  try {
    const partner = await DeliveryPartner.findOne({
      user: req.deliveryUser.id,
    });

    if (!partner) {
      return res.status(404).json({
        message: "Application not found.",
      });
    }

    res.json({
      status: partner.status,
      fullName: partner.fullName,
      isAvailable: partner.isAvailable,
    });
  } catch {
    res.status(500).json({ message: "Unable to load status." });
  }
});

router.get(
  "/orders",
  requireLogin,
  requireApprovedPartner,
  async (req, res) => {
    try {
      const orders = await Order.find({
        deliveryPartner: req.partner._id,
      }).sort({ createdAt: -1 });

      res.json({ orders });
    } catch {
      res.status(500).json({ message: "Unable to load orders." });
    }
  }
);

router.patch(
  "/orders/:orderId/status",
  requireLogin,
  requireApprovedPartner,
  async (req, res) => {
    try {
      const { status } = req.body;

      const transitions = {
        assigned: "picked_up",
        picked_up: "delivered",
      };

      if (!Object.values(transitions).includes(status)) {
        return res.status(400).json({
          message: "Invalid delivery status.",
        });
      }

      const order = await Order.findOne({
        _id: req.params.orderId,
        deliveryPartner: req.partner._id,
      });

      if (!order) {
        return res.status(404).json({
          message: "Assigned order not found.",
        });
      }

      if (transitions[order.deliveryStatus] !== status) {
        return res.status(409).json({
          message: "Invalid status transition.",
        });
      }

      order.deliveryStatus = status;
      await order.save();

      res.json({ message: "Order updated.", order });
    } catch {
      res.status(500).json({ message: "Unable to update order." });
    }
  }
);

export default router;