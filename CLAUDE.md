# CLAUDE.md, sondre.com (sondre)

Denne fila leses automatisk ved start av hver Claude Code-økt i dette repoet.
Reglene her gjelder alltid, uten at de gjentas i prompten.

## JAXX, kilden til prosjektkunnskapen

Koden ligger her. Kunnskapen om domenet, hostingen og DNS ligger i JAXX på
Google Drive, i `Registry\DOMENER.md`. Stien til Registry står i
`C:\dev\CLAUDE.md`, som leses sammen med denne fila.

Les `DOMENER.md` før du foreslår noe som rører domenet, DNS eller hostingen.
Står et faktum i JAXX, er JAXX fasiten.

Beslutninger, logg og erfaringer for selve nettsiden ligger i JAXX under
`Registry/sondre.com/` (mappe-ID `1dxktoxU8p7Zg8zsT89GLo0a7xD1eHWeb`).
Les `00-BESLUTNINGER.md` der før du endrer siden, og skriv i `00-LOGG.md` før økta slutter.

Felles regler for alle repoer i `C:\dev` står i `C:\dev\CLAUDE.md`.

## Hva dette er

Sondres private hjemmeside og ansiktet hans utad. Den skal være den best mulige
representasjonen av ham, og kvalitet går foran filstørrelse.

Fra 2026-09-25 er forsiden en rullestyrt 3D-reise bygget med Three.js: kameraet
flyr fra bane rundt jorden, via Helgeland, Mojave, ESA-uttaket og oppskytingen,
til romstasjonen og ut i verdensrommet. Fortsatt statisk, uten byggesteg, uten
PHP og uten database. `README.md` beskriver filene og hvordan siden testes
lokalt. Kort fortalt:

- `index.html` har all tekst, norsk og engelsk, ett kapittel per `<section>`.
- `assets/css/style.css` har utseendet.
- `assets/js/` har 3D-scenen, delt i moduler. `scene.js` bestemmer hvor
  kameraet står i hvert kapittel.
- `assets/img/` har bildene siden bruker. `assets/textures/` har kart over
  jorden, månen og galakser.
- `vendor/three/` har Three.js, lagret lokalt og ikke hentet fra CDN.
- Originalbildene i rota (`NASA.JPG` osv.) brukes ikke lenger av siden.

Siden bruker JavaScript-moduler og virker ikke ved dobbeltklikk på
`index.html`. Test med `python -m http.server 8000` fra repoet.

Repoet eies av den **personlige** kontoen `SMACKOMATIC` og skal aldri flyttes
inn i en organisasjon. Dette er identiteten, ikke et selskap.

## Publisering, og hvor den faktisk kjører

Repoet er koblet til Vercel-prosjektet `sondre`, og en push til `main` ruller
ut av seg selv. Per 2026-09-25 peker både `sondre.com` og `www.sondre.com` på
Vercel, og Vercel svarer besøkende. Navnetjenerne ligger fortsatt hos pair.com.
WinSCP og pair.com brukes ikke til publisering lenger.

**Merk at sondre.com bærer Google Workspace-e-post.** A og CNAME styrer
nettsiden, MX, SPF, DKIM og DMARC styrer e-posten. Ikke rør de siste.

## Arbeidsmåte

- Commit aldri på egen hånd. Først når Sondre sier «rull ut» eller «legg ut».
- Three.js er avtalt og er en del av siden. Andre rammeverk og avhengigheter
  krever fortsatt avtale.
- Se på en eksisterende seksjon før du legger til en ny, og match strukturen og
  klassenavnene som finnes.
- Store filer er tillatt når de gjør siden bedre, som bilder og teksturer i høy
  oppløsning. Si fra i rapporten når du legger til noe over 1 MB, så Sondre vet
  hva repoet vokser med.
- Test i nettleser før utrulling, både på PC-bredde og mobilbredde, og sjekk at
  konsollen er fri for feil.
- Avslutt med en kort rapport: hvilke filer du endret, hvor, og hva du hoppet
  over.

## Husstil

Norsk bokmål på den norske versjonen, engelsk på den engelske. Siden har en
NO/EN-velger, så tekst som legges til må legges til i begge. Flat, ærlig og
konkret tone. Aldri lang tankestrek.
