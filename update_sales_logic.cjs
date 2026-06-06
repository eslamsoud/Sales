const fs = require('fs');
const path = require('path');

let content = fs.readFileSync('src/components/FactoryTab.tsx', 'utf8');

// 1. Format loadedCartons to at most 3 decimal places for display, e.g., using `parseFloat(loadedCartons.toFixed(3))` or similar. 
// Wait, we can just replace `loadedCartons` declarations globally in the file to automatically include this formatting.
// Find: `const loadedCartons = load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12));`
// Replace with: `const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));`

content = content.replace(
  /const loadedCartons = load\.cartonsCount !== undefined \? load\.cartonsCount : \(load\.quantity \/ \(weight\?\.unitsPerCarton \|\| 12\)\);/g,
  `const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));`
);

content = content.replace(
  /const loadedCartons = l\.cartonsCount !== undefined \? l\.cartonsCount : \(l\.quantity \/ \(weight\?\.unitsPerCarton \|\| 12\)\);/g,
  `const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));`
);

content = content.replace(
  /const loadedCartons = item\.cartonsCount !== undefined \? item\.cartonsCount : \(item\.quantity \/ \(weight\?\.unitsPerCarton \|\| 12\)\);/g,
  `const loadedCartons = Number((item.cartonsCount !== undefined ? item.cartonsCount : (item.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));`
);

// 2. Change `cartonsSold` (or `cartonsSoldNum`) to also be decimal-based and replace "loose/pieces" references.
// Find:
// const looseSold = totalUnitsSold % (weight?.unitsPerCarton || 12);
// const cartonsSoldNum = Math.floor(totalUnitsSold / (weight?.unitsPerCarton || 12));
// ctx.fillText(`${cartonsSoldNum} ك + ${looseSold} ع`, canvas.width - 605, y + 25);
// Replace with:
// const cartonsSoldNum = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));
// ctx.fillText(`${cartonsSoldNum} كرتونة`, canvas.width - 605, y + 25);

content = content.replace(
  /const looseSold = totalUnitsSold % \(weight\?\.unitsPerCarton \|\| 12\);\s*const cartonsSoldNum = Math\.floor\(totalUnitsSold \/ \(weight\?\.unitsPerCarton \|\| 12\)\);\s*ctx\.fillStyle = '#059669';\s*ctx\.fillText\(`\$\{cartonsSoldNum\} ك \+ \$\{looseSold\} ع`, canvas\.width - 605, y \+ 25\);/g,
  `const cartonsSoldNum = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));\n      ctx.fillStyle = '#059669';\n      ctx.fillText(\`\${cartonsSoldNum} كرتونة\`, canvas.width - 605, y + 25);`
);

// Find:
// const cartonsSold = Math.floor(totalUnitsSold / (weight?.unitsPerCarton || 12));
// const looseSold = totalUnitsSold % (weight?.unitsPerCarton || 12);
// const soldStr = cartonsSold > 0 || looseSold > 0
//   ? `${cartonsSold} ${accountingUnitLabel} ${looseSold > 0 ? `و ${looseSold} قطعة` : ''}`
//   : 'لم يتم بيع شيء بعد';
content = content.replace(
  /const cartonsSold = Math\.floor\(totalUnitsSold \/ \(weight\?\.unitsPerCarton \|\| 12\)\);\s*const looseSold = totalUnitsSold % \(weight\?\.unitsPerCarton \|\| 12\);\s*const soldStr = cartonsSold > 0 \|\| looseSold > 0\s*\? `\$\{cartonsSold\} \$\{accountingUnitLabel\} \$\{looseSold > 0 \? `و \$\{looseSold\} قطعة` : ''\}`\s*: 'لم يتم بيع شيء بعد';/g,
  `const cartonsSold = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));\n                    const soldStr = cartonsSold > 0\n                      ? \`\${cartonsSold} \${accountingUnitLabel}\`\n                      : 'لم يتم بيع شيء بعد';`
);

// And another incidence:
// <td className="border border-slate-800 p-1.5 text-center">
//   {cartonsSold} {looseSold > 0 ? `و ${looseSold} قطعة` : ''}
// </td>
content = content.replace(
  /\{cartonsSold\} \{looseSold > 0 \? `و \$\{looseSold\} قطعة` : ''\}/g,
  `{cartonsSold}`
);

// We should also remove the remaining definitions of looseSold in that block
content = content.replace(
  /const cartonsSold = Math\.floor\(totalUnitsSold \/ \(weight\?\.unitsPerCarton \|\| 12\)\);\s*const looseSold = totalUnitsSold % \(weight\?\.unitsPerCarton \|\| 12\);/g,
  `const cartonsSold = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));`
);


fs.writeFileSync('src/components/FactoryTab.tsx', content, 'utf8');
console.log("Updated sales and withdrawal parsing logic for cartons in FactoryTab");
