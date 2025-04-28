const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));