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

---

## La prova del nove (priorità massima, prima di tutto il resto)

### Costruire componenti veri con i token

Non ancora fatto. È il test che rivela i buchi reali guidati dall'uso invece
che dall'analisi a tavolino — ogni sessione di lavoro su questo sistema ha
dimostrato che i bug più importanti (font non propagato, dark mode non
switchante, duplicati text.title/text.primary, scope confusi) emergono solo
usando il sistema, non leggendo il codice.

Componenti da costruire in Figma, usando esclusivamente variabili e stili
del sistema (nessun colore, font size o spacing scritto a mano):

- **Bottone** nei tre livelli (primary, secondary, tertiary), con stati
  hover e disabled
- **Campo input** con label, placeholder, focus, errore, disabled
- **Card** con titolo, testo, immagine, badge
- **Navigazione** (navbar o sidebar) con stato attivo

Annotare ogni volta che: un token manca e si scrive un valore a mano; un
token esiste ma ha nome o scope sbagliato per l'uso; un componente non si
adatta correttamente switchando light/dark o desktop/mobile.

Questo test genera la lista di priorità più onesta per tutto quanto segue in
questa roadmap — molte delle voci sotto vanno confermate o ridimensionate
alla luce di quello che emerge costruendo.

---

## Stati interattivi (blocco rimandato più volte)

### Stati completi su tutte le famiglie di azione

Hover, active/pressed, disabled, focus su primary, secondary, tertiary,
accent — oggi presenti in modo parziale e non sistematico. Da affrontare
dopo la prova del nove, che dirà esattamente quali stati servono davvero.

Include l'estensione della copertura del gate di contrasto alle superfici
introdotte dagli stati (es. `on-primary` verificato anche su
`surface.primary-hover`, non solo sulla base) — pattern già consolidato per
`raised`/`floating`, da ripetere per ogni nuova superficie di stato.

---

## Accessibilità

### Check APCA (WCAG 3.0) come verdetto informativo parallelo

**Contesto:** WCAG 3.0 è un Working Draft (bozza più recente marzo 2026), non
raggiungerà lo status di Recommendation prima del 2029 circa. Lo standard
legale operativo resta WCAG 2.2 AA. Il metodo di contrasto APCA proposto da
WCAG 3.0 resta esplorativo e non è normativo.

**Perché vale la pena:** Radix (base dei nostri primitivi) è calibrato con
APCA, non con WCAG 2.2 — verifichiamo con un algoritmo diverso da quello per
cui la palette è stata progettata. APCA è inoltre polarity-aware (testo scuro
su chiaro ≠ testo chiaro su scuro a parità di differenza di luminosità) e
considera font size/weight nella soglia, non solo il colore — risolverebbe
con precisione casi limite già incontrati (contrasto su neutri tinti come
`mauve.2`/`gray.2`, testo colorato su superfici sature).

**Implementazione:** libreria `apca-w3` (npm), JS puro. Il gate WCAG 2.2
resta quello che blocca la build — nessun cambiamento al comportamento
attuale. Un check APCA parallelo gira sulle stesse coppie e mostra i suoi
verdetti (valori Lc) accanto ai ratio WCAG, etichettato chiaramente come
"APCA (draft, informativo)", in: preview HTML, documentazione Figma, plugin.

**Priorità:** dopo la prova del nove. È un arricchimento, non una correzione.

### Rilettura periodica dell'allowlist di contrasto

Le voci in `CONTRAST_EXEMPT` (libreria e plugin) vanno riverificate
periodicamente — specialmente dopo modifiche ai primitivi o ai ruoli
semantici — per confermare che ogni esenzione sia ancora valida e non
ridondante o obsoleta. Stessa disciplina per la marcatura `$extensions.nsp.origin`:
verificare periodicamente che resti completa dopo l'aggiunta di nuovi token.

---

## Strumenti e automazione

### GitHub Action: auto-build del dist sui tag

Oggi `verify-dist.yml` verifica che il dist committato sia allineato ai
sorgenti e blocca il tag se non lo è (fail-safe, non fail-fix, per design).
Evoluzione possibile: una Action che rigenera il dist automaticamente PRIMA
della creazione del tag, eliminando anche il passo manuale "build prima di
taggare". Va valutato con attenzione l'ordine tag/commit per non ricreare il
problema del tag che punta al commit sbagliato (richiederebbe poi un
force-push).

### Editor di configurazione dei token (esplorativo)

Ipotesi discussa: un'interfaccia web per editare i JSON dei token
visualmente (color picker, slider, feedback di contrasto in tempo reale),
building su `contrast.mjs` già esistente. Da costruire solo se il gesto
"edita JSON a mano" diventa abbastanza frequente da giustificarlo — oggi il
plugin Figma (generazione + import) copre gran parte di questo bisogno.

### Preview HTML: allineare la vista Contrast al formato card

La documentazione Figma ha adottato il formato "card raggruppate per token"
per la vista Contrast (riduce la ripetizione, migliora la scansione). Se la
preview HTML resta uno strumento in uso attivo, andrebbe allineata allo
stesso formato.

---

## Figma e plugin

### Aggiornamento automatico di un file Figma esistente

Il plugin oggi copre bene il caso "genera un progetto da zero". Il caso
"aggiorna un file esistente quando la libreria pubblica una versione nuova"
resta manuale (reimport). Possibile evoluzione: il plugin rileva la versione
della libreria con cui il file è stato generato e offre un aggiornamento
guidato.

### Pagina di documentazione come componente di libreria Figma condivisa

Oggi la documentazione è generata dal plugin come frame statici per
progetto. Pubblicarla come componente/libreria Figma condivisa
permetterebbe ai progetti di ereditarla invece di rigenerarla. Complessità
Figma non banale (main component + istanze cross-file) — da valutare solo
se il numero di progetti attivi lo giustifica.

---

## Distribuzione e multi-brand

### Primo progetto cliente reale

Validare l'intero flusso end-to-end (scaffolding → Figma → consegna) su un
progetto vero, non su un progetto di test. Poli è il candidato naturale
essendo già esistente, oppure un nuovo cliente.

### Pacchetto pubblicato su registry (npm / GitHub Packages)

Oggi la libreria si consuma via `github:` URL pinnato a un tag. Pubblicarla
su un registry vero renderebbe l'installazione più standard e la gestione
delle versioni più robusta (range di versione, `npm outdated`, ecc.). Non
urgente: il flusso GitHub funziona ed è già versionato correttamente.
