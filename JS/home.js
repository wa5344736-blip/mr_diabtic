    import { 
      listenToAuth, 
      logoutUser, 
      saveSession, 
      getUserProfile 
    } from './firestore.js';

    // Global state for Firebase user
    window.currentUser = null;

    document.addEventListener('DOMContentLoaded', async () => {
      try {
        // Check authentication state
        listenToAuth(async (user) => {
          window.currentUser = user;
          
          if (!user) {
            // No user logged in, redirect to index
            console.log('No user authenticated, redirecting...');
            window.location.href = 'index.html';
            return;
          }

          // User authenticated, load profile
          console.log('✅ User authenticated:', user.uid);
          try {
            const profile = await getUserProfile(user.uid);
            const emailDisplay = document.getElementById('userEmail');
            if (emailDisplay && profile) {
              emailDisplay.textContent = profile.email || user.email;
            }
          } catch (err) {
            console.error('Profile load error:', err);
          }

          // Show main content
          document.getElementById('loadingState').classList.add('hidden');
          document.getElementById('heroImage').classList.remove('hidden');
          document.getElementById('heroCard').classList.remove('hidden');
          document.getElementById('legalBanner').classList.remove('hidden');
        });

        // Setup logout handler
        document.getElementById('logoutBtn').addEventListener('click', async () => {
          try {
            await logoutUser();
            localStorage.setItem('userLoggedOut', 'true');
            window.location.href = 'index.html';
          } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to logout. Please try again.');
          }
        });

        // Save assessment to Firestore
        window.saveAssessmentToFirestore = async (answers, readableAnswers, score, riskLevel) => {
          if (!window.currentUser) {
            console.warn('No user logged in, skipping Firestore save');
            return null;
          }

          try {
            const sessionId = await saveSession(
              window.currentUser.uid,
              answers,
              readableAnswers,
              score,
              riskLevel
            );
            console.log('✅ Assessment saved to Firestore:', sessionId);
            return sessionId;
          } catch (error) {
            console.error('❌ Firestore save error:', error);
            return null;
          }
        };

      } catch (err) {
        console.error('Firebase initialization error:', err);
        alert('Failed to initialize. Please refresh the page.');
      }
    });
  </script>

  <!-- Main Application Logic -->
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Clear old data on fresh start
      window.addEventListener("load", () => {
        if (!sessionStorage.getItem("testStarted")) {
          localStorage.removeItem("soom_answers");
          localStorage.removeItem("progress");
          sessionStorage.setItem("testStarted", "true");
        }
      });

      try {
        // Translations
        const TEXT = {
          ar: {
            start: 'ابدأ الاختبار',
            example: 'مثال',
            heroTitle: 'هل الصيام آمن لحالتك؟',
            heroSub: 'أجب على أسئلة طبية موجزة لتحصل على تقييم سريري مفصّل وتوصيات قابلة للتحميل والمشاركة.',
            legal: 'تنبيه: هذه الأداة فحص مبدئي فقط ولا تغني عن استشارة طبية مباشرة.',
            prev: 'السابق',
            next: 'التالي',
            recs: 'التوصيات السريعة',
            whatsapp: 'إرسال النتيجة عبر واتساب',
            restart: 'إعادة الاختبار',
            darkMode: 'الوضع الداكن',
            lightMode: 'الوضع الفاتح',
            switchLang: 'Switch to English',
            diet: 'خطة النظام الغذائي',
            analyzing: 'التحليل',
            assistant: 'المساعد الذكي',
            logout: 'تسجيل خروج'
          },
          en: {
            start: 'Start Assessment',
            example: 'Example',
            heroTitle: 'Is fasting safe for you?',
            heroSub: 'Answer brief clinical questions to get a detailed clinical screening and downloadable recommendations.',
            legal: 'Disclaimer: This tool is a preliminary screening only and not a substitute for direct medical consultation.',
            prev: 'Previous',
            next: 'Next',
            recs: 'Quick Recommendations',
            whatsapp: 'Share via WhatsApp',
            restart: 'Restart Assessment',
            darkMode: 'Dark Mode',
            lightMode: 'Light Mode',
            switchLang: 'التبديل للعربية',
            diet: 'Diet Plan',
            analyzing: 'Analysis',
            assistant: 'AI Assistant',
            logout: 'Logout'
          }
        };

        // Questions data
        const QUESTIONS = [
          { id:'q1', ar:'نوع السكر ؟', en:'Diabetes type?', choices:[
              { key:'a', ar:'نوع اول', en:'Type 1', score: 1 },
              { key:'b', ar:'نوع ثاني', en:'Type 2', score: 0 }
            ]
          },
          { id:'q2', ar:'مدة الاصابة ؟', en:'Duration of disease?', choices:[
              { key:'a', ar:'اكثر من 10 سنوات', en:'More than 10 years', score:1 },
              { key:'b', ar:'اقل من 10 سنوات', en:'Less than 10 years', score:0 }
            ]
          },
          { id:'q3', ar:'هبوط السكر ؟', en:'Hypoglycaemia history?', choices:[
              { key:'a', ar:'عدم وعي باعراض الهبوط', en:'Unawareness of hypoglycaemia', score:6.5 },
              { key:'b', ar:'هبوط شديد من فترة قريبة', en:'Recent severe hypoglycaemia', score:5.5 },
              { key:'c', ar:'هبوط اقل من مرة اسبوعيا', en:'Hypoglycaemia <1/week', score:1 },
              { key:'d', ar:'لا تحدث نوبات هبوط', en:'No hypoglycaemia episodes', score:0 }
            ]
          },
          { id:'q4', ar:'نوع العلاج؟', en:'Type of treatment?', choices:[
              { key:'a', ar:'انسولين مخلوط متعدد الجرعات', en:'Premixed multiple doses', score:3 },
              { key:'b', ar:'انسولين قاعدي وسريع او مضخة انسولين', en:'Basal-bolus or pump', score:2.5 },
              { key:'c', ar:'انسولين مخلوط جرعة واحدة', en:'Single-dose premixed', score:2 },
              { key:'d', ar:'Glibenclamide', en:'Glibenclamide', score:1 },
              { key:'e', ar:'علاجات اخرى', en:'Other treatments', score:0 }
            ]
          },
          { id:'q5', ar:'متابعة السكر ؟', en:'Glucose monitoring adherence?', choices:[
              { key:'a', ar:'مطلوب ولكن لا ينفذه المريض', en:'Recommended but not done', score:2 },
              { key:'b', ar:'مطلوب وينفذه المريض احيانا', en:'Sometimes adherent', score:1 },
              { key:'c', ar:'مطلوب وينفذه المريض بدقة', en:'Adherent', score:0 }
            ]
          },
          { id:'q6', ar:'مضاعفات حادة ؟', en:'Acute complications?', choices:[
              { key:'a', ar:'غيبوبة كيتونية خلال ال 3 شهور الماضية', en:'DKA in last 3 months', score:3 },
              { key:'b', ar:'غيبوبة كيتونية خلال ال6 شهور الماضية', en:'DKA in last 6 months', score:2 },
              { key:'c', ar:'غيبوبة كيتونية خلال 12 شهور الماضية', en:'DKA in last 12 months', score:1 },
              { key:'d', ar:'لا يوجد', en:'None', score:0 }
            ]
          },
          { id:'q7', ar:'العمر ؟', en:'Age?', choices:[
              { key:'a', ar:'اكثر من 70 عام', en:'>70 years', score:3.5 },
              { key:'b', ar:'اقل من 70 عام', en:'<70 years', score:0 }
            ]
          },
          { id:'q8', ar:'مشاكل في الادراك الحسي والذاكرة ؟', en:'Cognitive or sensory impairment?', choices:[
              { key:'a', ar:'توجد', en:'Present', score:6.5 },
              { key:'b', ar:'لا توجد', en:'Absent', score:0 }
            ]
          },
          { id:'q9', ar:'الحمل ؟', en:'Pregnancy?', choices:[
              { key:'a', ar:'حامل وسكر غير منضبط', en:'Pregnant, uncontrolled diabetes', score:6.5 },
              { key:'b', ar:'حامل وسكر منضبط', en:'Pregnant, controlled diabetes', score:3.5 },
              { key:'c', ar:'غير حامل', en:'Not pregnant', score:0 }
            ]
          },
          { id:'q10', ar:'المجهود البدني ؟', en:'Physical exertion?', choices:[
              { key:'a', ar:'شاق', en:'Heavy', score:4 },
              { key:'b', ar:'متوسط', en:'Moderate', score:2 },
              { key:'c', ar:'بسيط', en:'Light', score:0 }
            ]
          },
          { id:'q11', ar:'تجارب الصيام السابقة ؟', en:'Previous fasting experience?', choices:[
              { key:'a', ar:'تجارب سلبية', en:'Negative experiences', score:1 },
              { key:'b', ar:'تجارب ايجابية او بدون تجارب صيام سابقة', en:'Positive or no prior fasting', score:0 }
            ]
          },
          { id:'q12', ar:'امراض القلب والاوعية الدموية ؟', en:'Cardiovascular disease?', choices:[
              { key:'a', ar:'غير مستقرة', en:'Unstable', score:6.5 },
              { key:'b', ar:'مستقرة', en:'Stable', score:2 },
              { key:'c', ar:'بدون', en:'None', score:0 }
            ]
          },
          { id:'q13', ar:'امراض الكلى ؟', en:'Kidney disease (eGFR)?', choices:[
              { key:'a', ar:'معدل فلترة الكلى اقل من 30', en:'eGFR <30', score:6.5 },
              { key:'b', ar:'معدل فلترة الكلى بين 30 و45', en:'eGFR 30-45', score:4 },
              { key:'c', ar:'معدل فلترة الكلى بين 45 و 60', en:'eGFR 45-60', score:2 },
              { key:'d', ar:'معدل فلترة الكلى اكثر من 60', en:'eGFR >60', score:0 }
            ]
          }
        ];

        // State
        const state = {
          lang: localStorage.getItem('soom_lang') || 'ar',
          idx: 0,
          answers: {},
          selected: {},
          score: 0,
          theme: localStorage.getItem('soom_theme') || 'light'
        };

        // Elements
        const $ = id => document.getElementById(id);
        const hamburgerBtn = $('hamburgerBtn');
        const sideMenu = $('sideMenu');
        const menuOverlay = $('menuOverlay');
        const startBtn = $('startBtn');
        const exampleBtn = $('exampleBtn');
        const questionsSection = $('questionsSection');
        const qCard = $('qCard');
        const qText = $('qText');
        const qIndicator = $('qIndicator');
        const progBar = $('progBar');
        const prevBtn = $('prevBtn');
        const nextBtn = $('nextBtn');
        const resultSection = $('resultSection');
        const resultTitle = $('resultTitle');
        const resultScore = $('resultScore');
        const quickRecs = $('quickRecs');
        const whatsappBtn = $('whatsappBtn');
        const downloadPdfBtn = $('downloadPdfBtn');
        const restartBtn = $('restartBtn');

        // Hamburger menu toggle
        function toggleMenu() {
          hamburgerBtn.classList.toggle('open');
          sideMenu.classList.toggle('open');
          menuOverlay.classList.toggle('open');
        }

        hamburgerBtn.addEventListener('click', toggleMenu);
        menuOverlay.addEventListener('click', toggleMenu);

        // Theme handling
        function applyTheme() {
          if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
            $('menuThemeIcon').className = 'fa-solid fa-sun';
            $('menuThemeText').innerText = TEXT[state.lang].lightMode;
          } else {
            document.documentElement.classList.remove('dark');
            $('menuThemeIcon').className = 'fa-solid fa-moon';
            $('menuThemeText').innerText = TEXT[state.lang].darkMode;
          }
          localStorage.setItem('soom_theme', state.theme);
        }

        $('menuThemeToggle').addEventListener('click', () => {
          state.theme = state.theme === 'dark' ? 'light' : 'dark';
          applyTheme();
        });

        // Language handling
        function setLang(l) {
          state.lang = l;
          localStorage.setItem('soom_lang', l);
          document.documentElement.lang = l;
          document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
          applyTexts();
          renderCurrent();
        }

        function applyTexts() {
          $('startText').innerText = TEXT[state.lang].start;
          $('exampleText').innerText = TEXT[state.lang].example;
          $('heroTitle').innerText = TEXT[state.lang].heroTitle;
          $('heroSub').innerText = TEXT[state.lang].heroSub;
          $('legalText').innerText = TEXT[state.lang].legal;
          $('prevText').innerText = TEXT[state.lang].prev;
          $('nextText').innerText = TEXT[state.lang].next;
          $('recsTitle').innerText = TEXT[state.lang].recs;
          $('whatsappText').innerText = TEXT[state.lang].whatsapp;
          $('restartText').innerText = TEXT[state.lang].restart;
          $('menuLangText').innerText = TEXT[state.lang].switchLang;
          $('menuDiet').innerText = TEXT[state.lang].diet;
          $('menuAnalyzing').innerText = TEXT[state.lang].analyzing;
          $('menuAssistant').innerText = TEXT[state.lang].assistant;
          $('menuLogout').innerText = TEXT[state.lang].logout;
          applyTheme();
        }

        $('menuLangToggle').addEventListener('click', () => {
          setLang(state.lang === 'ar' ? 'en' : 'ar');
        });

        // Save answers with readable format
        function saveAnswersToStorage() {
          try {
            const readableAnswers = {};
            QUESTIONS.forEach(q => {
              const key = q.id;
              const chosenKey = state.selected[key];
              const choice = q.choices.find(c => c.key === chosenKey);
              if (choice) {
                const qText = state.lang === 'ar' ? q.ar : q.en;
                const choiceText = state.lang === 'ar' ? choice.ar : choice.en;
                readableAnswers[`${key}: ${qText}`] = `${chosenKey}. ${choiceText}`;
              }
            });

            const data = {
              answers: state.answers,
              selected: state.selected,
              readable: readableAnswers,
              score: state.score,
              timestamp: new Date().toISOString()
            };

            localStorage.setItem('soom_answers', JSON.stringify(data));
            console.log('✅ Saved detailed answers:', data);
          } catch (e) {
            console.error('Failed to save to localStorage:', e);
          }
        }

        // Render current question
        function renderCurrent(enterFrom = 'right') {
          const q = QUESTIONS[state.idx];
          qText.innerText = state.lang === 'ar' ? q.ar : q.en;
          qIndicator.innerText = state.lang === 'ar' 
            ? `السؤال ${state.idx + 1} من ${QUESTIONS.length}` 
            : `Question ${state.idx + 1} of ${QUESTIONS.length}`;

          const answeredCount = Object.keys(state.answers).length;
          const prog = Math.round(answeredCount / QUESTIONS.length * 100);
          if (progBar) progBar.style.width = prog + '%';

          const container = document.createElement('div');
          container.className = 'q-card-inner';

          q.choices.forEach((ch) => {
            const btn = document.createElement('button');
            btn.className = 'choice';
            if (state.selected[q.id] === ch.key) btn.classList.add('selected');

            const keySpan = `<div class="opt-key">${ch.key.toUpperCase()}</div>`;
            const label = state.lang === 'ar' ? ch.ar : ch.en;
            const scoreSmall = `<small>${state.lang === 'ar' ? 'السكور' : 'Score'}: ${ch.score}</small>`;
            btn.innerHTML = `${keySpan}<div style="flex:1;text-align:${state.lang === 'ar' ? 'right' : 'left'}">${label}<div style="margin-top:6px">${scoreSmall}</div></div>`;

            btn.addEventListener('click', () => {
              state.answers[q.id] = parseFloat(ch.score);
              state.selected[q.id] = ch.key;
              saveAnswersToStorage();

              const siblings = container.querySelectorAll('.choice');
              siblings.forEach(s => s.classList.remove('selected'));
              btn.classList.add('selected');

              const current = qCard.querySelector('.q-card-inner');
              if (current) {
                current.classList.remove('animate-in-left', 'animate-in-right');
                current.classList.add('animate-out-right');
              }

              setTimeout(() => {
                if (state.idx < QUESTIONS.length - 1) {
                  state.idx++;
                  renderCurrent('left');
                } else {
                  computeResult();
                }
              }, 360);
            });

            container.appendChild(btn);
            container.appendChild(document.createElement('br'));
          });

          qCard.innerHTML = '';
          qCard.appendChild(container);
          if (enterFrom === 'left') container.classList.add('animate-in-left');
          else container.classList.add('animate-in-right');
        }

        // Navigation
        nextBtn.addEventListener('click', () => {
          if (state.idx < QUESTIONS.length - 1) {
            const current = qCard.querySelector('.q-card-inner');
            if (current) {
              current.classList.remove('animate-in-left', 'animate-in-right');
              current.classList.add('animate-out-left');
            }
            setTimeout(() => { state.idx++; renderCurrent('right'); }, 320);
          } else {
            computeResult();
          }
        });

        prevBtn.addEventListener('click', () => {
          if (state.idx > 0) {
            const current = qCard.querySelector('.q-card-inner');
            if (current) {
              current.classList.remove('animate-in-left', 'animate-in-right');
              current.classList.add('animate-out-right');
            }
            setTimeout(() => { state.idx--; renderCurrent('left'); }, 320);
          }
        });

        // Compute result
        async function computeResult() {
          let total = 0;
          QUESTIONS.forEach(q => {
            const v = parseFloat(state.answers[q.id]);
            if (!isNaN(v)) total += v;
          });
          total = Math.round(total * 10) / 10;
          state.score = total;
          saveAnswersToStorage();

          let level = 'low';
          if (total > 6) level = 'high';
          else if (total >= 3.5 && total <= 6) level = 'moderate';

          const impression = buildImpression(total, level);
          const recs = buildRecommendations(level, total);

          // Build readable answers for Firestore
          const readableAnswers = {};
          QUESTIONS.forEach(q => {
            const chosenKey = state.selected[q.id];
            const choice = q.choices.find(c => c.key === chosenKey);
            if (choice) {
              const qText = state.lang === 'ar' ? q.ar : q.en;
              const choiceText = state.lang === 'ar' ? choice.ar : choice.en;
              readableAnswers[`${q.id}: ${qText}`] = `${chosenKey}. ${choiceText}`;
            }
          });

          // Save to Firestore
          if (window.saveAssessmentToFirestore) {
            await window.saveAssessmentToFirestore(
              state.answers,
              readableAnswers,
              total,
              level
            );
          }

          renderResult(level, total, impression, recs);
        }

        function buildImpression(total, level) {
          if (state.lang === 'ar') {
            if (level === 'high') return `خطر عالي – المجموع الكلي: ${total}.\nيوجد عوامل خطورة مهمة تمنع الصوم حتى مراجعة طبية.`;
            if (level === 'moderate') return `خطر متوسط – المجموع الكلي: ${total}.\nينصح بمراجعة الطبيب قبل الصيام.`;
            return `خطر منخفض – المجموع الكلي: ${total}.\nيمكن الصيام مع الاحتياطات والمتابعة.`;
          } else {
            if (level === 'high') return `High risk – total score: ${total}. Multiple significant risk factors identified. Avoid fasting until clinical review.`;
            if (level === 'moderate') return `Moderate risk – total score: ${total}. Clinical review recommended before fasting.`;
            return `Low risk – total score: ${total}. May fast with precautions and monitoring.`;
          }
        }

        function buildRecommendations(level, total) {
          const recs = [];
          if (level === 'high') {
            recs.push(state.lang === 'ar' ? 'احصل على تقييم طبي عاجل – لا تصم حتى يتم التقييم' : 'Seek urgent clinical evaluation – avoid fasting until reviewed');
          } else if (level === 'moderate') {
            recs.push(state.lang === 'ar' ? 'راجع طبيبك قبل الصيام' : 'Medical review advised before fasting');
          } else {
            recs.push(state.lang === 'ar' ? 'يمكن الصيام مع احتياطات ومتابعة الأعراض' : 'May fast with precautions and monitoring');
          }

          recs.push(state.lang === 'ar' ? 'راقب سكر الدم بشكل دوري خلال الصوم' : 'Monitor blood glucose frequently during fasting');
          recs.push(state.lang === 'ar' ? 'اكسر الصيام فوراً عند دوخة شديدة أو ألم صدر' : 'Break fast and seek urgent care for severe dizziness or chest pain');
          recs.push(state.lang === 'ar' ? 'تذكير: هذا تقييم مبدئي فقط ولا يغني عن الفحص الطبي' : 'Reminder: preliminary screening only – not a substitute for clinical assessment');

          return recs;
        }

        function renderResult(level, total, impression, recs) {
          const badge = $('resultBadge');
          const icon = $('resultIcon');
          
          if (level === 'high') {
            badge.style.background = 'linear-gradient(135deg,var(--danger),#b91c1c)';
            icon.className = 'fa-solid fa-triangle-exclamation';
          } else if (level === 'moderate') {
            badge.style.background = 'linear-gradient(135deg,var(--warn),#f97316)';
            icon.className = 'fa-solid fa-exclamation';
          } else {
            badge.style.background = 'linear-gradient(135deg,var(--accent2),var(--accent1))';
            icon.className = 'fa-solid fa-check';
          }

          resultTitle.innerText = state.lang === 'ar' 
            ? (level === 'high' ? 'خطر عالي – لا تصم قبل الاستشارة' : level === 'moderate' ? 'تنبيه – راجع الطبيب' : 'خطورة منخفضة – يمكن الصيام مع احتياطات')
            : (level === 'high' ? 'High risk – avoid fasting until reviewed' : level === 'moderate' ? 'Caution – consult clinician' : 'Low risk – may fast with precautions');
          
          resultScore.innerText = state.lang === 'ar' ? `المجموع: ${total}` : `Total score: ${total}`;
          quickRecs.innerHTML = recs.map(r => `<li>${r}</li>`).join('');

          questionsSection.classList.add('hidden');
          resultSection.classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // PDF Generation
        if (downloadPdfBtn) {
          downloadPdfBtn.addEventListener('click', () => {
            try {
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF({ unit: 'pt', format: 'a4' });
              const now = new Date();

              doc.setFontSize(18);
              doc.setFont('helvetica', 'bold');
              doc.text('Soom Safety – Clinical Screening Report', 40, 60);

              doc.setFontSize(11);
              doc.setFont('helvetica', 'normal');
              doc.text(`Generated: ${now.toLocaleString()}`, 40, 86);
              doc.text(`Report language: English`, 40, 100);

              doc.setFontSize(12);
              doc.text(`Calculated total score: ${state.score}`, 40, 130);
              const levelLabel = state.score > 6 ? 'High' : (state.score >= 3.5 ? 'Moderate' : 'Low');
              doc.text(`Risk level: ${levelLabel}`, 40, 150);

              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text('Summary', 40, 185);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(11);
              
              const summary = (state.score > 6)
                ? `This assessment indicates a HIGH risk for fasting-related complications based on the provided answers. Avoid prolonged fasting until a healthcare professional evaluates your condition.`
                : (state.score >= 3.5)
                  ? `This assessment indicates a MODERATE risk. Medical review is recommended before fasting.`
                  : `This assessment indicates a LOW risk. You may consider fasting with appropriate precautions and monitoring.`;
              
              const summaryLines = doc.splitTextToSize(summary, 520);
              doc.text(summaryLines, 40, 205);

              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text('Answers summary (English):', 40, 275);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              
              const ansSummaryLines = [];
              QUESTIONS.forEach(q => {
                const chosenKey = state.selected[q.id] || '-';
                const choice = q.choices.find(c => c.key === chosenKey);
                const choiceLabel = choice ? `${choice.en} (score: ${choice.score})` : '-';
                ansSummaryLines.push(`${q.en}: ${choiceLabel}`);
              });
              
              const ansText = ansSummaryLines.join('\n');
              const ansLines = doc.splitTextToSize(ansText, 520);
              doc.text(ansLines, 40, 295);

              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text('Recommendations:', 40, 495);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(11);
              
              const recs = buildRecommendations(state.score > 6 ? 'high' : (state.score >= 3.5 ? 'moderate' : 'low'), state.score);
              const recsEnglish = recs.map(r => {
                if (r.includes('راقب') || r.includes('اكسر')) return r.includes('دوخة') ? 'Break fast and seek urgent care for severe dizziness or chest pain' : 'Monitor blood glucose frequently during fasting';
                if (r.includes('تذكير')) return 'Reminder: preliminary screening only – not a substitute for clinical assessment';
                return r;
              });
              
              const recLines = doc.splitTextToSize(recsEnglish.join('\n'), 520);
              doc.text(recLines, 40, 515);

              doc.setFontSize(9);
              doc.text('This report was produced by Soom Safety application.', 40, 770);
              doc.text('Disclaimer: This tool is a screening aid only and not a substitute for professional clinical assessment.', 40, 786);

              doc.save(`SoomSafety_Report_${now.toISOString().slice(0, 10)}.pdf`);
            } catch (e) {
              console.error('PDF error', e);
              alert('Failed to generate PDF');
            }
          });
        }

        // WhatsApp share
        if (whatsappBtn) {
          whatsappBtn.addEventListener('click', () => {
            const title = $('resultTitle').innerText;
            const score = state.score || 0;
            const recs = Array.from($('quickRecs').querySelectorAll('li')).map(li => li.innerText).slice(0, 4).join('\n- ');
            
            const arMsg = `التقييم (${new Date().toLocaleDateString()}):
الحالة: ${title}
المجموع: ${score}

أهم التوصيات:
- ${recs}

ملاحظة: تقرير فحص مبدئي.`;
            
            const enMsg = `Final assessment (${new Date().toLocaleDateString()}):
Status: ${title}
Total score: ${score}

Key recommendations:
- ${recs}

Disclaimer: Preliminary screening only.`;
            
            const msg = state.lang === 'ar' ? arMsg : enMsg;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
          });
        }

        // Start button
        startBtn.addEventListener('click', () => {
          const hero = document.querySelector('.hero-card');
          if (hero) hero.style.display = 'none';
          const heroImg = document.querySelector('.hero-image');
          if (heroImg) heroImg.style.display = 'none';
          const legal = $('legalBanner');
          if (legal) legal.style.display = 'none';
          if (questionsSection) questionsSection.classList.remove('hidden');
          state.idx = 0;
          renderCurrent('right');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Example button
        exampleBtn.addEventListener('click', () => {
          QUESTIONS.forEach((q, i) => {
            const ch = q.choices[0];
            state.answers[q.id] = parseFloat(ch.score);
            state.selected[q.id] = ch.key;
          });
          computeResult();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Restart button
        restartBtn.addEventListener('click', () => {
          state.idx = 0;
          state.answers = {};
          state.selected = {};
          state.score = 0;
          resultSection.classList.add('hidden');
          questionsSection.classList.remove('hidden');
          renderCurrent('right');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Initialize
        setLang(state.lang);
        applyTheme();

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') prevBtn.click();
          if (e.key === 'ArrowRight') nextBtn.click();
          if (e.key === 'Escape') restartBtn.click();
        });

      } catch (err) {
        console.error('Initialization error', err);
        alert('حدث خطأ أثناء تهيئة التطبيق. افتح Console للمزيد من التفاصيل.');
      }
    });