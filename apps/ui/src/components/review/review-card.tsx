import { motion, useMotionValue, useSpring } from 'motion/react';
import { Volume2, Pencil } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useRef, useCallback, useEffect } from 'react';

export interface CardDismiss {
  direction: 'left' | 'right';
  color: string;
}

interface ReviewCardProps {
  cardId: number;
  noteId: number;
  deckName: string;
  question: string;
  answer: string;
  audio: string[];
  flipped: boolean;
  dismiss: CardDismiss | null;
  tilt?: boolean;
  onFlip: () => void;
}

function textLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').length;
}

function questionSize(text: string): string {
  const len = textLength(text);
  if (len > 200) return 'text-lg';
  if (len > 100) return 'text-2xl';
  if (len > 40) return 'text-4xl';
  return 'text-6xl';
}

function answerSize(text: string): string {
  const len = textLength(text);
  if (len > 200) return 'text-base';
  if (len > 100) return 'text-lg';
  return 'text-2xl';
}

const MAX_TILT = 8;
const SPRING_CONFIG = { stiffness: 300, damping: 25, mass: 0.5 };

function useTilt(enabled: boolean) {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, SPRING_CONFIG);
  const springY = useSpring(rotateY, SPRING_CONFIG);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      rotateX.set(-y * MAX_TILT);
      rotateY.set(x * MAX_TILT);
    },
    [enabled, rotateX, rotateY]
  );

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return { springX, springY, onMouseMove, onMouseLeave };
}

export function ReviewCard({
  cardId,
  noteId,
  deckName,
  question,
  answer,
  audio,
  flipped,
  dismiss,
  tilt = true,
  onFlip,
}: ReviewCardProps) {
  const qSize = questionSize(question);
  const aSize = answerSize(answer);
  const backQSize = questionSize(question).replace('text-6xl', 'text-4xl');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tiltEnabled = tilt && !flipped && !dismiss;
  const { springX, springY, onMouseMove, onMouseLeave } = useTilt(tiltEnabled);

  useEffect(() => {
    if (!tiltEnabled) onMouseLeave();
  }, [tiltEnabled, onMouseLeave]);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, [cardId]);

  const playAudio = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!audio.length) return;
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        return;
      }
      const el = new Audio(`/api/anki/media/${encodeURIComponent(audio[0])}`);
      audioRef.current = el;
      el.play();
    },
    [audio]
  );

  const hasAudio = audio.length > 0;

  return (
    <div
      style={{ perspective: 1200 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <motion.div
        key={cardId}
        className={`relative w-full ${flipped ? 'cursor-default' : 'cursor-pointer select-none'}`}
        style={{ rotateX: springX, rotateY: springY }}
        onClick={dismiss || flipped ? undefined : onFlip}
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{
          x: dismiss ? (dismiss.direction === 'left' ? -80 : 80) : 0,
          opacity: dismiss ? 0 : 1,
          scale: dismiss ? 1.06 : 1,
          filter: dismiss ? 'blur(12px)' : 'blur(0px)',
        }}
        transition={
          dismiss
            ? { duration: 0.4, ease: [0.4, 0, 1, 1] }
            : { duration: 0.25, ease: 'easeOut' }
        }
      >
        {/* Color flood overlay */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
          animate={{
            opacity: dismiss ? 1 : 0,
            backgroundColor: dismiss ? dismiss.color : 'rgba(0,0,0,0)',
          }}
          transition={{ duration: 0.08 }}
        />
        {/* Edit link — stays top-right through flip/tilt */}
        <Link
          to="/manage/$deckName"
          params={{ deckName }}
          search={{ noteId }}
          title="Edit card"
          aria-label="Edit card"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full border border-milk-300/80 bg-milk-100/80 text-ink-400 transition-colors hover:bg-milk-200 hover:text-ink-600 active:scale-95"
        >
          <Pencil className="size-3.5" />
        </Link>
        <motion.div
          className="relative grid min-h-96 w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Front — question */}
          <div
            className="col-start-1 row-start-1 overflow-hidden rounded-3xl border border-milk-200/60 bg-milk-50/95 shadow-medium"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(234,219,200,0.3)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(247,236,210,0.05)_0%,transparent_60%)]" />
            <div className="relative flex h-full flex-col items-center justify-center px-10 py-10">
              <div
                className={`text-center font-korean ${qSize} leading-tight text-ink-900`}
                dangerouslySetInnerHTML={{ __html: question }}
              />
              {hasAudio && (
                <button
                  onClick={playAudio}
                  className="mt-6 flex size-10 items-center justify-center rounded-full border border-milk-300/80 bg-milk-100/80 text-ink-400 transition-colors hover:bg-milk-200 hover:text-ink-600 active:scale-95"
                >
                  <Volume2 className="size-4" />
                </button>
              )}
              <span className="mt-8 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-300">
                tap to reveal
              </span>
            </div>
          </div>

          {/* Back — answer */}
          <div
            className="col-start-1 row-start-1 overflow-hidden rounded-3xl border border-milk-200/60 bg-milk-50/95 shadow-medium"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(127,179,154,0.1)_0%,transparent_55%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(90,153,120,0.05)_0%,transparent_55%)]" />
            <div className="relative flex h-full flex-col items-center justify-center px-10 py-10">
              <div
                className={`text-center font-korean ${backQSize} leading-tight text-ink-900`}
                dangerouslySetInnerHTML={{ __html: question }}
              />
              {hasAudio && (
                <button
                  onClick={playAudio}
                  className="mt-4 flex size-9 items-center justify-center rounded-full border border-milk-300/80 bg-milk-100/80 text-ink-400 transition-colors hover:bg-milk-200 hover:text-ink-600 active:scale-95"
                >
                  <Volume2 className="size-3.5" />
                </button>
              )}

              <div className="mx-auto mt-6 mb-5 h-px w-24 bg-milk-300/80" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
                meaning
              </span>

              <div
                className={`mt-3 text-center font-display ${aSize} font-medium text-ink-900`}
                dangerouslySetInnerHTML={{ __html: answer }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
