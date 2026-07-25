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
//    src/pages/paamelding.astro.
// 5. Re-run "Deploy > Manage deployments" and create a new version any time
//    you edit this script — edits don't take effect on the existing URL
//    until redeployed.

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

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

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok' })
  ).setMimeType(ContentService.MimeType.JSON);
}
