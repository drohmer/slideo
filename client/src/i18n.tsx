import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'fr' | 'en';

const translations = {
  // General
  loading: { fr: 'Chargement...', en: 'Loading...' },
  delete: { fr: 'Supprimer', en: 'Delete' },
  cancel: { fr: 'Annuler', en: 'Cancel' },
  reset: { fr: 'Reset', en: 'Reset' },

  // Top bar
  present: { fr: 'Présenter', en: 'Present' },
  share: { fr: 'Partager', en: 'Share' },
  shareCopied: { fr: '✓ Lien copié', en: '✓ Link copied' },
  connected: { fr: 'Connecté (temps réel)', en: 'Connected (real-time)' },
  disconnected: { fr: 'Déconnecté', en: 'Disconnected' },

  // Slides sidebar
  slides: { fr: 'Slides', en: 'Slides' },
  showSlides: { fr: 'Afficher les slides', en: 'Show slides' },
  hideSlides: { fr: 'Masquer les slides', en: 'Hide slides' },
  slideN: { fr: 'Slide', en: 'Slide' },
  addSlide: { fr: 'Ajouter un slide', en: 'Add slide' },
  duplicateSlide: { fr: 'Dupliquer', en: 'Duplicate' },
  empty: { fr: 'Vide', en: 'Empty' },
  nElem: { fr: 'elem.', en: 'elem.' },

  // Properties panel
  tools: { fr: 'Outils', en: 'Tools' },
  addText: { fr: '+ Texte', en: '+ Text' },
  addTextMini: { fr: 'Ajouter texte', en: 'Add text' },
  dragHint: { fr: 'Glissez des fichiers sur le canvas pour ajouter des vidéos ou images', en: 'Drag files onto the canvas to add videos or images' },
  showProps: { fr: 'Afficher les propriétés', en: 'Show properties' },
  hideProps: { fr: 'Masquer les propriétés', en: 'Hide properties' },
  multiSelection: { fr: 'Multi-sélection', en: 'Multi-selection' },
  nSelected: { fr: 'éléments sélectionnés', en: 'elements selected' },
  properties: { fr: 'Propriétés', en: 'Properties' },
  type: { fr: 'Type', en: 'Type' },
  file: { fr: 'Fichier', en: 'File' },
  position: { fr: 'Position', en: 'Position' },
  size: { fr: 'Taille', en: 'Size' },

  // Crop
  crop: { fr: 'Rogner', en: 'Crop' },
  cropFinish: { fr: 'Terminer', en: 'Finish' },
  cropStart: { fr: 'Rogner', en: 'Crop' },
  cropTooltip: { fr: 'Rogner', en: 'Crop' },
  cropFinishTooltip: { fr: 'Terminer le rognage', en: 'Finish cropping' },

  // Order
  order: { fr: 'Ordre', en: 'Order' },
  toFront: { fr: '⤒ Devant', en: '⤒ Front' },
  toBack: { fr: '⤓ Fond', en: '⤓ Back' },

  // Alignment
  alignH: { fr: 'Aligner horizontalement', en: 'Align horizontally' },
  alignV: { fr: 'Aligner verticalement', en: 'Align vertically' },
  left: { fr: 'Gauche', en: 'Left' },
  center: { fr: 'Centre', en: 'Center' },
  right: { fr: 'Droite', en: 'Right' },
  top: { fr: 'Haut', en: 'Top' },
  bottom: { fr: 'Bas', en: 'Bottom' },
  sameSize: { fr: 'Même taille', en: 'Same size' },
  width: { fr: 'Largeur', en: 'Width' },
  height: { fr: 'Hauteur', en: 'Height' },
  both: { fr: 'Les deux', en: 'Both' },

  // Video
  video: { fr: 'Vidéo', en: 'Video' },
  loop: { fr: 'Boucle', en: 'Loop' },
  autoplay: { fr: 'Auto-play', en: 'Auto-play' },
  muted: { fr: 'Muet', en: 'Muted' },
  loopBadge: { fr: 'boucle', en: 'loop' },
  videoStop: { fr: 'Arrêter', en: 'Stop' },
  videoSpeed: { fr: 'Vitesse', en: 'Speed' },
  videoStepBack: { fr: 'Image précédente', en: 'Step back' },
  videoStepForward: { fr: 'Image suivante', en: 'Step forward' },
  captureFrame: { fr: 'Capturer cette image', en: 'Capture frame' },

  // Drawing
  drawing: { fr: 'Dessin', en: 'Drawing' },
  addDrawing: { fr: '+ Dessin', en: '+ Drawing' },
  strokeColor: { fr: 'Couleur du trait', en: 'Stroke color' },
  strokeWidth: { fr: 'Épaisseur', en: 'Stroke width' },
  clearDrawing: { fr: 'Effacer le dessin', en: 'Clear drawing' },

  // Text
  text: { fr: 'Texte', en: 'Text' },
  fontSize: { fr: 'Taille police', en: 'Font size' },
  color: { fr: 'Couleur', en: 'Color' },
  bold: { fr: 'Gras', en: 'Bold' },
  italic: { fr: 'Italique', en: 'Italic' },
  fontSmaller: { fr: 'Réduire la police', en: 'Decrease font size' },
  fontLarger: { fr: 'Agrandir la police', en: 'Increase font size' },
  textPlaceholder: { fr: 'Double-cliquez pour éditer', en: 'Double-click to edit' },

  // Canvas
  dropFiles: { fr: 'Déposez vos fichiers ici', en: 'Drop your files here' },

  // Auth
  login: { fr: 'Connexion', en: 'Sign in' },
  logout: { fr: 'Déconnexion', en: 'Sign out' },
  loginPrompt: { fr: 'Connectez-vous pour retrouver vos présentations.', en: 'Sign in to access your presentations.' },
  expired: { fr: 'Expirée', en: 'Expired' },
  expiresInLess1h: { fr: 'Expire dans < 1h', en: 'Expires in < 1h' },
  expiresInHours: { fr: 'Expire dans %sh', en: 'Expires in %sh' },
  expiresInDays: { fr: 'Expire dans %sj', en: 'Expires in %sd' },

  // Home
  newPresentation: { fr: '+ Nouvelle présentation', en: '+ New presentation' },
  noPresentation: { fr: 'Aucune présentation. Créez-en une pour commencer.', en: 'No presentations. Create one to get started.' },
  modifiedOn: { fr: 'Modifié le', en: 'Modified on' },

  // Export/Import
  exportZip: { fr: 'Export .zip', en: 'Export .zip' },
  exportHtml: { fr: 'Export HTML', en: 'Export HTML' },
  importZip: { fr: 'Importer .zip', en: 'Import .zip' },
  importing: { fr: 'Import en cours...', en: 'Importing...' },

  // Snap
  snapOn: { fr: 'Snap activé', en: 'Snap on' },
  snapOff: { fr: 'Snap désactivé', en: 'Snap off' },

  // Theme
  lightMode: { fr: 'Clair', en: 'Light' },
  darkMode: { fr: 'Sombre', en: 'Dark' },

  // Slide background
  slideBg: { fr: 'Fond du slide', en: 'Slide background' },
  white: { fr: 'Blanc', en: 'White' },
  black: { fr: 'Noir', en: 'Black' },
  custom: { fr: 'Autre', en: 'Custom' },
} as const;

type Key = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => translations[key].fr,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('videoslide-lang');
    return (saved === 'en' || saved === 'fr') ? saved : 'fr';
  });

  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('videoslide-lang', l);
  };

  const t = (key: Key) => translations[key][lang];

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
