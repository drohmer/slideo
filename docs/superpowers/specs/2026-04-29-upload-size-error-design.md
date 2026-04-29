# Design : retour visuel fichier trop volumineux

## Contexte

Quand un utilisateur dépose un fichier vidéo ou image trop grand (> 500 Mo) sur le canvas, aucun retour visuel n'est affiché. Le fichier est envoyé en entier au serveur (ou la requête échoue silencieusement).

## Objectif

Afficher une bannière d'erreur dans le canvas dès qu'un fichier dépasse la limite, sans envoyer aucun octet au serveur.

## Périmètre

- **Inclus** : drag & drop de fichiers sur le canvas (`SlideCanvas.tsx` → `onDrop`)
- **Inclus** : gestion des erreurs HTTP renvoyées par `uploadFile()` (ex. 413)
- **Exclu** : upload depuis URL (`upload-url`) — limité côté serveur uniquement

## Design

### Constante

`MEDIA.UPLOAD_MAX_SIZE` (déjà défini à `500 * 1024 * 1024` dans `constants.ts`) — aucune modification.

### État

```ts
const [uploadError, setUploadError] = useState<string | null>(null);
```

Ajouté dans `SlideCanvas.tsx`.

### Vérification dans `onDrop`

Avant tout appel à `uploadFile`, pour chaque fichier :

```ts
if (file.size > MEDIA.UPLOAD_MAX_SIZE) {
  setUploadError(`${file.name} — fichier trop volumineux (max 500 Mo)`);
  setTimeout(() => setUploadError(null), 4000);
  continue;
}
```

Si plusieurs fichiers sont déposés simultanément et que l'un dépasse la limite, les autres sont traités normalement.

### Gestion erreur serveur dans `api.ts`

`uploadFile()` reçoit un guard `if (!res.ok)` pour propager l'erreur HTTP :

```ts
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: 'Upload failed' }));
  throw new Error(err.error ?? 'Upload failed');
}
```

L'appelant (`onDrop`) attrape l'exception et appelle `setUploadError`.

### Bannière

Positionnée en absolu, centrée horizontalement, en haut du canvas (top: 16px). S'affiche si `uploadError !== null`.

```tsx
{uploadError && (
  <div onClick={() => setUploadError(null)} style={{
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(220, 53, 69, 0.92)', color: '#fff',
    padding: '10px 18px', borderRadius: 8, zIndex: 1000,
    fontSize: 13, cursor: 'pointer', maxWidth: '80%', textAlign: 'center',
    backdropFilter: 'blur(4px)',
  }}>
    {uploadError}
  </div>
)}
```

Disparaît après 4s ou au clic.

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `client/src/components/Editor/SlideCanvas.tsx` | État `uploadError`, vérification taille dans `onDrop`, affichage bannière |
| `client/src/api.ts` | Guard `if (!res.ok)` dans `uploadFile()` |
