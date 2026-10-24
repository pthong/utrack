# Handleiding u-track

Bijgewerkt op 25 oktober 2026, voor de huidige versie 1.0.0.

u-track houdt onderwerpen, categorieën en notities lokaal bij. Een persoon is ook een onderwerp. Een onderwerp kan bij meerdere categorieën horen en heeft alleen een naam; type en omschrijving zijn niet nodig. Je kunt de app met de muis en met sneltoetsen bedienen.

## Installeren en starten

Open `u-track_1.0.0_amd64.deb` in je pakketinstallatieprogramma en kies Installeren. Start daarna **u-track** vanuit het applicatiemenu. Dit pakket is voor Ubuntu/Debian op een 64-bits Intel/AMD-computer. Node.js en npm zijn voor de geïnstalleerde app niet nodig.

Installeren via een terminal kan vanuit de map met het pakket:

```sh
sudo apt install ./u-track_1.0.0_amd64.deb
```

Werk je aan de broncode? Start dan vanuit de map `code` met `npm start`. Na wijzigingen aan de broncode moet je de ontwikkelapp herstarten. Een geïnstalleerde versie verandert pas wanneer je een nieuw installatiepakket bouwt en installeert.

## Je bibliotheek

Links staan drie ingangen:

- **Onderwerpen**: alle onderwerpen in de bibliotheek.
- **Notities**: alle notities, met gezamenlijk gemaakte notities als clusters.
- **Categorieën**: een overzicht van alle categorieën.

Daaronder staan de afzonderlijke categorieën. Open een categorie om de bijbehorende onderwerpen te zien. Het tabblad **Notities** toont dan de categorienotities én alle notities van onderwerpen die momenteel in die categorie staan. Het tabblad Categorieën wordt binnen een categorie verborgen.

Klik op een onderwerp om rechts zijn categorieën en alle bijbehorende notities te zien. Nieuwste notitiedatums staan bovenaan; bij gelijke datum komt de recentst gewijzigde notitie eerst.

## Onderwerpen en categorieën toevoegen

### Een categorie met meerdere onderwerpen

1. Kies **Categorie toevoegen** of druk op **Ctrl Shift G**.
2. Vul de categorienaam in.
3. Typ onderwerpnamen in het invoerveld. De app toont suggesties voor bestaande onderwerpen.
4. Kies een bestaand onderwerp of voeg de naam als nieuw onderwerp toe. Herhaal dit voor de overige onderwerpen. Je kunt ook meerdere namen plakken, elk op een eigen regel.
5. Controleer de lijst en sla op met **Ctrl Enter**.

Een reeds toegevoegd onderwerp blijft herkenbaar in de suggesties en wordt niet dubbel gekoppeld.

### Een onderwerp toevoegen of koppelen

Gebruik **Onderwerp toevoegen** of **Ctrl N**. Buiten een categorie geef je een naam op en kies je eventueel één of meer categorieën. De categorielijst heeft een zoekveld; je selectie blijft tijdens het zoeken behouden.

Binnen een categorie kun je via dezelfde knop een bestaand onderwerp zoeken of een nieuw onderwerp toevoegen. Je hoeft hiervoor geen aparte koppelknop te gebruiken.

Selecteer een onderwerp en gebruik **Ctrl E** om het te bewerken. Met **Ctrl Shift M** kun je zijn categorieën wijzigen.

## Ordenen en verwijderen

Sleep categorieën in de zijbalk naar de gewenste volgorde. Met het toetsenbord: geef de categorieknop focus en gebruik **Alt ↑** of **Alt ↓**. De volgorde wordt bewaard en geldt ook voor het categorieoverzicht.

Met **Uit categorie** verwijder je alleen de koppeling. Het onderwerp, zijn notities en eventuele andere categoriekoppelingen blijven bestaan. Bij een geselecteerd onderwerp kan dit ook met **Ctrl Shift Delete**.

Open een categorie en kies **Categorie verwijderen**, of gebruik **Ctrl Alt Delete**. Na bevestiging verdwijnt de categorie uit het overzicht. Onderwerpen en notities blijven behouden; de notities blijven via de bibliotheek bereikbaar. De categorie wordt intern als verwijderd gemarkeerd.

Een onderwerp volledig verwijderen is momenteel geen aparte functie.

## Een notitie schrijven

1. Selecteer een onderwerp en kies **Notitie schrijven** of **Ctrl Shift N**.
2. Geef de notitie een onderwerp/titel en een datum.
3. Schrijf de inhoud. Markdown is toegestaan.
4. Geef eventueel punten op. Leeg betekent geen punten; `0` is wel een ingevulde score. Decimalen en negatieve waarden zijn toegestaan.
5. Sla op met **Ctrl Enter**.

Zonder geselecteerd onderwerp schrijft deze actie binnen een categorie een notitie bij die categorie. Vanuit de bibliotheek verschijnt een zoekvenster waarin je eerst een onderwerp of categorie kiest. Een nieuwe onderwerpnotitie hoort bij het onderwerp, ook als je die vanuit een categorie schrijft; er is geen apart contextveld.

Een notitie-icoon met een **ruit** hoort bij een onderwerp; een notitie-icoon met een **cirkel** hoort bij een categorie. De naam ernaast laat zien waar de notitie bij hoort.

Klik op een bestaande notitie om die te bewerken. Met **Ctrl P** wissel je in de individuele notitie-editor naar het Markdown-voorbeeld. Het voorbeeld ondersteunt eenvoudige koppen, vetgedrukte tekst en inline code. Overige Markdown blijft in het bestand behouden. HTML wordt als tekst weergegeven.

Een notitie verwijderen vraagt bevestiging en is definitief. Dit gebeurt via de individuele notitie-editor, ook voor een losse notitie uit een cluster. Vanuit de details van een onderwerp kun je die individuele notities openen.

## Notities voor alle onderwerpen in een categorie

Open een categorie en kies **Notities voor alle onderwerpen** of druk op **Ctrl Alt N**.

- Alle notities krijgen dezelfde titel en datum.
- Elk onderwerp heeft een eigen compact tekstveld en optionele punten.
- Voor ieder onderwerp in het formulier wordt een notitie opgeslagen. Lege tekst en tekst met alleen spaties worden `-`.
- Het zoekveld filtert op onderwerpnamen. Een leeg zoekveld toont alles. Verborgen velden worden ook opgeslagen.
- Met **Onderwerp toevoegen** kun je tijdens het schrijven een onderwerp aan het formulier en de categorie toevoegen. Met **Ctrl N** open je dit invoerveld; met **Ctrl F** ga je naar het filter.
- Een nieuw toegevoegd onderwerp kun je vóór het opslaan weer uit het formulier verwijderen.

Sla de reeks op met **Ctrl Enter**. Iedere notitie blijft een afzonderlijk Markdown-bestand bij het betreffende onderwerp. De herkomstcategorie en een gedeeld cluster-ID staan in de metadata van die bestanden.

### Een cluster gezamenlijk bijwerken

In de notitielijst en zoekresultaten verschijnt een gezamenlijk gemaakte reeks als één cluster, met categorienaam, aantal onderwerpen en **Samen bewerken**. Open de regel met de muis of selecteer hem en druk op Enter.

Het formulier bevat de bestaande teksten en punten. Je kunt de gezamenlijke titel en datum en de afzonderlijke inhoud bijwerken. Opslaan werkt de bestaande bestanden bij; de notitie-IDs blijven gelijk. Ook bij zoeken opent de app het volledige gevonden cluster.

Nieuwe reeksen met dezelfde titel en datum blijven door hun cluster-ID afzonderlijk herkenbaar. Oudere batchnotities zonder cluster-ID worden gegroepeerd op categorie, notitiedatum en titel. Eerdere notities zonder batchherkomst worden niet automatisch aan een cluster toegewezen.

## Zoeken

Met **Ctrl F** ga je naar het zoekveld. Hoofdletters en accenten maken geen verschil. Bij meerdere zoekwoorden moeten alle woorden voorkomen in de doorzochte gegevens.

- In **Onderwerpen** zoekt de bibliotheek in onderwerpnamen, categorieën, notitietitels en notitie-inhoud.
- In **Notities** zoek je binnen de getoonde notities. Binnen een categorie zijn dat de notities van die categorie en haar huidige onderwerpen.
- In **Categorieën** zoek je op categorienaam.

Met **Ctrl K** open je opdrachten en categorieën via een doorzoekbare lijst. Gebruik ↑ en ↓ om te kiezen en Enter om te openen.

## Instellingen

Open **Instellingen** onderaan de zijbalk of met **Ctrl ,**.

### Opslagmap

De huidige map staat bovenaan. Kies **Andere map kiezen** om een bestaande bibliotheek te openen of een nieuwe gegevensmap te gebruiken. De keuze wordt meteen onthouden. Bestaande bestanden worden niet verplaatst of samengevoegd; Annuleren van het instellingenscherm draait een mapwissel niet terug.

Met **Gegevensmap** of **Ctrl Shift O** open je de actieve map in de bestandsbeheerder. **Ctrl Shift D** opent de mapkiezer rechtstreeks.

### Thema en kleuren

Kies **Licht**, **Donker** of **Eigen thema**. Bij Eigen thema stel je kleuren in voor achtergrond, panelen/velden, tekst, secundaire tekst, randen, accent, selectie/markering en fouten/verwijderen.

De kleuren zijn direct als voorbeeld zichtbaar. **Opslaan** of **Ctrl Enter** bewaart het thema. **Annuleren** of Esc herstelt het eerder opgeslagen thema. **Thema herstellen** zet het voorbeeld terug naar de standaard; sla vervolgens op om dat te bewaren.

### Standaardteksten

Zoek een interfacewoord, knoptekst of hulptekst en pas het bijbehorende veld aan. Een leeg veld verbergt de tekst. Onderwerpnamen, categorienamen en notitie-inhoud worden niet aangepast.

Met ↺ herstel je één tekst; **Teksten herstellen** herstelt alle aangepaste teksten. Sla daarna op om de wijzigingen te bewaren. **Annuleren** bewaart wijzigingen aan teksten niet.

## Sneltoetsen

⇧ betekent Shift en ↵ betekent Enter. Alle knoppen en velden zijn ook met Tab bereikbaar. Op macOS accepteert de bediening doorgaans Cmd op de plaats van Ctrl; er is geen macOS-installatiepakket meegeleverd.

| Actie | Sneltoets |
|---|---|
| Opdrachten zoeken | Ctrl K |
| Zoeken in huidige weergave | Ctrl F |
| Onderwerpen / Notities / Categorieën | Alt 1 / Alt 2 / Alt 3 |
| Onderwerp toevoegen | Ctrl N |
| Categorie toevoegen | Ctrl Shift G |
| Notitie schrijven | Ctrl Shift N |
| Notities voor alle onderwerpen in categorie | Ctrl Alt N |
| Geselecteerd onderwerp of categorie bewerken | Ctrl E |
| Categorieën van geselecteerd onderwerp wijzigen | Ctrl Shift M |
| Onderwerp uit huidige categorie verwijderen | Ctrl Shift Delete |
| Huidige categorie verwijderen | Ctrl Alt Delete |
| Categorie met focus verplaatsen | Alt ↑ / Alt ↓ |
| Formulier opslaan / volgende stap | Ctrl Enter |
| Markdown-voorbeeld in individuele notitie-editor | Ctrl P |
| Instellingen | Ctrl , |
| Gegevens vernieuwen | Ctrl R |
| Actieve gegevensmap openen | Ctrl Shift O |
| Andere gegevensmap kiezen | Ctrl Shift D |
| Sneltoetsen tonen | F1 |
| Volgende / vorige bediening | Tab / Shift Tab |
| Resultaten of opdrachten doorlopen | ↑ / ↓ |
| Knop activeren of resultaat openen | Enter |
| Venster sluiten, zoekopdracht wissen of selectie opheffen | Esc |

## Bestanden en back-ups

De standaard gegevensmap is `u-track` in je Documenten-map. Onderwerpen en categorieën staan in CSV; notities staan in Markdown. Onderwerp- en categoriemappen gebruiken `yy-mm-dd--naam--uid`. Notities gebruiken `yy-mm-dd--naam--uid.md`.

De mapdatum is de aanmaakdatum. De datum van een notitiebestand is de gekozen notitiedatum. Namen worden geschikt gemaakt voor bestandsnamen. Het vaste unieke ID voorkomt botsingen bij gelijke namen. Hernoemen behoudt het ID.

Maak een back-up door de volledige gegevensmap te kopiëren terwijl de app gesloten is. Thema, aangepaste teksten en de gekozen opslagmap staan apart in `voorkeuren.json` in de gebruikersconfiguratie van u-track; neem dat bestand mee als je ook de instellingen wilt bewaren. Op Linux is dat doorgaans `~/.config/u-track/voorkeuren.json`.

Je kunt bestanden extern bewerken. Sluit eerst eventuele notitie-editors en vernieuw daarna met **Ctrl R**. Behoud bij CSV-wijzigingen de kolomnamen en IDs. Pas de centrale `onderwerpen.csv` aan, want de bestanden per categorie worden automatisch opnieuw opgebouwd.

Er is geen automatische back-up, cloudsynchronisatie of ondersteuning voor gelijktijdig bewerken vanuit meerdere processen. Deze app is nog in ontwikkeling; bewaar een back-up voordat je een nieuwe ontwikkelversie op belangrijke gegevens gebruikt.
