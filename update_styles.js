const fs = require('fs');
const path = require('path');

const PRIMARY = '#1A365D';
const SECONDARY = '#2B6CB0';
const ACCENT = '#DD6B20';
const BG = '#F7FAFC';
const CARD_BG = '#FFFFFF';

function replaceStyleRules(content) {
  let newContent = content;

  // Background
  newContent = newContent.replace(/bg-slate-100/g, `bg-[${BG}]`);
  newContent = newContent.replace(/bg-gray-100/g, `bg-[${BG}]`);
  newContent = newContent.replace(/bg-slate-50/g, `bg-[${BG}]`);
  
  // Cards and frames: White with thin gray border
  newContent = newContent.replace(/bg-white/g, `bg-[${CARD_BG}]`);
  
  // Update texts mostly for titles (indigo to primary)
  newContent = newContent.replace(/text-indigo-900/g, `text-[${PRIMARY}]`);
  newContent = newContent.replace(/text-indigo-800/g, `text-[${PRIMARY}]`);
  newContent = newContent.replace(/text-slate-800/g, `text-[${PRIMARY}]`);
  newContent = newContent.replace(/text-slate-700/g, `text-[${PRIMARY}]`);
  newContent = newContent.replace(/text-indigo-700/g, `text-[${PRIMARY}]`);
  
  // Subtexts
  newContent = newContent.replace(/text-slate-500/g, `text-[${SECONDARY}]`);
  newContent = newContent.replace(/text-slate-400/g, `text-gray-400`);
  newContent = newContent.replace(/text-indigo-500/g, `text-[${SECONDARY}]`);
  
  // Active icons / Buttons (Primary)
  newContent = newContent.replace(/text-indigo-600/g, `text-[${PRIMARY}]`);
  newContent = newContent.replace(/bg-indigo-600/g, `bg-[${PRIMARY}]`);
  newContent = newContent.replace(/bg-indigo-700/g, `bg-[${PRIMARY}]`);
  newContent = newContent.replace(/hover:bg-indigo-700/g, `hover:bg-[${PRIMARY}]`);
  newContent = newContent.replace(/bg-slate-800/g, `bg-[${PRIMARY}]`);
  newContent = newContent.replace(/hover:bg-slate-700/g, `hover:bg-[${PRIMARY}]`);

  // Accent (prices, buy buttons, active tab borders)
  newContent = newContent.replace(/text-emerald-700/g, `text-[${ACCENT}]`);
  newContent = newContent.replace(/text-emerald-600/g, `text-[${ACCENT}]`);
  // If there's an orange/amber color for accent
  newContent = newContent.replace(/text-rose-600/g, `text-rose-600`); // Keep for negative/delete
  
  // Active Tab specific updates will need some regex
  // "shadow-md" on active tabs.
  // Actually, wait!

  return newContent;
}

const dir = './src/components';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file === 'Dashboard.tsx') continue;
  if (!file.endsWith('.tsx')) continue;

  const fullPath = path.join(dir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  fs.writeFileSync(fullPath, replaceStyleRules(content), 'utf8');
}

const appFile = './src/App.tsx';
let appContent = fs.readFileSync(appFile, 'utf8');
appContent = replaceStyleRules(appContent);
fs.writeFileSync(appFile, appContent, 'utf8');
