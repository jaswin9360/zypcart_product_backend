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
        const { paymentMethods, paymentStatus ,status} = req.body;
        console.log(paymentMethods,paymentStatus)

        // Find the order and update the payment details
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { 
                $set: { 
                    paymentMethods: paymentMethods, 
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




/* ============================================================
   POST: CANCEL AN ORDER
   URL: /api/products/orders/:orderId/cancel
   ============================================================ */

router.post("/orders/:orderId/cancel", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { buyerId, reason = "Cancelled by customer" } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(buyerId || "")
    ) {
      return res.status(400).json({
        message: "Valid order ID and buyer ID are required.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (String(order.buyerId) !== String(buyerId)) {
      return res.status(403).json({
        message: "You cannot cancel another buyer's order.",
      });
    }

    const status = String(order.status || "")
      .toLowerCase()
      .replace(/[_-]/g, " ");

    const deliveryStatus = String(order.deliveryStatus || "")
      .toLowerCase()
      .replace(/[_-]/g, " ");

    const blockedStatuses = [
      "cancelled",
      "canceled",
      "delivered",
      "success",
      "completed",
      "shipped",
      "dispatched",
      "out for delivery",
      "in transit",
      "picked up",
      "returned",
    ];

    if (
      blockedStatuses.includes(status) ||
      blockedStatuses.includes(deliveryStatus)
    ) {
      return res.status(400).json({
        message: "This order can no longer be cancelled.",
      });
    }

    // Prevent duplicate cancellation and restore stock only
    // when this request successfully changes the order status.
    const cancelledOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        buyerId,
        status: { $nin: [
          "Cancelled", "Canceled", "Delivered", "Success",
          "Completed", "Shipped", "Dispatched",
        ] },
        deliveryStatus: { $nin: [
          "cancelled", "delivered", "picked_up", "in_transit",
        ] },
      },
      {
        $set: {
          status: "Cancelled",
          deliveryStatus: "cancelled",
          cancellationReason: String(reason).slice(0, 500),
          cancelledAt: new Date(),
        },
      },
      { new: true }
    );

    if (!cancelledOrder) {
      return res.status(409).json({
        message: "Order status changed or the order was already cancelled.",
      });
    }

    // Restore inventory for this order.
    // If restoration fails, log it for reconciliation.
    try {
      for (const item of cancelledOrder.items || []) {
        const quantity = Number(item.quantity || 0);

        if (
          !item.productId ||
          !mongoose.Types.ObjectId.isValid(String(item.productId)) ||
          !Number.isInteger(quantity) ||
          quantity <= 0
        ) {
          throw new Error("Invalid order item; inventory needs review.");
        }

        const restoredProduct = await Product.findByIdAndUpdate(
          item.productId,
          {
            $inc: {
              stock: quantity,
              ordersCount: -quantity,
            },
          },
          { new: true }
        );

        if (!restoredProduct) {
          throw new Error(
            `Product ${item.productId} not found during stock restoration.`
          );
        }
      }
    } catch (inventoryError) {
      console.error(
        "Order cancelled, but inventory restoration needs reconciliation:",
        orderId,
        inventoryError
      );

      return res.status(500).json({
        message:
          "Order was cancelled, but inventory restoration needs administrator attention.",
        orderCancelled: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      order: cancelledOrder,
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    return res.status(500).json({
      message: "Server error while cancelling the order.",
    });
  }
});


/* ============================================================
   POST: SUBMIT A RETURN REQUEST
   URL: /api/products/orders/return-request
   ============================================================ */

router.post("/orders/return-request", async (req, res) => {
  try {
    const {
      buyerId,
      orderId,
      items,
      reason,
      details = "",
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(buyerId || "") ||
      !mongoose.Types.ObjectId.isValid(orderId || "")
    ) {
      return res.status(400).json({
        message: "Valid buyer ID and order ID are required.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Select at least one item to return.",
      });
    }

    const allowedReasons = [
      "Item is damaged or defective",
      "Wrong item received",
      "Item is missing parts or accessories",
      "Item does not match the description",
      "Size or fit issue",
      "Changed my mind",
      "Other",
    ];

    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({
        message: "Invalid return reason.",
      });
    }

    if (typeof details !== "string" || details.length > 1000) {
      return res.status(400).json({
        message: "Additional details cannot exceed 1000 characters.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (String(order.buyerId) !== String(buyerId)) {
      return res.status(403).json({
        message: "You cannot return items from another buyer's order.",
      });
    }

    if (String(order.status || "").toLowerCase() !== "delivered") {
      return res.status(400).json({
        message: "Returns are available only after delivery.",
      });
    }

    const deliveredDate =
      order.deliveredAt || order.updatedAt || order.DTD;

    const deliveredAt = deliveredDate
      ? new Date(deliveredDate)
      : null;

    if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
      return res.status(400).json({
        message: "A valid delivery date is required to verify eligibility.",
      });
    }

    const age = Date.now() - deliveredAt.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (age < 0 || age > sevenDays) {
      return res.status(400).json({
        message:
          age < 0
            ? "The delivery date is in the future."
            : "The 7-day return window has ended.",
      });
    }

    const existingRequest = await ReturnRequest.findOne({
      buyerId,
      orderId,
    });

    if (existingRequest) {
      return res.status(409).json({
        message: "A return request already exists for this order.",
        returnRequest: existingRequest,
      });
    }

    // Validate product IDs, quantities and prices against the order.
    const usedLines = new Set();
    const verifiedItems = [];

    for (const requestedItem of items) {
      const quantity = Number(requestedItem.quantity);
      const productId = String(requestedItem.productId || "");

      if (
        !mongoose.Types.ObjectId.isValid(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message: "Invalid return product or quantity.",
        });
      }

      const itemIndex = (order.items || []).findIndex(
        (original, index) =>
          !usedLines.has(index) &&
          String(original.productId || "") === productId
      );

      if (itemIndex === -1) {
        return res.status(400).json({
          message: "A selected product does not belong to this order.",
        });
      }

      const originalItem = order.items[itemIndex];

      if (quantity > Number(originalItem.quantity || 0)) {
        return res.status(400).json({
          message: `Return quantity exceeds the purchased quantity for ${
            originalItem.name || "this product"
          }.`,
        });
      }

      const unitPrice = Number(
        originalItem.dealPricePaid ?? originalItem.price ?? 0
      );

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          message: "Unable to verify the original product price.",
        });
      }

      usedLines.add(itemIndex);

      verifiedItems.push({
        productId: originalItem.productId,
        name: originalItem.name || "Product",
        quantity,
        unitPrice,
      });
    }

    // Never trust a refund amount calculated by the frontend.
    const requestedRefundAmount = verifiedItems.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0
    );

    const returnRequest = await ReturnRequest.create({
      buyerId,
      orderId,
      orderNumber: String(
        order.orderId || order.orderNumber || order._id
      ),
      items: verifiedItems,
      reason,
      details: details.trim(),
      requestedRefundAmount,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Your return request has been submitted successfully.",
      returnRequest,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A return request already exists for this order.",
      });
    }

    console.error("Submit return request error:", error);

    return res.status(500).json({
      message: "Server error while submitting the return request.",
    });
  }
});


/* ============================================================
   GET: VIEW A BUYER'S RETURN REQUESTS
   URL: /api/products/orders/return-requests/buyer/:buyerId
   ============================================================ */

router.get(
  "/orders/return-requests/buyer/:buyerId",
  async (req, res) => {
    try {
      const { buyerId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(buyerId)) {
        return res.status(400).json({
          message: "Invalid buyer ID.",
        });
      }

      const requests = await ReturnRequest.find({ buyerId })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(requests);
    } catch (error) {
      console.error("Get return requests error:", error);

      return res.status(500).json({
        message: "Unable to load return requests.",
      });
    }
  }
);


export default router;