Applica rigorosamente la metodologia pedagogica definita nella fonte `contesto_didattico.md` al testo integrale del romanzo caricato come fonte del taccuino.

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

Nel Piano elenca tutti i blocchi del romanzo e assegna a ciascuno l'attività speciale della Sezione 5 secondo la regola di rotazione di `contesto_didattico.md` (tutte le sei tipologie prima di ripeterne una, mai la stessa tipologia in due blocchi consecutivi). Nei blocchi successivi rispetta sempre questa assegnazione.

---

### FASE 2: Template Obbligatorio per Ciascuna Scheda (`blocco_XX_esercizi.md`)

**Regole di compilazione** (da applicare, non da trascrivere nella scheda):
- **Titolo dell'unità** (riga `### Unità Didattica …`): solo il titolo del primo e dell'ultimo capitolo del blocco, in corsivo e separati da un trattino lungo (es. `*La chiesa vecchia* – *Il secondo biglietto*`). Non scrivere i numeri dei capitoli e non elencare i capitoli intermedi.
- **Sezione 1.A:** esattamente 5 domande numerate da 1 a 5, ciascuna con la stessa struttura della domanda 1 e seguita da 3 righe di scrittura.
- **Sezione 1.B:** esattamente 5 affermazioni (2 vere e 3 false, oppure 3 vere e 2 false).
- **Sezione 2:** esattamente 2 domande numerate (1 e 2), ciascuna seguita da 3 righe di scrittura.
- **Sezione 4:** 5 termini realmente presenti nei capitoli del blocco, con le definizioni A-E in ordine mescolato.
- **Sezione 5:** l'attività speciale assegnata a questo blocco nel Piano delle Unità Didattiche.
- Sostituisci tutti i segnaposto tra parentesi quadre, tranne le caselle `[ ]` e `[   ]` e il riquadro `[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]`.

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

### A. Domande a risposta aperta
*Rispondi in modo completo, motivando le tue risposte con riferimenti precisi al testo.*

1. **[Titolo breve della domanda]:** [Testo della domanda inferenziale/causa-effetto]

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

### B. Vero o Falso? (Attenzione ai dettagli)
*Indica se l'affermazione è Vera [V] o Falsa [F]. Correggi e motiva le affermazioni false sulle righe sottostanti.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. [Prima affermazione] | [ ] | [ ] |
| 2. [Seconda affermazione] | [ ] | [ ] |
| 3. [Terza affermazione] | [ ] | [ ] |
| 4. [Quarta affermazione] | [ ] | [ ] |
| 5. [Quinta affermazione] | [ ] | [ ] |

**Correzione delle affermazioni false:**  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

## 2. Analisi dei Personaggi e Riflessione

1. **[Titolo breve dell'analisi]:** [Domanda approfondita su conflitti interiori, scelte etiche o evoluzione del personaggio]

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

## 3. Officina di Scrittura Creativa ed Empatia

*Mettiti nei panni di uno dei protagonisti.*

[Consegna creativa in prima persona: pagina di diario, lettera o monologo interiore]

_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

## 4. Laboratorio Lessicale e Modi di Dire

*Associa ciascun vocabolo o espressione d'autore al suo significato nel contesto del racconto.*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :--- |
| 1. **[Termine 1]** | [   ] | A. [Definizione mescolata] |
| 2. **[Termine 2]** | [   ] | B. [Definizione mescolata] |
| 3. **[Termine 3]** | [   ] | C. [Definizione mescolata] |
| 4. **[Termine 4]** | [   ] | D. [Definizione mescolata] |
| 5. **[Termine 5]** | [   ] | E. [Definizione mescolata] |

## 5. Attività Speciale "Fuori dagli Schemi"

**[Titolo dell'attività speciale assegnata a questo blocco nel Piano delle Unità Didattiche]**  
[Spiegazione chiara della sfida laboratoriale, mappa, indagine o dibattito. Se l'attività prevede una parte grafica o uno schema, inserisci la riga seguente:]

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
[Sinossi puntuale degli eventi del blocco e coordinate tematiche]

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte:** [Risposta modello per ciascuna delle 5 domande]
- **1.B Vero o Falso:** [Es. 1. V; 2. F (correzione...); 3. V; 4. F (correzione...); 5. F (correzione...)]
- **2. Analisi dei Personaggi:** [Elementi chiave della riflessione attesa per ciascuna delle 2 domande]
- **3. Officina di Scrittura:** [Criteri di valutazione della produzione scritta]
- **4. Laboratorio Lessicale:** [Combinazione corretta mescolata, es. 1-C, 2-E, 3-A, 4-B, 5-D]
- **5. Attività Speciale:** [Indicazioni pratiche di conduzione in classe e criteri di valutazione]

[[FINE]]

---

### VINCOLI TECNICI TASSATIVI PER IL PARSER WEB:
1. **ZERO blocchi di codice:** non racchiudere mai la scheda o parti di essa tra tripli apici inversi. Scrivi direttamente in Markdown normale.
2. **ZERO ASCII-art:** non disegnare mai scatole o cornici con caratteri testuali (`+---+`, `| |`, `===`).
3. **ZERO HTML:** non usare tag HTML né entità come `&nbsp;`.
4. **Marcatori esatti:** usa sempre righe di soli trattini bassi `_________________________________________________________________________________________` (ciascuna su una riga propria) per le righe di scrittura, `[   ]` nella colonna Abbinamento del lessico, `[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]` per i riquadri da disegno, `### GUIDA E RIASSUNTO PER IL DOCENTE` per separare la guida insegnante e le righe `[[FILE: ...]]` / `[[FINE]]` per delimitare ogni file.

Inizia ora con il file `dati_libro.md` (Fase 1) e la scheda del **Blocco 1**.
