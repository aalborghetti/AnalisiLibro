# Schede pronte

In questa cartella si pubblicano i **file di lavoro** (`.zip`) dei libri già preparati. L'app li elenca automaticamente in **📚 I miei libri → Schede pronte**, e chiunque apra il sito può caricarli con un clic.

## Come aggiungere un libro

1. Nell'app, con il libro aperto, premi **💾 Salva lavoro**: viene scaricato un file come `Titolo_del_libro_lavoro.zip`.
2. Su GitHub apri questa cartella `schede/` e scegli **Add file → Upload files**, poi trascina il file `.zip` e conferma con **Commit changes**.
3. Dopo un paio di minuti (il tempo di pubblicazione del sito) il libro compare tra le schede pronte.

Il nome del file viene mostrato come titolo, senza estensione e con gli spazi al posto dei trattini bassi: scegli un nome chiaro, ad esempio `Il_barone_rampante_lavoro.zip`.

Sono accettati anche gli zip che contengono direttamente `dati_libro.md` e i file `blocco_XX_esercizi.md`.

## Siti non ospitati su GitHub Pages

Su altri hosting l'elenco automatico non è disponibile: aggiungi in questa cartella un file `elenco.json` con i nomi dei file, ad esempio:

```json
["Il_barone_rampante_lavoro.zip", "Le luci della via lago.zip"]
```

> [!WARNING]
> I file pubblicati qui sono visibili a chiunque visiti il sito. Le schede contengono citazioni del libro: verifica di poterle condividere pubblicamente.
