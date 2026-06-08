const fs = require('fs');

let content = fs.readFileSync('src/components/FactoryTab.tsx', 'utf8');

// Replace standard Math.floor for loaded quantity
content = content.replace(/Math\.floor\(load\.quantity \/ \(weight\?\.unitsPerCarton \|\| 12\)\)/g, '(load.quantity / (weight?.unitsPerCarton || 12))');
content = content.replace(/Math\.floor\(l\.quantity \/ \(weight\?\.unitsPerCarton \|\| 12\)\)/g, '(l.quantity / (weight?.unitsPerCarton || 12))');
content = content.replace(/Math\.floor\(item\.quantity \/ weight\.unitsPerCarton\)/g, '(item.quantity / weight.unitsPerCarton)');

// Check if any numbers are formatted to avoid long decimals like 1.3333333333
// For `loadedCartons`, we might want to round it up to 2 decimals when displaying, but keep the exact value for calculations.

fs.writeFileSync('src/components/FactoryTab.tsx', content, 'utf8');
console.log("Replaced Math.floor in FactoryTab");
