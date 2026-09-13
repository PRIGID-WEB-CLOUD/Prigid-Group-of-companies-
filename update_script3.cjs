const fs = require('fs');

const path = 'artifacts/luxe-boutique-admin/src/pages/admin/AdminGoogleWorkspacePage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update create/update logic inside handleSaveCalendarEvent
const targetLogic = `      const created = await createGoogleCalendarEvent(token, {
        summary: eventForm.summary.trim(),
        description: eventForm.description.trim(),
        location: eventForm.location.trim(),
        startDateTime: startDateTimeObj.toISOString(),
        endDateTime: endDateTimeObj.toISOString(),
        attendees,
        sendUpdates: eventForm.sendUpdates ? "all" : "none",
      });

      showToast(\`Appointment "\${created.summary}" scheduled in Google Calendar\${eventForm.sendUpdates ? ' with invite notifications sent' : ''}.\`);`;

const replacementLogic = `      const params = {
        summary: eventForm.summary.trim(),
        description: eventForm.description.trim(),
        location: eventForm.location.trim(),
        startDateTime: startDateTimeObj.toISOString(),
        endDateTime: endDateTimeObj.toISOString(),
        attendees,
        sendUpdates: eventForm.sendUpdates ? "all" : "none" as "all" | "none",
      };

      let resultSummary = "";
      if (editingEventId) {
        const updated = await updateGoogleCalendarEvent(token, editingEventId, params);
        resultSummary = updated.summary;
        showToast(\`Appointment "\${resultSummary}" updated in Google Calendar\${eventForm.sendUpdates ? ' with updates sent' : ''}.\`);
      } else {
        const created = await createGoogleCalendarEvent(token, params);
        resultSummary = created.summary;
        showToast(\`Appointment "\${resultSummary}" scheduled in Google Calendar\${eventForm.sendUpdates ? ' with invite notifications sent' : ''}.\`);
      }`;

content = content.replace(targetLogic, replacementLogic);

// Insert handleEditCalendarEventClick
const beforeHandleSave = `const handleSaveCalendarEvent = async (e: React.FormEvent) => {`;
const newHandler = `
  const handleEditCalendarEventClick = (ev: GoogleCalendarEvent) => {
    setEditingEventId(ev.id);
    
    let startD = "";
    let startT = "";
    let endD = "";
    let endT = "";
    
    if (ev.start?.dateTime) {
      const s = new Date(ev.start.dateTime);
      startD = s.toISOString().split("T")[0];
      startT = s.toTimeString().slice(0, 5);
    } else if (ev.start?.date) {
      startD = ev.start.date;
      startT = "00:00";
    }
    
    if (ev.end?.dateTime) {
      const e = new Date(ev.end.dateTime);
      endD = e.toISOString().split("T")[0];
      endT = e.toTimeString().slice(0, 5);
    } else if (ev.end?.date) {
      endD = ev.end.date;
      endT = "00:00";
    }

    const attendee = (ev.attendees && ev.attendees.length > 0) ? ev.attendees[0] : null;

    setEventForm({
      summary: ev.summary || "",
      description: ev.description || "",
      location: ev.location || "",
      startDate: startD,
      startTime: startT,
      endDate: endD,
      endTime: endT,
      attendeeEmail: attendee?.email || "",
      attendeeName: attendee?.displayName || "",
      sendUpdates: true,
    });
    
    setShowAddEventModal(true);
  };

  `;

content = content.replace(beforeHandleSave, newHandler + beforeHandleSave);

// Change modal title based on editingEventId
content = content.replace(
  '<h3 className="font-serif font-bold text-lg text-slate-900">Schedule Private Appointment</h3>',
  '<h3 className="font-serif font-bold text-lg text-slate-900">{editingEventId ? "Edit Private Appointment" : "Schedule Private Appointment"}</h3>'
);

// Change modal button based on editingEventId
content = content.replace(
  'Schedule Appointment',
  '{editingEventId ? "Save Changes" : "Schedule Appointment"}'
);

fs.writeFileSync(path, content, 'utf8');
