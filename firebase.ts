import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyD8V9Qvbdc8r8HTxSv9wN0WlZlXydusWc8",
  authDomain: "polaku-garuda-hacks.firebaseapp.com",
  projectId: "polaku-garuda-hacks",
  storageBucket: "polaku-garuda-hacks.firebasestorage.app",
  messagingSenderId: "368486797875",
  appId: "1:368486797875:web:2d2f30187d3c27ac414946",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
