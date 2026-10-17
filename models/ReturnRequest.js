
import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Order',
      index: true,
    },

    orderNumber: {
      type: String,
      default: '',
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },

        name: {
          type: String,
          required: true,
          default: 'Product',
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    reason: {
      type: String,
      required: true,
      enum: [
        'Item is damaged or defective',
        'Wrong item received',
        'Item is missing parts or accessories',
        'Item does not match the description',
        'Size or fit issue',
        'Changed my mind',
        'Other',
      ],
    },

    details: {
      type: String,
      default: '',
      maxlength: 1000,
    },

    requestedRefundAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Only one return request per order.
returnRequestSchema.index(
  { buyerId: 1, orderId: 1 },
  { unique: true }
);

const ReturnRequest =
  mongoose.models.ReturnRequest ||
  mongoose.model('ReturnRequest', returnRequestSchema);

export default ReturnRequest;
