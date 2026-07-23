# Roadmap

Planned work not yet in the system. When you start one of these, remove it from here (or split it into commit history) — this file tracks intent, not code.

## Fase D — Fusione modi al livello primitivo

**Stato:** debito noto. La v0.x pubblica il sistema con la gestione dark/light "duale" (scale primitive separate `.light.*` / `.dark.*`, palette che usa Tailwind-style 50/100/…/950). Funziona, gate verde, contrasti reggono. Non è ancora l'architettura pulita.

### Cosa

Fondere le scale primitive `color.<hue>.light.*` + `color.<hue>.dark.*` in un'unica scala `color.<hue>.*` a 12 step, con i valori dark gestiti come modo/variante:

```json
"color.red.9": {
  "$type": "color",
  "$value": "#e5484d",
  "$extensions": {
    "com.figma.modes": {
      "light": "#e5484d",
      "dark":  "#e5484d"
    }
  }
}
```

Applicabile a: `bronze`, `mauve`, `pink`, `red`, `green`, `orange`, `magenta`. `black-alpha`, `white`, `black` restano flat (invariant per modo).

### Perché

Oggi light e dark sono **due scale primitive fisiche distinte**, che rompe il modello a modi del sistema (dove `surface.page` è UN token con due valori interni, non due token). Convivono due meccanismi:

- modi (`$extensions["com.figma.modes"]`) per il semantico
- scale separate per i primitivi

Il gate non "sa" quale scala primitiva guardare in dark. Il layer semantico è costretto a scegliere step Radix diversi per light vs dark, mascherando la stessa relazione con path diversi (`palette.error.11` vs `palette.error.200` sono in realtà "step 11 in light" e "step 12 in dark" — informazione persa nel naming). Radix distribuisce due file (`green.css` + `green-dark.css`) per ragioni di packaging **sue** — ma la loro documentazione parla di UNA scala a 12 step con due temi.

### Come

Il refactor tocca 3 layer + il build:

1. **Primitivi** (`tokens/core/color.json`): unifica ogni scala mode-aware. Meccanico: light.N e dark.N diventano N con $extensions.com.figma.modes { light, dark }.
2. **Palette** (`tokens/brand/poli.json`): rinumera con Radix 1-12 al posto di Tailwind 50-950. `palette.error.500` → `palette.error.9`, `palette.error.200` → `palette.error.12`, ecc. `palette.neutral` va ricostruita con logica Radix pura (step 1-2 = surface, 3-5 = component bg, 6-8 = border, 9 = solid, 11 = text light, 12 = text dark). Eliminati gli slot `d` duplicati di secondary/tertiary (uno slot per step, il modo è nel primitivo).
3. **Semantico** (`tokens/semantic/color.json`, `elevation.json`, `typography.json`): ~200 riferimenti da aggiornare. Il pattern cambia da:
   ```json
   "text.error": { "light": "{palette.error.11}",  "dark": "{palette.error.200}" }
   ```
   a:
   ```json
   "text.error": { "light": "{palette.error.11}",  "dark": "{palette.error.12}" }
   ```
   Stesso concetto Radix (step 11 = text on light bg, step 12 = text on dark bg), step number diverso per modo.
4. **Build** (`scripts/build-css.mjs`): aggiungere emissione dei primitivi (e palette se ha modi) nel blocco `[data-theme="dark"]`, con filtro `onlyModed` per evitare duplicati. Idem `build-figma.mjs` — Figma già supporta collezioni con modi, ma il generatore deve produrre modeValues per i primitivi color.

### Ordine consigliato

Una scala alla volta, gate + verifica visiva (preview dark toggle) dopo ognuna. Ordine per rischio crescente:

1. `bronze` (accent, uso limitato) — banco di prova
2. `pink` / `mauve` (secondary/tertiary/neutral) — impatto medio
3. `red` / `green` / `orange` (stati) — impatto contrast/gate
4. `magenta` (primary, brand) — ultimo, dopo che il pattern è validato

Dopo ogni scala: `npm run build` verde + preview toggle. Rebuild palette.neutral con Radix step naming è il pezzo più delicato — c'è il rischio che `surface.page` in dark risolva al valore sbagliato se il mapping palette→primitivo non è pensato bene (light.12 di mauve = testo scuro, dark.12 di mauve = testo chiaro — direzioni opposte).

### Verifica finale

- Gate: verde
- Contrast report: nessuna regressione rispetto al baseline v0.x
- Preview visivo: tutte le sezioni pixel-identiche o migliorate in dark
- Documentazione: aggiornare `CLAUDE.md § Two mode axes` e `docs/DESIGN-SYSTEM-GUIDE.md` per riflettere che i primitivi color hanno modi

### Perché non ora

Refactor profondo di due layer (palette + semantico) più build system. Il rischio di errori aumenta a fine sessione con contesto pesante. Fase D vuole mente fresca e un-pezzo-alla-volta.
