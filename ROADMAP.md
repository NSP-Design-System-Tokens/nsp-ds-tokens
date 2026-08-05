# Roadmap

Planned work not yet in the system. When you start one of these, remove it from here (or split it into commit history) — this file tracks intent, not code.

## Fase D — completata in v0.3.0

- ✅ **D1** — Primitive color modes fused: `color.<hue>.light.*` + `color.<hue>.dark.*` → unified `color.<hue>.N` with `com.figma.modes`.
- ✅ **D2** — Radix 1-12 renumbering: ~200 palette refs updated from Tailwind-style 50-950.
- ✅ **D3** — Brand Poli extraction: brand primitives + identity palette slots moved to `nsp-tokens-poli/`; library now base-only (308 tokens).

## Rename + tooling — completato in v0.3.0

- ✅ Package renamed `nsp-tokens` → `nsp-ds-tokens`.
- ✅ `create-project.mjs` extracted to standalone `create-nsp-project` tool (`npx github:NSP-Design-System-Tokens/create-nsp-project`). Library no longer ships scaffolding.

---

## Prossimi passi

### Spacing half-steps ordering in Figma (cosmetic, bassa priorità)

**Sintomo:** le variabili `spacing/0-5`, `spacing/1-5`, `spacing/2-5`, `spacing/3-5` appaiono in fondo alla collezione `1. Primitives` in Figma, dopo `spacing/96`, anziché interspersed.

**Causa tecnica:** V8 integer-key hoisting. JavaScript tratta le chiavi stringa che rappresentano interi canonici (`"0"`, `"1"`, ..., `"96"`) come array indices e le enumera prima in ordine numerico, indipendentemente dall'ordine di inserimento nell'oggetto. Le chiavi `"0-5"`, `"1-5"` ecc. (non-integer) vengono dopo in insertion order. Questo comportamento si applica a `Object.entries()`, `JSON.stringify()` e `JSON.parse()` — non è aggirabile senza cambiare i nomi delle chiavi.

**Impatto:** puramente cosmetico. I valori sono corretti, la risoluzione alias in Figma funziona per nome e non dipende dall'ordine. Il source `core/spacing.json` è già in ordine corretto.

**Condizione per riconsiderare:** se l'uso diretto dei mezzi-step (`0-5` = 2px, `1-5` = 6px, `2-5` = 10px, `3-5` = 14px) da parte dei designer in Figma diventa frequente, valutare migrazione a **px-values** come nomi nel dist — opzione più pulita tra le alternative:

- `spacing/0px`, `spacing/2px`, `spacing/4px`, ..., `spacing/384px`
- Chiavi non-integer (per il suffisso `px`), ordine da insertion order
- Richiede aggiornare `build-figma.mjs` (transform multiplier→px nel dist) e `sanitizeAliases` (tradurre `{spacing.N}` → `{spacing.Npx}` nelle alias)
- Naming più intuitivo per i designer (vedono px diretti, non moltiplicatori)

### Neutral configurable per progetto (media priorità)

La scelta del neutro (quale grey Radix usare come base) dovrebbe diventare
configurabile per progetto, come il brand. La libreria base attualmente usa
Radix **gray** (puro, acromatico). Un progetto che vuole un grigio caldo lo
sovrascrive nel suo repo puntando `palette.neutral` a una scala diversa.

Candidati da supportare nativamente in `create-nsp-project`:

| Scala Radix | Tinta                | Adatto a                            |
| ----------- | -------------------- | ----------------------------------- |
| `gray`      | nessuna (acromatico) | neutralità massima, brand tech/B2B  |
| `mauve`     | viola/warm           | brand caldi, lifestyle, luxury      |
| `slate`     | blu-grigio           | brand freddi, finance, enterprise   |
| `sage`      | verde-grigio         | brand nature, salute, sostenibilità |
| `sand`      | sabbia/warm          | brand retail, food, editorial       |

**Implementazione suggerita:** aggiungere un flag `--neutral <scale>` a
`create-nsp-project`. Il valore default rimane `gray`. Quando specificato,
il progetto generato fa puntare `palette.neutral.*` a `color.<scale>.*`
invece di `color.gray.*`. La libreria base non cambia — solo il brand repo.
