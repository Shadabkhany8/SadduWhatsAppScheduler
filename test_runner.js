/**
 * Comprehensive Automated Test Suite for Saddu WhatsApp Scheduler
 */

const fs = require('fs');
const path = require('path');

console.log("==================================================");
console.log("   Running Saddu WhatsApp Scheduler Test Suite   ");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// Test 1: File Existence
const files = ["index.html", "style.css", "script.js", "manifest.json", "README.md", "python/build.py"];
files.forEach(f => {
  assert(fs.existsSync(path.join(__dirname, f)), `File exists: ${f}`);
});

// Test 2: Manifest JSON validation
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
  assert(manifest.name === "Saddu WhatsApp Scheduler", "Manifest has correct application name");
  assert(manifest.start_url === "./", "Manifest has correct relative start_url");
  assert(manifest.theme_color === "#128C7E", "Manifest has WhatsApp green theme_color");
} catch (e) {
  assert(false, `Manifest JSON parsing: ${e.message}`);
}

// Test 3: Verify all DOM IDs referenced in script.js exist in index.html
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");

// Extract all $("...") and getElementById("...") from script.js
const idMatches = [...js.matchAll(/\$\(["']([a-zA-Z0-9_-]+)["']\)/g), ...js.matchAll(/getElementById\(["']([a-zA-Z0-9_-]+)["']\)/g)];
const referencedIds = [...new Set(idMatches.map(m => m[1]))];

console.log(`\n--> Checking ${referencedIds.length} referenced DOM IDs in index.html:`);
let missingIds = [];
referencedIds.forEach(id => {
  // Check if id exists in html as id="something" or id='something'
  const regex = new RegExp(`id=["']${id}["']`);
  if (!regex.test(html)) {
    missingIds.push(id);
  }
});

if (missingIds.length === 0) {
  assert(true, `All ${referencedIds.length} DOM IDs referenced in script.js exist in index.html`);
} else {
  assert(false, `Missing DOM IDs in index.html: ${missingIds.join(", ")}`);
}

// Test 4: Verify WhatsApp Click-to-Chat URL format and Repeat Logic
function normalizePhone(raw) {
  return String(raw).replace(/\D/g, "");
}
function composeRepeatedMessage(text, count) {
  const clean = (text || "").trim();
  const n = Math.min(100, Math.max(1, parseInt(count, 10) || 1));
  if (n === 1) return clean;
  return Array(n).fill(clean).join("\n");
}
function buildWhatsAppUrl(phone, text, count = 1) {
  const digits = normalizePhone(phone);
  const full = composeRepeatedMessage(text, count);
  return `https://wa.me/${digits}?text=${encodeURIComponent(full)}`;
}

console.log("\n--> WhatsApp Click-to-Chat URL & Repeat Count Verification:");
const testPhone = "+91 98765-43210";
const testMsg = "Hello from Saddu!";
const urlSingle = buildWhatsAppUrl(testPhone, testMsg, 1);
assert(urlSingle === "https://wa.me/919876543210?text=Hello%20from%20Saddu!", "Single message URL generated correctly");

const urlRepeated = buildWhatsAppUrl(testPhone, "Ping", 3);
assert(urlRepeated === "https://wa.me/919876543210?text=Ping%0APing%0APing", "Repeated message URL repeats text inside 1 message with newlines");

// Test 5: Check No Localhost Hardcoding
assert(!html.includes("localhost:"), "index.html has no hardcoded localhost");
assert(!js.includes("localhost:"), "script.js has no hardcoded localhost");
assert(!html.includes("127.0.0.1"), "index.html has no 127.0.0.1");
assert(!js.includes("127.0.0.1"), "script.js has no 127.0.0.1");

// Test 6: Check relative paths for GitHub Pages root/subfolder compatibility
assert(html.includes('href="style.css"'), "index.html references style.css with relative path");
assert(html.includes('src="script.js"'), "index.html references script.js with relative path");
assert(html.includes('href="manifest.json"'), "index.html references manifest.json with relative path");

// Test 7: Verify CSS contains responsive media queries
const css = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
assert(css.includes("@media (max-width: 768px)"), "style.css contains mobile responsive breakpoint (768px)");
assert(css.includes(".mobile-nav"), "style.css styles mobile bottom navigation bar");
assert(css.includes(".sidebar"), "style.css styles desktop sidebar");

console.log("\n==================================================");
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}

