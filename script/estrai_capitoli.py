#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Estrattore Universale di Testo da file EPUB per Progetti Didattici.
Supporta standard EPUB 2 ed EPUB 3, architetture a file multipli (XHTML separati)
e architetture a file unico (monolitiche con ancore interne/TOC).
"""

import sys
import os
import argparse
import zipfile
import re
import posixpath
import html
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

# Assicura compatibilità di codifica con terminali Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


def get_opf_path(z: zipfile.ZipFile) -> str:
    """Individua il percorso del file OPF tramite META-INF/container.xml conforme alle specifiche EPUB."""
    try:
        container_xml = z.read('META-INF/container.xml')
        root = ET.fromstring(container_xml)
        ns = {'c': 'urn:oasis:names:tc:opendocument:xmlns:container'}
        rootfile = root.find('.//c:rootfile', ns)
        if rootfile is not None and 'full-path' in rootfile.attrib:
            return rootfile.attrib['full-path']
    except Exception:
        pass
    
    # Fallback euristico: cerca file con estensione .opf nell'archivio
    for name in z.namelist():
        if name.endswith('.opf'):
            return name
            
    raise FileNotFoundError("Impossibile trovare il file descrittore del pacchetto (.opf) nell'EPUB.")


def parse_toc(z: zipfile.ZipFile, opf_dir: str, opf_root: ET.Element) -> list:
    """
    Estrae l'indice (TOC) dell'EPUB, cercando prima EPUB3 Navigation Document
    e poi EPUB2 NCX (toc.ncx).
    Restituisce una lista di tuple: (titolo, file_relativo, id_ancora).
    """
    entries = []
    ns_opf = {'opf': 'http://www.idpf.org/2007/opf'}
    
    # Cerca nel manifest riferimenti al TOC
    manifest = opf_root.find('opf:manifest', ns_opf)
    if manifest is None:
        manifest = opf_root.find('manifest')
    
    nav_href = None
    ncx_href = None
    
    if manifest is not None:
        for item in manifest:
            props = item.attrib.get('properties', '')
            media_type = item.attrib.get('media-type', '')
            item_id = item.attrib.get('id', '')
            href = item.attrib.get('href', '')
            
            if 'nav' in props:
                nav_href = href
            elif media_type == 'application/x-dtbncx+xml' or item_id in ('ncx', 'toc'):
                ncx_href = href
                
    # 1. Tentativo con EPUB2 NCX
    if ncx_href:
        full_ncx = posixpath.normpath(posixpath.join(opf_dir, ncx_href)) if opf_dir else ncx_href
        if full_ncx in z.namelist():
            try:
                ncx_xml = z.read(full_ncx)
                root_ncx = ET.fromstring(ncx_xml)
                ns_ncx = {'ncx': 'http://www.daisy.org/z3986/2005/ncx/'}
                for navpoint in root_ncx.findall('.//ncx:navPoint', ns_ncx):
                    lbl = navpoint.find('ncx:navLabel/ncx:text', ns_ncx)
                    cnt = navpoint.find('ncx:content', ns_ncx)
                    if lbl is not None and cnt is not None:
                        title = (lbl.text or '').strip()
                        src = cnt.attrib.get('src', '')
                        # src può essere 'cap1.xhtml#filepos123' o 'cap1.xhtml'
                        parts = src.split('#')
                        f_rel = parts[0]
                        anchor = parts[1] if len(parts) > 1 else ''
                        full_f = posixpath.normpath(posixpath.join(opf_dir, f_rel)) if opf_dir else f_rel
                        entries.append((title, full_f, anchor))
            except Exception as e:
                print(f"Nota: lettura NCX fallita ({e}), proseguo con altri metodi.")

    # 2. Tentativo con EPUB3 nav.xhtml se NCX non ha prodotto voci
    if not entries and nav_href:
        full_nav = posixpath.normpath(posixpath.join(opf_dir, nav_href)) if opf_dir else nav_href
        if full_nav in z.namelist():
            try:
                nav_html = z.read(full_nav).decode('utf-8', errors='ignore')
                soup = BeautifulSoup(nav_html, 'html.parser')
                nav_tag = soup.find('nav', attrs={'epub:type': 'toc'}) or soup.find('nav')
                if nav_tag:
                    for a in nav_tag.find_all('a'):
                        title = a.get_text().strip()
                        href = a.get('href', '')
                        parts = href.split('#')
                        f_rel = parts[0]
                        anchor = parts[1] if len(parts) > 1 else ''
                        full_f = posixpath.normpath(posixpath.join(posixpath.dirname(full_nav), f_rel))
                        entries.append((title, full_f, anchor))
            except Exception as e:
                print(f"Nota: lettura NAV fallita ({e}).")

    return entries


def clean_html_content(raw_html: str) -> str:
    """
    Pulisce il testo HTML convertendolo in testo formattato e scorrevole:
    - Rimuove tag non testuali (immagini, stili, script, svg).
    - Ripara le parole spezzate da sillabazione tipografica a fine riga.
    - Rimuove i numeri di pagina isolati o a fine paragrafo tipici della scansione cartacea.
    - Ricongiunge i periodi spezzati da cambi pagina forzati.
    """
    soup = BeautifulSoup(raw_html, 'html.parser')
    
    # Rimuove elementi grafici e di stile
    for tag in soup.find_all(['img', 'style', 'script', 'svg', 'audio', 'video']):
        tag.decompose()

    # Raccoglie i blocchi di testo
    elements = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'blockquote', 'li'])
    raw_paragraphs = [el.get_text().strip() for el in elements if el.get_text().strip()]
    
    cleaned_paragraphs = []
    i = 0
    while i < len(raw_paragraphs):
        p = raw_paragraphs[i]
        
        # Elimina numeri di pagina isolati (es. "11", "24")
        if p.isdigit() and len(p) <= 3:
            i += 1
            continue
            
        # Gestisce numeri di pagina uniti con trattino (es. "pic-13", "som-19")
        m_hyphen = re.search(r'^(.*?)-(\d{1,3})$', p)
        if m_hyphen:
            stem = m_hyphen.group(1).rstrip()
            if i + 1 < len(raw_paragraphs):
                raw_paragraphs[i + 1] = stem + raw_paragraphs[i + 1]
                i += 1
                continue
            else:
                p = stem

        # Elimina numeri di pagina posti a fine riga/paragrafo (es. "prima che 16")
        m_space = re.search(r'^(.*?)\s+(\d{1,3})$', p)
        if m_space:
            text_part = m_space.group(1).rstrip()
            if i + 1 < len(raw_paragraphs) and not text_part.endswith(('.', '!', '?', '»', '"', '”', '…', ':')):
                next_p = raw_paragraphs[i + 1]
                if text_part.endswith('-'):
                    joined = text_part[:-1] + next_p
                else:
                    joined = text_part + ' ' + next_p
                raw_paragraphs[i + 1] = joined
                i += 1
                continue
            else:
                p = text_part

        # Ricongiunge frasi spezzate da cambio pagina che finiscono con preposizioni o articoli
        if (i + 1 < len(raw_paragraphs) and 
            not p.endswith(('.', '!', '?', '»', '"', '”', '…', ':', '—', '–', '-')) and
            not raw_paragraphs[i + 1].startswith(('«', '"', '“', '—', '–', '-'))):
            words = p.split()
            preps_articles = (
                'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
                'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
                'che', 'e', 'ed', 'o', 'od', 'ma', 'se',
                'del', 'dello', 'della', 'dei', 'degli', 'delle',
                'al', 'allo', 'alla', 'ai', 'agli', 'alle',
                'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
                'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
                'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle'
            )
            if words and words[-1].lower() in preps_articles:
                raw_paragraphs[i + 1] = p + ' ' + raw_paragraphs[i + 1]
                i += 1
                continue

        # Ripara sillabazione interna a parole minuscole (es. cop-pino -> coppino, gat-ta -> gatta)
        # Preserva i composti e nomi propri con iniziale maiuscola (es. Milano-Firenze, Italia-Polonia)
        p = re.sub(r'(\b[a-zàèéìòù]+)-([a-zàèéìòù]+\b)', r'\1\2', p)
        
        # Normalizza spazi interni multipli
        p = re.sub(r'\s{2,}', ' ', p)
        
        if p:
            cleaned_paragraphs.append(p)
        i += 1

    result_text = "\n\n".join(cleaned_paragraphs)
    result_text = re.sub(r'\n{3,}', '\n\n', result_text)
    return result_text.strip()


def extract_epub(epub_path: str, output_dir: str = "testo_capitoli"):
    """
    Funzione principale di estrazione universale.
    Estrae tutti i capitoli in formato Markdown pulito e genera il catalogo manifest.
    """
    if not os.path.exists(epub_path):
        raise FileNotFoundError(f"File EPUB non trovato: {epub_path}")

    print(f"📖 Apertura archivio EPUB: {os.path.basename(epub_path)}")
    os.makedirs(output_dir, exist_ok=True)

    with zipfile.ZipFile(epub_path, 'r') as z:
        opf_file = get_opf_path(z)
        opf_dir = posixpath.dirname(opf_file)
        opf_xml = z.read(opf_file)
        opf_root = ET.fromstring(opf_xml)

        ns_opf = {'opf': 'http://www.idpf.org/2007/opf'}
        
        # 1. Recupero metadati titolo e autore
        title_el = opf_root.find('.//{http://purl.org/dc/elements/1.1/}title')
        creator_el = opf_root.find('.//{http://purl.org/dc/elements/1.1/}creator')
        book_title = title_el.text if title_el is not None and title_el.text else "Libro"
        book_author = creator_el.text if creator_el is not None and creator_el.text else "Autore Sconosciuto"
        print(f"ℹ️  Titolo: {book_title} | Autore: {book_author}")

        # 2. Mappatura Manifest e Spine
        manifest_map = {}
        manifest_tag = opf_root.find('opf:manifest', ns_opf)
        if manifest_tag is None:
            manifest_tag = opf_root.find('manifest')
        if manifest_tag is not None:
            for item in manifest_tag:
                i_id = item.attrib.get('id')
                i_href = item.attrib.get('href')
                if i_id and i_href:
                    full_p = posixpath.normpath(posixpath.join(opf_dir, i_href)) if opf_dir else i_href
                    manifest_map[i_id] = full_p

        spine_tag = opf_root.find('opf:spine', ns_opf)
        if spine_tag is None:
            spine_tag = opf_root.find('spine')
        spine_files = []
        if spine_tag is not None:
            for itemref in spine_tag:
                idref = itemref.attrib.get('idref')
                if idref in manifest_map:
                    spine_files.append(manifest_map[idref])

        # 3. Estrazione TOC (indice)
        toc_entries = parse_toc(z, opf_dir, opf_root)
        print(f"📑 Individuate {len(toc_entries)} voci nell'indice di navigazione.")

        chapters_extracted = []

        # Caso A: TOC disponibile con ancore all'interno dei file (es. file unico o ancore interne)
        has_internal_anchors = any(entry[2] for entry in toc_entries)

        if toc_entries and has_internal_anchors:
            # Raggruppa le ancore per file
            # Ordiniamo le voci secondo l'ordine di apparizione nell'indice
            for idx, (title, fpath, anchor) in enumerate(toc_entries):
                if fpath not in z.namelist():
                    continue
                file_html = z.read(fpath).decode('utf-8', errors='ignore')
                
                # Trova la posizione di inizio
                start_idx = 0
                if anchor:
                    # cerca id="anchor" o name="anchor"
                    m = re.search(rf'(?:id|name)=["\']{re.escape(anchor)}["\']', file_html)
                    if m:
                        start_idx = m.start()

                # Trova la posizione di fine (fino alla prossima voce nello stesso file, o fine file)
                end_idx = len(file_html)
                if idx + 1 < len(toc_entries):
                    next_title, next_fpath, next_anchor = toc_entries[idx + 1]
                    if next_fpath == fpath and next_anchor:
                        m_next = re.search(rf'(?:id|name)=["\']{re.escape(next_anchor)}["\']', file_html)
                        if m_next and m_next.start() > start_idx:
                            end_idx = m_next.start()

                chunk = file_html[start_idx:end_idx]
                clean_text = clean_html_content(chunk)

                # Rimuovi caratteri invisibili
                clean_title = re.sub(r'[\u2060\ufeff]', '', title).strip()
                if not clean_title:
                    clean_title = f"Capitolo {idx+1}"

                chapters_extracted.append((clean_title, clean_text))

        elif toc_entries and not has_internal_anchors:
            # Caso B: Ogni voce del TOC punta a un file intero diverso
            for idx, (title, fpath, _) in enumerate(toc_entries):
                if fpath in z.namelist():
                    file_html = z.read(fpath).decode('utf-8', errors='ignore')
                    clean_text = clean_html_content(file_html)
                    clean_title = re.sub(r'[\u2060\ufeff]', '', title).strip() or f"Sezione {idx+1}"
                    chapters_extracted.append((clean_title, clean_text))

        else:
            # Caso C: Fallback puro sullo Spine se non c'è TOC
            print("⚠️ Nessun indice TOC fruibile trovato: estrazione sequenziale tramite Spine.")
            for idx, fpath in enumerate(spine_files):
                if fpath in z.namelist():
                    file_html = z.read(fpath).decode('utf-8', errors='ignore')
                    clean_text = clean_html_content(file_html)
                    # Cerca eventuale titolo in h1, h2 o title
                    soup = BeautifulSoup(file_html, 'html.parser')
                    h_tag = soup.find(['h1', 'h2', 'title'])
                    heading = h_tag.get_text().strip() if h_tag else f"Sezione {idx+1}"
                    clean_title = re.sub(r'[\u2060\ufeff]', '', heading).strip()
                    chapters_extracted.append((clean_title, clean_text))

        # 4. Salvataggio su disco
        manifest_lines = []
        manifest_lines.append(f"# Indice Generale: {book_title} - {book_author}\n")
        manifest_lines.append(f"Totale sezioni/capitoli estratti: {len(chapters_extracted)}\n")
        manifest_lines.append("| N. | Titolo | File | Parole | Caratteri |")
        manifest_lines.append("| :--- | :--- | :--- | :--- | :--- |")

        count_valid = 0
        for i, (title, text_content) in enumerate(chapters_extracted):
            word_count = len(text_content.split())
            char_count = len(text_content)
            
            # Formatta nome file sicuro
            safe_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_').lower()
            if not safe_title:
                safe_title = f"capitolo_{i:02d}"
            filename = f"{i:02d}_{safe_title}.txt"
            filepath = os.path.join(output_dir, filename)

            with open(filepath, 'w', encoding='utf-8') as f_out:
                f_out.write(f"# {title}\n\n{text_content}\n")

            manifest_lines.append(f"| {i:02d} | {title} | `{filename}` | {word_count} | {char_count} |")
            count_valid += 1

        manifest_path = os.path.join(output_dir, "indice_capitoli.md")
        with open(manifest_path, 'w', encoding='utf-8') as f_man:
            f_man.write("\n".join(manifest_lines))

        print(f"✅ Estrazione completata: {count_valid} file generati in '{output_dir}'.")
        print(f"📄 Indice riepilogativo salvato in: '{manifest_path}'.")


def main():
    parser = argparse.ArgumentParser(description="Estrattore universale di capitoli da file EPUB.")
    parser.add_argument("epub", nargs="?", default=None, help="Percorso del file .epub (opzionale se presente nella cartella corrente)")
    parser.add_argument("-o", "--output-dir", default="testo_capitoli", help="Cartella di destinazione (default: testo_capitoli)")
    args = parser.parse_args()

    epub_target = args.epub

    # Auto-rilevamento se non specificato da riga di comando
    if not epub_target:
        epubs = [f for f in os.listdir('.') if f.lower().endswith('.epub')]
        if len(epubs) == 1:
            epub_target = epubs[0]
            print(f"🔍 Rilevato automaticamente file EPUB: '{epub_target}'")
        elif len(epubs) > 1:
            print("⚠️ Rilevati più file EPUB nella directory corrente:")
            for idx, ep in enumerate(epubs):
                print(f"  [{idx+1}] {ep}")
            epub_target = epubs[0]
            print(f"➡️  Selezionato predefinito: '{epub_target}'. Specifica il nome per sceglierne un altro.")
        else:
            print("❌ Nessun file .epub trovato nella cartella corrente.")
            sys.exit(1)

    extract_epub(epub_target, args.output_dir)


if __name__ == "__main__":
    main()
