import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import DeliveryPartner from '../models/DeliveryPartner.js';
import DeliveryApplication from '../models/DeliveryApplication.js';
import { auth, requireDeliveryPartner } from '../middleware/deliveryAuth.js';

const router = express.Router();
function issueToken(partner) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: partner._id.toString(), role: 'deliveryPartner' }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function publicPartner(partner) {
  return { id: partner._id, name: partner.name, email: partner.email, role: 'deliveryPartner', status: partner.status };
}

router.post('/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    if (!fullName || !email || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Enter your full name, a valid email, and a password of at least 8 characters.' });
    }
    if (!process.env.JWT_SECRET) return res.status(500).json({ success: false, message: 'Server authentication is not configured.' });
    if (await DeliveryPartner.findOne({ email })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    const partner = await DeliveryPartner.create({ name: fullName, email, password: await bcrypt.hash(password, 12), role: 'deliveryPartner' });
    return res.status(201).json({ success: true, message: 'Account created. Complete your delivery partner application.', token: issueToken(partner), user: publicPartner(partner) });
  } catch (error) {
    console.error('Delivery registration error:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.code === 11000 ? 'An account with this email already exists.' : 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    if (!email || typeof password !== 'string') return res.status(400).json({ success: false, message: 'Email and password are required.' });
    const partner = await DeliveryPartner.findOne({ email }).select('+password');
    if (!partner || !(await bcrypt.compare(password, partner.password))) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    return res.json({ success: true, message: 'Signed in successfully.', token: issueToken(partner), user: publicPartner(partner) });
  } catch (error) {
    console.error('Delivery login error:', error);
    return res.status(500).json({ success: false, message: 'Unable to sign in. Please try again.' });
  }
});

router.get('/me', auth, requireDeliveryPartner, async (req, res, next) => {
  try {
    const partner = await DeliveryPartner.findById(req.user._id).select('-password');
    const application = await DeliveryApplication.findOne({ userId: partner._id }).select('-documents.path').lean();
    res.json({ success: true, user: publicPartner(partner), partner: publicPartner(partner), application, status: application?.status || partner.status || 'Not applied' });
  } catch (error) { next(error); }
});

export default router;