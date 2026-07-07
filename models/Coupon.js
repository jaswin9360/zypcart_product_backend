import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    sellerId: { type: String, required: true }, // Keeping as string is safer for cross-server
    sellerName: { type: String, default: 'Store Merchant' }, // <-- ADD THIS LINE
    
    // ... all your other fields ...
    discountType: { type: String, enum: ['FLAT', 'PERCENTAGE'], required: true },
    discountValue: { type: Number, required: true },
    question: { type: String }, 
    answer: { type: String }, 
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], 
    isClaimed: { type: Boolean, default: false },
    claimedBy: { type: String, default: null },
    isRedeemed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    expiryDate: { type: Date, required: true }
}, { timestamps: true });

export const Coupon = mongoose.model('Coupon', couponSchema);