
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true
    },

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        default: 1,
        max: 5
    }

}, {
    timestamps: {
        createdAt: false,
        updatedAt: true
    }
});

// Prevent duplicate product entries for the same user
cartItemSchema.index(
    { userId: 1, productId: 1 },
    { unique: true }
);

export const CartItem = mongoose.model(
    'CartItem',
    cartItemSchema
);