import jwt from 'jsonwebtoken';
import User from '../models/User.js'; // Change this path to your existing User model.

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, message: 'Please log in.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub).select('_id name email role');
    if (!user) return res.status(401).json({ success: false, message: 'Account not found.' });
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    next(error);
  }
}

export function requireDeliveryPartner(req, res, next) {
  if (req.user?.role !== 'delivery_partner') {
    return res.status(403).json({ success: false, message: 'Delivery partner account required.' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }
  next();
}