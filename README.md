# Saddu WhatsApp Scheduler 🚀

**Saddu WhatsApp Scheduler** is a modern, responsive, browser-based personal reminder and message scheduler designed for WhatsApp. It operates 100% on the client side with zero subscriptions, zero paid APIs, and zero backend servers—making it safe, private, and freely hostable on **GitHub Pages**.

---

## ✨ Key Features

### 1. 📊 Executive Dashboard
- **Real-Time Metrics**: Track Total Reminders, Upcoming Schedules, Reminders Due Today, and Completed items.
- **Overdue Detection**: Automatically flags overdue items with instant action options.
- **Upcoming Agenda Timeline**: Visual schedule of upcoming messages with relative countdowns.
- **Fast Action Quick Composer**: Schedule quick reminders in 15m, 30m, 1h, or next morning without leaving the dashboard.
- **Live Clock & Timezone**: Displays your local time and timezone for precise scheduling.

### 2. ✍️ Advanced Message Composer
- **WhatsApp Phone Validation**: Validates international phone numbers with country codes (e.g., `+91`, `+1`, `+44`, `+971`, etc.).
- **Address Book Integration**: Instant prefill by selecting from your saved contacts.
- **Save as Contact**: Checkbox option to automatically save newly entered numbers into your contact list.
- **Message Templates**: 1-click preset chips for *Meeting Reminders*, *Birthday Wishes*, *Payment Follow-ups*, and *Friendly Check-ins*.
- **Text Repetition (1x - 100x)**: Repeat message text inside **ONE composed message** (useful for emphasis, lists, or creative reminders).
- **Time Shortcuts**: One-tap buttons to set reminders for `+15 Mins`, `+30 Mins`, `+1 Hour`, `+3 Hours`, `Tonight 8 PM`, or `Tomorrow 9 AM`.
- **Live WhatsApp Chat Simulator**: Interactive preview matching WhatsApp's actual chat bubble, timestamps, delivered checkmarks, and character counts.

### 3. 👥 Contact Management & CSV Import/Export
- **Full Address Book**: Add, edit, delete, and tag contacts (e.g., Work, Family, VIP).
- **CSV Import**: Drag-and-drop `.csv` file upload with automatic header detection (`Name`, `Phone`, `Tag`), phone number validation, and duplicate detection.
- **CSV Export**: Download your contacts anytime as a formatted `.csv` file.
- **Instant Search**: Filter contacts in real time by name, phone number, or tag.

### 4. ⏰ Multi-Channel Reminder System
- **Web Push Notifications**: Desktop/mobile browser alerts when scheduled reminders become due.
- **In-App Alert Modal**: High-visibility alert dialog with an immediate **"Open WhatsApp Now"** button.
- **Synthesized Audio Chime**: Built-in pleasant notification sound powered by the HTML5 Web Audio API synthesizer (no external audio files required, works 100% offline).
- **Global Due Banner**: Persistent notification bar when any reminders are due or overdue.
- **Duplicate Prevention**: State-tracked reminder alerts prevent repeated spamming.

### 5. 🗂️ Reminders Manager
- **Categorized Tabs**: Filter by *All*, *Upcoming*, *Due / Overdue*, and *Completed*.
- **Live Search & Sorting**: Search by recipient, phone, or message content; sort by *Due Soonest*, *Due Latest*, or *Recently Added*.
- **Edit & Reschedule**: Update phone numbers, message text, repeat count, or scheduled timing.
- **Batch Actions**: Quick "Clear Completed" to keep your list clean.

### 6. 💾 Privacy & Data Persistence
- **100% LocalStorage**: All data remains strictly inside your browser on your device.
- **JSON Backup Export**: Download a full JSON snapshot of all reminders, contacts, and preferences.
- **JSON Backup Restore**: Seamlessly import your backup on any device or browser with schema validation.
- **Danger Zone**: Secure confirmation modals for clearing completed items or resetting application data.

---

## 🔒 WhatsApp Compliance & Safety

> [!IMPORTANT]
> **Account Safety Guarantee:**
> Saddu WhatsApp Scheduler exclusively uses official WhatsApp Click-to-Chat deep links:
> ```
> https://wa.me/PHONE_NUMBER?text=ENCODED_MESSAGE
> ```
> - **No Unofficial APIs or Bots:** We do **not** use Puppeteer, Selenium, headless browsers, or WhatsApp Web scraping.
> - **User-Initiated Action:** WhatsApp opens in a new tab with your pre-composed text ready. You review the message and manually tap **Send**.
> - **Anti-Ban Protection:** Using official `wa.me` links does not violate WhatsApp Terms of Service and carries zero risk to your personal or business account.
> - **No Background Automation:** The tool does not claim or attempt to send automated messages without user confirmation.

---

## 🛠️ Technology Stack

- **HTML5**: Semantic, accessible markup with desktop sidebar and mobile bottom navigation.
- **CSS3**: Modern WhatsApp green and white design system with responsive flex/grid layouts and CSS variables.
- **Vanilla JavaScript (ES6+)**: Modular architecture without third-party frameworks or build-step dependencies.
- **Web Audio API**: Real-time synthesized chime alerts.
- **LocalStorage API**: Persistent client-side data storage.
- **Python 3**: Project validation and static build utility (`python/build.py`).

---

## 💻 Local Development

You can run Saddu WhatsApp Scheduler locally using any static web server:

### Option A: Using Python
```bash
# Start a local static server from the project directory
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your web browser.

### Option B: Using Node.js
```bash
# Using npx serve or http-server
npx serve .
```

### Option C: Direct File Opening
Double-click `index.html` in your file explorer. (Note: For browser push notifications, HTTPS or a local server like `localhost` is recommended by browser security policies).

---

## 📦 Build & Validation Script

The project includes a Python build helper that validates assets and creates a production `dist/` bundle:

```bash
python python/build.py
```

The script will:
1. Verify the integrity and non-emptiness of all core files (`index.html`, `style.css`, `script.js`, `manifest.json`, `README.md`).
2. Validate JSON syntax and PWA fields in `manifest.json`.
3. Check `index.html` for relative asset links and security constraints.
4. Generate a clean `dist/` directory ready for deployment.

---

## 🚀 Step-by-Step GitHub Pages Deployment

Deploying **Saddu WhatsApp Scheduler** to GitHub Pages is completely free and takes less than 2 minutes:

### 1. Create a Repository
1. Visit [github.com/new](https://github.com/new).
2. Set the repository name to `SadduWhatsAppScheduler`.
3. Choose **Public** (or **Private** with GitHub Pro).
4. Leave *Add a README file*, *.gitignore*, and *license* unchecked.
5. Click **Create repository**.

### 2. Push Your Code
In your project directory, execute:
```bash
git add .
git commit -m "Deploy Saddu WhatsApp Scheduler v2.0"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/SadduWhatsAppScheduler.git
git push -u origin main
```

### 3. Enable GitHub Pages
1. In your GitHub repository, navigate to **Settings** → **Pages** (in the left sidebar).
2. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main`.
   - **Folder**: Select `/ (root)`.
3. Click **Save**.
4. Wait 30–60 seconds. Your live URL will appear at the top:
   ```
   https://<YOUR_GITHUB_USERNAME>.github.io/SadduWhatsAppScheduler/
   ```

---

## ⚠️ Limitations & Good Practices

- **Browser Tab Requirement:** Because this is a static browser application, browser notifications require the browser tab to remain active or open in the background. Device sleep or OS battery saver settings may pause timer execution until the device wakes up.
- **Repeat Count:** Repeating text multiplies the text inside **one single WhatsApp message** (e.g. 5x repeats the message 5 times separated by newlines). It will **never** spam multiple distinct messages.
- **Data Retention:** Clearing browser history, cookies, and website data will remove locally stored reminders and contacts. Use the **Export JSON Backup** feature in Settings to safeguard your data.
- **Anti-Spam Ethics:** Only send messages to recipients who have given their prior consent to be contacted.

---

## 📄 License

Free and open source for personal and commercial use under the [MIT License](LICENSE).
