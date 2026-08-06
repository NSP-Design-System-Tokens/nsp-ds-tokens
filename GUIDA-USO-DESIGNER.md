# Guida all'uso del design system — per designer

Questa guida spiega come usare le variabili e gli stili del design system per costruire i tuoi componenti in Figma. Non descrive i valori (quelli li vedi nella documentazione visiva), spiega come pensare quando progetti.

Se sei alle prime armi con questo sistema, leggi prima il glossario in fondo: ti dà il vocabolario che serve per capire il resto.

---

## Il principio che sta sopra tutto

Non scrivere mai un valore a mano. Non un colore in esadecimale, non un numero di spacing, non una dimensione di font, non un raggio d'angolo. Ogni valore che applichi a un componente deve venire da una variabile o da uno stile del sistema.

Il motivo non è pedanteria. È che le variabili sono collegate tra loro e ai temi: un colore legato a una variabile cambia da solo quando passi da light a dark; un font size legato a uno stile scala da solo tra desktop e mobile; uno spacing preso dalla scala resta coerente con tutto il resto. Un valore scritto a mano è morto: non cambia, non si adatta, e rompe la coerenza del sistema al primo cambio di tema o breakpoint.

Se ti trovi a digitare un numero o un codice colore, fermati: quasi sempre esiste già la variabile giusta, e se non esiste è un segnale (vedi "Quando manca un token").

---

## Color Roles — i colori

Questa è la categoria dove è più facile sbagliare, perché la tentazione è pescare il colore che ti piace dalla palette. Non farlo.

### La regola d'oro

Non usare mai un primitivo (`color.mauve.9`, `color.red.11`) né uno slot di palette (`palette.primary.9`) direttamente su un componente. Usa sempre un ruolo semantico.

I primitivi e gli slot sono la materia prima, non gli ingredienti finiti. I ruoli semantici (`surface.primary`, `text.default`, `stroke.divider`) sono ciò che applichi davvero, perché dicono a cosa serve il colore, non solo che colore è.

### Le quattro famiglie di ruoli

Ogni colore che applichi appartiene a una di queste quattro famiglie, a seconda di cosa stai colorando:

- **surface** — i fondi. Il fondo di una pagina, di una card, di un bottone, di un banner. Esempi: `surface.page`, `surface.card`, `surface.primary`.
- **text** — i testi. Il colore di un titolo, di un paragrafo, di un'etichetta. Esempi: `text.default`, `text.subtle`, `text.on-primary`.
- **stroke** — i bordi e i separatori. Il bordo di un input, la linea che divide due sezioni, il contorno di focus. Esempi: `stroke.divider`, `stroke.focus-ring`.
- **icon** — le icone. Il colore di un'icona, che spesso ma non sempre coincide col colore del testo accanto. Esempi: `icon.default`, `icon.on-primary`.

### La coppia "on-": la regola che ti salva dai problemi di contrasto

Quando metti un colore di superficie come fondo, il testo o l'icona che ci va sopra deve usare il ruolo `on-` corrispondente.

- Fondo `surface.primary` → testo `text.on-primary`, icone `icon.on-primary`
- Fondo `surface.error` → testo `text.on-error`, icone `icon.on-error`
- Fondo `surface.dark` → testo `text.on-dark`

Questo non è un dettaglio: i ruoli `on-` sono progettati e verificati per avere il contrasto giusto sopra la loro superficie, in entrambi i temi. Se metti `text.default` sopra `surface.primary` invece di `text.on-primary`, probabilmente il testo sarà illeggibile in almeno uno dei due temi. La coppia `on-` ti garantisce l'accessibilità senza doverci pensare.

### I ruoli neutri di testo, in ordine di importanza

- **text.default** — il testo normale, il colore che usi per la maggior parte dei contenuti.
- **text.subtle** — testo secondario, meno importante: didascalie, metadati, note.
- **text.placeholder** — il testo grigio dentro un campo input vuoto.
- **text.disabled** — testo di un elemento disabilitato.

---

## Le tre azioni: primary, secondary, tertiary

Questo non è un concetto di token, è un concetto di design che i token supportano. Capirlo è ciò che distingue un componente fatto bene da uno che rompe la gerarchia visiva.

Ogni azione in un'interfaccia ha un peso. Il sistema offre tre livelli:

- **primary** — l'azione principale della schermata. "Salva", "Conferma", "Acquista". Ce n'è **una sola** per schermata (o per sezione). Usa `surface.primary` come fondo pieno, il colore del brand, massima enfasi.
- **secondary** — azioni importanti ma non principali. "Annulla" accanto a "Salva", azioni alternative. Usa la versione soft del brand: fondo chiaro (`surface.secondary`), meno gridato del primary.
- **tertiary** — azioni di basso rilievo. "Indietro", link di navigazione, azioni marginali. Usa il neutro (`surface.tertiary`), il minimo di enfasi.

L'errore classico del principiante è mettere tre bottoni primary nella stessa schermata. Se tutto è enfatico, niente è enfatico: l'occhio non sa dove andare. La regola: una sola azione primary visibile alla volta, il resto scala su secondary e tertiary secondo la sua importanza.

---

## Spacing — gli spazi

Lo spazio non si sceglie a occhio. Si prende dalla scala, sempre.

### Perché una scala

La scala di spacing parte da 4px e cresce con incrementi controllati (4, 8, 12, 16, 24, 32, 48...). Usare solo questi valori fa sì che tutti gli spazi dell'interfaccia siano in armonia tra loro, come le note di un accordo. Un 15px messo a occhio in mezzo a una griglia di multipli di 4 stona, anche se non sai dire perché.

### I ruoli semantici dello spacing

Come per i colori, ci sono ruoli che dicono a cosa serve lo spazio:

- **inset** — il padding DENTRO un componente, tra il suo bordo e il contenuto. Il padding di un bottone, di una card, di un input.
- **stack** — lo spazio verticale TRA elementi impilati. Tra un'etichetta e il campo sotto, tra due righe di una lista.
- **inline** — lo spazio orizzontale TRA elementi in fila. Tra un'icona e il testo accanto, tra due bottoni affiancati.
- **section-gap** — lo spazio grande tra le sezioni di una pagina.
- **page-margin** — il margine laterale della pagina, tra il bordo dello schermo e il contenuto.

### In pratica

Un bottone tipico ha inset orizzontale 16px (`spacing.4`) e verticale 8-12px (`spacing.2` o `spacing.3`). Lo spazio tra un'etichetta e il suo input è stack piccolo (8px, `spacing.2`). Lo spazio tra le sezioni di una landing page è section-gap grande (64-96px). Man mano che sali di livello (dentro un componente → tra componenti → tra sezioni → margini di pagina) gli spazi crescono.

---

## Typography — i testi

Non cambiare mai il font size a mano. Applica uno stile tipografico.

### Gli stili e i loro ruoli

- **display** — i titoli hero, i grandi enunciati di apertura. Il più grande.
- **h1–h6** — la gerarchia dei titoli, dal più importante (h1) al meno (h6).
- **body-large / body / body-small** — il testo corrente, in tre grandezze.
- **caption** — le note piccole, didascalie, metadati.
- **label** — le etichette (spesso in maiuscolo, per campi e categorie).
- **cta** — il testo dei bottoni e delle call-to-action.
- **overline** — le piccole etichette sopra un titolo, spesso in maiuscolo.

### La regola

Ogni stile ha già dentro di sé la dimensione, l'interlinea, la spaziatura tra le lettere e il peso, calibrati insieme. Se un h2 ti sembra troppo grande in un certo contesto, non rimpicciolirlo a mano: usa h3. Se ti serve un peso diverso (un h1 leggero invece che bold), quello sì puoi cambiarlo localmente sul testo, ma la dimensione e l'interlinea lasciale allo stile.

Il vantaggio: se un giorno cambia la scala tipografica del sistema, tutti i tuoi h2 si aggiornano insieme. E gli stili sono legati ai breakpoint, quindi un titolo scala automaticamente tra desktop e mobile senza che tu debba fare nulla.

---

## Elevation, Radius, Border

### Elevation (le ombre)

Un'ombra serve a "sollevare" un elemento dal piano, a dargli profondità. Usa i livelli di ombra del sistema, non ombre custom.

- **shadow.sm** — sollevamento minimo: card a riposo, elementi leggermente staccati.
- **shadow.md** — sollevamento medio: card in hover, dropdown, pannelli.
- **shadow.lg** — sollevamento forte: modali, popover importanti.
- **shadow.xl** — massimo: elementi che devono galleggiare nettamente sopra tutto.

La regola: più un elemento è "vicino" all'utente e temporaneo (una modale sopra tutto), più l'ombra è marcata. Un elemento a riposo nel flusso ha ombra leggera o nessuna.

### Radius (gli angoli arrotondati)

- **radius.sm** — arrotondamento piccolo: input, badge, chip.
- **radius.md** — medio: card, bottoni, pannelli. È il default per la maggior parte dei contenitori.
- **radius.lg** — grande: card prominenti, modali.
- **radius.xl** — molto grande: contenitori hero, elementi decorativi.
- **radius.full** — completamente tondo: pill, avatar circolari, badge rotondi.

### Border width (lo spessore dei bordi)

- **border-width.hairline** (1px) — bordi normali, separatori, contorni di default.
- **border-width.thin** (2px) — bordi enfatizzati, lo stato di focus di un input.
- **border-width.thick** (4px) — bordi decorativi o accenti forti (raro).

---

## Come si comportano le cose nei temi e nei breakpoint

Due cose che funzionano da sole SE usi i token correttamente, e si rompono se non lo fai.

**Light e dark:** se usi i ruoli semantici (`surface.page`, `text.default`), il dark mode funziona automaticamente. Costruisci in light, switchi i modi, e tutto si adatta. Ma se usi un primitivo o un colore a mano, quel colore NON cambia col tema, e il tuo componente si rompe in dark. È la ragione più concreta per cui la regola d'oro dei colori esiste.

**Desktop e mobile:** se usi gli stili tipografici, i font size scalano da soli tra i breakpoint. Un `h1` è grande su desktop e più piccolo su mobile, automaticamente. Se scrivi un font size a mano, resta fisso e rompe il responsive.

La lezione: usare i token non è solo ordine, è ciò che fa funzionare temi e responsive senza lavoro extra. Ogni scorciatoia a mano è un pezzo che dovrai sistemare a mano per sempre.

---

## Gli errori più comuni (cosa NON fare)

- **Non** scrivere un colore in esadecimale (`#911e50`) → usa un ruolo semantico (`surface.primary`).
- **Non** applicare un primitivo o uno slot direttamente (`color.mauve.9`, `palette.primary.9`) → usa un ruolo semantico.
- **Non** digitare un numero di spacing a occhio (15px, 22px) → prendi il valore dalla scala.
- **Non** cambiare il font size di uno stile a mano → usa lo stile della grandezza giusta.
- **Non** inventare un raggio d'angolo (7px) → usa un valore di `radius`.
- **Non** mettere `text.default` sopra una superficie colorata → usa il `text.on-<superficie>` corrispondente.
- **Non** mettere più di un bottone primary per schermata → una sola azione principale, il resto secondary/tertiary.
- **Non** creare ombre custom → usa i livelli di `shadow`.

Ogni "non fare" ha il suo "fai invece questo" accanto. Se ti accorgi di star per fare una di queste cose, la variabile giusta esiste quasi sempre già.

---

## Esempio completo: costruire un bottone primary

Mettiamo insieme tutto su un caso reale. Un bottone primario "Conferma".

- **Fondo:** `surface.primary` (il colore pieno del brand)
- **Testo:** stile `cta`, colore `text.on-primary` (bianco o nero, quello giusto per contrastare col fondo primary)
- **Padding:** inset orizzontale `spacing.4` (16px), verticale `spacing.2` (8px)
- **Angoli:** `radius.md` (8px)
- **Icona (se presente):** `icon.on-primary`, con `spacing.2` (8px) di inline tra icona e testo

**Stato hover:** cambia solo il fondo, da `surface.primary` a `surface.primary-hover`. Il testo resta `text.on-primary`.

**Stato disabled:** fondo `surface.disabled`, testo `text.disabled`. Nessun'ombra, nessun hover.

Nota come ogni singola decisione viene da un token, nessun valore è scritto a mano. Questo bottone funzionerà in light e in dark, scalerà su mobile, e resterà coerente con ogni altro bottone del sistema. E se un giorno cambia il colore del brand, si aggiorna da solo.

Prova a rifare lo stesso esercizio per un bottone secondary e uno tertiary: cambiano i ruoli surface e text (`surface.secondary` + `text.on-secondary`, `surface.tertiary` + `text.on-tertiary`), ma la struttura è identica.

---

## Quando manca un token

Prima o poi ti servirà qualcosa che non c'è: un colore, uno spacing, un ruolo che non trovi. Quando succede:

**Non** inventare un valore a mano in Figma per risolvere al volo. Quella scorciatoia crea un'incoerenza che nessuno vedrà finché non si romperà.

**Segnala** il buco a chi gestisce il design system. Un token mancante è un'occasione per migliorare la libreria: se serve a te, probabilmente servirà anche ad altri, e va aggiunto nel posto giusto una volta per tutte.

Questo è il patto che tiene coerente il sistema: i valori vivono in un posto solo (i token), e quando quel posto è incompleto lo si completa alla fonte, non lo si aggira. È la stessa disciplina che ha reso il sistema affidabile finora.

---

## Glossario minimo

- **Token** — un valore del design system con un nome (un colore, uno spazio, una dimensione). L'unità base di tutto.
- **Primitivo** — il livello più basso: il valore grezzo (es. `color.mauve.9` è un grigio specifico). Non si usa mai direttamente.
- **Slot di palette** — il livello intermedio: assegna i primitivi ai ruoli di brand (es. `palette.primary.9` è "il colore primario di questo progetto"). Non si usa direttamente sui componenti.
- **Ruolo semantico** — il livello che usi davvero: dice a cosa serve un colore/spazio (es. `surface.primary`, `text.default`). Questo è ciò che applichi.
- **Modo** — una variante di una collezione di variabili: light/dark per i colori, desktop/tablet/mobile per il responsive. Switchi il modo e le variabili cambiano valore.
- **Scope** — la regola che decide dove una variabile appare in Figma: una variabile di spacing appare quando scegli un gap, una di colore quando scegli un fill. Serve a mostrarti solo le variabili giuste per quello che stai facendo.
- **Stile** — come un token ma per la tipografia: raccoglie dimensione, interlinea, peso e spaziatura in un'unità sola (es. lo stile `h1`).
