const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
require('dotenv').config();

const db = require('./utils/firebase'); // Firebase setup

const app = express();
app.set('trust proxy', 1);

// --- CORS Setup: allow production + preview domains ---
const allowedOrigins = [
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

// --- Session Middleware ---
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Google OAuth Strategy ---
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const userRef = db.collection('users').doc(profile.id);
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({
        id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        photo: profile.photos[0].value
      });
    }
    done(null, profile);
  } catch (error) {
    done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// --- Auth Routes ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login/failed' }),
  (req, res) => res.redirect(process.env.FRONTEND_URL)
);

app.get('/login/success', (req, res) => {
  if (req.isAuthenticated()) return res.json({ user: req.user });
  res.status(401).json({ user: null });
});

app.get('/login/failed', (req, res) => res.status(401).json({ error: 'Login failed' }));

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect(process.env.FRONTEND_URL));
});

app.get('/auth/user', (req, res) => {
  res.json({ user: req.isAuthenticated() ? req.user : null });
});

// --- Health Check ---
app.get('/', (req, res) => res.send('Auth server is running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));
