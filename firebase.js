import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
apiKey: "AIzaSyAxzJELpi0Zga3u4Cu8jwpSS1oIeZIG9PQ",
authDomain: "lovebound-68e16.firebaseapp.com",
projectId: "lovebound-68e16",
storageBucket: "lovebound-68e16.firebasestorage.app",
messagingSenderId: "182511123311",
appId: "1:182511123311:web:9bd09451a8c6ef2b16869a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export Firebase services
export { app, auth, db, storage };
