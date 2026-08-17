# Påmeldingsskjemaet — hvordan du oppdaterer det

Påmeldingsskjemaet på Flaksjøen-siden sender svarene til et Google Apps
Script, som skriver dem inn i regnearket og sender deg en e-post.

Koden som kjører der ligger som referanse i
[`google-apps-script-paamelding.gs`](google-apps-script-paamelding.gs) i denne
mappa.

---

## Det viktigste å forstå

Nettsiden sender påmeldingene til **én bestemt nettadresse**. Den adressen står
i `src/pages/fjellmaraton.astro` og er akkurat nå:

```
https://script.google.com/macros/s/AKfycby-Hz4Rdv6K1AF7QXBVKmxn-AtJfBPTvCwkHFoOEX7PqfSaXOqs5m9cA7iQaklz8oMJ/exec
```

Denne adressen hører til **én** distribusjon i Apps Script. Lager du en ny
distribusjon, får den en **ny adresse** — og nettsiden vet ingenting om den.
Da fortsetter påmeldingene å gå til den gamle, som kjører gammel kode.

Det var nettopp dette som gikk galt sist.

---

## Slik oppdaterer du skriptet — alltid slik

Når du har endret koden i Apps Script og vil at endringen skal gjelde:

1. Trykk **Implementer** (øverst til høyre)
2. Velg **Administrer distribusjoner**
3. Trykk **blyantikonet** (rediger) på distribusjonen som allerede finnes
4. Under **Versjon**, velg **«Ny versjon»**
5. Trykk **Implementer**

Adressen forblir den samme. Nettsiden fortsetter å virke.

> **Lagre er ikke nok.** Trykker du bare lagre i editoren, kjører nettsiden
> fortsatt den gamle versjonen. Du må gjennom stegene over.

---

## Bruk ALDRI «Ny distribusjon»

I samme meny finnes **«Ny distribusjon»**. Den skal du ikke bruke her.

Den lager en helt ny nettadresse. Skjemaet på nettsiden peker fortsatt på den
gamle, så alt ser ut til å virke — men koden som kjører er den gamle. Det er
vanskelig å oppdage, fordi skjemaet ikke gir noen feilmelding.

Har du allerede laget flere distribusjoner, er det ikke farlig. Bare husk at
det er adressen over som gjelder, og at det er **den** du oppdaterer med
«Ny versjon».

---

## Sjekk at det faktisk virket

Etter at du har implementert en ny versjon:

1. Meld deg på via skjemaet på nettsiden med testdata
2. Gå til Apps Script og trykk **Kjøringer** i menyen til venstre
3. Se på kolonnen **Implementering** på radene som heter **Nettapp**

Der skal det stå **det nyeste versjonsnummeret**. Står det et lavere tall,
gikk påmeldingen til en gammel distribusjon, og du må gjøre stegene over på
nytt — eller du oppdaterte feil distribusjon.

Sjekk også at raden kom i regnearket, og at du fikk e-posten.

---

## Husk å kopiere endringen tilbake hit

Endrer du koden inne i Google, finnes den bare der. Kopier den da inn i
[`google-apps-script-paamelding.gs`](google-apps-script-paamelding.gs), slik at
fila i repoet alltid viser det som faktisk kjører.

Gjør du ikke det, vet ingen — heller ikke du om et halvt år — hva som egentlig
ligger i Google.

---

## Hvis noe ikke virker

**Ingen e-post kommer.** Første gang skriptet sender e-post må du gi Google
tillatelse til det. Åpne Apps Script, velg funksjonen `notify` og trykk
**Kjør** én gang, så kommer spørsmålet om tillatelse. E-postvarslingen er
lagd slik at den aldri kan velte selve påmeldingen — feiler den, blir raden
lagret uansett, og feilen havner i **Kjøringer**.

**Skjemaet sier «Noe gikk galt».** Da kom påmeldingen *ikke* inn. Se i
**Kjøringer** etter en rad som er markert med feil.

**Påmeldingen kommer i regnearket, men uten e-post.** Da virker skriptet, men
e-posttillatelsen mangler. Se over.
