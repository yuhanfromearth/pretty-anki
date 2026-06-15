import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import type { AiCardContext, AiMessage } from '@nts/shared';
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

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // On each open, default to the most-recent conversation (or a fresh chat when
  // the note has none). Reset the guard when the dialog closes.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current || !listQuery.data) return;
    initializedRef.current = true;
    setSelectedId(listQuery.data.conversations[0]?.id ?? null);
  }, [open, listQuery.data]);

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

  // Keep the transcript pinned to the latest line as it grows / streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

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

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const base = messages;
    const userMsg: AiMessage = { role: 'user', content: text };
    setInput('');
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
      if (failed) setInput(text);
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
  }, [input, streaming, messages, selectedId, noteId, context, queryClient]);

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const conversations = listQuery.data?.conversations ?? [];
  const empty = messages.length === 0 && streamingText === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[600px] max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0">
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
              <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                <PopoverTrigger
                  className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-400 transition-colors hover:bg-milk-100 hover:text-ink-700"
                  aria-label="Conversation history"
                >
                  <History className="size-3.5" />
                  History
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1.5" align="end">
                  <p className="px-2 py-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-ink-300 uppercase">
                    Conversations
                  </p>
                  <div className="max-h-72 overflow-y-auto">
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          switchTo(c.id);
                          setHistoryOpen(false);
                        }}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-milk-100 ${
                          c.id === selectedId ? 'bg-milk-100' : ''
                        }`}
                      >
                        <span className="font-mono text-[10px] text-ink-300">
                          {formatRelative(c.updatedAt)}
                        </span>
                        <span className="line-clamp-1 text-xs text-ink-700">
                          {c.snippet || 'New conversation'}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <button
              type="button"
              onClick={startNewChat}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-400 transition-colors hover:bg-milk-100 hover:text-ink-700"
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
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
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
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}

          {streamingText !== null && (
            <MessageBubble role="assistant" content={streamingText} />
          )}

          {error && (
            <div className="rounded-xl border border-terra/30 bg-terra/10 px-3 py-2 text-xs text-terra">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-milk-200/70 p-3">
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

function MessageBubble({
  role,
  content,
}: {
  role: AiMessage['role'];
  content: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-mint-500 px-3.5 py-2 text-sm text-white dark:text-cocoa-950">
          {content}
        </div>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[92%]"
    >
      <div className="prose prose-sm dark:prose-invert max-w-none rounded-2xl rounded-bl-md bg-milk-100/70 px-3.5 py-2 text-ink-800 prose-p:my-1.5 prose-pre:my-2 prose-headings:mt-2 prose-headings:mb-1 prose-ul:my-1.5 prose-ol:my-1.5">
        {content ? (
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        ) : (
          <TypingDots />
        )}
      </div>
    </motion.div>
  );
}

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
