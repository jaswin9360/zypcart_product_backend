import express from 'express';
import mongoose from 'mongoose';
import cron from "node-cron";
import { Order } from '../models/OrderSchema.js';
import { CartItem } from '../models/CartSchema.js';
import { Product } from '../models/schema.js';
import { Coupon } from '../models/Coupon.js';

const router = express.Router();

router.get('/marketplace', async (req, res) => {
  try {
    // Streams back only active listings to the buyer's gallery
    const catalog = await Product.find({ status: 'Active' });
    return res.status(200).json(catalog);
  } catch (err) {
    console.error("Error retrieving global marketplace data:", err);
    return res.status(500).json({ message: 'Error retrieving global marketplace data matrix.' });
  }
});

// ==================================================================
// 2. GET: Specific Seller Dashboard Collection via User ID
// URL: http://localhost:5601/api/products/user-dashboard/:userId
// ==================================================================
router.get('/user-dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userProducts = await Product.find({ userId });
    return res.status(200).json(userProducts);
  } catch (err) {
    console.error("Error retrieving user collection telemetry metrics:", err);
    return res.status(500).json({ message: 'Error retrieving user collection telemetry metrics.' });
  }
});

// ==================================================================
// 3. POST: Deploy and Store New Catalog Product Entry Node
// URL: http://localhost:5601/api/products
// ==================================================================
router.post('/', async (req, res) => {
  try {
    const {
      name, mrpPrice, discountPrice, transactionType, imageUrls,sellerName, stock, userId,
      discountReason, category, specifications
    } = req.body;

    // Core Field Validation Guard
    if (!name || !mrpPrice || !discountPrice || !userId) {
      return res.status(400).json({ message: 'Required fields missing: name, mrpPrice, discountPrice, userId' });
    }

    const newProduct = new Product({
      name,
      category: category || 'Electronics',
      mrpPrice,
      discountPrice,
      transactionType: transactionType || 'sell',
      imageUrls: imageUrls || [],
      stock: stock,
      userId,
      sellerName,
      discountReason: discountReason || "",
      // Saves the array of custom user specifications [{ key, value }] straight to MongoDB
      specifications: specifications || []
    });

    await newProduct.save();
    return res.status(201).json(newProduct);
  } catch (err) {
    console.error("Rejection error processing database payload save:", err);
    return res.status(500).json({ message: 'Failed to deploy product database node payload configuration.' });
  }
});

// ==================================================================
// 4. PUT: Modify Properties of Existing Product Node Target
// URL: http://localhost:5601/api/products/:id
// ==================================================================
router.put('/:id', async (req, res) => {
  const targetId = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: 'Invalid product tracking parameter ID format configuration.' });
    }

    // Handles any update changes to the specifications array or promotional override values dynamically
    const updatedProduct = await Product.findByIdAndUpdate(
      targetId,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Target product registry reference context parameters not found.' });
    }

    return res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error updating tracking data matrix parameters:", error);
    return res.status(500).json({ message: 'Internal Server Error saving structural data shifts.' });
  }
});

// ==================================================================
// 5. DELETE: Permanent Clearance Execution From Datastore
// URL: http://localhost:5601/api/products/:id
// ==================================================================
router.delete('/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid dynamic clearance path assignment ID format.' });
    }

    const deletedProduct = await Product.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product reference key pointer not found in database registry.' });
    }

    return res.status(200).json({
      success: true,
      message: `Product "${deletedProduct.name}" successfully removed.`
    });
  } catch (error) {
    console.error("Backend pipeline failure during deletion:", error);
    return res.status(500).json({ message: 'Internal server error executing data array removal pipeline.' });
  }
});



// ==================================================================
// POST: Deploy and Store New Catalog Product Entry Node (With 10 Items Cap)
// URL: http://localhost:5601/api/products
// ==================================================================
router.post('/', async (req, res) => {
  try {
    const { name, mrpPrice, discountPrice, userId } = req.body;

    if (!name || !mrpPrice || !discountPrice || !userId) {
      return res.status(400).json({ message: 'Required fields missing: name, mrpPrice, discountPrice, userId' });
    }

    // 🌟 COUNT ENFORCEMENT GUARD RULE: Limit maximum 10 items per unique seller user
    const existingUserItemsCount = await Product.countDocuments({ userId });
    if (existingUserItemsCount >= 10) {
      return res.status(400).json({
        message: 'Inventory limit reached! A single user registry cannot exceed 10 active database catalog nodes simultaneously.'
      });
    }

    const newProduct = new Product({
      ...req.body,
      createdAt: new Date() // Sets explicit timestamp marker for accurate TTL down-counting
    });

    await newProduct.save();
    return res.status(201).json(newProduct);
  } catch (err) {
    console.error("Payload execution tracking error:", err);
    return res.status(500).json({ message: 'Failed to deploy product database node.' });
  }
});


// 1. POST: Process Secure Checkout Pipeline Transaction
router.post('/orders/checkout', async (req, res) => {
  try {
  
    const { userId, buyerName, buyerEmail, cartItems, DTD, address ,couponCode,discountApplied,paymentMethods } = req.body;

    // 1. Basic Validation
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cannot process an empty checkout matrix.' });
    }

    // Optional but recommended: Ensure address exists
    if (!address) {
      return res.status(400).json({ message: 'Shipping address is required to place an order.' });
    }

    const itemsBySeller = {};
    cartItems.forEach(item => {
      const sellerId = item.userId;
      if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];
      itemsBySeller[sellerId].push({
        productId: item._id,
        name: item.name,
        quantity: Number(item.quantity),
        dealPricePaid: Number(item.discountPrice)
      });
    });

    for (const sellerId in itemsBySeller) {
      const vendorItems = itemsBySeller[sellerId];
      const totalAmountPaid = vendorItems.reduce((sum, i) => sum + (i.dealPricePaid * i.quantity), 0);

      // Decrement stock and Increment ordersCount atomically FIRST
      for (const item of vendorItems) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { ordersCount: item.quantity, stock: -item.quantity } },
          { returnDocument: 'after' }
        );

        if (!updated) {
          // Note: Added status(400) back here so your frontend catch block works properly!
          return res.status(400).json({
            message: `Item '${item.name}' is out of stock or does not have enough units available.`
          });
        }
      }

      // ONLY save the order AFTER all items have been verified
      const newOrder = new Order({
        sellerId,
        buyerId: userId,
        buyerName,
        buyerEmail,
        address,       // <--- ADDED HERE
        DTD,           // <--- ADDED HERE
        items: vendorItems,
        totalAmountPaid,
        couponCode,
        discountApplied,
        paymentMethods
      });

      await newOrder.save();
      if (couponCode) {
            await Coupon.findOneAndUpdate(
                { code: couponCode.toUpperCase() },
                { $set: { isRedeemed: true } }
            );
        }
    }

    await CartItem.deleteMany({ userId });
    return res.status(201).json({ success: true, message: 'processed successfully.' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal transaction checkpoint breakdown failure.' });
  }
});

// PUT /api/products/orders/pay/:orderId
router.put('/orders/checkout/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentMethod, paymentStatus ,status} = req.body;
        console.log(paymentMethod,paymentStatus)

        // Find the order and update the payment details
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { 
                $set: { 
                    paymentMethods: paymentMethod, 
                    paymentStatus: paymentStatus ,
                    status:status
                } 
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error updating payment" });
    }
});


// 2. GET: Stream live order records belonging to a merchant dashboard
router.get('/orders/seller/:sellerId', async (req, res) => {
  try {
    const records = await Order.find({ sellerId: req.params.sellerId }).sort({ createdAt: -1 });
    return res.status(200).json(records);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to extract vendor telemetry datasets.' });
  }
});

router.get('/orders/buyer/:buyerId', async (req, res) => {
  try {
    const records = await Order.find({ buyerId: req.params.buyerId }).sort({ createdAt: -1 });
    return res.status(200).json(records);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to extract vendor telemetry datasets.' });
  }
});



cron.schedule('0 0 * * *', async () => {
  console.log('⏳ Running automated delivery status check...');

  try {
    const rightNow = new Date();

    // Find all orders where the Delivery Date is TODAY or in the PAST
    // AND the status is not already 'success'
    const result = await Order.updateMany(
      { 
        DTD: { $lte: rightNow }, 
        status: { $ne: 'success' } 
      },
      { 
        $set: { status: 'success' } 
      }
    );

    console.log(`✅ Automation Complete: Updated ${result.modifiedCount} orders to 'success'.`);
  } catch (error) {
    console.error('❌ Automation Error:', error);
  }
});


export default router;