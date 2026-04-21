import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PresentationSummary } from '../types';
import { listPresentations, createPresentation, deletePresentation, importFromGoogleSlides } from '../api';
import { importPresentation } from '../zipExport';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { useAuth, getEditToken } from '../auth';
import { LoginModal } from './LoginModal';


export function Home() {
  const [presentations, setPresentations] = useState<PresentationSummary[]>([]);
  const [importing, setImporting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showGSlidesModal, setShowGSlidesModal] = useState(false);
  const [gSlidesUrl, setGSlidesUrl] = useState('');
  const [gSlidesSlideIndex, setGSlidesSlideIndex] = useState('');
  const [gSlidesLoading, setGSlidesLoading] = useState(false);
  const [gSlidesError, setGSlidesError] = useState('');
  const [gSlidesWarnings, setGSlidesWarnings] = useState<{ failedVideos: { title: string; reason: string }[]; presId: string } | null>(null);
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { mode, setMode } = useTheme();
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

  const handleImportGoogleSlides = async () => {
    const url = gSlidesUrl.trim();
    if (!url) return;
    let slideIndex: number | undefined;
    if (gSlidesSlideIndex.trim()) {
      const n = parseInt(gSlidesSlideIndex.trim(), 10);
      if (!Number.isInteger(n) || n < 1) {
        setGSlidesError(t('errorInvalidSlideIndex'));
        return;
      }
      slideIndex = n;
    }
    setGSlidesLoading(true);
    setGSlidesError('');
    try {
      const pres = await importFromGoogleSlides(url, slideIndex);
      const failed = pres.warnings?.failedVideos ?? [];
      if (failed.length > 0) {
        setGSlidesWarnings({ failedVideos: failed, presId: pres.id });
        setGSlidesLoading(false);
      } else {
        navigate(`/edit/${pres.id}`);
      }
    } catch (err) {
      const e = err as Error & { code?: string };
      const code = e.code;
      let msg: string;
      if (code === 'shareRequired') msg = t('errorShareRequired');
      else if (code === 'invalidUrl' || code === 'notGoogleSlides' || code === 'invalidProtocol' || code === 'hostNotAllowed' || code === 'privateHost') msg = t('errorInvalidUrl');
      else if (code === 'invalidSlideIndex') msg = t('errorInvalidSlideIndex');
      else if (code === 'parseFailed') msg = t('errorParsingFailed');
      else msg = e.message || t('errorImportGeneric');
      setGSlidesError(msg);
      setGSlidesLoading(false);
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
          <button
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
            style={{ ...btnStyle, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500 }}
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            title={mode === 'light' ? t('darkMode') : t('lightMode')}
            style={{ ...btnStyle, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '8px 12px' }}
          >
            {mode === 'light' ? '🌙' : '☀️'}
          </button>
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
            onClick={() => { setGSlidesError(''); setGSlidesUrl(''); setShowGSlidesModal(true); }}
            style={{ ...btnStyle, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            {t('importFromGoogleSlides')}
          </button>
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

      {showGSlidesModal && !gSlidesWarnings && (
        <div
          onClick={() => { if (!gSlidesLoading) setShowGSlidesModal(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: 24, width: 480, maxWidth: '90vw',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('importFromGoogleSlides')}</h2>
            <label style={{ fontSize: 12, opacity: 0.7 }}>{t('googleSlidesUrl')}</label>
            <input
              type="url"
              autoFocus
              value={gSlidesUrl}
              onChange={e => setGSlidesUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !gSlidesLoading) handleImportGoogleSlides(); }}
              placeholder={t('googleSlidesPlaceholder')}
              disabled={gSlidesLoading}
              style={{
                padding: '8px 10px', fontSize: 13,
                background: 'var(--panel-bg)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 4,
              }}
            />
            <div style={{ fontSize: 11, opacity: 0.6 }}>{t('googleSlidesHelp')}</div>
            <label style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{t('slideNumberOptional')}</label>
            <input
              type="number"
              min={1}
              value={gSlidesSlideIndex}
              onChange={e => setGSlidesSlideIndex(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !gSlidesLoading) handleImportGoogleSlides(); }}
              placeholder={t('slideNumberPlaceholder')}
              disabled={gSlidesLoading}
              style={{
                padding: '8px 10px', fontSize: 13, width: 120,
                background: 'var(--panel-bg)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 4,
              }}
            />
            <div style={{ fontSize: 11, opacity: 0.6 }}>{t('slideNumberHelp')}</div>
            {gSlidesError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-light)', borderRadius: 4 }}>
                {gSlidesError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setShowGSlidesModal(false)}
                disabled={gSlidesLoading}
                style={{ ...btnStyle, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '8px 14px' }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleImportGoogleSlides}
                disabled={gSlidesLoading || !gSlidesUrl.trim()}
                style={{ ...btnStyle, padding: '8px 14px', opacity: gSlidesLoading || !gSlidesUrl.trim() ? 0.5 : 1 }}
              >
                {gSlidesLoading ? t('importing') : t('import')}
              </button>
            </div>
          </div>
        </div>
      )}

      {gSlidesWarnings && (
        <div
          onClick={() => { /* require explicit dismiss */ }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          }}
        >
          <div
            style={{
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: 24, width: 520, maxWidth: '90vw',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('importedWithWarnings')}</h2>
            <div style={{ fontSize: 13 }}>{t('failedVideosIntro')}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, maxHeight: 240, overflowY: 'auto' }}>
              {gSlidesWarnings.failedVideos.map((v, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{v.title}</span>
                  <span style={{ opacity: 0.7 }}> — {v.reason}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => {
                  const id = gSlidesWarnings.presId;
                  setGSlidesWarnings(null);
                  setShowGSlidesModal(false);
                  navigate(`/edit/${id}`);
                }}
                style={{ ...btnStyle, padding: '8px 14px' }}
              >
                {t('continueToEditor')}
              </button>
            </div>
          </div>
        </div>
      )}
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
