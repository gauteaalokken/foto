// Paste this into script.google.com as the code for a Google Sheets
// container-bound script, then deploy it as a web app (see instructions below).
//
// Setup:
// 1. Create a new Google Sheet (e.g. "Påmelding 26").
// 2. Extensions > Apps Script, delete the placeholder code, paste this file.
// 3. Deploy > New deployment > type "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy the deployment URL and paste it into GAS_URL in
//    src/pages/fjellmaraton.astro.
// 5. Re-run "Deploy > Manage deployments" and create a new version any time
//    you edit this script — edits don't take effect on the existing URL
//    until redeployed.
//
// Note: the first run after adding the email notification below will ask for
// permission to send mail on your behalf, since that's a new scope. Accept it,
// otherwise the notification silently does nothing.

// Where to send the notification. Leave empty to use the Google account that
// owns this script — that's you, since the deployment runs as "Me".
const NOTIFY_EMAIL = '';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Honeypot: the matching form field is positioned off-screen, so a real
    // visitor never fills it and anything in it means a bot. Reply "ok" so the
    // bot can't tell it was rejected — just don't write the row.
    if (data.website) {
      return jsonResponse({ status: 'ok' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Runde',
        'Overnatting',
        'Noe mer',
      ]);
    }

    sheet.appendRow([
      new Date(),
      data.firstName || '',
      data.lastName || '',
      data.email || '',
      data.phone || '',
      data.runde || '',
      data.overnatting || '',
      data.message || '',
    ]);

    notify(data);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    // Without this the script would return an HTML error page, which the form
    // can't parse — reporting the failure as JSON lets it tell the visitor
    // their sign-up didn't go through instead of showing a false success.
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

/** Emails a copy of the sign-up. Called only after the row is safely written. */
function notify(data) {
  try {
    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    if (!to) return;

    const name = [data.firstName, data.lastName].filter(String).join(' ') || 'Ukjent navn';

    const lines = [
      'Navn: ' + name,
      'E-post: ' + (data.email || '—'),
      'Telefon: ' + (data.phone || '—'),
      'Runde: ' + (data.runde || '—'),
      'Overnatting: ' + (data.overnatting || '—'),
      '',
      'Noe mer:',
      data.message || '—',
      '',
      'Hele lista: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    ];

    const options = { to: to, subject: 'Ny påmelding: ' + name, body: lines.join('\n') };

    // Lets you reply straight to the person from the notification.
    if (data.email) options.replyTo = data.email;

    MailApp.sendEmail(options);
  } catch (err) {
    // Deliberately swallowed: the row is already saved at this point, so a mail
    // quota or permission problem must not turn a sign-up that did go through
    // into an error message for the visitor. Shows up in the Apps Script log.
    console.error('Kunne ikke sende varsel: ' + err);
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(
    JSON.stringify(payload)
  ).setMimeType(ContentService.MimeType.JSON);
}
