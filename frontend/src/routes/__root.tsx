import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import Header from "../components/Header";

import appCss from "../styles.css?url";
import { DimProvider } from "@/contexts/dim-context";
import DialogProvider from "@/contexts/dialog-provider";
import KeybindProvider from "@/contexts/keybind-provider";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Dagger",
        description: "Work with DAGs",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = useRouteContext({ from: "__root__" });

  return (
    <QueryClientProvider client={queryClient}>
      <DimProvider>
        <RootDocument>
          <DialogProvider>
            <KeybindProvider>
              <Header />
              <Outlet />
            </KeybindProvider>
          </DialogProvider>
        </RootDocument>
      </DimProvider>
    </QueryClientProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof global === 'undefined') {
                var global = globalThis;
              }
            `,
          }}
        />
      </head>
      <body className="h-full">
        <div className="flex flex-col w-full h-screen border border-brand-grey-3 bg-brand-white p-px text-brand-blue-3">
          {children}
        </div>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <ReactQueryDevtools initialIsOpen={false} />
        <Scripts />
      </body>
    </html>
  );
}
