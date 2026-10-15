
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Adjust this import to match your project's actual User model.
import User from "../models/User";

export default async function auth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    const token = authorization.slice(7).trim();

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support common JWT subject formats.
    const userId = decoded.id || decoded.userId || decoded.sub;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Fetch the role from the database, not from client-provided data.
    const user = await User.findById(userId).select("_id role");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    };

    next();
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

    next(error);
  }
}
