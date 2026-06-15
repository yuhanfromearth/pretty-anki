import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Undo2, Sparkles } from 'lucide-react';
import type {
  ReviewCard as ReviewCardType,
  ReviewPace,
  ReviewSession,
  UserSettings,
} from '@nts/shared';
import {
  ReviewCard,
  type CardDismiss,
  type ReviewCardTemplate,
} from '#/components/review/review-card';
import { AnswerBar } from '#/components/review/answer-bar';
import { ReviewProgress } from '#/components/review/review-progress';
import { ReviewComplete } from '#/components/review/review-complete';
import { TeacherChat } from '#/components/ai/teacher-chat';
import { playCorrectSound, playSwipeSound } from '#/lib/sounds';
import {
  fetchTemplate,
  fetchTemplates,
  templateKey,
  templatesKey,
} from '#/components/templates/api';

export const Route = createFileRoute('/review/$deckName')({
  component: ReviewPage,
});

async function safeJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return safeJson<T>(r);
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return safeJson<T>(r);
}

type Phase = 'loading' | 'question' | 'answer' | 'done' | 'error';

const DISMISS_COLOR: Record<number, string> = {
  1: 'rgba(216,138,124,0.35)',
  2: 'rgba(226,180,142,0.35)',
  3: 'rgba(127,179,154,0.35)',
  4: 'rgba(168,197,214,0.35)',
};

function isShortInterval(s: string): boolean {
  if (/[dhy]/i.test(s)) return false; // days, hours and years count as long interval
  return !s.includes('mo'); // m counts as short interval - but not mo
}

function ReviewPage() {
  const { deckName } = Route.useParams();
  const decoded = decodeURIComponent(deckName);

  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<ReviewCardType | null>(null);
  // The server baseline for this deck at session start (today's reviews so far,
  // the day total, and the live remaining count). The progress bar is derived
  // from this plus the in-session counters below, so the daily-progress toggle
  // reflects instantly without reseeding or losing this visit's work.
  const [session, setSession] = useState<ReviewSession | null>(null);
  // Cards answered this visit, split by whether the chosen interval keeps them
  // in today's queue (short) or graduates them out of it (long).
  const [sessionShort, setSessionShort] = useState(0);
  const [sessionLong, setSessionLong] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [medianMs, setMedianMs] = useState<number | undefined>();
  const [dismiss, setDismiss] = useState<CardDismiss | null>(null);
  const dismissing = useRef(false);
  // Stack of answered cards, newest last, so the user can step back to re-rate a
  // card whose ease they mis-tapped. Each entry records whether the answer kept
  // the card in today's queue (so undo decrements the right counter) and how
  // many Anki undo steps it took — a reschedule is an answer plus a setDueDate.
  const [history, setHistory] = useState<{ isShort: boolean; steps: number }[]>(
    []
  );
  const [undoing, setUndoing] = useState(false);
  const undoingRef = useRef(false);
  // The AI teacher chat, available only once the answer is revealed and an
  // OpenRouter key is configured.
  const [chatOpen, setChatOpen] = useState(false);
  // Refresh the header streak once per session — the first answered card may be
  // the first review of the day, which flips the badge from frozen to active
  // and rolls the count up. Guarded so we don't refetch on every card.
  const streakRefreshed = useRef(false);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const r = await fetch('/api/settings');
      if (!r.ok) throw new Error(`settings: ${r.status}`);
      return r.json() as Promise<UserSettings>;
    },
  });
  const cardTilt = settingsQuery.data?.cardTilt ?? true;
  const soundEffects = settingsQuery.data?.soundEffects ?? true;
  const hasApiKey = settingsQuery.data?.hasApiKey ?? false;
  // When on, the bar spans the whole day: it resumes today's earlier reviews
  // after a refresh and its total only ever grows. Off restores the old
  // per-session bar that starts at zero each visit.
  const dailyProgress = settingsQuery.data?.dailyProgress ?? true;

  // Progress bar values, derived (not stored) so toggling daily-progress — or
  // undoing — is reflected immediately. Daily mode resumes from the server
  // baseline and counts every answer; a short interval also grows the day total
  // (the card stays in today's queue). Per-session mode counts only this visit's
  // graduated cards against the fixed remaining count.
  let reviewed = 0;
  let total = 0;
  if (session) {
    if (dailyProgress) {
      reviewed = session.reviewedToday + sessionLong + sessionShort;
      total = session.dayTotal + sessionShort;
    } else {
      reviewed = sessionLong;
      total = session.remaining;
    }
  }

  // Resolve the current note type to its app-native Template so the live card
  // renders with the same roles + custom CSS as the builder/manage previews.
  // Notes carry only modelName, so map it to a modelId via the templates list,
  // then load the saved layout when the type has been customized. Cloze and
  // never-customized types stay on the question/answer scaffold fallback.
  const templatesQuery = useQuery({
    queryKey: templatesKey,
    queryFn: fetchTemplates,
    retry: false,
  });
  const summary = templatesQuery.data?.templates.find(
    (t) => t.name === card?.modelName
  );
  const useTemplate = !!summary && summary.customized && !summary.isCloze;
  const detailQuery = useQuery({
    queryKey: templateKey(summary?.modelId ?? -1),
    queryFn: () => fetchTemplate(summary!.modelId),
    enabled: useTemplate,
    retry: false,
  });
  // Each card template (direction) has its own layout, so render the one for
  // this card's ord — that's how a reversed note type shows different fields
  // forward vs. reverse. Falls back to the first card if the ord is unknown.
  const cards = detailQuery.data?.cards;
  const cardLayout = cards?.find((c) => c.ord === card?.ord) ?? cards?.[0];
  const template: ReviewCardTemplate | null =
    useTemplate && cardLayout
      ? {
          front: cardLayout.layout.front,
          back: cardLayout.layout.back,
          css: detailQuery.data?.css,
        }
      : null;

  const startSession = useCallback(async () => {
    try {
      setPhase('loading');
      const [newSession, pace] = await Promise.all([
        postJson<ReviewSession>(
          `/api/anki/review/start/${encodeURIComponent(decoded)}`
        ),
        fetchJson<ReviewPace>('/api/anki/review-pace').catch(() => null),
      ]);
      setSession(newSession);
      setSessionShort(0);
      setSessionLong(0);
      setHistory([]);
      if (pace) setMedianMs(pace.medianMs);

      const current = await fetchJson<ReviewCardType | null>(
        '/api/anki/review/current'
      );
      if (!current) {
        setPhase('done');
        return;
      }
      setCard(current);
      setFlipped(false);
      setPhase('question');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start review');
      setPhase('error');
    }
  }, [decoded]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const handleFlip = useCallback(async () => {
    if (phase !== 'question') return;
    try {
      await postJson('/api/anki/review/show-answer');
      setFlipped(true);
      setPhase('answer');
    } catch {
      setFlipped(true);
      setPhase('answer');
    }
  }, [phase]);

  const refreshStreakOnce = useCallback(() => {
    if (streakRefreshed.current) return;
    streakRefreshed.current = true;
    queryClient.invalidateQueries({ queryKey: ['streak'] });
  }, [queryClient]);

  const advanceCard = useCallback(async () => {
    try {
      const next = await fetchJson<ReviewCardType | null>(
        '/api/anki/review/current'
      );
      setDismiss(null);
      dismissing.current = false;
      if (!next) {
        setPhase('done');
        return;
      }
      setCard(next);
      setFlipped(false);
      setPhase('question');
    } catch {
      setDismiss(null);
      dismissing.current = false;
      setPhase('done');
    }
  }, []);

  const handleAnswer = useCallback(
    (ease: number, buttonIndex: number) => {
      if (dismissing.current || undoingRef.current || !card) return;
      dismissing.current = true;

      const nextReview = card.nextReviews[buttonIndex] ?? '';
      const isShort = isShortInterval(nextReview);
      const direction = isShort ? 'left' : 'right';
      if (soundEffects) {
        if (direction === 'right') playCorrectSound();
        else playSwipeSound();
      }
      setDismiss({ direction, color: DISMISS_COLOR[ease] ?? DISMISS_COLOR[3] });

      const countAnswer = () =>
        isShort ? setSessionShort((s) => s + 1) : setSessionLong((s) => s + 1);

      setTimeout(async () => {
        try {
          await postJson('/api/anki/review/answer', { ease });
          setHistory((h) => [...h, { isShort, steps: 1 }]);
          countAnswer();
          refreshStreakOnce();
          await advanceCard();
        } catch {
          countAnswer();
          await advanceCard();
        }
      }, 420);
    },
    [card, advanceCard, refreshStreakOnce, soundEffects]
  );

  // Step back to the previous card via Anki's undo stack and reveal its answer,
  // so a mis-tapped ease can be corrected. Roll back the in-session counter the
  // answer bumped so the progress bar follows.
  const handleUndo = useCallback(async () => {
    if (dismissing.current || undoingRef.current || !card) return;
    if (phase !== 'question' && phase !== 'answer') return;
    if (history.length === 0) return;

    undoingRef.current = true;
    setUndoing(true);
    const last = history[history.length - 1];
    const fromId = card.cardId;
    try {
      // The server steps Anki's undo stack and waits until the reviewer has
      // actually navigated back, so the returned card is the previous one with
      // its answer already revealed. If the id is unchanged, undo was a no-op
      // (nothing to undo) — leave everything as-is.
      const prev = await postJson<ReviewCardType | null>(
        '/api/anki/review/undo',
        { cardId: fromId, steps: last.steps, deckName: decoded }
      );
      if (!prev || prev.cardId === fromId) return;
      setHistory((h) => h.slice(0, -1));
      if (last.isShort) setSessionShort((s) => Math.max(0, s - 1));
      else setSessionLong((s) => Math.max(0, s - 1));
      setDismiss(null);
      setCard(prev);
      // Return on the question side so the card can be re-read before re-rating.
      setFlipped(false);
      setPhase('question');
    } catch {
      // Undo unavailable (Anki busy / offline) — leave the current card.
    } finally {
      undoingRef.current = false;
      setUndoing(false);
    }
  }, [card, history, phase, decoded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      // While the teacher chat is open it owns the keyboard; ignore review
      // shortcuts so typing doesn't rate cards or trigger undo.
      if (chatOpen) return;
      if (e.key === '/' && phase === 'answer' && hasApiKey) {
        e.preventDefault();
        setChatOpen(true);
        return;
      }
      if ((e.key === 'z' || e.key === 'Z') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (phase === 'question') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleFlip();
        }
        return;
      }
      if (phase !== 'answer' || !card) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const idx = card.buttons.indexOf(3);
        if (idx !== -1) handleAnswer(3, idx);
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 4) {
        const idx = card.buttons.indexOf(num);
        if (idx !== -1) handleAnswer(num, idx);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, card, handleFlip, handleAnswer, handleUndo, chatOpen, hasApiKey]);

  // Close the chat whenever the card changes so it never carries one note's
  // conversation onto the next.
  useEffect(() => {
    setChatOpen(false);
  }, [card?.noteId]);

  const handleReschedule = useCallback(
    async (days: number) => {
      if (!card) return;
      try {
        await postJson('/api/anki/review/answer', { ease: 3 });
        await postJson('/api/anki/review/reschedule', {
          cardId: card.cardId,
          days,
        });
        // A reschedule sends the card out to a future day, so it leaves today's
        // queue — a long clear that advances the bar in either mode.
        setHistory((h) => [...h, { isShort: false, steps: 2 }]);
        setSessionLong((s) => s + 1);
        refreshStreakOnce();
        await advanceCard();
      } catch {
        setSessionLong((s) => s + 1);
        await advanceCard();
      }
    },
    [card, advanceCard, refreshStreakOnce]
  );

  if (phase === 'done') {
    return <ReviewComplete deckName={decoded} reviewed={reviewed} />;
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-terra/30 bg-terra/10">
          <span className="text-2xl">⚡</span>
        </div>
        <h2 className="text-lg font-semibold text-ink-900">
          Review unavailable
        </h2>
        <p className="max-w-xs text-sm text-ink-500">{errorMsg}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-mint-500 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors hover:bg-mint-700 dark:text-cocoa-950"
        >
          <ArrowLeft className="size-4" />
          Back to decks
        </Link>
      </div>
    );
  }

  if (phase === 'loading' || !card) {
    return (
      <div className="flex items-center gap-3 py-24 justify-center text-ink-300 text-sm">
        <span className="size-4 rounded-full border-2 border-ink-100 border-t-mint-500 animate-spin" />
        Starting review...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <ReviewProgress reviewed={reviewed} total={total} medianMs={medianMs} />

      <div className="mx-auto w-full max-w-2xl pt-4">
        {/* Step back to re-rate the previous card — height reserved so the card
            below doesn't jump when the control appears after the first answer. */}
        <div className="mb-3 flex h-8 items-center">
          <AnimatePresence>
            {history.length > 0 && (
              <motion.button
                key="undo"
                onClick={handleUndo}
                disabled={undoing}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                whileTap={{ scale: 0.96 }}
                className="group inline-flex items-center gap-2 rounded-full border border-milk-200/70 bg-milk-50/80 py-1.5 pl-2.5 pr-3 text-xs font-medium text-ink-400 shadow-soft transition-colors hover:border-milk-300 hover:bg-milk-100 hover:text-ink-700 disabled:cursor-wait disabled:opacity-50"
              >
                <Undo2 className="size-3.5 transition-transform group-hover:-rotate-12" />
                previous card
                <kbd className="ml-0.5 rounded border border-milk-300/70 bg-milk-200/50 px-1 font-mono text-[10px] leading-tight text-ink-300">
                  Z
                </kbd>
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === 'answer' && (
              <motion.button
                key="teacher"
                onClick={() => setChatOpen(true)}
                disabled={!hasApiKey}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                whileTap={hasApiKey ? { scale: 0.96 } : undefined}
                title={
                  hasApiKey
                    ? undefined
                    : 'Add an OpenRouter API key in settings to ask the teacher'
                }
                className="group ml-auto inline-flex items-center gap-2 rounded-full border border-milk-200/70 bg-milk-50/80 py-1.5 pl-2.5 pr-2 text-xs font-medium text-ink-400 shadow-soft transition-colors hover:border-mint-300 hover:bg-mint-50 hover:text-mint-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-milk-200/70 disabled:hover:bg-milk-50/80 disabled:hover:text-ink-400"
              >
                <Sparkles className="size-3.5 transition-transform group-hover:scale-110 group-disabled:scale-100" />
                teacher
                <kbd className="ml-0.5 rounded border border-milk-300/70 bg-milk-200/50 px-1 font-mono text-[10px] leading-tight text-ink-300">
                  /
                </kbd>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <ReviewCard
          cardId={card.cardId}
          noteId={card.noteId}
          deckName={decoded}
          question={card.question}
          answer={card.answer}
          questionAudio={card.questionAudio}
          answerAudio={card.answerAudio}
          flipped={flipped}
          dismiss={dismiss}
          tilt={cardTilt}
          onFlip={handleFlip}
          fields={card.fields}
          template={template}
        />

        <div className="mt-8">
          <AnswerBar
            visible={phase === 'answer'}
            buttons={card.buttons}
            nextReviews={card.nextReviews}
            onAnswer={handleAnswer}
            onReschedule={handleReschedule}
          />
        </div>
      </div>

      <TeacherChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        noteId={card.noteId}
        context={{ modelName: card.modelName, fields: card.fields }}
      />
    </div>
  );
}
