# VideoSlide

Outil de presentation web centre sur la video. Concu pour projeter des videos comparatives cote a cote, en boucle, lors de reunions ou conferences.

Google Slides gere mal les videos (pas d'auto-play, pas de boucle, hebergement impose). VideoSlide resout ca.

## Fonctionnalites

- Editeur drag & drop avec canvas 16:9
- Elements video, image et texte
- Videos en boucle avec auto-play et `objectFit: cover`
- Redimensionnement avec preservation du ratio natif de la video
- Multi-selection (Shift+clic, rectangle de selection)
- Alignement, distribution, redimensionnement groupe
- Zoom (Ctrl+molette) et panning (Ctrl+drag)
- Mode presentation plein ecran avec navigation clavier
- Synchronisation temps reel entre clients via WebSocket
- Auto-save (debounce 1s)
- Stockage JSON + filesystem (zero dependance BDD)

## Stack

- **Frontend** : React 18, TypeScript, Vite
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
      Editor/     Editeur (canvas, sidebar, panneau proprietes)
      Presenter/  Mode presentation plein ecran
      Elements/   Composants video, image, texte
    api.ts        Client API REST
    useWebSocket.ts  Hook WebSocket temps reel
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
