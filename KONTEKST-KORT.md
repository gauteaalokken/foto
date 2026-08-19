# KONTEKST-KORT

Kortversjon av [KONTEKST-FOR-KI.md](KONTEKST-FOR-KI.md), laget for chat-modeller med
begrenset kvote — den lange fila er ti ganger så stor og spiser opp gratisplanen på
én innliming.

**Bruk denne til små endringer:** farge, tekst, knapp, menylenke, ny enkel side.
**Bruk den lange til:** ny funksjon, bilder som oppfører seg rart, endringer i flere
filer samtidig, eller når modellen sier den mangler noe.

Sist oppdatert: 2026-08-19. Alle verdier er lest ut av repoet.

---

## 1. Hva siden er

- Fotoportefølje for Gaute Aaløkken på **https://gauteaalokken.com**.
- **Astro 7.2.2**, helt statisk. Ingen server, ingen database, ingen API-er utenom
  påmeldingsskjemaet på `/fjellmaraton`.
- **Innhold** = YAML-filer i `src/content/`, redigert via **Sveltia CMS** på `/admin`.
- **Bilder** ligger i **Cloudflare R2**, aldri i repoet. Innholdsfilene inneholder
  bare absolutte URL-er: `https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/<mappe>/<fil>.jpg`
- **Publisering**: push til `main` → GitHub Actions → GitHub Pages. Ingen kladd, ingen
  godkjenning, ingen preview-branch. **Lagret er publisert.**
- **Det finnes ingen tester, ingen linting, ingen typesjekk.** `npm run build` er den
  eneste kontrollen som finnes. Foreslå aldri at brukeren «kjører testene».
- Ni collections: `projects`, `prints`, `printSettings`, `feed`, `fjellmaraton`,
  `blog`, `blogSettings`, `portfolio`, `homepageSettings`.

---

## 2. Regler til deg som svarer

1. **Gi alltid tilbake hele den ferdige fila.** Ikke diff, ikke «endre linje 42», ikke
   utdrag med `...`. Brukeren merker alt i GitHub-editoren og limer over.
2. **Skriv filstien øverst i svaret**, f.eks. `src/components/Header.astro`.
3. **Ikke foreslå nye pakker, verktøy eller versjonsoppgraderinger.** Løs alt med det
   som allerede finnes.
4. **Følg mønstrene som er der.** CSS i `<style>` nederst i samme `.astro`-fil. Farger
   som `var(--navn)`, ikke som `#111`. Ingen ny mappestruktur, ingen omskriving til
   React eller komponentbibliotek.
5. **Behold kommentarene i koden.** De forklarer feil som allerede er rettet — fjerner
   du dem, kommer feilene tilbake.
6. **Spør heller enn å gjette.** Mangler du en fil, et feltnavn eller en verdi: be om å
   få det limt inn. Ikke finn på filnavn, CSS-klasser eller versjonsnumre.
7. **Brukeren har ikke kodebakgrunn.** Forklar kort hva endringen gjør og hvor den
   lagres, uten sjargong.
8. **Er dette egentlig innhold?** Bilder, titler, årstall, rekkefølge på forsiden,
   print-priser og valg av forsidelayout endres i **CMS-en på `/admin`**, ikke i kode.
   Si det i stedet for å skrive om en fil.
9. **Én fil om gangen.** Skal to filer endres, si det tydelig og ta dem i tur.

---

## 3. Slik er en .astro-fil bygd opp

Astro ligner på React på overflaten, men er det ikke. De vanligste feilene kommer av å
behandle det som React.

Tre deler, i denne rekkefølgen:

1. **Frontmatter** — alt mellom de to `---`-linjene øverst. Vanlig JavaScript som kjører
   **én gang under bygget**, på byggemaskinen. Denne koden finnes ikke i nettleseren.
2. **Malen** — HTML rett under. `{uttrykk}` setter inn en verdi,
   `{liste.map((x) => (<div>…</div>))}` gjentar, `{betingelse && (<div>…</div>)}` viser
   noe bare noen ganger.
3. **`<style>` og `<script>`** nederst.

Regler som er lette å bomme på:

- **`<style>` gjelder bare sin egen fil.** Derfor står `is:global` på stilene i
  `Layout.astro`, `feed/index.astro` og de tre forsidekomponentene — der lages elementene
  av JavaScript etter at siden er lastet. **Fjern aldri `is:global` fra disse fem filene.**
- **`<script>` kjører i nettleseren** og ser ikke variabler fra frontmatteren. Data sendes
  inn med `define:vars={{ ... }}` eller via en `<script type="application/json">`-tagg
  som leses med `JSON.parse`.
- **`<script>` i verktøysidene har `is:inline`.** Fjernes det, pakker Astro fila som en
  modul med eget navnerom, og hver eneste knapp slutter å virke — uten én feilmelding.
- **`[slug].astro`-filer må ha `getStaticPaths()`**, ellers bygges ingen sider.
- **Innhold hentes med `getCollection('projects')` / `getEntry('feed', 'index')`.**
  `entry.id` er filnavnet uten `.yml` og er URL-en. `entry.data` er feltene.
- **Alt er ferdig HTML.** Ingen server, ingen API-ruter, ingen server-side rendering.
  Foreslå aldri å hente innhold fra CMS-en i nettleseren — innholdet *er* filene i repoet.

Ny side = ny fil i `src/pages/`. `src/pages/om.astro` blir `/om`:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Om — Gaute Aaløkken" description="Kort om fotografen.">
  <div class="om">
    <h1>Om</h1>
    <p>Tekst her.</p>
  </div>
</Layout>

<style>
  .om { max-width: 600px; margin: 60px auto; padding: 0 20px; }
  h1 { font-family: var(--font-mono); font-weight: 500; }
</style>
```

Ett `../` per mappenivå ned fra `src/pages/`: filer rett i `pages/` bruker `../layouts/`,
filer i `pages/prints/` bruker `../../layouts/`.

---

## 4. Farger og skrift

Alle farger er definert **ett sted**, i `:root` i `src/layouts/Layout.astro`, og brukes
som `var(--navn)` overalt ellers. Skriver du ny CSS: bruk variabelen, ikke verdien.

| Variabel | Verdi | Rolle |
|---|---|---|
| `--ink` | `#111` | Tekst, knapper, rammer — «den mørke» |
| `--ink-muted` | `#555` | Sekundærtekst, brødtekst i sidepanel |
| `--ink-subtle` | `#888` | Årstall, metadata, bildetekst |
| `--ink-inverse` | `#fff` | Tekst på mørk flate |
| `--surface` | `#fafafa` | Sidebakgrunn, toppmeny, fullskjermseksjoner |
| `--surface-raised` | `#fff` | Hvite paneler, kort, dialoger |
| `--surface-sunken` | `#f3f3f3` | Print-kort og verktøyenes lerret |
| `--placeholder` | `#eee` | Plassholder bak bilder som ikke er lastet |
| `--overlay` | `rgba(0,0,0,0.92)` | Lightbox-bakgrunn |
| `--line-soft` / `--line` / `--line-strong` | `#eee` / `#ddd` / `#ccc` | Streker, svakest til sterkest |
| `--success` / `--danger` | `#1a7a1a` / `#b00020` | Status i påmeldingsskjemaet |

**Skrift:** `var(--font-mono)` er Space Mono (prosjekttitler, årstall, overskrifter),
`var(--font-body)` er systemskrift (alt annet). Space Mono serveres fra **vårt eget
domene** via npm-pakken `@fontsource/space-mono`, importert øverst i `Layout.astro`.
**Ikke legg tilbake en `<link>` mot fonts.googleapis.com.**

Verktøyene har i tillegg `--tool-accent` i `src/styles/verktoy.css`, som peker på `--ink`
og styrer primærknapper, valgt alternativ, fokusramme og slipp-soner i alle tre verktøy.

**Radius brukes ett eneste sted** (`4px` på bestillingsknappen). Alt annet har skarpe
hjørner med vilje.

---

## 5. Hvilken fil styrer hva

| Du vil endre | Fil |
|---|---|
| Menyen øverst | `src/components/Header.astro` — listen `navLinks`, linje 8–13 |
| Farger, skrift, sidetittel, delingstekst | `src/layouts/Layout.astro` |
| Forsiden: rutenett | `src/components/homepage/GridHomepage.astro` |
| Forsiden: fullskjerm-scroll (aktiv i dag) | `src/components/homepage/FullscreenScrollHomepage.astro` |
| Forsiden: portefølje-varianten | `src/components/homepage/PortfolioGridHomepage.astro` |
| Forsiden: sortering, bildestørrelser | `src/pages/index.astro` |
| Prosjektsider | `src/pages/prosjekter/[slug].astro` |
| Prints-oversikten | `src/pages/prints/index.astro` |
| Tekst og oppsett på print-sider | `src/pages/prints/[slug].astro` (priser: CMS → Print-priser) |
| Feed-siden | `src/pages/feed/index.astro` |
| Fjellmaraton: tekst, skjema, banner | `src/pages/fjellmaraton.astro` |
| Blogglisten | `src/pages/blogg/index.astro` |
| Blogginnlegg | `src/pages/blogg/[slug].astro` |
| Portefølje-siden | `src/pages/portefolje.astro` |
| 404-siden | `src/pages/404.astro` |
| E-postadresse og Instagram-lenke | `src/lib/site.ts` — brukes av både Header og prints |
| Fotoverktøy: utseende for alle tre | `src/styles/verktoy.css` |
| Fotoverktøy: rammen rundt | `src/layouts/VerktoyLayout.astro` |
| Fotoverktøy: knapper og felt | `src/pages/fotoverktoy/<verktøy>.astro` |
| Fotoverktøy: hva verktøyet gjør | `public/verktoy/<verktøy>.js` |
| Hvilke felter CMS-en viser | `public/admin/config.yml` **og** `src/content.config.ts` (begge!) |
| Alt innhold, alle bilder, print-priser, valg av forside | CMS-en på `/admin` — ikke i kode |

---

## 6. Ikke rør

| Fil / innstilling | Hvorfor |
|---|---|
| `public/CNAME` | Slettes den, mister siden domenet. |
| `backend`- og R2-verdiene i `public/admin/config.yml` | CMS-en slutter å kunne lagre, eller mister opplasting. |
| Versjonsnummeret `@sveltia/cms@0.178.0` i `public/admin/index.html` | Pinnet med vilje. |
| Filnavn i `src/content/projects/` og `prints/` | Filnavnet **er** URL-en. Ingen redirects finnes. |
| `astro.config.mjs` og alt i `src/lib/` | Bildepipelinen. Én endring der gjør alle bilder på siden døde. |
| `GAS_URL` i `src/pages/fjellmaraton.astro` | Påmeldinger forsvinner uten varsel. |
| Honeypot-feltet `name="website"` i skjemaet | Spamfelle. Gjøres det synlig, kastes ekte påmeldinger. |
| `is:global` i `Layout.astro`, `feed/index.astro` og de tre forsidekomponentene | Elementene lages av JS — uten den er de ustilte. |
| `is:inline` på `<script>` i verktøysidene | Uten den slutter hver knapp å virke, uten feilmelding. |
| Gruppa `User-agent: *` i `public/robots.txt` | Skal ha `Allow: /`. `Disallow: /` fjerner hele siden fra Google. |
| `package-lock.json`, `dist/`, `node_modules/` | Genereres automatisk. |
| `.env.local` | Inneholder R2-hemmeligheten. Skal aldri limes inn i en chat. |

---

## 7. Fallgruver

- **`year` skal alltid ha fnutter**: `year: '2024'`. Uten dem feiler valideringen.
  Bloggens `date` skal derimot stå **uten** fnutter. Ikke gjør dem like.
- **CMS-en skriver `null`, ikke tomme nøkler.** Nye felter skal være
  `.nullable().optional()` i `src/content.config.ts`.
- **Et bilde slettet i R2, men fortsatt nevnt i en YAML-fil, får bygget til å feile.**
  Fjern URL-en fra innholdet først, filen i R2 etterpå.
- **Rutenettene måles med `getBoundingClientRect()` og `Math.floor()`**, ikke
  `clientWidth` — sistnevnte runder opp og dytter siste bilde i hver rad ned på egen
  linje. Ikke bytt tilbake.
- **Layout-koden må kjøre på nytt ved breddeendring, etter `load`, etter at fonter er
  klare, og etter at hvert bilde er lastet.** Fjernes ett av kallene, blir radene ujevne.
- **Feed-en har både IntersectionObserver og en `setInterval`-poll.** Pollingen ser
  overflødig ut, men feeden satte seg fast uten den. Ikke fjern den.
- **Skjemaet sender `Content-Type: text/plain`** med vilje, for å unngå en CORS-preflight
  Apps Script ikke kan svare på.
- **Bildehøyde settes bevisst ikke.** Astros `inferSize` + `width` rapporterer feil høyde
  og klemmer bildene sammen. Ikke legg til `height`.
- **`sizes` avgjør hvilken bildefil som lastes ned.** Setter du `100vw` på et bilde som
  vises smalt, henter en telefon den største fila i `srcset` uten grunn.
- **Blogg og Portefølje er publisert selv når `showInNav` er av.** De er skjult fra
  menyen, ikke fra internett.
