(() => {
  "use strict";
  const KEY = "saddu_whatsapp_scheduler_v1";
  const $ = (id) => document.getElementById(id);
  const form = $("scheduleForm");
  const phone = $("phone"), message = $("message"), repeat = $("repeat"), scheduleAt = $("scheduleAt");
  const list = $("reminderList");
  let reminders = load();
  let activeFilter = "upcoming";
  let notified = new Set();

  function load() {
    try { const data = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(data) ? data : []; }
    catch { return []; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(reminders)); render(); }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function normalizedPhone(value) { return value.replace(/\D/g, ""); }
  function composedText(item) { return Array(Math.min(100, Math.max(1, Number(item.repeat) || 1))).fill(item.message).join("\n"); }
  function formatDate(value) {
    return new Date(value).toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
  }
  function toast(text) {
    const node = $("toast"); node.textContent = text; node.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2800);
  }
  function updatePreview() {
    const count = Math.min(100, Math.max(1, Number(repeat.value) || 1));
    const base = message.value.trim();
    $("previewText").textContent = base ? (count > 1 ? `${base}\n\n… repeated ${count} times in one message` : base) : "Your message preview will appear here.";
    $("charCount").textContent = `${message.value.length} / 2000`;
  }
  function stats() {
    const now = new Date(), today = now.toDateString();
    $("scheduledCount").textContent = reminders.filter(x => !x.done).length;
    $("todayCount").textContent = reminders.filter(x => !x.done && new Date(x.at).toDateString() === today).length;
    $("preparedCount").textContent = reminders.length;
  }
  function render() {
    stats();
    const filtered = reminders.filter(x => activeFilter === "all" || (activeFilter === "done" ? x.done : !x.done))
      .sort((a,b) => new Date(a.at)-new Date(b.at));
    $("listCount").textContent = `${filtered.length} item${filtered.length===1?"":"s"}`;
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div><b>${activeFilter==="done"?"No completed reminders":"No reminders yet"}</b><p>${activeFilter==="upcoming"?"Create your first reminder using the form.":"Your reminders will appear here."}</p></div>`;
      return;
    }
    list.innerHTML = filtered.map(item => {
      const safeMessage = escapeHtml(item.message);
      const due = new Date(item.at).getTime() <= Date.now();
      const status = item.done ? `<span class="done-tag">COMPLETED</span>` : `<span class="reminder-time">${due ? "Due now" : escapeHtml(formatDate(item.at))}</span>`;
      return `<article class="reminder-card">
        <div class="reminder-top"><span class="reminder-number">+${escapeHtml(item.phone)}</span>${status}</div>
        <p class="reminder-message">${safeMessage}${Number(item.repeat)>1?`<br><small style="color:#829188">Text repeated ${Number(item.repeat)} times in one composed message</small>`:""}</p>
        <div class="reminder-meta"><span>${escapeHtml(formatDate(item.at))}</span><span>${item.done?"Marked done": "Reminder"}</span></div>
        <div class="card-actions">
          ${!item.done ? `<button class="small-btn open" data-action="open" data-id="${item.id}">Open WhatsApp</button><button class="small-btn" data-action="done" data-id="${item.id}">Mark done</button>` : ""}
          <button class="small-btn danger" data-action="delete" data-id="${item.id}">Delete</button>
        </div></article>`;
    }).join("");
  }
  function setDefaultDate() {
    const d = new Date(Date.now() + 10*60*1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    scheduleAt.min = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    scheduleAt.value = d.toISOString().slice(0,16);
  }
  function openWhatsApp(item) {
    const text = composedText(item);
    const url = `https://wa.me/${normalizedPhone(item.phone)}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const digits = normalizedPhone(phone.value);
    const count = Number(repeat.value);
    const at = new Date(scheduleAt.value);
    if (digits.length < 8 || digits.length > 15) return toast("Enter a valid number with country code.");
    if (!message.value.trim()) return toast("Please write a message first.");
    if (!Number.isInteger(count) || count < 1 || count > 100) return toast("Repeat count must be between 1 and 100.");
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return toast("Choose a future date and time.");
    reminders.push({id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())), phone:digits, message:message.value.trim(), repeat:count, at:at.toISOString(), done:false, alerted:false});
    save(); form.reset(); setDefaultDate(); updatePreview(); toast("Reminder saved on this device.");
  });
  [message, repeat].forEach(el => el.addEventListener("input", updatePreview));
  $("notifyBtn").addEventListener("click", async () => {
    if (!("Notification" in window)) return toast("This browser does not support notifications.");
    const permission = await Notification.requestPermission();
    toast(permission === "granted" ? "Browser notifications enabled." : "Notification permission was not granted.");
  });
  document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b===btn));
    render();
  }));
  list.addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]"); if (!btn) return;
    const item = reminders.find(x => x.id === btn.dataset.id); if (!item) return;
    if (btn.dataset.action === "open") openWhatsApp(item);
    if (btn.dataset.action === "done") { item.done = true; save(); toast("Reminder marked completed."); }
    if (btn.dataset.action === "delete") { reminders = reminders.filter(x => x.id !== item.id); save(); toast("Reminder deleted."); }
  });
  function checkDue() {
    const now = Date.now();
    reminders.forEach(item => {
      if (!item.done && !item.alerted && new Date(item.at).getTime() <= now) {
        item.alerted = true; localStorage.setItem(KEY, JSON.stringify(reminders));
        const body = `Message reminder for +${item.phone}. Open Saddu to review and open WhatsApp.`;
        if ("Notification" in window && Notification.permission === "granted") {
          const n = new Notification("Saddu: message reminder", {body, tag:item.id});
          n.onclick = () => { window.focus(); n.close(); };
        } else {
          toast("A message reminder is due. Open your reminder list.");
        }
        render();
      }
    });
  }
  $("year").textContent = new Date().getFullYear();
  setDefaultDate(); updatePreview(); render();
  setInterval(checkDue, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDue(); });
  window.addEventListener("focus", checkDue);
})();
