// All interface strings, PAL order: English, French, Spanish, German, Italian, Dutch, Portuguese.
export const LANGS = ['en', 'fr', 'es', 'de', 'it', 'nl', 'pt'];

// Language names as shown in each interface language (index follows LANGS).
const NAMES = {
  en: ['English', 'French', 'Spanish', 'German', 'Italian', 'Dutch', 'Portuguese'],
  fr: ['Anglais', 'Français', 'Espagnol', 'Allemand', 'Italien', 'Néerlandais', 'Portugais'],
  es: ['Inglés', 'Francés', 'Español', 'Alemán', 'Italiano', 'Neerlandés', 'Portugués'],
  de: ['Englisch', 'Französisch', 'Spanisch', 'Deutsch', 'Italienisch', 'Niederländisch', 'Portugiesisch'],
  it: ['Inglese', 'Francese', 'Spagnolo', 'Tedesco', 'Italiano', 'Olandese', 'Portoghese'],
  nl: ['Engels', 'Frans', 'Spaans', 'Duits', 'Italiaans', 'Nederlands', 'Portugees'],
  pt: ['Inglês', 'Francês', 'Espanhol', 'Alemão', 'Italiano', 'Holandês', 'Português'],
};

// key: [en, fr, es, de, it, nl, pt]
const T = {
  browser: ['Browser', 'Navigateur', 'Navegador', 'Browser', 'Browser', 'Browser', 'Navegador'],
  syscfg: ['System Configuration', 'Configuration du Système', 'Configuración del Sistema', 'Systemkonfiguration', 'Configurazione di Sistema', 'Systeemconfiguratie', 'Configuração do Sistema'],
  enter: ['Enter', 'Entrer', 'Aceptar', 'Eingabe', 'Invio', 'Bevestigen', 'Confirmar'],
  back: ['Back', 'Précédent', 'Atrás', 'Zurück', 'Indietro', 'Terug', 'Retroceder'],
  version: ['Version', 'Version', 'Versión', 'Version', 'Versione', 'Versie', 'Versão'],
  options: ['Options', 'Options', 'Opciones', 'Optionen', 'Opzioni', 'Opties', 'Opções'],
  display: ['Display', 'Affichage', 'Visualizar', 'Anzeige', 'Visualizzazione', 'Weergeven', 'Visor'],
  mc: ['Memory Card', 'Carte mémoire', 'Memory Card', 'Memory Card', 'Memory Card', 'Memory Card', 'Memory Card'],
  kbfree: ['{n} KB Free', '{n} Ko libres', '{n} KB libres', '{n} KB frei', '{n} KB liberi', '{n} KB vrij', '{n} KB livres'],
  loading: ['Loading...', 'Chargement...', 'Cargando...', 'Laden...', 'Caricamento...', 'Laden...', 'A carregar...'],
  open: ['Open', 'Ouvrir', 'Abrir', 'Öffnen', 'Apri', 'Openen', 'Abrir'],
  source: ['Source', 'Source', 'Código', 'Quellcode', 'Sorgente', 'Broncode', 'Código'],
  copy: ['Copy', 'Copier', 'Copiar', 'Kopieren', 'Copia', 'Kopiëren', 'Copiar'],
  del: ['Delete', 'Supprimer', 'Borrar', 'Löschen', 'Elimina', 'Wissen', 'Apagar'],
  yes: ['Yes', 'Oui', 'Sí', 'Ja', 'Sì', 'Ja', 'Sim'],
  no: ['No', 'Non', 'No', 'Nein', 'No', 'Nee', 'Não'],
  ok: ['OK', 'OK', 'Aceptar', 'OK', 'OK', 'OK', 'OK'],
  // System Configuration
  clock: ['Clock Adjustment', "Réglage de l'horloge", 'Ajuste del reloj', 'Uhrzeit einstellen', 'Regolazione orologio', 'Klok instellen', 'Acerto do relógio'],
  screen: ['Screen Size', "Taille de l'écran", 'Tamaño de pantalla', 'Bildschirmgröße', 'Dimensioni schermo', 'Schermformaat', 'Tamanho do ecrã'],
  optical: ['Digital Out (Optical)', 'Sortie numérique (optique)', 'Salida digital (óptica)', 'Digitalausgang (optisch)', 'Uscita digitale (ottica)', 'Digitale uitgang (optisch)', 'Saída digital (óptica)'],
  component: ['Component Video Out', 'Sortie vidéo composante', 'Salida de vídeo componente', 'Komponenten-Videoausgang', 'Uscita video component', 'Component-video-uitgang', 'Saída de vídeo componente'],
  crtFilter: ['CRT Filter', 'Filtre CRT', 'Filtro CRT', 'CRT-Filter', 'Filtro CRT', 'CRT-filter', 'Filtro CRT'],
  crt: ['CRT TV', 'TV CRT', 'TV CRT', 'CRT-Fernseher', 'TV CRT', 'CRT-tv', 'TV CRT'],
  lang: ['Language', 'Langue', 'Idioma', 'Sprache', 'Lingua', 'Taal', 'Idioma'],
  full: ['Full', 'Plein', 'Completa', 'Voll', 'Pieno', 'Volledig', 'Completo'],
  on: ['On', 'Activé', 'Activado', 'Ein', 'Attivato', 'Aan', 'Ligado'],
  off: ['Off', 'Désactivé', 'Desactivado', 'Aus', 'Disattivato', 'Uit', 'Desligado'],
  timeNot: ['Time Notation', "Format de l'heure", 'Formato de hora', 'Zeitformat', 'Formato ora', 'Tijdnotatie', 'Formato da hora'],
  h12: ['12 Hour Clock', '12 heures', '12 horas', '12 Stunden', '12 ore', '12-uursklok', '12 horas'],
  h24: ['24 Hour Clock', '24 heures', '24 horas', '24 Stunden', '24 ore', '24-uursklok', '24 horas'],
  dateNot: ['Date Notation', 'Format de la date', 'Formato de fecha', 'Datumsformat', 'Formato data', 'Datumnotatie', 'Formato da data'],
  summerTime: ['Summer Time', "Heure d'été", 'Horario de verano', 'Sommerzeit', 'Ora legale', 'Zomertijd', 'Horário de verão'],
  winter: ['Winter Time', "Heure d'hiver", 'Horario de invierno', 'Winterzeit', 'Ora solare', 'Wintertijd', 'Horário de inverno'],
  fmtYMD: ['YYYY/MM/DD', 'AAAA/MM/JJ', 'AAAA/MM/DD', 'JJJJ/MM/TT', 'AAAA/MM/GG', 'JJJJ/MM/DD', 'AAAA/MM/DD'],
  fmtMDY: ['MM/DD/YYYY', 'MM/JJ/AAAA', 'MM/DD/AAAA', 'MM/TT/JJJJ', 'MM/GG/AAAA', 'MM/DD/JJJJ', 'MM/DD/AAAA'],
  fmtDMY: ['DD/MM/YYYY', 'JJ/MM/AAAA', 'DD/MM/AAAA', 'TT/MM/JJJJ', 'GG/MM/AAAA', 'DD/MM/JJJJ', 'DD/MM/AAAA'],
  tz: ['Time Zone', 'Fuseau horaire', 'Zona horaria', 'Zeitzone', 'Fuso orario', 'Tijdzone', 'Fuso horário'],
  auto: ['Automatic', 'Automatique', 'Automática', 'Automatisch', 'Automatico', 'Automatisch', 'Automático'],
  // Version Information
  verinfo: ['Version Information', 'Informations de version', 'Información de la versión', 'Versionsinformationen', 'Informazioni sulla versione', 'Versie-informatie', 'Informação da versão'],
  console: ['Console', 'Console', 'Consola', 'Konsole', 'Console', 'Console', 'Consola'],
  cdplayer: ['CD Player', 'Lecteur CD', 'Reproductor de CD', 'CD-Player', 'Lettore CD', 'CD-speler', 'Leitor de CD'],
  driver: ['ElyeStation® Driver', 'ElyeStation® Driver', 'ElyeStation® Driver', 'ElyeStation® Driver', 'ElyeStation® Driver', 'ElyeStation® Driver', 'ElyeStation® Driver'],
  unknown: ['Unknown', 'Inconnu', 'Desconocido', 'Unbekannt', 'Sconosciuto', 'Onbekend', 'Desconhecido'],
  diagnosis: ['Diagnosis', 'Diagnostic', 'Diagnóstico', 'Diagnose', 'Diagnostica', 'Diagnose', 'Diagnóstico'],
  discSpeed: ['Disc Speed', 'Vitesse du disque', 'Velocidad del disco', 'Disc-Geschwindigkeit', 'Velocità disco', 'Discsnelheid', 'Velocidade do disco'],
  standard: ['Standard', 'Standard', 'Estándar', 'Standard', 'Standard', 'Standaard', 'Padrão'],
  fast: ['Fast', 'Rapide', 'Rápida', 'Schnell', 'Veloce', 'Snel', 'Rápida'],
  texMap: ['Texture Mapping', 'Mappage de texture', 'Mapeado de texturas', 'Textur-Mapping', 'Mappatura texture', 'Texture-mapping', 'Mapeamento de texturas'],
  smooth: ['Smooth', 'Lisse', 'Suave', 'Glatt', 'Uniforme', 'Vloeiend', 'Suave'],
  // Information
  info: ['Information', 'Informations', 'Información', 'Informationen', 'Informazioni', 'Informatie', 'Informação'],
  location: ['Location', 'Emplacement', 'Ubicación', 'Speicherort', 'Posizione', 'Locatie', 'Localização'],
  fileType: ['File Type', 'Type de fichier', 'Tipo de archivo', 'Dateityp', 'Tipo file', 'Bestandstype', 'Tipo de ficheiro'],
  fileSize: ['File Size', 'Taille', 'Tamaño', 'Dateigröße', 'Dimensioni', 'Bestandsgrootte', 'Tamanho'],
  updated: ['Last Updated', 'Dernière mise à jour', 'Última actualización', 'Zuletzt geändert', 'Ultimo aggiornamento', 'Laatst bijgewerkt', 'Última atualização'],
  protect: ['File Protection', 'Protection', 'Protección', 'Schreibschutz', 'Protezione', 'Beveiliging', 'Proteção'],
  none: ['None', 'Aucune', 'Ninguna', 'Keiner', 'Nessuna', 'Geen', 'Nenhuma'],
  saved: ['Saved Data (ElyeStation®2)', 'Données sauvegardées (ElyeStation®2)', 'Datos guardados (ElyeStation®2)', 'Gespeicherte Daten (ElyeStation®2)', 'Dati salvati (ElyeStation®2)', 'Opgeslagen gegevens (ElyeStation®2)', 'Dados guardados (ElyeStation®2)'],
  // dialogs
  openLink: ['Open this link?', 'Ouvrir ce lien ?', '¿Abrir este enlace?', 'Diesen Link öffnen?', 'Aprire questo link?', 'Deze link openen?', 'Abrir esta ligação?'],
  copyQ: ['Copy the link to the clipboard?', 'Copier le lien dans le presse-papiers ?', '¿Copiar el enlace al portapapeles?', 'Link in die Zwischenablage kopieren?', 'Copiare il link negli appunti?', 'Link naar het klembord kopiëren?', 'Copiar a ligação para a área de transferência?'],
  copying: ['Copying...', 'Copie en cours...', 'Copiando...', 'Kopieren...', 'Copia in corso...', 'Bezig met kopiëren...', 'A copiar...'],
  copied: ['Copy complete.', 'Copie terminée.', 'Copia completada.', 'Kopiervorgang abgeschlossen.', 'Copia completata.', 'Kopiëren voltooid.', 'Cópia concluída.'],
  delQ: ['Are you sure you want to delete this saved data?', 'Voulez-vous vraiment supprimer ces données ?', '¿Seguro que quieres borrar estos datos guardados?', 'Möchten Sie diese Daten wirklich löschen?', 'Eliminare questi dati salvati?', 'Weet je zeker dat je deze gegevens wilt wissen?', 'Tem a certeza de que pretende apagar estes dados?'],
  delNo: ['This saved data is protected and cannot be deleted.', 'Ces données sont protégées et ne peuvent pas être supprimées.', 'Estos datos están protegidos y no se pueden borrar.', 'Diese Daten sind geschützt und können nicht gelöscht werden.', 'Questi dati sono protetti e non possono essere eliminati.', 'Deze gegevens zijn beveiligd en kunnen niet worden gewist.', 'Estes dados estão protegidos e não podem ser apagados.'],
  noData: ['There is no saved data.', "Il n'y a aucune donnée sauvegardée.", 'No hay datos guardados.', 'Keine gespeicherten Daten vorhanden.', 'Non ci sono dati salvati.', 'Er zijn geen opgeslagen gegevens.', 'Não existem dados guardados.'],
  // power / non-diegetic
  power: ['Press any button', 'Appuyez sur une touche', 'Pulsa cualquier botón', 'Beliebige Taste drücken', 'Premi un tasto qualsiasi', 'Druk op een toets', 'Prima qualquer botão'],
  pressStart: ['PRESS START BUTTON', 'APPUYEZ SUR START', 'PULSA START', 'START DRÜCKEN', 'PREMI START', 'DRUK OP START', 'PRIMA START'],
};

let cur = 'en';
let idx = 0;
export function setLang(code) {
  cur = LANGS.includes(code) ? code : 'en';
  idx = LANGS.indexOf(cur);
  document.documentElement.lang = cur;
}
export const lang = () => cur;

export function t(key, vars) {
  const row = T[key];
  let s = row ? row[idx] ?? row[0] : key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
export const langName = (code, ui = cur) => NAMES[ui][LANGS.indexOf(code)];

// A localizable value from content.js: either a string or {en:'..', fr:'..'}
export function L(v) {
  if (v == null) return '';
  if (typeof v === 'object' && !Array.isArray(v)) return v[cur] ?? v.en ?? Object.values(v)[0] ?? '';
  return String(v);
}
