import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PresentationSummary } from '../types';
import { listPresentations, createPresentation, deletePresentation } from '../api';
import { importPresentation } from '../zipExport';
import { useI18n } from '../i18n';
import { useAuth, getEditToken } from '../auth';
import { LoginModal } from './LoginModal';


export function Home() {
  const [presentations, setPresentations] = useState<PresentationSummary[]>([]);
  const [importing, setImporting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listPresentations().then(setPresentations);
  }, [user]);

  const handleCreate = async () => {
    const pres = await createPresentation();
    navigate(`/edit/${pres.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePresentation(id);
    setPresentations(prev => prev.filter(p => p.id !== id));
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith('.zip')) return;
    setImporting(true);
    try {
      const newId = await importPresentation(file);
      navigate(`/edit/${newId}`);
    } catch (err) {
      console.error('Import failed:', err);
      setImporting(false);
    }
  };

  function canDelete(p: PresentationSummary): boolean {
    if (user && p.ownerId === user.id) return true;
    if (p.anonymous && getEditToken(p.id)) return true;
    if (!p.ownerId && !p.anonymous) return true; // legacy
    return false;
  }

  function formatExpiry(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return t('expired');
    const h = Math.floor(diff / 3600000);
    if (h < 1) return t('expiresInLess1h');
    if (h < 24) return t('expiresInHours').replace('%s', String(h));
    return t('expiresInDays').replace('%s', String(Math.floor(h / 24)));
  }

  return (
    <div
      style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleImport(file);
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Slideo</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary, #888)' }}>Video-first presentations</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>{user.username}</span>
              <button
                onClick={logout}
                style={{ ...btnStyle, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '8px 14px' }}
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              style={{ ...btnStyle, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '8px 14px' }}
            >
              {t('login')}
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{ ...btnStyle, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            {importing ? t('importing') : t('importZip')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
          />
          <button onClick={handleCreate} style={btnStyle}>
            {t('newPresentation')}
          </button>
        </div>
      </div>

      {presentations.length === 0 ? (
        <p style={{ opacity: 0.5, textAlign: 'center', marginTop: 60 }}>
          {user ? t('noPresentation') : t('loginPrompt')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {presentations.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/edit/${p.id}`)}
              style={cardStyle}
            >
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>
                  {t('modifiedOn')} {new Date(p.updatedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {p.anonymous && p.expiresAt && (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'var(--danger-light)', color: 'var(--danger)' }}>
                    {formatExpiry(p.expiresAt)}
                  </span>
                )}
                {canDelete(p) && (
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: '4px 8px' }}
                  >
                    {t('delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 6,
  padding: '10px 20px',
  color: 'white',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 20px',
  cursor: 'pointer',
  transition: 'background 0.15s',
};
