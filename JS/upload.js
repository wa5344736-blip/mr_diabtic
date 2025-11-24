    // API Configuration
    const GEMINI_API_KEY = 'AIzaSyC0MUSZvA_ny-fU7W2_cECkly0gtJUdup8';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    // State
    let currentImage = null;
    let currentTheme = 'light';
    let currentLang = 'ar';
    let isProcessing = false;

    // Translations
    const translations = {
      ar: {
        placeholderText: 'ارفق صورة / صوّر الآن',
        uploadBtnText: 'ارفاق صورة / تصوير',
        uploadFileText: 'رفع من الجهاز',
        takePhotoText: 'تصوير مباشر',
        analyzeBtnText: 'تحليل النتيجة',
        changeBtnText: 'تغيير الصورة',
        errorSize: 'حجم الصورة كبير جداً! الحد الأقصى 8 ميجابايت',
        errorType: 'نوع الملف غير مدعوم! استخدم PNG أو JPG فقط',
        errorGeneral: 'حدث خطأ أثناء رفع الصورة',
        errorOCR: 'فشل استخراج النص من الصورة. حاول مرة أخرى',
        errorGemini: 'فشل التواصل مع خدمة التحليل. تحقق من الاتصال',
        themeLight: 'الوضع الفاتح',
        themeDark: 'الوضع الداكن',
        langToggle: 'English',
        statusPreparing: 'جاري التحضير...',
        statusLoadingOCR: 'تحميل محرك القراءة...',
        statusExtracting: 'استخراج النص من الصورة...',
        statusPrepData: 'تحضير البيانات...',
        statusSendingGemini: 'إرسال إلى الذكاء الاصطناعي...',
        statusProcessing: 'معالجة النتائج...',
        statusComplete: 'اكتمل التحليل بنجاح!',
        statusRedirecting: 'جاري الانتقال...',
        loadingImage: 'جاري تحميل الصورة...',
        imageReady: 'الصورة جاهزة للتحليل'
      },
      en: {
        placeholderText: 'Upload Image / Take Photo',
        uploadBtnText: 'Upload Image / Take Photo',
        uploadFileText: 'Upload from Device',
        takePhotoText: 'Take Photo',
        analyzeBtnText: 'Analyze Results',
        changeBtnText: 'Change Image',
        errorSize: 'Image size too large! Maximum 8MB',
        errorType: 'File type not supported! Use PNG or JPG only',
        errorGeneral: 'Error uploading image',
        errorOCR: 'Failed to extract text from image. Try again',
        errorGemini: 'Failed to connect to analysis service. Check connection',
        themeLight: 'Light Mode',
        themeDark: 'Dark Mode',
        langToggle: 'العربية',
        statusPreparing: 'Preparing...',
        statusLoadingOCR: 'Loading OCR engine...',
        statusExtracting: 'Extracting text from image...',
        statusPrepData: 'Preparing data...',
        statusSendingGemini: 'Sending to AI...',
        statusProcessing: 'Processing results...',
        statusComplete: 'Analysis completed successfully!',
        statusRedirecting: 'Redirecting...',
        loadingImage: 'Loading image...',
        imageReady: 'Image ready for analysis'
      }
    };

    // DOM Elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const themeToggle = document.getElementById('themeToggle');
    const langToggle = document.getElementById('langToggle');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadMenu = document.getElementById('uploadMenu');
    const uploadFile = document.getElementById('uploadFile');
    const takePhoto = document.getElementById('takePhoto');
    const fileInput = document.getElementById('fileInput');
    const cameraInput = document.getElementById('cameraInput');
    const placeholder = document.getElementById('placeholder');
    const previewImage = document.getElementById('previewImage');
    const deleteOverlay = document.getElementById('deleteOverlay');
    const changeBtn = document.getElementById('changeBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const errorMessage = document.getElementById('errorMessage');
    const statusMessage = document.getElementById('statusMessage');
    const progressModal = document.getElementById('progressModal');
    const progressCircleFill = document.getElementById('progressCircleFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStage = document.getElementById('progressStage');
    const progressDetails = document.getElementById('progressDetails');

    // Event Listeners - Settings
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsMenu.classList.toggle('active');
      uploadMenu.classList.remove('active');
    });

    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.body.classList.toggle('dark-theme', currentTheme === 'dark');
      updateTexts();
    });

    langToggle.addEventListener('click', () => {
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      document.documentElement.lang = currentLang;
      document.body.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
      updateTexts();
    });

    // Event Listeners - Upload
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadMenu.classList.toggle('active');
      settingsMenu.classList.remove('active');
    });

    uploadFile.addEventListener('click', () => {
      fileInput.click();
      uploadMenu.classList.remove('active');
    });

    takePhoto.addEventListener('click', () => {
      cameraInput.click();
      uploadMenu.classList.remove('active');
    });

    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    cameraInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    changeBtn.addEventListener('click', () => {
      uploadBtn.click();
    });

    deleteOverlay.addEventListener('click', () => {
      resetImageState();
    });

    document.addEventListener('click', () => {
      settingsMenu.classList.remove('active');
      uploadMenu.classList.remove('active');
    });

    settingsMenu.addEventListener('click', (e) => e.stopPropagation());
    uploadMenu.addEventListener('click', (e) => e.stopPropagation());

    // Analyze Button
    analyzeBtn.addEventListener('click', async () => {
      if (!currentImage || isProcessing) return;
      await startAnalysisFlow();
    });

    // File Handling
    function handleFileSelect(file) {
      if (!file) return;

      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        showError(translations[currentLang].errorType);
        return;
      }

      const maxSize = 8 * 1024 * 1024;
      if (file.size > maxSize) {
        showError(translations[currentLang].errorSize);
        return;
      }

      setStatus(translations[currentLang].loadingImage, 'active');
      hideError();

      const reader = new FileReader();
      reader.onload = (e) => {
        currentImage = e.target.result;
        localStorage.setItem('uploadedImage', currentImage);
        
        previewImage.src = currentImage;
        previewImage.classList.add('active');
        placeholder.style.display = 'none';
        deleteOverlay.classList.add('active');
        
        analyzeBtn.classList.add('active');
        analyzeBtn.disabled = false;
        changeBtn.classList.add('active');
        
        setStatus(translations[currentLang].imageReady, 'success');
        
        setTimeout(() => {
          statusMessage.classList.remove('active', 'success');
        }, 3000);
      };
      
      reader.onerror = () => {
        showError(translations[currentLang].errorGeneral);
        setStatus('', '');
      };
      
      reader.readAsDataURL(file);
    }

    function resetImageState() {
      currentImage = null;
      previewImage.src = '';
      previewImage.classList.remove('active');
      deleteOverlay.classList.remove('active');
      placeholder.style.display = 'flex';
      analyzeBtn.classList.remove('active');
      analyzeBtn.disabled = true;
      changeBtn.classList.remove('active');
      hideError();
      setStatus('', '');
      fileInput.value = '';
      cameraInput.value = '';
      localStorage.removeItem('uploadedImage');
    }

    // Analysis Flow
    async function startAnalysisFlow() {
      isProcessing = true;
      analyzeBtn.disabled = true;
      showProgress();
      
      try {
        updateProgress(5, translations[currentLang].statusPreparing, '');
        await sleep(300);
        
        updateProgress(10, translations[currentLang].statusLoadingOCR, '');
        await sleep(500);
        
        updateProgress(20, translations[currentLang].statusExtracting, '');
        const extractedText = await performOCR(currentImage);
        
        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error('OCR_EMPTY');
        }
        
        localStorage.setItem('extractedText', extractedText);
        localStorage.setItem('ocrStatus', 'success');
        
        updateProgress(60, translations[currentLang].statusExtracting, 
          currentLang === 'ar' ? 'تم استخراج النص بنجاح' : 'Text extracted successfully');
        await sleep(500);
        
        updateProgress(70, translations[currentLang].statusPrepData, '');
        const prompt = buildPrompt(extractedText);
        await sleep(300);
        
        updateProgress(75, translations[currentLang].statusSendingGemini, '');
        const geminiResponse = await sendToGemini(prompt);
        
        if (!geminiResponse) {
          throw new Error('GEMINI_ERROR');
        }
        
        localStorage.setItem('geminiResponse', geminiResponse);
        
        updateProgress(90, translations[currentLang].statusProcessing, '');
        await sleep(500);
        
        updateProgress(100, translations[currentLang].statusComplete, '');
        localStorage.setItem('analysisTimestamp', Date.now().toString());
        
        await sleep(800);
        
        updateProgress(100, translations[currentLang].statusRedirecting, '');
        await sleep(300);
        
        window.location.href = 'analyzing.html';
        
      } catch (error) {
        console.error('Analysis error:', error);
        hideProgress();
        
        if (error.message === 'OCR_EMPTY') {
          showError(translations[currentLang].errorOCR);
        } else if (error.message === 'GEMINI_ERROR') {
          showError(translations[currentLang].errorGemini);
        } else {
          showError(translations[currentLang].errorGeneral);
        }
        
        localStorage.setItem('ocrStatus', 'error');
        isProcessing = false;
        analyzeBtn.disabled = false;
      }
    }

    // OCR Processing
    async function performOCR(imageData) {
      try {
        updateProgress(25, translations[currentLang].statusExtracting, 
          currentLang === 'ar' ? 'تهيئة المحرك...' : 'Initializing engine...');
        
        const worker = await Tesseract.createWorker({
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const ocrProgress = Math.floor(m.progress * 35);
              updateProgress(25 + ocrProgress, translations[currentLang].statusExtracting,
                `${Math.floor(m.progress * 100)}%`);
            }
          }
        });
        
        updateProgress(30, translations[currentLang].statusExtracting, 
          currentLang === 'ar' ? 'تحميل اللغة...' : 'Loading language...');
        
        await worker.loadLanguage('eng+ara');
        await worker.initialize('eng+ara');
        
        updateProgress(35, translations[currentLang].statusExtracting, 
          currentLang === 'ar' ? 'قراءة الصورة...' : 'Reading image...');
        
        const { data: { text } } = await worker.recognize(imageData);
        await worker.terminate();
        
        return text;
      } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('OCR_EMPTY');
      }
    }

    // Build Prompt for Gemini
    function buildPrompt(extractedText) {
      return `أنت طبيب متخصص في تحليل النتائج الطبية والمختبرية. قم بتحليل النتائج التالية بشكل مفصل ومهني:

النص المستخرج من التحليل:
${extractedText}

المطلوب:
1. تحديد نوع التحليل الطبي
2. شرح كل قيمة في النتائج ومقارنتها بالمعدل الطبيعي
3. تحديد أي قيم غير طبيعية وتوضيح مدلولاتها الطبية
4. تقديم التوصيات الطبية المناسبة
5. الإشارة إلى أي فحوصات إضافية قد تكون مطلوبة
6. تقديم نصائح للمريض بناءً على النتائج
يرجى تقديم التحليل بلغة عربية واضحة ومفهومة للمريض العادي، مع الحفاظ على الدقة العلمية.`;
    }

    // Send to Gemini API
    async function sendToGemini(prompt, retryCount = 0) {
      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 40
        }
      };

      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error('API request failed');
        }

        const data = await response.json();
        const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!geminiResponse) {
          throw new Error('Empty response');
        }

        return geminiResponse;
        
      } catch (error) {
        console.error('Gemini API error:', error);
        
        if (retryCount < 2) {
          await sleep(2000);
          return sendToGemini(prompt, retryCount + 1);
        }
        
        throw new Error('GEMINI_ERROR');
      }
    }
    // Progress Modal Controls
    function showProgress() {
      progressModal.classList.add('active');
      updateProgress(0, translations[currentLang].statusPreparing, '');
    }

    function hideProgress() {
      progressModal.classList.remove('active');
      updateProgress(0, '', '');
    }

    function updateProgress(percentage, stage, details) {
      progressPercentage.textContent = `${percentage}%`;
      
      const circumference = 339.292;
      const offset = circumference - (percentage / 100) * circumference;
      progressCircleFill.style.strokeDashoffset = offset;
      
      progressStage.textContent = stage;
      progressDetails.textContent = details;
    }

    // Status Message Controls
    function setStatus(message, type) {
      statusMessage.textContent = message;
      statusMessage.className = 'status-message';
      if (type) {
        statusMessage.classList.add(type);
      }
    }

    // Error Message Controls
    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.classList.add('active');
      setTimeout(() => {
        hideError();
      }, 5000);
    }

    function hideError() {
      errorMessage.classList.remove('active');
    }

    // Utility Functions
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function updateTexts() {
      const t = translations[currentLang];

      document.getElementById('placeholderText').textContent = t.placeholderText;
      document.getElementById('uploadBtnText').textContent = t.uploadBtnText;
      document.getElementById('uploadFileText').textContent = t.uploadFileText;
      document.getElementById('takePhotoText').textContent = t.takePhotoText;
      document.getElementById('analyzeBtnText').textContent = t.analyzeBtnText;
      document.getElementById('changeBtnText').textContent = t.changeBtnText;
      document.getElementById('langText').textContent = t.langToggle;
      document.getElementById('themeText').textContent = currentTheme === 'light' ? t.themeDark : t.themeLight;
    }

    // Initialization
    updateTexts();
    localStorage.removeItem('extractedText');
    localStorage.removeItem('ocrStatus');
    localStorage.removeItem('geminiResponse');
    
    console.log('Main page initialized successfully');