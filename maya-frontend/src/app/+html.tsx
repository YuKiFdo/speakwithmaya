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

        {/* Global base styles & Instant Zero-JS Pre-Bundle Loading Screen */}
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
              #app-initial-loader {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100vw;
                height: 100dvh;
                min-height: -webkit-fill-available;
                background-color: #FFFFFF;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                transition: opacity 0.25s ease-out;
                pointer-events: auto;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              }
              .loader-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 32px 24px;
                width: 100%;
                max-width: 400px;
                box-sizing: border-box;
                text-align: center;
                margin: auto;
              }
              .brand-row {
                margin-bottom: 28px;
              }
              .brand-title {
                font-size: 24px;
                font-weight: 800;
                color: #0F172A;
                letter-spacing: -0.6px;
              }
              .brand-title span {
                color: #0057FF;
              }
              .brand-tagline {
                font-size: 12.5px;
                font-weight: 400;
                color: #64748B;
                margin-top: 4px;
                letter-spacing: 0.2px;
              }
              .avatar-area {
                width: 130px;
                height: 130px;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 28px;
              }
              .pulse-aura {
                position: absolute;
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background-color: #0057FF;
                animation: mayaPulse 1.8s ease-out infinite;
              }
              .avatar-wrapper {
                width: 92px;
                height: 92px;
                border-radius: 50%;
                padding: 3px;
                background-color: #FFFFFF;
                z-index: 2;
                box-shadow: 0 12px 32px rgba(0, 87, 255, 0.22);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: mayaFloat 2.4s ease-in-out infinite;
                box-sizing: border-box;
              }
              .avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
              }
              .progress-track {
                width: 180px;
                height: 4px;
                border-radius: 2px;
                background-color: #F1F5F9;
                overflow: hidden;
                position: relative;
                margin-bottom: 14px;
              }
              .progress-bar {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 60px;
                border-radius: 2px;
                background-color: #0057FF;
                animation: mayaProgress 1.4s ease-in-out infinite;
              }
              .loading-msg {
                font-size: 13px;
                color: #64748B;
                letter-spacing: 0.1px;
              }
              @keyframes mayaFloat {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-6px); }
              }
              @keyframes mayaPulse {
                0% { transform: scale(1); opacity: 0.4; }
                40% { opacity: 0.2; }
                100% { transform: scale(1.45); opacity: 0; }
              }
              @keyframes mayaProgress {
                0% { transform: translateX(-60px); }
                100% { transform: translateX(200px); }
              }
            `,
          }}
        />
      </head>
      <body>
        <div id="app-initial-loader">
          <div className="loader-card">
            <div className="brand-row">
              <div className="brand-title">Speakwith<span>Maya</span></div>
              <div className="brand-tagline">Practice · Improve · Be Confident</div>
            </div>
            <div className="avatar-area">
              <div className="pulse-aura"></div>
              <div className="avatar-wrapper">
                <img src="/maya-avatar.png" alt="Maya AI" className="avatar-img" />
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-bar"></div>
            </div>
            <div className="loading-msg">Loading SpeakwithMaya...</div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
