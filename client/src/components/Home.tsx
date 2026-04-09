import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PresentationSummary } from '../types';
import { listPresentations, createPresentation, deletePresentation } from '../api';

export function Home() {
  const [presentations, setPresentations] = useState<PresentationSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listPresentations().then(setPresentations);
  }, []);

  const handleCreate = async () => {
    const pres = await createPresentation();
    navigate(`/edit/${pres.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePresentation(id);
    setPresentations(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28 }}>VideoSlide</h1>
        <button onClick={handleCreate} style={btnStyle}>
          + Nouvelle présentation
        </button>
      </div>

      {presentations.length === 0 ? (
        <p style={{ opacity: 0.5, textAlign: 'center', marginTop: 60 }}>
          Aucune présentation. Créez-en une pour commencer.
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
                  Modifié le {new Date(p.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(p.id, e)}
                style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer', fontSize: 14, padding: '4px 8px' }}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#4361ee',
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
  background: '#fff',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 8,
  padding: '16px 20px',
  cursor: 'pointer',
  transition: 'background 0.15s',
};
