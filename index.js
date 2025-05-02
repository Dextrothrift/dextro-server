const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const multer = require('multer');
const admin = require('./utils/firebase'); // Ensure this exports initialized Firebase Admin SDK
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Initialize Firestore
const db = admin.firestore();

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));

// CORS Setup
const allowedOrigins = [
  'https://dextro-store.vercel.app',
  'https://www.dextro.store',
  'https://dextro-store-8c9ivrtlf-dextros-projects-e14cac6e.vercel.app',
  process.env.FRONTEND_URL,
  ...(process.env.ADDITIONAL_ORIGINS || '').split(',').filter(Boolean)
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('Blocked CORS request from:', origin);
    return callback(new Error('CORS Not Allowed'), false);
  },
  credentials: true
}));

// Google OAuth2 Client
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// Route to start Google OAuth
app.get('/auth/google', (req, res) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
  });
  res.redirect(url);
});

// Callback route after Google OAuth
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    res.redirect(`https://www.dextro.store/front2.html?token=${idToken}`);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

// Health Check
app.get('/', (req, res) => res.send('Auth server is running'));

// Products endpoint to save product data to Firestore
app.post('/api/products', upload.single('productPicture'), async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const productData = {
      productName: req.body.productName,
      description: req.body.description,
      mobile: req.body.mobile,
      price: parseFloat(req.body.price),
      category: req.body.category,
      productPicture: req.file ? `/uploads/${req.file.filename}` : null,
      userId: decodedToken.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore
    const docRef = await db.collection('products').add(productData);
    console.log('Product added with ID:', docRef.id);

    res.status(200).json({ message: 'Product submitted successfully', productId: docRef.id });
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ error: 'Failed to save product' });
  }
});

// Fetch products endpoint for cycles.html
app.get('/api/products', async (req, res) => {
  try {
    const snapshot = await db.collection('products').where('category', '==', 'cycles').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));