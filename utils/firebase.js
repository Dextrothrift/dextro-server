// utils/firebase.js
const admin = require('firebase-admin');

// Parse the JSON blob from the environment
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
