import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  path: { type: String, required: true },
}, { _id: false });

const deliveryApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  pincode: { type: String, required: true, trim: true, maxlength: 12 },
  vehicleType: { type: String, enum: ['Bike', 'Scooter', 'Bicycle', 'Car', 'Other'], required: true },
  licenseNumber: { type: String, default: '', trim: true, maxlength: 50 },
  experience: { type: String, default: '' },
  availability: { type: String, default: 'Full-time' },
  message: { type: String, default: '', maxlength: 1000 },
  documents: { type: [documentSchema], default: [] },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  reviewNote: { type: String, default: '', maxlength: 500 },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('DeliveryApplication', deliveryApplicationSchema);