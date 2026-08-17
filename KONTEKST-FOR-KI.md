# KONTEKST-FOR-KI

Startpakke for KI-modeller uten tilgang til repoet. Lim inn hele fila øverst i chatten.
Sist oppdatert: 2026-08-16. Alle verdier er lest ut av repoet, ikke gjettet.

Søsterfila [VEDLIKEHOLD.md](VEDLIKEHOLD.md) er den praktiske steg-for-steg-guiden for mennesket
som drifter siden. Denne fila er den tekniske referansen for KI-en som hjelper til.

---

## 1. KORTVERSJON

- Fotoportefølje for Gaute Aaløkken på **https://gauteaalokken.com**.
- **Astro 7.2.2**, helt statisk side (ingen server, ingen database, ingen API-er utenom påmeldingsskjemaet).
- Innhold ligger som **YAML-filer i repoet** (`src/content/`), redigert via **Sveltia CMS** på `/admin`.
- Bilder ligger i **Cloudflare R2** (offentlig bøtte), ikke i repoet. Innholdsfilene inneholder bare URL-er.
- Publisering: push til `main` → **GitHub Actions** bygger → **GitHub Pages**. (Ikke Cloudflare Pages — Cloudflare brukes kun til bildelagring.)
- Sider: forside (prosjekter), prosjektside per prosjekt, Prints, Feed, Flaksjøen Fjellmaraton (med påmeldingsskjema), Blogg, Portefølje, 404, samt statiske HTML-verktøy under `/fotoverktoy/`.
- **Forsiden har fire innebygde layouter** som byttes fra CMS-en («Forside-innstillinger»), ikke i kode. Se punkt 4 og 8.
- **Blogg og Portefølje finnes alltid** på `/blogg` og `/portefolje`, men er som standard ikke lenket fra menyen — det styres av `showInNav` i CMS-en.
- Ingen CSS-rammeverk, ingen komponentbibliotek, ingen design tokens — all CSS er skrevet for hånd inne i hver `.astro`-fil.

---

## 2. TEKNISK STACK

**Kjøremiljø**
- Pakkebehandler: **npm** (`package-lock.json`, lockfileVersion 3). Ingen yarn/pnpm.
- Node lokalt: **v24.11.1**, npm 11.6.2.
- Node i GitHub Actions: **22** (satt i `.github/workflows/deploy.yml`).
- CI installerer med **`npm install`** (ikke `npm ci`). Lockfila er skrevet på en Mac, og på Linux trenger sharp to pakker til (`@emnapi/core`, `@emnapi/runtime`) som en macOS-oppløsning aldri får med seg. `npm ci` stopper på det og bygget feiler; `npm install` fyller inn hullet og følger ellers lockfila. Prøvd og verifisert 2026-08-16. Skal `npm ci` tas i bruk, må lockfila først genereres på Linux.

**Avhengigheter (`dependencies`)**
| Pakke | Versjon i package.json | Faktisk installert | Hva den gjør |
|---|---|---|---|
| `astro` | `^7.2.2` | **7.2.2** | Selve rammeverket. Bygger statiske HTML-sider, håndterer content collections og ruting. |
| `@astrojs/sitemap` | `^3.7.3` | 3.7.3 | Lager `sitemap-index.xml` + `sitemap-0.xml` ved bygg. Konfigureres i `astro.config.mjs`. |
| `unified` | `^11.0.5` | 11.0.5 | Motoren som kjører markdown-konverteringen i `src/lib/markdown.ts`. |
| `remark-parse` | `^11.0.0` | 11.0.0 | Leser markdown. |
| `remark-gfm` | `^4.0.1` | 4.0.1 | GitHub-dialekt (tabeller, gjennomstreking). |
| `remark-rehype` | `^11.1.2` | 11.1.2 | Markdown → HTML-struktur. |
| `rehype-stringify` | `^10.0.1` | 10.0.1 | HTML-struktur → HTML-tekst. |

**Utviklingsavhengigheter (`devDependencies`)**
| Pakke | Versjon | Faktisk | Hva den gjør |
|---|---|---|---|
| `@aws-sdk/client-s3` | `^3.1093.0` | 3.1093.0 | Brukes kun av `scripts/sort-feed.mjs` til å liste/laste ned bilder fra R2 (R2 snakker S3-protokoll). |
| `undici` | `^6.28.0` | 6.28.0 | Setter global timeout på alle utgående HTTP-kall i `astro.config.mjs`, så en treg R2-forbindelse ikke henger bygget for alltid. |
| `wrangler` | `^4.113.0` | 4.113.0 | Cloudflares CLI. Installert for manuell R2-administrasjon. Ingen `wrangler.toml` i repoet, og den kjører ikke i bygg eller deploy. |

**Transitive pakker som betyr noe**
- `sharp` **0.35.3** — kommer med Astro, brukes direkte av `src/lib/resolveImage.ts` og `scripts/sort-feed.mjs` til bildeskalering og fargeanalyse.
- `vite` **8.2.1** — Astros byggeverktøy, brukes ikke direkte.

De fem markdown-pakkene (`unified` og de fire remark/rehype-pakkene) fulgte tidligere bare med Astro uten å stå i `package.json`. De står nå i `dependencies` med egne versjoner, så bloggens tekstblokker er ikke lenger avhengige av at Astro tilfeldigvis drar dem inn.

**Integrasjoner**
- Én offisiell Astro-integrasjon: **`@astrojs/sitemap`**.
- Én egendefinert integrasjon, `flush-staged-images`, definert direkte i `astro.config.mjs`. Se punkt 9.
- Ingen markdown-plugins — alt innhold er YAML/data, ingen `.md`-filer med innhold.
- CMS: **Sveltia CMS 0.178.0**, lastet fra unpkg i `public/admin/index.html`. Ikke en npm-pakke.
- Skrifttype: **Space Mono** (400 + 700) fra Google Fonts, lastet i `<head>` i `Layout.astro`.

---

## 3. MAPPESTRUKTUR

```
foto/
├── .github/workflows/deploy.yml   Byggeoppskrift for GitHub Actions. Redigeres sjelden.
├── .claude/
│   ├── launch.json                Lokal dev-serverkonfig for Claude Code. Uviktig for siden.
│   └── settings.local.json        Lokale verktøytillatelser. Uviktig for siden.
├── .env.local                     GIT-IGNORERT. Inneholder R2_SECRET_ACCESS_KEY, kun til sort-feed.mjs.
├── astro.config.mjs               Astro-konfig + egen bilde-integrasjon. Du redigerer sjelden.
├── package.json                   Avhengigheter og npm-kommandoer.
├── package-lock.json              Låste versjoner. GENERERT — rediger aldri for hånd.
├── README.md                      Kort oversikt + pekere til de to dokumentasjonsfilene.
├── KONTEKST-FOR-KI.md             Denne fila. Teknisk referanse for KI-modeller.
├── VEDLIKEHOLD.md                 Praktisk steg-for-steg-guide for mennesket som drifter siden.
│
├── public/                        Kopieres rått til nettsiden, uendret.
│   ├── CNAME                      "gauteaalokken.com" — knytter domenet til GitHub Pages. IKKE SLETT.
│   ├── robots.txt                 Reserverer siden mot KI-trening. Blokkerer IKKE søkemotorer.
│   ├── favicon.svg                Fanikon.
│   ├── admin/
│   │   ├── index.html             Laster Sveltia CMS. Versjonen er pinnet med vilje.
│   │   └── config.yml             HELE CMS-oppsettet: collections, felter, R2-nøkler.
│   └── fotoverktoy/               Frittstående HTML-verktøy, uavhengig av Astro.
│       ├── index.html             Oversiktsside (Fotogrid / Rammer / Kalender maler).
│       ├── grid.html              "Fotogrid Pro" (1625 linjer).
│       ├── instagram.html         "Instagram Maler" (1016 linjer).
│       ├── Kalender.html          "Fotogrid Kalender" (1071 linjer).
│       └── icon.png
│
├── scripts/
│   ├── robots.txt                 Kopi av robots.txt som må lastes opp MANUELT til R2-bøtta.
│   │                              Gjør ingenting så lenge den bare ligger i repoet. Heter det
│   │                              samme som fila må hete i bøtta, så den kan lastes rett opp.
│   ├── sort-feed.mjs              Lokalt verktøy: sorterer R2-bilder etter dato eller farge og
│   │                              skriver src/content/feed/index.yml på nytt. Kjøres manuelt.
│   ├── slett-ubrukte.mjs          Engangsjobb som ALLEREDE ER KJØRT (2026-08-13). Slettet 113
│   │                              ubrukte filer fra R2. Lista er frosset — ikke kjør den på nytt
│   │                              uten å lage lista på nytt først. Se toppen av fila.
│   └── google-apps-script-paamelding.gs
│                                  Kode som er limt inn i Google Apps Script (ikke i drift herfra).
│                                  Tar imot påmeldinger og skriver dem til et Google Sheet.
│
├── src/
│   ├── content.config.ts          Definerer og validerer de åtte collections. Kode, ikke innhold.
│   │                              NB: ligger i src/, ikke inne i src/content/.
│   ├── content/
│   │   ├── projects/*.yml         14 prosjekter. Én fil per prosjekt. Skrives av CMS.
│   │   ├── prints/*.yml           17 prints. Én fil per print. Skrives av CMS.
│   │   ├── blog/*.yml             1 blogginnlegg. Én fil per innlegg. Skrives av CMS.
│   │   ├── feed/index.yml         Én fil, 936 bilde-URL-er. Skrives av CMS eller sort-feed.mjs.
│   │   ├── fjellmaraton/index.yml Én fil, 3 toppbilder + 46 galleribilder.
│   │   ├── homepageSettings/index.yml  Én fil, ett felt: hvilken av de fire forsidene som vises.
│   │   ├── blogSettings/index.yml Én fil. Tittel, intro, layout og nav-synlighet for /blogg.
│   │   └── portfolio/index.yml    Én fil. Bildeliste + nav-synlighet for /portefolje. Tom i dag.
│   ├── layouts/Layout.astro       Felles HTML-skall: <head>, meta/SEO, global CSS, header.
│   ├── components/
│   │   ├── Header.astro           Toppmeny.
│   │   └── homepage/              Én komponent per forsidelayout — index.astro velger mellom dem.
│   │       ├── GridHomepage.astro            «grid» og «gridTight»
│   │       ├── FullscreenScrollHomepage.astro «fullscreenScroll» (aktiv i dag)
│   │       └── PortfolioGridHomepage.astro   «portfolioGrid»
│   ├── lib/                       Hjelpekode for bildehåndtering. Rør bare hvis du vet hva du gjør.
│   │   ├── resolveImage.ts        Skalerer et R2-bilde med sharp, returnerer lokal /optimized/-sti.
│   │   ├── imageOutputQueue.ts    Mellomlagring av skalerte bilder på disk mellom bygg.
│   │   ├── fetchBuffer.ts         Nedlasting med timeout, 3 forsøk og URL-koding.
│   │   ├── markdown.ts            Markdown → HTML. Brukes kun av bloggens tekstblokker.
│   │   └── concurrency.ts         Kjører maks N nedlastinger samtidig.
│   ├── pages/                     Én fil = én URL.
│   │   ├── index.astro            /                    (forside, prosjektrutenett)
│   │   ├── 404.astro              /404
│   │   ├── fjellmaraton.astro     /fjellmaraton
│   │   ├── feed/index.astro       /feed
│   │   ├── prints/index.astro     /prints
│   │   ├── prints/[slug].astro    /prints/<slug>       (én side per print-fil)
│   │   ├── prosjekter/[slug].astro /prosjekter/<slug>  (én side per prosjekt-fil)
│   │   ├── portefolje.astro       /portefolje          (skjult med mindre showInNav er på)
│   │   ├── blogg/index.astro      /blogg               (skjult med mindre showInNav er på)
│   │   └── blogg/[slug].astro     /blogg/<slug>        (én side per blogginnlegg)
│   └── env.d.ts                   Typedefinisjoner. Rør ikke.
│
├── dist/                          GENERERT av bygget. Git-ignorert. Rør aldri.
├── .astro/                        GENERERT cache. Git-ignorert.
└── node_modules/                  GENERERT av npm install. Git-ignorert.
```

---

## 4. INNHOLDSMODELL

Åtte collections, definert to steder som må stemme overens:
`src/content.config.ts` (validering ved bygg) og `public/admin/config.yml` (redigeringsskjema i CMS).
**Legger du til et felt ett sted må du legge det til begge stedene.**

CMS-en committer **rett til `main`** — det er ikke satt opp noen kladde- eller godkjenningsflyt (`publish_mode` er ikke i bruk). Trykker redaktøren Publish, er endringen live så snart bygget er ferdig. Commit-meldingene fra CMS-en heter `Create Projects "x"` / `Update Projects "x"`.

### `projects` — mappe-collection
- Filer: `src/content/projects/<slug>.yml`, én per prosjekt. 14 stk i dag.
- URL: `/prosjekter/<filnavn-uten-.yml>`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `title` | tekst | Ja | Overskrift på prosjektsiden, tittel under bildet på forsiden, `<title>` og delingstekst. |
| `year` | tekst (i fnutter) | Ja | Vises som «(2023)» på forside og prosjektside. Brukes også til sortering — første tallgruppe i strengen, høyest år først. |
| `order` | tall | Nei (`null` når tomt) | Manuell rekkefølge på forsiden. Lavest tall først. Prosjekter med tall kommer alltid før prosjekter uten. Alle 13 filer som har feltet har i dag `order: null`. |
| `cover` | bilde-URL | Nei (`null` når tomt) | Forsidebildet i rutenettet. Er den tom, brukes `pages[0]`. |
| `pages` | liste med bilde-URL-er | Ja | Alle bildene i prosjektet, i rekkefølge. Vises i rutenettet på prosjektsiden. |

Ekte eksempel — `src/content/projects/koster.yml` (forkortet, den har 43 sider):
```yaml
title: Koster
year: '2024'
order: null
cover: https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/projects/GAUT4149.jpg
pages:
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/projects/GAUT3989.jpg
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/projects/GAUT3998.jpg
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/projects/GAUT4010.jpg
```
Merk: fire eldre filer (`flyktningsruta`, `balkan-boys`, `5-år-med-smilebu-t-o-ur`, `julaften`) mangler `cover`-nøkkelen helt. Det er gyldig — feltet er valgfritt.

### `blog` — mappe-collection
- Filer: `src/content/blog/<slug>.yml`, 1 stk i dag (`2026-08-07-test.yml`).
- URL: `/blogg/<filnavn-uten-.yml>`
- CMS-en lager filnavnet som `{{year}}-{{month}}-{{day}}-{{slug}}`, altså `2026-08-07-test`.

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `title` | tekst | Ja | Overskrift på innlegget og tittel i listen på /blogg. |
| `date` | dato (uten fnutter) | Ja | Vises som «7. august 2026» og sorterer listen, nyeste først. CMS-en skriver den uten fnutter, så YAML tolker den som en ekte dato — derfor `z.coerce.date()` i schemaet. |
| `cover` | bilde-URL | Nei (`null` når tomt) | Bildet i listen på /blogg. Er den tom, brukes det første bildet som finnes i blokkene under. |
| `openInLightbox` | ja/nei | Nei | Når på, åpner innlegget rett i fullskjermsvisning fra første bilde, i stedet for vanlig sidevisning. |
| `blocks` | liste med blokker | Ja | Selve innholdet. Fritt miks av tekst og bilder, i valgfri rekkefølge. |

**Fire blokktyper**, skilt med feltet `type`:

| `type` | Felter | Gir |
|---|---|---|
| `text` | `text` (markdown) | Vanlig tekst. Markdown støttes: `##` overskrift, `**fet**`, lister, lenker, tabeller. |
| `image` | `image`, `caption` (valgfri) | Ett bilde i full bredde, med valgfri bildetekst. |
| `image_pair` | `images` (nøyaktig 2) | To bilder side om side. |
| `image_gallery` | `layout`, `images` | Bildegalleri. `layout` er én av `grid` (like firkanter), `masonry` (naturlige proporsjoner i kolonner), `feed` (tett, som /feed) eller `carousel` (sideveis rulling). |

**`image_gallery` var tidligere fire separate blokktyper.** De ble slått sammen nettopp fordi det å bytte stil da krevde å slette blokken og legge inn alle bildene på nytt. Nå er det bare en nedtrekksliste. Ikke del dem opp igjen.

Ekte eksempel — `src/content/blog/2026-08-07-test.yml` (forkortet):
```yaml
title: Test
date: 2026-08-07
blocks:
  - type: text
    text: |-
      ## What is Lorem Ipsum?

      **Lorem Ipsum** is simply dummy text of the printing and typesetting industry.
  - type: image_gallery
    layout: feed
    images:
      - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/blog/006804320025_25.jpg
      - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/blog/DSCF0125.jpg
```

### `blogSettings` — enkeltfil
- Fil: `src/content/blogSettings/index.yml`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `showInNav` | ja/nei | Nei | Om «Blogg» vises i menyen. Siden finnes på `/blogg` uansett. |
| `title` | tekst | Nei | Overskrift øverst på /blogg. Standard «Blogg» hvis tom. |
| `intro` | tekst | Nei | Kort tekst under overskriften. |
| `listingLayout` | `grid` / `stacked` / `featured` | Nei | Hvordan innleggene listes: kort i kolonner, én per rad, eller ett stort om gangen med bla-knapper. Standard `grid`. |

Hele fila i dag:
```yaml
showInNav: false
title: Blog
intro: Test
```

### `homepageSettings` — enkeltfil
- Fil: `src/content/homepageSettings/index.yml`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `layout` | `grid` / `gridTight` / `fullscreenScroll` / `portfolioGrid` | Nei | Hvilken av de fire forsidene som vises. Standard `grid`. |

| Verdi | Forside |
|---|---|
| `grid` | Rutenett med tilfeldige tomme ruter mellom prosjektene. |
| `gridTight` | Samme rutenett uten tomme ruter. |
| `fullscreenScroll` | Ett prosjekt om gangen i nesten full skjermhøyde, sideveis rulling, uendelig løkke. **Aktiv i dag.** |
| `portfolioGrid` | Den gamle forsiden: masonry-rutenett av kuraterte bilder, henter samme bildeliste som `/portefolje`. |

Hele fila i dag:
```yaml
layout: fullscreenScroll
```

`src/pages/index.astro` leser feltet og henter **kun** data den valgte layouten trenger — bytter du til `portfolioGrid`, lastes ikke prosjektene i det hele tatt, og motsatt. Selve utseendet ligger i hver sin komponent under `src/components/homepage/`.

### `portfolio` — enkeltfil
- Fil: `src/content/portfolio/index.yml`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `showInNav` | ja/nei | Nei | Om «Portefølje» vises i menyen. Siden finnes på `/portefolje` uansett. |
| `photos` | liste med bilde-URL-er | Ja | Bildene på siden, i masonry-oppsett med lightbox. Tom i dag. |

Hele fila i dag:
```yaml
showInNav: false
photos: []
```
Er lista tom, viser siden en vennlig tomtilstand i stedet for å feile.

### `prints` — mappe-collection
- Filer: `src/content/prints/<slug>.yml`, 17 stk.
- URL: `/prints/<filnavn-uten-.yml>`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `title` | tekst | Ja | Overskrift, tittel ved hover i oversikten, `<title>`, og emnefeltet i bestillings-e-posten. |
| `photo` | bilde-URL | Ja | Bildet både i oversikten og på printens egen side. |

Ekte eksempel — hele `src/content/prints/unstad.yml`:
```yaml
title: Unstad
photo: https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/prints/Prints til salg_16.jpg
```
Priser, størrelser og all tekst på print-sidene er **hardkodet i `src/pages/prints/[slug].astro`**, ikke i innholdsfilene. Endrer du en pris, endres den for alle prints samtidig.

### `feed` — enkeltfil
- Fil: `src/content/feed/index.yml`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `photos` | liste med bilde-URL-er | Ja | Alle bildene på /feed, i rekkefølge. 936 stk i dag. |

```yaml
photos:
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/feed/R1-08599-031A.jpg
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/feed/R1-08599-035A.jpg
```

### `fjellmaraton` — enkeltfil
- Fil: `src/content/fjellmaraton/index.yml`

| Felt | Type | Påkrevd | Styrer |
|---|---|---|---|
| `topPhotos` | liste med bilde-URL-er | Nei (`null` når tom) | Bånd øverst på siden, over påmeldingsknappen, i full bredde. **Første bilde er banneret og havner i midten**, resten fordeles jevnt på hver side. Under 900 px skjermbredde vises bare banneret. 2–4 bilder passer best. |
| `photos` | liste med bilde-URL-er | Ja | Rutenettet under påmeldingsknappen. 46 stk i dag. |

```yaml
topPhotos:
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/fjellmaraton/44.jpg
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/fjellmaraton/FFM 26 4_1.jpg
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/fjellmaraton/FFM 26 4_2.jpg
photos:
  - https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/fjellmaraton/DSCF0018.jpg
```

---

## 5. BILDER OG MEDIA

**Lagring**
- Cloudflare R2, bøtte **`foto-photos`**, konto-ID `1904e782382751217d6103b2d39a41da`.
- Offentlig URL-rot: `https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev`
- Ingen bilder ligger i repoet (bortsett fra `public/favicon.svg` og `public/fotoverktoy/icon.png`).

**Mapper (prefixes) i bøtta — bestemt av `public/admin/config.yml`**
| Prefix | Brukes av |
|---|---|
| `projects/` | Prosjekters `cover` og `pages` |
| `prints/` | Prints' `photo` |
| `feed/` | Feed-siden |
| `fjellmaraton/` | Fjellmaraton-sidens `topPhotos` og `photos` |
| `blog/` | Blogginnleggenes `cover` og alle bilder i blokkene |
| `portfolio/` | Portefølje-sidens `photos` |

**Slik refereres de i innhold**
Full absolutt URL, alltid:
`https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev/<prefix>/<filnavn>.jpg`
Koden sjekker på `^https?://` for å avgjøre om et bilde skal hentes fra R2 eller fra `public/`.

**Hva som skjer med bildene under bygg — én pipeline for alt**
`src/lib/resolveImage.ts` laster ned originalen, skalerer med sharp og lagrer som **WebP** med filnavn = SHA1 av `URL:bredde:kvalitet`, i `node_modules/.image-staging/`. Etter bygget kopieres de til `dist/optimized/`. 1893 filer der i dag.
Mellomlageret gjenbrukes mellom bygg (og caches i GitHub Actions), så et uendret bilde skaleres aldri på nytt.

**Astros egen `getImage()` brukes ikke lenger noe sted.** Print-sidene gjorde det tidligere, og lastet derfor ned og skalerte 6–23 MB-originaler på nytt ved hvert eneste bygg. De bruker nå samme pipeline som resten, og `dist/_astro/` inneholder bare én CSS-fil.

**Bredder og kvalitet som faktisk brukes**
| Sted | Bredde | Kvalitet | Kilde |
|---|---|---|---|
| Forside, omslag i rutenett (`grid`/`gridTight`) | 500 / 900 px (srcset) | 85 | `src/pages/index.astro` |
| Forside, omslag i `fullscreenScroll` | 800 / 1400 / 2000 px (srcset) | 90 | `src/pages/index.astro` |
| Forside, `portfolioGrid` | 1400 px | 82 | `src/pages/index.astro` |
| Prosjektside, rutenett | 700 px | 82 | `src/pages/prosjekter/[slug].astro` |
| Feed, miniatyr | 500 px | 60 | `src/pages/feed/index.astro` |
| Fjellmaraton, rutenett | 700 px | 82 | `src/pages/fjellmaraton.astro` |
| Fjellmaraton, toppbilder | 900 / 1600 / 2400 px (srcset) | 88 | `src/pages/fjellmaraton.astro` |
| Prints, oversikt | 900 px | 85 | `src/pages/prints/index.astro` |
| Prints, egen side | 1000 px | 90 | `src/pages/prints/[slug].astro` |
| Blogg, listebilde | 700 px (1600 ved `featured`) | 80 | `src/pages/blogg/index.astro` |
| Blogg, enkeltbilde | 1400 px | 85 | `src/pages/blogg/[slug].astro` |
| Blogg, bildepar | 900 px | 85 | `src/pages/blogg/[slug].astro` |
| Blogg, galleri `grid`/`masonry` | 700 px | 82 | `src/pages/blogg/[slug].astro` |
| Blogg, galleri `feed` | 500 px | 70 | `src/pages/blogg/[slug].astro` |
| Blogg, galleri `carousel` | 1200 px | 85 | `src/pages/blogg/[slug].astro` |
| Portefølje | 1400 px | 82 | `src/pages/portefolje.astro` |

**`sizes` er ikke pynt.** Der et bilde har `srcset`, forteller `sizes` nettleseren hvor bredt bildet faktisk blir, og det er *den* verdien som avgjør hvilken fil som lastes ned. På `fullscreenScroll` er bildet begrenset av høyden som er igjen under menyen, ikke av vindusbredden, så `sizes` regnes ut per bilde fra dets eget sideforhold: `min(calc(100vw - 48px), calc(78vh * <sideforhold>))`. Skriver du «100vw» der i stedet, henter en telefon 2000px-fila til et bilde den viser 350px bredt.

**Lightbox**: klikker man på et bilde, vises **miniatyrbildet som allerede ligger i nettleseren** med én gang, og **originalen fra R2** bytter det ut når den er lastet ferdig. Bredden låses til den størrelsen originalen kommer til å få (samme bilde, samme proporsjoner), så byttet flytter ingenting. Originalen er fortsatt i full oppløsning — store originaler betyr fortsatt lang ventetid før den skarpe versjonen er på plass, men skjermen er ikke svart mens man venter.

**Å passe på ved opplasting**
- Last opp gjennom CMS-en (`/admin`), så havner filen i riktig prefix automatisk.
- Filnavn beholdes som de er. Mellomrom fungerer (f.eks. `FFM 26 4_1.jpg`), men unngå æ/ø/å og spesialtegn i nye filnavn.
- Bruk JPG. Skalering til WebP skjer automatisk ved bygg.
- Originalene bør ikke være unødvendig svære — de lastes ned på nytt hver gang bildet er nytt, og de er det lightboxen serverer.
- Sletter du et bilde fra R2 uten å fjerne URL-en fra YAML-filen, **feiler bygget**.

---

## 6. DESIGNSYSTEM

**Viktig og litt kjedelig: det finnes ingen design tokens i dette prosjektet.**
Det er ingen `:root`-variabler, ingen tokens-fil, ingen CSS-rammeverk. Hver farge er skrevet rett inn i `<style>`-blokken i hver enkelt `.astro`-fil. De to eneste custom properties i hele kodebasen er `--ratio` i `fjellmaraton.astro` og `--photo-max-h` i `FullscreenScrollHomepage.astro`, og begge er layout-utregninger, ikke tokens.

**Farger som faktisk brukes (antall forekomster i `src/`, talt 2026-08-16)**
| Verdi | Antall | Rolle | Filer |
|---|---|---|---|
| `#111` | 24 | Tekst, knapper, lenker, rammer | Header, Layout, 404, fjellmaraton, begge print-sidene, prosjektside, blogg, forsidekomponentene |
| `#fff` | 13 | Hvit tekst/bakgrunn i knapper, lightbox og fullskjermsforsiden | Flere |
| `#666` | 8 | «Ingen bilder ennå»-tekst | Flere |
| `#eee` | 8 | Plassholderfarge bak bilder som ikke er lastet | GridHomepage, feed, fjellmaraton, prosjektside, blogg |
| `#888` | 7 | Årstall / dempet tekst / datoer | Forsidekomponentene, prosjektside, blogg-sidene, portefølje |
| `rgba(0, 0, 0, 0.92)` | 6 | Lightbox-bakgrunn | Alle seks sidene med lightbox |
| `#555` | 3 | Undertittel, print-titler i oversikten | 404, fjellmaraton, `prints/index.astro` |
| `#ccc` | 3 | Skjemafelt-strek | fjellmaraton |
| `#ddd` | 2 | Skillelinje | Header, print-side |
| `#fafafa` | 2 | Sidebakgrunn | `Layout.astro` (body), `fjellmaraton.astro` (dialogpanel) |
| `#f2f2f2` | 2 | Grå ramme rundt print-bilder | begge print-sidene |
| `#fdfdfd` | 1 | Bakgrunn i toppmenyen | `Header.astro` |
| `#999` | 1 | Fotoverktøy-lenken i menyen | `Header.astro` |
| `rgba(255, 255, 255, 0.85)` | 1 | Bla-pilene på fullskjermsforsiden | `FullscreenScrollHomepage.astro` |
| `#444` | 1 | Dempet tekst i bloggen | `blogg/index.astro` |
| `#f0f0f0` | 1 | Plassholder i bloggens karusell | `blogg/index.astro` |
| `rgba(0, 0, 0, 0.55)` | 1 | Bakgrunn bak påmeldingsdialogen | fjellmaraton |
| `#767676` | 1 | Placeholder i nedtrekksliste | fjellmaraton |
| `#1a7a1a` | 1 | Grønn suksessmelding i skjema | fjellmaraton |
| `#b00020` | 1 | Rød feilmelding i skjema | fjellmaraton |

**Skrifter**
| Stack | Brukes til | Definert i |
|---|---|---|
| `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` | Standard for hele siden | `Layout.astro` (`body`) |
| `'Space Mono', monospace` | Prosjekttitler, årstall, 404-tallet, prosjektoverskrift | `index.astro` (2×), `prosjekter/[slug].astro` (2×), `404.astro` |
| `Helvetica, 'Helvetica Neue', Arial, sans-serif` | Kun påmeldingsdialogen og knappen på fjellmaraton | `fjellmaraton.astro` |

Space Mono lastes fra Google Fonts i `Layout.astro` med vekt 400 og 700.

**Fontstørrelser som er i bruk**
`0.8rem`, `0.85rem`, `0.9rem`, `0.95rem` (×2), `1rem` (×2), `1.1rem` (×2), `1.2rem`, `1.25rem`, `1.5rem`, `1.75rem`, `2rem`, `2.5rem` (×4), `4rem`, og `clamp(2rem, 5vw, 3.25rem)` på prosjektoverskriften.

**Spacing** — ingen skala, hver verdi er valgt lokalt. Vanligste tall: `20px`, `24px`, `32px`, `40px`, `48px`, `80px`, `100px`, samt rem-verdier i skjemaet (`0.5rem`, `0.75rem`, `1rem`, `2rem`, `2.5rem`).

**Mellomrom mellom bilder (gap)**: 9 px på feed, 10 px på prosjektsider og fjellmaraton, 24 px mellom prints, 32–48 px på forsiden.

**Breakpoints — alle som finnes**
| Breakpoint | Hva skjer | Fil |
|---|---|---|
| `max-height: 500px`, `max-width: 640px` | Menyen krymper (mindre tittel, tettere lenker). Høyderegelen er der fordi fullskjermsforsiden regner ut bildehøyden som «vindu minus meny» | `Header.astro` |
| `min-width: 640px` | Prosjektrutenettet på forsiden går fra 2 til 4 kolonner | `GridHomepage.astro` |
| `min-width: 640px` / `1024px` / `1440px` | Masonry-rutenettene går 2 → 3 → 4 → 5 kolonner | `PortfolioGridHomepage.astro`, `portefolje.astro` |
| `min-width: 640px` / `1024px` | Blogglisten går til flere kolonner | `blogg/index.astro` |
| `min-width: 768px` / `1400px` | Prints går fra 1 til 2 til 3 kolonner | `prints/index.astro` |
| `min-width: 900px` | Print-siden legger bilde og tekst side om side | `prints/[slug].astro` |
| `max-width: 900px` | Fjellmaraton skjuler alle toppbilder unntatt banneret | `fjellmaraton.astro` |
| `max-width: 480px` | Fornavn/etternavn stables i skjemaet | `fjellmaraton.astro` |
| `min-width: 500px` / `max-width: 500px` | Bloggens bildepar side om side vs. stablet | `blogg/[slug].astro` |
| `hover: none` | Bla-pilene på fullskjermsforsiden vises permanent, siden touch ikke har hover | `FullscreenScrollHomepage.astro` |

I tillegg finnes JS-baserte breakpoints i rutenettene (ikke CSS): feed bruker 480/768/1200/1440 px til å velge 5/7/9/14/20 kolonner; prosjektsider og fjellmaraton bruker 640/1024 px til 2/3/4 kolonner.

**Radius**: brukes ett eneste sted, `border-radius: 4px` på bestillingsknappen i `prints/[slug].astro`. Alt annet har skarpe hjørner — det er med vilje.

**Slik endrer du en farge riktig**
Siden det ikke finnes tokens, er «riktig» måte å **endre alle forekomstene av verdien i alle filene som bruker den til samme formål**. Be KI-en om å liste hvilke filer den endrer. Eksempel: bytter du tekstfargen `#111`, må Header, Layout, 404, fjellmaraton, begge print-sidene og prosjektsiden endres — men `#111` brukes også som knappebakgrunn, så sjekk formål før du bytter.
Ikke innfør en tokens-fil på egen hånd med mindre du bestemmer deg for det bevisst; det er en ny struktur, ikke en opprydding.

---

## 7. SLIK ER EN .ASTRO-FIL BYGD OPP

Les dette før du endrer en `.astro`-fil. Astro ligner på React/Next på overflaten, men er det ikke.

**Tre deler i hver fil, i denne rekkefølgen:**

1. **Frontmatter** — alt mellom de to `---`-linjene øverst. Vanlig JavaScript/TypeScript som kjører **én gang under bygget**, på byggemaskinen. Her hentes innhold og skaleres bilder. Denne koden finnes ikke i nettleseren.
2. **Malen** — HTML rett under frontmatteren. `{uttrykk}` setter inn en verdi, `{liste.map((x) => (<div>…</div>))}` gjentar noe per element, `{betingelse && (<div>…</div>)}` viser noe bare noen ganger.
3. **`<style>` og `<script>`** nederst.

**Regler som er lette å bomme på:**

- **`<style>` er scoped til sin egen fil.** En klasse du skriver i én fil treffer ikke elementer i en annen. Derfor står `is:global` på stilene i de tre forsidekomponentene, i `feed/index.astro` og i `Layout.astro` — der lages elementene enten av JavaScript etter at siden er lastet, eller stilene skal gjelde hele dokumentet. **Fjern aldri `is:global` fra disse fem filene.**
- **`<script>` kjører i nettleseren**, ikke under bygget. Den ser ikke variabler fra frontmatteren. To måter å sende data inn på, begge i bruk her:
  - `define:vars={{ gap: GAP }}` — sender enkle verdier inn (brukes i `feed/index.astro`).
  - `<script type="application/json" id="…" set:html={JSON.stringify(data)} />` og så `JSON.parse` i nettleseren (brukes i feed, fjellmaraton og prosjektsider til lightbox-listene).
- **`class:list={['a', betingelse && 'b']}`** er Astros måte å sette klasser betinget (brukes i `fjellmaraton.astro`).
- **Props** deklareres med `interface Props` og hentes med `Astro.props`. Kun `Layout.astro` tar props i dette prosjektet.
- **`[slug].astro`-filer må ha `getStaticPaths()`** som returnerer én oppføring per side. Uten den bygges ingen sider.
- **Innhold hentes med `getCollection('projects')` eller `getEntry('feed', 'index')`.** `entry.id` er filnavnet uten `.yml` og brukes som URL-slug. `entry.data` er feltene fra YAML-fila.
- **`import.meta.env.BASE_URL` er `/`** i dette prosjektet, siden `base` ikke er satt i `astro.config.mjs`. `withBase()` gjør derfor ingenting i praksis akkurat nå — men behold den, den er der for at ting skal virke hvis siden en dag flyttes til en undermappe.
- **Alt bygges én gang og serveres som ferdige HTML-filer.** Det finnes ingen server å kjøre kode på: ingen API-ruter, ingen `Astro.request`, ingen server-side rendering, ingen database. Foreslå aldri å hente innhold fra CMS-en i nettleseren — innholdet *er* filene i repoet.

**Minimalt komplett sideskjelett** (kopier dette når du lager en ny side):

```astro
---
import Layout from '../layouts/Layout.astro';

const overskrift = 'Om';
---

<Layout title="Om — Gaute Aaløkken" description="Kort om fotografen.">
  <div class="om">
    <h1>{overskrift}</h1>
    <p>Tekst her.</p>
  </div>
</Layout>

<style>
  .om {
    max-width: 600px;
    margin: 60px auto;
    padding: 0 20px;
  }

  h1 {
    font-family: 'Space Mono', monospace;
    font-weight: 500;
  }
</style>
```

Lagret som `src/pages/om.astro` blir dette `/om`. Importstien til `Layout` har ett `../` per mappenivå ned fra `src/pages/` — filer rett i `pages/` bruker `../layouts/`, filer i `pages/prints/` bruker `../../layouts/`.

---

## 8. KOMPONENTER OG SIDER

**Ruter**
| URL | Fil | Innhold |
|---|---|---|
| `/` | `src/pages/index.astro` | Velger én av fire forsidelayouter ut fra `homepageSettings`, og rendrer tilhørende komponent |
| `/prosjekter/<slug>` | `src/pages/prosjekter/[slug].astro` | Ett prosjekt: alle sider i rad-justert rutenett + lightbox |
| `/prints` | `src/pages/prints/index.astro` | Alle prints i kolonnelayout |
| `/prints/<slug>` | `src/pages/prints/[slug].astro` | Én print: bilde, priser, bestilling på e-post |
| `/feed` | `src/pages/feed/index.astro` | 936 bilder, rad-justert, lastes i puljer ved scroll |
| `/fjellmaraton` | `src/pages/fjellmaraton.astro` | Toppbånd, påmeldingsknapp + dialog, bilderutenett |
| `/blogg` | `src/pages/blogg/index.astro` | Liste over blogginnlegg. Tre layouter styrt fra CMS. Skjult fra menyen med mindre `showInNav` er på. |
| `/blogg/<slug>` | `src/pages/blogg/[slug].astro` | Ett blogginnlegg, satt sammen av blokker + lightbox |
| `/portefolje` | `src/pages/portefolje.astro` | Kuratert bildeside i masonry + lightbox. Skjult fra menyen med mindre `showInNav` er på. |
| `/404` | `src/pages/404.astro` | Feilside |
| `/admin` | `public/admin/index.html` | Sveltia CMS (ikke en Astro-side) |
| `/fotoverktoy/*` | `public/fotoverktoy/*.html` | Frittstående HTML-verktøy, helt utenfor Astro |

**Komponenter og layout** (det er fem)
- `src/layouts/Layout.astro` — props: `title` (str., default «Gaute Aaløkken»), `description` (str., default fotografi-teksten), `image` (str., default et R2-bilde), `bodyClass` (str., valgfri — brukes bare av fullskjermsforsiden, som må låse rullingen på `<body>`). Gir `<head>`, all SEO/Open Graph/Twitter-meta, canonical-URL, Google Fonts, global CSS og `<Header />`. Alle sider bruker den.
- `src/components/Header.astro` — ingen props. Navnelenke til forsiden, meny (Flaksjøen Fjellmaraton, Prints, Feed, Fotoverktøy), e-post-ikon og Instagram-ikon. Leser i tillegg `portfolio` og `blogSettings` fra innholdet, og skyter inn «Portefølje» og «Blogg» på plass 1 i menyen når `showInNav` er satt.
- `src/components/homepage/GridHomepage.astro` — props: `projects`, `tight`. Rutenettforsiden. `tight` slår av de tilfeldige tomme rutene.
- `src/components/homepage/FullscreenScrollHomepage.astro` — props: `projects`. Ett prosjekt om gangen, sideveis rulling med uendelig løkke (klonet første/siste), tilfeldig startprosjekt, piltaster og bla-piler.
- `src/components/homepage/PortfolioGridHomepage.astro` — props: `photos`. Den gamle forsiden: masonry + lightbox.

Forsidekomponentene tar imot ferdig oppløste bilder fra `index.astro` og gjør ingen bildebehandling selv.

**Hjelpefunksjoner**
- `src/lib/resolveImage.ts` — `resolveImage(url, bredde, kvalitet)` → sti til skalert WebP. `resolveImageWithAspectRatio(...)` → samme + reelt sideforhold. `withBase(sti)`, `isRemote(sti)`.
- `src/lib/imageOutputQueue.ts` — les/skriv mellomlager på disk, og manifest over hvilke bilder bygget faktisk brukte.
- `src/lib/fetchBuffer.ts` — `fetchWithRetry(url)`, 15 s timeout, 3 forsøk.
- `src/lib/concurrency.ts` — `mapWithConcurrency(liste, maksSamtidig, fn)`.
- `src/lib/markdown.ts` — `markdownToHtml(markdown)`. Brukes kun av bloggens `text`-blokker.

**Alle sider bruker `lib/`-pipelinen.** `resolveImageSrcSet` brukes der ett bilde trengs i flere størrelser (forsideomslag, fjellmaraton-banner), `resolveImageWithAspectRatio` der rutenettet må vite sideforholdet før bildet er lastet, og `resolveImage` ellers. `prints/index.astro` har fortsatt sin egen lokale kopi av `withBase` — den gjør det samme som den i `lib/`.

---

## 9. BYGG OG DEPLOY

**Kommandoer (`package.json`)**
```
npm run dev        astro dev      — lokal utviklingsserver, port 4321
npm run build      astro build    — bygger til dist/
npm run preview    astro preview  — viser bygget resultat lokalt
npm run sort-feed  node scripts/sort-feed.mjs — sorterer feed-YAML. Kjøres manuelt, ikke i bygg.
```

**Målt bygg 2026-08-16 (lokalt, varm cache): 39 sider på 1,6 sekunder.** De 39 Astro bygger er 14 prosjektsider + 17 print-sider + 1 blogginnlegg + forside, /prints, /feed, /fjellmaraton, /blogg, /portefolje og /404. I tillegg kopieres /admin og de fire fotoverktøy-sidene rått fra `public/`, så `dist/` ender med 44 HTML-filer.

Med tom cache tar bygget vesentlig lenger — da skal over tusen bilder hentes fra R2 og skaleres på nytt.

**Det finnes ingen tester, ingen linting og ingen typesjekk** — verken lokalt eller i CI. `npm run build` er den eneste kontrollen som finnes: går den gjennom, er endringen syntaktisk og innholdsmessig gyldig. Foreslå aldri at brukeren «kjører testene».

**Output**: `dist/`, ca. 114 MB. Git-ignorert. Inneholder `index.html`, `404.html`, `CNAME`, `favicon.svg`, `robots.txt`, `sitemap-index.xml`, `sitemap-0.xml`, `admin/`, `fotoverktoy/`, `feed/`, `fjellmaraton/`, `prints/`, `prosjekter/`, `blogg/`, `portefolje/`, `_astro/` (1 CSS-fil) og `optimized/` (1893 filer).

**Sitemap**: `@astrojs/sitemap` lager fila ved hvert bygg. Filteret i `astro.config.mjs` holder `/admin` og `/fotoverktoy` ute alltid, og `/blogg` og `/portefolje` ute så lenge `showInNav` er av for dem — en side som med vilje er holdt utenfor menyen skal ikke meldes inn til Google. Sidene bygges og publiseres uansett; det er bare sitemapen de holdes ute av.

**Publisering — dette er GitHub Pages, ikke Cloudflare Pages.**
`.github/workflows/deploy.yml`:
1. Utløses av push til `main`, eller manuelt (`workflow_dispatch`).
2. `actions/checkout@v4` → `actions/setup-node@v4` med Node 22 og `cache: npm` (mellomlagrer nedlastede pakker) → `npm install`.
3. `actions/cache@v4` gjenoppretter `node_modules/.astro` og `node_modules/.image-staging` (nøkkel `image-cache-<run_id>`, restore-key `image-cache-`). Dette er grunnen til at bygg nummer to går fort — allerede skalerte bilder gjenbrukes. **Rekkefølgen er ikke tilfeldig:** installasjonen kan skrive om `node_modules`, så bildecachen må gjenopprettes *etter* den, ikke før.
4. `npm run build`.
5. `actions/upload-pages-artifact@v3` med `dist/` → `actions/deploy-pages@v4`.

Domenet `gauteaalokken.com` kommer fra `public/CNAME`, som kopieres til `dist/CNAME`.

**Cloudflares rolle**: kun R2-lagring av bilder. Ingen `wrangler.toml`, ingen Cloudflare Pages-kobling, ingen Workers.

**Miljøvariabler**
- **I bygg/CI: ingen.** Workflowen setter ikke én eneste `env`.
- **Lokalt**: `.env.local` (git-ignorert) med `R2_SECRET_ACCESS_KEY`. Leses kun av `scripts/sort-feed.mjs`. Skriptet har også valgfrie overstyringer med innebygde standardverdier: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_PUBLIC_URL`.
- Påmeldingsskjemaets endepunkt (`GAS_URL`) er **hardkodet** i `src/pages/fjellmaraton.astro`, ikke en miljøvariabel.

**Preview-branches**: finnes ikke. Kun `main` bygger og publiserer. Vil du se noe før det går live, må du kjøre `npm run dev` lokalt.

---

## 10. KONVENSJONER

- **Filnavn i `src/content/`**: små bokstaver, bindestrek mellom ord, æ/ø/å beholdes. Eksempler: `løpehelg-med-graham.yml`, `5-år-med-smilebu-t-o-ur.yml`, `sætretindane.yml`.
- **Slug = filnavn uten `.yml`.** URL-en blir `/prosjekter/<filnavn>` eller `/prints/<filnavn>`. **Endrer du filnavnet, endres URL-en og gamle lenker dør.**
- CMS-en lager filnavnet automatisk fra tittelen når du oppretter noe nytt.
- **Årstall**: alltid streng i enkeltfnutter, `year: '2024'`. Uten fnutter tolkes det som tall og valideringen brekker.
- **Bilde-URL-er**: alltid full absolutt R2-URL.
- **Språk**: siden er norsk (`<html lang="no">`). All synlig tekst og alle `aria-label`-er er norske. Unntakene er skjemaets feltnavn på fjellmaraton («First Name», «Email») og print-sidene, som med vilje har norsk og engelsk tekst under hverandre. Ingen flerspråklig oppsett.
- **Commit-meldinger**: én linje, engelsk, imperativ («Add a CMS field for…»). CMS-genererte commits heter `Create Projects "x"` / `Update Projects "x"`.
- **CSS**: skrives i `<style>` nederst i hver `.astro`-fil. `is:global` brukes bare der JS bygger elementer dynamisk (forside, feed).
- **Kommentarer i koden er lange og forklarer hvorfor.** Behold dem — de dokumenterer feil som allerede er rettet.

---

## 11. IKKE RØR

| Fil / innstilling | Hvorfor |
|---|---|
| `public/CNAME` | Slettes den, mister siden domenet `gauteaalokken.com`. |
| Gruppa `User-agent: *` nederst i `public/robots.txt` | Den skal ha `Allow: /`. Settes den til `Disallow: /`, forsvinner hele siden fra Google og Bing. Kun de navngitte KI-crawlerne over skal blokkeres. |
| `public/admin/config.yml` → `backend.repo: gauteaalokken/foto` og `branch: main` | Feil verdi = CMS-en kan ikke lagre noe som helst. |
| R2-verdiene i `public/admin/config.yml` (bucket, account_id, public_url, access_key_id) | Endres de, mister CMS-en opplastingen og alle eksisterende bilde-URL-er slutter å stemme. |
| `prefix:`-verdiene i `public/admin/config.yml` | Bestemmer hvilken mappe i R2 nye bilder havner i. Endres de, blir bildene spredt og gamle URL-er brytes ikke, men nye blir inkonsistente. |
| Versjonsnummeret `@sveltia/cms@0.178.0` i `public/admin/index.html` | Pinnet med vilje. Fjernes versjonen, kan en oppdatering hos leverandøren ta ned CMS-en uten forvarsel. |
| `src/content.config.ts` | Skjemaene her validerer alle YAML-filer. Legger du til et påkrevd felt, feiler bygget på alle eksisterende filer som mangler det. `.nullable()` er der fordi CMS-en skriver `null`, ikke tomt. |
| `astro.config.mjs` — `image.remotePatterns` | Slipper R2-verten gjennom Astros bildehåndtering. Ingen sider bruker den lenger (alt går via `lib/`), men fjernes den, brekker enhver fremtidig bruk av Astros egne bildekomponenter mot R2. |
| `astro.config.mjs` — `flush-staged-images`-integrasjonen | Uten den havner ingen skalerte bilder i `dist/optimized/`, og alle bilder på forside/feed/prosjekter/fjellmaraton blir døde. |
| `astro.config.mjs` — `setGlobalDispatcher(new Agent({...}))` | Uten timeouts kan én treg R2-forbindelse henge byggejobben i det uendelige. |
| `astro.config.mjs` — `site: 'https://gauteaalokken.com'` | Styrer canonical-URL og delingslenker. |
| `src/lib/resolveImage.ts`, `imageOutputQueue.ts`, `fetchBuffer.ts`, `concurrency.ts` | Bildepipelinen. Endres hash-formelen eller mellomlagerstien, må alle 1893 bilder lastes ned og skaleres på nytt. |
| URL-kodingen i `src/lib/fetchBuffer.ts` (`normalizeUrl`) | Filnavn med mellomrom (f.eks. «FFM 26 4_1.jpg») får en ukodet space i URL-en fra CMS-en. Uten denne funksjonen henger `fetch()` til timeouten slår inn — på hvert forsøk — i stedet for å feile raskt. |
| `showInNav`-logikken i `src/components/Header.astro` | Styrer om Blogg og Portefølje er lenket fra menyen. Sidene finnes uansett — fjernes logikken, blir de enten alltid synlige eller umulige å nå fra menyen. |
| Filnavn i `src/content/projects/` og `src/content/prints/` | Filnavnet **er** URL-en. |
| `GAS_URL` i `src/pages/fjellmaraton.astro` | Adressen til Google Apps Script som tar imot påmeldinger. Feil verdi = påmeldinger forsvinner uten at noen merker det. |
| Feltet `name="website"` (honeypot) i påmeldingsskjemaet, og `.honeypot`-CSS-en | Spamfelle. Gjøres det synlig, fyller ekte folk det ut og påmeldingen deres kastes stille. |
| Sammenslåingen av `image_gallery` i bloggen | Grid/masonry/feed/carousel var fire separate blokktyper. De ble slått sammen til én med en `layout`-velger nettopp fordi det å bytte stil ellers krevde å slette blokken og legge inn alle bildene på nytt. Ikke del dem opp igjen. |
| `.env.local` | Inneholder R2-hemmeligheten. Er git-ignorert. Skal aldri limes inn i en chat eller committes. |
| `package-lock.json` | Genereres av npm. Redigeres aldri manuelt. |
| `dist/`, `.astro/`, `node_modules/` | Genereres. Endringer der overskrives ved neste bygg. |
| `.github/workflows/deploy.yml` — cache-stegene | Uten dem tar hvert bygg mange minutter fordi alle bilder hentes og skaleres på nytt. |

---

## 12. VANLIGE ENDRINGER

1. **Legge til et prosjekt** → gjør det i CMS-en på `/admin`, ikke i kode. Den lager `src/content/projects/<slug>.yml` med `title`, `year`, `order`, `cover`, `pages` og committer selv. Skal det gjøres i kode: kopier strukturen fra en eksisterende fil nøyaktig, inkludert fnuttene rundt årstallet.

2. **Endre rekkefølgen på forsiden** → sett `order` i prosjektfilen (via CMS-feltet «Order»). Lavest tall først; alle med tall kommer foran alle uten. Ikke rør sorteringskoden i `src/pages/index.astro`.

2b. **Bytte selve forsidelayouten** → CMS → «Forside-innstillinger» → «Type forside». Fire valg, beskrevet i punkt 4. Dette er en innholdsendring, ikke en kodeendring — ikke skriv om `index.astro` for å bytte utseende.

3. **Bytte omslagsbilde på et prosjekt** → sett `cover`-feltet i CMS-en. Ikke flytt om på `pages`-listen for å oppnå det.

4. **Endre menyen** → `src/components/Header.astro`, listen `navLinks` (linje 5–10). Hvert element er `{ label, href }`. Legg til/fjern/endre rekkefølge der. Ikke skriv `<a>`-taggene manuelt i HTML-en under.

5. **Bytte en farge** → se punkt 6. Finn verdien i den aktuelle `<style>`-blokken. Gjelder endringen hele siden (f.eks. sidebakgrunn), start i `src/layouts/Layout.astro`. Be alltid om en liste over hvilke filer som ble endret.

6. **Legge til en ny side** → ny fil i `src/pages/`, f.eks. `src/pages/om.astro` → blir `/om`. Start med `import Layout from '../layouts/Layout.astro';`, pakk innholdet i `<Layout title="… — Gaute Aaløkken" description="…">`, og legg CSS-en i en `<style>`-blokk nederst i samme fil. Legg lenken inn i `navLinks` i Header hvis den skal i menyen.

7. **Endre SEO-tittel eller delingstekst** → for én side: `title`- og `description`-propene der `<Layout ...>` brukes i den sidens fil. For hele siden / forsiden: `DEFAULT_DESCRIPTION` og `DEFAULT_OG_IMAGE` øverst i `src/layouts/Layout.astro` (linje 10–17), samt default-verdien `'Gaute Aaløkken'` for `title`.

8. **Endre priser eller teksten på print-sidene** → `src/pages/prints/[slug].astro`, linje ~49–95. Teksten er hardkodet og felles for alle prints — det finnes ingen prisfelt i innholdsmodellen. Både den norske og den engelske blokken må oppdateres.

9. **Endre teksten på fjellmaraton-siden** → overskriftene «Flaksjøen Fjellmaraton» / «Påmelding 26» og knappen «Meld deg på» ligger i `.intro`-blokken i `src/pages/fjellmaraton.astro`. Skjemafeltene ligger i `#signup-modal` lenger nede. **Legger du til et nytt felt i skjemaet, må kolonnen også legges til i `scripts/google-apps-script-paamelding.gs`, og skriptet må redeployes i Google Apps Script** — ellers havner svaret ingen steder.

10. **Legge til / bytte bilder på fjellmaraton-banneret** → CMS-feltet «Bilder over skjemaet». Husk at **første bilde blir banneret i midten**, og at det er det eneste som vises på mobil.

11. **Legge til et nytt felt i en collection** → må gjøres to steder samtidig: skjema i `public/admin/config.yml` og validering i `src/content.config.ts`. Gjør nye felter valgfrie med `.nullable().optional()` — CMS-en skriver `null` og ikke tomt når feltet står tomt.

12. **Skrive et blogginnlegg** → CMS → **Blog** → **New Blog**. Fyll ut Title og Date, og bygg innlegget av blokker under «Content blocks». Rekkefølgen på blokkene er rekkefølgen på siden. Skal stilen på et bildegalleri endres senere, bytt **Layout**-nedtrekkslisten i blokken — ikke slett og legg inn bildene på nytt.

13. **Vise eller skjule Blogg / Portefølje i menyen** → CMS → **Blog settings** eller **Portfolio (for clients)** → slå «Show in navigation bar» av eller på. Sidene finnes på `/blogg` og `/portefolje` uansett, så du kan sende lenken til noen uten å legge den i menyen.

14. **Endre hvordan blogglisten ser ut** → CMS → **Blog settings** → **Listing layout**: `grid` (kort i kolonner), `stacked` (én per rad) eller `featured` (ett stort innlegg om gangen, med bla-knapper).

15. **Sortere feed-en på nytt** → `npm run sort-feed` er ikke rett kommando alene; kjør `node scripts/sort-feed.mjs date feed` eller `node scripts/sort-feed.mjs color feed` lokalt. Krever `.env.local`. Den **overskriver hele** `src/content/feed/index.yml` med alt som ligger i R2-bøtta.

---

## 13. KJENTE FALLGRUVER

- **Et bilde som er slettet i R2, men står igjen i en YAML-fil, får bygget til å feile.** Fjern URL-en fra innholdet først, deretter filen i R2. Feilmeldingen sier nå hvilken URL som mangler og hva som må gjøres — `fetchBuffer.ts` sjekker svarkoden i stedet for å sende R2s 404-side videre til sharp, som ga «Input buffer has corrupt header: glib: XML parse error» uten å nevne noe filnavn.
- **`sort-feed.mjs` lister hele bøtta**, ikke bare `feed/`-mappa. Kjører du den, kan prosjekt- og print-bilder havne i feed-lista. Se gjennom endringen før du committer.
- **CMS-en skriver `null`, ikke tomme nøkler.** Derfor er `order` og `cover` `.nullable()` i schemaet. Fjerner du `.nullable()`, brekker 13 eksisterende prosjektfiler. `order: null` ble tidligere tolket som 0 og kastet alle prosjekter uten rekkefølge helt øverst — det er fikset, ikke gjeninnfør det.
- **`year` uten fnutter** tolkes som tall og feiler valideringen.
- **Bytter du filnavn i `content/`, bytter du URL.** Ingen redirects finnes.
- **Bildehøyde settes bevisst ikke** i `resolveImage.ts` og på print-sidene. Astros `inferSize` + `width` rapporterer feil høyde, og bildene ble klemt sammen. Ikke legg til `height`.
- **Rutenettene måles med `getBoundingClientRect()` og `Math.floor()`, ikke `clientWidth`.** `clientWidth` runder opp (1169,59 px rapporteres som 1170), og da dyttet flex-wrap siste bilde i hver rad ned på egen linje. Dette rammet bare enkelte vindusbredder, så det så tilfeldig ut. Ikke bytt tilbake.
- **Layout-koden må kjøre på nytt ved bredde­endring, etter `load`, etter at fonter er klare, og etter at hvert bilde er lastet.** Fjernes én av disse, blir radene ujevne til neste reload.
- **Feed-en har både IntersectionObserver og en `setInterval`-poll** for etterlasting. Pollingen ser overflødig ut, men den er der fordi feeden i praksis satte seg fast uten at årsaken lot seg reprodusere. Ikke fjern den.
- **Skjemaet sender med `Content-Type: text/plain`** med vilje, for å unngå en CORS-preflight som Apps Script ikke kan svare på. `mode: 'no-cors'` ville skjult feil og meldt suksess selv når påmeldingen forsvant.
- **Endrer du Apps Script-koden, må du lage en ny deployment**; eksisterende URL peker på den gamle versjonen til du redeployer.
- **Første bygg etter at cachen er borte tar lang tid** (over tusen bilder skal hentes og skaleres). Det er normalt.
- **Tomme ruter på forsiden trekkes tilfeldig på nytt ved hver sidevisning.** De er ikke et innholdsfelt, og de skal ikke være stabile.
- **Lightboxen viser miniatyrbildet først og bytter til originalen fra R2 når den er lastet.** Er originalen 15 MB, tar det fortsatt 15 MB før den skarpe versjonen er på plass — men skjermen er ikke tom mens man venter. Bredden er låst til originalens størrelse, så byttet flytter ingenting. Fjerner du miniatyr-trinnet, er du tilbake til svart skjerm.
- **Filnavn med mellomrom var en reell feilkilde.** CMS-en lagrer dem med en ukodet space i URL-en, og `fetch()` hang da til timeouten slo inn på hvert av tre forsøk i stedet for å feile raskt. Løst i `fetchBuffer.ts` med `encodeURI(decodeURI(...))`. Unngå likevel mellomrom i nye filnavn.
- **Bloggens `date` skrives uten fnutter** av CMS-ens datovelger, så YAML tolker den som en ekte dato og ikke en tekst. Derfor `z.coerce.date()` i schemaet. Dette er motsatt av `year` på prosjekter, som skal ha fnutter — ikke gjør dem like.
- **Blogg og Portefølje er bygget og publisert selv når `showInNav` er av.** De er skjult fra menyen, ikke fra internett. Ikke legg noe der som ikke tåler å bli funnet.
- **De to robots.txt-filene må holdes i takt.** `public/robots.txt` dekker gauteaalokken.com — inkludert de nedskalerte bildene under `/optimized/`, altså de som faktisk vises. `scripts/robots.txt` dekker originalene på `pub-...r2.dev`, men **kun hvis den er lastet opp manuelt til roten av R2-bøtta**. Ligger den bare i repoet, gjør den ingenting. Endres den ene, endre den andre.
- **`sizes` styrer hvilken bildefil som lastes ned.** Se punkt 5. Setter du «100vw» på et bilde som i praksis vises smalt, henter nettleseren den største fila i `srcset` uten grunn.

---

## 14. SLIK BRUKES DENNE FILEN

Til KI-modellen som leser dette:

1. **Gi alltid tilbake hele den ferdige fila.** Ikke diff, ikke «erstatt linje 42», ikke utdrag med `...`. Brukeren limer inn hele filen i en teksteditor og lagrer over.
2. **Si tydelig hvilken filsti** den ferdige fila skal lagres til, øverst i svaret.
3. **Ikke foreslå nye avhengigheter, nye verktøy eller versjonsoppgraderinger.** Alt skal løses med det som allerede finnes i punkt 2.
4. **Hold deg til eksisterende mønstre.** CSS i `<style>` i samme fil, farger som literaler slik resten av kodebasen gjør det, ingen ny mappestruktur, ingen omskriving til rammeverk eller komponentbibliotek.
5. **Ikke rør noe i punkt 11** uten at brukeren eksplisitt ber om det og du har forklart konsekvensen.
6. **Spør heller enn å gjette.** Mangler du en filsti, et feltnavn eller innholdet i en fil — be om å få den limt inn. Ikke finn på filnavn, versjoner eller CSS-klasser.
7. **Behold kommentarene i koden.** De forklarer feil som allerede er rettet, og fjerner du dem kommer feilene tilbake.
8. Brukeren har ikke kodebakgrunn. Forklar hva en endring gjør og hvor den lagres, uten sjargong.
9. **Les punkt 7 før du skriver `.astro`-kode.** Astro ligner på React, men er det ikke, og de vanligste feilene kommer av å behandle det som React.
10. **Foreslå aldri å kjøre tester** — det finnes ingen. `npm run build` er eneste kontroll.
11. Skal brukeren gjøre noe praktisk (laste opp bilder, angre en endring, sjekke om bygget gikk bra), står oppskriften i `VEDLIKEHOLD.md` i samme repo. Henvis dit heller enn å finne på egne steg.

---

## 15. ÅPNE PUNKTER — fylles inn manuelt

Følgende lot seg ikke lese ut av repoet og er ikke dokumentert her. **Spørsmålene står som utfyllingsliste i `VEDLIKEHOLD.md` punkt 17** — er de besvart der, er det den lista som gjelder, ikke denne. Er de fortsatt tomme: spør brukeren i stedet for å gjette.

- **GitHub Pages-innstillinger** (kilde satt til «GitHub Actions», custom domain, «Enforce HTTPS») — ligger i GitHub-grensesnittet, ikke i repoet.
- **DNS-oppsettet for `gauteaalokken.com`** — hvilken registrar, og hvilke A-/CNAME-poster som peker på GitHub Pages.
- **Cloudflare R2-detaljer**: om bøtta har en custom domain i tillegg til `r2.dev`-URL-en, hvilke tillatelser API-nøkkelen har, og om det er satt opp levetidsregler.
- **Google Apps Script**: hvilket Google Sheet påmeldingene skrives til, hvem som eier det, og når det sist ble redeployet.
- **Om `wrangler` faktisk brukes til noe**, eller bare ble installert underveis. Ingen `wrangler.toml` finnes, og den kjøres ikke fra noe skript.
- **Fotoverktøy-sidene** (`public/fotoverktoy/*.html`, ca. 3900 linjer HTML/JS til sammen) er ikke gjennomgått her. De er frittstående og påvirker ikke resten av siden.
- **Hvorfor fire prosjekter mangler `cover`-nøkkelen helt** — sannsynligvis bare at de ble opprettet før feltet ble lagt til 2026-08-02.
- **Om det finnes analytics, søkeordsverktøy eller andre eksterne tjenester** koblet til siden.
- **Hva `/portefolje` skal inneholde** — sida finnes og virker, men bildelista er tom.
- **Om blogginnlegget `2026-08-07-test` skal bli stående** eller er en test som skal slettes. Det inneholder Lorem Ipsum-tekst og ligger publisert på `/blogg/2026-08-07-test`. Det meldes ikke lenger inn i sitemapen (siden `/blogg` er skjult fra menyen), men er fortsatt å finne for den som har lenka.
