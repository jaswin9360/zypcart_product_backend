
import express from 'express';
import mongoose from 'mongoose';
import cron from 'node-cron';

import { Order } from '../models/OrderSchema.js';
import { CartItem } from '../models/CartSchema.js';
import { Product } from '../models/schema.js';
import { Coupon } from '../models/Coupon.js';
import ReturnRequest from '../models/ReturnRequest.js';

const router = express.Router();

const INVENTORY_LIMIT = 10;
const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(String(id || ''));

const normalizeStatus = (status) =>
  String(status || '').toLowerCase().replace(/[_-]/g, ' ').trim();

const DELIVERED_STATUSES = [
  'delivered',
  'success',
  'completed',
];

const RETURN_REASONS = [
  'Item is damaged or defective',
  'Wrong item received',
  'Item is missing parts or accessories',
  'Item does not match the description',
  'Size or fit issue',
  'Changed my mind',
  'Other',
];

// ============================================================
// GET: Marketplace products
// GET /api/products/marketplace
// ============================================================

router.get('/marketplace', async (req, res) => {
  try {
    const products = await Product.find({ status: 'Active' }).lean();
    return res.status(200).json(products);
  } catch (error) {
    console.error('Marketplace error:', error);
    return res.status(500).json({
      message: 'Failed to load marketplace products.',
    });
  }
});

// ============================================================
// GET: Products belonging to a seller
// GET /api/products/user-dashboard/:userId
// ============================================================

router.get('/user-dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid seller ID.' });
    }

    const products = await Product.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    console.error('Seller products error:', error);
    return res.status(500).json({
      message: 'Failed to load seller products.',
    });
  }
});

// ============================================================
// POST: Create product with a maximum of 10 products per seller
// POST /api/products
// ============================================================

router.post('/', async (req, res) => {
  try {
    const {
      name,
      mrpPrice,
      discountPrice,
      transactionType,
      imageUrls,
      sellerName,
      stock,
      userId,
      discountReason,
      category,
      specifications,
    } = req.body;

    if (
      !name ||
      mrpPrice === undefined ||
      discountPrice === undefined ||
      !userId
    ) {
      return res.status(400).json({
        message: 'name, mrpPrice, discountPrice and userId are required.',
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid seller ID.' });
    }

    const parsedMrp = Number(mrpPrice);
    const parsedDiscount = Number(discountPrice);
    const parsedStock = Number(stock ?? 0);

    if (
      !Number.isFinite(parsedMrp) ||
      !Number.isFinite(parsedDiscount) ||
      parsedMrp < 0 ||
      parsedDiscount < 0 ||
      parsedDiscount > parsedMrp
    ) {
      return res.status(400).json({
        message: 'Enter valid prices. Discount price cannot exceed MRP.',
      });
    }

    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({
        message: 'Stock must be a non-negative whole number.',
      });
    }

    const existingCount = await Product.countDocuments({ userId });

    if (existingCount >= INVENTORY_LIMIT) {
      return res.status(400).json({
        message: 'Inventory limit reached. A seller can add up to 10 products.',
      });
    }

    const product = new Product({
      name: name.trim(),
      category: category || 'Electronics',
      mrpPrice: parsedMrp,
      discountPrice: parsedDiscount,
      transactionType: transactionType || 'sell',
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      stock: parsedStock,
      userId,
      sellerName,
      discountReason: discountReason || '',
      specifications: Array.isArray(specifications) ? specifications : [],
      createdAt: new Date(),
    });

    await product.save();

    return res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      message: 'Failed to create product.',
    });
  }
});

// ============================================================
// PUT: Update product
// PUT /api/products/:id
// ============================================================

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    return res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      message: 'Failed to update product.',
    });
  }
});

// ============================================================
// DELETE: Delete product
// DELETE /api/products/:id
// ============================================================

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Product "${deletedProduct.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      message: 'Failed to delete product.',
    });
  }
});

// ============================================================
// POST: Checkout
// POST /api/products/orders/checkout
// ============================================================

router.post('/orders/checkout', async (req, res) => {
  try {
    const {
      userId,
      buyerName,
      buyerEmail,
      cartItems,
      DTD,
      address,
      couponCode,
      discountApplied,
      paymentMethods,
    } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Valid buyer ID is required.' });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty.' });
    }

    if (!address) {
      return res.status(400).json({ message: 'Shipping address is required.' });
    }

    // Group items by seller.
    const itemsBySeller = new Map();

    for (const item of cartItems) {
      const sellerId = String(item.userId || '');
      const productId = String(item._id || item.productId || '');
      const quantity = Number(item.quantity);

      if (
        !isValidObjectId(sellerId) ||
        !isValidObjectId(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message: 'Cart contains an invalid product, seller, or quantity.',
        });
      }

      if (!itemsBySeller.has(sellerId)) {
        itemsBySeller.set(sellerId, []);
      }

      itemsBySeller.get(sellerId).push({ productId, quantity });
    }

    // Validate all products and reserve stock before saving orders.
    // A database transaction is preferable for full multi-seller atomicity.
    const reserved = [];
    const ordersToSave = [];

    try {
      for (const [sellerId, items] of itemsBySeller.entries()) {
        const orderItems = [];

        for (const cartItem of items) {
          const product = await Product.findOneAndUpdate(
            {
              _id: cartItem.productId,
              userId: sellerId,
              stock: { $gte: cartItem.quantity },
              status: { $ne: 'Inactive' },
            },
            {
              $inc: {
                stock: -cartItem.quantity,
                ordersCount: cartItem.quantity,
              },
            },
            { new: true }
          );

          if (!product) {
            throw new Error(
              `Product ${cartItem.productId} is unavailable or has insufficient stock.`
            );
          }

          reserved.push({
            productId: product._id,
            quantity: cartItem.quantity,
          });

          orderItems.push({
            productId: product._id,
            name: product.name,
            quantity: cartItem.quantity,
            dealPricePaid: Number(product.discountPrice),
          });
        }

        const totalAmountPaid = orderItems.reduce(
          (sum, item) => sum + item.dealPricePaid * item.quantity,
          0
        );

        ordersToSave.push(
          new Order({
            sellerId,
            buyerId: userId,
            buyerName,
            buyerEmail,
            address,
            DTD,
            items: orderItems,
            totalAmountPaid,
            couponCode,
            discountApplied,
            paymentMethods,
          })
        );
      }

      await Order.insertMany(ordersToSave);
    } catch (checkoutError) {
      // Restore inventory if reservation or order insertion fails.
      for (const reservation of reserved) {
        await Product.findByIdAndUpdate(reservation.productId, {
          $inc: {
            stock: reservation.quantity,
            ordersCount: -reservation.quantity,
          },
        }).catch((restoreError) => {
          console.error('Inventory rollback error:', restoreError);
        });
      }

      throw checkoutError;
    }

    if (couponCode) {
      await Coupon.findOneAndUpdate(
        { code: String(couponCode).toUpperCase() },
        { $set: { isRedeemed: true } }
      );
    }

    await CartItem.deleteMany({ userId });

    return res.status(201).json({
      success: true,
      message: 'Checkout completed successfully.',
      orders: ordersToSave,
    });
  } catch (error) {
    console.error('Checkout error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Checkout failed.',
    });
  }
});

// ============================================================
// PUT: Update checkout/payment status
// PUT /api/products/orders/checkout/:orderId
// ============================================================

router.put('/orders/checkout/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethods, paymentStatus, status } = req.body;

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const updates = {};

    if (paymentMethods !== undefined) updates.paymentMethods = paymentMethods;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (status !== undefined) updates.status = status;

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Update payment/order error:', error);
    return res.status(500).json({
      message: 'Server error updating payment or order.',
    });
  }
});

// ============================================================
// GET: Seller orders
// GET /api/products/orders/seller/:sellerId
// ============================================================

router.get('/orders/seller/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!isValidObjectId(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID.' });
    }

    const orders = await Order.find({ sellerId }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('Seller orders error:', error);
    return res.status(500).json({ message: 'Failed to load seller orders.' });
  }
});

// ============================================================
// GET: Buyer orders
// GET /api/products/orders/buyer/:buyerId
// ============================================================

router.get('/orders/buyer/:buyerId', async (req, res) => {
  try {
    const { buyerId } = req.params;

    if (!isValidObjectId(buyerId)) {
      return res.status(400).json({ message: 'Invalid buyer ID.' });
    }

    const orders = await Order.find({ buyerId }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('Buyer orders error:', error);
    return res.status(500).json({ message: 'Failed to load buyer orders.' });
  }
});

// ============================================================
// CRON: Mark orders delivered when their DTD has passed
// ============================================================

cron.schedule('0 0 * * *', async () => {
  console.log('Running delivery status check...');

  try {
    const result = await Order.updateMany(
      {
        DTD: { $lte: new Date() },
        status: { $nin: ['success', 'delivered', 'Delivered', 'Cancelled', 'Canceled'] },
      },
      {
        $set: {
          status: 'success',
          deliveryStatus: 'delivered',
          deliveredAt: new Date(),
        },
      }
    );

    console.log(`Delivery status check complete: ${result.modifiedCount} orders updated.`);
  } catch (error) {
    console.error('Delivery status cron error:', error);
  }
});

// ============================================================
// POST: Cancel an order
// POST /api/products/orders/:orderId/cancel
// ============================================================

router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { buyerId, reason = 'Cancelled by customer' } = req.body;

    if (!isValidObjectId(orderId) || !isValidObjectId(buyerId)) {
      return res.status(400).json({
        message: 'Valid order ID and buyer ID are required.',
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (String(order.buyerId) !== String(buyerId)) {
      return res.status(403).json({
        message: 'You cannot cancel another buyer’s order.',
      });
    }

    const blockedStatuses = [
      'cancelled',
      'canceled',
      'delivered',
      'success',
      'completed',
      'shipped',
      'dispatched',
      'out for delivery',
      'in transit',
      'picked up',
      'returned',
    ];

    if (
      blockedStatuses.includes(normalizeStatus(order.status)) ||
      blockedStatuses.includes(normalizeStatus(order.deliveryStatus))
    ) {
      return res.status(400).json({
        message: 'This order can no longer be cancelled.',
      });
    }

    const cancelledOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        buyerId,
        status: { $nin: ['Cancelled', 'Canceled', 'Delivered', 'Success', 'Completed', 'Shipped', 'Dispatched'] },
      },
      {
        $set: {
          status: 'Cancelled',
          deliveryStatus: 'cancelled',
          cancellationReason: String(reason).slice(0, 500),
          cancelledAt: new Date(),
        },
      },
      { new: true }
    );

    if (!cancelledOrder) {
      return res.status(409).json({
        message: 'Order status changed or the order was already cancelled.',
      });
    }

    try {
      for (const item of cancelledOrder.items || []) {
        const quantity = Number(item.quantity || 0);

        if (
          !item.productId ||
          !isValidObjectId(item.productId) ||
          !Number.isInteger(quantity) ||
          quantity <= 0
        ) {
          throw new Error('Invalid order item; inventory needs review.');
        }

        const product = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: quantity, ordersCount: -quantity } },
          { new: true }
        );

        if (!product) {
          throw new Error(`Product ${item.productId} was not found.`);
        }
      }
    } catch (inventoryError) {
      console.error('Inventory restoration error:', inventoryError);
      return res.status(500).json({
        message: 'Order cancelled, but inventory restoration needs administrator attention.',
        orderCancelled: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
      order: cancelledOrder,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      message: 'Server error while cancelling the order.',
    });
  }
});

// ============================================================
// POST: Submit a return request
// POST /api/products/orders/return-request
// ============================================================

router.post('/orders/return-request', async (req, res) => {
  try {
    const {
      buyerId,
      orderId,
      items,
      reason,
      details = '',
    } = req.body;

    if (!isValidObjectId(buyerId) || !isValidObjectId(orderId)) {
      return res.status(400).json({
        message: 'Valid buyer ID and order ID are required.',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Select at least one item to return.',
      });
    }

    if (!RETURN_REASONS.includes(reason)) {
      return res.status(400).json({ message: 'Invalid return reason.' });
    }

    if (typeof details !== 'string' || details.length > 1000) {
      return res.status(400).json({
        message: 'Additional details cannot exceed 1000 characters.',
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (String(order.buyerId) !== String(buyerId)) {
      return res.status(403).json({
        message: 'You cannot return items from another buyer’s order.',
      });
    }

    // Your existing delivery automation uses "success" for delivered orders.
    const orderStatus = normalizeStatus(order.status);
    const deliveryStatus = normalizeStatus(order.deliveryStatus);

    if (
      !DELIVERED_STATUSES.includes(orderStatus) &&
      !DELIVERED_STATUSES.includes(deliveryStatus)
    ) {
      return res.status(400).json({
        message: 'Returns are available only after delivery.',
      });
    }

    const deliveredDate =
      order.deliveredAt ||
      (deliveryStatus === 'delivered' ? order.updatedAt : null) ||
      (orderStatus === 'delivered' || orderStatus === 'success'
        ? order.updatedAt
        : null);

    const deliveredAt = deliveredDate ? new Date(deliveredDate) : null;

    if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
      return res.status(400).json({
        message: 'A valid delivery date is required to verify return eligibility.',
      });
    }

    const age = Date.now() - deliveredAt.getTime();

    if (age < 0) {
      return res.status(400).json({
        message: 'The delivery date is in the future.',
      });
    }

    if (age > RETURN_WINDOW_MS) {
      return res.status(400).json({
        message: 'The 7-day return window has ended.',
      });
    }

    const existingRequest = await ReturnRequest.findOne({ buyerId, orderId });

    if (existingRequest) {
      return res.status(409).json({
        message: 'A return request already exists for this order.',
        returnRequest: existingRequest,
      });
    }

    const usedLines = new Set();
    const verifiedItems = [];

    for (const requestedItem of items) {
      const productId = String(requestedItem.productId || '');
      const quantity = Number(requestedItem.quantity);

      if (
        !isValidObjectId(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message: 'Invalid return product or quantity.',
        });
      }

      const itemIndex = (order.items || []).findIndex(
        (original, index) =>
          !usedLines.has(index) &&
          String(original.productId || '') === productId
      );

      if (itemIndex === -1) {
        return res.status(400).json({
          message: 'A selected product does not belong to this order.',
        });
      }

      const originalItem = order.items[itemIndex];
      const purchasedQuantity = Number(originalItem.quantity || 0);

      if (quantity > purchasedQuantity) {
        return res.status(400).json({
          message: `Return quantity exceeds the purchased quantity for ${originalItem.name || 'this product'}.`,
        });
      }

      const unitPrice = Number(
        originalItem.dealPricePaid ?? originalItem.price ?? 0
      );

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          message: 'Unable to verify the original product price.',
        });
      }

      usedLines.add(itemIndex);

      verifiedItems.push({
        productId: originalItem.productId,
        name: originalItem.name || 'Product',
        quantity,
        unitPrice,
      });
    }

    // Calculate the refund from trusted order data, not the client request.
    const requestedRefundAmount = verifiedItems.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0
    );

    const returnRequest = await ReturnRequest.create({
      buyerId,
      orderId,
      orderNumber: String(order.orderId || order.orderNumber || order._id),
      items: verifiedItems,
      reason,
      details: details.trim(),
      requestedRefundAmount,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Your return request has been submitted successfully.',
      returnRequest,
    });
  } catch (error) {
    console.error('RETURN REQUEST ERROR:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A return request already exists for this order.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Return request validation failed.',
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create return request.',
    });
  }
});

// ============================================================
// GET: View a buyer's return requests
// GET /api/products/orders/return-requests/buyer/:buyerId
// ============================================================

router.get('/orders/return-requests/buyer/:buyerId', async (req, res) => {
  try {
    const { buyerId } = req.params;

    if (!isValidObjectId(buyerId)) {
      return res.status(400).json({ message: 'Invalid buyer ID.' });
    }

    const requests = await ReturnRequest.find({ buyerId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(requests);
  } catch (error) {
    console.error('Get return requests error:', error);
    return res.status(500).json({
      message: 'Unable to load return requests.',
    });
  }
});



router.put('/orders/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryStatus } = req.body;

    // Validate order ID
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    // Require at least one status field
    if (status === undefined && deliveryStatus === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide status or deliveryStatus.'
      });
    }

    const updates = {};

    // Validate the order status against the actual schema enum
    if (status !== undefined) {
      if (typeof status !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Status must be a string.'
        });
      }

      const allowedStatuses =
        Order.schema.path('status')?.enumValues ?? [];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid order status.',
          allowedStatuses
        });
      }

      updates.status = status;
    }

    // Validate deliveryStatus only if this field exists in your schema
    if (deliveryStatus !== undefined) {
      if (typeof deliveryStatus !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Delivery status must be a string.'
        });
      }

      const deliveryStatusPath =
        Order.schema.path('deliveryStatus');

      if (!deliveryStatusPath) {
        return res.status(400).json({
          success: false,
          message:
            'deliveryStatus is not defined in the Order schema.'
        });
      }

      const allowedDeliveryStatuses =
        deliveryStatusPath.enumValues ?? [];

      if (
        allowedDeliveryStatuses.length > 0 &&
        !allowedDeliveryStatuses.includes(deliveryStatus)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid delivery status.',
          allowedDeliveryStatuses
        });
      }

      updates.deliveryStatus = deliveryStatus;
    }

    // Record the delivery time only for a confirmed delivered state
    const deliveredValues = ['Delivered', 'delivered'];

    if (
      (updates.status &&
        deliveredValues.includes(updates.status)) ||
      (updates.deliveryStatus &&
        deliveredValues.includes(updates.deliveryStatus))
    ) {
      if (Order.schema.path('deliveredAt')) {
        updates.deliveredAt = new Date();
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updates },
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Order validation failed.',
        errors: Object.values(error.errors).map(
          (item) => item.message
        )
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update order status.'
    });
  }
});



export default router;
