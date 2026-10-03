import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template for Expo Router Web.
 * This runs directly in the browser DOM before JS bundles finish executing,
 * preventing any raw/unstyled layout shifts or flashes on web refresh.
 */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover"
        />
        <title>SpeakwithMaya — Practice · Improve · Be Confident</title>

        {/* Expo Router style reset */}
        <ScrollViewStyleReset />

        {/* Global base styles for pure white backdrop during initial DOM loading */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                height: 100%;
                margin: 0;
                padding: 0;
                background-color: #FFFFFF;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              #root {
                display: flex;
                flex-direction: column;
                height: 100%;
                min-height: 100vh;
                background-color: #FFFFFF;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
