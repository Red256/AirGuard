import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// The Firebase web config is not a secret. It identifies the project; it does
// not grant access. What a client may read or write is decided by the Realtime
// Database rules, so these values are safe to commit (see README).
const firebaseConfig = {
  apiKey: 'AIzaSyBiekzv5LsNNWWZumHx75n_8fxiXvmgLR4',
  authDomain: 'airguard-8a58c.firebaseapp.com',
  databaseURL: 'https://airguard-8a58c-default-rtdb.firebaseio.com',
  projectId: 'airguard-8a58c',
  storageBucket: 'airguard-8a58c.firebasestorage.app',
  messagingSenderId: '39523962773',
  appId: '1:39523962773:web:293c9f4fff71f97f04709c',
  measurementId: 'G-M75QJPH3T7',
};

// The Boron publishes to device_data/<deviceId>/<epoch seconds> through a
// Particle webhook. Which device this install reads is not baked in: the user
// registers their own node on first launch and the id is stored on the device
// (see SettingsContext and RegisterDeviceScreen).

// Firebase Analytics is deliberately not initialised: getAnalytics() needs a
// browser document and throws under React Native. Use expo-firebase-analytics
// or a native SDK if analytics is ever wanted on device.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
