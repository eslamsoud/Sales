const fs = require('fs');
const path = require('path');

const PRIMARY = '#1A365D';
const SECONDARY = '#2B6CB0';
const ACCENT = '#DD6B20';
const BG = '#F7FAFC';
const CARD_BG = '#FFFFFF';
const INACTIVE_TAB = '#9CA3AF';

// We want to transform the app according to strict rules:
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. general background -> F7FAFC
  // replace bg-slate-100 or bg-slate-50 or bg-gray-50 or bg-gray-100 if it's the main wrapper.
  // Actually, wait, replacing classNames is tricky. Let's do string replacements.

  content = content.replace(/bg-slate-100/g, `bg-[${BG}]`);
  content = content.replace(/bg-slate-50/g, `bg-[${CARD_BG}] shadow-sm border border-gray-200`);
  content = content.replace(/bg-white/g, `bg-[${CARD_BG}]`);
  
  // Headers, Main titles, important text, active icons -> Primary #1A365D
  content = content.replace(/text-slate-800/g, `text-[${PRIMARY}]`);
  content = content.replace(/text-slate-700/g, `text-[${PRIMARY}]`);
  content = content.replace(/text-indigo-900/g, `text-[${PRIMARY}]`);
  content = content.replace(/text-indigo-800/g, `text-[${PRIMARY}]`);
  content = content.replace(/text-indigo-700/g, `text-[${PRIMARY}]`);
  content = content.replace(/bg-indigo-700/g, `bg-[${PRIMARY}]`);
  content = content.replace(/text-indigo-600/g, `text-[${PRIMARY}]`);
  content = content.replace(/bg-indigo-600/g, `bg-[${PRIMARY}]`);
  content = content.replace(/hover:bg-indigo-700/g, `hover:bg-[${PRIMARY}]`);
  content = content.replace(/border-indigo-600/g, `border-[${PRIMARY}]`);

  // Secondary -> #2B6CB0
  content = content.replace(/text-slate-600/g, `text-[${SECONDARY}]`);
  content = content.replace(/text-slate-500/g, `text-[${SECONDARY}]`);
  content = content.replace(/text-indigo-500/g, `text-[${SECONDARY}]`);
  
  // Accent -> #DD6B20 (buy, save, prices, ratings, final numbers)
  // Save/Buy buttons are often bg-emerald-600 / bg-indigo-600 (wait we replaced indigo-600 above, let's fix it later. "أزرار الشراء أو الحفظ" -> Usually "حفظ" translates to emerald or indigo button with "حفظ")
  content = content.replace(/text-emerald-700/g, `text-[${ACCENT}]`);
  content = content.replace(/text-emerald-600/g, `text-[${ACCENT}]`);
  content = content.replace(/bg-emerald-600/g, `bg-[${ACCENT}] text-white`);
  content = content.replace(/bg-emerald-[1-9]00/g, `bg-[${CARD_BG}] border border-gray-200`); // reset background variants
  
  // We'll write specific regexes or manipulate the DOM directly. But we can't do that.
  return content;
}

const dir = './src/components';
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file === 'Dashboard.tsx') continue;
  if (!file.endsWith('.tsx')) continue;

  const fullPath = path.join(dir, file);
  fs.writeFileSync(fullPath, processFile(fullPath), 'utf8');
}
