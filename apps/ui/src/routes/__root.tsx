import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
// import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
// import { TanStackDevtools } from "@tanstack/react-devtools";
// import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

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
      <body className="min-h-dvh bg-fixed bg-[radial-gradient(60%_50%_at_80%_0%,rgba(226,180,142,0.2)_0%,transparent_60%),radial-gradient(50%_40%_at_0%_100%,rgba(216,138,124,0.15)_0%,transparent_55%)]">
        <Header />
        <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 pb-16">
          {children}
        </main>
        {/*<TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />*/}
        <Scripts />
      </body>
    </html>
  );
}
