import { initializeApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence ada di runtime, tapi belum ke-cover di type definition Firebase v12.
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD8V9Qvbdc8r8HTxSv9wN0WlZlXydusWc8',
  authDomain: 'polaku-garuda-hacks.firebaseapp.com',
  projectId: 'polaku-garuda-hacks',
  storageBucket: 'polaku-garuda-hacks.firebasestorage.app',
  messagingSenderId: '368486797875',
  appId: '1:368486797875:web:2d2f30187d3c27ac414946',
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});