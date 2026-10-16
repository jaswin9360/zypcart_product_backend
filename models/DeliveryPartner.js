import mongoose from 'mongoose';

const deliveryPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['deliveryPartner'], default: 'deliveryPartner' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryApplication', default: null },
  phone: { type: String, default: '' },
  city: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  vehicleType: { type: String, default: '' },
  isAvailable: { type: Boolean, default: false },
  activeDeliveries: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.DeliveryPartner || mongoose.model('DeliveryPartner', deliveryPartnerSchema);