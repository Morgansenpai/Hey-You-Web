import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP4DiJpagDIXz8gGCrUAbMxhgF-HzGvyw",
  authDomain: "hey-you-companion.firebaseapp.com",
  projectId: "hey-you-companion",
  storageBucket: "hey-you-companion.appspot.com",
  messagingSenderId: "1061661966821",
  appId: "1:1061661966821:web:e4599453150421b53fef0c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
