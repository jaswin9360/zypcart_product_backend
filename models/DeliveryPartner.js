import mongoose from 'mongoose';

const deliveryPartnerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryApplication', required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, index: true },
  phone: { type: String, required: true },
  city: { type: String, required: true, index: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true, index: true },
  vehicleType: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  isAvailable: { type: Boolean, default: true, index: true },
  activeDeliveries: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('DeliveryPartner', deliveryPartnerSchema);