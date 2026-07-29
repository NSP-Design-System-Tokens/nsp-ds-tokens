# Roadmap

Planned work not yet in the system. When you start one of these, remove it from here (or split it into commit history) — this file tracks intent, not code.

## Fase D — Refactor bundled

**Stato:** D1 + D2 + D3 completati in v0.3.0 (2026-07-29). Fase D chiusa.

Fase D racchiude **tre refactor da fare nello stesso giro dedicato**, perché toccano gli stessi file (`core/color.json` + `brand/poli.json` + `semantic/color.json`, ~200 riferimenti) e ha senso pagare il costo del rework una volta sola:

- ✅ **D1 — Fusione modi primitivi**: unificato `color.<hue>.light.*` + `color.<hue>.dark.*` in una scala unica mode-aware.
- ✅ **D2 — Rinumerazione palette Radix 1-12**: sostituito il naming Tailwind-style 50/100/…/950 con gli step Radix 1-12, ~200 riferimenti semantici aggiornati.
- ✅ **D3 — Estrazione brand Poli**: spostare i primitivi e gli slot Poli-specifici dalla libreria a un repo di progetto separato che installa la libreria come dipendenza. Selezione automatica via `$extensions.nsp.origin: "brand-poli"` (marcatura già presente in v0.x).

Ordine dentro Fase D: D1 e D2 erano intrecciati (stesso commit path, completati insieme). D3 è indipendente e richiede infrastruttura repo separata. Vedi § "Perché non ora" in fondo.

---

### ✅ D1 + D2 — Fusione modi + rinumerazione Radix (completato v0.3.0)

#### Cosa

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

#### Perché

Oggi light e dark sono **due scale primitive fisiche distinte**, che rompe il modello a modi del sistema (dove `surface.page` è UN token con due valori interni, non due token). Convivono due meccanismi:

- modi (`$extensions["com.figma.modes"]`) per il semantico
- scale separate per i primitivi

Il gate non "sa" quale scala primitiva guardare in dark. Il layer semantico è costretto a scegliere step Radix diversi per light vs dark, mascherando la stessa relazione con path diversi (`palette.error.11` vs `palette.error.200` sono in realtà "step 11 in light" e "step 12 in dark" — informazione persa nel naming). Radix distribuisce due file (`green.css` + `green-dark.css`) per ragioni di packaging **sue** — ma la loro documentazione parla di UNA scala a 12 step con due temi.

#### Come

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

#### Ordine consigliato

Una scala alla volta, gate + verifica visiva (preview dark toggle) dopo ognuna. Ordine per rischio crescente:

1. `bronze` (accent, uso limitato) — banco di prova
2. `pink` / `mauve` (secondary/tertiary/neutral) — impatto medio
3. `red` / `green` / `orange` (stati) — impatto contrast/gate
4. `magenta` (primary, brand) — ultimo, dopo che il pattern è validato

Dopo ogni scala: `npm run build` verde + preview toggle. Rebuild palette.neutral con Radix step naming è il pezzo più delicato — c'è il rischio che `surface.page` in dark risolva al valore sbagliato se il mapping palette→primitivo non è pensato bene (light.12 di mauve = testo scuro, dark.12 di mauve = testo chiaro — direzioni opposte).

#### Verifica finale

- Gate: verde
- Contrast report: nessuna regressione rispetto al baseline v0.x
- Preview visivo: tutte le sezioni pixel-identiche o migliorate in dark
- Documentazione: aggiornare `CLAUDE.md § Two mode axes` e `docs/DESIGN-SYSTEM-GUIDE.md` per riflettere che i primitivi color hanno modi

---

### ✅ D3 — Estrazione brand Poli (completato v0.3.0)

#### Cosa

Spostare tutto ciò che è marcato `$extensions.nsp.origin: "brand-poli"` fuori dalla libreria in un repo di progetto separato che installa `nsp-tokens` come dipendenza.

Ambito della marcatura (già presente in v0.x):

- **Primitivi Poli** in `core/color.json`: `magenta`, `bronze`, `pink`.
- **Slot palette identity** in `brand/poli.json`: `palette.primary`, `palette.secondary`, `palette.tertiary`, `palette.accent`.
- **Base condivisa** (resta in libreria): `mauve`, `red`, `green`, `orange`, `black-alpha`, `white`, `black`; slot `palette.neutral`, `palette.error`, `palette.success`, `palette.warning`.

#### Perché

La libreria deve contenere solo architettura + base neutra + stati Neosperience + ruoli semantici. L'identità di un progetto (Poli = magenta + bronze) è configurazione di quel progetto, non della libreria. Oggi Poli vive dentro la libreria per accelerare la v0.x — debito dichiarato.

#### Come

Script di estrazione filtra i sorgenti DTCG per `$extensions.nsp.origin === "brand-poli"`, sposta i nodi corrispondenti in un nuovo repo `nsp-tokens-poli` (o simile). Il repo di progetto:

1. Installa `nsp-tokens` come dipendenza (contiene base + slot funzionali).
2. Definisce i propri primitivi Poli in `tokens/core/color.json` locale.
3. Definisce i propri slot identity in `tokens/brand/poli.json` locale.
4. Merge dei sorgenti in build (la libreria espone il merger, il progetto lo invoca).

La marcatura `nsp.origin` diventa il criterio automatico dello script: nessuna ricerca a mano, nessuna dimenticanza.

**Sottigliezza critica — slot vs primitivi:** lo script migra i nodi marcati `brand-poli`, ma NON migra in blocco tutti i loro referenti. Caso concreto: `palette.tertiary` (slot `brand-poli`) punta a `color.mauve` (primitivo `base`). Lo slot migra nel repo progetto, `mauve` resta in libreria. Il repo progetto installa la libreria e la usa via `{color.mauve.*}` come qualsiasi altro consumatore. Lo script NON deve fare "estrai slot brand-poli + tutti i primitivi che referenziano". Deve fare "estrai slot brand-poli + solo i primitivi anch'essi brand-poli (`magenta`, `bronze`, `pink`)". I ref da slot brand-poli a primitivi base sono legali e rimangono cross-repo.

**Origine semantica — derivazione, non marcatura:** 31 dei 98 token semantici sono brand-poli per grafo (referenziano `palette.primary/secondary/tertiary/accent`). Non portano marcatore esplicito: l'origine è derivata da `scripts/lib/origin.mjs:deriveLeafOrigin()`, funzione canonica condivisa con il check del validator. Lo script D3 deve usare la stessa funzione — non filtrare per marker, ma camminare il grafo e derivare. Validator verifica a ogni build che il grafo sia ancorato (zero slot palette senza origine dichiarata = zero punti ciechi per l'estrazione).

#### Perché nello stesso giro di D1+D2

D3 tocca `core/color.json` e `brand/poli.json` (rimozione fisica dei nodi brand-poli). D1+D2 riscrivono gli stessi file. Fare D3 prima significa avere meno superficie da rinumerare in D2 (Poli non è più nel repo libreria). Fare D3 dopo significa che i nodi brand-poli attraversano D1+D2 prima di essere estratti. Entrambe vie funzionano; D3 prima è più pulito.

---

### Perché non ora (tutta la Fase D)

Refactor profondo di due layer (palette + semantico) più build system più separazione repo. Il rischio di errori aumenta a fine sessione con contesto pesante. Fase D vuole mente fresca, un pezzo alla volta, e i tre workstream bundled in un giro dedicato con checkpoint dopo ogni step.
