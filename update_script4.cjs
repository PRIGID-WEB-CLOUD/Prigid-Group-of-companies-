const fs = require('fs');

const path = 'artifacts/luxe-boutique-admin/src/lib/googleWorkspace.ts';
let content = fs.readFileSync(path, 'utf8');

// Add attendees to GoogleCalendarEvent interface
content = content.replace(
  '  end: {\\n    dateTime?: string;\\n    date?: string;\\n    timeZone?: string;\\n  };',
  '  end: {\\n    dateTime?: string;\\n    date?: string;\\n    timeZone?: string;\\n  };\\n  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;'
);

fs.writeFileSync(path, content, 'utf8');
