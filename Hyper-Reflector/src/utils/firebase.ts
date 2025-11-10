import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getAuth,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);


export const auth = getAuth(app);
auth.setPersistence(browserLocalPersistence);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// // Optional: use emulators in dev
// if (import.meta.env.DEV) {
//     connectFirestoreEmulator(db, "127.0.0.1", 8080);
//     connectFunctionsEmulator(functions, "127.0.0.1", 5001);
//     connectStorageEmulator(storage, "127.0.0.1", 9199);
// }

// Helpers you can import anywhere
export async function loginEmail(email: string, pass: string) {
    return signInWithEmailAndPassword(auth, email, pass);
}
export async function loginGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}
export async function logout() {
    return signOut(auth);
}
export function callable<T = unknown, R = unknown>(name: string) {
    return httpsCallable<T, R>(functions, name);
}
