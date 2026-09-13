const fs = require('fs');

const path = 'artifacts/luxe-boutique-admin/src/pages/admin/AdminGoogleWorkspacePage.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update sendUpdates defaults to false
content = content.replace(
  `    attendeeEmail: "",\n    attendeeName: "",\n    sendUpdates: true,`,
  `    attendeeEmail: "",\n    attendeeName: "",\n    sendUpdates: false,`
);

content = content.replace(
  `      attendeeEmail: attendee?.email || "",\n      attendeeName: attendee?.displayName || "",\n      sendUpdates: true,`,
  `      attendeeEmail: attendee?.email || "",\n      attendeeName: attendee?.displayName || "",\n      sendUpdates: false,`
);

content = content.replace(
  `      attendeeEmail: c.email,\n      attendeeName: c.name || "VIP Client",\n      sendUpdates: true,`,
  `      attendeeEmail: c.email,\n      attendeeName: c.name || "VIP Client",\n      sendUpdates: false,`
);

// 2. Update handleSaveCalendarEvent logic to automatically transition to Gmail Concierge with prefilled custom invitation template
const oldSaveLogic = `      let resultSummary = "";
      if (editingEventId) {
        const updated = await updateGoogleCalendarEvent(token, editingEventId, params);
        resultSummary = updated.summary;
        showToast(\`Appointment "\${resultSummary}" updated in Google Calendar\${eventForm.sendUpdates ? ' with updates sent' : ''}.\`);
      } else {
        const created = await createGoogleCalendarEvent(token, params);
        resultSummary = created.summary;
        showToast(\`Appointment "\${resultSummary}" scheduled in Google Calendar\${eventForm.sendUpdates ? ' with invite notifications sent' : ''}.\`);
      }
      setShowAddEventModal(false);
      refreshCalendarEvents(token);`;

const newSaveLogic = `      let resultSummary = "";
      if (editingEventId) {
        const updated = await updateGoogleCalendarEvent(token, editingEventId, params);
        resultSummary = updated.summary;
        showToast(\`Appointment "\${resultSummary}" updated in Google Calendar.\`);
      } else {
        const created = await createGoogleCalendarEvent(token, params);
        resultSummary = created.summary;
        showToast(\`Appointment "\${resultSummary}" scheduled in Google Calendar (Google default email suppressed).\`);
      }
      setShowAddEventModal(false);
      refreshCalendarEvents(token);

      // Automatic custom invitation via Gmail Concierge
      if (eventForm.attendeeEmail.trim() && !eventForm.sendUpdates) {
        const recipientEmail = eventForm.attendeeEmail.trim();
        const recipientName = eventForm.attendeeName.trim() || "Valued Client";
        const formattedDate = new Date(\`\${eventForm.startDate}T\${eventForm.startTime}:00\`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        });

        const subject = \`VIP Appointment Invitation: \${eventForm.summary.trim()}\`;
        const bodyHtml = \`<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
  <h2 style="font-family: Georgia, serif; color: #0f172a; margin-top: 0; font-size: 20px;">VIP Appointment Invitation</h2>
  <p style="font-size: 14px; line-height: 1.5;">Dear <strong>\${recipientName}</strong>,</p>
  <p style="font-size: 14px; line-height: 1.5;">We are delighted to confirm your upcoming appointment with <strong>LUXE Boutique Private Concierge</strong>.</p>
  <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; border-left: 4px solid #006c49; margin: 20px 0; font-size: 13px; line-height: 1.6;">
    <p style="margin: 4px 0;"><strong>Session:</strong> \${eventForm.summary.trim()}</p>
    <p style="margin: 4px 0;"><strong>Date:</strong> \${formattedDate}</p>
    <p style="margin: 4px 0;"><strong>Time:</strong> \${eventForm.startTime} – \${eventForm.endTime}</p>
    <p style="margin: 4px 0;"><strong>Location:</strong> \${eventForm.location.trim() || 'LUXE Boutique Flagship Suite'}</p>
    \${eventForm.description.trim() ? \`<p style="margin: 4px 0;"><strong>Notes:</strong> \${eventForm.description.trim()}</p>\` : ''}
  </div>
  <p style="font-size: 14px; line-height: 1.5;">Your appointment has been saved on our master calendar. If you have any special styling or beverage preferences prior to your arrival, feel free to reply directly to this message.</p>
  <p style="margin-top: 28px; color: #64748b; font-size: 13px; line-height: 1.5;">Warmest regards,<br/><strong style="color: #0f172a;">LUXE Boutique Private Concierge Team</strong></p>
</div>\`;

        const matchingCust = customers.find((c) => c.email.toLowerCase() === recipientEmail.toLowerCase()) || {
          id: "temp_" + Date.now(),
          name: recipientName,
          email: recipientEmail,
          role: "CUSTOMER",
          createdAt: new Date().toISOString(),
        };

        setSelectedCustomerForEmail(matchingCust);
        setEmailSubject(subject);
        setEmailBody(bodyHtml);
        setActiveTab("concierge");

        if (token) {
          setLoadingThreads(true);
          listGmailMessagesForEmail(token, recipientEmail)
            .then((threads) => setCustomerThreads(threads))
            .catch(() => setCustomerThreads([]))
            .finally(() => setLoadingThreads(false));
        }

        showToast(\`Calendar event created! Redirected to Gmail Concierge to send your white-labeled invitation to \${recipientEmail}.\`);
      }`;

content = content.replace(oldSaveLogic, newSaveLogic);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully updated AdminGoogleWorkspacePage.tsx");
