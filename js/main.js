/**
 * Avvio dell'applicazione e funzioni richiamate da index.html
 */

import { state } from './state.js';
import { fetchServerWorksheets, getFilesFromDataTransferItems, handleFolderSelect, loadRawWorksheets } from './book.js';
import { deselectAll, selectAll, selectEssentialBes, showEmptyState, showNotificationToast } from './ui.js';
import { cancelDialog, initModalAccessibility, isDialogOpen, showDialog } from './dialogs.js';
import { closeExportDialog, closePrintPreview, exportCurrentPreviewDocx, loadExportPrefs, openExportDialog, runExport, setDsaMode, setExportChoice, toggleDsaMode } from './output.js';
import { applyEditorChanges, closeMdEditor, downloadCurrentEditorFile, handleEditorFileSelectChange, handleEditorInput, insertEditorSnippet, openMdEditor, revertEditorCurrentFile, setEditorViewMode } from './editor.js';
import { closeHelpModal, closePromptContextModal, copyCodeSnippet, copyCurrentPromptContextText, copyNextBlockCommand, copyStartInstructions, downloadBothPromptAndContext, downloadCurrentPromptContextFile, downloadStartContext, ensurePromptAndContextLoaded, hideStartGuide, openHelpModal, openPromptContextModal, openStartGuide, switchPromptContextTab } from './help.js';
import { applySelectionVersion, deleteSelectionVersion, saveSelectionVersion } from './versions.js';
import { closeLibraryModal, openLibraryModal, readBookFromStorage, readSaveInfo, renderSaveStatus, saveBookToStorage, saveWorkFile } from './storage.js';

window.addEventListener('DOMContentLoaded', async () => {
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dz = document.getElementById('dropzone-banner');
    if (dz) dz.classList.add('dragover');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    const dz = document.getElementById('dropzone-banner');
    if (dz && (!e.relatedTarget || e.relatedTarget === document.documentElement)) {
      dz.classList.remove('dragover');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dz = document.getElementById('dropzone-banner');
    if (dz) dz.classList.remove('dragover');

    if (e.dataTransfer && e.dataTransfer.items) {
      const files = await getFilesFromDataTransferItems(e.dataTransfer.items);
      if (files.length > 0) {
        handleFolderSelect(files);
        return;
      }
    }

    if (e.dataTransfer && e.dataTransfer.files) {
      handleFolderSelect(e.dataTransfer.files);
    }
  });

  const editorModal = document.getElementById('editor-modal');
  if (editorModal) {
    editorModal.addEventListener('click', (e) => {
      if (e.target === editorModal) {
        closeMdEditor();
      }
    });
  }

  const editorTextarea = document.getElementById('editor-textarea');
  if (editorTextarea) {
    editorTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        const val = editorTextarea.value;
        editorTextarea.value = val.substring(0, start) + "  " + val.substring(end);
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
        handleEditorInput();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        applyEditorChanges();
      }
    });
  }

  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  const pcModal = document.getElementById('prompt-context-modal');
  if (pcModal) {
    pcModal.addEventListener('click', (e) => {
      if (e.target === pcModal) {
        closePromptContextModal();
      }
    });
  }

  // Esc: chiude prima la finestra di dialogo, poi una sola finestra alla volta (la più in primo piano)
  const escapeClosers = [
    ['export-modal', closeExportDialog],
    ['library-modal', closeLibraryModal],
    ['prompt-context-modal', closePromptContextModal],
    ['help-modal', closeHelpModal],
    ['editor-modal', closeMdEditor],
    ['preview-modal', closePrintPreview]
  ];
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isDialogOpen()) {
      cancelDialog();
      return;
    }
    const open = escapeClosers.find(([id]) => document.getElementById(id)?.classList.contains('open'));
    if (open) open[1]();
  });

  // Clic fuori dalla finestra = chiudi (per la finestra di dialogo = annulla)
  [['export-modal', closeExportDialog], ['library-modal', closeLibraryModal], ['dialog-modal', cancelDialog]]
    .forEach(([id, close]) => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) close();
        });
      }
    });

  initModalAccessibility();

  // Preferenze di stampa (DSA compresa) e stato dell'ultimo salvataggio
  loadExportPrefs();
  readSaveInfo();

  // Guida rapida: precaricamento di prompt e contesto (la copia negli appunti deve avvenire
  // subito dopo il clic, senza attendere una richiesta di rete)
  ensurePromptAndContextLoaded();

  // 1. Schede pubblicate sul sito (schede_esercizi/) e copia salvata nel browser
  const serverWorksheets = await fetchServerWorksheets();
  const stored = readBookFromStorage();

  // 2. Le modifiche locali (editor / importazione AI) non vengono mai sovrascritte senza chiedere
  if (stored && stored.locallyEdited && serverWorksheets.length > 0) {
    const keepLocal = await showDialog({
      title: 'Hai delle modifiche non pubblicate',
      message: "In questo browser ci sono modifiche alle schede (fatte nell'editor o importando nuove schede) che non sono presenti sul sito. Quale versione vuoi usare?",
      buttons: [
        { label: 'Usa la versione del sito (scarta le mie modifiche)', value: false, style: 'danger' },
        { label: 'Usa le mie modifiche', value: true, style: 'primary' }
      ],
      cancelValue: true
    });
    if (keepLocal) {
      loadRawWorksheets(stored.worksheets, serverWorksheets, { bookId: stored.bookId });
      renderSaveStatus();
      showNotificationToast("↩️ Le tue modifiche sono state ripristinate. «Annulla tutte le modifiche» nell'editor riporta una scheda alla versione del sito.");
    } else {
      loadRawWorksheets(serverWorksheets);
      saveBookToStorage(false, { fromFile: true });
    }
    return;
  }

  if (serverWorksheets.length > 0) {
    loadRawWorksheets(serverWorksheets);
    saveBookToStorage(false, { fromFile: true });
    return;
  }

  if (stored) {
    loadRawWorksheets(stored.worksheets, null, { bookId: stored.bookId });
    renderSaveStatus();
    return;
  }

  // 3. Stato vuoto iniziale
  showEmptyState();
});

// Funzioni richiamate dagli attributi onclick/onchange di index.html e dall'HTML generato
Object.assign(window, {
  applyEditorChanges,
  applySelectionVersion,
  closeExportDialog,
  closeHelpModal,
  closeLibraryModal,
  closeMdEditor,
  closePrintPreview,
  closePromptContextModal,
  copyCodeSnippet,
  copyCurrentPromptContextText,
  copyNextBlockCommand,
  copyStartInstructions,
  deleteSelectionVersion,
  deselectAll,
  downloadBothPromptAndContext,
  downloadCurrentEditorFile,
  downloadCurrentPromptContextFile,
  downloadStartContext,
  exportCurrentPreviewDocx,
  handleEditorFileSelectChange,
  handleEditorInput,
  handleFolderSelect,
  hideStartGuide,
  insertEditorSnippet,
  openExportDialog,
  openHelpModal,
  openLibraryModal,
  openMdEditor,
  openPromptContextModal,
  openStartGuide,
  revertEditorCurrentFile,
  runExport,
  saveSelectionVersion,
  saveWorkFile,
  selectAll,
  selectEssentialBes,
  setDsaMode,
  setEditorViewMode,
  setExportChoice,
  switchPromptContextTab,
  toggleDsaMode
});
