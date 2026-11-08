Applica rigorosamente la metodologia pedagogica definita nella fonte `contesto_didattico.md` (incluso l'esempio ufficiale di riferimento della Sezione 6) al testo integrale del romanzo caricato come fonte del taccuino.

Il tuo compito è generare il materiale didattico in formato **Markdown puro**, rispettando al millimetro i marcatori strutturali richiesti dal parser dell'applicazione web di stampa.

---

### PIANO DI ESECUZIONE PROGRESSIVA (ANTI-TRONCAMENTO)
Per garantire la massima qualità ed evitare tagli dovuti ai limiti di lunghezza delle risposte:
1. **In questa prima risposta**, genera **esclusivamente**:
   - Il file `dati_libro.md` della **FASE 1** (metadati e Piano delle Unità Didattiche).
   - Il file `blocco_01_esercizi.md` con la scheda didattica completa del **Blocco 1**.
2. Al termine del Blocco 1 **FERMATI** e attendi il mio comando *"Procedi con il Blocco successivo"*. A ogni comando genera **un solo** file `blocco_XX_esercizi.md`, rispettando il Piano delle Unità Didattiche.

---

### DELIMITAZIONE DEI FILE (OBBLIGATORIA)
Ogni file viene salvato e importato nell'applicazione web con il nome indicato da due righe speciali, da scrivere ciascuna da sola su una riga:
- **Prima di ogni file:** `[[FILE: nome_del_file.md]]` (es. `[[FILE: dati_libro.md]]`, `[[FILE: blocco_01_esercizi.md]]`).
- **Alla fine di ogni file:** `[[FINE]]`.
- Numera i blocchi sempre con due cifre (`blocco_01`, `blocco_02`, … `blocco_10`).
- Eventuali commenti o domande rivolti a me vanno scritti solo dopo l'ultima riga `[[FINE]]`.

---

### FASE 1: Metadati e Piano delle Unità Didattiche (`dati_libro.md`)

Genera il file con questa esatta struttura:

[[FILE: dati_libro.md]]
# Dati del Libro
- **Titolo:** [Titolo completo del romanzo]
- **Autore:** [Nome e cognome dell'autore]
- **Anno di pubblicazione:** [Anno di prima edizione]
- **Editore:** [Casa editrice]
- **Genere:** [Genere letterario]
- **Ambientazione:** [Luogo ed epoca della vicenda]
- **Target scolastico:** Scuola secondaria di primo grado (11-13 anni)
- **Unità didattiche:** [Numero complessivo di blocchi previsti]

## Piano delle Unità Didattiche
- **Blocco 1** — Capitoli: [capitoli inclusi] · Nucleo tematico: [tema pedagogico] · Attività speciale: [tipologia dal catalogo]
- **Blocco 2** — Capitoli: [capitoli inclusi] · Nucleo tematico: [tema pedagogico] · Attività speciale: [tipologia dal catalogo]

[[FINE]]

Nel Piano elenca tutti i blocchi del romanzo e assegna a ciascuno l'attività speciale della Sezione 6 secondo la regola di rotazione di `contesto_didattico.md` (tutte le sei tipologie prima di ripeterne una, mai la stessa tipologia in due blocchi consecutivi). Nei blocchi successivi rispetta sempre questa assegnazione.

---

### FASE 2: Template Obbligatorio per Ciascuna Scheda (`blocco_XX_esercizi.md`)

**Regole di compilazione** (da applicare, non da trascrivere nella scheda):
- **Titolo dell'unità** (riga `### Unità Didattica …`): solo il titolo del primo e dell'ultimo capitolo del blocco, in corsivo e separati da un trattino lungo (es. `*La chiesa vecchia* – *Il secondo biglietto*`). Non scrivere i numeri dei capitoli e non elencare i capitoli intermedi.
- **Sezione 1:** esattamente 5 domande aperte di comprensione numerate da 1 a 5 (gli esercizi verranno svolti sul quaderno: non inserire righe o spazi per la compilazione).
- **Sezione 2:** esattamente 5 affermazioni (2 vere e 3 false, oppure 3 vere e 2 false) in tabella con colonne per Vero e Falso. Nelle caselle della tabella non inserire parentesi o simboli come `[ ]`: lascia le celle vuote, basta la cornice della tabella. La correzione e motivazione dei falsi viene svolta sul quaderno.
- **Sezione 3:** esattamente 2 domande numerate (1 e 2) di riflessione e analisi dei personaggi da svolgere sul quaderno (senza righe di scrittura).
- **Sezione 4:** traccia di scrittura creativa ed empatia da svolgere sul quaderno (senza righe di scrittura).
- **Sezione 5:** esattamente 5 termini realmente presenti nei capitoli del blocco, impaginati esclusivamente come tabella a 3 colonne (`Termine o Modo di Dire`, `Abbinamento`, `Significato Contestuale`) con le definizioni A-E in ordine mescolato. Non inserire sottosezioni o domande a risposta aperta. Nella colonna Abbinamento lascia la cella vuota, senza parentesi `[ ]` o simboli: basta la cornice della tabella.
- **Sezione 6:** l'attività speciale assegnata a questo blocco nel Piano delle Unità Didattiche.
- **Nessuna intestazione studente:** non inserire campi o righe per nome, cognome, classe o data (es. «Nome e Cognome: _____»), né linee per la firma: tutti gli esercizi vengono svolti sul quaderno.
- **Nessuna dicitura o piè di pagina:** non inserire mai diciture, frasi fisse o note a piè di pagina né alla fine delle sezioni né alla fine della scheda (es. vietato inserire «Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale / Coppie» o espressioni analoghe).
- **Modello di riferimento ("Gold Standard"):** segui fedelmente la struttura, il registro e il formato dell'esempio de *Le avventure di Pinocchio* riportato nella Sezione 6 di `contesto_didattico.md` (e nel file `esempio_scheda_pinocchio.md`).
- Sostituisci tutti i segnaposto tra parentesi quadre (tranne il riquadro `[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]`). Nelle tabelle non usare caselle con parentesi `[ ]`: lascia le celle vuote (`| | |`).

Genera ciascuna scheda seguendo **esattamente** questi titoli, segnaposto e livelli di intestazione (`#`, `##`, `###`):

[[FILE: blocco_XX_esercizi.md]]
# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *[Titolo del Romanzo]* di [Autore]
### Unità Didattica [X] (Blocco [X]): *[Capitolo Iniziale]* – *[Capitolo Finale]*

---

> ### 🌊 [Titolo evocativo per l'introduzione]
> [Breve citazione dal testo o messaggio motivazionale di benvenuto nei capitoli del blocco]

---

## 1. Comprensione del Testo

*Rispondi alle domande sul tuo quaderno in modo completo, motivando con riferimenti precisi al testo.*

1. **[Titolo breve della domanda 1]:** [Testo della prima domanda inferenziale/causa-effetto]
2. **[Titolo breve della domanda 2]:** [Testo della seconda domanda inferenziale/causa-effetto]
3. **[Titolo breve della domanda 3]:** [Testo della terza domanda inferenziale/causa-effetto]
4. **[Titolo breve della domanda 4]:** [Testo della quarta domanda inferenziale/causa-effetto]
5. **[Titolo breve della domanda 5]:** [Testo della quinta domanda inferenziale/causa-effetto]

---

## 2. Vero o Falso? (Attenzione ai dettagli)

*Indica nella tabella se l'affermazione è Vera (V) o Falsa (F). Correggi e motiva sul tuo quaderno le affermazioni false.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. [Prima affermazione] | | |
| 2. [Seconda affermazione] | | |
| 3. [Terza affermazione] | | |
| 4. [Quarta affermazione] | | |
| 5. [Quinta affermazione] | | |

---

## 3. Analisi dei Personaggi e Riflessione

*Rifletti sulle scelte e sulle emozioni dei protagonisti e rispondi sul quaderno.*

1. **[Titolo breve dell'analisi 1]:** [Domanda approfondita su conflitti interiori, scelte etiche o evoluzione del personaggio]
2. **[Titolo breve dell'analisi 2]:** [Seconda domanda di riflessione su motivazioni o relazioni tra personaggi]

---

## 4. Officina di Scrittura Creativa ed Empatia

*Mettiti nei panni di uno dei protagonisti e svolgi l'attività sul tuo quaderno.*

[Consegna creativa in prima persona: pagina di diario, lettera o monologo interiore]

---

## 5. Laboratorio Lessicale e Modi di Dire

*Associa ciascun vocabolo o espressione d'autore al suo significato nel contesto del racconto (indica sul quaderno la combinazione corretta numero-lettera).*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :---: |
| 1. **[Termine 1]** | | A. [Definizione mescolata] |
| 2. **[Termine 2]** | | B. [Definizione mescolata] |
| 3. **[Termine 3]** | | C. [Definizione mescolata] |
| 4. **[Termine 4]** | | D. [Definizione mescolata] |
| 5. **[Termine 5]** | | E. [Definizione mescolata] |

---

## 6. Attività Speciale "Fuori dagli Schemi"

**[Titolo dell'attività speciale assegnata a questo blocco nel Piano delle Unità Didattiche]**  
[Spiegazione chiara della sfida laboratoriale, mappa, indagine o dibattito. Se l'attività prevede una parte grafica o uno schema, inserisci la riga seguente:]

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
[Sinossi puntuale degli eventi del blocco e coordinate tematiche]

#### Soluzioni ed elementi chiave di correzione
- **1. Comprensione del Testo:** [Risposta modello per ciascuna delle 5 domande aperte]
- **2. Vero o Falso:** [Es. 1. V; 2. F (correzione...); 3. V; 4. F (correzione...); 5. F (correzione...)]
- **3. Analisi dei Personaggi:** [Elementi chiave della riflessione attesa per ciascuna delle 2 domande]
- **4. Officina di Scrittura:** [Criteri di valutazione della produzione scritta]
- **5. Laboratorio Lessicale:** [Combinazione corretta mescolata, es. 1-C, 2-E, 3-A, 4-B, 5-D]
- **6. Attività Speciale:** [Indicazioni pratiche di conduzione in classe e criteri di valutazione]

[[FINE]]

---

### VINCOLI TECNICI TASSATIVI PER IL PARSER WEB:
1. **ZERO blocchi di codice:** non racchiudere mai la scheda o parti di essa tra tripli apici inversi. Scrivi direttamente in Markdown normale.
2. **ZERO ASCII-art:** non disegnare mai scatole o cornici con caratteri testuali (`+---+`, `| |`, `===`).
3. **ZERO HTML:** non usare tag HTML né entità come `&nbsp;`.
4. **ZERO diciture o piè di pagina:** non inserire mai diciture o note a piè di pagina (es. vietato scrivere «Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale / Coppie» o diciture simili) né a fine sezione né a fine scheda.
5. **Marcatori esatti:** gli esercizi sono svolti sul quaderno, quindi non inserire mai righe di scrittura (trattini bassi); nelle tabelle non usare caselle con parentesi `[ ]` o `[   ]` (basta la cella vuota della tabella `| | |`); usa `[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]` solo per i riquadri da disegno, `### GUIDA E RIASSUNTO PER IL DOCENTE` per separare la guida insegnante e le righe `[[FILE: ...]]` / `[[FINE]]` per delimitare ogni file.

Inizia ora con il file `dati_libro.md` (Fase 1) e la scheda del **Blocco 1**.
