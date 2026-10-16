
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

export async function auth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    const token = authorization.slice(7).trim();
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is missing.");
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    const decoded = jwt.verify(token, secret);
    const userId = decoded.id || decoded.userId || decoded.sub;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(userId).select("_id role");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    req.user = {
      _id: user._id,
      id: user._id.toString(),
      role: user.role,
    };

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (String(req.user.role).toLowerCase() !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  return next();
}
