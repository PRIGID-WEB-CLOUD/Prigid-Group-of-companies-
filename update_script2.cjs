const fs = require('fs');

const path = 'artifacts/luxe-boutique-admin/src/pages/admin/AdminGoogleWorkspacePage.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Rename handleCreateCalendarEvent to handleSaveCalendarEvent
content = content.replace(
  'const handleCreateCalendarEvent = async (e: React.FormEvent) => {',
  'const handleSaveCalendarEvent = async (e: React.FormEvent) => {'
);
content = content.replace(
  '<form onSubmit={handleCreateCalendarEvent} className="space-y-4 font-[Manrope]">',
  '<form onSubmit={handleSaveCalendarEvent} className="space-y-4 font-[Manrope]">'
);

// 2. Add Edit button in the UI
const deleteBtnPattern = /<button\s+onClick=\{\(\) => handleDeleteCalendarEvent\(ev\.id, ev\.summary \|\| "Appointment"\)\}/;
content = content.replace(
  deleteBtnPattern,
  '<button\n                              onClick={() => handleEditCalendarEventClick(ev)}\n                              disabled={deletingEventId === ev.id || bulkDeletingEvents}\n                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50 transition-colors"\n                              title="Edit appointment"\n                            >\n                              Edit\n                            </button>\n                            <button\n                              onClick={() => handleDeleteCalendarEvent(ev.id, ev.summary || "Appointment")}'
);

fs.writeFileSync(path, content, 'utf8');
