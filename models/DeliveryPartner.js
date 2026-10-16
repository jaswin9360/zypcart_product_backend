import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import DeliveryPartner from "../models/DeliveryPartner.js";

const router = express.Router();

// POST /api/delivery/auth/register
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "Full name, email, and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingPartner = await DeliveryPartner.findOne({
      email: normalizedEmail,
    });

    if (existingPartner) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const partner = await DeliveryPartner.create({
      name: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "deliveryPartner",
    });

    // Create a login token for the newly registered partner.
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");
      return res.status(500).json({
        message: "Server authentication is not configured.",
      });
    }

    const token = jwt.sign(
      {
        sub: partner._id.toString(),
        role: partner.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Delivery partner registered successfully.",
      token,
      user: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        role: partner.role,
      },
    });
  } catch (error) {
    console.error("Delivery registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
});

export default router;