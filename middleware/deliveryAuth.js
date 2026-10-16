import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import DeliveryPartner from '../models/DeliveryPartner.js';

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, message: 'Please log in.' });
    if (!process.env.JWT_SECRET) return res.status(500).json({ success: false, message: 'Authentication is not configured.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Delivery-partner accounts live in their own collection, separate from store users.
    if (['deliveryPartner', 'delivery_partner'].includes(decoded.role)) {
      const partner = await DeliveryPartner.findById(decoded.sub).select('_id name email role status application phone city address pincode vehicleType isAvailable activeDeliveries');
      if (!partner) return res.status(401).json({ success: false, message: 'Delivery partner account not found.' });
      req.user = { ...partner.toObject(), _id: partner._id, role: 'deliveryPartner' };
      req.deliveryPartner = partner;
      return next();
    }

    const user = await User.findById(decoded.sub).select('_id username name email role isAdmin');
    if (!user) return res.status(401).json({ success: false, message: 'Account not found.' });
    req.user = user;
    next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError'].includes(error.name)) {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    next(error);
  }
}

export function requireDeliveryPartner(req, res, next) {
  if (!['deliveryPartner', 'delivery_partner'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Delivery partner account required.' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.isAdmin !== true) {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }
  next();
}