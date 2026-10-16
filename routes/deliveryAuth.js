import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import DeliveryPartner from "../models/DeliveryPartner.js";

const router = express.Router();

const createToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      city,
      address,
      pincode,
      vehicleType,
      licenseNumber,
      experience,
      availability,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !password ||
      !phone ||
      !city ||
      !address ||
      !pincode
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    const user = await User.create({
      name: fullName.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: "delivery_partner",
    });

    try {
      await DeliveryPartner.create({
        user: user._id,
        fullName,
        email: normalizedEmail,
        phone,
        city,
        address,
        pincode,
        vehicleType,
        licenseNumber,
        experience,
        availability,
        status: "pending",
      });
    } catch (error) {
      await User.findByIdAndDelete(user._id);
      throw error;
    }

    return res.status(201).json({
      message: "Registration successful. Await admin approval.",
      token: createToken(user),
      status: "pending",
    });
  } catch (error) {
    console.error("Delivery registration:", error.message);

    res.status(500).json({
      message: "Registration failed.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email });

    if (
      !user ||
      user.role !== "delivery_partner" ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: "Invalid delivery partner credentials.",
      });
    }

    const partner = await DeliveryPartner.findOne({
      user: user._id,
    });

    if (!partner) {
      return res.status(403).json({
        message: "Delivery application not found.",
      });
    }

    return res.json({
      token: createToken(user),
      status: partner.status,
      message: "Login successful.",
    });
  } catch {
    res.status(500).json({ message: "Login failed." });
  }
});

export default router;