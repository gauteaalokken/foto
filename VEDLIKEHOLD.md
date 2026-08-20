# VEDLIKEHOLD

Praktisk steg-for-steg for å drifte gauteaalokken.com uten kodebakgrunn.
Teknisk referanse ligger i [KONTEKST-FOR-KI.md](KONTEKST-FOR-KI.md) — den er til KI-modeller, denne er til deg.

Sist oppdatert: 2026-08-16.

**Faste adresser**
| Hva | Hvor |
|---|---|
| Nettsiden | https://gauteaalokken.com |
| Redigering (CMS) | https://gauteaalokken.com/admin |
| Koden | https://github.com/gauteaalokken/foto |
| Byggestatus | https://github.com/gauteaalokken/foto/actions |
| Bildelagring | Cloudflare-dashboard → R2 → bøtta `foto-photos` |
| Påmeldinger | Google Sheet koblet til Apps Script (se punkt 10) |

---

## 1. Grunnregelen

Alt innhold — bilder, titler, årstall, rekkefølge — endrer du i **CMS-en på /admin**.
Alt utseende og all funksjonalitet — farger, tekster som ikke er innhold, nye sider — endrer du i **koden på github.com**.

Du trenger aldri installere noe for å gjøre noen av delene.

---

## 2. Hva skjer når du lagrer noe

1. Du trykker **Publish** i CMS-en (eller **Commit changes** på github.com).
2. Endringen lagres rett i `main`-grenen på GitHub. **Det finnes ingen kladd eller godkjenning — lagret er publisert.**
3. GitHub Actions starter automatisk et bygg.
4. Bygget tar typisk **1–3 minutter**. Har du lastet opp mange nye bilder, kan det ta vesentlig lenger, fordi hvert nye bilde lastes ned og skaleres.
5. Når bygget er grønt, er siden oppdatert. Ser du fortsatt det gamle: hard refresh (Cmd+Shift+R).

Vil du se om det gikk bra: gå til **Actions**-fanen på GitHub. Grønn hake = ferdig og publisert. Rødt kryss = bygget feilet, og **siden står uendret på forrige versjon** (den går aldri i svart av en feil).

---

## 3. Legge til et nytt prosjekt

1. Gå til https://gauteaalokken.com/admin og logg inn med GitHub.
2. Velg **Projects** i menyen til venstre → **New Projects**.
3. Fyll ut:
   - **Title** — blir overskriften, og bestemmer nettadressen. «Koster» → `/prosjekter/koster`.
   - **Year** — f.eks. `2025`. Vises som «(2025)» og styrer sorteringen (nyeste øverst).
   - **Order** — la stå tom. Fyll bare ut hvis prosjektet skal tvinges til en bestemt plass. Se punkt 4.
   - **Cover** — valgfritt. Last opp eller velg bildet som skal vises på forsiden. Står den tom, brukes det første bildet under.
   - **Pages** — last opp alle bildene, i den rekkefølgen de skal vises.
4. **Publish**.

**Tittelen bestemmer adressen, og adressen kan ikke endres senere uten at gamle lenker dør.** Tenk gjennom tittelen én gang før du publiserer.

---

## 4. Endre rekkefølgen på forsiden

Standard er nyeste årstall først. Vil du overstyre:

1. Åpne prosjektet i CMS-en.
2. Sett **Order** til et tall. **1** = helt først, **2** = nest først, osv.
3. Publish.

Alle prosjekter med et tall kommer foran alle prosjekter uten. Har to prosjekter samme tall, avgjør årstallet.
Vil du fjerne overstyringen: tøm feltet igjen.

De tomme rutene i rutenettet på forsiden er tilfeldige og trekkes på nytt hver gang noen laster siden. De er ikke innhold, og du kan ikke styre dem.

---

## 4b. Bytte hele forsiden

Forsiden finnes i fire ferdige varianter. Du bytter mellom dem i CMS-en, ikke i koden:
**CMS → Forside-innstillinger → «Type forside»**.

| Valg | Hva du får |
|---|---|
| **Rutenett med luft** | Prosjektomslag i rutenett, med tilfeldige tomme ruter imellom. |
| **Rutenett uten luft** | Samme rutenett, men prosjektene ligger tett etter hverandre. |
| **Fullskjerm-scroll** | Ett prosjekt om gangen i nesten hele skjermen. Du blar sideveis — med piltastene, hjulet, sveip eller pilene på hver side — og det går rundt i ring uten å stoppe. Hver besøkende starter på et tilfeldig prosjekt. **Dette er valget siden står på i dag.** |
| **Portefølje** | Den gamle forsiden: et rutenett av dine beste bilder, ikke knyttet til noe prosjekt. Henter samme bildeliste som `/portefolje`, så den blir tom hvis den lista er tom. |

Bytt så ofte du vil — ingenting av innholdet går tapt, og du kan alltid bytte tilbake. Bare husk at «Portefølje» trenger bilder under **Portfolio (for clients)** for å vise noe.

---

## 5. Legge til bilder i Feed

1. CMS → **Feed** → **Photos**.
2. Dra inn nye bilder, eller velg fra det som allerede ligger i R2.
3. Rekkefølgen i lista er rekkefølgen på siden. Dra for å flytte.
4. Publish.

Feeden har 936 bilder i dag. Lista i CMS-en er lang — nye bilder legges nederst med mindre du flytter dem.

**Vil du sortere hele feeden på nytt** (etter dato eller farge) må det gjøres fra en maskin med koden lastet ned — se punkt 11. Det er den eneste oppgaven som ikke kan gjøres i nettleseren.

---

## 6. Legge til en print

1. CMS → **Prints** → **New Prints**.
2. **Title** — blir overskriften og adressen (`/prints/unstad`).
3. **Photo** — bildet av den innrammede printen.
4. Publish.

**Priser og all tekst på print-sidene ligger i koden, ikke i CMS-en**, og er felles for alle prints. Skal en pris endres, se punkt 9 — det er en kodeendring, og den slår ut på alle prints samtidig.

---

## 7. Flaksjøen Fjellmaraton

**Bytte bildene øverst** (CMS → Flaksjøen Fjellmaraton → «Bilder over skjemaet»):
- **Det første bildet i lista er banneret** og havner i midten. Resten fordeles jevnt til venstre og høyre.
- På mobil vises **kun** det første bildet. Legg derfor det viktigste bildet først.
- 2–4 bilder passer best.

**Bytte bildene i rutenettet under**: samme sted, feltet «Photos».

**Se påmeldingene**: de skrives til et Google Sheet, ikke til nettsiden. CMS-en viser dem ikke.

**Endre teksten eller feltene i påmeldingsskjemaet**: kodeendring, se punkt 9. Legger du til et nytt felt i skjemaet, må Google Apps Script også oppdateres og redeployes — ellers forsvinner svarene i det nye feltet uten feilmelding. Se punkt 10.

---

## 8. Blogg og Portefølje

Begge sidene **finnes alltid** på `/blogg` og `/portefolje`. Bryteren i CMS-en styrer bare om de er lenket fra menyen — den skjuler dem ikke fra internett. Ikke legg noe der som ikke tåler å bli funnet.

Så lenge bryteren er av, ber siden heller ikke Google om å ta dem med i søk (de holdes utenfor sitemapen). Det er en forskjell på å ikke bli foreslått og å være hemmelig: har noen lenka, virker den fortsatt.

**Skrive et blogginnlegg**
1. CMS → **Blog** → **New Blog**.
2. **Title** og **Date** — datoen sorterer listen, nyeste først.
3. **Cover** — valgfritt. Bildet som vises i listen. Står den tom, brukes det første bildet i innlegget.
4. **Content blocks** — bygg innlegget av blokker, i den rekkefølgen de skal stå:
   - **Text** — vanlig tekst. Du kan bruke `##` for mellomtitler og `**stjerner**` for fet skrift.
   - **Single image** — ett bilde i full bredde, med valgfri bildetekst.
   - **Two images side by side** — legg inn nøyaktig 2.
   - **Image gallery** — flere bilder, med en **Layout**-velger: Grid, Masonry, Dense eller Carousel.
5. **Publish**.

**Bytte stil på et galleri**: åpne blokken og endre **Layout**-nedtrekkslisten. **Ikke slett blokken og legg inn bildene på nytt** — hele poenget med at det er én blokktype er at du slipper det.

**«Open directly in lightbox view»**: når den er på, åpner innlegget rett i fullskjermsvisning fra første bilde i stedet for vanlig sidevisning. Nyttig for rene bildeinnlegg.

**Endre hvordan blogg-forsiden ser ut**
CMS → **Blog settings**:
- **Show in navigation bar** — legger «Blogg» i menyen.
- **Page title** og **Intro text** — overskrift og kort tekst øverst.
- **Listing layout** — `Grid` (kort i kolonner), `Stacked` (én per rad) eller `Featured` (ett stort innlegg om gangen, med bla-knapper).

**Portefølje-siden**
CMS → **Portfolio (for clients)** → legg bilder i **Photos**. Slå på **Show in navigation bar** når du vil ha den i menyen, f.eks. mens du viser den til en kunde, og av igjen etterpå.
Er lista tom, viser siden en vennlig beskjed i stedet for å feile — det er sånn den står i dag.

---

## 9. Endre kode med en KI-modell i nettleseren

Dette er arbeidsflyten for alt som ikke er innhold: farger, tekster, ny side, ny meny­lenke, priser.

1. **Finn fila på GitHub.** Bruk tabellen i punkt 14, eller søk i repoet.
2. **Åpne fila og trykk på «Copy raw file»-knappen** (ikonet øverst til høyre i filvisningen). Nå ligger hele fila på utklippstavla.
3. **Start en chat med KI-modellen.** Lim inn i denne rekkefølgen:
   - hele **KONTEKST-FOR-KI.md**
   - hele **fila du skal endre**
   - hva du vil ha gjort, i klartekst
4. **Be alltid om hele den ferdige fila tilbake** — ikke «endre linje 42», ikke utdrag med `...`. Dette står også i KONTEKST-FOR-KI.md punkt 14, så modellen skal gjøre det av seg selv.
5. **Lim inn på GitHub:** åpne fila igjen → blyantikonet (Edit) → merk alt (Cmd+A) → lim inn det nye → **Commit changes** nederst.
6. **Sjekk Actions-fanen** etter et par minutter. Grønt = publisert.

**Én fil om gangen.** Skal to filer endres, ta én runde per fil.

**Går det galt:** se punkt 12. Ingenting du gjør her kan ødelegge noe permanent.

---

## 9b. Fotoverktøyene

De tre verktøyene (Fotogrid, Instagram-maler, Kalender) lå fram til 19.08.2026 som
løsrevne HTML-filer i `public/fotoverktoy/`, hver med sin egen kopi av toppmenyen.
De er nå vanlige sider på nettstedet og arver meny, skrift og farger derfra.

**Hvor ting ligger:**

| Fil | Hva den er |
|---|---|
| `src/styles/verktoy.css` | Utseendet — farger, knapper, felt, sidepanel. **Felles for alle tre.** |
| `src/layouts/VerktoyLayout.astro` | Rammen rundt: meny øverst, sidepanel til venstre, lerret til høyre |
| `src/pages/fotoverktoy/index.astro` | Oversiktssiden med de tre kortene |
| `src/pages/fotoverktoy/grid.astro` | Knapper og felt i Fotogrid (bare markup) |
| `public/verktoy/grid.js` | Hva Fotogrid faktisk gjør (all logikken) |
| `public/verktoy/jszip.min.js` m.fl. | Ferdige biblioteker, se nederst |

Samme mønster for `instagram` og `kalender`.

**Vil du endre utseendet på alle tre samtidig** — for eksempel gjøre knappene blå
i stedet for svarte — er det én linje øverst i `src/styles/verktoy.css`:

```css
--tool-accent: var(--ink);   /* bytt til f.eks. #2563eb */
```

Den styrer primærknapper, valgt alternativ, fokusramme rundt felt og slipp-soner
på én gang.

**Vil du legge til et nytt verktøy:**

1. Kopier `src/pages/fotoverktoy/grid.astro` til et nytt navn.
2. Kopier `public/verktoy/grid.js` tilsvarende, og pek `<script>`-taggen i den nye
   `.astro`-fila på den.
3. Legg verktøyet inn i lista øverst i `src/pages/fotoverktoy/index.astro`.

**⚠️ Det ene du må passe på:** `<script>`-taggene i verktøysidene har `is:inline`.
Fjerner du det, pakker Astro fila som en modul med eget navnerom — og da slutter
hver eneste knapp å virke, uten en eneste feilmelding noe sted. La `is:inline` stå.

**Gruppene i sidepanelet** er vanlige `<details class="control-section">`. Skriv
`open` på den som skal stå åpen når sida lastes, og la det stå tomt på den som
skal starte lukket:

```html
<details class="control-section" open>
  <summary>Ark</summary>
  <div class="control-section-innhold">
    ...kontrollene...
  </div>
</details>
```

Kontrollene finnes i DOM-en også når gruppa er lukket, så verktøyets JS treffer
dem som før. Bare Fotogrid er gruppert i dag; de to andre har få nok kontroller
til at det ikke trengs.

**Linja om hvor arbeidet blir av** settes som `lagring="..."` på
`<VerktoyLayout>`. Legg til `flyktig` hvis verktøyet *ikke* lagrer noe — da vises
den som en advarsel med rød strek i stedet for en nøytral opplysning. Fotogrid og
Kalender lagrer i nettleseren (IndexedDB); Instagram-verktøyet lagrer ingenting.

**Adressene til JS-filene får et avtrykk av innholdet automatisk**
(`/verktoy/grid.js?v=3d9b7bae`), via `src/lib/verktoyUrl.ts`. Uten det kunne
nettleseren servere en gammel kopi etter at du hadde endret verktøyet — filnavnet
var jo det samme — og endringen så ut til ikke å ha skjedd. Du skal aldri måtte
oppdatere et versjonsnummer for hånd; avtrykket regnes ut ved hvert bygg. Bruk
`verktoyUrl('filnavn.js')` i `src`-attributtet, ikke en fast streng.

**Bibliotekene i `public/verktoy/`** (jszip, jspdf, heic2any) er kopier av
npm-pakker med samme navn, lagt i repoet med vilje: da virker verktøyene uten
internett, og de kan ikke slutte å virke fordi en fremmed CDN legger om. Skal de
oppdateres:

```bash
npm install --save-dev jszip jspdf heic2any
cp node_modules/jszip/dist/jszip.min.js public/verktoy/jszip.min.js
cp node_modules/jspdf/dist/jspdf.umd.min.js public/verktoy/jspdf.umd.min.js
cp node_modules/heic2any/dist/heic2any.min.js public/verktoy/heic2any.min.js
```

Test deretter eksport til PDF og ZIP i Fotogrid før du publiserer.

---

## 10. Oppgaver som ikke gjøres i CMS eller GitHub

**Slette et bilde fra R2 (Cloudflare)**
Rekkefølgen er viktig: **fjern først bildet fra CMS-en**, publish, vent til bygget er grønt — **deretter** slett fila i R2. Gjør du det motsatt, feiler neste bygg fordi koden leter etter et bilde som ikke finnes lenger.

**Endre Google Apps Script (påmeldingsskjemaet)**
1. Åpne Google Sheet-et → **Utvidelser → Apps Script**.
2. Gjør endringen. Malen ligger i repoet som `scripts/google-apps-script-paamelding.gs`.
3. **Deploy → Manage deployments → rediger → ny versjon.** Uten dette steget peker nettsiden fortsatt på den gamle koden, og endringen får ingen effekt.
4. Test ved å sende inn skjemaet på siden og sjekke at raden dukker opp i arket.

**Laste opp robots.txt til bildebøtta**
Nettsiden har allerede sin egen `robots.txt` (fila `public/robots.txt` i repoet). Den dekker alt på gauteaalokken.com, inkludert de nedskalerte bildene under `/optimized/` — altså bildene folk faktisk ser.

Originalbildene ligger derimot på `pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev`, som er et **annet domene**. Crawlere leser robots.txt per domene, så den trenger sin egen:

1. Åpne `scripts/robots.txt` i repoet og last den ned. Den heter allerede det den skal hete i bøtta, så du trenger ikke døpe den om.
2. Cloudflare-dashbordet → **R2** → bøtta **foto-photos**.
3. Trykk **Upload** og legg fila i **roten** av bøtta — ikke inne i `feed/`, `projects/` eller noen annen mappe.
4. Sjekk at den virker: åpne https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/robots.txt i nettleseren. Du skal se teksten, ikke en feilmelding.

Skal lista oppdateres senere, endrer du `scripts/robots.txt` i repoet først, og laster opp på nytt. Da er de to filene aldri i utakt.

**Blokkere KI-crawlere for alvor (anbefalt)**
`robots.txt` er et *forbehold* — en høflig beskjed som de fleste store aktørene respekterer, men som en useriøs skraper kan ignorere. Vil du ha ekte håndheving, må bildene ligge på ditt eget domene inne i Cloudflare, ikke på deres `r2.dev`-adresse.

Dette er den eneste endringen i hele oppsettet som faktisk *avviser* en crawler i stedet for å be den la være.

1. **Koble bøtta til ditt eget domene.** Cloudflare → **R2** → **foto-photos** → **Settings** → **Public access** → **Custom Domains** → **Connect Domain**. Bruk f.eks. `bilder.gauteaalokken.com`. Cloudflare setter opp DNS selv hvis domenet allerede ligger i kontoen din.
2. **Vent til domenet er aktivt** (noen minutter) og sjekk at et bilde lastes: `https://bilder.gauteaalokken.com/feed/<et-filnavn>.jpg`.
3. **Slå på blokkering av KI-crawlere.** Cloudflare → velg domenet → **Security** → se etter innstillingen for AI-crawlere og skrapere. Den har hatt flere navn («Block AI Scrapers and Crawlers», «AI Crawl Control», «Bot Management»), så let etter noe med *AI* i navnet. Dette er én bryter.
4. **Vurder hotlink-beskyttelse** samme sted. Den hindrer andre nettsteder i å vise bildene dine direkte fra din bøtte.

**⚠️ Viktig hvis du gjør steg 1:** alle bilde-URL-ene i innholdsfilene peker på `pub-...r2.dev`. Bytter du domene, må du enten beholde det gamle domenet aktivt i tillegg, eller få alle URL-ene i `src/content/` og i `public/admin/config.yml` byttet til det nye. Det er en jobb for en KI-økt med hele repoet foran seg — ikke noe du gjør fil for fil i nettleseren. **Behold `r2.dev`-adressen aktiv til det er gjort**, ellers forsvinner alle bildene på siden.

Du kan trygt gjøre steg 1–2 og la det ligge der en stund. Siden fortsetter å bruke den gamle adressen inntil URL-ene faktisk byttes.

**Oppdatere CMS-en (Sveltia)**
Versjonen er låst med vilje i `public/admin/index.html`. Gjør bare noe med den hvis noe faktisk er ødelagt — da byttes versjonsnummeret, og du sjekker at /admin fortsatt fungerer etterpå.

---

## 11. Kjøre ting lokalt (bare hvis du må)

Trengs kun til å sortere feeden på nytt, eller til å se en endring før den går live.

Engangsoppsett: installer Node 22 eller nyere (samme versjon som GitHub bygger med), last ned repoet, og lag fila `.env.local` i mappa med linjen `R2_SECRET_ACCESS_KEY=…` (hemmeligheten fra Cloudflare).

```bash
npm install
```

Se siden lokalt på http://localhost:4321 :
```bash
npm run dev
```

Sorter feeden etter dato (nyeste først):
```bash
node scripts/sort-feed.mjs date feed
```

Sorter feeden etter farge:
```bash
node scripts/sort-feed.mjs color feed
```

**Advarsel:** sorteringsskriptet leser **hele** R2-bøtta og skriver `src/content/feed/index.yml` på nytt fra bunnen. Da kan prosjekt- og print-bilder havne i feeden. Se alltid gjennom endringen før du sender den til GitHub.

Bygg alt lokalt, som en siste sjekk før du pusher:
```bash
npm run build
```
Tar ca. 30 sekunder når bildene allerede er mellomlagret. Går den gjennom uten røde feil, går den gjennom på GitHub også.

---

## 12. Når noe går galt

**Bygget feilet (rødt kryss i Actions)**
Siden står trygt på forrige versjon. Klikk deg inn på det røde bygget → klikk på steget som feilet → les de siste linjene. De vanligste årsakene står i punkt 13.

**Angre den siste endringen**
1. Gå til https://github.com/gauteaalokken/foto/commits/main
2. Klikk på endringen du vil angre.
3. Trykk **Revert** oppe til høyre → **Commit changes**.
4. Et nytt bygg starter automatisk og setter siden tilbake.

**Hente tilbake en fil slik den var før**
Åpne fila på GitHub → **History** → velg en eldre versjon → kopier innholdet → lim det inn i fila og commit.

**Siden ser rar ut, men bygget er grønt**
Prøv hard refresh (Cmd+Shift+R) og en annen nettleser først. Er den fortsatt rar, er det en ekte kodefeil — revert siste endring etter oppskriften over, så er du tilbake til noe som virket.

---

## 13. Feilsøking

| Symptom | Sannsynlig årsak | Løsning |
|---|---|---|
| Bygget feiler rett etter at du slettet noe i R2 | Et bilde er slettet i R2 mens URL-en fortsatt står i en YAML-fil | Loggen sier «Fant ikke bildet i R2 (HTTP 404)» og hvilken URL det gjelder. Fjern det bildet i CMS-en, publish |
| Bygget feiler etter en manuell YAML-endring | Årstall uten fnutter (`year: 2024` i stedet for `year: '2024'`), eller feil innrykk | Rett i CMS-en, som skriver formatet riktig |
| Bygget tar veldig lang tid | Mange nye bilder, eller mellomlageret er tomt | Normalt. Vent — det går fort igjen neste gang |
| CMS-en kan ikke lagre | GitHub-innlogging utløpt, eller feil `repo`/`branch` i `public/admin/config.yml` | Logg inn på nytt. Endre aldri repo/branch |
| Opplastede bilder havner ikke i riktig mappe i R2 | `prefix:` i `public/admin/config.yml` er endret | Sett den tilbake |
| Et bilde vises ikke på siden, men finnes i R2 | Skrivefeil i URL-en, eller feil bokstav (æ/ø/å, mellomrom) i filnavnet | Velg bildet på nytt via CMS-en i stedet for å skrive URL-en |
| Påmeldingsskjemaet sier «Noe gikk galt» | Apps Script er endret uten å bli redeployet, eller URL-en er feil | Redeploy scriptet, se punkt 10 |
| Påmeldinger kommer ikke i arket, men skjemaet sier takk | Nytt felt lagt til i skjemaet uten at Apps Script har kolonnen | Oppdater og redeploy scriptet |
| Lightboxen er treg | Den henter originalbildet fra R2 i full oppløsning | Last opp mindre originaler neste gang |
| Søkemotorer slutter å finne siden | Noen har lagt til `Disallow: /` under `User-agent: *` i `public/robots.txt` | Kun de navngitte KI-crawlerne skal ha `Disallow: /`. Gruppa `User-agent: *` nederst skal ha `Allow: /` |
| Bildene i et rutenett står ujevnt | Layoutkode som ikke har målt bredden på nytt | Last siden på nytt. Skjer det hver gang, er det en ekte feil — revert |

---

## 14. Hvilken fil endrer hva

| Du vil endre | Fil på GitHub |
|---|---|
| Menyen øverst | `src/components/Header.astro` |
| Sidetittel, delingstekst, standard delingsbilde | `src/layouts/Layout.astro` |
| Bakgrunnsfarge og standardskrift for hele siden | `src/layouts/Layout.astro` |
| Hvilken av de fire forsidene som vises | CMS → Forside-innstillinger — ikke i kode, se punkt 4b |
| Forsiden: rutenettet med luft | `src/components/homepage/GridHomepage.astro` |
| Forsiden: fullskjerm-scroll (bla-piler, størrelse, bildetekst) | `src/components/homepage/FullscreenScrollHomepage.astro` |
| Forsiden: portefølje-varianten | `src/components/homepage/PortfolioGridHomepage.astro` |
| Forsiden: sortering av prosjekter, bildestørrelser | `src/pages/index.astro` |
| Prosjektsider: layout, «Tilbake»-lenke | `src/pages/prosjekter/[slug].astro` |
| Prints-oversikten | `src/pages/prints/index.astro` |
| Tekst og oppsett på print-sider (ikke prisene) | `src/pages/prints/[slug].astro` |
| Feed-siden | `src/pages/feed/index.astro` |
| Fjellmaraton: tekst, skjema, knapp, banner-layout | `src/pages/fjellmaraton.astro` |
| 404-siden | `src/pages/404.astro` |
| Hvilke felter CMS-en viser | `public/admin/config.yml` **og** `src/content.config.ts` (begge!) |
| Blogglisten (layout, kort) | `src/pages/blogg/index.astro` |
| Blogginnlegg (blokker, galleri, lightbox) | `src/pages/blogg/[slug].astro` |
| Portefølje-siden | `src/pages/portefolje.astro` |
| Hvilke crawlere som blokkeres på nettsiden | `public/robots.txt` |
| Hvilke crawlere som blokkeres på bildene | `scripts/robots.txt` — **må lastes opp til R2 manuelt**, se punkt 10 |
| Fotoverktøy: felles utseende (farger, knapper, sidepanel) | `src/styles/verktoy.css` — **én fil for alle tre** |
| Fotoverktøy: skallet rundt hvert verktøy | `src/layouts/VerktoyLayout.astro` |
| Fotoverktøy: oversiktssiden med de tre kortene | `src/pages/fotoverktoy/index.astro` |
| Fotoverktøy: knapper og felt i ett verktøy | `src/pages/fotoverktoy/<verktøy>.astro` |
| Fotoverktøy: hva et verktøy faktisk gjør | `public/verktoy/<verktøy>.js` |
| Prints: priser og størrelser | CMS → Print-priser — ikke i kode |
| Alt innhold og alle bilder | CMS-en på /admin — ikke i kode |

---

## 15. Ting du aldri skal endre

Full liste med begrunnelse står i KONTEKST-FOR-KI.md punkt 11. Det viktigste:

- `public/CNAME` — sletter du den, forsvinner domenet.
- `backend`-delen og R2-nøklene i `public/admin/config.yml` — CMS-en slutter å virke.
- Filnavnene i `src/content/projects/` og `src/content/prints/` — filnavnet **er** nettadressen.
- `astro.config.mjs` og alt i `src/lib/` — bildehåndteringen. Én liten endring der gjør alle bilder på siden døde.
- `GAS_URL` i `src/pages/fjellmaraton.astro` — påmeldinger forsvinner uten varsel.
- Honeypot-feltet i skjemaet (`name="website"`) — det stopper spam. Gjøres det synlig, kastes ekte påmeldinger.
- `package-lock.json`, `dist/`, `node_modules/` — genereres automatisk.
- `.env.local` — inneholder en hemmelighet. Skal aldri limes inn i en chat eller lastes opp.

---

## 16. Sjekkliste før du publiserer noe

- [ ] Endret jeg innhold? → gjør det i CMS-en, ikke i koden.
- [ ] Endret jeg kode? → fikk jeg **hele** fila tilbake fra KI-en, ikke et utdrag?
- [ ] Er dette et nytt prosjekt eller print? → er tittelen den jeg vil ha for alltid (den blir adressen)?
- [ ] Sletter jeg bilder? → fjernet fra CMS-en **først**, R2 **etterpå**.
- [ ] Etter publisering: sjekket jeg Actions-fanen for grønn hake?
- [ ] Ser siden riktig ut på mobil? Fjellmaraton-banneret oppfører seg annerledes der.

---

## 17. Ting bare du vet — fyll ut denne

Alt i punktene over kan leses ut av koden. Det under kan det ikke. Står det tomt, må den som skal hjelpe deg neste gang gjette — og det er akkurat de tingene som stopper siden helt når de ryker: et domene som ikke ble fornyet, en Cloudflare-konto ingen husker passordet til.

Fyll ut ved å redigere denne fila på github.com (blyantikonet → skriv → **Commit changes**). Ti minutter, én gang.

> **⚠️ Dette repoet er offentlig.** Skriv aldri passord, API-nøkler, gjenopprettingskoder eller kontonummer her. Skriv *hvor* de ligger («i 1Password»), ikke hva de er. Alt under er ment å tåle å bli lest av hvem som helst.

**Domenet**
- Registrar (hvor `gauteaalokken.com` er kjøpt):
- Fornyes omtrent (måned/år) — og er automatisk fornyelse på?
- Hvem administrerer DNS-postene:
- Hvilken e-postadresse får varsler om fornyelse:

**GitHub**
- Kontoen som eier repoet:
- Er tofaktor slått på, og hvor ligger gjenopprettingskodene (bare hvor):
- Pages-innstillingene (Settings → Pages): kilde skal være **GitHub Actions**, custom domain `gauteaalokken.com`, «Enforce HTTPS» på. Stemmer det i dag?

**Cloudflare (bildene)**
- E-post/konto som eier bøtta `foto-photos`:
- Betalt plan eller gratis, og hvem betaler:
- Hvor ligger `R2_SECRET_ACCESS_KEY` trygt (bare hvor):
- Er bøtta koblet til eget domene, og er blokkering av KI-crawlere slått på? (Se punkt 10.)

**Påmeldingene (Fjellmaraton)**
- Google-kontoen som eier arket og Apps Script:
- Lenke til Google Sheet-et:
- Sist redeployet script (dato):

**Bildene ellers**
- Hvor originalbildene finnes utenom R2 (disk, backup-tjeneste):
- Sist sjekket at den kopien faktisk virker:

**Hvis du blir borte en stund**
- Hvem kan overta / kontaktes:
- Hva som må skje minst én gang i året for at siden skal leve videre:
