import express from "express"
const router = express.Router();
import {Coupon} from "../models/Coupon.js"




router.post('/create', async (req, res) => {
    try {
        // Extract sellerName from req.body
        const { 
            code, sellerId, sellerName, discountType, discountValue, 
            minPurchaseAmount, expiryDate, question, answer, applicableProducts 
        } = req.body;

        const newCoupon = new Coupon({
            code, sellerId, sellerName, // <-- Save the name directly!
            discountType, discountValue, 
            minPurchaseAmount: minPurchaseAmount || 0,
            expiryDate, question, answer, applicableProducts
        });

        await newCoupon.save();
        res.status(201).json({ message: "Coupon created successfully!", coupon: newCoupon });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});


// UPDATE: Fetch unclaimed coupons OR coupons claimed by this user (WITH POPULATE)
router.get('/active', async (req, res) => {
    try {
        const { userId } = req.query; 
        const currentDate = new Date();

        const query = {
            isActive: true,
            isRedeemed: false,
            expiryDate: { $gt: currentDate },
            question: { $exists: true, $ne: '' },
            $or: [ { isClaimed: false } ]
        };

        if (userId) {
            query.$or.push({ isClaimed: true, claimedBy: userId });
        }

        // ADD .populate() HERE to get the actual names
        const activeCoupons = await Coupon.find(query)
            .populate('applicableProducts', 'name') // Gets the product names
            .select('-__v');
        
        res.status(200).json(activeCoupons);
    } catch (error) {
        console.error("Error fetching active coupons:", error);
        res.status(500).json({ message: "Server error fetching coupons." });
    }
});

// 2. NEW: Securely claim the coupon when answered correctly
router.post('/claim', async (req, res) => {
    try {
        const { couponId, userId } = req.body;
        
        // This query is atomic. It ONLY updates if isClaimed is still false.
        // This prevents two users from claiming it at the exact same millisecond.
        const updatedCoupon = await Coupon.findOneAndUpdate(
            { _id: couponId, isClaimed: false },
            { $set: { isClaimed: true, claimedBy: userId } },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(400).json({ success: false, message: "Too late! Someone else just claimed this coupon." });
        }

        res.status(200).json({ success: true, coupon: updatedCoupon });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while claiming." });
    }
});


// ==========================================
// VALIDATE COUPON (Called during Checkout)
// ==========================================
router.post('/validate', async (req, res) => {
    try {
        const { code, cartItems, userId } = req.body;

        // 1. Check for required data
        if (!code || !cartItems || cartItems.length === 0 || !userId) {
            return res.status(400).json({ valid: false, message: "Code, cart items, and user ID are required." });
        }

        // 2. Find the coupon
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        
        if (!coupon) {
            return res.status(404).json({ valid: false, message: "Coupon not found." });
        }

        // 3. Check if active and not expired
        if (!coupon.isActive) {
            return res.status(400).json({ valid: false, message: "This coupon is no longer active." });
        }
        if (new Date() > new Date(coupon.expiryDate)) {
            return res.status(400).json({ valid: false, message: "This coupon has expired." });
        }

        // 4. OWNERSHIP & CLAIM VALIDATION (The Scratch & Win logic)

        if (coupon.isRedeemed) {
            return res.status(400).json({ valid: false, message: "This coupon has already been used and is no longer valid." });
        }
        // If it's a gamified coupon, ensure it has been claimed
        if (coupon.question && !coupon.isClaimed) {
            return res.status(400).json({ valid: false, message: "You must play the scratch card challenge to unlock this code first!" });
        }
        
        // Ensure the person trying to use it is the person who claimed it
        if (coupon.isClaimed && coupon.claimedBy.toString() !== userId.toString()) {
            return res.status(400).json({ valid: false, message: "This coupon has already been claimed and locked to another user's account." });
        }

        // 5. Check if cart contains the correct products from this specific seller
        let applicableSubtotal = 0;
        
        cartItems.forEach(item => {
            // First check if the item belongs to the seller who made the coupon
            if (item.productId.userId === coupon.sellerId.toString()) {
                const itemPrice = item.price || item.productId.discountPrice;
                
                // If the seller restricted this coupon to specific products
                if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
                    // Check if this cart item's ID is in the applicable products list
                    if (coupon.applicableProducts.includes(item.productId._id.toString())) {
                        applicableSubtotal += (itemPrice * item.quantity);
                    }
                } else {
                    // If no specific products selected, it applies to ALL of this seller's products
                    applicableSubtotal += (itemPrice * item.quantity);
                }
            }
        });

        // 6. Final verification against the calculated subtotal
        if (applicableSubtotal === 0) {
            return res.status(400).json({ 
                valid: false, 
                message: "This coupon is not valid for any items currently in your cart." 
            });
        }

        // 7. Check minimum purchase requirement
        if (applicableSubtotal < coupon.minPurchaseAmount) {
            return res.status(400).json({ 
                valid: false, 
                message: `Add ₹${coupon.minPurchaseAmount - applicableSubtotal} more of eligible products to use this coupon.` 
            });
        }

        // 8. Calculate Final Discount
        let discount = 0;
        if (coupon.discountType === 'FLAT') {
            // Ensure the flat discount doesn't exceed the subtotal of the applicable items
            discount = Math.min(coupon.discountValue, applicableSubtotal);
        } else if (coupon.discountType === 'PERCENTAGE') {
            discount = (applicableSubtotal * coupon.discountValue) / 100;
        }

        // Round discount to 2 decimal places to prevent weird currency floats
        discount = Math.round(discount * 100) / 100;

        return res.status(200).json({
            valid: true,
            discount: discount,
            message: "Coupon applied successfully!"
        });

    } catch (error) {
        console.error("Coupon validation error:", error);
        res.status(500).json({ valid: false, message: "Server error while validating coupon." });
    }
});

export default router