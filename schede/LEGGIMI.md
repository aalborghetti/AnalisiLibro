# Schede pronte

In questa cartella si pubblicano i **file di lavoro** (`.zip`) dei libri già preparati. L'app li elenca automaticamente in **📚 I miei libri → Schede pronte**, e chiunque apra il sito può caricarli con un clic.

## Come aggiungere un libro

1. Nell'app, con il libro aperto, premi **💾 Salva lavoro**: viene scaricato un file come `Titolo_del_libro_lavoro.zip`.
2. Su GitHub apri questa cartella `schede/` e scegli **Add file → Upload files**, poi trascina il file `.zip` e conferma con **Commit changes**.
3. Dopo un paio di minuti il libro compare tra le schede pronte: il workflow di pubblicazione aggiorna da solo il file `elenco.json` di questa cartella (con un commit automatico) e pubblica il sito.

Il nome del file viene mostrato come titolo, senza estensione e con gli spazi al posto dei trattini bassi: scegli un nome chiaro, ad esempio `Il_barone_rampante_lavoro.zip`.

Sono accettati anche gli zip che contengono direttamente `dati_libro.md` e i file `blocco_XX_esercizi.md`.

## Il file `elenco.json`

L'app legge l'elenco degli zip da `elenco.json`. Su GitHub viene rigenerato automaticamente; su altri hosting si può rigenerare con `node scripts/genera-elenco-schede.js` oppure scriverlo a mano con i nomi dei file, ad esempio:

```json
["Il_barone_rampante_lavoro.zip", "I lucci della via lago.zip"]
```

> [!WARNING]
> I file pubblicati qui sono visibili a chiunque visiti il sito. Le schede contengono citazioni del libro: verifica di poterle condividere pubblicamente.
