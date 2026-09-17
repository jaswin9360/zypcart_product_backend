import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import couponRoutes from "./routes/couponRoutes.js"
import { connectDB } from './config/db.js';
import cartRoutes from './routes/cartRoutes.js';
import productRoutes from './routes/product.routes.js';
import { Product } from './models/schema.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Remove any legacy MongoDB TTL indexes from the Product collection.
// A TTL index on createdAt (for example expireAfterSeconds: 604800)
// would silently delete products after 7 days. Product lifetime is
// controlled by the explicit DELETE /api/products/:id endpoint instead.
const removeProductTtlIndexes = async () => {
  try {
    const indexes = await Product.collection.listIndexes().toArray();
    const ttlIndexes = indexes.filter(index => index.expireAfterSeconds !== undefined);

    for (const index of ttlIndexes) {
      await Product.collection.dropIndex(index.name);
      console.warn(`Removed legacy Product TTL index: ${index.name}`);
    }

    if (ttlIndexes.length === 0) {
      console.log('Product TTL index check: no automatic-expiration index found.');
    }
  } catch (error) {
    console.error(`Product TTL index cleanup failed: ${error.message}`);
    throw error;
  }
};

// Connect database before accepting requests and clean up any legacy
// Product TTL index left behind by an older MongoDB/Atlas configuration.
const startServer = async () => {
  await connectDB();
  await removeProductTtlIndexes();

  // Application Middleware
  app.use(express.json());
  app.use(cors({
    origin: [process.env.FRONTEND_URL, "https://zypcart.wuaze.com"],
    credentials: true
  }));

  // Link Specialized Routes (Auth routes completely dropped)
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/coupons', couponRoutes);

  // Health diagnostics check
  app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

  app.listen(PORT, () => console.log(`ShopEase Direct-ID API operational on port ${PORT}`));
};

startServer().catch(error => {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});