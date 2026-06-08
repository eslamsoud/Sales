const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/ ج\.م/g, 'ج.م');
  fs.writeFileSync(filePath, content, 'utf8');
}

const dir = path.join(__dirname, 'src/components');
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.tsx')) {
    replaceInFile(path.join(dir, file));
  }
});

let appContent = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
appContent = appContent.replace(/ ج\.م/g, 'ج.م');
fs.writeFileSync(path.join(__dirname, 'src/App.tsx'), appContent, 'utf8');

console.log("Done replacing ' ج.م' with 'ج.م'");
