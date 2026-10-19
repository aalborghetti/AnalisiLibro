Applica rigorosamente la metodologia pedagogica definita nella fonte `contesto_didattico.md` al testo integrale del romanzo caricato nel taccuino.

Il tuo compito è generare il materiale didattico in formato **Markdown puro**, rispettando al millimetro i marcatori strutturali richiesti dal parser dell'applicazione web di stampa.

---

### PIANO DI ESECUZIONE PROGRESSIVA (ANTI-TRONCAMENTO)
Per garantire la massima qualità ed evitare tagli dovuti ai limiti di lunghezza delle risposte:
1. **In questa prima risposta**, genera **esclusivamente**:
   - La **FASE 1** completa (il file `dati_libro.md` e la **Mappatura generale di tutti i blocchi** del romanzo).
   - La scheda didattica completa del solo **Blocco 1**.
2. Al termine del Blocco 1 **FERMATI** e attendi il mio comando *"Procedi con il Blocco successivo"* per generare i blocchi seguenti uno alla volta.

---

### FASE 1: Metadati (`dati_libro.md`) e Mappatura Blocchi

Genera per primo il blocco anagrafico con questa esatta struttura:

# Dati del Libro
- **Titolo:** [Titolo completo del romanzo]
- **Autore:** [Nome e cognome dell'autore]
- **Anno di pubblicazione:** [Anno di prima edizione]
- **Editore:** [Casa editrice]
- **Genere:** [Genere letterario]
- **Ambientazione:** [Luogo ed epoca della vicenda]
- **Target scolastico:** Scuola secondaria di primo grado (11-13 anni)
- **Unità didattiche:** [Numero complessivo di blocchi previsti]

Subito dopo, elenca il **Piano delle Unità Didattiche** (Blocco 1, Blocco 2, ecc.) indicando per ciascuno i capitoli inclusi e il nucleo tematico pedagogico.

---

### FASE 2: Template Obbligatorio per Ciascuna Scheda (`blocco_XX_esercizi.md`)

Genera ciascuna scheda didattica seguendo **esattamente** questi titoli, segnaposto e livelli di intestazione (`#`, `##`, `###`):

# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *[Titolo del Romanzo]* di [Autore]
### Unità Didattica [X] (Blocco [X]): *[Capitolo Iniziale]* – *[Capitolo Finale]*

---

**Nome e Cognome dello studente:** ________________________________________  
**Classe:** ____________________  **Data:** ____________________  

---

> ### 🌊 [Titolo evocativo per l'introduzione]
> [Breve citazione dal testo o messaggio motivazionale di benvenuto nei capitoli del blocco]

---

## 1. Comprensione del Testo

### A. Domande a risposta aperta
*Rispondi in modo completo, motivando le tue risposte con riferimenti precisi al testo.*

1. **[Titolo breve 1ª domanda]:** [Testo della domanda inferenziale/causa-effetto]

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

*(Prosegui con le domande 2, 3, 4 e 5, inserendo sempre 3 righe di trattini bassi sotto ciascuna domanda)*

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

1. **[Titolo breve analisi]:** [Domanda approfondita su conflitti interiori, scelte etiche o evoluzione del personaggio]

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
| 1. **[Termine 1]** | [ &nbsp;&nbsp; ] | A. [Definizione mescolata] |
| 2. **[Termine 2]** | [ &nbsp;&nbsp; ] | B. [Definizione mescolata] |
| 3. **[Termine 3]** | [ &nbsp;&nbsp; ] | C. [Definizione mescolata] |
| 4. **[Termine 4]** | [ &nbsp;&nbsp; ] | D. [Definizione mescolata] |
| 5. **[Termine 5]** | [ &nbsp;&nbsp; ] | E. [Definizione mescolata] |

## 5. Attività Speciale "Fuori dagli Schemi"

**[Titolo dell'attività speciale scelta a rotazione dal catalogo di `contesto_didattico.md`]**  
[Spiegazione chiara della sfida laboratoriale, mappa, indagine o dibattito. Se l'attività prevede una parte grafica o uno schema, inserisci la riga seguente:]

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
[Sinossi puntuale degli eventi del blocco e coordinate tematiche]

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte:** [Risposte modello per ciascun quesito 1-5]
- **1.B Vero o Falso:** [Es. 1. V; 2. F (correzione...); 3. V; 4. F (correzione...); 5. F (correzione...)]
- **2. Analisi dei Personaggi:** [Elementi chiave della riflessione attesa]
- **4. Laboratorio Lessicale:** [Combinazione corretta mescolata, es. 1-C, 2-E, 3-A, 4-B, 5-D]
- **5. Attività Speciale:** [Indicazioni pratiche di conduzione in classe e criteri di valutazione]

---

### VINCOLI TECNICI TASSATIVI PER IL PARSER WEB:
1. **ZERO blocchi di codice (` ``` `):** Non racchiudere mai la scheda o parti di essa dentro blocchi con triplo apice inverso. Scrivi direttamente in Markdown normale.
2. **ZERO ASCII-art:** Non disegnare mai scatole o cornici con caratteri testuali (`+---+`, `| |`, `===`).
3. **Marcatori esatti:** Usa sempre `_________________________________________________________________________________________` per le righe di scrittura, `[ &nbsp;&nbsp; ]` nella colonna centrale del lessico, `[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]` per i riquadri da disegno e `### GUIDA E RIASSUNTO PER IL DOCENTE` per separare la guida insegnante.

Inizia ora con la **Fase 1** completa e la scheda del **Blocco 1**.