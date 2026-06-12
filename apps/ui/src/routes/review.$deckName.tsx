import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type {
  ReviewCard as ReviewCardType,
  ReviewPace,
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
  const [total, setTotal] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [medianMs, setMedianMs] = useState<number | undefined>();
  const [dismiss, setDismiss] = useState<CardDismiss | null>(null);
  const dismissing = useRef(false);

  const settingsQuery = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const r = await fetch('/api/settings');
      if (!r.ok) throw new Error(`settings: ${r.status}`);
      return r.json() as Promise<UserSettings>;
    },
  });
  const cardTilt = settingsQuery.data?.cardTilt ?? true;

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
      const [session, pace] = await Promise.all([
        postJson<{ remaining: number }>(
          `/api/anki/review/start/${encodeURIComponent(decoded)}`
        ),
        fetchJson<ReviewPace>('/api/anki/review-pace').catch(() => null),
      ]);
      setTotal(session.remaining);
      setReviewed(0);
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

  const advanceCard = useCallback(async (countsAsProgress: boolean) => {
    if (countsAsProgress) setReviewed((r) => r + 1);
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
      if (dismissing.current || !card) return;
      dismissing.current = true;

      const nextReview = card.nextReviews[buttonIndex] ?? '';
      const countsAsProgress = !isShortInterval(nextReview);
      const direction = isShortInterval(nextReview) ? 'left' : 'right';
      setDismiss({ direction, color: DISMISS_COLOR[ease] ?? DISMISS_COLOR[3] });

      setTimeout(async () => {
        try {
          await postJson('/api/anki/review/answer', { ease });
          await advanceCard(countsAsProgress);
        } catch {
          await advanceCard(countsAsProgress);
        }
      }, 420);
    },
    [card, advanceCard]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
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
  }, [phase, card, handleFlip, handleAnswer]);

  const handleReschedule = useCallback(
    async (days: number) => {
      if (!card) return;
      try {
        await postJson('/api/anki/review/answer', { ease: 3 });
        await postJson('/api/anki/review/reschedule', {
          cardId: card.cardId,
          days,
        });
        await advanceCard(true);
      } catch {
        await advanceCard(true);
      }
    },
    [card, advanceCard]
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
    </div>
  );
}
