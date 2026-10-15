import mongoose from "mongoose";

const deliveryApplicationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ["Bike", "Scooter", "Bicycle", "Car", "Other"],
    },
    licenseNumber: {
      type: String,
      trim: true,
      default: "",
    },
    experience: {
      type: String,
      default: "",
    },
    availability: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
    documents: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        path: String,
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

deliveryApplicationSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model(
  "DeliveryApplication",
  deliveryApplicationSchema
);