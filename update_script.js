const fs = require('fs');

const path = 'artifacts/luxe-boutique-admin/src/pages/admin/AdminGoogleWorkspacePage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add editingEventId state
content = content.replace(
  'const [showAddEventModal, setShowAddEventModal] = useState(false);',
  'const [showAddEventModal, setShowAddEventModal] = useState(false);\n  const [editingEventId, setEditingEventId] = useState<string | null>(null);'
);

// Add updateGoogleCalendarEvent to imports
content = content.replace(
  '  createGoogleCalendarEvent,',
  '  createGoogleCalendarEvent,\n  updateGoogleCalendarEvent,'
);

// Handle open add modal logic
content = content.replace(
  'const handleBookSessionForCustomer = (c: CustomerUser) => {',
  'const handleBookSessionForCustomer = (c: CustomerUser) => {\n    setEditingEventId(null);'
);

// We need a generic handleOpenAddModal
// Wait, they probably just set showAddEventModal(true) in a few places. Let's check where it's used.

fs.writeFileSync(path, content, 'utf8');
