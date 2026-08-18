// Denne koden kjører i Google Apps Script, ikke på nettsiden. Fila her er en
// referansekopi — den gjør ingenting før den er limt inn i Apps Script og
// distribuert på nytt.
//
// Full framgangsmåte: scripts/LES-MEG-paamelding.md
//
// Kort versjon for å oppdatere:
//   Implementer > Administrer distribusjoner > blyantikon >
//   Versjon: "Ny versjon" > Implementer
// Bruk ALDRI "Ny distribusjon" — det lager en ny adresse som nettsiden ikke
// kjenner, og påmeldingene fortsetter til den gamle koden.

// Øk dette tallet hver gang du endrer koden her. Det sendes tilbake i svaret,
// så det er mulig å se utenfra hvilken versjon som faktisk er distribuert —
// uten å måtte lete i Google. Se "Sjekk hvilken versjon som kjører" i README.
const SCRIPT_VERSION = 3;

// Hvem varselet går til. Skrevet ut i klartekst med vilje: tidligere sto det
// tomt her og koden spurte Google om eierens adresse i stedet. Den returnerer
// tom streng i enkelte oppsett, og da hoppet varslingen stille over — rad i
// regnearket, men ingen e-post og ingen feilmelding.
const NOTIFY_EMAIL = 'gaute.aalokken@gmail.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Honningkrukke: feltet ligger utenfor skjermen på nettsiden, så et ekte
    // menneske fyller det aldri ut. Er det fylt, er det en robot. Vi svarer
    // "ok" så roboten ikke skjønner at den ble avvist — men lagrer ingenting.
    if (data.website) {
      return jsonResponse({ status: 'ok' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Tidspunkt',
        'Fornavn',
        'Etternavn',
        'E-post',
        'Telefon',
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

    sendVarsel(data);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    // Uten dette ville Apps Script returnert en HTML-feilside, som skjemaet
    // ikke klarer å lese. Ved å svare med JSON kan skjemaet si fra til den som
    // meldte seg på at det ikke gikk gjennom, i stedet for å vise falsk suksess.
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

// Brukes når sendVarsel kjøres manuelt fra menyen i Apps Script.
const TEST_PAAMELDING = {
  firstName: 'Test',
  lastName: 'Testesen',
  email: 'test@example.com',
  phone: '00000000',
  runde: 'Korte runden 12k',
  overnatting: 'Hytta',
  message: 'Dette er en test sendt fra Apps Script.',
};

/** Sender varsel om én påmelding. Kalles først etter at raden er lagret. */
function sendVarsel(data) {
  try {
    // Kjører du denne manuelt fra menyen øverst, følger det ingen påmelding
    // med. Da sender vi en testmelding i stedet for å stoppe med en feil om
    // at «firstName» ikke finnes — det er lett å velge denne framfor
    // testVarsel i nedtrekkslista, og begge bør gjøre noe fornuftig.
    if (!data) data = TEST_PAAMELDING;

    const navn = [data.firstName, data.lastName].filter(String).join(' ') || 'Ukjent navn';

    const linjer = [
      'Navn: ' + navn,
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

    const alternativer = {
      to: NOTIFY_EMAIL,
      subject: 'Ny påmelding: ' + navn,
      body: linjer.join('\n'),
    };

    // Gjør at du kan svare direkte til den som meldte seg på.
    if (data.email) alternativer.replyTo = data.email;

    MailApp.sendEmail(alternativer);
  } catch (err) {
    // Svelges med vilje: raden er allerede lagret her, så et problem med kvote
    // eller tillatelser skal ikke gjøre en påmelding som faktisk gikk gjennom
    // om til en feilmelding for den som meldte seg på. Feilen havner i
    // "Kjøringer" i menyen til venstre.
    console.error('Klarte ikke sende varsel: ' + err);
  }
}

/**
 * Kjør denne manuelt i Apps Script for å teste e-postvarselet.
 *
 * Velg "testVarsel" i nedtrekksmenyen øverst og trykk Kjør. Første gang spør
 * Google om tillatelse til å sende e-post — godta den, ellers sender skriptet
 * aldri noe. Kommer det en e-post, virker varslingen.
 */
function testVarsel() {
  sendVarsel(TEST_PAAMELDING);
}

function jsonResponse(payload) {
  payload.version = SCRIPT_VERSION;
  return ContentService.createTextOutput(
    JSON.stringify(payload)
  ).setMimeType(ContentService.MimeType.JSON);
}
