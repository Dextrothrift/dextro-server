const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const multer = require('multer');
const admin = require('./utils/firebase'); // Assuming this exports initialized Firebase Admin SDK
require('dotenv').config();

// Define PORT at the top
const PORT = process.env.PORT || 5000;

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

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
  process.env.GOOGLE_CALLBACK_URL // e.g., 'https://dextro-server.onrender.com/auth/google/callback'
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
    // Redirect back to frontend with idToken
    res.redirect(`https://www.dextro.store/front2.html?token=${idToken}`);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

// Health Check
app.get('/', (req, res) => res.send('Auth server is running'));

// Products endpoint to save product data
app.post('/api/products', upload.single('productPicture'), async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const productData = {
      productName: req.body.productName,
      description: req.body.description,
      mobile: req.body.mobile,
      price: req.body.price,
      category: req.body.category,
      productPicture: req.file ? req.file.path : null,
      userId: decodedToken.uid,
      createdAt: new Date().toISOString()
    };
    // TODO: Save productData to your database (e.g., Firestore or MongoDB)
    console.log('Product Data:', productData);
    res.status(200).json({ message: 'Product submitted successfully' });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));