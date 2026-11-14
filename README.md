# Saddu WhatsApp Scheduler

A free, static, browser-based reminder tool. It prepares a WhatsApp click-to-chat link; the user reviews the message and manually taps Send in WhatsApp.

## Important limitations
- This app does **not** send WhatsApp messages automatically.
- Repetition means repeating the text inside **one composed message**, not sending multiple separate messages.
- Browser reminders work only while the site is open in a browser tab (and may be delayed by device sleep, browser throttling, or OS settings).
- Notifications require browser permission and HTTPS (GitHub Pages provides HTTPS).
- Data is stored in this browser's local storage on this device. Clearing browser data can delete reminders.
- Use only for recipients who expect and consent to receive your messages. Avoid spam or repeated unwanted messages.

## Run locally
Open `index.html` in a modern browser. For best notification behavior, use a local static server:
```bash
python -m http.server 8000
```
Then visit http://localhost:8000.

## Prepare deployment with Python
From the project root:
```bash
python python/build.py
```
This copies the static site into `dist/`.

## Publish on GitHub Pages
1. Create a GitHub repository named `SadduWhatsAppScheduler`.
2. Upload `index.html`, `style.css`, `script.js`, `manifest.json`, `README.md`, and the `python/` folder.
3. Open repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)` (or select `dist/` if you configure a workflow to publish it).
6. Save and wait for the Pages URL to appear.

For the simplest setup, publish from the repository root. No Python server or paid service is required.
