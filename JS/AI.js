// Claude Chat Application - Firebase Integrated
// Import Firebase functions
import { auth, db, listenToAuth, getUserProfile, getUserSessions } from './firestore.js';

const translations = {
  en: {
    newChat: 'New chat',
    home: 'Home',
    recent: 'Recent',
    freePlan: 'Free plan',
    messagePlaceholder: 'Message Claude...',
    replyPlaceholder: 'Reply to Claude...',
    suggest1: 'Help me write an email',
    suggest2: 'Explain a complex concept',
    suggest3: 'Analyze some data',
    suggest4: 'Write some code',
    settingsHeader: 'Settings',
    languageLabel: 'اللغة العربية (Arabic)',
    themeLabel: 'Dark mode',
    cancel: 'Cancel',
    save: 'Save',
    you: 'You',
    claude: 'Claude',
    heroText: 'How can I help you today?',
    topPlanText: 'Made by Wagdy'
  },
  ar: {
    newChat: 'محادثة جديدة',
    home: 'الرئيسية',
    recent: 'الأخيرة',
    freePlan: 'خطة مجانية',
    messagePlaceholder: 'اكتب رسالة إلى كلود...',
    replyPlaceholder: 'الرد على كلود...',
    suggest1: 'ساعدني في كتابة بريد إلكتروني',
    suggest2: 'اشرح مفهوماً معقداً',
    suggest3: 'تحليل بعض البيانات',
    suggest4: 'اكتب بعض الأكواد',
    settingsHeader: 'الإعدادات',
    languageLabel: 'اللغة الإنجليزية (English)',
    themeLabel: 'الوضع الداكن',
    cancel: 'إلغاء',
    save: 'حفظ',
    you: 'أنت',
    claude: 'كلود',
    heroText: 'كيف يمكنني مساعدتك اليوم؟',
    topPlanText: 'صنع بواسطة وجدي'
  }
};

const GEMINI_API_KEY = 'AIzaSyC0MUSZvA_ny-fU7W2_cECkly0gtJUdup8';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// User data from Firebase
let userName = '';
let userFirstName = '';
let readableAnswers = []; 
let currentUserId = null;

// App state
let currentLang = 'ar';
let currentTheme = 'light';
let conversations = [];
let currentConversationId = null;
let sidebarOpen = true;
let userScrolled = false;

// Configure marked.js for better Markdown rendering
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
  });
}

// ============================================
// FIREBASE INITIALIZATION
// ============================================

async function initializeUserData() {
  try {
    // Wait for auth state
    await new Promise((resolve) => {
      listenToAuth((user) => {
        if (user) {
          currentUserId = user.uid;
          console.log('✅ User authenticated:', currentUserId);
          resolve();
        } else {
          console.log('❌ No user logged in, redirecting...');
          window.location.href = 'login.html';
        }
      });
    });

    if (!currentUserId) return;

    // Fetch user profile
    const userProfile = await getUserProfile(currentUserId);
    if (userProfile && userProfile.name) {
      userName = userProfile.name;
      userFirstName = userName.split(' ')[0]; // Get first name for avatar
      updateUserName(userName);
      updateHeroText();
      console.log('✅ User name loaded:', userName);
    }

    // Fetch latest session
    const sessions = await getUserSessions(currentUserId, 1);
    if (sessions && sessions.length > 0) {
      const latestSession = sessions[0];
      console.log('📦 Latest session data found');
      
      // FIXED DATA FETCHING LOGIC
      // Grab whatever data exists: Array, Object, or null
      const rawData = latestSession.readableAnswers || latestSession.answers || {};

      if (Array.isArray(rawData)) {
        // It's already an array
        readableAnswers = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        // FIX: If it's an Object/Map (e.g. {Age: "25"}), convert to Array format
        readableAnswers = Object.entries(rawData).map(([key, value]) => ({
          question: key,
          answer: value
        }));
      } else {
        readableAnswers = [];
      }
      
      console.log('✅ User assessment data loaded:', readableAnswers.length, 'items');
    } else {
      console.log('ℹ️ No sessions found, using empty assessment data');
      readableAnswers = [];
    }
  } catch (error) {
    console.error('❌ Error initializing user data:', error);
    readableAnswers = [];
  }
}

// ============================================
// LOCALSTORAGE FUNCTIONS
// ============================================

function loadSettings() {
  try {
    const savedSettings = localStorage.getItem('claude_settings');
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      currentLang = settings.language || 'ar';
      currentTheme = settings.theme || 'light';
      sidebarOpen = settings.sidebarOpen !== undefined ? settings.sidebarOpen : true;
      
      applyLanguage(currentLang);
      applyTheme(currentTheme);
      setSidebarState(sidebarOpen);
      console.log('✅ Settings loaded from localStorage');
    } else {
      applyLanguage('ar');
      console.log('ℹ️ No saved settings, using defaults');
    }
  } catch (error) {
    console.log('ℹ️ Error loading settings, using Arabic defaults');
    applyLanguage('ar');
  }
}

function saveSettings() {
  try {
    const settings = {
      language: currentLang,
      theme: currentTheme,
      sidebarOpen: sidebarOpen,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('claude_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
  }
}

function loadConversations() {
  try {
    const savedConversations = localStorage.getItem('claude_conversations');
    
    if (savedConversations) {
      const data = JSON.parse(savedConversations);
      conversations = data.conversations || [];
      currentConversationId = data.currentId || null;
      renderRecentsList();
      if (currentConversationId) {
        loadConversation(currentConversationId);
      }
      console.log('✅ Conversations loaded from localStorage');
    }
  } catch (error) {
    console.log('ℹ️ No saved conversations found');
  }
}

function saveConversations() {
  try {
    const data = {
      conversations: conversations,
      currentId: currentConversationId,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('claude_conversations', JSON.stringify(data));
  } catch (error) {
    console.error('❌ Failed to save conversations:', error);
  }
}

// ============================================
// LANGUAGE & THEME
// ============================================

function applyLanguage(lang) {
  currentLang = lang;
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
  
  const t = translations[lang];
  document.getElementById('newChatText').textContent = t.newChat;
  document.getElementById('homeText').textContent = t.home;
  document.getElementById('recentHeader').textContent = t.recent;
  document.getElementById('planText').textContent = t.freePlan;
  document.getElementById('topPlanText').textContent = t.topPlanText;
  document.getElementById('mainInput').placeholder = t.messagePlaceholder;
  document.getElementById('bottomTextarea').placeholder = t.replyPlaceholder;
  document.getElementById('suggest1').textContent = t.suggest1;
  document.getElementById('suggest2').textContent = t.suggest2;
  document.getElementById('suggest3').textContent = t.suggest3;
  document.getElementById('suggest4').textContent = t.suggest4;
  document.getElementById('settingsHeader').textContent = t.settingsHeader;
  document.getElementById('languageLabel').textContent = t.languageLabel;
  document.getElementById('themeLabel').textContent = t.themeLabel;
  document.getElementById('cancelBtn').textContent = t.cancel;
  document.getElementById('saveBtn').textContent = t.save;
  
  updateHeroText();
  
  if (lang === 'en') {
    document.getElementById('languageToggle').classList.add('active');
  } else {
    document.getElementById('languageToggle').classList.remove('active');
  }
  
  const suggestions = [
    'ساعدني في كتابة بريد إلكتروني احترافي',
    'اشرح الحوسبة الكمية بعبارات بسيطة',
    'قم بتحليل هذه البيانات وإيجاد الاتجاهات',
    'اكتب دالة Python لي'
  ];
  
  const suggestionsEn = [
    'Help me write a professional email',
    'Explain quantum computing in simple terms',
    'Analyze this data and find trends',
    'Write a Python function for me'
  ];
  
  const chips = document.querySelectorAll('.suggestion-chip');
  chips.forEach((chip, index) => {
    chip.setAttribute('data-suggestion', lang === 'ar' ? suggestions[index] : suggestionsEn[index]);
  });
}

function applyTheme(theme) {
  currentTheme = theme;
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('themeToggle').classList.add('active');
  } else {
    document.body.removeAttribute('data-theme');
    document.getElementById('themeToggle').classList.remove('active');
  }
}

function updateUserName(name) {
  userName = name;
  userFirstName = name.split(' ')[0];
  document.getElementById('userName').textContent = name;
  document.getElementById('userAvatar').textContent = userFirstName.charAt(0).toUpperCase();
}

function updateHeroText() {
  const heroElement = document.getElementById('heroText');
  if (currentLang === 'ar') {
    heroElement.textContent = userFirstName ? `كيف يمكنني مساعدتك اليوم يا ${userFirstName}؟` : 'كيف يمكنني مساعدتك اليوم؟';
  } else {
    heroElement.textContent = userFirstName ? `How can I help you today, ${userFirstName}?` : 'How can I help you today?';
  }
}

// ============================================
// SIDEBAR TOGGLE
// ============================================

function setSidebarState(isOpen) {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const menuBtn = document.getElementById('menuBtn');
  
  sidebarOpen = isOpen;
  
  if (isOpen) {
    sidebar.classList.remove('closed');
    mainContent.classList.remove('expanded');
    menuBtn.classList.remove('visible');
  } else {
    sidebar.classList.add('closed');
    mainContent.classList.add('expanded');
    menuBtn.classList.add('visible');
  }
  
  saveSettings();
}

function toggleSidebar() {
  setSidebarState(!sidebarOpen);
}

// ============================================
// AUTO-RESIZE TEXTAREA
// ============================================

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// ============================================
// CONVERSATION MANAGEMENT
// ============================================

function createNewChat() {
  const newId = Date.now().toString();
  const newConv = {
    id: newId,
    title: currentLang === 'ar' ? 'محادثة جديدة' : 'New conversation',
    messages: [],
    timestamp: new Date().toISOString()
  };
  conversations.unshift(newConv);
  currentConversationId = newId;
  renderRecentsList();
  showWelcomeScreen();
  document.getElementById('mainInput').value = '';
  document.getElementById('bottomTextarea').value = '';
  saveConversations();
}

function renderRecentsList() {
  const list = document.getElementById('recentsList');
  list.innerHTML = '';
  conversations.forEach(conv => {
    const btn = document.createElement('button');
    btn.className = 'recent-item';
    if (conv.id === currentConversationId) {
      btn.classList.add('active');
    }
    btn.textContent = conv.title;
    btn.onclick = () => loadConversation(conv.id);
    list.appendChild(btn);
  });
}

function loadConversation(id) {
  currentConversationId = id;
  const conv = conversations.find(c => c.id === id);
  if (conv && conv.messages.length > 0) {
    showMessages();
    renderMessages(conv.messages);
  } else {
    showWelcomeScreen();
  }
  renderRecentsList();
}

function showWelcomeScreen() {
  document.getElementById('welcomeScreen').style.display = 'flex';
  document.getElementById('messagesArea').style.display = 'none';
  document.getElementById('bottomInput').style.display = 'none';
}

function showMessages() {
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('messagesArea').style.display = 'block';
  document.getElementById('bottomInput').style.display = 'block';
}

// ============================================
// MESSAGE RENDERING WITH MARKDOWN
// ============================================

function renderMessages(messages) {
  const area = document.getElementById('messagesArea');
  area.innerHTML = '';
  
  messages.forEach(msg => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ' + msg.role;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar ' + msg.role;
    avatar.textContent = msg.role === 'user' ? userFirstName.charAt(0).toUpperCase() : 'C';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = msg.role === 'user' ? translations[currentLang].you : translations[currentLang].claude;
    
    const text = document.createElement('div');
    text.className = 'message-text';
    
    if (msg.role === 'assistant' && typeof marked !== 'undefined') {
      try {
        text.innerHTML = marked.parse(msg.content);
      } catch (error) {
        console.error('Markdown parsing error:', error);
        text.textContent = msg.content;
      }
    } else {
      text.textContent = msg.content;
    }
    
    content.appendChild(label);
    content.appendChild(text);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    area.appendChild(msgDiv);
  });
  
  scrollToBottom(area, true);
}

function addTypingIndicator() {
  const area = document.getElementById('messagesArea');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  msgDiv.id = 'typingIndicator';
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar assistant';
  avatar.textContent = 'C';
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = translations[currentLang].claude;
  
  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  
  content.appendChild(label);
  content.appendChild(typing);
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(content);
  area.appendChild(msgDiv);
  
  scrollToBottom(area, true);
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

// ============================================
// AUTO-SCROLL FUNCTIONALITY
// ============================================

function scrollToBottom(element, smooth = true) {
  if (!userScrolled) {
    if (smooth) {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }
}

function setupScrollTracking() {
  const area = document.getElementById('messagesArea');
  let scrollTimeout;
  
  area.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
    
    if (!isNearBottom) {
      userScrolled = true;
    } else {
      userScrolled = false;
    }
    
    scrollTimeout = setTimeout(() => {
      if (isNearBottom) {
        userScrolled = false;
      }
    }, 2000);
  });
}

// ============================================
// PROMPT BUILDER WITH USER CONTEXT
// ============================================

function buildPromptWithContext(userMessage) {
  // FIXED PROMPT BUILDER
  // 1. Generate the data string variable
  let assessmentDataVariable = "";

  if (readableAnswers && readableAnswers.length > 0) {
    // Convert array to a string representation
    assessmentDataVariable = readableAnswers.map((item, index) => {
      // Handle normalized {question, answer} format from initializeUserData
      // Also handles edge cases if raw objects slipped through
      const q = item.question || item.q || item.text || `Attribute ${index + 1}`;
      const a = item.answer || item.ans || item.value || JSON.stringify(item);
      return `- ${q}: ${a}`;
    }).join("\n");
  } else {
    assessmentDataVariable = "No assessment data available.";
  }

  // 2. Fixed Prompt Template
  // Injects the variable exactly like diet.js would (as a big string block)
  const fixedTemplate = `
=== PATIENT HEALTH ASSESSMENT DATA ===
${assessmentDataVariable}
==========================================

INSTRUCTIONS: أنت مساعد صحي (Claude ) . استخدم بيانات تقييم المريض أعلاه لتقديم نصائح دقيقة وطبية وشخصية بناءً على حالتك الصحية وعوامل الخطر الخاصة بك.. جاوب باللغة العربية اذا كانت رسال المستخدم باللغة العربية وجاوب بالانجليزية اذا كانت رسالة المستخدم بالانجليزية

USER MESSAGE:
${userMessage}
`;

  console.log('📝 Prompt generated with context');
  return fixedTemplate;
}

// ============================================
// GEMINI API INTEGRATION
// ============================================

async function getGeminiResponse(userMessage, conversationHistory) {
  try {
    const contents = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    // Build the prompt using the fixed function
    const enhancedMessage = buildPromptWithContext(userMessage);
    
    contents.push({
      role: 'user',
      parts: [{ text: enhancedMessage }]
    });

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response format from Gemini');
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return currentLang === 'ar' 
      ? 'عذراً، حدث خطأ في الاتصال بالخدمة. يرجى المحاولة مرة أخرى.'
      : 'Sorry, there was an error connecting to the service. Please try again.';
  }
}

async function sendMessage(input) {
  const message = input.value.trim();
  if (!message) return;

  if (!currentConversationId) {
    createNewChat();
  }

  const conv = conversations.find(c => c.id === currentConversationId);
  
  const userMsg = {
    id: Date.now().toString(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };

  conv.messages.push(userMsg);
  
  if (conv.messages.length === 1) {
    conv.title = message.slice(0, 50);
    renderRecentsList();
  }

  input.value = '';
  autoResize(input);
  
  showMessages();
  renderMessages(conv.messages);
  addTypingIndicator();
  userScrolled = false;
  
  // Get response
  const aiResponse = await getGeminiResponse(message, conv.messages.slice(0, -1));
  
  removeTypingIndicator();
  
  const aiMsg = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  };

  conv.messages.push(aiMsg);
  renderMessages(conv.messages);
  saveConversations();
}

// ============================================
// KEYBOARD SHORTCUTS & LISTENERS
// ============================================

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === 'س')) {
      e.preventDefault();
      toggleSidebar();
    }
  });
}

document.getElementById('mainInput').addEventListener('input', function(e) {
  autoResize(e.target);
  document.getElementById('sendBtn').disabled = !e.target.value.trim();
});

document.getElementById('bottomTextarea').addEventListener('input', function(e) {
  autoResize(e.target);
  document.getElementById('bottomSendBtn').disabled = !e.target.value.trim();
});

document.getElementById('mainInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(this);
  }
});

document.getElementById('bottomTextarea').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(this);
  }
});

document.getElementById('sendBtn').addEventListener('click', function() {
  sendMessage(document.getElementById('mainInput'));
});

document.getElementById('bottomSendBtn').addEventListener('click', function() {
  sendMessage(document.getElementById('bottomTextarea'));
});

document.getElementById('newChatBtn').addEventListener('click', createNewChat);

document.getElementById('sidebarCloseBtn').addEventListener('click', function() {
  setSidebarState(false);
});

document.getElementById('menuBtn').addEventListener('click', function() {
  setSidebarState(true);
});

document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', function() {
    const suggestion = this.getAttribute('data-suggestion');
    const mainInput = document.getElementById('mainInput');
    mainInput.value = suggestion;
    document.getElementById('sendBtn').disabled = false;
    autoResize(mainInput);
    mainInput.focus();
  });
});

document.getElementById('settingsBtn').addEventListener('click', function() {
  document.getElementById('settingsOverlay').classList.add('active');
});

document.getElementById('cancelBtn').addEventListener('click', function() {
  document.getElementById('settingsOverlay').classList.remove('active');
});

document.getElementById('settingsOverlay').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

document.getElementById('saveBtn').addEventListener('click', function() {
  saveSettings();
  document.getElementById('settingsOverlay').classList.remove('active');
});

document.getElementById('languageToggle').addEventListener('click', function() {
  const newLang = currentLang === 'en' ? 'ar' : 'en';
  applyLanguage(newLang);
  saveSettings();
});

document.getElementById('themeToggle').addEventListener('click', function() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  saveSettings();
});

document.addEventListener('click', function(e) {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  
  if (window.innerWidth <= 768 && 
      !sidebar.classList.contains('closed') && 
      !sidebar.contains(e.target) && 
      e.target !== menuBtn &&
      e.target !== sidebarCloseBtn) {
    setSidebarState(false);
  }
});

window.addEventListener('resize', function() {
  if (window.innerWidth > 768 && !sidebarOpen) {
    document.getElementById('menuBtn').classList.add('visible');
  }
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initializing Claude Chat...');
  loadSettings();
  loadConversations();
  await initializeUserData();
  setupScrollTracking();
  setupKeyboardShortcuts();
  
  if (!sidebarOpen) {
    document.getElementById('menuBtn').classList.add('visible');
  }
  
  console.log('✅ Initialization complete');
});