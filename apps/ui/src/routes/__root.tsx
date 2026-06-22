import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';

import appCss from '../styles.css?url';
import { Header } from '../components/header';

import type { QueryClient } from '@tanstack/react-query';

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'pretty anki',
      },
    ],
    links: [
      // Fonts are self-hosted (bundled via @fontsource in fonts.css → styles.css)
      // so the app renders correct typography offline, with no Google Fonts request.
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('theme');if(!t||(t!=='light'&&t!=='dark')){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className="h-dvh overflow-hidden flex flex-col"
        style={{ background: 'var(--page-bg)', backgroundAttachment: 'fixed' }}
      >
        <Header />
        <main className="min-h-0 flex-1 max-w-5xl w-full mx-auto px-5 sm:px-8 pt-2 pb-6">
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  );
}
