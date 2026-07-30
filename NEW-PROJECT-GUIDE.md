# Guida pratica: nuovo progetto cliente con nsp-ds-tokens

Questa guida copre l'intero processo, dal momento in cui arriva un nuovo cliente al momento in cui hai Figma pronto per progettare.

Prerequisiti: Node.js ≥ 18, npm, il plugin Figma Token Manager installato in Figma. Non serve clonare la libreria.

---

## 1. Raccogli i colori del cliente

Ti servono solo gli hex. Il colore primario del brand è obbligatorio (es. #911e50). Il secondario e l'accento sono opzionali: se il cliente non li ha, li salti.

Non ti servono palette, rampe, varianti chiare e scure: le genera lo script.

## 2. Crea il progetto

### Dove ti posizioni

Puoi essere in qualsiasi cartella sul disco. Lo script crea la cartella del progetto lì dove sei:

```
qualsiasi-cartella-di-lavoro/
  nsp-ds-tokens-poli/           ← un progetto esistente
  nsp-ds-tokens-nomecliente/    ← il progetto che stai per creare
```

### Il comando

```bash
npx github:asimonato/create-nsp-project
```

Lo script chiede in sequenza:

- Nome del progetto
- Colore primario (hex)
- Colore secondario (hex, invio per saltare)
- Colore accento (hex, invio per saltare)

Puoi anche passare tutto in un comando solo, senza le domande interattive:

```bash
npx github:asimonato/create-nsp-project nomecliente "#911e50" "#..." "#..."
```

Cosa fa lo script, in automatico:

1. Crea il progetto in `./nsp-ds-tokens-nomecliente` (nella cartella corrente)
2. Genera le scale a 12 step (light + dark) per ogni colore fornito, ancorate esattamente all'hex dato allo step 9
3. Sceglie automaticamente il colore del testo giusto su ogni superficie (bianco o nero, qualunque contrasti di più) e lo step giusto per i ruoli di testo/icona (scansiona gli step finché non trova quello che passa la soglia di contrasto)
4. Scrive tutti i file token già compilati — primitivi, slot, ruoli semantici
5. Lancia `npm install` (scarica `nsp-ds-tokens` da GitHub) e `npm run build` da solo

Al termine, uno di questi due esiti:

**Gate verde**: il progetto è pronto, vai al passo 3 (Figma).

**Avviso di contrasto**: succede con colori intrinsecamente chiari (un giallo acceso, per esempio), dove nessuno step raggiunge il contrasto minimo per il testo. Lo script te lo dice onestamente invece di produrre un progetto rotto in silenzio. In questo caso è una decisione di design vera: o accetti un compromesso (testo un po' sotto soglia AAA ma sopra AA), o scegli una tonalità leggermente diversa del colore del cliente, o chiedi aiuto per una scala custom con più margine.

## 3. Importa in Figma

Apri Figma, crea un file nuovo per il progetto (o apri quello esistente).

### Primo import (file nuovo)

1. Lancia il plugin: Plugins → Development → Figma Token Manager
2. **Import Variables**: carica `dist/figma-variables.json` dal progetto. Il plugin crea le collezioni con variabili, modi, alias e scope.
3. **Import Styles**: carica `dist/figma-styles.json`. Il plugin crea i text styles e i grid styles.
4. **Match Variables to Styles**: clicca il bottone. Il plugin lega i font size dei text styles alle variabili responsive, così la tipografia cambia con il breakpoint.

### Aggiornamento (file esistente)

Stessi tre passi. L'import è idempotente: aggiorna le variabili e gli styles esistenti per nome, non li duplica.

### Verifica

- Apri il pannello Variables: dovresti vedere le collezioni con i colori del nuovo brand.
- Crea un frame, applica `surface/primary` come fill: deve essere il colore del cliente.
- Attiva il modo Dark: i colori devono invertirsi.
- Scrivi un testo, applica lo style "H1": deve avere il font size giusto.
- Cambia il modo del frame da Desktop a Mobile: il font size deve scalare.
- Applica un grid style (Grid/Desktop): deve avere 12 colonne, 32px gutter, 80px margine.

## 4. Progetta

Da qui in poi lavori in Figma come sempre, con una differenza: ogni colore, spacing, font size, radius che applichi è una variabile, non un valore fisso. Quando scegli un fill, scegli dalla lista delle variabili (che grazie agli scope mostra solo quelle pertinenti al contesto).

Se ti accorgi che manca un token, non lo inventi in Figma: torni al JSON del progetto, lo aggiungi, rilanci `npm run build`, reimporti. Il JSON è la sorgente, Figma è la destinazione.

## 5. Quando cambi qualcosa

1. Edita il JSON nel repo del progetto (es. vuoi cambiare una sfumatura del brand)
2. `npm run build` (il gate verifica automaticamente)
3. Reimporta in Figma col plugin
4. Figma si aggiorna

Non editare mai le variabili direttamente in Figma: la modifica vive solo lì e viene sovrascritta al prossimo import.

---

## Cosa sapere se qualcosa non torna

**Il colore generato non assomiglia a quello del cliente**: capita con colori molto scuri o molto saturi, dove l'algoritmo di generazione sposta troppo il risultato. Lo script ancora sempre lo step 9 all'hex esatto fornito, quindi il colore pieno è sempre fedele; eventuali scarti percettibili riguardano gli step intermedi, non il colore principale.

**Il gate fallisce dopo aver modificato un valore a mano**: hai probabilmente cambiato un colore che rompe una coppia di contrasto già bilanciata dallo script. Il messaggio del gate ti dice quale coppia e su quale superficie: puoi scegliere uno step diverso per il ruolo di testo coinvolto.

**Voglio un quarto colore (es. un blu per un'informazione specifica)**: aggiungi la scala nel `tokens/core/color.json` del progetto (a mano o rigenerandola con lo stesso metodo), crei un nuovo slot nel file brand, e lo agganci a un ruolo semantico nuovo. È un'estensione del progetto, non tocca la libreria.

---

## Riepilogo: cosa va dove

| Cosa                                                                                        | Dove                                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Neutri, stati (rosso/verde/arancione), spacing, tipografia, layout, motion, z-index, radius | Libreria (nsp-ds-tokens)                                       |
| Gate e validazione                                                                          | Libreria                                                       |
| Plugin Figma                                                                                | Separato (figma-token-manager/)                                |
| Script di scaffolding interattivo                                                           | create-nsp-project (`npx github:asimonato/create-nsp-project`) |
| Scale di brand, slot, ruoli semantici brand-specific                                        | Progetto (nsp-ds-tokens-nomecliente), generati dallo script    |

---

## Checklist rapida nuovo progetto

- [ ] Colore primario del cliente (hex), secondario e accento se esistono
- [ ] `npx github:asimonato/create-nsp-project`
- [ ] Gate verde (o avviso di contrasto risolto con una scelta di design)
- [ ] Import Figma: variabili + styles + match
- [ ] Verifica in Figma: colori, dark mode, responsive, grid
