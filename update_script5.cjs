const fs = require('fs');

const path = 'artifacts/luxe-boutique-admin/src/pages/admin/AdminGoogleWorkspacePage.tsx';
let content = fs.readFileSync(path, 'utf8');

// The modal title change failed in update_script3.cjs, let's fix it manually

content = content.replace(
  '<h3 className="font-serif font-bold text-lg text-slate-900">Schedule Private Appointment</h3>',
  '<h3 className="font-serif font-bold text-lg text-slate-900">{editingEventId ? "Edit Private Appointment" : "Schedule Private Appointment"}</h3>'
);

content = content.replace(
  '<MdEventAvailable className="text-sm" />\\n                    Schedule Appointment',
  '<MdEventAvailable className="text-sm" />\\n                    {editingEventId ? "Save Changes" : "Schedule Appointment"}'
);

fs.writeFileSync(path, content, 'utf8');
