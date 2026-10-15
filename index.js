import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import couponRoutes from "./routes/couponRoutes.js"
import { connectDB } from './config/db.js';
import cartRoutes from './routes/cartRoutes.js';
const contactRoutes = require("./routes/contact");
import productRoutes from './routes/product.routes.js';
const deliveryApplications = require("./routes/deliveryApplications");
import dns from "dns"
dns.setServers(['1.1.1.1','8.8.8.8'])

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database Core
connectDB();

// Application Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  'https://zypcart.wuaze.com',
  'https://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests without an Origin header, such as server-to-server calls
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Link Specialized Routes (Auth routes completely dropped)
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupons', couponRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/delivery", deliveryApplications);
// Health diagnostics check
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.listen(PORT, () => console.log(`ShopEase Direct-ID API operational on port ${PORT}`));