// --- Import Firebase core and modules ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp,
  getDoc,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Your Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyD-Jd1rrLO1LC_0EoGIdrNLUCXTfqRh0uM",
  authDomain: "mr-dia.firebaseapp.com",
  projectId: "mr-dia",
  storageBucket: "mr-dia.appspot.com", // ✅ Correct format
  messagingSenderId: "528685312667",
  appId: "1:528685312667:web:cc5f89cf8c1f05f157743e",
  measurementId: "G-5DMP99EVN6"
};

// --- Initialize app, auth, and database ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('✅ Firebase initialized successfully');

// --- Register new user ---
export async function registerUser(name, email, password) {
  try {
    console.log('🔄 Starting registration for:', email);
    
    // Create authentication account
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCred.user.uid;
    
    console.log('✅ Auth account created:', userId);

    // ✅ FIXED: Create user document WITHOUT password (security best practice)
    await setDoc(doc(db, "users", userId), {
      uid: userId,
      name: name,
      email: email,
      createdAt: serverTimestamp()
    });

    console.log('✅ Firestore user document created for:', userId);
    return userId;
    
  } catch (error) {
    console.error('❌ Registration error:', error.code, error.message);
    throw error;
  }
}

// --- Login existing user ---
export async function loginUser(email, password) {
  try {
    console.log('🔄 Attempting login for:', email);
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ User logged in:', userCred.user.uid);
    return userCred.user.uid;
  } catch (error) {
    console.error('❌ Login error:', error.code, error.message);
    throw error;
  }
}

// --- Listen to auth state changes ---
export function listenToAuth(callback) {
  onAuthStateChanged(auth, user => {
    if (user) {
      console.log('✅ Auth state: User logged in -', user.uid);
    } else {
      console.log('ℹ️ Auth state: No user logged in');
    }
    callback(user); // null if signed out
  });
}

// --- Logout ---
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('✅ User logged out successfully');
  } catch (error) {
    console.error('❌ Logout error:', error);
    throw error;
  }
}

// --- Save a new assessment session ---
export async function saveSession(userId, answers, readableAnswers, score, riskLevel) {
  try {
    console.log('🔄 Saving session for user:', userId);
    
    const sessionRef = collection(db, "users", userId, "sessions");
    const docRef = await addDoc(sessionRef, {
      answers: answers,
      readableAnswers: readableAnswers,
      score: score,
      riskLevel: riskLevel,
      timestamp: serverTimestamp()
    });
    
    console.log('✅ Session saved with ID:', docRef.id);
    return docRef.id;
    
  } catch (error) {
    console.error('❌ Session save error:', error);
    throw error;
  }
}

// --- Get user profile ---
export async function getUserProfile(userId) {
  try {
    console.log('🔄 Fetching user profile:', userId);
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (userDoc.exists()) {
      console.log('✅ User profile found');
      return userDoc.data();
    }
    
    console.log('⚠️ User profile not found');
    return null;
    
  } catch (error) {
    console.error('❌ Get user profile error:', error);
    throw error;
  }
}

// --- Get user sessions (latest first) ---
export async function getUserSessions(userId, limitCount = 10) {
  try {
    console.log('🔄 Fetching sessions for user:', userId);
    
    const sessionsRef = collection(db, "users", userId, "sessions");
    const q = query(sessionsRef, orderBy("timestamp", "desc"), limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${sessions.length} sessions`);
    return sessions;
    
  } catch (error) {
    console.error('❌ Get sessions error:', error);
    throw error;
  }
}

// --- Exports for global use ---
export { auth, db };