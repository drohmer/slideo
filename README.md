# Slideo

Outil de presentation web centre sur la video. Concu pour projeter des videos comparatives cote a cote, en boucle, lors de reunions ou conferences.

Google Slides gere mal les videos (pas d'auto-play, pas de boucle, hebergement impose). Slideo resout ca.

## Fonctionnalites

**Editeur**
- Canvas 16:9 avec drag & drop d'elements (video, image, texte)
- Videos en boucle avec auto-play
- Editeur de texte riche (TipTap) : gras, italique, taille, couleur
- Crop interactif sur les videos et images
- Snap magnetique sur grilles, bords et centres d'elements (Alt pour toggle)
- Multi-selection (Shift+clic, rectangle de selection)
- Alignement, distribution, egalisation de taille entre elements
- Reordonnancement z-index (avant, arriere, monter, descendre)
- Zoom (Ctrl+molette, 0.25x-3x) et panning (Ctrl+drag)
- Undo/Redo (Ctrl+Z / Ctrl+Y) avec historique debounce
- Copier/Coller elements (Ctrl+C / Ctrl+V), duplication de slides (Ctrl+D)
- Drag & drop de fichiers directement sur le canvas

**Presentation**
- Mode plein ecran avec navigation clavier (fleches, Entree)
- Synchronisation temps reel entre clients via WebSocket

**Fichiers & Donnees**
- Auto-save (debounce 1s)
- Export/import de presentations en `.zip` (JSON + medias)
- Stockage JSON + filesystem (zero dependance BDD)
- Formats supportes : MP4, WebM, MKV, MOV, AVI + formats image

**Interface**
- Theme clair/sombre (CSS variables)
- Internationalisation FR/EN

## Stack

- **Frontend** : React 18, TypeScript, Vite, TipTap, JSZip
- **Backend** : Node.js, Express, Multer, ws
- **Pas de BDD** : un fichier `.json` par presentation

## Installation

```bash
# Client
cd client && npm install

# Serveur
cd server && npm install
```

## Lancement

```bash
# Terminal 1 - serveur (port 3001)
cd server && npm run dev

# Terminal 2 - client (port 5173)
cd client && npm run dev
```

Ouvrir http://localhost:5173

## Structure

```
client/           Frontend React + Vite
  src/
    components/
      Home/       Liste des presentations, import zip
      Editor/     Canvas, sidebar, panneau proprietes, crop, snap
      Presenter/  Mode presentation plein ecran
      Elements/   Composants video, image, texte (TipTap)
    api.ts        Client API REST
    useWebSocket.ts  Hook WebSocket temps reel
    i18n.tsx      Traductions FR/EN
    theme.tsx     Gestion theme clair/sombre
    zipExport.ts  Export/import zip
    types.ts      Types TypeScript

server/           Backend Express
  src/
    index.ts      Point d'entree
    websocket.ts  Gestion WebSocket (rooms, broadcast)
    routes/
      presentations.ts  CRUD presentations
      uploads.ts        Upload fichiers
  data/           Metadonnees JSON (cree au runtime)
  uploads/        Fichiers uploades (cree au runtime)
```
