
    // TODO: Move API key to secure backend in production
    const GEMINI_API_KEY = 'AIzaSyC0MUSZvA_ny-fU7W2_cECkly0gtJUdup8';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    // Chat history management
    let chatHistory = [];
    let isProcessing = false;

    document.addEventListener('DOMContentLoaded', function() {
      // Get elements
      const statusIcon = document.getElementById('statusIcon');
      const statusText = document.getElementById('statusText');
      const errorMessage = document.getElementById('errorMessage');
      const warningMessage = document.getElementById('warningMessage');
      const extractedSection = document.getElementById('extractedSection');
      const analysisSection = document.getElementById('analysisSection');
      const chatSection = document.getElementById('chatSection');
      const extractedTextEl = document.getElementById('extractedText');
      const analysisResultEl = document.getElementById('analysisResult');
      const chatMessages = document.getElementById('chatMessages');
      const chatInput = document.getElementById('chatInput');
      const chatSendBtn = document.getElementById('chatSendBtn');
      const printBtn = document.getElementById('printBtn');
      const downloadBtn = document.getElementById('downloadBtn');
      const toggleBtn = document.getElementById('toggleExtracted');

      // Check analysis status from localStorage
      const ocrStatus = localStorage.getItem('ocrStatus');
      const extractedText = localStorage.getItem('extractedText');
      const geminiResponse = localStorage.getItem('geminiResponse');
      const analysisError = localStorage.getItem('analysisError');
      const analysisTimestamp = localStorage.getItem('analysisTimestamp');

      // Load chat history
      const savedChatHistory = localStorage.getItem('chatHistory');
      if (savedChatHistory) {
        try {
          chatHistory = JSON.parse(savedChatHistory);
        } catch (e) {
          console.error('Error loading chat history:', e);
          chatHistory = [];
        }
      }

      // Check if data is fresh (less than 1 hour old)
      const isFreshData = analysisTimestamp && 
                         (Date.now() - parseInt(analysisTimestamp)) < (60 * 60 * 1000);

      // Handle different scenarios
      if (ocrStatus === 'fail' || analysisError) {
        // OCR or analysis failed
        showFailureState(analysisError);
        
      } else if (ocrStatus === 'success' && extractedText && geminiResponse && isFreshData) {
        // Success - show results
        showSuccessState(extractedText, geminiResponse);
        
      } else {
        // No data or old data
        showWarningState(isFreshData);
      }

      // Setup event listeners
      setupEventListeners();

      /* ==================== State Display Functions ==================== */

      function showFailureState(error) {
        statusIcon.className = 'status-icon fail';
        statusIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
        statusText.textContent = 'فشل التحليل';
        
        errorMessage.textContent = error || 
                                  'فشل استخراج النص من الصورة. يرجى التأكد من وضوح الصورة وإعادة المحاولة.';
        errorMessage.style.display = 'block';
        
        extractedSection.style.display = 'none';
        analysisSection.style.display = 'none';
        chatSection.style.display = 'none';
      }

      function showSuccessState(text, analysis) {
        statusIcon.className = 'status-icon success';
        statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        statusText.textContent = 'تم التحليل بنجاح';
        
        // Show extracted text
        extractedSection.style.display = 'block';
        extractedTextEl.textContent = text;
        
        // Show analysis
        analysisSection.style.display = 'block';
        analysisResultEl.innerHTML = formatAnalysisResult(analysis);
        
        // Show chat section
        chatSection.style.display = 'block';
        
        // Initialize chat with system context
        if (chatHistory.length === 0) {
          chatHistory.push({
            role: 'user',
            parts: [{ text: `النص المستخرج من التحليل:\n${text}` }]
          });
          chatHistory.push({
            role: 'model',
            parts: [{ text: analysis }]
          });
          saveChatHistory();
        } else {
          // Display existing chat messages
          renderChatMessages();
        }
        
        // Enable action buttons
        printBtn.disabled = false;
        downloadBtn.disabled = false;
      }

      function showWarningState(isFresh) {
        statusIcon.className = 'status-icon warning';
        statusIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
        statusText.textContent = 'لا توجد نتائج متاحة';
        
        warningMessage.textContent = isFresh === false ? 
          'البيانات المحفوظة قديمة. يرجى إجراء تحليل جديد.' :
          'لم يتم العثور على نتائج تحليل. يرجى العودة للصفحة الرئيسية وإجراء تحليل جديد.';
        warningMessage.style.display = 'block';
        
        extractedSection.style.display = 'none';
        analysisSection.style.display = 'none';
        chatSection.style.display = 'none';
      }

      /* ==================== Chat Functions ==================== */

      function renderChatMessages() {
        chatMessages.innerHTML = '';
        
        // Skip the first two messages (initial context)
        for (let i = 2; i < chatHistory.length; i++) {
          const msg = chatHistory[i];
          const msgDiv = document.createElement('div');
          msgDiv.className = `chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`;
          msgDiv.textContent = msg.parts[0].text;
          chatMessages.appendChild(msgDiv);
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      function addChatMessage(role, text, isLoading = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}${isLoading ? ' loading' : ''}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
      }

      function saveChatHistory() {
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
      }

      async function sendChatMessage(userMessage) {
        if (!userMessage.trim() || isProcessing) return;

        isProcessing = true;
        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        // Add user message to chat
        addChatMessage('user', userMessage);
        
        // Add user message to history
        chatHistory.push({
          role: 'user',
          parts: [{ text: userMessage }]
        });

        // Show loading message
        const loadingMsg = addChatMessage('assistant', 'جاري التفكير...', true);

        try {
          // Prepare request with full context
          const requestBody = {
            contents: chatHistory,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
              topP: 0.8,
              topK: 40
            }
          };

          const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            throw new Error('فشل الاتصال بخدمة التحليل');
          }

          const data = await response.json();
          const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                                  'عذراً، لم أتمكن من معالجة طلبك.';

          // Remove loading message
          loadingMsg.remove();

          // Add assistant response
          addChatMessage('assistant', assistantMessage);

          // Add to history
          chatHistory.push({
            role: 'model',
            parts: [{ text: assistantMessage }]
          });

          // Save history
          saveChatHistory();

        } catch (error) {
          console.error('Chat error:', error);
          loadingMsg.remove();
          addChatMessage('assistant', 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.');
        } finally {
          isProcessing = false;
          chatInput.disabled = false;
          chatSendBtn.disabled = false;
          chatInput.value = '';
          chatInput.focus();
        }
      }

      /* ==================== Event Listeners ==================== */

      function setupEventListeners() {
        // Toggle extracted text expansion
        if (toggleBtn) {
          toggleBtn.addEventListener('click', function() {
            extractedTextEl.classList.toggle('expanded');
            if (extractedTextEl.classList.contains('expanded')) {
              toggleBtn.innerHTML = '<i class="fas fa-compress"></i> عرض أقل';
            } else {
              toggleBtn.innerHTML = '<i class="fas fa-expand"></i> عرض المزيد';
            }
          });
        }

        // Chat send button
        if (chatSendBtn) {
          chatSendBtn.addEventListener('click', function() {
            const message = chatInput.value.trim();
            if (message) {
              sendChatMessage(message);
            }
          });
        }

        // Chat input enter key
        if (chatInput) {
          chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const message = chatInput.value.trim();
              if (message) {
                sendChatMessage(message);
              }
            }
          });
        }

        // Print functionality
        if (printBtn) {
          printBtn.addEventListener('click', function() {
            window.print();
          });
        }

        // Download functionality
        if (downloadBtn) {
          downloadBtn.addEventListener('click', function() {
            const extractedContent = extractedTextEl?.textContent || '';
            const analysisContent = analysisResultEl?.innerText || '';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            const fullContent = `نتائج التحليل الطبي\n` +
                              `التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n` +
                              `الوقت: ${new Date().toLocaleTimeString('ar-EG')}\n\n` +
                              `=====================================\n\n` +
                              `النص المستخرج من الصورة:\n` +
                              `-------------------------------------\n` +
                              `${extractedContent}\n\n` +
                              `=====================================\n\n` +
                              `التحليل الطبي المفصل:\n` +
                              `-------------------------------------\n` +
                              `${analysisContent}`;
            
            const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medical-analysis-${timestamp}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          });
        }
      }

      /* ==================== Helper Functions ==================== */

      function formatAnalysisResult(text) {
        let formatted = text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
          .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
          .replace(/^# (.*?)$/gm, '<h2>$1</h2>')
          .replace(/^\d+\.\s/gm, '<br>• ')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        
        if (!formatted.includes('<p>')) {
          formatted = '<p>' + formatted + '</p>';
        }
        
        return formatted;
      }
    });