import { Link } from '@tanstack/react-router';

export function Header() {
  return (
    <header className="max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-4">
      <nav className="flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-mint-500 shadow-[0_0_0_4px_var(--color-mint-100)]" />
          <span className="font-display text-lg font-medium tracking-tight text-ink-900">
            pretty-anki
          </span>
        </Link>
      </nav>
    </header>
  );
}
