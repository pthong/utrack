# u-track

Lokale Nederlandstalige Electron-app voor onderwerpen, categorieën en Markdown-notities. Een persoon is een onderwerp. Onderwerpen kunnen in meerdere categorieën staan. De interface is minimalistisch, met muisbediening, sneltoetsen en een U-icoon.

Documentatie bijgewerkt op 25 oktober 2026 voor versie 1.0.0. De gebruikershandleiding staat naast de broncodemap in [Handleiding.md](../Handleiding.md).

## Huidige functies

- Bibliotheek met **Onderwerpen**, **Notities** en **Categorieën**.
- Onderwerpen en categorieën hebben een naam, zonder type of omschrijving.
- Categorie aanmaken met meerdere bestaande of nieuwe onderwerpen; suggesties en plakken van meerdere namen.
- Onderwerpen zoeken, aan categorieën koppelen en uit een categorie verwijderen zonder hun notities te wissen.
- Categorievolgorde wijzigen met slepen of Alt ↑/↓; categorie verwijderen met behoud van onderwerpen en notities.
- Onderwerp- en categorienotities met titel, datum, Markdown-inhoud en optionele punten.
- Gezamenlijk notities schrijven voor alle onderwerpen in een categorie, met zoekfilter en inline toevoegen van onderwerpen.
- Lege batchnotities worden opgeslagen met `-`. Zoeken in het batchformulier sluit verborgen velden niet uit van opslaan.
- Batchnotities worden geclusterd getoond en kunnen gezamenlijk worden bijgewerkt; de bestanden blijven per notitie opgeslagen.
- Nieuwste notities eerst, doorzoekbare notities en opdrachten, en een zoekbare bestemmingkiezer voor nieuwe notities.
- Instellingen voor de opslagmap, licht/donker/eigen thema, acht kleurrollen en aanpasbare standaardteksten.

Het tabblad Notities binnen een categorie toont de categorienotities en alle notities van onderwerpen die momenteel aan die categorie gekoppeld zijn. De details van een onderwerp tonen zijn afzonderlijke notities. Notitie-iconen met een ruit of cirkel onderscheiden onderwerp- en categorienotities.

## Installatie

Het actuele pakket is `../u-track_1.0.0_amd64.deb`, voor Ubuntu/Debian op Linux x64. Open het met de pakketbeheerder of voer vanuit de map met het pakket uit:

```sh
sudo apt install ./u-track_1.0.0_amd64.deb
```

Het pakket bevat Electron; gebruikers hebben geen Node.js of npm nodig. Het installeert onder `/opt/u-track`, met een desktopstarter, U-icoon en Chromium-sandboxhelper. Het bouwscript geeft die helper modus `4755`. De app draait als gewone gebruiker.

De pakketinhoud, het icoon en de sandboxrechten zijn gecontroleerd en de uitgepakte app is met tijdelijke gegevens gestart. De startcontrole gebruikte `--no-sandbox` vanwege de testomgeving; de normale desktopstarter bevat die optie niet. Er is geen Windows- of macOS-installatiepakket en er is geen systeeminstallatie uitgevoerd als onderdeel van deze controle.

## Ontwikkelen

Werk vanuit deze map, `Documents/trackers/code`. Gebruik een recente Node.js-versie met npm. `package.json` specificeert Electron 45.0.0; `package-lock.json` legt de npm-afhankelijkheden vast.

```sh
npm ci
npm start
```

Gebruik `npm install` wanneer je bewust afhankelijkheden toevoegt of wijzigt. Na broncodewijzigingen herstart je de ontwikkelapp. De geïnstalleerde app gebruikt haar eigen verpakte broncode en verandert hierdoor niet.

| Script | Functie |
|---|---|
| `npm start` | Electron starten vanuit de broncode |
| `npm test` | Node-opslag- en voorkeurentests uitvoeren |
| `npm run pack` | Ubuntu/Debian-installatiepakket bouwen in `release/` |

Bouwen vereist Linux x64, geïnstalleerde Electron-afhankelijkheden en `dpkg-deb`. Een uitvoermap meegeven kan zo:

```sh
npm run pack -- ..
```

Dit schrijft `u-track_1.0.0_amd64.deb` naast de map `code`. Bij dezelfde pakketversie wordt het bestaande bestand in de gekozen uitvoermap vervangen. Bouwen installeert het pakket niet.

### Tijdelijke testgegevens

De ontwikkelapp gebruikt standaard dezelfde ingestelde gegevensmap als de geïnstalleerde app. Gebruik daarom voor geïsoleerde controles een tijdelijke map:

```sh
UTRACK_TEST_ROOT="$(mktemp -d)" npm start -- --test-data
```

In deze modus staan voorkeuren onder `app-settings` binnen de testmap. Een daar eerder opgeslagen mapvoorkeur blijft bij het hergebruiken van dezelfde testmap geldig. De vlag `--smoke-test` gebruikt eveneens `UTRACK_TEST_ROOT`, controleert het laden van de interface, bewaart een schermafbeelding in de testmap en sluit af.

In een beperkte testomgeving kan de Node-suite zonder procesisolatie worden gestart met:

```sh
node --test --test-isolation=none test/*.test.js
```

## Gegevensopslag

Standaard is de gegevensmap `u-track` in de Documenten-map van het besturingssysteem. **Instellingen** (Ctrl ,) toont de actieve map en bevat de mapkiezer. **Gegevensmap** (Ctrl Shift O) opent de map in de bestandsbeheerder. Een mapwissel wordt direct onthouden en verplaatst of combineert geen bestaande bestanden.

```text
u-track/
├── onderwerpen.csv
├── categorieen.csv
├── onderwerpen/
│   └── 26-10-25--camera--<onderwerp-uid>/
│       └── notities/
│           └── 26-10-25--controle--<notitie-uid>.md
└── categorieen/
    └── 26-10-25--werkplaats--<categorie-uid>/
        ├── onderwerpen.csv
        └── notities/
            └── 26-10-25--werkafspraken--<notitie-uid>.md
```

Mapnamen volgen `yy-mm-dd--naam--uid`, met aanmaakdatum, een naam in kleine letters met koppeltekens en een vaste UUID. Hernoemen verandert de naam, maar behoudt datum en ID. Notitiebestanden volgen `yy-mm-dd--naam--uid.md`, waarbij de datum de gekozen notitiedatum is en de naam de titel. Een wijziging van datum of titel hernoemt het bestand zonder het notitie-ID te wijzigen.

### CSV-schema

| Bestand | Kolommen |
|---|---|
| Centrale `onderwerpen.csv` | `id,name,createdAt,groupIds` |
| Centrale `categorieen.csv` | `id,name,createdAt,deletedAt` |
| `onderwerpen.csv` in iedere categorie | `id,name,createdAt,groupIds` |

`groupIds` is een JSON-lijst met categorie-IDs in één cel. CSV gebruikt UTF-8 met BOM, komma's en gequote velden. `type` en `description` worden niet aangemaakt; oude kolommen worden bij het openen van de opslag uit de centrale CSV-bestanden verwijderd.

De CSV-bestanden per categorie zijn afgeleide projecties van de centrale onderwerpenlijst en worden bij opslaan, starten en vernieuwen opnieuw opgebouwd. De volgorde in `categorieen.csv` bepaalt de categorievolgorde. Verwijderen van een categorie vult `deletedAt`, verwijdert de koppelingen en behoudt de notities. Er is geen functie voor het volledig verwijderen van een onderwerp.

### Markdown en punten

Een gewone notitie ziet er bijvoorbeeld zo uit:

```markdown
---
date: 2026-10-25
points: 2
---

# Controle

Lens gecontroleerd.
```

De volledige datum staat in de metadata om de eeuw ondubbelzinnig te bewaren. `points` ontbreekt als geen score is opgegeven. Nul, decimalen en negatieve getallen zijn geldig. De inhoud blijft gewone Markdown; het individuele voorbeeld ondersteunt koppen, vet en inline code en voert geen HTML uit.

### Batchnotities en clusters

Bij **Notities voor alle onderwerpen** krijgt iedere notitie een eigen bestand en UUID. De frontmatter krijgt extra herkomstgegevens:

```yaml
created_via: notities-voor-alle-onderwerpen
category_id: 82755a2b-763c-4ab7-9a1e-28507b23e566
category_name: "Werkplaats"
batch_id: 0bc93c76-a613-4f14-a5be-0154e44bd921
```

`category_name` is de naam op het moment van aanmaken. Herkomst en cluster-ID blijven bij individueel bewerken behouden. De notitielijst groepeert op categorie en batch-ID. Een cluster opent alle bijbehorende onderwerpen met bestaande tekst en punten, ook wanneer slechts één notitie op de zoekopdracht overeenkwam. Gezamenlijk opslaan wijzigt de bestaande bestanden.

Nieuwe reeksen met dezelfde datum en titel hebben verschillende batch-IDs. Eerdere batchnotities zonder batch-ID worden gegroepeerd op categorie, datum en titel; bij gezamenlijk opslaan krijgen ze een batch-ID. Notities zonder batchherkomst worden niet achteraf als batch aangemerkt.

Eerdere categoriegebonden onderwerpnotities worden nog gelezen uit `categorieen/<categoriemap>/onderwerpen/<onderwerpmap>/notities/`. Nieuwe onderwerpnotities en batchnotities staan in de centrale onderwerpmap.

### Voorkeuren en back-ups

`voorkeuren.json` staat in de gebruikersconfiguratiemap van u-track, op Linux doorgaans `~/.config/u-track/`. Het bevat de gekozen gegevensmap, het thema, de eigen kleuren en aangepaste standaardteksten. Deze instellingen staan buiten de bibliotheek.

Een eigen thema bevat kleuren voor achtergrond, panelen/velden, tekst, secundaire tekst, randen, accent, selectie/markering en fouten/verwijderen. Thema en kleuren hebben een live voorbeeld; annuleren herstelt het opgeslagen thema. Tekstwijzigingen worden bij opslaan toegepast en wijzigen geen gebruikersinhoud.

Maak back-ups van de volledige gegevensmap terwijl de app gesloten is; kopieer de voorkeuren apart als die ook bewaard moeten blijven. Externe wijzigingen kunnen met Ctrl R opnieuw worden gelezen. Bewerk de centrale CSV-bestanden, behoud IDs en kolomnamen en bewerk hetzelfde bestand niet tegelijk vanuit de app. Er is geen automatische back-up, cloudsynchronisatie of ondersteuning voor gelijktijdige schrijvers. De opslag is nog in ontwikkeling; er is geen algemene migratiegarantie voor oude ontwikkelgegevens.

## Bediening en sneltoetsen

| Actie | Sneltoets |
|---|---|
| Opdrachten zoeken | Ctrl K |
| Zoeken in huidige weergave | Ctrl F |
| Onderwerpen / Notities / Categorieën | Alt 1 / Alt 2 / Alt 3 |
| Onderwerp toevoegen | Ctrl N |
| Categorie toevoegen | Ctrl Shift G |
| Notitie schrijven | Ctrl Shift N |
| Notities voor alle onderwerpen | Ctrl Alt N |
| Geselecteerd onderwerp of categorie bewerken | Ctrl E |
| Categorieën van onderwerp wijzigen | Ctrl Shift M |
| Onderwerp uit categorie verwijderen | Ctrl Shift Delete |
| Categorie verwijderen | Ctrl Alt Delete |
| Categorie met focus verplaatsen | Alt ↑ / Alt ↓ |
| Formulier opslaan / volgende stap | Ctrl Enter |
| Individueel Markdown-voorbeeld | Ctrl P |
| Instellingen | Ctrl , |
| Vernieuwen | Ctrl R |
| Gegevensmap tonen / andere map kiezen | Ctrl Shift O / Ctrl Shift D |
| Sneltoetsen | F1 |
| Bediening doorlopen | Tab / Shift Tab |
| Resultaten/opdrachten doorlopen en openen | ↑ / ↓ en Enter |
| Sluiten, zoekopdracht wissen of selectie opheffen | Esc |

In het batchformulier gebruikt Ctrl F het onderwerpfilter en Ctrl N de inline invoer voor onderwerpen. Toetsen zijn ook zichtbaar bij de bedieningselementen. De Ctrl-bediening accepteert doorgaans ook Cmd op macOS; daarvoor is geen installatiepakket getest.

## Broncode

De app gebruikt JavaScript en CSS zonder UI-framework.

| Bestand | Verantwoordelijkheid |
|---|---|
| `src/main.js` | Electron-venster, protocol, IPC, mapkiezer en desktopfuncties |
| `src/preload.js` | Beperkte API tussen interface en hoofdproces |
| `src/storage.js` | CSV, Markdown, IDs, mapnamen, herkomst en projecties |
| `src/app.js` | Bibliotheek, zoeken, formulieren, clusters en sneltoetsen |
| `src/preferences.js` | Voorkeuren lezen, valideren en schrijven |
| `src/settings.js` | Instellingenscherm, thema's en aangepaste teksten |
| `src/text-defaults.js` | Catalogus van aanpasbare standaardteksten |
| `src/index.html`, `src/style.css` | Structuur en vormgeving |
| `src/icon.svg`, `src/icon.png` | U-icoon voor installatiepakket en venster |
| `scripts/build-linux.js` | Debian-pakket bouwen |
| `test/*.test.js` | Opslag- en voorkeurentests |

De interface draait met contextisolatie en zonder Node-integratie. Externe navigatie en nieuwe vensters zijn geblokkeerd. IPC controleert de afzender; gebruikersinhoud wordt voor HTML-weergave ge-escaped. Opslagbestanden worden via tijdelijke bestanden vervangen, maar het opslaan van meerdere batchnotities is geen gezamenlijke transactie: bij een fout kan een deel al opgeslagen zijn. Het formulier meldt dit en kan opnieuw worden opgeslagen.

## Licentie

Voor de eigen applicatiecode is momenteel geen licentie gekozen: `package.json` bevat geen `license`-veld en er staat geen applicatiebestand `LICENSE` in deze broncodemap. Het bouwscript neemt dat bestand mee als het later wordt toegevoegd. Licenties van Electron en andere afhankelijkheden blijven afzonderlijk van toepassing en worden niet door deze keuze vervangen.
