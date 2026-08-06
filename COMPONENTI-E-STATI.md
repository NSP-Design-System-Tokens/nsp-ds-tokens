# Guida ai componenti e agli stati — prova del nove

Due idee che evitano di ripetere lo stesso ragionamento venti volte.

La prima: ogni componente interattivo è una macchina a stati. Non è "un bottone", è "un bottone che può trovarsi in uno di N stati", e il lavoro è definire ogni stato. La seconda: i componenti hanno una gerarchia di dipendenza. Gli atomi (bottone, input) sono mattoni; le molecole (form, card, modale) li compongono. Ha senso costruirli in quest'ordine, perché quando arrivi al form hai già l'input.

---

## Il vocabolario degli stati

Gli stati interattivi universali, quelli che quasi ogni componente cliccabile deve avere:

- **Default** — riposo
- **Hover** — puntamento del mouse
- **Focus** — selezione da tastiera, fondamentale per l'accessibilità e spesso dimenticato
- **Active / pressed** — l'istante del click
- **Disabled** — non interagibile
- **Loading** — dove l'azione scatena un processo

Stati specifici per categoria:

- I controlli di selezione (checkbox, radio, toggle, tab, voce di nav) aggiungono **selected / checked / active**; il checkbox ha anche **indeterminate**.
- Gli input aggiungono **error / invalid**, **read-only**, e la distinzione tra **vuoto** (mostra placeholder) e **compilato**.

Assi di variazione oltre agli stati:

- **Dimensione** (sm / md / lg)
- **Variante** (per i bottoni: primary / secondary / tertiary)
- Presenza o meno di **icona**
- **Larghezza** (auto o full-width), a volte

---

## Atomi

### Button

Il più rivelatore, tocca tutto. Tre varianti (primary, secondary, tertiary), tutti gli stati interattivi, più spesso una dimensione (sm/md/lg) e la variante con icona (icona + testo, o solo icona). Ogni combinazione di variante e stato è un colore di surface e text diverso: qui verifichi se il sistema ha davvero tutti gli stati di ogni azione — quasi certamente rivela il buco degli stati interattivi.

### Icon button

Variante del bottone con la sola icona, quadrato o tondo. Stessi stati, ma senza testo il contrasto dell'icona sul fondo diventa critico, e la dimensione dell'area cliccabile (touch target) conta per l'accessibilità.

### Text input

La macchina a stati più ricca dopo il bottone: default, focus (il bordo cambia, `stroke.focus-ring`), error (bordo e testo di errore), disabled, read-only, più la distinzione vuoto/compilato. Verifica i ruoli `stroke.*`, `text.placeholder`, e lo spacing interno (inset).

### Textarea

Come l'input ma multiriga, con eventualmente un handle di ridimensionamento. Stessi stati dell'input.

### Select / Dropdown

Un input che apre un overlay con una lista. Combina gli stati dell'input (default, focus, error, disabled) con quelli dell'overlay aperto (z-index, elevazione dell'ombra, hover sulle voci, voce selezionata). Primo componente che tocca z-index ed elevazione insieme.

### Checkbox e Radio

Selezione. Il checkbox è binario (checked/unchecked/indeterminate), il radio è mutuamente esclusivo dentro un gruppo. Stati: default, hover, focus, checked, disabled, e le combinazioni (checked+disabled). Piccoli, quindi il contrasto del segno di spunta sul fondo è delicato.

### Toggle / Switch

On/off, con transizione animata. Stati: off, on, hover, focus, disabled, e le combinazioni. Qui entra il motion (la durata della transizione del pallino).

### Link

Testo interattivo. Default, hover (spesso underline o cambio colore), focus, visited a volte. Usa `text.primary` o un ruolo dedicato — è il caso in cui il testo stesso è l'elemento cliccabile.

### Badge / Tag / Chip

Piccola etichetta di stato o categoria. Il badge è informativo (un numero, uno stato), il tag/chip a volte è rimovibile (con una x) o selezionabile. Usa `radius.full` spesso, tipografia minima (caption o label), e i colori semantici di stato se indica uno stato. Il chip selezionabile aggiunge lo stato selected.

### Avatar

Contenitore per immagine o iniziali, spesso tondo. Poco interattivo, ma verifica il `radius.full`, il fallback (iniziali su un fondo colorato quando manca l'immagine), e le dimensioni.

### Tooltip

Piccolo overlay contestuale che appare all'hover o al focus. Tocca z-index, elevazione, e il motion (ritardo di apparizione). Usa spesso `surface.dark` con `text.on-dark`.

---

## Molecole

### Form field

Non è un atomo, è la composizione label + input + testo di aiuto/errore. È l'unità reale con cui si costruiscono i form. Verifica come label (stile `label`), input, e helper text (`text.subtle` normale, `text.error` in errore) si dispongono verticalmente con lo stack spacing giusto. Costruirlo dopo l'input dice se i ruoli di testo e lo spacing verticale reggono una composizione reale.

### Card

Contenitore con fondo, ombra, radius, e contenuto interno (titolo, testo, immagine, azioni). Verifica l'elevazione (`shadow`), il `radius`, l'inset padding, e la composizione di più elementi dentro un contenitore. La card in hover (se cliccabile) alza l'ombra: primo caso di elevazione che cambia con lo stato.

### Alert / Banner / Callout

Messaggio di stato inline (info, successo, avvertimento, errore). Questo componente esercita i colori semantici di stato come nessun altro: `surface.error` + `text.on-error` + `icon.on-error`, e le tre varianti parallele per success/warning/info. Se c'è un buco nelle coppie on- degli stati, l'alert lo rivela subito — vale la pena costruirlo presto proprio per questo.

### Toast / Notification

Come l'alert ma transitorio (appare, resta qualche secondo, sparisce). Aggiunge z-index alto (sta sopra tutto), motion (entrata e uscita), e a volte un'azione o una x per chiudere.

### Modal / Dialog

Finestra sopra un backdrop che oscura il resto. Tocca z-index (il più alto, con overlay e modal a due livelli), elevazione forte, il backdrop (`surface.overlay`), e la gestione del focus. Test più completo per lo stacking.

### Dropdown menu / Popover

Overlay con una lista di azioni o contenuto, ancorato a un trigger. Simile al select ma per azioni invece che selezione. Z-index, elevazione, hover e focus sulle voci.

### Tabs

Navigazione tra viste dentro la stessa pagina. Stati: tab default, hover, active/selected (quella corrente, con un indicatore), disabled. Verifica come si segnala lo stato attivo (colore, bordo inferiore).

### Accordion

Sezioni espandibili. Stati: chiuso, aperto, hover sull'intestazione, focus. Tocca il motion (l'animazione di apertura) e la rotazione dell'icona chevron.

---

## Navigazione e dati

### Navbar / Header

La barra in cima. Tocca z-index (spesso sticky, `z-index.sticky`), la composizione di logo, voci di nav, azioni, e il comportamento responsive (menu hamburger su mobile, che usa i boolean di visibilità). Le voci di nav hanno lo stato attivo.

### Sidebar

Navigazione laterale. Voci con stati (default, hover, active), spesso collassabile, z-index se è overlay su mobile.

### Table

Dati tabellari. Tocca la densità (spacing tra righe e celle), gli stati di riga (hover, selezionata), l'intestazione, l'allineamento, e i separatori (`stroke.divider`). Test più severo per lo spacing e per i separatori.

### Breadcrumb, Pagination, Search

Componenti di supporto alla navigazione. Breadcrumb è una fila di link con separatori; pagination sono bottoni numerici con lo stato corrente; search è un input specializzato con icona e a volte suggerimenti in overlay.

### Spinner / Progress / Skeleton

Feedback di caricamento. Lo spinner e la progress bar usano il motion; lo skeleton usa un fondo neutro animato. Poco cromatici ma toccano il motion e i neutri.

---

## L'ordine giusto per la prova del nove

Non costruirli tutti. Bastano cinque, scelti perché ognuno stressa una parte diversa del sistema, in quest'ordine:

1. **Bottone** — tocca tutto (tre azioni, tutti gli stati, colore, tipografia, spacing, radius, icona). Quasi certo che riveli il buco degli stati interattivi.
2. **Form field** (input + label + helper/error) — stressa i ruoli `stroke.*`, `text.placeholder`, `text.error`, e lo stack spacing su una composizione reale.
3. **Alert** — l'unico che esercita a fondo le coppie semantiche di stato (`surface.error`/`text.on-error` e le parallele), la parte del sistema che nessun altro componente tocca.
4. **Card** — verifica elevazione, radius, e la composizione di più elementi dentro un contenitore.
5. **Navbar** — tocca z-index, sticky, stato attivo, e il responsive con i boolean di visibilità.

Insieme, questi cinque esercitano ogni categoria di token costruita: colori in tutte le famiglie, tutti gli stati, tipografia, spacing in tutti i ruoli, elevazione, radius, z-index, motion, e i boolean. Se il sistema regge questi cinque, regge un progetto vero.

---

## Come usare un kit di riferimento gratuito

L'obiettivo non è avere componenti belli e finiti: è verificare se i propri token reggono la costruzione di componenti reali. Un kit esterno va usato come **riferimento di struttura**, non come materiale da importare — si guarda come organizza stati e varianti, poi si ricostruisce quella struttura con le proprie variabili. Si prende lo schema, non i valori.

Risorse gratuite consigliate (Figma Community):

- **Material 3 Design Kit** (Google, ufficiale) — il più maturo e documentato, aggiornato regolarmente. Pensato soprattutto per Android, ma la matrice di stati per bottoni/input/card è un riferimento eccellente e gratuito.
- **shadcn/ui** (community) — minimale, essenziale, pensato come fondazione e non come prodotto finito. Il più vicino filosoficamente a un design system snello: mostra la struttura pulita di stati e varianti senza distrarre con centinaia di varianti decorative.
- **Primer Design System** (GitHub, ufficiale) — il sistema che alimenta GitHub.com. Production-grade, con modalità light/dark/high-contrast. Utile per vedere la versione "matura enterprise" della stessa matrice di stati, e per la gestione di più temi colore.

Metodo di lavoro per ogni componente:

1. Guardare la struttura di riferimento nel kit (quali varianti, quali stati, come sono organizzati) → è lo schema.
2. Per ogni cella dello schema, identificare quale token del proprio sistema la riempie.
3. Ogni cella senza un token corrispondente è un buco: annotarlo.
4. Costruire in Figma con i token identificati e verificare che reggano davvero.
