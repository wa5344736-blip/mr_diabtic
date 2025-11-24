
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
        import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
        import { getFirestore, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

        // Firebase Config
        const firebaseConfig = {
            apiKey: "AIzaSyD-Jd1rrLO1LC_0EoGIdrNLUCXTfqRh0uM",
            authDomain: "mr-dia.firebaseapp.com",
            projectId: "mr-dia",
            storageBucket: "mr-dia.firebasestorage.app",
            messagingSenderId: "528685312667",
            appId: "1:528685312667:web:cc5f89cf8c1f05f157743e"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // Translations
        const translations = {
            en: {
                appName: "Soom Health",
                dietPlan: "Your Personalized Diet Plan",
                modifyDiet: "Modify Your Diet Plan",
                modifyPlaceholder: "Type or speak your modification request...",
                generating: "Generating your personalized diet plan...",
                speak: "Listen",
                pause: "Pause",
                exportPDF: "Export PDF",
                shareWhatsApp: "Share",
                loadingData: "Loading your data...",
                notLoggedIn: "Please log in to view your diet plan.",
                noDataTitle: "No User Data Found",
                noDataMessage: "Please complete the assessment first.",
                goHome: "Go to Home",
                errorTitle: "Oops! Something went wrong",
                errorRetry: "Please try again"
            },
            ar: {
                appName: "صوم الصحية",
                dietPlan: "خطة النظام الغذائي الشخصية",
                modifyDiet: "تعديل خطة النظام الغذائي",
                modifyPlaceholder: "اكتب أو تحدث بطلب التعديل...",
                generating: "جاري إنشاء خطة النظام الغذائي الشخصية...",
                speak: "استمع",
                pause: "إيقاف",
                exportPDF: "تصدير PDF",
                shareWhatsApp: "مشاركة",
                loadingData: "جاري تحميل بياناتك...",
                notLoggedIn: "يرجى تسجيل الدخول لعرض خطة النظام الغذائي.",
                noDataTitle: "لم يتم العثور على بيانات المستخدم",
                noDataMessage: "يرجى إكمال التقييم أولاً.",
                goHome: "الذهاب للصفحة الرئيسية",
                errorTitle: "عذراً! حدث خطأ ما",
                errorRetry: "يرجى المحاولة مرة أخرى"
            }
        };

        // Global State
        let currentLang = localStorage.getItem('diet_lang') || 'en';
        let currentTheme = localStorage.getItem('diet_theme') || 'light';
        let userData = null;
        let currentUser = null;
        let dietPlanText = '';
        let isSpeaking = false;
        let isRecording = false;
        let speechRecognition = null;

        const GEMINI_API_KEY = 'AIzaSyC0MUSZvA_ny-fU7W2_cECkly0gtJUdup8';
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            applyTheme();
            applyLanguage();
            initSpeechRecognition();
            setupEventListeners();
            showLoadingDataState();

            // Listen to auth
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    await loadUserDataFromFirestore(user.uid);
                } else {
                    showNotLoggedInState();
                }
            });
        });

        function applyTheme() {
            document.body.className = `${currentTheme} ${currentLang === 'ar' ? 'rtl' : ''}`;
            const icon = document.querySelector('#themeBtn i');
            if (icon) icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }

        function applyLanguage() {
            document.documentElement.lang = currentLang;
            document.body.className = `${currentTheme} ${currentLang === 'ar' ? 'rtl' : ''}`;
            
            document.querySelectorAll('[data-translate]').forEach(el => {
                const key = el.getAttribute('data-translate');
                if (translations[currentLang][key]) {
                    el.textContent = translations[currentLang][key];
                }
            });

            const input = document.getElementById('chatInput');
            if (input) input.placeholder = translations[currentLang].modifyPlaceholder;
        }

        function showLoadingDataState() {
            const panel = document.getElementById('dietPanel');
            panel.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p class="loading-text">${translations[currentLang].loadingData}</p>
                </div>
            `;
        }

        function showNotLoggedInState() {
            const panel = document.getElementById('dietPanel');
            panel.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-user-lock"></i>
                    </div>
                    <h2>${translations[currentLang].notLoggedIn}</h2>
                    <button class="action-btn" onclick="window.location.href='index.html'">
                        <i class="fas fa-home"></i>
                        <span>${translations[currentLang].goHome}</span>
                    </button>
                </div>
            `;
        }

        async function loadUserDataFromFirestore(userId) {
            try {
                console.log('Loading data for user:', userId);
                
                const sessionsRef = collection(db, "users", userId, "sessions");
                const q = query(sessionsRef, orderBy("timestamp", "desc"), limit(1));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const latestSession = querySnapshot.docs[0].data();
                    console.log('Latest session:', latestSession);
                    
                    userData = latestSession.readableAnswers || latestSession.answers || {};
                    console.log('User data:', userData);
                    
                    generateDietPlan();
                } else {
                    console.log('No sessions found');
                    showNoDataState();
                }
            } catch (error) {
                console.error('Firestore error:', error);
                showErrorState('Failed to load your data: ' + error.message);
            }
        }

        function showNoDataState() {
            const panel = document.getElementById('dietPanel');
            panel.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <h2>${translations[currentLang].noDataTitle}</h2>
                    <p>${translations[currentLang].noDataMessage}</p>
                    <button class="action-btn" onclick="window.location.href='index.html'">
                        <i class="fas fa-home"></i>
                        <span>${translations[currentLang].goHome}</span>
                    </button>
                </div>
            `;
        }

        function showLoadingState() {
            const panel = document.getElementById('dietPanel');
            panel.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p class="loading-text">${translations[currentLang].generating}</p>
                </div>
            `;
        }

        function showErrorState(message) {
            const panel = document.getElementById('dietPanel');
            panel.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2>${translations[currentLang].errorTitle}</h2>
                    <p>${message}</p>
                    <button class="action-btn" onclick="window.location.reload()">
                        <i class="fas fa-redo"></i>
                        <span>${translations[currentLang].errorRetry}</span>
                    </button>
                </div>
            `;
        }

        async function generateDietPlan(modification = null) {
            showLoadingState();

            const promptText = modification 
                ? `You are a professional dietitian. Based on this patient data: ${JSON.stringify(userData)}. Create a diet plan using Markdown with ## headers for sections (Breakfast, Lunch, Dinner, Snacks). User modification: ${modification}`
                : `You are a professional dietitian. Based on this patient data: ${JSON.stringify(userData)}. Create a comprehensive diet plan using Markdown formatting with ## headers for sections: Breakfast, Lunch, Dinner, Snacks, Alternatives, and Notes/Warnings. Use bullet points for items.`;

            try {
                const response = await fetch(GEMINI_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }]
                    })
                });

                if (!response.ok) throw new Error(`API Error: ${response.status}`);

                const data = await response.json();
                dietPlanText = data.candidates[0].content.parts[0].text;
                displayDietPlan(dietPlanText);
            } catch (error) {
                console.error('Gemini API error:', error);
                showErrorState(error.message);
            }
        }

        function displayDietPlan(text) {
            const panel = document.getElementById('dietPanel');
            const formattedText = marked.parse(text);

            panel.innerHTML = `
                <div class="diet-header">
                    <h1 class="diet-title">
                        <i class="fas fa-utensils"></i>
                        <span>${translations[currentLang].dietPlan}</span>
                    </h1>
                    <div class="diet-actions">
                        <button class="action-btn" id="speakBtn" onclick="window.toggleSpeak()">
                            <i class="fas fa-play"></i>
                            <span>${translations[currentLang].speak}</span>
                        </button>
                        <button class="action-btn secondary" onclick="window.exportPDF()">
                            <i class="fas fa-file-pdf"></i>
                            <span>${translations[currentLang].exportPDF}</span>
                        </button>
                        <button class="action-btn secondary" onclick="window.shareWhatsApp()">
                            <i class="fab fa-whatsapp"></i>
                            <span>${translations[currentLang].shareWhatsApp}</span>
                        </button>
                    </div>
                </div>
                <div class="diet-content">
                    ${formattedText}
                </div>
            `;
        }

        function initSpeechRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                speechRecognition = new SpeechRecognition();
                speechRecognition.continuous = false;
                
                speechRecognition.onresult = (e) => {
                    document.getElementById('chatInput').value = e.results[0][0].transcript;
                };

                speechRecognition.onend = () => {
                    isRecording = false;
                    document.getElementById('micBtn').classList.remove('recording');
                };
            }
        }

        function setupEventListeners() {
            document.getElementById('homeBtn').addEventListener('click', () => {
                window.location.href = 'index.html';
            });

            document.getElementById('themeBtn').addEventListener('click', () => {
                currentTheme = currentTheme === 'light' ? 'dark' : 'light';
                localStorage.setItem('diet_theme', currentTheme);
                applyTheme();
            });

            document.getElementById('langBtn').addEventListener('click', () => {
                currentLang = currentLang === 'en' ? 'ar' : 'en';
                localStorage.setItem('diet_lang', currentLang);
                applyLanguage();
            });

            document.getElementById('micBtn').addEventListener('click', () => {
                if (!speechRecognition) return alert('Speech not supported');
                
                if (isRecording) {
                    speechRecognition.stop();
                } else {
                    speechRecognition.lang = currentLang === 'ar' ? 'ar-EG' : 'en-US';
                    speechRecognition.start();
                    isRecording = true;
                    document.getElementById('micBtn').classList.add('recording');
                }
            });

            document.getElementById('sendBtn').addEventListener('click', () => {
                const input = document.getElementById('chatInput');
                const mod = input.value.trim();
                if (mod) {
                    input.value = '';
                    generateDietPlan(mod);
                }
            });

            document.getElementById('chatInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    document.getElementById('sendBtn').click();
                }
            });

            document.getElementById('menuToggle')?.addEventListener('click', () => {
                document.getElementById('headerActions').classList.toggle('active');
            });
        }

        // Global functions
        window.toggleSpeak = function() {
            if (isSpeaking) {
                window.speechSynthesis.cancel();
                isSpeaking = false;
            } else {
                const text = dietPlanText.replace(/[*#]/g, '');
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = currentLang === 'ar' ? 'ar-EG' : 'en-US';
                utterance.rate = 0.9;
                utterance.onend = () => isSpeaking = false;
                window.speechSynthesis.speak(utterance);
                isSpeaking = true;
            }
        };

        window.exportPDF = function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(20);
            doc.setTextColor(46, 198, 122);
            doc.text('Soom Health - Diet Plan', 20, 20);
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Patient: ${currentUser?.email || 'N/A'}`, 20, 35);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 42);
            
            const clean = dietPlanText.replace(/[*#]/g, '');
            const lines = doc.splitTextToSize(clean, 170);
            
            let y = 55;
            lines.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 20, y);
                y += 7;
            });
            
            doc.save(`Diet_Plan_${new Date().toISOString().split('T')[0]}.pdf`);
        };

        window.shareWhatsApp = function() {
            const summary = `*Soom Health - Diet Plan*\n\n` +
                `👤 ${currentUser?.email || 'Patient'}\n` +
                `📅 ${new Date().toLocaleDateString()}\n\n` +
                `${dietPlanText.substring(0, 500)}...\n\n` +
                `_Generated by Soom Health AI_`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank');
        };