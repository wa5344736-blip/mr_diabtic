       import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { 
            getAuth, 
            createUserWithEmailAndPassword, 
            signInWithEmailAndPassword, 
            onAuthStateChanged
        } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { 
            getFirestore, 
            doc, 
            setDoc, 
            getDoc,
            serverTimestamp
        } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyD-Jd1rrLO1LC_0EoGIdrNLUCXTfqRh0uM",
            authDomain: "mr-dia.firebaseapp.com",
            projectId: "mr-dia",
            storageBucket: "mr-dia.appspot.com",
            messagingSenderId: "528685312667",
            appId: "1:528685312667:web:cc5f89cf8c1f05f157743e",
            measurementId: "G-5DMP99EVN6"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        console.log('✅ Firebase initialized');

        // ==================== LANGUAGE TOGGLE ====================
        let currentLang = 'en';
        const langToggle = document.getElementById('langToggle');
        const langIcon = document.getElementById('langIcon');

        function toggleLanguage() {
            currentLang = currentLang === 'en' ? 'ar' : 'en';
            langIcon.textContent = currentLang === 'en' ? 'AR' : 'EN';
            document.body.classList.toggle('rtl', currentLang === 'ar');
            
            document.querySelectorAll('[data-en]').forEach(el => {
                el.textContent = el.getAttribute(`data-${currentLang}`);
            });
        }

        langToggle.addEventListener('click', toggleLanguage);

        // ==================== TAB SWITCHING ====================
        const signupTab = document.getElementById('signupTab');
        const signinTab = document.getElementById('signinTab');
        const signupForm = document.getElementById('signupForm');
        const signinForm = document.getElementById('signinForm');
        const feedback = document.getElementById('feedback');

        signupTab.addEventListener('click', () => {
            signupTab.classList.add('active');
            signinTab.classList.remove('active');
            signupForm.classList.remove('hidden');
            signinForm.classList.add('hidden');
            feedback.style.display = 'none';
        });

        signinTab.addEventListener('click', () => {
            signinTab.classList.add('active');
            signupTab.classList.remove('active');
            signinForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            feedback.style.display = 'none';
        });

        // ==================== PASSWORD TOGGLE ====================
        const toggleSignupPassword = document.getElementById('toggleSignupPassword');
        const toggleSigninPassword = document.getElementById('toggleSigninPassword');
        const signupPassword = document.getElementById('signupPassword');
        const signinPassword = document.getElementById('signinPassword');

        toggleSignupPassword.addEventListener('click', () => {
            const type = signupPassword.type === 'password' ? 'text' : 'password';
            signupPassword.type = type;
            toggleSignupPassword.classList.toggle('fa-eye');
            toggleSignupPassword.classList.toggle('fa-eye-slash');
        });

        toggleSigninPassword.addEventListener('click', () => {
            const type = signinPassword.type === 'password' ? 'text' : 'password';
            signinPassword.type = type;
            toggleSigninPassword.classList.toggle('fa-eye');
            toggleSigninPassword.classList.toggle('fa-eye-slash');
        });

        // ==================== FEEDBACK MESSAGE ====================
        function showFeedback(message, type = 'success') {
            feedback.textContent = message;
            feedback.className = `feedback ${type}`;
            feedback.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => {
                    feedback.style.display = 'none';
                }, 3000);
            }
        }

        // ==================== SIGNUP ====================
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = signupForm.querySelector('.submit-btn');
            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;

            // Validation
            if (!name || !email || !password) {
                showFeedback(currentLang === 'en' ? 'Please fill in all fields' : 'يرجى ملء جميع الحقول', 'error');
                return;
            }

            if (password.length < 6) {
                showFeedback(currentLang === 'en' ? 'Password must be at least 6 characters' : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
                return;
            }

            try {
                submitBtn.classList.add('loading');
                console.log('🔄 Starting signup process...');
                
                // Step 1: Create authentication account
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                const userId = userCred.user.uid;
                
                console.log('✅ Auth account created:', userId);

                // Step 2: Save user data to Firestore
                await setDoc(doc(db, "users", userId), {
                    uid: userId,
                    name: name,
                    email: email,
                    createdAt: serverTimestamp()
                });
                
                console.log('✅ User data saved to Firestore');

                // Step 3: Show success and redirect
                showFeedback(
                    currentLang === 'en' ? '✅ Account created successfully! Redirecting...' : '✅ تم إنشاء الحساب بنجاح! جاري التحويل...', 
                    'success'
                );
                
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1500);
                
            } catch (error) {
                submitBtn.classList.remove('loading');
                console.error('❌ Signup error:', error);
                
                let errorMessage = currentLang === 'en' ? 'Registration failed. Please try again.' : 'فشل التسجيل. يرجى المحاولة مرة أخرى.';
                
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = currentLang === 'en' ? 'This email is already registered' : 'هذا البريد الإلكتروني مسجل بالفعل';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = currentLang === 'en' ? 'Invalid email address' : 'عنوان البريد الإلكتروني غير صالح';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = currentLang === 'en' ? 'Password is too weak' : 'كلمة المرور ضعيفة جداً';
                } else if (error.code === 'permission-denied') {
                    errorMessage = currentLang === 'en' ? 'Database permission denied. Please contact support.' : 'تم رفض الإذن. يرجى الاتصال بالدعم.';
                }
                
                showFeedback(errorMessage, 'error');
            }
        });

        // ==================== SIGNIN ====================
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = signinForm.querySelector('.submit-btn');
            const email = document.getElementById('signinEmail').value.trim();
            const password = document.getElementById('signinPassword').value;

            if (!email || !password) {
                showFeedback(currentLang === 'en' ? 'Please fill in all fields' : 'يرجى ملء جميع الحقول', 'error');
                return;
            }

            try {
                submitBtn.classList.add('loading');
                console.log('🔄 Starting signin process...');
                
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                const userId = userCred.user.uid;
                
                console.log('✅ User signed in:', userId);

                // Get user profile from Firestore
                const userDoc = await getDoc(doc(db, "users", userId));
                const userData = userDoc.exists() ? userDoc.data() : {};
                
                console.log('✅ User profile loaded:', userData);
                
                showFeedback(
                    currentLang === 'en' ? '✅ Signed in successfully! Redirecting...' : '✅ تم تسجيل الدخول بنجاح! جاري التحويل...', 
                    'success'
                );
                
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1500);
                
            } catch (error) {
                submitBtn.classList.remove('loading');
                console.error('❌ Signin error:', error);
                
                let errorMessage = currentLang === 'en' ? 'Email or password is incorrect' : 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMessage = currentLang === 'en' ? 'Invalid email or password' : 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage = currentLang === 'en' ? 'Too many attempts. Please try again later.' : 'محاولات كثيرة جداً. يرجى المحاولة لاحقاً.';
                }
                
                showFeedback(errorMessage, 'error');
            }
        });

        // ==================== AUTO-REDIRECT IF ALREADY LOGGED IN ====================
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('✅ User already logged in:', user.uid);
                // Uncomment the line below if you want auto-redirect
                // window.location.href = 'pages/home.html';
            }
        });