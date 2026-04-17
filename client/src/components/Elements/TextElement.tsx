import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Editor as TiptapEditor } from '@tiptap/react';
import type { TextElement, SlideElement } from '../../types';

interface Props {
  element: TextElement;
  onUpdate?: (element: SlideElement) => void;
  editing?: boolean;
  onStopEditing?: () => void;
  onEditorReady?: (editor: TiptapEditor | null) => void;
}

export function TextEl({ element, onUpdate, editing, onStopEditing, onEditorReady }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef(element);
  elementRef.current = element;

  const measureContent = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    // Temporarily shrink the wrapper to fit-content to measure intrinsic text size
    const prevW = wrapper.style.width;
    const prevH = wrapper.style.height;
    wrapper.style.width = 'fit-content';
    wrapper.style.height = 'fit-content';
    const width = Math.max(20, Math.ceil(wrapper.scrollWidth) + 4);
    const height = Math.max(20, Math.ceil(wrapper.scrollHeight) + 4);
    wrapper.style.width = prevW;
    wrapper.style.height = prevH;
    return { width, height };
  }, []);

  const commitContent = useCallback((editor: TiptapEditor) => {
    if (!onUpdate) return;
    const content = editor.getHTML();
    const size = measureContent();
    if (!size) return;
    onUpdate({ ...elementRef.current, content, width: size.width, height: size.height });
  }, [onUpdate, measureContent]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
    ],
    content: element.content,
    editable: !!editing,
    onUpdate: ({ editor }) => {
      if (!onUpdate) return;
      const size = measureContent();
      if (!size) return;
      const cur = elementRef.current;
      const html = editor.getHTML();
      if (size.width !== cur.width || size.height !== cur.height || html !== cur.content) {
        onUpdate({ ...cur, content: html, width: size.width, height: size.height });
      }
    },
    onBlur: ({ editor }) => {
      commitContent(editor);
    },
  });

  // Toggle editable when editing prop changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!!editing);
    if (editing) {
      // Focus and place cursor at end
      setTimeout(() => {
        editor.commands.focus('end');
      }, 0);
    }
  }, [editing, editor]);

  // Sync content from outside when not editing
  useEffect(() => {
    if (!editor || editing) return;
    const currentHTML = editor.getHTML();
    if (currentHTML !== element.content) {
      editor.commands.setContent(element.content, { emitUpdate: false });
    }
  }, [element.content, editing, editor]);

  // Expose editor instance to parent
  useEffect(() => {
    if (!editor) return;
    if (editing) {
      onEditorReady?.(editor);
    } else {
      onEditorReady?.(null);
    }
  }, [editing, editor, onEditorReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => onEditorReady?.(null);
  }, [onEditorReady]);

  // Handle keyboard events: Escape to exit editing, stopPropagation to prevent canvas shortcuts
  useEffect(() => {
    if (!editing || !editor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        commitContent(editor);
        editor.commands.blur();
        onStopEditing?.();
      }
    };
    const dom = editor.view.dom;
    dom.addEventListener('keydown', handleKeyDown);
    return () => dom.removeEventListener('keydown', handleKeyDown);
  }, [editing, editor, commitContent, onStopEditing]);

  return (
    <div
      ref={wrapperRef}
      onMouseDown={(e) => {
        if (editing) {
          e.stopPropagation();
          // During drag-select, prevent parent elements from intercepting mouse events
          const stop = (ev: MouseEvent) => ev.stopPropagation();
          const wrapper = wrapperRef.current;
          const rnd = wrapper?.parentElement;
          if (rnd) {
            rnd.addEventListener('mousemove', stop, true);
            rnd.addEventListener('mouseup', stop, true);
            const cleanup = () => {
              rnd.removeEventListener('mousemove', stop, true);
              rnd.removeEventListener('mouseup', stop, true);
              document.removeEventListener('mouseup', cleanup);
            };
            document.addEventListener('mouseup', cleanup);
          }
        }
      }}
      style={{
        fontSize: element.fontSize,
        color: element.color,
        fontFamily: element.fontFamily ?? 'Arial, sans-serif',
        lineHeight: 1.3,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        cursor: editing ? 'text' : 'inherit',
      }}
    >
      <EditorContent editor={editor} style={{ width: '100%' }} />
    </div>
  );
}
