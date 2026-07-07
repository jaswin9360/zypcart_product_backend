import express from 'express';
import { CartItem } from '../models/CartSchema.js';

const router = express.Router();

// 1. GET: Fetch user's cart items with full product details populated
router.get('/:userId', async (req, res) => {
  try {
    const userCart = await CartItem.find({ userId: req.params.userId }).populate('productId');
    return res.status(200).json(userCart);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve your cart selections.' });
  }
});

// 2. POST: Add product to cart (Enforces max 10 distinct products rule)
router.post('/', async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    console.log("Received cart addition request:", { userId, productId, quantity });

    // Check if user already has 10 distinct items in their cart
    const distinctItemCount = await CartItem.countDocuments({ userId });
    if (distinctItemCount >= 10) {
      return res.status(400).json({ message: 'Cart full! You can only store up to 10 distinct products in your basket.' });
    }

    // Upsert mechanism: update quantity if it exists, otherwise create fresh with a new TTL clock
    const cartItem = await CartItem.findOneAndUpdate(
      { userId, productId },
      { $set: { quantity }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    return res.status(201).json(cartItem);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to sync item to your database cart.' });
  }
});

// 3. DELETE: Remove single item completely from user's cart
router.delete('/:userId/:productId', async (req, res) => {
  try {
    await CartItem.deleteOne({ userId: req.params.userId, productId: req.params.productId });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete item from cart.' });
  }
});

router.post('/transaction/respond', async (req, res) => {
  const { txId, status } = req.body; // status: "CONFIRMED" or "CANCELLED"

  if (status === 'CONFIRMED') {
    // 1. Validate transaction exists
    // 2. Deduct money from user wallet
    // 3. Update database status
    return res.status(200).json({ message: "Payment Successful" });
  } else {
    // Handle cancellation
    return res.status(200).json({ message: "Payment Cancelled" });
  }
});

export default router;