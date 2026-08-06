# foto

Kildekoden til **[gauteaalokken.com](https://gauteaalokken.com)** — fotoportefølje bygget med Astro,
publisert med GitHub Pages, med bilder i Cloudflare R2 og redigering via Sveltia CMS på `/admin`.

## Dokumentasjon

| Fil | Til hvem | Innhold |
|---|---|---|
| **[VEDLIKEHOLD.md](VEDLIKEHOLD.md)** | Deg | Praktisk steg-for-steg: legge til prosjekt, laste opp bilder, angre en endring, feilsøking. |
| **[KONTEKST-FOR-KI.md](KONTEKST-FOR-KI.md)** | KI-modeller | Full teknisk referanse. Lim inn hele fila øverst i en chat før du ber om hjelp med koden. |

## Kommandoer

```bash
npm install     # engangsoppsett
npm run dev     # lokal server på http://localhost:4321
npm run build   # bygger til dist/ — eneste kontroll som finnes, det er ingen tester
```

Push til `main` bygger og publiserer automatisk. Status: [Actions](https://github.com/gauteaalokken/foto/actions).
