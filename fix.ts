import * as fs from 'fs';

const content = fs.readFileSync('src/components/ManageTab.tsx', 'utf-8');

const target_start = `        {/* TAB 4: Google Sync Options */}`;
const target_end = `        )}

      </div>
    </div>
  );
}`;

const start_idx = content.indexOf(target_start);
const end_idx = content.indexOf(target_end);

if (start_idx !== -1 && end_idx !== -1) {
  const new_content = content.substring(0, start_idx) + target_end;
  fs.writeFileSync('src/components/ManageTab.tsx', new_content, 'utf-8');
  console.log('Fixed!');
} else {
  console.log('Could not find targets');
}
