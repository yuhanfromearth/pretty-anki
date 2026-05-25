import { motion } from 'motion/react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check } from 'lucide-react';

interface ReviewCompleteProps {
  deckName: string;
  reviewed: number;
}

export function ReviewComplete({ deckName, reviewed }: ReviewCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex flex-col items-center justify-center gap-6 py-16"
    >
      <div className="flex size-20 items-center justify-center rounded-full border border-mint-100 bg-mint-50">
        <Check className="size-8 text-mint-700" />
      </div>

      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-ink-900">
          All done
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          You reviewed{' '}
          <span className="font-mono font-semibold text-ink-700">
            {reviewed}
          </span>{' '}
          card{reviewed !== 1 && 's'} in{' '}
          <span className="font-semibold text-ink-700">{deckName}</span>
        </p>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full bg-mint-500 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-mint-700 dark:text-cocoa-950"
      >
        <ArrowLeft className="size-4" />
        Back to decks
      </Link>
    </motion.div>
  );
}
