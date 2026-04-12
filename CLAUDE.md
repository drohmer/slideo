# Slideo — Architecture & Navigation

## Stack
- **Client**: React 18 + TypeScript + Vite, React Router, TipTap (rich text), JSZip
- **Server**: Express + TypeScript, multer (uploads), ws (WebSocket), JWT + bcrypt (auth)
- **Storage**: JSON files on disk (`server/data/`), media in `server/uploads/`

## Build & Run
```bash
cd client && npm run build   # tsc + vite → client/dist/
cd client && npm run dev     # vite dev server
cd server && npm run build   # tsc → server/dist/
cd server && npm run dev     # tsx watch + --env-file=.env (JWT_SECRET, AUTH_USERNAME, AUTH_PASSWORD)
```

---

## Client — `client/src/`

### Types & Constantes
- **`types.ts`** — `SlideElement` = `VideoElement | ImageElement | TextElement | DrawingElement`, chacun étend `BaseElement` (id, type, x, y, width, height). Aussi : `Stroke`, `Slide`, `Presentation`, `WsMessage`. Fonctions utilitaires : `getVisibleRect()`, `strokeToPath()`.
- **`constants.ts`** — `CANVAS` (960×540), `ZOOM` (min/max/step), `SNAP`, `EDITOR` (undo debounce/max), `MEDIA` (upload limits, probe timeout).

### Editor.tsx — Orchestrateur principal
Le composant central. Gère tout le state et le passe aux sous-composants.

| Repère | Rôle |
|--------|------|
| `updatePres()` | Met à jour la présentation avec undo history (debounce `EDITOR.UNDO_DEBOUNCE`ms) |
| `autoSave()` | Sauvegarde serveur 1s après la dernière modification |
| `undo()` / `redo()` | Pile undo/redo (max `EDITOR.UNDO_MAX` entrées) |
| `handleRemoteMessage()` | Switch sur les `WsMessage.type` (element:update/add/delete, slide:add/delete/reorder, title:update) |
| `updateElement()` | Met à jour un élément + sync WebSocket (throttled) |
| `updateCurrentSlideElements()` | Remplace tous les éléments du slide courant |
| `handleAddText()` | Crée un TextElement par défaut |
| `toggleDrawingMode()` / `handleDrawingComplete()` | Gère le mode dessin libre (state `drawingMode`) |
| `handleSelectElement()` | Sélection simple/shift/déselection |
| `handleShare()` | Récupère le shareToken + copie le lien |
| `useEffect` keyboard handler | Raccourcis : Ctrl+Z/Y (undo/redo), Ctrl+C/V (copy/paste), Ctrl+D (dupliquer slide), Delete, Escape, B/I (bold/italic sur texte sélectionné) |
| `commitCropRef` | Ref pour finaliser le crop avant changement de sélection |

### SlideCanvas.tsx — Rendu & interactions canvas
Le plus gros fichier. Gère le rendu du slide, les interactions souris, et le dessin libre.

| Repère | Rôle |
|--------|------|
| `renderElement()` | Switch par type → `<VideoEl>`, `<ImageEl>`, `<TextEl>`, `<DrawingEl>` |
| `makeSnapFn()` | Calcule les snap guides (bords, centres d'éléments + bords du canvas) |
| `onDrop` (dropzone) | Drag&drop de fichiers → upload → création d'élément image/vidéo |
| `probeVideoDimensions()` / `probeImageDimensions()` | Détection des dimensions natives via éléments HTML temporaires |
| `startMarquee` / marquee state | Sélection rectangle par drag sur le fond du canvas |
| `handleWheel` | Zoom avec Ctrl+wheel |
| `handleMouseDown/Move/Up` | Pan avec middle-click |
| `freeStrokes` / `freeCurrentStroke` | State du dessin libre (avant finalisation) |
| `handleFreePointerDown/Move/Up` | Capture des strokes en coords pixel canvas |
| `finalizeFreeDrawing()` | Calcule le bounding box, convertit en coords pixel relatives, appelle `onDrawingComplete` |
| `isElementEditing` | Désactive le drag/resize quand un élément texte ou dessin est en mode édition |
| Crop overlay | Les blocs semi-transparents + handles pour le crop image/vidéo |
| Snap guides overlay | Lignes de snap visibles pendant le drag |
| Bounding box multi-sélection | 8 poignées de resize (`GR_DIRS`, `GR_CURSORS`) ; `computeGroupResize()` calcule le scaling proportionnel avec ancrage correct ; `handleGroupResizePointerDown` gère le drag via `document` listeners ; `groupResizeOverrides` (Map id→{x,y,w,h}) transmis à chaque `DraggableElement` via `liveOverride` |

### PropertiesPanel.tsx — Panneau propriétés
4 modes de rendu : collapsed, aucun élément (outils), multi-sélection (alignement), élément unique (propriétés).

| Repère | Rôle |
|--------|------|
| Mode collapsed | Mini-boutons (T, ✎, 🗑) |
| Mode vide | Boutons `+ Texte` / `+ Dessin` (toggle drawingMode), contrôles couleur/épaisseur si drawingMode actif, fond de slide |
| `AlignSection` | Alignement multi-sélection : left/center/right, top/center/bottom, sameWidth/Height/Both, preview au hover |
| `VideoProps` | ⏮/▶⏸/⏹/⏭ (contrôles lecture), scrubber, vitesse (0.25×–2×), loop/autoplay/muted, bouton capture frame (📷) |
| `TextProps` | FontSize, color picker, bold/italic (via TipTap si édition active, sinon toggleBoldItalicRef) |
| `DrawingProps` | Color picker strokeColor, slider strokeWidth, bouton "Effacer" |
| `onCaptureFrame` | Callback optionnel : capture frame vidéo → blob PNG → upload → `ImageElement` |

### DraggableElement.tsx — Drag & resize
HOC qui wrap chaque élément du canvas. Gère le positionnement absolu et les handles de resize.

| Repère | Rôle |
|--------|------|
| `HANDLE_SIZE` | Taille des handles (12px) |
| `applyLive()` | Applique le transform directement sur le DOM (pas de re-render React) pour la fluidité |
| `liveOverride` | Prop optionnelle `{x,y,width,height}` en coords canvas : appliquée via `useLayoutEffect` + `applyLive` (utilisée pour le resize de groupe) |
| `handleDragPointerDown/Move/Up` | Drag avec contrainte d'axe (shift), zoom-aware |
| `handleResizePointerDown` | Resize avec 8 directions (n/ne/e/se/s/sw/w/nw), aspect ratio lock optionnel |
| `ResizeHandles` | 8 divs positionnés aux coins/bords |

### ElementToolbar.tsx — Toolbar flottante
Affichée au-dessus de l'élément sélectionné. Contenu dépend du type.

| Type | Contenu |
|------|---------|
| text | A−/A+ (fontSize), B/I (bold/italic), color picker |
| video | ⏮ ▶/⏸ ⏭ (pas image par image, `FRAME_STEP = 1/30s`) + ✂ (crop toggle) |
| image | ✂ (crop toggle) |
| drawing | (rien de spécifique) |
| tous | 🗑 (delete) |

### SlidesSidebar.tsx — Liste des slides
Miniatures avec preview des éléments (scale `THUMB_W / CANVAS.WIDTH`). Boutons dupliquer/supprimer par slide. Mode collapsed avec mini-thumbs.

### Composants Elements — `components/Elements/`
- **`DrawingElement.tsx`** — SVG avec `viewBox="0 0 {width} {height}"` (coords pixel). Mode édition (double-clic) : capture pointer events, cursor crosshair, bordure pointillée bleue. `strokeToPath()` importé de `types.ts`.
- **`TextElement.tsx`** — TipTap editor (contenteditable). Mode édition sur double-clic. Gère bold/italic inline.
- **`VideoElement.tsx`** / **`ImageElement.tsx`** — Rendu simple avec `object-fit: cover`. Crop via `clip-path: inset()` appliqué par le parent (SlideCanvas).

### Services
- **`api.ts`** — `writeHeaders(id)` injecte automatiquement `Authorization`, `x-edit-token`, `x-share-token`. Fonctions : `listPresentations`, `getPresentation`, `createPresentation`, `savePresentation`, `deletePresentation`, `uploadFile`, `fetchShareToken`.
- **`auth.tsx`** — `AuthProvider` (login/register/logout via `/api/auth/*`). Stockage tokens dans localStorage : `slideo-token` (JWT), `slideo-edit-tokens` (map id→token), `slideo-share-tokens` (map id→token).
- **`useWebSocket.ts`** — Hook avec reconnexion expo backoff (1s→30s), throttle 50ms sur `sendThrottled`, flush au unmount.
- **`zipExport.ts`** — `exportPresentation()` (zip JSON+media), `exportHtmlPresentation()` (zip HTML autonome+media, player JS vanilla inline avec swipe/clavier/dots), `importPresentation()` (zip → upload media → remap paths).
- **`i18n.tsx`** — Clés FR/EN dans objet `translations`, contexte `useI18n()` → `{ t, lang, setLang }`.
- **`theme.tsx`** — CSS variables injectées sur `:root`, mode light/dark, contexte `useTheme()`.

### Presenter — `components/Presenter/`
- **`Presenter.tsx`** — Fullscreen, scale responsive (`viewport` state + resize listener). Navigation : flèches, espace, swipe tactile (`touchStart`/`touchEnd` avec seuil 50px), zones de tap (30% gauche/droite), dots cliquables.
- **`PresenterVideo.tsx`** — Vidéo avec `autoplay` au changement de slide, controls au survol avec timer de masquage.

---

## Server — `server/src/`

### index.ts — Point d'entrée
Setup : `ensureDefaultUser()`, `startCleanupJob()`, CORS credentials, `express.json({ limit: '10mb' })`, monte `/api/auth`, `/api/presentations`, static `/uploads` et `client/dist`.

### auth.ts — Auth & accès
| Repère | Rôle |
|--------|------|
| `JWT_SECRET` | Depuis env, throw si absent |
| `ensureDefaultUser()` | Crée user depuis `AUTH_USERNAME`/`AUTH_PASSWORD` si `users.json` vide |
| `loadUsers()` / `saveUsers()` | Lecture/écriture `server/data/users.json` |
| `signToken()` / `verifyToken()` | JWT 7 jours |
| `authenticate` middleware | Lit `Authorization: Bearer`, attache `req.user` (non bloquant) |
| `requireAuth` middleware | Comme authenticate mais 401 si pas de user |
| `checkWriteAccess(existing, req, res)` | Vérifie : shareToken header → ownerId → editToken → legacy (aucun champ = autorisé) |

### validation.ts — Validation partagée
`UUID_RE` regex + `validateId` middleware (400 si `:id` n'est pas un UUID v4).

### routes/presentations.ts — CRUD présentations
Toutes les routes passent par `authenticate` + `validateId` sur `/:id`.

| Route | Rôle |
|-------|------|
| `GET /` | Liste filtrée par `ownerId === req.user.id` ([] si anonyme) |
| `GET /:id` | Public, strip `editToken` + `shareToken` via `stripSecrets()` |
| `POST /` | Crée avec `ownerId` (si connecté) ou `anonymous + editToken + expiresAt` (sinon). Toujours un `shareToken`. |
| `GET /:id/share-token` | Retourne le shareToken (nécessite write access) |
| `PUT /:id` | Whitelist `title` + `slides` du body. Préserve tous les champs auth du stockage. Bumpe `expiresAt` si anonymous. |
| `DELETE /:id` | Supprime JSON + dossier uploads |

### routes/uploads.ts — Upload fichiers
`POST /:id/upload` — multer (500MB, image/video seulement), sanitisation `path.basename + replace`, `checkWriteAccess`, cleanup fichier sur 403.

### routes/auth.ts — Auth endpoints
`POST /login` (bcrypt compare → JWT), `POST /register` (validation username 2-32, password 6+, hash, re-read users après hash pour éviter race condition), `POST /logout` (204), `GET /me` (requireAuth → user info).

### cleanup.ts — Expiration
`startCleanupJob(dataDir, uploadsDir)` — `setInterval` 1h, supprime les présentations où `anonymous === true && expiresAt < now`.

---

## Patterns pour ajouter des fonctionnalités

### Ajouter un nouveau type d'élément
1. `types.ts` — ajouter l'interface (extends `BaseElement`), l'ajouter à l'union `SlideElement`, mettre à jour `BaseElement.type`
2. `components/Elements/NewElement.tsx` — créer le composant de rendu
3. `SlideCanvas.tsx` → `renderElement()` — ajouter le `case`
4. `SlideCanvas.tsx` → `onDoubleClick` — ajouter le type si édition in-place
5. `SlideCanvas.tsx` → `isElementEditing` — ajouter si le drag doit être désactivé en édition
6. `Editor.tsx` — ajouter `handleAddXxx()` et le passer au PropertiesPanel
7. `PropertiesPanel.tsx` — ajouter le bouton outil + le bloc propriétés pour le type
8. `SlidesSidebar.tsx` → `ThumbnailElement` — ajouter le rendu miniature
9. `Presenter.tsx` — ajouter le rendu en mode présentation
10. `zipExport.ts` → `generateHtml()` — ajouter le rendu dans l'export HTML
11. `i18n.tsx` — ajouter les clés FR/EN

### Ajouter une route API
1. `server/src/routes/xxx.ts` — créer le router, utiliser `authenticate`/`requireAuth`/`validateId` de `auth.ts`/`validation.ts`
2. `server/src/index.ts` — monter le router
3. `client/src/api.ts` — ajouter la fonction d'appel avec `writeHeaders(id)` ou `getAuthHeaders()`
