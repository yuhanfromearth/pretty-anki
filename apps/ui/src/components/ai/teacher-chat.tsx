import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Plus,
  FilePlus,
  ArrowUp,
  Square,
  History,
  X,
  MessageSquareText,
  Trash2,
  Reply,
} from 'lucide-react';
import type { AiCardContext, AiMessage, UserSettings } from '@nts/shared';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '#/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '#/components/ui/popover';
import { Textarea } from '#/components/ui/textarea';
import {
  conversationKey,
  conversationsKey,
  deleteAllConversations,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  streamChat,
} from './api';

interface TeacherChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: number;
  deckName: string;
  context: AiCardContext;
}

export function TeacherChat({
  open,
  onOpenChange,
  noteId,
  deckName,
  context,
}: TeacherChatProps) {
  const queryClient = useQueryClient();

  // null = an unsaved fresh chat; a string = a persisted conversation id.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  // null when idle; a (possibly empty) string while a reply streams in.
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  // Inline delete confirmation: a conversation id armed for deletion, and the
  // delete-all button armed. Both require a second click to commit.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  // Reply-to-selection: when the user selects text inside a (completed) teacher
  // bubble, a floating Reply button appears above it. Clicking it captures the
  // selection as a single quote shown in a composer pill; the saved DOM range
  // lets the pill jump back and flash the exact substring in the transcript.
  const [quote, setQuote] = useState<string | null>(null);
  const quoteRangeRef = useRef<Range | null>(null);
  // Viewport position of the floating Reply button, or null when hidden.
  const [replyBtn, setReplyBtn] = useState<{ x: number; y: number } | null>(
    null
  );
  // The cloned range for the live (not-yet-confirmed) selection.
  const pendingRangeRef = useRef<Range | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Refs + a measured spacer let us pin the latest turn's user message to the
  // top of the transcript (kontekst-style), so a fresh question is the only
  // thing visible until the reply streams in beneath it.
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const pendingScrollRef = useRef(false);
  // Whether this open-session has picked its default (most-recent) conversation.
  const initializedRef = useRef(false);

  const streaming = streamingText !== null;

  const listQuery = useQuery({
    queryKey: conversationsKey(noteId),
    queryFn: () => fetchConversations(noteId),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const detailQuery = useQuery({
    queryKey: conversationKey(noteId, selectedId ?? ''),
    queryFn: () => fetchConversation(noteId, selectedId as string),
    enabled: open && !!selectedId,
    refetchOnWindowFocus: false,
  });

  // User-configured quick prompts, shown as one-tap chips on a fresh chat.
  const settingsQuery = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const r = await fetch('/api/settings');
      if (!r.ok) throw new Error(`settings: ${r.status}`);
      return r.json() as Promise<UserSettings>;
    },
  });
  const quickPrompts = settingsQuery.data?.aiQuickPrompts ?? [];

  // On each open, start a fresh chat. Past conversations remain reachable
  // through the History popover. Reset the guard when the dialog closes.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    setSelectedId(null);
  }, [open]);

  // Mirror the selected conversation's persisted messages into local state. The
  // guard against streaming is implicit: we never change selectedId/detail data
  // mid-stream, so this can't clobber an in-flight reply.
  useEffect(() => {
    if (!open) return;
    if (selectedId === null) {
      setMessages([]);
      return;
    }
    if (detailQuery.data) setMessages(detailQuery.data.messages);
  }, [open, selectedId, detailQuery.data]);

  // Abort any in-flight request and clear transient state when the dialog
  // closes, so a half-streamed reply is dropped and reopening starts clean.
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText(null);
    setError(null);
    setInput('');
    setQuote(null);
    quoteRangeRef.current = null;
    setReplyBtn(null);
  }, [open]);

  // Size the trailing spacer so the latest turn's user message can sit at the
  // very top of the transcript. When the reply is the last thing rendered
  // (streaming or finished) we also reserve room for it; otherwise the user
  // message alone fills the viewport. Recomputing as the reply streams keeps
  // the user message pinned while the answer grows beneath it.
  const GAP = 16; // space-y-4
  const recalculate = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const containerHeight = container.clientHeight;
    const userHeight = lastUserMessageRef.current?.clientHeight ?? 0;
    const assistantLast =
      streamingText !== null ||
      messages[messages.length - 1]?.role === 'assistant';

    if (assistantLast) {
      const assistantHeight =
        lastAssistantMessageRef.current?.clientHeight ?? 0;
      setSpacerHeight(
        Math.max(0, containerHeight - userHeight - assistantHeight - GAP * 2)
      );
    } else {
      setSpacerHeight(Math.max(0, containerHeight - userHeight - GAP));
    }

    // Scroll here (rather than in a spacerHeight effect) so it fires even when
    // the height is unchanged — e.g. reopening on an already-sized container.
    if (pendingScrollRef.current) {
      pendingScrollRef.current = false;
      requestAnimationFrame(() => {
        lastUserMessageRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  }, [messages, streamingText]);

  // Keep the freshest recalculate in a ref so the ResizeObserver below can stay
  // mounted across streaming deltas without re-running its setup.
  const recalcRef = useRef(recalculate);
  recalcRef.current = recalculate;

  // On each new message (and on container resize) measure and scroll the latest
  // user message to the top.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    pendingScrollRef.current = true;
    const run = () => recalcRef.current();
    const raf = requestAnimationFrame(run);
    const observer = new ResizeObserver(run);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [messages.length, open, selectedId]);

  // Re-measure as the reply streams so the spacer shrinks to fit the growing
  // answer without re-triggering the scroll. Skip the initial empty-string
  // transition (the typing-dots bubble): the message-length effect below owns
  // the send-time scroll, and recalculating synchronously here would consume
  // its pending scroll before the new spacer is committed to the DOM.
  useEffect(() => {
    if (streamingText) recalcRef.current();
  }, [streamingText]);

  // Focus the composer when opening or switching threads (not mid-stream).
  useEffect(() => {
    if (open && !streaming) textareaRef.current?.focus();
  }, [open, selectedId, streaming]);

  // Watch text selection while the dialog is open. Show the Reply button on
  // mouseup when a non-empty selection sits fully within one completed teacher
  // bubble; fade it out as soon as the selection collapses or the transcript
  // scrolls (its viewport-fixed position would otherwise drift).
  useEffect(() => {
    if (!open) return;
    const evaluate = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        pendingRangeRef.current = null;
        setReplyBtn(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      const bubble = closestAssistant(range.commonAncestorContainer);
      if (
        !text ||
        !bubble ||
        !bubble.contains(range.startContainer) ||
        !bubble.contains(range.endContainer)
      ) {
        pendingRangeRef.current = null;
        setReplyBtn(null);
        return;
      }
      pendingRangeRef.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      setReplyBtn({ x: rect.left + rect.width / 2, y: rect.top });
    };
    const onSelectionChange = () => {
      const sel = document.getSelection();
      // Only react to collapses here; growth/positioning is handled on mouseup
      // so the button doesn't jitter mid-drag.
      if (!sel || sel.isCollapsed) {
        pendingRangeRef.current = null;
        setReplyBtn(null);
      }
    };
    const onScroll = () => setReplyBtn(null);
    document.addEventListener('mouseup', evaluate);
    document.addEventListener('selectionchange', onSelectionChange);
    // Capture phase so we catch scrolling on the transcript (or any nested
    // scroller) regardless of when it mounts — scroll events don't bubble.
    document.addEventListener('scroll', onScroll, { capture: true });
    return () => {
      document.removeEventListener('mouseup', evaluate);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open]);

  // Confirm the live selection as the active quote and dismiss the button.
  const onClickReply = useCallback(() => {
    const range = pendingRangeRef.current;
    if (!range) return;
    setQuote(range.toString().trim());
    quoteRangeRef.current = range;
    pendingRangeRef.current = null;
    setReplyBtn(null);
    document.getSelection()?.removeAllRanges();
    textareaRef.current?.focus();
  }, []);

  const clearQuote = useCallback(() => {
    setQuote(null);
    quoteRangeRef.current = null;
  }, []);

  // Scroll the quoted text back into view and briefly flash it. Prefer the CSS
  // Custom Highlight API (exact substring); fall back to flashing the bubble.
  const highlightSource = useCallback(() => {
    const range = quoteRangeRef.current;
    if (!range) return;
    const container = scrollRef.current;
    const rect = range.getBoundingClientRect();
    if (container && rect.height) {
      const cRect = container.getBoundingClientRect();
      container.scrollBy({
        top:
          rect.top - cRect.top - container.clientHeight / 2 + rect.height / 2,
        behavior: 'smooth',
      });
    }
    const cssAny = CSS as unknown as {
      highlights?: {
        set(k: string, v: unknown): void;
        delete(k: string): void;
      };
    };
    const HighlightCtor = (
      window as unknown as { Highlight?: new (...r: Range[]) => unknown }
    ).Highlight;
    if (cssAny.highlights && HighlightCtor) {
      cssAny.highlights.set('reply-source', new HighlightCtor(range));
      window.setTimeout(() => cssAny.highlights?.delete('reply-source'), 1200);
      return;
    }
    const bubble = closestAssistant(range.commonAncestorContainer);
    if (bubble) {
      bubble.classList.add('reply-bubble-flash');
      window.setTimeout(
        () => bubble.classList.remove('reply-bubble-flash'),
        1200
      );
    }
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText(null);
    setError(null);
    setSelectedId(null);
    setMessages([]);
    setInput('');
    clearQuote();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [clearQuote]);

  const switchTo = useCallback(
    (id: string) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setStreamingText(null);
      setError(null);
      setSelectedId(id);
      clearQuote();
    },
    [clearQuote]
  );

  const deleteOneMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(noteId, id),
    onSuccess: (data, id) => {
      queryClient.setQueryData(conversationsKey(noteId), data);
      queryClient.removeQueries({ queryKey: conversationKey(noteId, id) });
      setConfirmingId(null);
      // If the open conversation was the one removed, fall back to the most
      // recent remaining thread (or a fresh chat when none are left).
      if (id === selectedId) {
        const next = data.conversations[0]?.id;
        if (next) switchTo(next);
        else startNewChat();
      }
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => deleteAllConversations(noteId),
    onSuccess: (data) => {
      queryClient.setQueryData(conversationsKey(noteId), data);
      queryClient.removeQueries({ queryKey: ['ai', 'conversation', noteId] });
      setConfirmingAll(false);
      startNewChat();
    },
  });

  // `override` lets a quick-prompt button send its own text without touching
  // the composer draft; a normal send reads (and clears) the composer.
  const send = useCallback(
    async (override?: string) => {
      const fromComposer = override === undefined;
      const raw = (override ?? input).trim();
      if (!raw || streaming) return;

      // Fold an active quote into the outgoing text as a markdown blockquote.
      // Only composer sends carry the quote; quick-prompt sends never do.
      const quoted = fromComposer ? quote : null;
      const savedRange = quoteRangeRef.current;
      const text = quoted
        ? `${quoted
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n')}\n\n${raw}`
        : raw;

      const base = messages;
      const userMsg: AiMessage = { role: 'user', content: text };
      if (fromComposer) {
        setInput('');
        clearQuote();
      }
      setError(null);
      setMessages([...base, userMsg]);
      setStreamingText('');

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = '';
      let convId = selectedId ?? undefined;
      let failed = false;

      for await (const evt of streamChat(
        {
          noteId,
          conversationId: selectedId ?? undefined,
          message: text,
          context,
        },
        controller.signal
      )) {
        if (evt.type === 'meta') convId = evt.conversationId;
        else if (evt.type === 'delta') {
          acc += evt.content;
          setStreamingText(acc);
        } else if (evt.type === 'error') {
          setError(evt.message);
          failed = true;
          break;
        } else if (evt.type === 'done') break;
      }

      abortRef.current = null;

      // Discard the partial turn on abort or error: restore the pre-send view and
      // return the question to the composer so it can be retried.
      if (controller.signal.aborted || failed) {
        setStreamingText(null);
        setMessages(base);
        // Only return the draft to the composer for a composer-originated send;
        // a quick-prompt send must leave any existing draft intact. Restore the
        // raw text and the quote separately so the blockquote isn't dumped into
        // the textarea as literal "> …".
        if (failed && fromComposer) {
          setInput(raw);
          if (quoted) {
            setQuote(quoted);
            quoteRangeRef.current = savedRange;
          }
        }
        return;
      }

      setMessages([...base, userMsg, { role: 'assistant', content: acc }]);
      setStreamingText(null);
      if (convId) setSelectedId(convId);
      queryClient.invalidateQueries({ queryKey: conversationsKey(noteId) });
      if (convId) {
        queryClient.invalidateQueries({
          queryKey: conversationKey(noteId, convId),
        });
      }
    },
    [
      input,
      streaming,
      messages,
      selectedId,
      noteId,
      context,
      queryClient,
      quote,
      clearQuote,
    ]
  );

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const conversations = listQuery.data?.conversations ?? [];
  const empty = messages.length === 0 && streamingText === null;
  const lastUserIdx = messages.findLastIndex((m) => m.role === 'user');
  // While a reply streams the streaming bubble is the last assistant line, so
  // only mark a message as the assistant anchor once streaming has finished.
  const lastAssistantIdx =
    messages[messages.length - 1]?.role === 'assistant'
      ? messages.length - 1
      : -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={textareaRef}
        finalFocus={false}
        className="flex h-150 max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0"
      >
        {/* Header: title, conversation switcher, new chat, close */}
        <div className="flex items-center gap-2 border-b border-milk-200/70 px-4 py-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-mint-500/15 text-mint-700 dark:text-mint-500">
            <Sparkles className="size-4" />
          </div>
          <DialogTitle className="font-display text-base font-semibold text-ink-900">
            Teacher
          </DialogTitle>

          <div className="ml-auto flex items-center gap-1">
            {conversations.length > 0 && (
              <Popover
                open={historyOpen}
                onOpenChange={(o) => {
                  setHistoryOpen(o);
                  // Disarm any pending confirmation when the menu closes.
                  if (!o) {
                    setConfirmingId(null);
                    setConfirmingAll(false);
                  }
                }}
              >
                <PopoverTrigger
                  className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-400 transition-colors hover:bg-mint-500/10 hover:text-mint-700 dark:hover:text-mint-500"
                  aria-label="Conversation history"
                >
                  <History className="size-3.5" />
                  History
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1.5" align="end">
                  <p className="px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-ink-300 uppercase">
                    Conversations
                  </p>
                  <div className="max-h-72 overflow-y-auto">
                    {conversations.map((c) => (
                      <div
                        key={c.id}
                        className={`group/row flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-milk-100 ${
                          c.id === selectedId ? 'bg-milk-100' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            switchTo(c.id);
                            setHistoryOpen(false);
                          }}
                          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-2 text-left"
                        >
                          <span className="font-mono text-[10px] text-ink-300">
                            {formatRelative(c.updatedAt)}
                          </span>
                          <span className="line-clamp-1 w-full text-xs text-ink-700">
                            {c.snippet || 'New conversation'}
                          </span>
                        </button>
                        {confirmingId === c.id ? (
                          <button
                            type="button"
                            onClick={() => deleteOneMutation.mutate(c.id)}
                            disabled={deleteOneMutation.isPending}
                            className="shrink-0 rounded-md bg-terra/15 px-2 py-1 text-[10px] font-semibold text-terra transition-colors hover:bg-terra/25 disabled:opacity-50"
                            aria-label="Confirm delete conversation"
                          >
                            Delete?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingId(c.id);
                              setConfirmingAll(false);
                            }}
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-300 opacity-0 transition-all group-hover/row:opacity-100 hover:bg-terra/15 hover:text-terra focus-visible:opacity-100"
                            aria-label="Delete conversation"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 border-t border-milk-200/70 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmingAll) deleteAllMutation.mutate();
                        else {
                          setConfirmingAll(true);
                          setConfirmingId(null);
                        }
                      }}
                      disabled={deleteAllMutation.isPending}
                      className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                        confirmingAll
                          ? 'bg-terra/15 text-terra hover:bg-terra/25'
                          : 'text-ink-400 hover:bg-milk-100 hover:text-terra'
                      }`}
                    >
                      <Trash2 className="size-3.5" />
                      {confirmingAll
                        ? `Delete all ${conversations.length}? Click to confirm`
                        : 'Delete all conversations'}
                    </button>
                  </div>
                  {(deleteOneMutation.isError || deleteAllMutation.isError) && (
                    <p className="px-2.5 py-1.5 text-[10px] text-terra">
                      Couldn’t delete. Please try again.
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {/* Jump to the manage page's add panel with this card's note type
                preselected, so the teacher's suggestions can become a new card. */}
            <Link
              to="/manage/$deckName"
              params={{ deckName }}
              search={{ add: true, model: context.modelName }}
              onClick={() => onOpenChange(false)}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-400 transition-colors hover:bg-mint-500/10 hover:text-mint-700 dark:hover:text-mint-500"
              aria-label="Add card to this deck"
            >
              <FilePlus className="size-3.5" />
              Add card
            </Link>
            <button
              type="button"
              onClick={startNewChat}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-400 transition-colors hover:bg-mint-500/10 hover:text-mint-700 dark:hover:text-mint-500"
              aria-label="New chat"
            >
              <Plus className="size-3.5" />
              New
            </button>
            <DialogClose className="flex size-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500">
              <X className="size-4" />
            </DialogClose>
          </div>
        </div>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-pt-4"
        >
          {empty && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-mint-500/10 text-mint-700 dark:text-mint-500">
                <MessageSquareText className="size-5" />
              </div>
              <p className="text-sm font-medium text-ink-700">
                Ask about this card
              </p>
              <p className="max-w-[16rem] text-xs text-ink-400">
                Usage, conjugation, example sentences — the teacher already sees
                the current card.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              role={m.role}
              content={m.content}
              quotable={m.role === 'assistant'}
              ref={
                m.role === 'user' && i === lastUserIdx
                  ? lastUserMessageRef
                  : streamingText === null && i === lastAssistantIdx
                    ? lastAssistantMessageRef
                    : undefined
              }
            />
          ))}

          {streamingText !== null && (
            <MessageBubble
              ref={lastAssistantMessageRef}
              role="assistant"
              content={streamingText}
            />
          )}

          {error && (
            <div className="rounded-xl border border-terra/30 bg-terra/10 px-3 py-2 text-xs text-terra">
              {error}
            </div>
          )}

          {!empty && (
            <div
              aria-hidden="true"
              style={{ height: spacerHeight }}
              className="shrink-0"
            />
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-milk-200/70 p-3">
          {/* Quick prompts — one-tap, send immediately. Only on a fresh chat. */}
          {empty && quickPrompts.length > 0 && (
            <div className="mb-2 flex flex-wrap justify-center gap-8">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-full bg-milk-50/60 px-3 py-1.5 text-left text-xs font-medium text-ink-600 transition-colors hover:bg-mint-500/10 hover:text-mint-700 dark:hover:text-mint-500"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-milk-200 bg-milk-50/60 px-2 py-1.5 transition-colors focus-within:border-mint-400/60">
            {/* Active quote pill — click the text to flash its source, ✕ to clear. */}
            {quote !== null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-milk-100/80 py-1 pr-1 pl-1.5">
                <button
                  type="button"
                  onClick={highlightSource}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-label="Jump to quoted text"
                >
                  <span className="w-0.5 shrink-0 self-stretch rounded-full bg-mint-500" />
                  <span className="line-clamp-1 text-xs text-ink-500 italic">
                    {quote}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearQuote}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-milk-200 hover:text-ink-500"
                  aria-label="Remove quote"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Ask the teacher…"
                rows={1}
                className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-milk-50 transition-colors hover:bg-ink-900"
                  aria-label="Stop"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!input.trim()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint-500 text-white transition-colors hover:bg-mint-700 disabled:opacity-40 dark:text-cocoa-950"
                  aria-label="Send"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Floating Reply button above an active text selection (portaled out of
            the dialog so its overflow-hidden body can't clip it). It fades out
            when the selection collapses or the transcript scrolls. */}
        {createPortal(
          <AnimatePresence>
            {replyBtn !== null && (
              <motion.button
                type="button"
                // Keep the selection alive through the click so onClickReply can
                // still read the live range.
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClickReply}
                // Animate opacity only — animating a transform value would make
                // motion overwrite the centering translate below.
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'fixed',
                  left: replyBtn.x,
                  top: replyBtn.y - 8,
                  transform: 'translate(-50%, -100%)',
                }}
                className="z-60 flex items-center gap-1.5 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-milk-50 shadow-lg transition-colors hover:bg-ink-700"
              >
                <Reply className="size-3.5" />
                Reply
              </motion.button>
            )}
          </AnimatePresence>,
          document.body
        )}
      </DialogContent>
    </Dialog>
  );
}

const MessageBubble = forwardRef<
  HTMLDivElement,
  { role: AiMessage['role']; content: string; quotable?: boolean }
>(function MessageBubble({ role, content, quotable }, ref) {
  if (role === 'user') {
    return (
      <div ref={ref} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-mint-500 px-3.5 py-2 text-[0.9375rem] text-white dark:text-cocoa-950">
          {content}
        </div>
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[92%]"
    >
      <div
        data-assistant-msg={quotable ? '' : undefined}
        className="prose prose-sm dark:prose-invert max-w-none rounded-2xl rounded-bl-md bg-milk-100/70 px-3.5 py-2 text-lg! text-ink-800 prose-p:my-1.5 prose-pre:my-2 prose-headings:mt-2 prose-headings:mb-1 prose-ul:my-1.5 prose-ol:my-1.5"
      >
        {content ? (
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        ) : (
          <TypingDots />
        )}
      </div>
    </motion.div>
  );
});

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <AnimatePresence>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-ink-300"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// The completed-teacher-bubble element containing a node, or null. Used to scope
// the Reply button to assistant text and to flash the bubble in the fallback.
function closestAssistant(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  return el?.closest<HTMLElement>('[data-assistant-msg]') ?? null;
}

function formatRelative(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  const min = 60_000;
  const hour = 60 * min;
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (sameDay(d, now)) return d.toLocaleTimeString([], { timeStyle: 'short' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
