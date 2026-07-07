import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  category: { 
    type: String, 
    required: true, 
    enum: ['Electronics', 'Accessories', 'Fashion', 'Home Decor', 'electronics', 'accessories', 'fashion', 'home & living'], 
    default: 'Electronics' 
  },
  mrpPrice: { 
    type: Number, 
    required: true 
  },
  discountPrice: { 
    type: Number, 
    required: true 
  },
  transactionType: { 
    type: String, 
    enum: ['sell', 'buy'], 
    default: 'sell' 
  },
  imageUrls: [{ 
    type: String 
  }], 
  stock: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  ordersCount: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Draft'], 
    default: 'Active' 
  },
  userId: { 
    type: String, 
    required: true 
  },
  sellerName: { 
    type: String, 
  },
  discountReason: { 
    type: String, 
    default: "" // Keeps standard text tags for campaign notes (e.g., "Diwali Offer")
  },


  // ==================================================================
  // INFINITE EXTENDABLE SPECIFICATIONS MATRIX
  // ==================================================================
  specifications: [
    {
      key: { type: String, trim: true },   // User entered Label (e.g., "Fabric", "Camera")
      value: { type: String, trim: true }  // User entered Detail (e.g., "100% Cotton", "48MP")
    }
  ],

  
},
{ timestamps: true }); // Automatically manages 'createdAt' and 'updatedAt'

export const Product = mongoose.model('Product', productSchema);