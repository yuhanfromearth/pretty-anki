import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useCallback, useRef, useState } from 'react';
import { Paperclip, Loader2, Undo2, Redo2 } from 'lucide-react';
import { ankiToEditorHtml, editorToAnkiHtml } from './manage-media';
import { uploadMedia } from './api';

const MEDIA_PREFIX = '/api/anki/media/';
const MEDIA_EXT =
  /\.(mp3|ogg|wav|m4a|flac|aac|opus|mp4|webm|mov|gif|png|jpe?g|svg|webp|avif)$/i;

function isMediaFile(file: File): boolean {
  return /^(audio|video|image)\//.test(file.type) || MEDIA_EXT.test(file.name);
}

interface RichFieldEditorProps {
  value: string;
  onChange: (ankiHtml: string) => void;
  /** Fires once on mount with the editor's canonical serialization of `value`.
   *  Lets callers baseline dirty-tracking against normalized markup so a
   *  round-trip edit (type then delete) doesn't register as a change. */
  onInit?: (ankiHtml: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function RichFieldEditor({
  value,
  onChange,
  onInit,
  placeholder,
  autoFocus,
}: RichFieldEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Stores dropped/pasted/attached media into Anki, then inserts an <img> (for
  // images, via the media proxy) or a [sound:…] token (for audio/video) — the
  // same field markup Anki itself uses.
  const insertMediaFiles = useCallback(async (files: File[]) => {
    const editor = editorRef.current;
    if (!editor) return;
    const media = files.filter(isMediaFile);
    if (media.length === 0) return;

    setUploadError(null);
    setUploading(true);
    try {
      for (const file of media) {
        const filename = await uploadMedia(file);
        const src = `${MEDIA_PREFIX}${encodeURIComponent(filename)}`;
        if (file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src }).run();
        } else {
          editor.chain().focus().insertContent(`[sound:${filename}]`).run();
          // Auto-play the freshly inserted sound. The paste/drop/pick gesture
          // satisfies the browser autoplay policy; ignore any rejection.
          void new Audio(src).play().catch(() => {});
        }
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  // Visual styling is owned by the field's *role* in the Template builder (which
  // compiles to the note type's card template + CSS), not by per-note inline
  // markup. So the field editor is intentionally plain: text, line breaks, and
  // media only. The formatting marks/nodes from StarterKit are disabled so a
  // stray Cmd+B or a styled paste can't smuggle inline HTML into the field and
  // override the role styling on the exported card.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        underline: false,
        link: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Image.configure({ inline: false }),
    ],
    content: ankiToEditorHtml(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class:
          'tiptap-field min-h-[4.5rem] w-full px-3.5 py-3 text-[15px] leading-relaxed text-ink-900 focus:outline-none',
        'data-placeholder': placeholder ?? '',
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData
          ? Array.from(event.clipboardData.files)
          : [];
        if (!files.some(isMediaFile)) return false;
        event.preventDefault();
        void insertMediaFiles(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer
          ? Array.from(event.dataTransfer.files)
          : [];
        if (!files.some(isMediaFile)) return false;
        event.preventDefault();
        const at = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (at) editorRef.current?.commands.setTextSelection(at.pos);
        void insertMediaFiles(files);
        return true;
      },
    },
    onCreate: ({ editor }) => onInit?.(editorToAnkiHtml(editor.getHTML())),
    onUpdate: ({ editor }) => onChange(editorToAnkiHtml(editor.getHTML())),
  });
  editorRef.current = editor;

  return (
    <div className="overflow-hidden rounded-md border border-milk-300/70 bg-milk-50/60 transition-colors focus-within:border-mint-400 focus-within:bg-milk-50">
      {editor && (
        <Toolbar
          editor={editor}
          onAttach={() => fileInputRef.current?.click()}
        />
      )}
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          void insertMediaFiles(files);
        }}
      />
      {(uploading || uploadError) && (
        <div className="flex items-center gap-1.5 border-t border-milk-300/60 px-3 py-1.5 text-[11px]">
          {uploading ? (
            <>
              <Loader2 className="size-3 animate-spin text-ink-300" />
              <span className="text-ink-400">Uploading media…</span>
            </>
          ) : (
            <span className="text-terra">{uploadError}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar({
  editor,
  onAttach,
}: {
  editor: Editor;
  onAttach: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-milk-300/60 bg-milk-100/60 px-1.5 py-1">
      <ToolBtn label="Attach audio or image" onClick={onAttach}>
        <Paperclip className="size-3.5" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-3.5" />
      </ToolBtn>
    </div>
  );
}

function ToolBtn({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active
          ? 'bg-mint-500 text-white dark:text-cocoa-950'
          : 'text-ink-500 hover:bg-milk-300/70 hover:text-ink-900'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-milk-300/80" />;
}
