import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAxzJELpi0Zga3u4Cu8jwpSS1oIeZIG9PQ",
    authDomain: "lovebound-68e16.firebaseapp.com",
    projectId: "lovebound-68e16",
    storageBucket: "lovebound-68e16.firebasestorage.app",
    messagingSenderId: "182511123311",
    appId: "1:182511123311:web:9bd09451a8c6ef2b16869a",
    databaseURL: "https://lovebound-68e16-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

export { app, auth, db, storage, rtdb };