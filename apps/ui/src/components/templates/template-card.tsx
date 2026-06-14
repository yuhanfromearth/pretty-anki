import { motion } from 'motion/react';
import type { Block, NoteFields } from '@nts/shared';
import { TemplateFace, useScopedCss } from './template-face';

/** Renders an app-native Template layout — ordered Front/Back block stacks — in
 *  the same card chrome as the review screen (rounded panel, gradient, 3D
 *  flip), but driven by the user's blocks rather than the hardcoded
 *  question/answer scaffold. The faces come from the shared `TemplateFace`, the
 *  same renderer the live review/manage cards use, so what you build equals what
 *  you study. */
export function TemplateCard({
  front,
  back,
  fields,
  css,
  flipped,
  onFlip,
}: {
  front: Block[];
  back: Block[];
  fields: NoteFields;
  css?: string;
  flipped: boolean;
  onFlip: () => void;
}) {
  // Scope custom CSS to this card instance so it can't leak into the app shell.
  const { scope, scopedCss } = useScopedCss(css);

  return (
    <div style={{ perspective: 1200 }} className={`tmpl-${scope}`}>
      {scopedCss && <style>{scopedCss}</style>}
      <motion.div
        className="relative grid min-h-96 w-full cursor-pointer select-none"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={onFlip}
      >
        <TemplateFace blocks={front} fields={fields} side="front" />
        <TemplateFace
          blocks={back}
          fields={fields}
          side="back"
          backface
          frontBlocks={front}
        />
      </motion.div>
    </div>
  );
}
