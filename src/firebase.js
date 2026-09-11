import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 設定値(.env.local)が空/誤りだとgetAuthが同期的に例外を投げるため、
// ここで捕まえて画面が真っ白にならず呼び出し側にエラーとして伝わるようにする
let authInitError = null;
let authInstance = null;
try {
  authInstance = getAuth(app);
} catch (e) {
  authInitError = e;
}
export const auth = authInstance;

// サインインが完了してから呼び出し側が使えるように、Promiseとして提供する
export const authReady = authInitError
  ? Promise.reject(authInitError)
  : new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        authInstance,
        (user) => {
          if (user) {
            unsubscribe();
            resolve(user);
          }
        },
        reject
      );
      signInAnonymously(authInstance).catch(reject);
    });
