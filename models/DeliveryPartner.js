import mongoose from "mongoose";

const deliveryPartnerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true, trim: true },
    vehicleType: { type: String, default: "Bike" },
    licenseNumber: String,
    experience: String,
    availability: { type: String, default: "Full-time" },
    documents: [String],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const DeliveryPartner = mongoose.model(
  "DeliveryPartner",
  deliveryPartnerSchema
);

export default DeliveryPartner;