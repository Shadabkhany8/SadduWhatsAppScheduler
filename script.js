/**
 * Saddu WhatsApp Scheduler
 * Production-ready Vanilla JavaScript Application
 * 100% Static Client-Side • LocalStorage • Zero External Dependencies
 */

(() => {
  "use strict";

  // ================= STORAGE KEYS & CONSTANTS =================
  const STORAGE_KEYS = {
    REMINDERS: "saddu_reminders_v2",
    CONTACTS: "saddu_contacts_v2",
    SETTINGS: "saddu_settings_v2",
    LEGACY: "saddu_whatsapp_scheduler_v1"
  };

  const DEFAULT_SETTINGS = {
    soundEnabled: true,
    defaultCountryCode: "91",
    theme: "light",
    geminiApiKey: ""
  };

  // Helper selector shorthand
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ================= WEB AUDIO SYNTHESIZER (NO EXTERNAL FILES) =================
  const AudioChime = {
    ctx: null,
    init() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext && !this.ctx) {
          this.ctx = new AudioContext();
        }
      } catch (e) {
        console.warn("Web Audio API not supported", e);
      }
    },
    play() {
      try {
        if (!State.settings.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") {
          this.ctx.resume();
        }
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Pleasant WhatsApp-like double chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.12); // A5

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.46);
      } catch (err) {
        console.warn("Could not play audio tone", err);
      }
    }
  };

  // ================= STATE & DATA STORE =================
  const State = {
    reminders: [],
    contacts: [],
    settings: { ...DEFAULT_SETTINGS },
    activeView: "dashboard",
    activeReminderFilter: "all",
    reminderSearchQuery: "",
    reminderSortBy: "dueSoonest",
    contactSearchQuery: "",
    dueAlertQueue: [],

    init() {
      this.loadSettings();
      this.loadContacts();
      this.loadReminders();
    },

    loadSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (raw) {
          this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        }
      } catch (e) {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    },

    saveSettings() {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      } catch (e) {
        console.error("Failed to save settings", e);
      }
    },

    loadContacts() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CONTACTS);
        this.contacts = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this.contacts)) this.contacts = [];
      } catch (e) {
        this.contacts = [];
      }
    },

    saveContacts() {
      try {
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(this.contacts));
      } catch (e) {
        console.error("Failed to save contacts", e);
      }
    },

    loadReminders() {
      try {
        let raw = localStorage.getItem(STORAGE_KEYS.REMINDERS);
        if (!raw) {
          // Check for legacy data migration
          const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY);
          if (legacy) {
            raw = legacy;
            localStorage.setItem(STORAGE_KEYS.REMINDERS, legacy);
          }
        }
        this.reminders = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this.reminders)) this.reminders = [];
      } catch (e) {
        this.reminders = [];
      }
    },

    saveReminders() {
      try {
        localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(this.reminders));
      } catch (e) {
        console.error("Failed to save reminders", e);
      }
    }
  };

  // ================= UTILITY FUNCTIONS =================
  const Utils = {
    escapeHtml(str) {
      if (!str) return "";
      return String(str).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c]));
    },

    normalizePhone(raw) {
      if (!raw) return "";
      return String(raw).replace(/\D/g, "");
    },

    formatPhoneInternational(digits) {
      if (!digits) return "";
      const cleaned = this.normalizePhone(digits);
      if (cleaned.startsWith("91") && cleaned.length === 12) {
        return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
      }
      if (cleaned.startsWith("1") && cleaned.length === 11) {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
      }
      if (cleaned.startsWith("44") && cleaned.length >= 11) {
        return `+44 ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
      }
      return `+${cleaned}`;
    },

    composeRepeatedMessage(text, count) {
      const cleanText = (text || "").trim();
      const n = Math.min(100, Math.max(1, parseInt(count, 10) || 1));
      if (n === 1) return cleanText;
      return Array(n).fill(cleanText).join("\n");
    },

    buildWhatsAppUrl(phone, text, count = 1) {
      const digits = this.normalizePhone(phone);
      const fullMessage = this.composeRepeatedMessage(text, count);
      return `https://wa.me/${digits}?text=${encodeURIComponent(fullMessage)}`;
    },

    formatDateTime(isoStr) {
      if (!isoStr) return "";
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        });
      } catch (e) {
        return isoStr;
      }
    },

    formatTimeOnly(isoStr) {
      if (!isoStr) return "";
      try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        return "";
      }
    },

    getRelativeTime(isoStr) {
      const now = Date.now();
      const target = new Date(isoStr).getTime();
      const diffMs = target - now;
      const absDiff = Math.abs(diffMs);
      const diffMins = Math.round(absDiff / 60000);
      const diffHours = Math.round(absDiff / 3600000);
      const diffDays = Math.round(absDiff / 86400000);

      if (diffMs > 0) {
        if (diffMins < 1) return "due in seconds";
        if (diffMins < 60) return `in ${diffMins} min${diffMins === 1 ? "" : "s"}`;
        if (diffHours < 24) return `in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
        return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
      } else {
        if (diffMins < 1) return "due right now";
        if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
        return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
      }
    },

    generateId() {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return "id_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    },

    findContactByPhone(phone) {
      const digits = this.normalizePhone(phone);
      return State.contacts.find(c => this.normalizePhone(c.phone) === digits);
    }
  };

  // ================= TOAST NOTIFICATIONS =================
  const Toast = {
    show(message, type = "info", duration = 3200) {
      const container = $("toastContainer");
      if (!container) return;

      const toast = document.createElement("div");
      toast.className = `toast ${type === "error" ? "toast-error" : type === "warning" ? "toast-warning" : ""}`;

      const icon = type === "error" ? "⚠️" : type === "warning" ? "🔔" : "✓";
      toast.innerHTML = `<span>${icon}</span><span>${Utils.escapeHtml(message)}</span>`;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 320);
      }, duration);
    }
  };

  // ================= MODAL MANAGER =================
  const Modals = {
    open(modalId) {
      const el = $(modalId);
      if (el) {
        el.style.display = "flex";
      }
    },
    close(modalId) {
      const el = $(modalId);
      if (el) {
        el.style.display = "none";
      }
    },
    confirm({ title = "Confirm Action", message = "Are you sure?", onConfirm }) {
      $("confirmModalTitle").textContent = title;
      $("confirmModalMessage").textContent = message;
      this.open("confirmModalBackdrop");

      const acceptBtn = $("btnConfirmAccept");
      const cancelBtn = $("btnConfirmCancel");
      const closeBtn = $("btnCloseConfirmModal");

      const cleanup = () => {
        acceptBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
        Modals.close("confirmModalBackdrop");
      };

      acceptBtn.onclick = () => {
        cleanup();
        if (typeof onConfirm === "function") onConfirm();
      };
      cancelBtn.onclick = cleanup;
      closeBtn.onclick = cleanup;
    }
  };

  // ================= THEME MANAGER (DARK / LIGHT / SYSTEM) =================
  const ThemeManager = {
    init() {
      const savedTheme = State.settings.theme || "light";
      this.applyTheme(savedTheme, false);

      try {
        if (window.matchMedia) {
          window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (State.settings.theme === "auto") {
              this.applyTheme("auto", false);
            }
          });
        }
      } catch (e) {}

      const sidebarToggle = $("sidebarThemeToggleBtn");
      const mobileToggle = $("mobileThemeToggleBtn");

      const toggleAction = () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "dark" ? "light" : "dark";
        this.applyTheme(next, true);
        Toast.show(next === "dark" ? "Dark Mode activated 🌙" : "Light Mode activated ☀️");
      };

      if (sidebarToggle) sidebarToggle.addEventListener("click", toggleAction);
      if (mobileToggle) mobileToggle.addEventListener("click", toggleAction);
    },

    applyTheme(theme, save = true) {
      let resolved = theme;
      if (theme === "auto") {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        resolved = prefersDark ? "dark" : "light";
      }

      document.documentElement.setAttribute("data-theme", resolved);
      document.body.setAttribute("data-theme", resolved);

      const isDark = resolved === "dark";
      const icon = isDark ? "☀️" : "🌙";
      const title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";

      const sidebarIcon = $("sidebarThemeIcon");
      if (sidebarIcon) sidebarIcon.textContent = icon;
      const sidebarBtn = $("sidebarThemeToggleBtn");
      if (sidebarBtn) sidebarBtn.title = title;

      const mobileIcon = $("mobileThemeIcon");
      if (mobileIcon) mobileIcon.textContent = icon;
      const mobileBtn = $("mobileThemeToggleBtn");
      if (mobileBtn) mobileBtn.title = title;

      const settingSelect = $("settingThemeSelect");
      if (settingSelect && settingSelect.value !== theme) {
        settingSelect.value = theme;
      }

      if (save) {
        State.settings.theme = theme;
        State.saveSettings();
      }
    }
  };

  // ================= SADDU AI STUDIO (SPELL CHECK & SMART EXPANSION) =================
  const AiStudio = {
    typoDict: {
      "teh": "the", "recipt": "receipt", "meting": "meeting", "meetng": "meeting",
      "tommorow": "tomorrow", "tommorrow": "tomorrow", "tomorow": "tomorrow",
      "scheduale": "schedule", "schedul": "schedule", "scedule": "schedule",
      "pls": "please", "plz": "please", "pleez": "please", "thx": "thank you",
      "tq": "thank you", "thanx": "thank you", "asap": "as soon as possible",
      "ur": "your", "u": "you", "r": "are", "msg": "message", "msz": "message",
      "attn": "attention", "appmnt": "appointment", "apmt": "appointment",
      "feez": "fees", "fess": "fees", "bday": "birthday", "brthday": "birthday",
      "b'day": "birthday", "cll": "call", "wrk": "work", "imp": "important",
      "imprtant": "important", "urgnt": "urgent", "urget": "urgent",
      "attnd": "attend", "remindr": "reminder", "rember": "remember", "cancle": "cancel",
      "cncl": "cancel", "availble": "available", "avalable": "available", "doc": "doctor",
      "hosp": "hospital", "hppy": "happy", "congrats": "congratulations",
      "gud": "good", "mrg": "morning", "mrng": "morning", "nyt": "night",
      "wud": "would", "cud": "could", "shud": "should", "abt": "about",
      "bcz": "because", "coz": "because"
    },

    fixSpelling(text) {
      if (!text || !text.trim()) return text;
      let words = text.split(/(\s+|[.,!?;:()]+)/);
      for (let i = 0; i < words.length; i++) {
        const lower = words[i].toLowerCase();
        if (this.typoDict[lower]) {
          const replacement = this.typoDict[lower];
          if (words[i][0] === words[i][0].toUpperCase() && words[i].length > 1) {
            words[i] = replacement.charAt(0).toUpperCase() + replacement.slice(1);
          } else {
            words[i] = replacement;
          }
        }
      }
      let cleaned = words.join("");
      cleaned = cleaned.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
      return cleaned;
    },

    expandSmart(rawText, tone = "expand") {
      const trimmed = (rawText || "").trim();
      const cleaned = this.fixSpelling(trimmed);
      const lower = cleaned.toLowerCase();
      const isShort = lower.split(/\s+/).filter(Boolean).length <= 4;

      if (isShort) {
        if (/^(meeting|meet|discuss|discussion)$/.test(lower) || lower.includes("meeting")) {
          return "Hello! 👋 Just wanted to confirm our upcoming meeting. Could you please confirm if the scheduled time works for you? Looking forward to connecting.";
        }
        if (/^(fees|fee|due|payment|invoice|bill)$/.test(lower) || lower.includes("fee") || lower.includes("payment")) {
          return "Dear recipient, this is a gentle reminder regarding the pending fee/payment due. Kindly make the payment at your earliest convenience. If already paid, please ignore this notice. Thank you! 🙏";
        }
        if (/^(birthday|bday|b'day|hbd)$/.test(lower) || lower.includes("birthday")) {
          return "🎉 Wishing you a very Happy Birthday! 🎂 May your day be filled with joy, happiness, success, and prosperity. Have a wonderful celebration!";
        }
        if (/^(late|delay|stuck|traffic)$/.test(lower) || lower.includes("late")) {
          return "Hi, I am running a little late due to unexpected traffic/delays. I will be there in about 15-20 minutes. Apologies for the inconvenience!";
        }
        if (/^(call|call me|dial|phone)$/.test(lower) || lower.includes("call me")) {
          return "Hello, I tried reaching out to you. Whenever you are free, could you please give me a quick call? It is regarding an important update. Thanks!";
        }
        if (/^(urgent|emergency|asap|important)$/.test(lower) || lower.includes("urgent")) {
          return "⚠️ *URGENT*: Please review this message immediately and get back to me as soon as possible. Your prompt response is appreciated.";
        }
        if (/^(thanks|thank you|thx|gratitude)$/.test(lower) || lower.includes("thank")) {
          return "Thank you so much for your kind support and assistance! It is truly appreciated. Have a wonderful day ahead! 🙏✨";
        }
        if (/^(appointment|doctor|checkup|visit)$/.test(lower) || lower.includes("appointment") || lower.includes("doctor")) {
          return "Hello, this is a reminder regarding our scheduled appointment. Please ensure to arrive 10 minutes early. Let me know if you need to reschedule. Thank you!";
        }
      }

      switch (tone) {
        case "fixSpelling":
          return cleaned || "Hello, I hope you are having a productive day.";

        case "professional":
          return `Dear Sir/Madam,\n\nI am writing to kindly bring to your attention:\n${cleaned || "our scheduled discussion"}.\n\nPlease review and let me know your thoughts at your earliest convenience.\n\nBest regards.`;

        case "friendly":
          return `Hey there! 😊 Hope you're having an awesome day.\n\nJust wanted to reach out regarding: ${cleaned || "our catch-up"}.\n\nLet's connect soon! 🙌`;

        case "urgent":
          return `⚠️ *URGENT & IMPORTANT* ⚠️\n\n${cleaned || "Immediate attention required."}\n\nPlease review this as soon as possible and acknowledge. Thank you!`;

        case "polite":
          return `Namaste / Hello 🙏,\n\nI humbly request a moment of your time regarding: ${cleaned || "our pending matter"}.\n\nThank you very much for your understanding and continuous support.`;

        case "hinglish":
          return `Bhai/Dost, ek quick update tha:\n"${cleaned || "Apna kaam discuss karna hai"}"\n\nFree hote hi please check kar lena aur reply dena. Thanks! 👍`;

        case "expand":
        default:
          if (!cleaned) {
            return "Hello! Hope this message finds you well. Just checking in with you. Have a great day ahead!";
          }
          return `Hello! Just following up regarding: *${cleaned}*.\n\nPlease check and update me whenever you are free. Thank you!`;
      }
    },

    async enhance(rawText, tone = "expand") {
      const apiKey = State.settings.geminiApiKey ? State.settings.geminiApiKey.trim() : "";

      if (apiKey) {
        try {
          const prompt = `You are an AI WhatsApp messaging assistant. Rewrite this into a polished WhatsApp message.
Tone: ${tone}.
Rule: If the input is just 1 or 2 words (like 'fees', 'meeting', 'late'), expand it into a complete, professional and clear WhatsApp message with suitable emojis and WhatsApp formatting (*bold*).
Return ONLY the final message text without markdown fences or quotes.

Input: "${rawText || "greeting"}"`;

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidate && candidate.trim()) {
              return candidate.trim();
            }
          }
        } catch (err) {
          console.warn("Gemini API call failed, using offline smart engine:", err);
        }
      }

      return this.expandSmart(rawText, tone);
    }
  };

  // ================= WHATSAPP FORMATTING & VOICE DICTATION =================
  const FormattingToolbar = {
    recognition: null,
    isRecording: false,

    init() {
      this.bindFormatButtons();
      this.bindEmojiButtons();
      this.bindVoiceDictation();
    },

    insertAtCursor(before, after = "") {
      const textarea = $("messageBody");
      if (!textarea) return;

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const val = textarea.value;
      const selected = val.substring(start, end);

      const replacement = before + (selected || "") + after;
      textarea.value = val.substring(0, start) + replacement + val.substring(end);

      const newCursorPos = selected ? start + replacement.length : start + before.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);

      textarea.dispatchEvent(new Event("input"));
    },

    bindFormatButtons() {
      const boldBtn = $("btnFmtBold");
      const italicBtn = $("btnFmtItalic");
      const strikeBtn = $("btnFmtStrike");
      const monoBtn = $("btnFmtMono");

      if (boldBtn) boldBtn.addEventListener("click", () => this.insertAtCursor("*", "*"));
      if (italicBtn) italicBtn.addEventListener("click", () => this.insertAtCursor("_", "_"));
      if (strikeBtn) strikeBtn.addEventListener("click", () => this.insertAtCursor("~", "~"));
      if (monoBtn) monoBtn.addEventListener("click", () => this.insertAtCursor("```", "```"));
    },

    bindEmojiButtons() {
      $$(".emoji-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const emoji = btn.getAttribute("data-emoji");
          if (emoji) {
            this.insertAtCursor(emoji, "");
          }
        });
      });
    },

    bindVoiceDictation() {
      const voiceBtn = $("btnVoiceDictate");
      const micLabel = $("voiceMicLabel");
      if (!voiceBtn) return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        voiceBtn.title = "Voice dictation not supported in this browser (Use Chrome or Edge)";
        voiceBtn.addEventListener("click", () => {
          Toast.show("Voice dictation is supported in Google Chrome, Edge, and Android Chrome.", "warning");
        });
        return;
      }

      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = navigator.language || "en-US";

        this.recognition.onstart = () => {
          this.isRecording = true;
          voiceBtn.classList.add("is-recording");
          if (micLabel) micLabel.textContent = "Listening...";
          Toast.show("🎙️ Listening... Speak your message now.");
        };

        this.recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            const textarea = $("messageBody");
            if (textarea) {
              const current = textarea.value.trim();
              textarea.value = current ? `${current} ${transcript}` : transcript;
              textarea.dispatchEvent(new Event("input"));
            }
            Toast.show(`Heard: "${transcript}"`);
          }
        };

        this.recognition.onerror = (event) => {
          console.warn("Speech recognition error:", event.error);
          this.stopRecording();
          Toast.show(`Voice dictation error: ${event.error}`, "warning");
        };

        this.recognition.onend = () => {
          this.stopRecording();
        };

        voiceBtn.addEventListener("click", () => {
          if (this.isRecording) {
            try { this.recognition.stop(); } catch (e) {}
            this.stopRecording();
          } else {
            try {
              this.recognition.start();
            } catch (err) {
              this.stopRecording();
            }
          }
        });
      } catch (err) {
        console.warn("Speech recognition init failed:", err);
      }
    },

    stopRecording() {
      this.isRecording = false;
      const voiceBtn = $("btnVoiceDictate");
      const micLabel = $("voiceMicLabel");
      if (voiceBtn) voiceBtn.classList.remove("is-recording");
      if (micLabel) micLabel.textContent = "Speak";
    }
  };

  // ================= ROUTER / NAVIGATION =================
  const Router = {
    views: ["dashboard", "compose", "reminders", "contacts", "settings"],

    init() {
      window.addEventListener("hashchange", () => this.handleHash());
      this.handleHash();
      this.bindNavClicks();
    },

    handleHash() {
      let hash = window.location.hash.replace(/^#/, "");
      if (!this.views.includes(hash)) {
        hash = "dashboard";
      }
      this.navigate(hash, false);
    },

    navigate(viewName, updateHash = true) {
      if (!this.views.includes(viewName)) return;
      State.activeView = viewName;

      // Update Views visibility
      this.views.forEach(name => {
        const viewEl = $(`view-${name}`);
        if (viewEl) {
          viewEl.classList.toggle("active", name === viewName);
        }
      });

      // Update sidebar nav items
      $$(".sidebar-nav .nav-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-view") === viewName);
      });

      // Update mobile nav items
      $$(".mobile-nav .mobile-nav-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-view") === viewName);
      });

      if (updateHash) {
        window.location.hash = `#${viewName}`;
      }

      // View-specific onEnter refreshes
      if (viewName === "dashboard") {
        DashboardView.render();
      } else if (viewName === "reminders") {
        RemindersView.render();
      } else if (viewName === "contacts") {
        ContactsView.render();
      } else if (viewName === "settings") {
        SettingsView.render();
      } else if (viewName === "compose") {
        ComposerView.populateContactDropdown();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    },

    bindNavClicks() {
      document.addEventListener("click", (e) => {
        const navTarget = e.target.closest("[data-view]");
        if (navTarget) {
          const view = navTarget.getAttribute("data-view");
          if (view) {
            e.preventDefault();
            this.navigate(view, true);
          }
        }
      });
    }
  };

  // ================= COMPOSER VIEW =================
  const ComposerView = {
    init() {
      this.form = $("fullScheduleForm");
      this.phoneInput = $("phoneNumber");
      this.countryCodeSelect = $("countryCodeSelect");
      this.countryCodeDisplay = $("countryCodeDisplay");
      this.contactSelector = $("contactSelector");
      this.saveContactCheckbox = $("saveAsNewContact");
      this.newContactNameField = $("newContactNameField");
      this.newContactName = $("newContactName");
      this.messageBody = $("messageBody");
      this.charCounter = $("charCounter");
      this.repeatSlider = $("repeatSlider");
      this.repeatCount = $("repeatCount");
      this.repeatCountBadge = $("repeatCountBadge");
      this.scheduleDate = $("scheduleDate");
      this.scheduleTime = $("scheduleTime");
      this.scheduleDateTime = $("scheduleDateTime");

      this.previewBubbleText = $("previewBubbleText");
      this.previewBubbleTime = $("previewBubbleTime");
      this.previewRecipientName = $("previewRecipientName");
      this.summaryPhone = $("summaryPhone");
      this.summaryWhen = $("summaryWhen");
      this.summaryRepeat = $("summaryRepeat");
      this.summaryLength = $("summaryLength");

      this.bindEvents();
      this.setDefaultDateTime();
      this.updateCountryCode();
      this.updatePreview();
    },

    toLocalDateStr(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    },

    toLocalTimeStr(d) {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    },

    setDefaultDateTime(offsetMinutes = 15) {
      const target = new Date(Date.now() + offsetMinutes * 60 * 1000);
      const dateStr = this.toLocalDateStr(target);
      const timeStr = this.toLocalTimeStr(target);

      if (this.scheduleDate) {
        this.scheduleDate.value = dateStr;
        this.scheduleDate.min = this.toLocalDateStr(new Date());
      }
      if (this.scheduleTime) {
        this.scheduleTime.value = timeStr;
      }
      if (this.scheduleDateTime) {
        this.scheduleDateTime.value = `${dateStr}T${timeStr}`;
      }
      this.updatePreview();
    },

    syncFromDateAndTime() {
      const dateVal = this.scheduleDate ? this.scheduleDate.value : "";
      const timeVal = this.scheduleTime ? this.scheduleTime.value : "";
      if (dateVal && timeVal && this.scheduleDateTime) {
        this.scheduleDateTime.value = `${dateVal}T${timeVal}`;
      }
      this.updatePreview();
    },

    updateCountryCode() {
      const val = this.countryCodeSelect.value;
      if (val === "custom") {
        this.countryCodeDisplay.textContent = "+";
      } else {
        this.countryCodeDisplay.textContent = `+${val}`;
      }
      this.updatePreview();
    },

    populateContactDropdown() {
      const select = this.contactSelector;
      const currentVal = select.value;
      select.innerHTML = `<option value="">-- Select a contact or enter number manually --</option>`;

      State.contacts.forEach(contact => {
        const opt = document.createElement("option");
        opt.value = contact.phone;
        opt.textContent = `${contact.name} (${Utils.formatPhoneInternational(contact.phone)})${contact.tag ? ` [${contact.tag}]` : ""}`;
        select.appendChild(opt);
      });

      if (currentVal) select.value = currentVal;
    },

    bindEvents() {
      // Country code change
      this.countryCodeSelect.addEventListener("change", () => {
        this.updateCountryCode();
      });

      // Contact selector change
      this.contactSelector.addEventListener("change", () => {
        const selectedPhone = this.contactSelector.value;
        if (selectedPhone) {
          const contact = State.contacts.find(c => c.phone === selectedPhone);
          if (contact) {
            this.setRecipientFromContact(contact);
          }
        }
      });

      // Toggle new contact name field
      this.saveContactCheckbox.addEventListener("change", () => {
        this.newContactNameField.style.display = this.saveContactCheckbox.checked ? "block" : "none";
      });

      // Live preview inputs
      [this.phoneInput, this.messageBody].forEach(input => {
        input.addEventListener("input", () => this.updatePreview());
      });

      // Repeat slider & number sync
      this.repeatSlider.addEventListener("input", () => {
        this.repeatCount.value = this.repeatSlider.value;
        this.updatePreview();
      });

      this.repeatCount.addEventListener("input", () => {
        let val = parseInt(this.repeatCount.value, 10) || 1;
        val = Math.max(1, Math.min(100, val));
        this.repeatSlider.value = val;
        this.updatePreview();
      });

      // Custom Date & Time listeners
      if (this.scheduleDate) {
        this.scheduleDate.addEventListener("input", () => this.syncFromDateAndTime());
        this.scheduleDate.addEventListener("change", () => this.syncFromDateAndTime());
      }
      if (this.scheduleTime) {
        this.scheduleTime.addEventListener("input", () => this.syncFromDateAndTime());
        this.scheduleTime.addEventListener("change", () => this.syncFromDateAndTime());
      }

      // Time shortcut buttons
      $$(".btn-time-shortcut").forEach(btn => {
        btn.addEventListener("click", () => {
          const offset = btn.getAttribute("data-offset");
          const preset = btn.getAttribute("data-preset");

          if (offset) {
            this.setDefaultDateTime(parseInt(offset, 10));
            Toast.show(`Set to +${offset} minutes from now`);
          } else if (preset === "tonight") {
            const tonight = new Date();
            tonight.setHours(20, 0, 0, 0);
            if (tonight.getTime() <= Date.now()) {
              tonight.setDate(tonight.getDate() + 1);
            }
            if (this.scheduleDate) this.scheduleDate.value = this.toLocalDateStr(tonight);
            if (this.scheduleTime) this.scheduleTime.value = "20:00";
            if (this.scheduleDateTime) this.scheduleDateTime.value = `${this.toLocalDateStr(tonight)}T20:00`;
            this.updatePreview();
            Toast.show("Set to Tonight 8:00 PM");
          } else if (preset === "tomorrow9") {
            const tom = new Date();
            tom.setDate(tom.getDate() + 1);
            tom.setHours(9, 0, 0, 0);
            if (this.scheduleDate) this.scheduleDate.value = this.toLocalDateStr(tom);
            if (this.scheduleTime) this.scheduleTime.value = "09:00";
            if (this.scheduleDateTime) this.scheduleDateTime.value = `${this.toLocalDateStr(tom)}T09:00`;
            this.updatePreview();
            Toast.show("Set to Tomorrow 9:00 AM");
          }
        });
      });

      // AI Studio Enhance Button
      const btnAiEnhance = $("btnAiEnhance");
      const aiToneSelect = $("aiToneSelect");
      const aiEnhanceLabel = $("aiEnhanceLabel");

      if (btnAiEnhance) {
        btnAiEnhance.addEventListener("click", async () => {
          const currentText = this.messageBody.value;
          const tone = aiToneSelect ? aiToneSelect.value : "expand";

          if (aiEnhanceLabel) aiEnhanceLabel.textContent = "Thinking...";
          btnAiEnhance.disabled = true;

          try {
            const enhanced = await AiStudio.enhance(currentText, tone);
            this.messageBody.value = enhanced;
            this.updatePreview();
            Toast.show("✨ Message enhanced by Saddu AI!");
          } catch (e) {
            Toast.show("Could not enhance message.", "error");
          } finally {
            if (aiEnhanceLabel) aiEnhanceLabel.textContent = "AI Magic";
            btnAiEnhance.disabled = false;
          }
        });
      }

      // AI Quick Keyword Chips
      $$(".ai-kw-chip").forEach(chip => {
        chip.addEventListener("click", async () => {
          const kw = chip.getAttribute("data-kw") || chip.textContent.trim();
          this.messageBody.value = kw;
          const tone = aiToneSelect ? aiToneSelect.value : "expand";
          const enhanced = await AiStudio.enhance(kw, tone);
          this.messageBody.value = enhanced;
          this.updatePreview();
          Toast.show(`✨ AI generated message for "${kw}"!`);
        });
      });

      // Template chips
      $$(".template-chips .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const tpl = chip.getAttribute("data-tpl");
          const templates = {
            meeting: "Hi! Just a friendly reminder about our upcoming meeting scheduled for today. Looking forward to connecting with you!",
            birthday: "Wishing you a very Happy Birthday! 🎉 May your day be filled with happiness, laughter, and great memories!",
            payment: "Hello, this is a gentle reminder regarding the pending invoice/payment. Please let me know once processed. Thank you!",
            checkin: "Hey there! Hope you are having a wonderful week. Just checking in to see how everything is going with you.",
            clear: ""
          };
          if (tpl in templates) {
            this.messageBody.value = templates[tpl];
            this.updatePreview();
            if (tpl !== "clear") Toast.show("Template loaded!");
          }
        });
      });

      // Test WhatsApp link button
      $("btnTestOpenWA").addEventListener("click", () => {
        const fullPhone = this.getFullPhone();
        const msg = this.messageBody.value.trim();
        const count = parseInt(this.repeatCount.value, 10) || 1;

        if (fullPhone.length < 8) {
          Toast.show("Please enter a valid phone number first", "warning");
          this.phoneInput.focus();
          return;
        }
        if (!msg) {
          Toast.show("Please type a message first", "warning");
          this.messageBody.focus();
          return;
        }

        const url = Utils.buildWhatsAppUrl(fullPhone, msg, count);
        window.open(url, "_blank", "noopener,noreferrer");
        Toast.show("Opening WhatsApp preview in new tab...");
      });

      // Form submission
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveReminder();
      });
    },

    setRecipientFromContact(contact) {
      const cleaned = Utils.normalizePhone(contact.phone);
      // Auto match country code
      const codes = ["91", "1", "44", "971", "966", "61", "62", "55", "49", "33"];
      let matchedCode = "custom";
      let localNumber = cleaned;

      for (const code of codes) {
        if (cleaned.startsWith(code) && cleaned.length > code.length) {
          matchedCode = code;
          localNumber = cleaned.slice(code.length);
          break;
        }
      }

      this.countryCodeSelect.value = matchedCode;
      this.updateCountryCode();
      this.phoneInput.value = localNumber;
      this.updatePreview();
      Toast.show(`Selected contact: ${contact.name}`);
    },

    getFullPhone() {
      const code = this.countryCodeSelect.value === "custom" ? "" : this.countryCodeSelect.value;
      const rawNumber = Utils.normalizePhone(this.phoneInput.value);
      if (!code) return rawNumber;
      if (rawNumber.startsWith(code)) return rawNumber;
      return `${code}${rawNumber}`;
    },

    updatePreview() {
      const fullPhone = this.getFullPhone();
      const rawMsg = this.messageBody.value;
      const cleanMsg = rawMsg.trim();
      const count = Math.min(100, Math.max(1, parseInt(this.repeatCount.value, 10) || 1));

      // Character count
      this.charCounter.textContent = `${rawMsg.length} / 2000`;
      this.repeatCountBadge.textContent = `${count}x`;

      // Matching contact
      const contact = Utils.findContactByPhone(fullPhone);
      const displayName = contact ? `${contact.name} (${Utils.formatPhoneInternational(fullPhone)})` : (fullPhone ? Utils.formatPhoneInternational(fullPhone) : "+91 ...");
      this.previewRecipientName.textContent = displayName;
      this.summaryPhone.textContent = fullPhone ? Utils.formatPhoneInternational(fullPhone) : "Not specified";

      // Bubble content with repeated text logic
      if (!cleanMsg) {
        this.previewBubbleText.textContent = "Your composed message will appear here in real time...";
        this.summaryLength.textContent = "0 characters";
      } else {
        if (count === 1) {
          this.previewBubbleText.textContent = cleanMsg;
          this.summaryLength.textContent = `${cleanMsg.length} characters (1 copy)`;
        } else {
          // Truncated preview inside bubble to stay readable
          const previewSnippet = `${cleanMsg}\n\n[... Repeated ${count} times in one composed WhatsApp message ...]`;
          this.previewBubbleText.textContent = previewSnippet;
          const totalEstimatedLen = (cleanMsg.length + 1) * count - 1;
          this.summaryLength.textContent = `~${totalEstimatedLen} characters (${count} repetitions in 1 message)`;
        }
      }

      this.summaryRepeat.textContent = count === 1 ? "1 copy" : `${count} copies inside 1 message`;

      // Schedule time preview
      const scheduledVal = this.scheduleDateTime.value;
      if (scheduledVal) {
        const d = new Date(scheduledVal);
        this.previewBubbleTime.textContent = Utils.formatTimeOnly(scheduledVal) || "12:00 PM";
        this.summaryWhen.textContent = Utils.formatDateTime(scheduledVal);
      } else {
        this.summaryWhen.textContent = "Not selected";
      }
    },

    saveReminder() {
      const fullPhone = this.getFullPhone();
      const rawMsg = this.messageBody.value.trim();
      const count = Math.min(100, Math.max(1, parseInt(this.repeatCount.value, 10) || 1));
      
      const dateVal = this.scheduleDate ? this.scheduleDate.value : "";
      const timeVal = this.scheduleTime ? this.scheduleTime.value : "";
      let scheduledVal = this.scheduleDateTime ? this.scheduleDateTime.value : "";

      if (dateVal && timeVal) {
        scheduledVal = `${dateVal}T${timeVal}`;
        if (this.scheduleDateTime) this.scheduleDateTime.value = scheduledVal;
      }

      // Validation
      if (!fullPhone || fullPhone.length < 8 || fullPhone.length > 15) {
        Toast.show("Please enter a valid WhatsApp mobile number with country code (8-15 digits).", "error");
        this.phoneInput.focus();
        return;
      }

      if (!rawMsg) {
        Toast.show("Please write a message before scheduling.", "error");
        this.messageBody.focus();
        return;
      }

      if (!scheduledVal || !dateVal || !timeVal) {
        Toast.show("Please select both custom date and time for the reminder.", "error");
        if (!dateVal && this.scheduleDate) this.scheduleDate.focus();
        else if (this.scheduleTime) this.scheduleTime.focus();
        return;
      }

      const scheduleTime = new Date(scheduledVal).getTime();
      if (isNaN(scheduleTime)) {
        Toast.show("Invalid custom date or time format.", "error");
        return;
      }

      if (scheduleTime < Date.now() - 60000) {
        Toast.show("Please pick a current or future time for your reminder.", "warning");
        if (this.scheduleTime) this.scheduleTime.focus();
        return;
      }

      // Optional: Save as new contact
      if (this.saveContactCheckbox.checked) {
        const contactName = (this.newContactName.value || "").trim() || `Contact +${fullPhone}`;
        const existing = State.contacts.find(c => Utils.normalizePhone(c.phone) === fullPhone);
        if (!existing) {
          State.contacts.push({
            id: Utils.generateId(),
            name: contactName,
            phone: fullPhone,
            tag: "Composer",
            createdAt: new Date().toISOString()
          });
          State.saveContacts();
          this.populateContactDropdown();
        }
      }

      // Create new reminder object
      const reminder = {
        id: Utils.generateId(),
        phone: fullPhone,
        message: rawMsg,
        repeat: count,
        at: new Date(scheduledVal).toISOString(),
        done: false,
        alerted: false,
        createdAt: new Date().toISOString()
      };

      State.reminders.push(reminder);
      State.saveReminders();

      Toast.show(`Reminder scheduled for ${Utils.formatDateTime(reminder.at)}!`);
      this.resetForm();
      Router.navigate("reminders");
    },

    resetForm() {
      this.form.reset();
      this.saveContactCheckbox.checked = false;
      this.newContactNameField.style.display = "none";
      this.repeatSlider.value = 1;
      this.repeatCount.value = 1;
      this.setDefaultDateTime();
      this.updateCountryCode();
      this.updatePreview();
    }
  };

  // ================= DASHBOARD VIEW =================
  const DashboardView = {
    init() {
      this.clockDisplay = $("dashClockDisplay");
      this.tzDisplay = $("dashTimezoneDisplay");
      this.greetingTime = $("greetingTime");
      this.statTotal = $("dashStatTotal");
      this.statUpcoming = $("dashStatUpcoming");
      this.statToday = $("dashStatToday");
      this.statCompleted = $("dashStatCompleted");
      this.upcomingList = $("dashUpcomingList");
      this.quickContacts = $("dashQuickContacts");

      this.startClock();
      this.bindQuickForm();
    },

    startClock() {
      const update = () => {
        const now = new Date();
        if (this.clockDisplay) {
          this.clockDisplay.textContent = now.toLocaleTimeString([], { hour12: true });
        }
        if (this.tzDisplay) {
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            this.tzDisplay.textContent = `${tz} (${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })})`;
          } catch (e) {
            this.tzDisplay.textContent = now.toDateString();
          }
        }
        if (this.greetingTime) {
          const hr = now.getHours();
          this.greetingTime.textContent = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
        }
      };
      update();
      setInterval(update, 1000);
    },

    bindQuickForm() {
      const form = $("quickComposeForm");
      if (!form) return;

      const whenSelect = $("quickWhen");
      const customRow = $("quickCustomTimeRow");
      const customDate = $("quickCustomDate");
      const customTime = $("quickCustomTime");

      // Set defaults for custom date/time
      const now = new Date();
      const in30 = new Date(Date.now() + 30 * 60 * 1000);
      if (customDate) {
        customDate.value = ComposerView.toLocalDateStr(in30);
        customDate.min = ComposerView.toLocalDateStr(now);
      }
      if (customTime) {
        customTime.value = ComposerView.toLocalTimeStr(in30);
      }

      if (whenSelect && customRow) {
        whenSelect.addEventListener("change", () => {
          customRow.style.display = whenSelect.value === "custom" ? "flex" : "none";
        });
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const rawPhone = $("quickPhone").value.trim();
        const msg = $("quickMessage").value.trim();
        const when = whenSelect ? whenSelect.value : "60";

        const phone = Utils.normalizePhone(rawPhone);
        if (phone.length < 8) {
          Toast.show("Please enter a valid phone number with country code.", "error");
          return;
        }
        if (!msg) {
          Toast.show("Please enter a message note.", "error");
          return;
        }

        let targetDate;
        if (when === "custom") {
          const dVal = customDate ? customDate.value : "";
          const tVal = customTime ? customTime.value : "";
          if (!dVal || !tVal) {
            Toast.show("Please select both custom date and time.", "error");
            return;
          }
          targetDate = new Date(`${dVal}T${tVal}`);
          if (isNaN(targetDate.getTime())) {
            Toast.show("Invalid custom date or time.", "error");
            return;
          }
          if (targetDate.getTime() < Date.now() - 60000) {
            Toast.show("Custom time should be in the future.", "warning");
            return;
          }
        } else if (when === "tomorrow9") {
          targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + 1);
          targetDate.setHours(9, 0, 0, 0);
        } else {
          const minutes = parseInt(when, 10) || 60;
          targetDate = new Date(Date.now() + minutes * 60 * 1000);
        }

        State.reminders.push({
          id: Utils.generateId(),
          phone,
          message: msg,
          repeat: 1,
          at: targetDate.toISOString(),
          done: false,
          alerted: false,
          createdAt: new Date().toISOString()
        });
        State.saveReminders();

        form.reset();
        if (customRow) customRow.style.display = "none";
        Toast.show(`Quick reminder scheduled for ${Utils.formatDateTime(targetDate.toISOString())}!`);
        this.render();
      });
    },

    render() {
      const now = Date.now();
      const todayStr = new Date().toDateString();

      const total = State.reminders.length;
      const upcoming = State.reminders.filter(r => !r.done && new Date(r.at).getTime() > now);
      const dueToday = State.reminders.filter(r => !r.done && new Date(r.at).toDateString() === todayStr);
      const overdue = State.reminders.filter(r => !r.done && new Date(r.at).getTime() <= now);
      const completed = State.reminders.filter(r => r.done);

      const statTotal = this.statTotal || $("dashStatTotal");
      const statUpcoming = this.statUpcoming || $("dashStatUpcoming");
      const statToday = this.statToday || $("dashStatToday");
      const statCompleted = this.statCompleted || $("dashStatCompleted");
      const upcomingList = this.upcomingList || $("dashUpcomingList");
      const quickContacts = this.quickContacts || $("dashQuickContacts");
      const overdueSub = $("dashStatOverdueSub");

      if (statTotal) statTotal.textContent = total;
      if (statUpcoming) statUpcoming.textContent = upcoming.length;
      if (statToday) statToday.textContent = dueToday.length;
      if (statCompleted) statCompleted.textContent = completed.length;
      if (overdueSub) overdueSub.textContent = `${overdue.length} overdue`;

      // Update sidebar badges
      const badgeUpcoming = $("badgeUpcomingCount");
      if (badgeUpcoming) badgeUpcoming.textContent = upcoming.length;

      const badgeDueToday = $("badgeDueToday");
      if (badgeDueToday) {
        if (overdue.length > 0) {
          badgeDueToday.style.display = "inline-block";
          badgeDueToday.textContent = overdue.length;
        } else {
          badgeDueToday.style.display = "none";
        }
      }

      // Render upcoming schedule
      if (upcomingList) {
        const sortedUpcoming = [...upcoming].sort((a, b) => new Date(a.at) - new Date(b.at)).slice(0, 5);

        if (sortedUpcoming.length === 0) {
          upcomingList.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">🗓️</div>
              <strong class="empty-title">No upcoming reminders</strong>
              <p class="empty-desc">Your agenda is clear. Create a reminder to stay on schedule.</p>
              <a href="#compose" class="btn btn-primary btn-sm">+ New Reminder</a>
            </div>
          `;
        } else {
          upcomingList.innerHTML = sortedUpcoming.map(item => {
            const contact = Utils.findContactByPhone(item.phone);
            const name = contact ? contact.name : Utils.formatPhoneInternational(item.phone);
            const relative = Utils.getRelativeTime(item.at);

            return `
              <div class="reminder-card" style="padding: 12px 16px;">
                <div class="reminder-card-top">
                  <div class="reminder-recipient-box">
                    <div class="reminder-avatar">${name.slice(0, 1).toUpperCase()}</div>
                    <div class="recipient-meta">
                      <strong class="recipient-name">${Utils.escapeHtml(name)}</strong>
                      <span class="recipient-phone">${Utils.escapeHtml(Utils.formatPhoneInternational(item.phone))}</span>
                    </div>
                  </div>
                  <span class="status-badge upcoming">${Utils.escapeHtml(relative)}</span>
                </div>
                <div class="reminder-body" style="padding: 8px 12px; font-size: 12px;">
                  ${Utils.escapeHtml(item.message.slice(0, 120))}${item.message.length > 120 ? "..." : ""}
                </div>
                <div class="reminder-card-foot">
                  <span class="reminder-timing">🕒 ${Utils.escapeHtml(Utils.formatDateTime(item.at))}</span>
                  <div class="card-action-btns">
                    <button class="btn btn-primary sm btn-action-open" data-id="${item.id}">Open WhatsApp</button>
                    <button class="btn btn-ghost sm btn-action-done" data-id="${item.id}">Mark Done</button>
                  </div>
                </div>
              </div>
            `;
          }).join("");
        }
      }

      // Render quick contacts chips
      if (quickContacts) {
        if (State.contacts.length === 0) {
          quickContacts.innerHTML = `<span style="font-size:12px; color:var(--text-subtle);">No saved contacts yet. <a href="#contacts" style="color:var(--wa-teal);font-weight:700;">Add contacts &rarr;</a></span>`;
        } else {
          quickContacts.innerHTML = State.contacts.slice(0, 8).map(c => `
            <button type="button" class="contact-chip-btn" data-contact-phone="${c.phone}">
              <span class="contact-chip-avatar">${c.name.slice(0, 1).toUpperCase()}</span>
              <span>${Utils.escapeHtml(c.name)}</span>
            </button>
          `).join("");
        }
      }
    }
  };

  // ================= REMINDERS VIEW =================
  const RemindersView = {
    init() {
      this.listContainer = $("remindersListContainer");
      this.searchInput = $("remindersSearchInput");
      this.sortSelect = $("remindersSortSelect");
      this.filterTabs = $$(".filter-tab");

      this.bindEvents();
    },

    bindEvents() {
      // Filter tabs
      this.filterTabs.forEach(tab => {
        tab.addEventListener("click", () => {
          State.activeReminderFilter = tab.getAttribute("data-filter");
          this.filterTabs.forEach(t => t.classList.toggle("active", t === tab));
          this.render();
        });
      });

      // Search input
      this.searchInput.addEventListener("input", () => {
        State.reminderSearchQuery = this.searchInput.value.trim().toLowerCase();
        this.render();
      });

      // Sort select
      this.sortSelect.addEventListener("change", () => {
        State.reminderSortBy = this.sortSelect.value;
        this.render();
      });

      // Clear completed button
      $("btnClearCompletedBtn").addEventListener("click", () => {
        const completedCount = State.reminders.filter(r => r.done).length;
        if (completedCount === 0) {
          Toast.show("No completed reminders to clear.");
          return;
        }

        Modals.confirm({
          title: "Clear Completed Reminders",
          message: `Are you sure you want to remove all ${completedCount} completed reminders?`,
          onConfirm: () => {
            State.reminders = State.reminders.filter(r => !r.done);
            State.saveReminders();
            Toast.show(`Cleared ${completedCount} completed reminders.`);
            RemindersView.render();
            DashboardView.render();
          }
        });
      });

      // Delegated clicks for reminder actions
      document.addEventListener("click", (e) => {
        const openBtn = e.target.closest(".btn-action-open");
        const doneBtn = e.target.closest(".btn-action-done");
        const undoBtn = e.target.closest(".btn-action-undo");
        const editBtn = e.target.closest(".btn-action-edit");
        const deleteBtn = e.target.closest(".btn-action-delete");

        if (openBtn) {
          const id = openBtn.getAttribute("data-id");
          this.openReminderWhatsApp(id);
        } else if (doneBtn) {
          const id = doneBtn.getAttribute("data-id");
          this.markReminderDone(id, true);
        } else if (undoBtn) {
          const id = undoBtn.getAttribute("data-id");
          this.markReminderDone(id, false);
        } else if (editBtn) {
          const id = editBtn.getAttribute("data-id");
          this.openEditModal(id);
        } else if (deleteBtn) {
          const id = deleteBtn.getAttribute("data-id");
          this.deleteReminder(id);
        }
      });

      // Edit Reminder Modal Form submission
      $("editReminderForm").addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditedReminder();
      });

      $("btnCloseEditReminderModal").addEventListener("click", () => Modals.close("editReminderModalBackdrop"));
      $("btnCancelEditReminder").addEventListener("click", () => Modals.close("editReminderModalBackdrop"));
    },

    openReminderWhatsApp(id) {
      const item = State.reminders.find(r => r.id === id);
      if (!item) return;
      const url = Utils.buildWhatsAppUrl(item.phone, item.message, item.repeat);
      window.open(url, "_blank", "noopener,noreferrer");
      Toast.show("WhatsApp chat opened with prepared message.");
    },

    markReminderDone(id, isDone) {
      const item = State.reminders.find(r => r.id === id);
      if (!item) return;
      item.done = isDone;
      State.saveReminders();
      Toast.show(isDone ? "Reminder marked as completed." : "Reminder marked as active.");
      this.render();
      DashboardView.render();
    },

    deleteReminder(id) {
      const item = State.reminders.find(r => r.id === id);
      if (!item) return;

      Modals.confirm({
        title: "Delete Reminder",
        message: "Are you sure you want to permanently delete this scheduled reminder?",
        onConfirm: () => {
          State.reminders = State.reminders.filter(r => r.id !== id);
          State.saveReminders();
          Toast.show("Reminder deleted.");
          RemindersView.render();
          DashboardView.render();
        }
      });
    },

    openEditModal(id) {
      const item = State.reminders.find(r => r.id === id);
      if (!item) return;

      $("editReminderId").value = item.id;
      $("editReminderPhone").value = item.phone;
      $("editReminderMessage").value = item.message;
      $("editReminderRepeat").value = item.repeat || 1;

      const d = new Date(item.at);
      const dateStr = ComposerView.toLocalDateStr(d);
      const timeStr = ComposerView.toLocalTimeStr(d);

      if ($("editReminderDate")) $("editReminderDate").value = dateStr;
      if ($("editReminderTime")) $("editReminderTime").value = timeStr;
      if ($("editReminderWhen")) $("editReminderWhen").value = `${dateStr}T${timeStr}`;

      Modals.open("editReminderModalBackdrop");
    },

    saveEditedReminder() {
      const id = $("editReminderId").value;
      const item = State.reminders.find(r => r.id === id);
      if (!item) return;

      const rawPhone = $("editReminderPhone").value;
      const cleanPhone = Utils.normalizePhone(rawPhone);
      const msg = $("editReminderMessage").value.trim();
      const repeat = parseInt($("editReminderRepeat").value, 10) || 1;

      const dVal = $("editReminderDate") ? $("editReminderDate").value : "";
      const tVal = $("editReminderTime") ? $("editReminderTime").value : "";
      let whenVal = $("editReminderWhen") ? $("editReminderWhen").value : "";

      if (dVal && tVal) {
        whenVal = `${dVal}T${tVal}`;
      }

      if (cleanPhone.length < 8) {
        Toast.show("Please enter a valid phone number with country code.", "error");
        return;
      }
      if (!msg) {
        Toast.show("Message cannot be empty.", "error");
        return;
      }
      if (!whenVal || !dVal || !tVal) {
        Toast.show("Please select both custom date and time.", "error");
        return;
      }

      const scheduleTime = new Date(whenVal).getTime();
      if (isNaN(scheduleTime)) {
        Toast.show("Invalid custom date or time.", "error");
        return;
      }

      item.phone = cleanPhone;
      item.message = msg;
      item.repeat = Math.min(100, Math.max(1, repeat));
      item.at = new Date(whenVal).toISOString();
      item.alerted = false; // Reset alert so it triggers at the new custom time

      State.saveReminders();
      Modals.close("editReminderModalBackdrop");
      Toast.show(`Reminder updated for ${Utils.formatDateTime(item.at)}.`);
      this.render();
      DashboardView.render();
    },

    render() {
      const now = Date.now();

      // Counts for tabs
      const countAll = State.reminders.length;
      const countUpcoming = State.reminders.filter(r => !r.done && new Date(r.at).getTime() > now).length;
      const countDue = State.reminders.filter(r => !r.done && new Date(r.at).getTime() <= now).length;
      const countDone = State.reminders.filter(r => r.done).length;

      $("countTabAll").textContent = countAll;
      $("countTabUpcoming").textContent = countUpcoming;
      $("countTabDue").textContent = countDue;
      $("countTabDone").textContent = countDone;

      // Filter by active tab
      let list = State.reminders.filter(item => {
        const isPast = new Date(item.at).getTime() <= now;
        if (State.activeReminderFilter === "upcoming") return !item.done && !isPast;
        if (State.activeReminderFilter === "due") return !item.done && isPast;
        if (State.activeReminderFilter === "done") return item.done;
        return true;
      });

      // Filter by search query
      if (State.reminderSearchQuery) {
        const q = State.reminderSearchQuery;
        list = list.filter(item => {
          const contact = Utils.findContactByPhone(item.phone);
          const name = contact ? contact.name.toLowerCase() : "";
          return item.phone.includes(q) || item.message.toLowerCase().includes(q) || name.includes(q);
        });
      }

      // Sort
      list.sort((a, b) => {
        const timeA = new Date(a.at).getTime();
        const timeB = new Date(b.at).getTime();
        if (State.reminderSortBy === "dueSoonest") return timeA - timeB;
        if (State.reminderSortBy === "dueLatest") return timeB - timeA;
        if (State.reminderSortBy === "newestCreated") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (State.reminderSortBy === "oldestCreated") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        return 0;
      });

      if (list.length === 0) {
        this.listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <strong class="empty-title">No reminders found</strong>
            <p class="empty-desc">${State.reminderSearchQuery ? "No reminders matched your search criteria." : "There are no reminders matching the selected filter."}</p>
            <a href="#compose" class="btn btn-primary sm">+ Schedule a Message</a>
          </div>
        `;
        return;
      }

      this.listContainer.innerHTML = list.map(item => {
        const contact = Utils.findContactByPhone(item.phone);
        const name = contact ? contact.name : Utils.formatPhoneInternational(item.phone);
        const dueTime = new Date(item.at).getTime();
        const isOverdue = !item.done && dueTime <= now - 5 * 60 * 1000;
        const isDueNow = !item.done && dueTime <= now && !isOverdue;

        let statusClass = "upcoming";
        let statusText = Utils.getRelativeTime(item.at);

        if (item.done) {
          statusClass = "completed";
          statusText = "Completed";
        } else if (isOverdue) {
          statusClass = "overdue";
          statusText = `Overdue (${Utils.getRelativeTime(item.at)})`;
        } else if (isDueNow) {
          statusClass = "due";
          statusText = "Due Now!";
        }

        const cardExtraClass = item.done ? "is-completed" : isOverdue ? "is-overdue" : isDueNow ? "is-due" : "";

        return `
          <article class="reminder-card ${cardExtraClass}">
            <div class="reminder-card-top">
              <div class="reminder-recipient-box">
                <div class="reminder-avatar">${name.slice(0, 1).toUpperCase()}</div>
                <div class="recipient-meta">
                  <strong class="recipient-name">${Utils.escapeHtml(name)}</strong>
                  <span class="recipient-phone">${Utils.escapeHtml(Utils.formatPhoneInternational(item.phone))}</span>
                </div>
              </div>
              <span class="status-badge ${statusClass}">${Utils.escapeHtml(statusText)}</span>
            </div>

            <div class="reminder-body">
              <div>${Utils.escapeHtml(item.message)}</div>
              ${item.repeat > 1 ? `<span class="repeat-tag">Text repeated ${item.repeat} times in one composed WhatsApp message</span>` : ""}
            </div>

            <div class="reminder-card-foot">
              <span class="reminder-timing">
                <svg viewBox="0 0 24 24" style="width:15px;height:15px;color:var(--text-subtle);"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>
                ${Utils.escapeHtml(Utils.formatDateTime(item.at))}
              </span>

              <div class="card-action-btns">
                ${!item.done ? `
                  <button type="button" class="btn btn-primary sm btn-action-open" data-id="${item.id}" title="Open WhatsApp chat with prepopulated message">
                    <svg viewBox="0 0 24 24" class="btn-icon"><path fill="currentColor" d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
                    <span>Open WhatsApp</span>
                  </button>
                  <button type="button" class="btn btn-secondary sm btn-action-done" data-id="${item.id}">Mark Done</button>
                ` : `
                  <button type="button" class="btn btn-secondary sm btn-action-undo" data-id="${item.id}">Reactivate</button>
                `}
                <button type="button" class="btn btn-ghost sm btn-action-edit" data-id="${item.id}">Edit</button>
                <button type="button" class="btn btn-ghost sm btn-action-delete" data-id="${item.id}" style="color:#DC2626;">Delete</button>
              </div>
            </div>
          </article>
        `;
      }).join("");
    }
  };

  // ================= CONTACTS VIEW =================
  const ContactsView = {
    init() {
      this.grid = $("contactsGrid");
      this.searchInput = $("contactsSearchInput");
      this.countLabel = $("contactsCountLabel");

      this.bindEvents();
    },

    bindEvents() {
      this.searchInput.addEventListener("input", () => {
        State.contactSearchQuery = this.searchInput.value.trim().toLowerCase();
        this.render();
      });

      // Empty state add contact button delegation
      document.addEventListener("click", (e) => {
        if (e.target.closest(".btn-empty-add-contact")) {
          $("contactEditId").value = "";
          $("contactModalTitle").textContent = "Add New Contact";
          $("contactForm").reset();
          Modals.open("contactModalBackdrop");
        }
      });

      $("btnAddContactBtn").addEventListener("click", () => {
        $("contactEditId").value = "";
        $("contactModalTitle").textContent = "Add New Contact";
        $("contactForm").reset();
        Modals.open("contactModalBackdrop");
      });

      $("btnCloseContactModal").addEventListener("click", () => Modals.close("contactModalBackdrop"));
      $("btnCancelContactModal").addEventListener("click", () => Modals.close("contactModalBackdrop"));

      $("contactForm").addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveContact();
      });

      // Quick contact chip clicks
      document.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-contact-phone]");
        if (chip) {
          const phone = chip.getAttribute("data-contact-phone");
          const contact = State.contacts.find(c => c.phone === phone);
          if (contact) {
            Router.navigate("compose");
            ComposerView.setRecipientFromContact(contact);
          }
        }

        const composeBtn = e.target.closest(".btn-contact-compose");
        const editBtn = e.target.closest(".btn-contact-edit");
        const deleteBtn = e.target.closest(".btn-contact-delete");

        if (composeBtn) {
          const id = composeBtn.getAttribute("data-id");
          const c = State.contacts.find(x => x.id === id);
          if (c) {
            Router.navigate("compose");
            ComposerView.setRecipientFromContact(c);
          }
        } else if (editBtn) {
          const id = editBtn.getAttribute("data-id");
          this.openEditContact(id);
        } else if (deleteBtn) {
          const id = deleteBtn.getAttribute("data-id");
          this.deleteContact(id);
        }
      });

      // CSV Modal
      $("btnOpenCsvModal").addEventListener("click", () => {
        $("csvPreviewArea").style.display = "none";
        $("btnConfirmCsvImport").disabled = true;
        $("csvFileInput").value = "";
        Modals.open("csvModalBackdrop");
      });

      $("btnCloseCsvModal").addEventListener("click", () => Modals.close("csvModalBackdrop"));
      $("btnCancelCsvModal").addEventListener("click", () => Modals.close("csvModalBackdrop"));

      this.initCsvDropzone();
      this.initExportCsv();
    },

    saveContact() {
      const id = $("contactEditId").value;
      const name = $("contactFormName").value.trim();
      const code = $("contactFormCode").value === "custom" ? "" : $("contactFormCode").value;
      const rawPhone = $("contactFormPhone").value.trim();
      const tag = $("contactFormTag").value.trim();

      const digits = Utils.normalizePhone(rawPhone);
      let fullPhone = digits;
      if (code && !digits.startsWith(code)) {
        fullPhone = `${code}${digits}`;
      }

      if (!name) {
        Toast.show("Please enter contact name.", "error");
        return;
      }
      if (fullPhone.length < 8 || fullPhone.length > 15) {
        Toast.show("Please enter a valid phone number with country code.", "error");
        return;
      }

      // Check duplicates
      const dup = State.contacts.find(c => c.id !== id && Utils.normalizePhone(c.phone) === fullPhone);
      if (dup) {
        Toast.show(`A contact with number +${fullPhone} already exists (${dup.name}).`, "warning");
        return;
      }

      if (id) {
        // Edit
        const item = State.contacts.find(c => c.id === id);
        if (item) {
          item.name = name;
          item.phone = fullPhone;
          item.tag = tag;
        }
        Toast.show("Contact updated successfully.");
      } else {
        // Add
        State.contacts.push({
          id: Utils.generateId(),
          name,
          phone: fullPhone,
          tag,
          createdAt: new Date().toISOString()
        });
        Toast.show("New contact saved.");
      }

      State.saveContacts();
      Modals.close("contactModalBackdrop");
      this.render();
      ComposerView.populateContactDropdown();
      DashboardView.render();
    },

    openEditContact(id) {
      const item = State.contacts.find(c => c.id === id);
      if (!item) return;

      $("contactEditId").value = item.id;
      $("contactModalTitle").textContent = "Edit Contact";
      $("contactFormName").value = item.name;
      $("contactFormPhone").value = item.phone;
      $("contactFormTag").value = item.tag || "";
      Modals.open("contactModalBackdrop");
    },

    deleteContact(id) {
      const item = State.contacts.find(c => c.id === id);
      if (!item) return;

      Modals.confirm({
        title: "Delete Contact",
        message: `Are you sure you want to delete ${item.name}? Existing scheduled reminders will be preserved.`,
        onConfirm: () => {
          State.contacts = State.contacts.filter(c => c.id !== id);
          State.saveContacts();
          Toast.show("Contact removed.");
          ContactsView.render();
          ComposerView.populateContactDropdown();
          DashboardView.render();
        }
      });
    },

    initCsvDropzone() {
      const dropzone = $("csvDropzone");
      const fileInput = $("csvFileInput");

      dropzone.addEventListener("click", () => fileInput.click());

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--wa-teal)";
        dropzone.style.background = "var(--wa-mint-light)";
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.style.borderColor = "#93C5FD";
        dropzone.style.background = "#F0F7FF";
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "#93C5FD";
        dropzone.style.background = "#F0F7FF";
        if (e.dataTransfer.files.length) {
          this.handleCsvFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
          this.handleCsvFile(fileInput.files[0]);
        }
      });
    },

    parsedCsvData: [],

    handleCsvFile(file) {
      if (!file || (!file.name.endsWith(".csv") && file.type !== "text/csv")) {
        Toast.show("Please upload a valid .csv file.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          this.parseCsvContent(text);
        } catch (err) {
          Toast.show("Failed to read CSV file.", "error");
        }
      };
      reader.readAsText(file);
    },

    parseCsvContent(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        Toast.show("CSV file is empty or missing headers.", "error");
        return;
      }

      // Parse headers
      const headerRow = lines[0].toLowerCase().split(/[;,]/).map(h => h.replace(/^["']|["']$/g, "").trim());
      const nameIndex = headerRow.findIndex(h => h.includes("name"));
      const phoneIndex = headerRow.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("number"));
      const tagIndex = headerRow.findIndex(h => h.includes("tag") || h.includes("group"));

      if (phoneIndex === -1) {
        Toast.show("CSV must contain a 'Phone' or 'Mobile' column header.", "error");
        return;
      }

      const parsed = [];
      const defaultCode = State.settings.defaultCountryCode || "91";

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map(c => c.replace(/^["']|["']$/g, "").trim());
        if (cols.length <= phoneIndex) continue;

        let name = nameIndex !== -1 && cols[nameIndex] ? cols[nameIndex] : `Contact ${i}`;
        let rawPhone = cols[phoneIndex];
        let tag = tagIndex !== -1 && cols[tagIndex] ? cols[tagIndex] : "CSV Import";

        let digits = Utils.normalizePhone(rawPhone);
        if (digits.length >= 8 && digits.length <= 10) {
          // Add default country code if missing
          digits = `${defaultCode}${digits}`;
        }

        const isValid = digits.length >= 8 && digits.length <= 15;
        const isDuplicate = State.contacts.some(c => Utils.normalizePhone(c.phone) === digits) || parsed.some(p => p.phone === digits);

        parsed.push({
          name,
          phone: digits,
          tag,
          isValid,
          isDuplicate
        });
      }

      this.parsedCsvData = parsed;
      this.renderCsvPreview(parsed);
    },

    renderCsvPreview(parsed) {
      const tableBody = $("csvPreviewTable").querySelector("tbody");
      const summaryText = $("csvSummaryText");
      const confirmBtn = $("btnConfirmCsvImport");

      tableBody.innerHTML = "";
      const validCount = parsed.filter(p => p.isValid && !p.isDuplicate).length;
      const dupCount = parsed.filter(p => p.isDuplicate).length;

      summaryText.textContent = `Found ${parsed.length} contacts (${validCount} ready to import, ${dupCount} duplicates/existing).`;

      parsed.slice(0, 50).forEach(row => {
        const tr = document.createElement("tr");
        let statusBadge = `<span style="color:#16A34A;font-weight:700;">Valid</span>`;
        if (!row.isValid) {
          statusBadge = `<span style="color:#DC2626;font-weight:700;">Invalid phone</span>`;
        } else if (row.isDuplicate) {
          statusBadge = `<span style="color:#D97706;font-weight:700;">Duplicate (Skip)</span>`;
        }

        tr.innerHTML = `
          <td>${Utils.escapeHtml(row.name)}</td>
          <td>+${Utils.escapeHtml(row.phone)}</td>
          <td>${statusBadge}</td>
        `;
        tableBody.appendChild(tr);
      });

      $("csvPreviewArea").style.display = "block";
      confirmBtn.disabled = validCount === 0;

      confirmBtn.onclick = () => {
        const ready = parsed.filter(p => p.isValid && !p.isDuplicate);
        ready.forEach(item => {
          State.contacts.push({
            id: Utils.generateId(),
            name: item.name,
            phone: item.phone,
            tag: item.tag,
            createdAt: new Date().toISOString()
          });
        });

        State.saveContacts();
        Modals.close("csvModalBackdrop");
        Toast.show(`Successfully imported ${ready.length} contacts!`);
        this.render();
        ComposerView.populateContactDropdown();
        DashboardView.render();
      };
    },

    initExportCsv() {
      $("btnExportContactsCsv").addEventListener("click", () => {
        if (State.contacts.length === 0) {
          Toast.show("No contacts to export.", "warning");
          return;
        }

        const headers = ["Name", "Phone", "Tag", "Created At"];
        const rows = State.contacts.map(c => [
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"+${c.phone}"`,
          `"${(c.tag || '').replace(/"/g, '""')}"`,
          `"${c.createdAt || ''}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `saddu_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Toast.show("Contacts exported to CSV!");
      });
    },

    render() {
      const q = State.contactSearchQuery;
      let list = State.contacts;

      if (q) {
        list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.tag && c.tag.toLowerCase().includes(q)));
      }

      this.countLabel.textContent = `${list.length} contact${list.length === 1 ? "" : "s"}`;
      $("badgeContactsCount").textContent = State.contacts.length;

      if (list.length === 0) {
        this.grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon">👥</div>
            <strong class="empty-title">${q ? "No matching contacts found" : "No contacts in your address book"}</strong>
            <p class="empty-desc">${q ? "Try searching for a different name or number." : "Add frequently contacted people for quick 1-click message scheduling."}</p>
            <button type="button" class="btn btn-primary sm btn-empty-add-contact">+ Add Contact</button>
          </div>
        `;
        return;
      }

      this.grid.innerHTML = list.map(item => `
        <article class="contact-card">
          <div class="contact-card-header">
            <div class="contact-avatar">${item.name.slice(0, 1).toUpperCase()}</div>
            <div class="contact-details">
              <strong class="contact-name" title="${Utils.escapeHtml(item.name)}">${Utils.escapeHtml(item.name)}</strong>
              <span class="contact-phone">${Utils.escapeHtml(Utils.formatPhoneInternational(item.phone))}</span>
            </div>
          </div>
          ${item.tag ? `<span class="contact-tag">${Utils.escapeHtml(item.tag)}</span>` : ""}
          <div class="contact-card-actions">
            <button type="button" class="btn btn-primary sm btn-contact-compose" data-id="${item.id}">Schedule</button>
            <div>
              <button type="button" class="btn btn-ghost sm btn-contact-edit" data-id="${item.id}">Edit</button>
              <button type="button" class="btn btn-ghost sm btn-contact-delete" data-id="${item.id}" style="color:#DC2626;">Delete</button>
            </div>
          </div>
        </article>
      `).join("");
    }
  };

  // ================= SETTINGS & DATA VIEW =================
  const SettingsView = {
    init() {
      this.soundToggle = $("settingSoundEnabled");
      this.defaultCodeSelect = $("settingDefaultCountryCode");
      this.themeSelect = $("settingThemeSelect");
      this.geminiApiKeyInput = $("settingGeminiApiKey");

      this.bindEvents();
      this.syncUI();
    },

    bindEvents() {
      if (this.themeSelect) {
        this.themeSelect.addEventListener("change", () => {
          ThemeManager.applyTheme(this.themeSelect.value, true);
          Toast.show(`Theme updated to ${this.themeSelect.value}`);
        });
      }

      if (this.geminiApiKeyInput) {
        this.geminiApiKeyInput.addEventListener("change", () => {
          State.settings.geminiApiKey = this.geminiApiKeyInput.value.trim();
          State.saveSettings();
          Toast.show("Gemini API key saved in browser storage.");
        });
      }

      this.soundToggle.addEventListener("change", () => {
        State.settings.soundEnabled = this.soundToggle.checked;
        State.saveSettings();
        Toast.show(this.soundToggle.checked ? "Audio alerts enabled." : "Audio alerts muted.");
      });

      this.defaultCodeSelect.addEventListener("change", () => {
        State.settings.defaultCountryCode = this.defaultCodeSelect.value;
        State.saveSettings();
        Toast.show("Default country code updated.");
      });

      $("btnTestSound").addEventListener("click", () => {
        AudioChime.play();
        Toast.show("Playing chime tone...");
      });

      $("btnTestNotification").addEventListener("click", () => {
        Scheduler.triggerNotification({
          id: "test",
          phone: "919876543210",
          message: "This is a test notification from Saddu WhatsApp Scheduler."
        });
      });

      // Notification permission request
      $("btnRequestNotificationPermission").addEventListener("click", () => {
        Scheduler.requestPermission();
      });

      $("sidebarNotifyBtn").addEventListener("click", () => {
        Scheduler.requestPermission();
      });

      $("mobileNotifyBtn").addEventListener("click", () => {
        Scheduler.requestPermission();
      });

      // Export JSON backup
      $("btnExportJsonBackup").addEventListener("click", () => {
        const backup = {
          version: "2.0",
          exportedAt: new Date().toISOString(),
          reminders: State.reminders,
          contacts: State.contacts,
          settings: State.settings
        };

        const jsonStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `saddu_whatsapp_scheduler_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Toast.show("JSON Backup file downloaded!");
      });

      // Import JSON backup
      const importInput = $("importJsonFile");
      importInput.addEventListener("change", () => {
        if (!importInput.files.length) return;
        const file = importInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== "object") throw new Error("Invalid JSON structure");

            Modals.confirm({
              title: "Restore Backup",
              message: `This backup contains ${data.reminders?.length || 0} reminders and ${data.contacts?.length || 0} contacts. Overwrite or merge your data?`,
              onConfirm: () => {
                if (Array.isArray(data.reminders)) State.reminders = data.reminders;
                if (Array.isArray(data.contacts)) State.contacts = data.contacts;
                if (data.settings) State.settings = { ...DEFAULT_SETTINGS, ...data.settings };

                State.saveReminders();
                State.saveContacts();
                State.saveSettings();

                Toast.show("Backup successfully restored!");
                SettingsView.render();
                DashboardView.render();
                RemindersView.render();
                ContactsView.render();
                ComposerView.populateContactDropdown();
              }
            });
          } catch (err) {
            Toast.show("Failed to parse JSON backup file.", "error");
          }
        };
        reader.readAsText(file);
      });

      // Clear completed
      $("btnSettingsClearCompleted").addEventListener("click", () => {
        const completed = State.reminders.filter(r => r.done).length;
        if (completed === 0) {
          Toast.show("No completed reminders to clear.");
          return;
        }
        Modals.confirm({
          title: "Clear Completed",
          message: `Delete all ${completed} completed reminders?`,
          onConfirm: () => {
            State.reminders = State.reminders.filter(r => !r.done);
            State.saveReminders();
            Toast.show(`Cleared ${completed} completed reminders.`);
            SettingsView.render();
            DashboardView.render();
            RemindersView.render();
          }
        });
      });

      // Reset all data
      $("btnResetAllData").addEventListener("click", () => {
        Modals.confirm({
          title: "DANGER: Reset All Data",
          message: "This will PERMANENTLY delete all reminders, contacts, and preferences from this device. Are you sure you want to proceed?",
          onConfirm: () => {
            localStorage.removeItem(STORAGE_KEYS.REMINDERS);
            localStorage.removeItem(STORAGE_KEYS.CONTACTS);
            localStorage.removeItem(STORAGE_KEYS.SETTINGS);
            localStorage.removeItem(STORAGE_KEYS.LEGACY);

            State.reminders = [];
            State.contacts = [];
            State.settings = { ...DEFAULT_SETTINGS };

            Toast.show("All application data has been reset.");
            SettingsView.render();
            DashboardView.render();
            RemindersView.render();
            ContactsView.render();
            ComposerView.populateContactDropdown();
          }
        });
      });
    },

    syncUI() {
      this.soundToggle.checked = State.settings.soundEnabled;
      this.defaultCodeSelect.value = State.settings.defaultCountryCode || "91";
      if (this.themeSelect) this.themeSelect.value = State.settings.theme || "light";
      if (this.geminiApiKeyInput) this.geminiApiKeyInput.value = State.settings.geminiApiKey || "";
      this.updatePermissionLabel();
    },

    updatePermissionLabel() {
      const btnLabel = $("notifPermissionBtnLabel");
      const sidebarLabel = $("sidebarNotifyLabel");

      if (!("Notification" in window)) {
        if (btnLabel) btnLabel.textContent = "Unsupported";
        if (sidebarLabel) sidebarLabel.textContent = "Unsupported";
        return;
      }

      const perm = Notification.permission;
      if (perm === "granted") {
        if (btnLabel) btnLabel.textContent = "Allowed ✓";
        if (sidebarLabel) sidebarLabel.textContent = "Alerts Active";
      } else if (perm === "denied") {
        if (btnLabel) btnLabel.textContent = "Blocked ✕";
        if (sidebarLabel) sidebarLabel.textContent = "Alerts Blocked";
      } else {
        if (btnLabel) btnLabel.textContent = "Request Access";
        if (sidebarLabel) sidebarLabel.textContent = "Enable Alerts";
      }
    },

    render() {
      this.syncUI();
      $("metricRemindersCount").textContent = State.reminders.length;
      $("metricContactsCount").textContent = State.contacts.length;

      // Estimate storage bytes used
      let totalBytes = 0;
      for (const k in localStorage) {
        if (k.startsWith("saddu_")) {
          totalBytes += (localStorage[k] || "").length * 2;
        }
      }
      $("metricStorageUsed").textContent = `${Math.max(1, Math.round(totalBytes / 1024))} KB`;
    }
  };

  // ================= DUE ALERT SCHEDULER & NOTIFICATIONS =================
  const Scheduler = {
    timer: null,

    init() {
      this.bindDueModalActions();
      this.bindGlobalDueBannerActions();

      // Check immediately
      this.checkDue();

      // Poll every 5 seconds
      this.timer = setInterval(() => this.checkDue(), 5000);

      // Check on visibility change / focus
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) this.checkDue();
      });
      window.addEventListener("focus", () => this.checkDue());
    },

    async requestPermission() {
      if (!("Notification" in window)) {
        Toast.show("Browser notifications are not supported on this browser.", "warning");
        return;
      }
      try {
        const perm = await Notification.requestPermission();
        SettingsView.updatePermissionLabel();
        if (perm === "granted") {
          Toast.show("Browser notifications enabled!");
        } else {
          Toast.show("Notification permission was not granted.", "warning");
        }
      } catch (e) {
        Toast.show("Could not request notification permission.", "error");
      }
    },

    checkDue() {
      const now = Date.now();
      let hasNewDue = false;

      State.reminders.forEach(item => {
        const itemTime = new Date(item.at).getTime();
        // If not completed, not already alerted, and time is reached
        if (!item.done && !item.alerted && itemTime <= now) {
          item.alerted = true;
          hasNewDue = true;
          this.triggerDueAlert(item);
        }
      });

      if (hasNewDue) {
        State.saveReminders();
        DashboardView.render();
        RemindersView.render();
      }

      this.updateGlobalDueBanner();
    },

    currentDueItem: null,

    triggerDueAlert(item) {
      this.currentDueItem = item;
      AudioChime.play();
      this.triggerNotification(item);
      this.showDueModal(item);
    },

    triggerNotification(item) {
      const contact = Utils.findContactByPhone(item.phone);
      const name = contact ? contact.name : `+${item.phone}`;
      const title = `Saddu Reminder: WhatsApp message for ${name}`;
      const body = `"${item.message.slice(0, 100)}..." Tap to review and open WhatsApp.`;

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notif = new Notification(title, {
            body,
            tag: item.id,
            requireInteraction: true
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
            const url = Utils.buildWhatsAppUrl(item.phone, item.message, item.repeat);
            window.open(url, "_blank", "noopener,noreferrer");
          };
        } catch (e) {
          Toast.show(title);
        }
      } else {
        Toast.show(`REMINDER DUE: WhatsApp message for ${name}`, "warning", 6000);
      }
    },

    showDueModal(item) {
      const contact = Utils.findContactByPhone(item.phone);
      const name = contact ? `${contact.name} (${Utils.formatPhoneInternational(item.phone)})` : Utils.formatPhoneInternational(item.phone);

      $("dueModalRecipient").textContent = name;
      $("dueModalMessage").textContent = item.message;
      $("dueModalTime").textContent = `Scheduled for: ${Utils.formatDateTime(item.at)}`;

      Modals.open("dueModalBackdrop");
    },

    bindDueModalActions() {
      $("btnDueModalOpenWA").addEventListener("click", () => {
        if (this.currentDueItem) {
          const url = Utils.buildWhatsAppUrl(this.currentDueItem.phone, this.currentDueItem.message, this.currentDueItem.repeat);
          window.open(url, "_blank", "noopener,noreferrer");
        }
        Modals.close("dueModalBackdrop");
      });

      $("btnDueModalMarkDone").addEventListener("click", () => {
        if (this.currentDueItem) {
          this.currentDueItem.done = true;
          State.saveReminders();
          Toast.show("Reminder marked as completed.");
          DashboardView.render();
          RemindersView.render();
        }
        Modals.close("dueModalBackdrop");
      });

      $("btnDueModalDismiss").addEventListener("click", () => {
        Modals.close("dueModalBackdrop");
      });

      // Snooze buttons (+5m, +15m, +60m)
      $$(".btn-snooze").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!this.currentDueItem) {
            Modals.close("dueModalBackdrop");
            return;
          }
          const mins = parseInt(btn.getAttribute("data-snooze"), 10) || 5;
          const newTime = new Date(Date.now() + mins * 60 * 1000).toISOString();

          this.currentDueItem.at = newTime;
          this.currentDueItem.alerted = false;
          this.currentDueItem.done = false;
          this.currentDueItem.status = "scheduled";

          State.saveReminders();
          Toast.show(`⏰ Snoozed for ${mins} minutes`);
          Modals.close("dueModalBackdrop");
          this.updateGlobalDueBanner();
          DashboardView.render();
          RemindersView.render();
        });
      });
    },

    updateGlobalDueBanner() {
      const banner = $("globalDueBanner");
      if (!banner) return;

      const now = Date.now();
      const overdueUnfinished = State.reminders.filter(r => !r.done && new Date(r.at).getTime() <= now);

      if (overdueUnfinished.length === 0) {
        banner.style.display = "none";
        return;
      }

      const topItem = overdueUnfinished[0];
      const contact = Utils.findContactByPhone(topItem.phone);
      const name = contact ? contact.name : Utils.formatPhoneInternational(topItem.phone);

      $("dueBannerTitle").textContent = overdueUnfinished.length === 1 
        ? `Message reminder due for ${name}!`
        : `${overdueUnfinished.length} message reminders are due now!`;

      $("dueBannerSubtitle").textContent = `Next: "${topItem.message.slice(0, 70)}..." Tap to review and open WhatsApp.`;
      banner.style.display = "flex";
    },

    bindGlobalDueBannerActions() {
      $("dueBannerOpenBtn").addEventListener("click", () => {
        const now = Date.now();
        const overdueUnfinished = State.reminders.filter(r => !r.done && new Date(r.at).getTime() <= now);
        if (overdueUnfinished.length > 0) {
          const item = overdueUnfinished[0];
          const url = Utils.buildWhatsAppUrl(item.phone, item.message, item.repeat);
          window.open(url, "_blank", "noopener,noreferrer");
        }
      });

      $("dueBannerDismissBtn").addEventListener("click", () => {
        const now = Date.now();
        const overdueUnfinished = State.reminders.filter(r => !r.done && new Date(r.at).getTime() <= now);
        if (overdueUnfinished.length > 0) {
          overdueUnfinished[0].done = true;
          State.saveReminders();
          Toast.show("Reminder marked as completed.");
          this.updateGlobalDueBanner();
          DashboardView.render();
          RemindersView.render();
        }
      });
    }
  };

  // ================= APP INITIALIZATION =================
  function initApp() {
    try {
      // Set dynamic footer year
      const yr = $("footerYear");
      if (yr) yr.textContent = new Date().getFullYear();

      // Set user timezone label in composer
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const tzEl = $("userTimezoneLabel");
        if (tzEl) tzEl.textContent = tz;
      } catch (e) {}

      // 1. Initialize State first
      State.init();

      // 2. Initialize Theme and Formatting Toolbar
      ThemeManager.init();
      FormattingToolbar.init();

      // 3. Initialize all Views and their DOM element references
      ComposerView.init();
      DashboardView.init();
      RemindersView.init();
      ContactsView.init();
      SettingsView.init();
      Scheduler.init();

      // 4. Initialize Router AFTER views are ready
      Router.init();

      // 5. Initial render of default view
      DashboardView.render();
    } catch (err) {
      console.error("Initialization error:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

})();
