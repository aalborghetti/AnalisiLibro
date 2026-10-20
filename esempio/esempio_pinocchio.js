/**
 * Libro di esempio per la guida rapida: "Le avventure di Pinocchio" di Carlo Collodi (pubblico dominio).
 * Due unità didattiche (capitoli I-VII) scritte secondo il template di prompt.md.
 * È un file script (non .md) perché deve funzionare anche aprendo l'app direttamente dal disco.
 */
(function () {
  const RIGA = '_'.repeat(89) + '  ';
  const righe = (n) => Array(n).fill(RIGA).join('\n');
  const righeRientrate = (n) => Array(n).fill('   ' + RIGA).join('\n');

  const datiLibro = `# Dati del Libro
- **Titolo:** Le avventure di Pinocchio. Storia di un burattino
- **Autore:** Carlo Collodi
- **Anno di pubblicazione:** 1883
- **Editore:** Felice Paggi, Firenze
- **Genere:** Romanzo di formazione, fiaba
- **Ambientazione:** Un paese immaginario della Toscana, seconda metà dell'Ottocento
- **Target scolastico:** Scuola secondaria di primo grado (11-13 anni)
- **Unità didattiche:** 2 (esempio dimostrativo sui capitoli I-VII)

## Piano delle Unità Didattiche
- **Blocco 1** — Capitoli: I-III · Nucleo tematico: la nascita di Pinocchio, il rapporto padre-figlio e le prime disobbedienze · Attività speciale: Mappa topografica
- **Blocco 2** — Capitoli: IV-VII · Nucleo tematico: i consigli ignorati, la fame e il perdono di Geppetto · Attività speciale: Processo in aula
`;

  const blocco01 = `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *Le avventure di Pinocchio* di Carlo Collodi
### Unità Didattica 1 (Blocco 1): *Capitolo I* – *Capitolo III*

---

> ### 🪵 C'era una volta… un pezzo di legno
> «C'era una volta… – Un re! – diranno subito i miei piccoli lettori. No, ragazzi, avete sbagliato. C'era una volta un pezzo di legno.» Preparati a scoprire come un semplice ciocco da bruciare diventa il burattino più famoso del mondo.

---

## 1. Comprensione del Testo

### A. Domande a risposta aperta
*Rispondi in modo completo, motivando le tue risposte con riferimenti precisi al testo.*

1. **La paura di Maestro Ciliegia:** Dopo aver sentito la vocina uscire dal legno, Maestro Ciliegia decide di regalarlo a Geppetto senza raccontargli che cosa è successo. Perché secondo te si comporta così? Che cosa rivela questa scelta del suo carattere?

${righeRientrate(3)}

2. **Il soprannome «Polendina»:** Perché Geppetto si arrabbia tanto quando sente la parola «Polendina»? Chi l'ha pronunciata davvero, e quali conseguenze ha l'equivoco tra i due falegnami?

${righeRientrate(3)}

3. **Il nome del burattino:** Geppetto sceglie il nome Pinocchio pensando a una famiglia di Pinocchi in cui «il più ricco chiedeva l'elemosina», eppure dice che quel nome «gli porterà fortuna». Che cosa rivela questa scelta delle speranze di Geppetto?

${righeRientrate(3)}

4. **Un burattino non ancora finito:** Mentre Geppetto lo sta ancora intagliando, Pinocchio ride di lui, gli prende la parrucca e lo prende a calci. Perché Geppetto si sente ferito più dal comportamento del burattino che dai gesti in sé?

${righeRientrate(3)}

5. **La folla e il carabiniere:** Alla fine del capitolo III è Geppetto, e non Pinocchio, a essere portato in prigione. Quale ruolo hanno le chiacchiere della gente in questa decisione? Ti sembra una decisione giusta?

${righeRientrate(3)}

### B. Vero o Falso? (Attenzione ai dettagli)
*Indica se l'affermazione è Vera [V] o Falsa [F]. Correggi e motiva le affermazioni false sulle righe sottostanti.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. Maestro Ciliegia vuole usare il pezzo di legno per farne una gamba di tavolino. | [ ] | [ ] |
| 2. Il pezzo di legno è un legno pregiato, destinato a costruire mobili di lusso. | [ ] | [ ] |
| 3. Geppetto vuole un burattino che sappia ballare e tirare di scherma, per girare il mondo e guadagnarsi da vivere. | [ ] | [ ] |
| 4. Appena terminato, Pinocchio ringrazia Geppetto e lo abbraccia. | [ ] | [ ] |
| 5. Alla fine del capitolo III il carabiniere porta in prigione Pinocchio. | [ ] | [ ] |

**Correzione delle affermazioni false:**
${righe(3)}

## 2. Analisi dei Personaggi e Riflessione

1. **Le due facce di Geppetto:** Geppetto è povero, si arrabbia facilmente, ma sa anche fare pace e perdonare. Quali episodi dei capitoli I-III mostrano queste diverse facce del suo carattere?

${righeRientrate(3)}

2. **Cattivo o soltanto nuovo al mondo?** Pinocchio disobbedisce ancora prima di essere finito. Secondo te è «cattivo» oppure non sa ancora che cosa significa essere un figlio? Motiva la tua risposta con esempi dal testo.

${righeRientrate(3)}

## 3. Officina di Scrittura Creativa ed Empatia

*Mettiti nei panni di uno dei protagonisti.*

Sei Geppetto e trascorri la tua prima notte in prigione. Scrivi una pagina di diario: racconta come ti senti, che cosa pensi del burattino che hai appena costruito con tanta fatica e che cosa vorresti dirgli quando lo rivedrai.

${righe(5)}

## 4. Laboratorio Lessicale e Modi di Dire

*Associa ciascun vocabolo o espressione d'autore al suo significato nel contesto del racconto.*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :--- |
| 1. **pezzo da catasta** | [   ] | A. Di colore rosso cupo, tendente al viola |
| 2. **paonazza** | [   ] | B. Parlare piano, tra sé e sé, in modo poco chiaro |
| 3. **pialla** | [   ] | C. Spazio ricavato sotto una rampa di scale |
| 4. **borbottare a mezza voce** | [   ] | D. Legno comune, ammucchiato per essere bruciato nella stufa o nel camino |
| 5. **sottoscala** | [   ] | E. Attrezzo del falegname per rendere liscio il legno |

## 5. Attività Speciale "Fuori dagli Schemi"

**Mappa Topografica: i luoghi della nascita di Pinocchio**
Disegna la mappa dei luoghi dei capitoli I-III: la bottega di Maestro Ciliegia, la stanzina di Geppetto (con il caminetto dipinto sul muro) e la strada in cui Pinocchio scappa e viene fermato dal carabiniere. Segna con una freccia il percorso di Geppetto e quello della fuga di Pinocchio e completa la legenda con i tre eventi principali, citando per ciascuno una frase del testo.

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
Maestro Ciliegia sta per trasformare un comune pezzo di legno in una gamba di tavolino, quando dal legno esce una vocina che si lamenta dei colpi e ride del solletico della pialla: il falegname sviene dallo spavento. Arriva Geppetto, deciso a costruirsi un burattino meraviglioso per girare il mondo; la vocina lo chiama «Polendina» e i due vecchi, credendosi insultati a vicenda, litigano due volte prima di fare pace. Nella sua povera stanzina Geppetto intaglia il burattino e lo chiama Pinocchio: il burattino lo deride, gli prende la parrucca, lo prende a calci e, appena impara a camminare, scappa in strada. Un carabiniere lo ferma, ma le chiacchiere della folla, che accusa Geppetto di essere severo con i ragazzi, fanno sì che sia proprio Geppetto a finire in prigione.
Coordinate tematiche: la paternità e l'attesa di un figlio; la disobbedienza come prima forma di libertà; il giudizio superficiale degli altri.

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte:** 1) Maestro Ciliegia ha paura e vuole liberarsi di un oggetto misterioso; tacere la verità mostra un carattere pauroso e un po' furbo. 2) Geppetto è suscettibile perché il soprannome deriva dalla parrucca gialla come la polenta; a pronunciarlo è la vocina del legno, ma ognuno dei due falegnami crede che sia stato l'altro, e l'equivoco porta alla lite. 3) Il nome contiene l'ironia della povertà ma anche la speranza di un padre che desidera un futuro migliore per il figlio. 4) Geppetto soffre per la mancanza di rispetto e di affetto di un «figlio» che non è neppure finito. 5) La folla giudica dalle apparenze e il carabiniere si lascia convincere: è un'ingiustizia che anticipa il tema della fiducia mal riposta.
- **1.B Vero o Falso:** 1. V; 2. F (è un semplice pezzo da catasta, da bruciare nelle stufe e nei caminetti); 3. V; 4. F (ride di Geppetto, gli prende la parrucca, lo prende a calci e scappa); 5. F (in prigione finisce Geppetto, mentre Pinocchio viene lasciato andare).
- **2. Analisi dei Personaggi:** 1) Povertà: la stanzina con il fuoco dipinto; irascibilità: le due liti con Maestro Ciliegia; capacità di perdonare: la pace e il giuramento di amicizia. 2) Valorizzare le risposte che distinguono la cattiveria dall'inesperienza: Pinocchio agisce d'istinto, senza conoscere le regole e le conseguenze.
- **3. Officina di Scrittura:** Coerenza con il punto di vista di Geppetto (tristezza, senso di ingiustizia, affetto che resiste); uso della prima persona; riferimenti agli eventi del blocco; ricchezza lessicale.
- **4. Laboratorio Lessicale:** 1-D, 2-A, 3-E, 4-B, 5-C.
- **5. Attività Speciale:** Lavoro individuale o a coppie (30-40 minuti). Valutare la correttezza dei luoghi e della sequenza degli eventi, la chiarezza della legenda e la pertinenza delle citazioni scelte.
`;

  const blocco02 = `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *Le avventure di Pinocchio* di Carlo Collodi
### Unità Didattica 2 (Blocco 2): *Capitolo IV* – *Capitolo VII*

---

> ### 🦗 La voce del Grillo-parlante
> «Guai a quei ragazzi che si ribellano ai loro genitori e che abbandonano capricciosamente la casa paterna!» Pinocchio scoprirà presto che i consigli ascoltati a malincuore hanno spesso ragione.

---

## 1. Comprensione del Testo

### A. Domande a risposta aperta
*Rispondi in modo completo, motivando le tue risposte con riferimenti precisi al testo.*

1. **Il martello contro il Grillo:** Perché Pinocchio reagisce ai consigli del Grillo-parlante scagliandogli contro un martello di legno? Che cosa non vuole sentirsi dire?

${righeRientrate(3)}

2. **La fame che cresce:** Come cambia il comportamento di Pinocchio man mano che la fame aumenta? Che cosa capisce, per la prima volta, ripensando alle parole del Grillo?

${righeRientrate(3)}

3. **Una notte in paese:** Come viene accolto Pinocchio quando, di notte e sotto il temporale, suona a una porta per chiedere un po' di pane? Perché secondo te nessuno lo aiuta?

${righeRientrate(3)}

4. **I piedi bruciati:** Come perde i piedi Pinocchio e perché non se ne accorge? Che cosa ci dice questo episodio della sua capacità di prendersi cura di sé?

${righeRientrate(3)}

5. **Le tre pere:** Pinocchio pretende che le pere siano sbucciate, ma alla fine mangia anche bucce e torsoli. Che cosa ha imparato? Quale insegnamento vuole dargli Geppetto?

${righeRientrate(3)}

### B. Vero o Falso? (Attenzione ai dettagli)
*Indica se l'affermazione è Vera [V] o Falsa [F]. Correggi e motiva le affermazioni false sulle righe sottostanti.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. Il Grillo-parlante abita nella stanza di Geppetto da più di cento anni. | [ ] | [ ] |
| 2. Pinocchio dice al Grillo che il mestiere che preferisce è andare a scuola e studiare. | [ ] | [ ] |
| 3. Nella pentola sul fuoco Pinocchio trova una minestra ancora calda. | [ ] | [ ] |
| 4. Dall'uovo che Pinocchio trova esce un pulcino che lo ringrazia e vola via. | [ ] | [ ] |
| 5. Tornato dalla prigione, Geppetto si rifiuta di dare da mangiare a Pinocchio per punirlo. | [ ] | [ ] |

**Correzione delle affermazioni false:**
${righe(3)}

## 2. Analisi dei Personaggi e Riflessione

1. **Sapere e non fare:** Pinocchio capisce che il Grillo aveva ragione, ma non riesce ancora a comportarsi di conseguenza. Come cambia il suo atteggiamento tra il capitolo IV e il capitolo VII? Ti è mai capitato qualcosa di simile?

${righeRientrate(3)}

2. **Il perdono di Geppetto:** Geppetto è appena uscito di prigione per colpa di Pinocchio, eppure gli regala la sua colazione. Perché secondo te si comporta così? Che tipo di padre ci mostra Collodi?

${righeRientrate(3)}

## 3. Officina di Scrittura Creativa ed Empatia

*Mettiti nei panni di uno dei protagonisti.*

Sei Pinocchio. Dopo la notte della fame e dei piedi bruciati, scrivi una lettera di scuse al Grillo-parlante: spiegagli perché hai reagito in quel modo, che cosa hai capito e che cosa vorresti promettergli.

${righe(5)}

## 4. Laboratorio Lessicale e Modi di Dire

*Associa ciascun vocabolo o espressione d'autore al suo significato nel contesto del racconto.*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :--- |
| 1. **fare il vagabondo** | [   ] | A. Recipiente di metallo pieno di brace accesa, usato per scaldarsi |
| 2. **avere la testa di legno** | [   ] | B. Passare il tempo girovagando, senza impegni né lavoro |
| 3. **uggiolina allo stomaco** | [   ] | C. Parte centrale e dura del frutto, che contiene i semi |
| 4. **caldano** | [   ] | D. Essere testardi e poco giudiziosi, non ascoltare i consigli |
| 5. **torsolo** | [   ] | E. Leggero languore, primo segnale della fame |

## 5. Attività Speciale "Fuori dagli Schemi"

**Processo in Aula: Pinocchio è colpevole?**
La classe si divide in due collegi. L'Accusa sostiene che Pinocchio è responsabile della morte del Grillo-parlante e dei guai di Geppetto; la Difesa sostiene che è un burattino appena nato, affamato e senza esperienza. Ogni collegio raccoglie almeno tre prove dal testo (citazioni con il numero del capitolo), prepara un'arringa di due minuti e una domanda per la parte avversaria. Un piccolo gruppo di giurati decide la sentenza motivandola per iscritto.

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
Rientrato a casa, Pinocchio incontra il Grillo-parlante, che abita nella stanza da più di cent'anni e lo ammonisce sui ragazzi che disobbediscono ai genitori. Pinocchio dichiara che l'unico mestiere che gli piace è mangiare, bere, dormire, divertirsi e fare il vagabondo; quando il Grillo gli dice che ha la testa di legno, gli lancia contro un martello e lo uccide. Viene la notte e con essa la fame: Pinocchio scopre che la pentola sul fuoco è dipinta sul muro, trova un uovo ma ne esce un pulcino che vola via, e per la prima volta ammette che il Grillo aveva ragione. Sotto un temporale va in paese a chiedere del pane, ma riceve solo una catinella d'acqua; tornato a casa si addormenta con i piedi sul caldano acceso e i piedi, che sono di legno, si bruciano. Il mattino dopo Geppetto, uscito di prigione, lo trova senza piedi e gli dona le tre pere della sua colazione: Pinocchio, dopo averle pretese sbucciate, finisce per mangiare anche bucce e torsoli.
Coordinate tematiche: il valore dei consigli; i bisogni primari e le conseguenze delle scelte; l'amore paterno che perdona.

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte:** 1) Pinocchio rifiuta i consigli che mettono in discussione la sua libertà e lo offendono («testa di legno»): reagisce d'impulso, senza pensare alle conseguenze. 2) La fame lo rende prima agitato, poi disperato; ripensando al Grillo capisce che fuggire da casa e ribellarsi al babbo è stato un errore. 3) Viene trattato come un monello e respinto con una catinella d'acqua: di notte gli adulti diffidano, e Pinocchio non ha ancora una reputazione che ispiri fiducia. 4) Si addormenta con i piedi sul caldano; non si accorge di nulla perché i piedi sono di legno e lui è sfinito: mostra quanto sia ancora incapace di badare a se stesso. 5) Ha imparato che la fame vera non permette capricci; Geppetto gli insegna a non essere troppo delicato e schizzinoso e a non sprecare.
- **1.B Vero o Falso:** 1. V; 2. F (dice che il mestiere che preferisce è mangiare, bere, dormire, divertirsi e fare il vagabondo); 3. F (la pentola e il fuoco sono dipinti sul muro); 4. V; 5. F (Geppetto gli regala le tre pere della sua colazione).
- **2. Analisi dei Personaggi:** 1) Dal rifiuto violento del consiglio (cap. IV) al pentimento nella fame (cap. V) e all'accettazione dell'insegnamento delle pere (cap. VII): il cambiamento è iniziato ma è ancora fragile. Valorizzare i collegamenti con l'esperienza personale. 2) Geppetto antepone l'amore e il bisogno del figlio al proprio orgoglio: è un padre povero ma generoso, che educa con l'esempio più che con la punizione.
- **3. Officina di Scrittura:** Forma della lettera (destinatario, saluti, firma); sincerità del pentimento; riferimenti precisi agli eventi del blocco; promessa coerente con il carattere di Pinocchio.
- **4. Laboratorio Lessicale:** 1-B, 2-D, 3-E, 4-A, 5-C.
- **5. Attività Speciale:** Durata consigliata: due ore (preparazione e dibattito). Valutare la pertinenza delle prove testuali, la chiarezza dell'arringa, il rispetto dei turni di parola e la motivazione della sentenza.
`;

  window.ESEMPIO_LIBRO = [
    { filename: 'dati_libro.md', markdown: datiLibro },
    { filename: 'blocco_01_esercizi.md', markdown: blocco01 },
    { filename: 'blocco_02_esercizi.md', markdown: blocco02 }
  ];
})();
