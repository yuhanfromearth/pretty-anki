import { motion } from 'motion/react';

export interface CardDismiss {
  direction: 'left' | 'right';
  color: string;
}

interface ReviewCardProps {
  cardId: number;
  question: string;
  answer: string;
  flipped: boolean;
  dismiss: CardDismiss | null;
  onFlip: () => void;
}

export function ReviewCard({
  cardId,
  question,
  answer,
  flipped,
  dismiss,
  onFlip,
}: ReviewCardProps) {
  return (
    <motion.div
      key={cardId}
      className="relative w-full cursor-pointer select-none"
      style={{ perspective: 1200 }}
      onClick={dismiss ? undefined : onFlip}
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
      <motion.div
        className="relative h-80 w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Front — question */}
        <div
          className="absolute inset-0 overflow-hidden rounded-3xl border border-milk-200/60 bg-milk-50/95 shadow-medium"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(234,219,200,0.3)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(247,236,210,0.05)_0%,transparent_60%)]" />
          <div className="relative flex h-full flex-col items-center justify-center px-10">
            <p className="text-center font-korean text-6xl leading-tight text-ink-900">
              {question}
            </p>
            <span className="mt-8 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-300">
              tap to reveal
            </span>
          </div>
        </div>

        {/* Back — answer */}
        <div
          className="absolute inset-0 overflow-hidden rounded-3xl border border-milk-200/60 bg-milk-50/95 shadow-medium"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(127,179,154,0.1)_0%,transparent_55%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(90,153,120,0.05)_0%,transparent_55%)]" />
          <div className="relative flex h-full flex-col items-center justify-center px-10">
            <p className="text-center font-korean text-6xl leading-tight text-ink-900">
              {question}
            </p>

            <div className="mx-auto mt-6 mb-5 h-px w-24 bg-milk-300/80" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
              meaning
            </span>

            <p className="mt-3 text-center font-display text-2xl font-medium text-ink-900">
              {answer}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
