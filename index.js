import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import couponRoutes from "./routes/couponRoutes.js"
import { connectDB } from './config/db.js';
import cartRoutes from './routes/cartRoutes.js';
import productRoutes from './routes/product.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database Core
connectDB();

// Application Middleware
app.use(express.json());
app.use(cors({
  origin: [process.env.FRONTEND_URL,"https://zypcart.wuaze.com"],
  credentials: true
}))

// Link Specialized Routes (Auth routes completely dropped)
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupons', couponRoutes);

// Health diagnostics check
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.listen(PORT, () => console.log(`ShopEase Direct-ID API operational on port ${PORT}`));