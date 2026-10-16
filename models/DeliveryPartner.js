import mongoose from "mongoose";

const deliveryPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["deliveryPartner"],
      default: "deliveryPartner",
    },
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryPartner", deliveryPartnerSchema);