# sondre.com

Privat hjemmeside hostet på Pair.com. Siden forteller reisen mot verdensrommet som en 3D-reise: når du ruller nedover, flyr et kamera fra bane rundt jorden, ned til Helgeland, videre til Mojave, ESA-uttaket, oppskytingen, romstasjonen og ut i verdensrommet.

## Struktur

```
index.html              All tekst (norsk og engelsk) og oppsettet av siden
assets/css/style.css    Utseende: paneler, meny, flydisplay (HUD), mobilvisning
assets/js/main.js       Rulling, språkvalg, HUD, lysboks for bilder, romskip-peker
assets/js/scene.js      "Regissøren": hvor kameraet står i hvert kapittel
assets/js/earth.js      Jorden, skyer, atmosfære og markører på kartet
assets/js/sky.js        Stjerner, Melkeveien, galakser og solen
assets/js/iss.js        Romstasjonen (ISS)
assets/js/rocket.js     Raketten og flammen
assets/js/swarm.js      23 000 punkter for ESA-uttaket
assets/js/route.js      Glødende baner (suborbital hopp, Zero-G-parabler)
assets/js/geo.js        Matte: breddegrad/lengdegrad til 3D-posisjon
assets/img/             Nettversjoner av bildene (små filer)
assets/textures/        Kart over jorden, skyer, månen, galakser
vendor/three/           Three.js (3D-biblioteket), lagret lokalt
```

Bildene i rotmappen (`NASA.JPG`, `ISS.JPG` osv.) er originalene. Siden bruker dem ikke lenger. Den bruker de mindre kopiene i `assets/img/`.

## Slik virker det

1. Hvert kapittel i `index.html` er en `<section>` med `data-chapter="0"` til `"9"`.
2. `main.js` måler hvor langt du har rullet, og regner ut et tall `t` fra 0 til 9. `t = 3` betyr "midt i kapittel 3". `t = 3.5` betyr "halvveis mellom kapittel 3 og 4".
3. `scene.js` har en liste med ett kamerabilde ("shot") per kapittel. Mellom to kapitler flyr kameraet i en bue rundt jorden, slik at det aldri går gjennom den.
4. All tekst er vanlig HTML. Google, skjermlesere og språkknappen virker derfor som før.
5. Har nettleseren ikke 3D-støtte (WebGL2), viser siden et stillbilde av Melkeveien i stedet.

## Teste på egen PC

Siden bruker JavaScript-moduler. De virker ikke hvis du dobbeltklikker på `index.html`. Du må starte en liten lokal webserver:

```
cd C:\dev\sondre
python -m http.server 8000
```

Åpne så <http://localhost:8000> i nettleseren. Stopp serveren med `Ctrl + C`.

Tips: `http://localhost:8000/?snap` slår av den myke kamerabevegelsen. Det er nyttig for skjermbilder.

## Vedlikehold

1. Hent siste versjon fra GitHub: `git pull`
2. Rediger filer lokalt på Windows-PC
3. Test lokalt (se over)
4. Last opp til GitHub for versjonskontroll
5. Publiser på Pair.com via WinSCP

## Opplasting til Pair

Bruk WinSCP:
- Koble til Pair FTP
- Naviger til `/usr/www/users/sondre1/public_html/`
- Last opp disse filene og mappene:
  - `index.html`
  - `assets/` (hele mappen)
  - `vendor/` (hele mappen)
  - `favicon.png`, `favicon.ico`, `googlehostedservice.html`

Originalbildene i rotmappen trenger du ikke å laste opp.

## Bildekilder

- Jorden: NASA Blue Marble og Black Marble (fri bruk)
- Skyer: Tom Patterson, Natural Earth III (fri bruk)
- Melkeveien: ESO/S. Brunier (CC BY 4.0)
- Andromeda (M31) og Malstrømgalaksen (M51): NASA/ESA Hubble
- Månen: three.js-eksempler
- 3D-bibliotek: three.js (MIT-lisens, se `vendor/three/LICENSE`)

---

**Sist oppdatert:** September 2026
