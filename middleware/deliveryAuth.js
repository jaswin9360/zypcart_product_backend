import jwt from "jsonwebtoken";
import DeliveryPartner from "../models/DeliveryPartner.js";

export const requireLogin = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Please log in to continue.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "delivery_partner") {
      return res.status(403).json({
        message: "Delivery partner access only.",
      });
    }

    req.deliveryUser = decoded;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }
};

export const requireApprovedPartner = async (req, res, next) => {
  try {
    const partner = await DeliveryPartner.findOne({
      user: req.deliveryUser.id,
      status: "approved",
    });

    if (!partner) {
      return res.status(403).json({
        message: "Your application is not approved yet.",
      });
    }

    req.partner = partner;
    next();
  } catch {
    res.status(500).json({
      message: "Unable to verify partner approval.",
    });
  }
};