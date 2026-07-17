import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore: getReactNativePersistence ada di runtime, tapi belum ke-cover di type definition Firebase v12.x
import { initializeAuth, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyD8V9Qvbdc8r8HTxSv9wN0WlZlXydusWc8",
  authDomain: "polaku-garuda-hacks.firebaseapp.com",
  projectId: "polaku-garuda-hacks",
  storageBucket: "polaku-garuda-hacks.firebasestorage.app",
  messagingSenderId: "368486797875",
  appId: "1:368486797875:web:2d2f30187d3c27ac414946",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  try {
    // @ts-ignore: getReactNativePersistence belum ada di type definition v12.x
    const { getReactNativePersistence } = require("firebase/auth");
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);