import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Presentation, Slide, SlideElement, WsMessage } from '../../types';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { getPresentation, savePresentation } from '../../api';
import { useWebSocket } from '../../useWebSocket';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { SlidesSidebar } from './SlidesSidebar';
import { SlideCanvas } from './SlideCanvas';
import { PropertiesPanel } from './PropertiesPanel';

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, mode, setMode } = useTheme();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<TiptapEditor | null>(null);
  const [, setEditorTick] = useState(0);
  const [previewPositions, setPreviewPositions] = useState<Array<{ id: string; x: number; y: number; width: number; height: number }> | null>(null);
  const [croppingId, setCroppingId] = useState<string | null>(null);
  const commitCropRef = useRef<() => void>(() => {});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Undo/Redo history
  const undoStack = useRef<Presentation[]>([]);
  const redoStack = useRef<Presentation[]>([]);
  const skipHistory = useRef(false);

  // Clipboard for elements and slides
  const clipboardElements = useRef<SlideElement[]>([]);
  const clipboardSlide = useRef<Slide | null>(null);

  useEffect(() => {
    if (id) getPresentation(id).then(setPres);
  }, [id]);

  const autoSave = useCallback((updated: Presentation) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePresentation(updated);
    }, 1000);
  }, []);

  const updatePres = useCallback((updater: (prev: Presentation) => Presentation) => {
    setPres(prev => {
      if (!prev) return prev;
      if (!skipHistory.current) {
        undoStack.current.push(prev);
        if (undoStack.current.length > 50) undoStack.current.shift();
        redoStack.current = [];
      }
      skipHistory.current = false;
      const updated = updater(prev);
      autoSave(updated);
      return updated;
    });
  }, [autoSave]);

  // Apply remote changes without triggering autoSave
  const applyRemote = useCallback((updater: (prev: Presentation) => Presentation) => {
    setPres(prev => prev ? updater(prev) : prev);
  }, []);

  const handleRemoteMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'element:update':
        applyRemote(prev => ({
          ...prev,
          slides: prev.slides.map(s =>
            s.id === msg.slideId
              ? { ...s, elements: s.elements.map(el => el.id === msg.element.id ? msg.element : el) }
              : s
          ),
        }));
        break;
      case 'element:add':
        applyRemote(prev => ({
          ...prev,
          slides: prev.slides.map(s =>
            s.id === msg.slideId
              ? { ...s, elements: [...s.elements, ...msg.elements] }
              : s
          ),
        }));
        break;
      case 'element:delete':
        applyRemote(prev => ({
          ...prev,
          slides: prev.slides.map(s =>
            s.id === msg.slideId
              ? { ...s, elements: s.elements.filter(el => !msg.elementIds.includes(el.id)) }
              : s
          ),
        }));
        break;
      case 'slide:add':
        applyRemote(prev => {
          const slides = [...prev.slides];
          slides.splice(msg.index, 0, msg.slide);
          return { ...prev, slides };
        });
        break;
      case 'slide:delete':
        applyRemote(prev => ({
          ...prev,
          slides: prev.slides.filter(s => s.id !== msg.slideId),
        }));
        break;
      case 'slide:reorder':
        applyRemote(prev => {
          const byId = new Map(prev.slides.map(s => [s.id, s]));
          return { ...prev, slides: msg.slideIds.map(id => byId.get(id)!).filter(Boolean) };
        });
        break;
      case 'title:update':
        applyRemote(prev => ({ ...prev, title: msg.title }));
        break;
    }
  }, [applyRemote]);

  // Re-render PropertiesPanel when editor selection/formatting changes
  useEffect(() => {
    if (!activeEditor) return;
    const onTransaction = () => setEditorTick(t => t + 1);
    activeEditor.on('selectionUpdate', onTransaction);
    activeEditor.on('transaction', onTransaction);
    return () => {
      activeEditor.off('selectionUpdate', onTransaction);
      activeEditor.off('transaction', onTransaction);
    };
  }, [activeEditor]);

  const { sendMessage, sendThrottled, isConnected } = useWebSocket(pres?.id, handleRemoteMessage);

  const updateCurrentSlideElements = useCallback((elements: SlideElement[]) => {
    const slide = pres?.slides[currentSlideIndex];
    const existingIds = new Set(slide?.elements.map(el => el.id) ?? []);
    const newElements = elements.filter(el => !existingIds.has(el.id));
    updatePres(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === currentSlideIndex ? { ...s, elements } : s
      ),
    }));
    if (slide && newElements.length > 0) {
      sendMessage({ type: 'element:add', slideId: slide.id, elements: newElements });
    }
  }, [currentSlideIndex, pres, updatePres, sendMessage]);

  const currentSlide = pres?.slides[currentSlideIndex];
  const selectedElements = currentSlide?.elements.filter(el => selectedIds.has(el.id)) ?? [];

  const handleSelectElement = useCallback((id: string | null, shiftKey?: boolean) => {
    // Commit any active crop before changing selection
    commitCropRef.current();
    if (id === null) {
      setSelectedIds(new Set());
      setEditingId(null);
    } else if (shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setEditingId(null);
    } else {
      setSelectedIds(new Set([id]));
      setEditingId(prev => prev === id ? prev : null);
    }
  }, []);

  const handleSelectMultiple = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const updateElement = useCallback((updated: SlideElement) => {
    const slideId = pres?.slides[currentSlideIndex]?.id;
    updatePres(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === currentSlideIndex
          ? { ...s, elements: s.elements.map(el => (el.id === updated.id ? updated : el)) }
          : s
      ),
    }));
    if (slideId) sendThrottled({ type: 'element:update', slideId, element: updated });
  }, [currentSlideIndex, pres, updatePres, sendThrottled]);

  const updateElements = useCallback((updatedEls: SlideElement[]) => {
    const slideId = pres?.slides[currentSlideIndex]?.id;
    const map = new Map(updatedEls.map(el => [el.id, el]));
    updatePres(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === currentSlideIndex
          ? { ...s, elements: s.elements.map(el => map.get(el.id) ?? el) }
          : s
      ),
    }));
    if (slideId) {
      for (const el of updatedEls) {
        sendThrottled({ type: 'element:update', slideId, element: el });
      }
    }
  }, [currentSlideIndex, pres, updatePres, sendThrottled]);

  const deleteSelected = useCallback(() => {
    const slideId = pres?.slides[currentSlideIndex]?.id;
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    updatePres(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === currentSlideIndex
          ? { ...s, elements: s.elements.filter(el => !selectedIds.has(el.id)) }
          : s
      ),
    }));
    if (slideId && ids.length) sendMessage({ type: 'element:delete', slideId, elementIds: ids });
  }, [currentSlideIndex, pres, selectedIds, updatePres, sendMessage]);

  const moveGroup = useCallback((draggedId: string, dx: number, dy: number) => {
    const slide = pres?.slides[currentSlideIndex];
    updatePres(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === currentSlideIndex
          ? {
              ...s,
              elements: s.elements.map(el =>
                selectedIds.has(el.id) && el.id !== draggedId
                  ? { ...el, x: el.x + dx, y: el.y + dy }
                  : el
              ),
            }
          : s
      ),
    }));
    if (slide) {
      for (const el of slide.elements) {
        if (selectedIds.has(el.id) && el.id !== draggedId) {
          sendThrottled({ type: 'element:update', slideId: slide.id, element: { ...el, x: el.x + dx, y: el.y + dy } });
        }
      }
    }
  }, [currentSlideIndex, pres, selectedIds, updatePres, sendThrottled]);

  const handleAddText = useCallback(() => {
    const slide = pres?.slides[currentSlideIndex];
    if (!slide) return;
    const newElements = [...slide.elements, {
      id: crypto.randomUUID(),
      type: 'text' as const,
      content: t('textPlaceholder'),
      x: 50, y: 50, width: 300, height: 40,
      fontSize: 24, color: '#000000', bold: false,
    }];
    updateCurrentSlideElements(newElements);
  }, [pres, currentSlideIndex, updateCurrentSlideElements]);

  const reorderElement = useCallback((elementId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const slide = pres?.slides[currentSlideIndex];
    if (!slide) return;
    const els = [...slide.elements];
    const idx = els.findIndex(el => el.id === elementId);
    if (idx === -1) return;
    const [item] = els.splice(idx, 1);
    switch (direction) {
      case 'up': els.splice(Math.min(idx + 1, els.length), 0, item); break;
      case 'down': els.splice(Math.max(idx - 1, 0), 0, item); break;
      case 'top': els.push(item); break;
      case 'bottom': els.unshift(item); break;
    }
    updateCurrentSlideElements(els);
  }, [pres, currentSlideIndex, updateCurrentSlideElements]);

  const commitCrop = useCallback(() => {
    setCroppingId(null);
  }, []);
  commitCropRef.current = commitCrop;

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setPres(cur => {
      if (cur) redoStack.current.push(cur);
      autoSave(prev);
      return prev;
    });
  }, [autoSave]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setPres(cur => {
      if (cur) undoStack.current.push(cur);
      autoSave(next);
      return next;
    });
  }, [autoSave]);

  const copyElements = useCallback(() => {
    const slide = pres?.slides[currentSlideIndex];
    if (!slide) return;
    clipboardElements.current = slide.elements.filter(el => selectedIds.has(el.id));
  }, [pres, currentSlideIndex, selectedIds]);

  const pasteElements = useCallback(() => {
    const toPaste = clipboardElements.current;
    if (toPaste.length === 0) return;
    const newEls = toPaste.map(el => ({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }));
    const slide = pres?.slides[currentSlideIndex];
    if (!slide) return;
    updateCurrentSlideElements([...slide.elements, ...newEls]);
    setSelectedIds(new Set(newEls.map(el => el.id)));
  }, [pres, currentSlideIndex, updateCurrentSlideElements]);

  const duplicateSlide = useCallback(() => {
    const slide = pres?.slides[currentSlideIndex];
    if (!slide) return;
    const newSlide = { ...slide, id: crypto.randomUUID(), elements: slide.elements.map(el => ({ ...el, id: crypto.randomUUID() })) };
    const index = currentSlideIndex + 1;
    updatePres(prev => {
      const slides = [...prev.slides];
      slides.splice(index, 0, newSlide);
      return { ...prev, slides };
    });
    setCurrentSlideIndex(index);
    sendMessage({ type: 'slide:add', slide: newSlide, index });
  }, [pres, currentSlideIndex, updatePres, sendMessage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;

      // Undo/Redo — always active (except in text inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isInput) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isInput) {
        e.preventDefault();
        redo();
        return;
      }

      // Copy/Paste elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isInput && !editingId) {
        copyElements();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInput && !editingId) {
        e.preventDefault();
        pasteElements();
        return;
      }

      // Duplicate slide (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isInput) {
        e.preventDefault();
        duplicateSlide();
        return;
      }

      if (editingId) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !isInput) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'Escape' && croppingId) {
        commitCrop();
        return;
      }
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
        setEditingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingId, croppingId, deleteSelected, commitCrop, undo, redo, copyElements, pasteElements, duplicateSlide]);

  if (!pres) return <div style={{ padding: 40 }}>{t('loading')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: theme.bg, color: theme.text }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: theme.topBar, borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{ fontWeight: 700, cursor: 'pointer', color: theme.text }}
            onClick={() => navigate('/')}
          >
            VideoSlide
          </span>
          <input
            value={pres.title}
            onChange={e => {
              const title = e.target.value;
              updatePres(prev => ({ ...prev, title }));
              sendMessage({ type: 'title:update', title });
            }}
            style={{
              background: 'transparent', border: `1px solid ${theme.border}`,
              borderRadius: 4, padding: '4px 8px', color: theme.text, fontSize: 13, width: 220,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            style={{
              background: 'transparent', border: `1px solid ${theme.border}`,
              borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: theme.textMuted,
            }}
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            title={mode === 'light' ? t('darkMode') : t('lightMode')}
            style={{
              background: 'transparent', border: `1px solid ${theme.border}`,
              borderRadius: 4, padding: '3px 8px', fontSize: 13, cursor: 'pointer', color: theme.textMuted,
            }}
          >
            {mode === 'light' ? '🌙' : '☀️'}
          </button>
          <span
            title={isConnected ? t('connected') : t('disconnected')}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#ef4444',
            }}
          />
          <button
            onClick={() => navigate(`/present/${pres.id}`)}
            style={{
              background: '#4361ee', border: 'none', borderRadius: 4,
              padding: '6px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('present')}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SlidesSidebar
          slides={pres.slides}
          currentIndex={currentSlideIndex}
          onSelect={setCurrentSlideIndex}
          onDuplicate={duplicateSlide}
          onAdd={() => {
            const newSlide = { id: crypto.randomUUID(), background: '#ffffff', elements: [] };
            const index = pres.slides.length;
            updatePres(prev => ({ ...prev, slides: [...prev.slides, newSlide] }));
            setCurrentSlideIndex(index);
            sendMessage({ type: 'slide:add', slide: newSlide, index });
          }}
          onDelete={(index) => {
            if (pres.slides.length <= 1) return;
            const slideId = pres.slides[index].id;
            updatePres(prev => ({ ...prev, slides: prev.slides.filter((_, i) => i !== index) }));
            setCurrentSlideIndex(Math.min(currentSlideIndex, pres.slides.length - 2));
            sendMessage({ type: 'slide:delete', slideId });
          }}
        />

        <SlideCanvas
          slide={pres.slides[currentSlideIndex]}
          presentationId={pres.id}
          selectedIds={selectedIds}
          editingId={editingId}
          onSelectElement={handleSelectElement}
          onSelectMultiple={handleSelectMultiple}
          onUpdateElements={updateCurrentSlideElements}
          onUpdateElement={updateElement}
          onMoveGroup={moveGroup}
          onStartEditing={setEditingId}
          onStopEditing={() => setEditingId(null)}
          onEditorReady={setActiveEditor}
          previewPositions={previewPositions}
          croppingId={croppingId}
          onStartCropping={setCroppingId}
          onCommitCrop={commitCrop}
          onDeleteSelected={deleteSelected}
          activeEditor={activeEditor}
        />

        <PropertiesPanel
          elements={selectedElements}
          onReorder={reorderElement}
          onUpdate={updateElement}
          onUpdateMultiple={updateElements}
          onDelete={deleteSelected}
          onPreview={setPreviewPositions}
          activeEditor={activeEditor}
          onAddText={handleAddText}
          croppingId={croppingId}
          onStartCropping={setCroppingId}
          onStopCropping={commitCrop}
          currentSlideBg={pres.slides[currentSlideIndex]?.background}
          onSlideBgChange={(color) => {
            const slideId = pres.slides[currentSlideIndex]?.id;
            updatePres(prev => ({
              ...prev,
              slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, background: color } : s),
            }));
          }}
        />
      </div>
    </div>
  );
}
