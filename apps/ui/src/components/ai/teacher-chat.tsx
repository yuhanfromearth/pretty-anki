import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Plus,
  ArrowUp,
  Square,
  History,
  X,
  MessageSquareText,
  Trash2,
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
  context: AiCardContext;
}

export function TeacherChat({
  open,
  onOpenChange,
  noteId,
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

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText(null);
    setError(null);
    setSelectedId(null);
    setMessages([]);
    setInput('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const switchTo = useCallback((id: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText(null);
    setError(null);
    setSelectedId(id);
  }, []);

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
      const text = (override ?? input).trim();
      if (!text || streaming) return;

      const base = messages;
      const userMsg: AiMessage = { role: 'user', content: text };
      if (fromComposer) setInput('');
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
        // Only return the text to the composer for a composer-originated send;
        // a quick-prompt send must leave any existing draft intact.
        if (failed && fromComposer) setInput(text);
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
    [input, streaming, messages, selectedId, noteId, context, queryClient]
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
          <div className="flex items-end gap-2 rounded-2xl border border-milk-200 bg-milk-50/60 px-2 py-1.5 transition-colors focus-within:border-mint-400/60">
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
      </DialogContent>
    </Dialog>
  );
}

const MessageBubble = forwardRef<
  HTMLDivElement,
  { role: AiMessage['role']; content: string }
>(function MessageBubble({ role, content }, ref) {
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
      <div className="prose prose-sm dark:prose-invert max-w-none rounded-2xl rounded-bl-md bg-milk-100/70 px-3.5 py-2 text-lg! text-ink-800 prose-p:my-1.5 prose-pre:my-2 prose-headings:mt-2 prose-headings:mb-1 prose-ul:my-1.5 prose-ol:my-1.5">
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
