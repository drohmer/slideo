# Slideo

Éditeur de présentations orienté vidéo — interface web, temps réel, export autonome.

Conçu pour projeter des vidéos comparatives côte à côte, en boucle, lors de réunions ou conférences. Google Slides gère mal les vidéos (pas d'auto-play, pas de boucle, hébergement imposé). Slideo résout ça.

## Fonctionnalités

**Éditeur**
- Canvas 16:9 avec drag & drop d'éléments (vidéo, image, texte, dessin libre, formes géométriques)
- Drag & resize avec snap magnétique (bords, centres, canvas) et contrainte d'axe (Shift)
- **Redimensionnement de groupe** : sélectionner plusieurs éléments, tirer une des 8 poignées de la bounding box
- Crop interactif image/vidéo
- Alignement multi-sélection (bords, centres, égalisation de taille)
- Reordonnancement z-index (avant, arrière, monter, descendre)
- Undo/Redo (Ctrl+Z / Ctrl+Y) avec historique debounce
- Copier/Coller éléments (Ctrl+C / Ctrl+V), duplication de slides (Ctrl+D)
- Drag & drop de fichiers directement sur le canvas
- Zoom (Ctrl+molette, 0.25×–3×) et pan (clic milieu+drag)
- Éditeur de texte riche (TipTap) : gras, italique, taille, couleur
- Bouton **+ Titre** : insère un texte préformaté (gras, fontSize 48) en haut du slide
- **Formes géométriques** : segment (avec ou sans flèche), rectangle, ellipse — dessinées par click+drag, redimensionnables sans perte, couleur de contour/remplissage configurables

**Vidéo**
- Contrôles dans le panneau propriétés : ⏮ ▶/⏸ ⏹ ⏭, scrubber, vitesse (0.25× à 2×)
- Contrôles rapides dans la toolbar flottante (pas image par image)
- Capture de frame : extrait l'image courante → nouvel élément image sur le slide
- Options : loop, autoplay, muted

**Présentation**
- Mode plein écran, scale adaptatif
- Navigation : flèches, Espace, swipe tactile, tap zones (30% gauche/droite), dots
- Lecture vidéo automatique au changement de slide

**Export / Import**
- Export `.zip` (JSON + médias)
- Export HTML autonome (player JS vanilla, swipe, clavier, dots — aucune dépendance)
- Import `.zip`
- **Import Google Slides depuis URL** : parser PPTX côté serveur (`docs.google.com/presentation/d/.../export/pptx`), extraction des textes (gras/italique/couleur/font), images, et **vidéos hébergées sur Google Drive** (créées comme `VideoElement` autoplay+loop+muted). Option : importer une seule slide via son numéro. Pré-requis : document + vidéos partagés en « Toute personne avec le lien ». Vidéos non téléchargeables → fallback thumbnail + liste d'avertissements.

**Collaboration & Auth**
- Synchronisation temps réel via WebSocket
- Comptes persistants (JWT) + accès anonyme temporaire (expiration 24h)
- Partage par lien avec token

**Interface**
- Thème clair/sombre (CSS variables)
- Internationalisation FR/EN

## Stack

| Côté | Technologies |
|------|-------------|
| Client | React 18, TypeScript, Vite, React Router, TipTap, JSZip |
| Serveur | Express, TypeScript, ws (WebSocket), multer, JWT + bcrypt, JSZip + fast-xml-parser (import PPTX) |
| Stockage | Fichiers JSON (`server/data/`), médias dans `server/uploads/` — zéro dépendance BDD |

## Démarrage local

```bash
# Variables d'environnement serveur
cat > server/.env <<EOF
JWT_SECRET=changeme
AUTH_USERNAME=admin
AUTH_PASSWORD=changeme
PORT=3001
EOF

# Client (dev) — port 5173
cd client && npm install && npm run dev

# Serveur (dev) — port 3001
cd server && npm install && npm run dev
```

## Build production

```bash
cd client && npm run build   # → client/dist/
cd server && npm run build   # → server/dist/
node server/dist/index.js    # sert client/dist/ en statique + API sur :3001
```

## Déploiement

```bash
bash deploy.sh
```

Synchronise via rsync sur `damien-scaleway`, build client + serveur à distance, redémarre le service systemd `slideo`.

## Structure

```
client/src/
  components/
    Home/         Liste des présentations, import zip
    Editor/       Canvas, sidebar, panneau propriétés, crop, snap, group resize
    Presenter/    Mode présentation plein écran
    Elements/     Composants vidéo, image, texte (TipTap), dessin (SVG), formes géométriques (SVG)
  api.ts          Client API REST
  useWebSocket.ts Hook WebSocket temps réel
  i18n.tsx        Traductions FR/EN
  theme.tsx       Thème clair/sombre
  zipExport.ts    Export/import zip + HTML autonome
  types.ts        Types TypeScript (SlideElement, Slide, Presentation, WsMessage)
  constants.ts    CANVAS, ZOOM, SNAP, EDITOR, MEDIA

server/src/
  index.ts          Point d'entrée (Express + WebSocket)
  auth.ts           JWT, bcrypt, middlewares authenticate/requireAuth
  validation.ts     validateId middleware (UUID v4, par-route)
  ssrf.ts           safeFetch / safeFetchToFile (blocklist privée + allowlist + maxRedirects)
  pptx-parser.ts    Parser PPTX (textes, images, hyperlinks Drive vidéo)
  pptx-to-slideo.ts EMU→pixels, runs PPTX → HTML TipTap, téléchargement vidéos Drive
  cleanup.ts        Expiration présentations anonymes (cron 1h)
  routes/
    presentations.ts  CRUD + share token + import-from-url
    uploads.ts        Upload fichiers (multer 500 MB, upload-url via SSRF safe-fetch)
    auth.ts           Login, register, logout, /me
```

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+C / Ctrl+V | Copier / Coller élément |
| Ctrl+D | Dupliquer slide courant |
| Delete | Supprimer sélection |
| Escape | Désélectionner / quitter édition |
| B / I | Gras / Italique (texte sélectionné) |
| Shift+drag | Contraindre déplacement sur un axe |
| Ctrl+scroll | Zoom canvas |
| Clic milieu+drag | Pan canvas |
