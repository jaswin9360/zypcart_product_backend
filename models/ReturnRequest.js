
import mongoose from "mongoose";

const returnRequestSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderNumber: { type: String, default: "" },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
      },
    ],
    reason: {
      type: String,
      required: true,
      enum: [
        "Item is damaged or defective",
        "Wrong item received",
        "Item is missing parts or accessories",
        "Item does not match the description",
        "Size or fit issue",
        "Changed my mind",
        "Other",
      ],
    },
    details: { type: String, default: "", maxlength: 1000 },
    requestedRefundAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "return_in_transit",
        "received",
        "refund_processing",
        "refunded",
      ],
      default: "pending",
    },
    adminNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One return request per order in this simple implementation.
returnRequestSchema.index(
  { buyerId: 1, orderId: 1 },
  { unique: true }
);

const ReturnRequest =
  mongoose.models.ReturnRequest ||
  mongoose.model("ReturnRequest", returnRequestSchema);

export default ReturnRequest;
