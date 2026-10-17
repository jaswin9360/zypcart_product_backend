import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  sellerId: { type: String, required: true }, // Ties order directly to the merchant
  buyerId: { type: String, required: true },
  buyerName: { type: String, default: "Guest Customer" },
  buyerEmail: { type: String, default: "customer@shopease.com" },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      dealPricePaid: { type: Number, required: true }
    }
  ],
  address: { type: String, required: true },
  paymentMethods: { type: String, required: false },
  couponCode : {type:String ,required: false },
  discountApplied : {type:Number ,required: false },
  DTD :{ type : Date , required: false}, 
  totalAmountPaid: { type: Number, required: true },
  status: { type: String, enum: ['Processing', 'Shipped', 'Delivered'], default: 'Processing' },
  deliveryPartnerId: {
  type: String,
  default: null,
  index: true,
},
cancellationReason: {
  type: String,
  default: "",
  maxlength: 500,
},
cancelledAt: {
  type: Date,
  default: "",
},
deliveryPartnerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'DeliveryPartner',
  default: null,
},
deliveryAssignedAt: {
  type: Date,
  default: "",
},
deliveryStatus: {
  type: String,
  enum: [
    "unassigned",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "cancelled",
  ],
  default: "unassigned",
},
}, { timestamps: true });


export const Order = mongoose.model('Order', orderSchema);