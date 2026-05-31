import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { useCallback, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  List,
  ListOrdered,
  Link2,
  Link2Off,
  Palette,
  Eraser,
  Paperclip,
  Loader2,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover';
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

const SWATCHES: { name: string; value: string }[] = [
  { name: 'Ink', value: '#2c2523' },
  { name: 'Terra', value: '#c26151' },
  { name: 'Apricot', value: '#c98a45' },
  { name: 'Mint', value: '#4f8a72' },
  { name: 'Sky', value: '#5f8aa8' },
  { name: 'Lilac', value: '#9177c0' },
];

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: false },
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      Color,
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
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      heading: editor.isActive('heading', { level: 2 }),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      link: editor.isActive('link'),
      color: editor.getAttributes('textStyle').color as string | undefined,
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-milk-300/60 bg-milk-100/60 px-1.5 py-1">
      <ToolBtn
        active={state.bold}
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={state.italic}
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={state.underline}
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        active={state.heading}
        label="Heading"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={state.bullet}
        label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={state.ordered}
        label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolBtn>

      <Divider />

      <ColorControl editor={editor} current={state.color} />
      <LinkControl editor={editor} active={state.link} />
      <ToolBtn label="Attach audio or image" onClick={onAttach}>
        <Paperclip className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <Eraser className="size-3.5" />
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

function ColorControl({
  editor,
  current,
}: {
  editor: Editor;
  current?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Text color"
        aria-label="Text color"
        onMouseDown={(e) => e.preventDefault()}
        className="flex size-7 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-milk-300/70 hover:text-ink-900 aria-expanded:bg-milk-300/70"
      >
        <Palette
          className="size-3.5"
          style={current ? { color: current } : undefined}
        />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-2">
        <div className="flex items-center gap-1.5">
          {SWATCHES.map((s, i) => (
            <button
              key={`${s.value}-${i}`}
              type="button"
              title={s.name}
              onClick={() => {
                editor.chain().focus().setColor(s.value).run();
                setOpen(false);
              }}
              className="size-5 rounded-full ring-1 ring-inset ring-foreground/10 transition-transform hover:scale-110"
              style={{ backgroundColor: s.value }}
            />
          ))}
          <span className="mx-0.5 h-5 w-px bg-milk-300/80" />
          <button
            type="button"
            title="Remove color"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
            className="flex size-5 items-center justify-center rounded-full text-ink-400 ring-1 ring-inset ring-foreground/10 transition-colors hover:text-ink-700"
          >
            <Eraser className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  const apply = () => {
    const trimmed = url.trim();
    if (trimmed) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: trimmed })
        .run();
    }
    setOpen(false);
    setUrl('');
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setUrl((editor.getAttributes('link').href as string) ?? '');
        }}
      >
        <PopoverTrigger
          title="Add link"
          aria-label="Add link"
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
          className={`flex size-7 items-center justify-center rounded-md transition-colors aria-expanded:bg-milk-300/70 ${
            active
              ? 'bg-mint-500 text-white dark:text-cocoa-950'
              : 'text-ink-500 hover:bg-milk-300/70 hover:text-ink-900'
          }`}
        >
          <Link2 className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-64 p-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="h-7 min-w-0 flex-1 rounded-md border border-milk-300 bg-milk-50 px-2 text-xs text-ink-900 outline-none focus:border-mint-400"
            />
            <button
              type="submit"
              className="h-7 shrink-0 rounded-md bg-mint-500 px-2.5 text-xs font-medium text-white dark:text-cocoa-950"
            >
              Set
            </button>
          </form>
        </PopoverContent>
      </Popover>
      <ToolBtn
        label="Remove link"
        disabled={!active}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Link2Off className="size-3.5" />
      </ToolBtn>
    </>
  );
}
