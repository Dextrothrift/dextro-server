const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

// --- CORS Setup: allow production + preview domains ---
const allowedOrigins = [
  'https://dextro-store.vercel.app',
  'https://www.dextro.store',
  'https://dextro-store-8c9ivrtlf-dextros-projects-e14cac6e.vercel.app',
  process.env.FRONTEND_URL,
  ...(process.env.ADDITIONAL_ORIGINS || '').split(',').filter(Boolean)
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('Blocked CORS request from:', origin);
    return callback(new Error('CORS Not Allowed'), false);
  },
  credentials: true
}));

// --- Initialize Firebase Admin SDK ---
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

// --- Middleware to verify Firebase ID token ---
const verifyIdToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).send('Unauthorized');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send('Unauthorized');
  }
};

// --- Example Protected Route ---
app.get('/api/protected', verifyIdToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// --- Health Check ---
app.get('/', (req, res) => res.send('Auth server is running'));

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));