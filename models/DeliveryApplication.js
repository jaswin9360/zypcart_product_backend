// models/DeliveryApplication.js
import mongoose from "mongoose";

const deliveryApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      required: true,
      unique: true,
    },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      enum: ["Bike", "Scooter", "Bicycle", "Car", "Other"],
      required: true,
    },
    licenseNumber: { type: String, default: "" },
    experience: { type: String, default: "" },
    availability: { type: String, default: "Full-time" },
    message: { type: String, default: "" },
    documents: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model(
  "DeliveryApplication",
  deliveryApplicationSchema
);