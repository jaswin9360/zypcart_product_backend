
import mongoose from "mongoose";

// Address sub-schema
const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  cityStateZip: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
});

// User schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
  },

  org_password: {
    type: String,
  },

  avatar: {
    type: String,
  },

  role: {
    type: String,
    enum: ["buyer", "seller"],
    default: "buyer",
  },

  provider: {
    type: String,
    default: "local",
  },

  isAdmin: {
    type: Boolean,
    default: false,
  },

  phone: {
    type: String,
    default: null,
  },

  profilePinHash: {
    type: String,
    default: null,
  },

  tempOtp: {
    type: String,
    default: null,
  },

  otpExpiry: {
    type: Date,
    default: null,
  },

  addresses: [addressSchema],

  selectedAddressId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
});

// Prevent model recompilation errors
const User =
  mongoose.models.User || mongoose.model("User", userSchema);

export default User;
