const fs = require('fs');

let content = fs.readFileSync('src/components/InvoiceTab.tsx', 'utf8');

// Replace Math.floor logic for cartonsCount to preserve decimal carton fractions
content = content.replace(
  /const cartonsCount = Math\.floor\(item\.quantity \/ multiplier\);/g,
  `const cartonsCount = Number((item.quantity / multiplier).toFixed(3));`
);

// Also update the stock selection
content = content.replace(
  /const cartonsVal = Math\.floor\(stockVal \/ \(w\.unitsPerCarton \|\| 12\)\);/g,
  `const cartonsVal = Number((stockVal / (w.unitsPerCarton || 12)).toFixed(3));`
);

fs.writeFileSync('src/components/InvoiceTab.tsx', content, 'utf8');
console.log("Updated InvoiceTab cartonsCount");
