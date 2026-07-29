# Guida pratica: nuovo progetto cliente con nsp-tokens

Questa guida copre l'intero processo, dal momento in cui arriva un nuovo cliente al momento in cui hai Figma pronto per progettare. Ogni passo è concreto: cosa fai, dove, con quale comando.

Prerequisiti: nsp-tokens (la libreria base) clonata e funzionante sul tuo computer, npm installato, il plugin Figma Token Manager installato in Figma.

---

## 1. Raccogli i colori del cliente

Prima di toccare qualsiasi file, ti serve una sola cosa: il colore primario del brand. È il colore d'identità, quello che il cliente riconosce come "suo". Un hex, un Pantone convertito, il colore del logo. Esempio: per Poli era #911e50 (un magenta scuro).

Se il cliente ha anche un colore secondario d'accento (un oro, un blu, un verde), prendilo. Se non ce l'ha, parti col solo primario e vedi dopo se ne serve uno.

Non ti servono palette complete, rampe di colore, varianti chiare e scure. Quelle le genera il sistema. Ti serve solo il punto di ancoraggio: il colore pieno del brand.

## 2. Crea il repo del progetto

Il repo del progetto è una copia della struttura di nsp-tokens-poli, non di nsp-tokens (la libreria). Poli è il tuo template di progetto.

```bash
# Crea la cartella del progetto
mkdir nsp-tokens-nomecliente
cd nsp-tokens-nomecliente

# Inizializza
npm init -y
git init

# Installa la libreria base come dipendenza
npm install ../nsp-tokens    # o il path/url del tuo repo libreria
```

Copia da nsp-tokens-poli la struttura dei file (non i valori, la struttura):

- `tokens/core/color.json` (qui andranno le scale custom del brand)
- `tokens/brand/nomecliente.json` (gli slot alias: primary, secondary, accent)
- `tokens/semantic/color.json` (i ruoli semantici brand-specific)
- `scripts/build.mjs` (o il riferimento alla build della libreria)
- `CLAUDE.md` del progetto

La libreria base porta tutto il resto: neutri, stati, spacing, tipografia, layout, gate.

## 3. Genera la scala di brand

Questo è il passo chiave. Prendi il colore primario del cliente e genera una scala a 12 step col metodo Radix.

### Usando lo strumento Radix

Vai su https://www.radix-ui.com/colors/custom e inserisci il colore del cliente come "accent color". Radix genera una scala a 12 step, light e dark, calibrata per il contrasto. Copia i 24 valori (12 light + 12 dark).

### Se Radix non produce il risultato giusto

Se il colore è molto scuro o molto saturo, Radix potrebbe spostarlo troppo. Confronta lo step 9 generato con il colore originale: devono essere visivamente identici o quasi. Se divergono troppo (come è successo con Poli, dove Radix pink era troppo acceso rispetto al magenta scuro), genera la scala custom con lo script che hai nel repo, ancorata al colore esatto del cliente come step 9.

### Il risultato

Una scala di 12 step, light e dark, dove:

- Step 1-2: sfondi app chiarissimi
- Step 3-5: tinte per hover/pressed (il ghost button)
- Step 6-8: bordi
- Step 9: il colore pieno del brand (= il colore del cliente)
- Step 10: hover del colore pieno
- Step 11: testo su fondo chiaro
- Step 12: testo su fondo scuro

Metti questa scala in `tokens/core/color.json` del progetto, con un nome di colore (non di brand): se il colore è un magenta lo chiami `color.magenta`, se è un blu `color.blue`. Il nome del cliente non va nei primitivi.

## 4. Se c'è un colore d'accento

Stesso procedimento: genera la scala a 12 step. Mettila in `tokens/core/color.json` accanto alla prima. Per Poli era il bronze (oro scuro).

## 5. Configura gli slot alias

Apri `tokens/brand/nomecliente.json`. Questo è l'unico file dove il nome del cliente appare. Qui colleghi le scale ai ruoli:

```json
{
  "palette": {
    "primary": {
      "Commento": "Il magenta del cliente",
      "slot mappings qui: primary.50 → color.magenta.light.2, ecc."
    },
    "secondary": {
      "Commento": "Brand soft: stessa scala del primary, step bassi",
      "slot mappings: secondary.3 → color.magenta.light.3, ecc."
    },
    "tertiary": {
      "Commento": "Neutro: usa mauve dalla libreria base",
      "slot mappings: tertiary.3 → color.mauve.light.3, ecc."
    },
    "accent": {
      "Commento": "Il colore d'accento (se c'è)",
      "slot mappings: accent.9 → color.bronze.light.9, ecc."
    }
  }
}
```

La convenzione per gli slot:

- **primary** = il colore pieno del brand. Bottoni primari, header, elementi forti.
- **secondary** = lo stesso colore ma in versione ghost/soft. Step 3-5 per gli sfondi, 11-12 per il testo. Bottoni secondari, chip, badge.
- **tertiary** = neutro (mauve dalla libreria). Bottoni di basso rilievo, azioni terziarie.
- **accent** = il colore d'accento se esiste. Evidenziazioni, badge speciali, dettagli decorativi.

Se il cliente non ha un accento, puoi omettere lo slot accent o puntarlo a una variante del primary.

## 6. Configura i ruoli semantici brand-specific

In `tokens/semantic/color.json` del progetto, i ruoli che usano il brand:

- `surface.primary` → `palette.primary.500` (il fondo del bottone primario)
- `surface.primary-hover` → `palette.primary.700`
- `surface.secondary` → `palette.secondary.3` (con modo dark → .3d)
- `text.on-primary` → bianco (o nero, dipende dalla luminosità del brand)
- `text.on-secondary` → `palette.secondary.12` (testo scuro della stessa scala)
- eccetera, seguendo il pattern di Poli come modello.

I ruoli che NON dipendono dal brand (surface.page, text.default, stroke.default, tutti gli stati error/success/warning) vengono dalla libreria base e non li tocchi.

## 7. Lancia la build e verifica

```bash
npm run build
```

Questo combina i token del progetto con quelli della libreria base, esegue la validazione e i gate (riferimenti, layering, contrasto, origin), e produce gli output:

- `dist/figma-variables.json`
- `dist/figma-styles.json`
- `build/css/tokens.css`
- `build/tailwind/tokens.cjs`

Se il gate fallisce, ti dice esattamente cosa non va:

- **Riferimento non risolto**: uno slot punta a un primitivo che non esiste. Controlla i nomi.
- **Contrasto insufficiente**: una coppia testo/superficie non raggiunge la soglia. Il colore del brand è troppo chiaro o troppo scuro per il testo che ci hai messo sopra. Aggiusta il valore (scegli uno step diverso) o cambia il testo (da bianco a nero o viceversa).
- **Layering violation**: un token semantico punta direttamente a un primitivo saltando la palette. Passa per lo slot.

Itera finché il gate è verde.

## 8. Importa in Figma

Apri Figma, crea un file nuovo per il progetto (o apri quello esistente).

### Primo import (file nuovo)

1. Lancia il plugin: Plugins → Development → Figma Token Manager
2. **Import Variables**: carica `dist/figma-variables.json`. Il plugin crea le collezioni con variabili, modi, alias e scope.
3. **Import Styles**: carica `dist/figma-styles.json`. Il plugin crea i text styles e i grid styles.
4. **Match Variables to Styles**: clicca il bottone. Il plugin lega i font size dei text styles alle variabili responsive (type-size), così la tipografia cambia con il breakpoint.

### Aggiornamento (file esistente)

Stessi tre passi. L'import è idempotente: aggiorna le variabili e gli styles esistenti per nome, non li duplica.

### Verifica

- Apri il pannello Variables: dovresti vedere le collezioni con i colori del nuovo brand.
- Crea un frame, applica `surface/primary` come fill: deve essere il colore del cliente.
- Attiva il modo Dark: i colori devono invertirsi.
- Scrivi un testo, applica lo style "H1": deve avere il font size giusto.
- Cambia il modo del frame da Desktop a Mobile: il font size deve scalare.
- Applica un grid style (Grid/Desktop): deve avere 12 colonne, 32px gutter, 80px margine.

## 9. Progetta

Da qui in poi lavori in Figma come sempre, con una differenza: ogni colore, spacing, font size, radius che applichi è una variabile, non un valore fisso. Quando scegli un fill, scegli dalla lista delle variabili (che grazie agli scope mostra solo quelle pertinenti al contesto). Quando imposti un gap, lo prendi dalle variabili di spacing.

Se ti accorgi che manca un token (un colore che ti serve e non c'è, uno spacing che non esiste nella scala), non lo inventi in Figma: torni al JSON, lo aggiungi nel tier giusto, rilanci la build, reimporti. Il JSON è la sorgente, Figma è la destinazione.

## 10. Quando cambi qualcosa

Il flusso è sempre lo stesso, in qualsiasi momento:

1. Edita il JSON nel repo del progetto
2. `npm run build` (il gate verifica automaticamente)
3. Reimporta in Figma col plugin
4. Figma si aggiorna

Non editare mai le variabili direttamente in Figma. Se lo fai, la modifica vive solo lì e viene sovrascritta al prossimo import.

---

## Riepilogo: cosa va dove

| Cosa                                                 | Dove                            | Esempio                              |
| ---------------------------------------------------- | ------------------------------- | ------------------------------------ |
| Scale di colore neutre (mauve)                       | Libreria (nsp-tokens)           | color.mauve                          |
| Scale di stato (rosso, verde, arancione)             | Libreria                        | color.red, color.green, color.orange |
| Spacing, tipografia, motion, layout, z-index, radius | Libreria                        | spacing._, font.size._, grid.*       |
| Gate e validazione                                   | Libreria                        | scripts/validate.mjs                 |
| Plugin Figma                                         | Separato (figma-token-manager/) | code.js                              |
| Scala di brand del cliente                           | Progetto                        | color.magenta (in nsp-tokens-poli)   |
| Slot alias (primary, secondary, accent)              | Progetto                        | brand/poli.json                      |
| Ruoli semantici brand-specific                       | Progetto                        | surface.primary, text.on-primary     |

---

## Checklist rapida nuovo progetto

- [ ] Colore primario del cliente (hex)
- [ ] Colore accento se esiste (hex)
- [ ] Repo progetto creato e libreria installata
- [ ] Scala brand generata (12 step, light + dark)
- [ ] Scala accento generata (se serve)
- [ ] Slot alias configurati (primary, secondary, tertiary, accent)
- [ ] Ruoli semantici brand-specific configurati
- [ ] `npm run build` verde (gate passa)
- [ ] Import Figma: variabili + styles + match
- [ ] Verifica in Figma: colori, dark mode, responsive, grid
