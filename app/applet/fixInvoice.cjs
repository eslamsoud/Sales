const fs = require('fs');

let c = fs.readFileSync('src/components/InvoiceTab.tsx', 'utf8');

c = c.replace('        </div>\n\n      </div>\n\n      {/* Success Modal - Offers Download Receipt Image & WhatsApp Share */}\n          </>\n        )}', '          </>\n        )}');

fs.writeFileSync('src/components/InvoiceTab.tsx', c);
