import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template for Expo Router Web.
 * Matches the modern AI-Voice DesktopLoadingScreen structure pixel-for-pixel.
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
        <meta name="theme-color" content="#FFFFFF" />
        <title>SpeakwithMaya — Practice · Improve · Be Confident</title>

        {/* Preconnect & High-Speed Google Fonts CDN (WOFF2 instant browser caching) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Expo Router style reset */}
        <ScrollViewStyleReset />

        {/* Global base styles & Instant Zero-JS Pre-Bundle Loading Screen */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                height: 100%;
                height: 100dvh;
                margin: 0;
                padding: 0;
                background-color: #FFFFFF;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                -webkit-tap-highlight-color: transparent;
                overscroll-behavior: none;
                overflow: hidden;
              }
              #root {
                display: flex;
                flex-direction: column;
                height: 100%;
                height: 100dvh;
                max-height: 100dvh;
                min-height: 100%;
                overflow: hidden;
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
                overflow: hidden;
                z-index: 99999;
                transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.28s;
                pointer-events: auto;
                user-select: none;
                -webkit-user-select: none;
                font-family: "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              }
              .bg-orb-top {
                position: absolute;
                top: -120px;
                width: 320px;
                height: 320px;
                border-radius: 50%;
                background-color: #F0F7FF;
                opacity: 0.7;
                pointer-events: none;
              }
              .bg-orb-bottom {
                position: absolute;
                bottom: -140px;
                width: 300px;
                height: 300px;
                border-radius: 50%;
                background-color: #F8FAFC;
                opacity: 0.9;
                pointer-events: none;
              }
              .loader-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 32px 24px;
                width: 100%;
                max-width: 380px;
                box-sizing: border-box;
                text-align: center;
                margin: auto;
                position: relative;
                z-index: 2;
                animation: mayaCardEnter 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              }
              .avatar-area {
                width: 144px;
                height: 144px;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 22px;
              }
              .ambient-glow {
                position: absolute;
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background-color: #EFF6FF;
                pointer-events: none;
              }
              .inner-ring-border {
                position: absolute;
                width: 108px;
                height: 108px;
                border-radius: 50%;
                border: 1px solid #DBEAFE;
                box-sizing: border-box;
                pointer-events: none;
              }
              .pulse-aura {
                position: absolute;
                width: 98px;
                height: 98px;
                border-radius: 50%;
                background-color: #0057FF;
                opacity: 0;
                will-change: transform, opacity;
                pointer-events: none;
              }
              .pulse-aura-1 {
                animation: mayaPulse1 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
              }
              .pulse-aura-2 {
                animation: mayaPulse2 2.4s cubic-bezier(0.22, 1, 0.36, 1) 1.2s infinite;
              }
              .avatar-wrapper {
                width: 96px;
                height: 96px;
                border-radius: 50%;
                padding: 3.5px;
                background-color: #FFFFFF;
                z-index: 2;
                position: relative;
                box-shadow: 0 14px 36px rgba(0, 87, 255, 0.20);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: mayaFloat 3.2s ease-in-out infinite;
                will-change: transform;
                box-sizing: border-box;
              }
              .avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
                -webkit-user-drag: none;
              }
              .online-badge {
                position: absolute;
                bottom: 3px;
                right: 3px;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background-color: #10B981;
                border: 2.5px solid #FFFFFF;
                box-sizing: border-box;
              }
              .brand-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-bottom: 32px;
              }
              .brand-title {
                font-size: 26px;
                font-weight: 800;
                color: #0F172A;
                letter-spacing: -0.7px;
                line-height: 1.2;
                margin-bottom: 8px;
              }
              .brand-title span {
                color: #0057FF;
              }
              .tagline-pill {
                background-color: #F8FAFC;
                border: 1px solid #E2E8F0;
                padding: 5px 14px;
                border-radius: 20px;
              }
              .brand-tagline {
                font-size: 12px;
                font-weight: 500;
                color: #64748B;
                letter-spacing: 0.3px;
                line-height: 1.3;
              }
              .status-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
              }
              .voice-status-pill {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                background-color: #F8FAFC;
                padding: 7px 14px;
                border-radius: 16px;
                margin-bottom: 12px;
                gap: 8px;
              }
              .wave-row {
                display: flex;
                flex-direction: row;
                align-items: center;
                height: 14px;
                gap: 2.5px;
              }
              .wave-bar {
                width: 2.5px;
                height: 13px;
                border-radius: 1.5px;
                background-color: #0057FF;
                will-change: transform;
              }
              .wave-1 { animation: mayaWave 0.72s ease-in-out infinite; }
              .wave-2 { animation: mayaWave 0.56s ease-in-out 0.15s infinite; }
              .wave-3 { animation: mayaWave 0.84s ease-in-out 0.3s infinite; }
              .wave-4 { animation: mayaWave 0.64s ease-in-out 0.1s infinite; }
              .loading-msg {
                font-size: 12.5px;
                font-weight: 500;
                color: #475569;
                letter-spacing: 0.1px;
              }
              .progress-track {
                width: 164px;
                height: 3.5px;
                border-radius: 2px;
                background-color: #F1F5F9;
                overflow: hidden;
                position: relative;
              }
              .progress-bar {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 60px;
                border-radius: 2px;
                background-color: #0057FF;
                will-change: transform;
                animation: mayaProgress 1.35s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
              }
              @keyframes mayaCardEnter {
                0% { opacity: 0; transform: scale(0.96); }
                100% { opacity: 1; transform: scale(1); }
              }
              @keyframes mayaFloat {
                0%, 100% { transform: translateY(0px) scale(1); }
                50% { transform: translateY(-7px) scale(1.025); }
              }
              @keyframes mayaPulse1 {
                0% { transform: scale(0.9); opacity: 0; }
                25% { opacity: 0.24; }
                100% { transform: scale(1.6); opacity: 0; }
              }
              @keyframes mayaPulse2 {
                0% { transform: scale(0.9); opacity: 0; }
                25% { opacity: 0.18; }
                100% { transform: scale(1.6); opacity: 0; }
              }
              @keyframes mayaWave {
                0%, 100% { transform: scaleY(0.35); }
                50% { transform: scaleY(1); }
              }
              @keyframes mayaProgress {
                0% { transform: translateX(-70px) scaleX(0.6); }
                50% { transform: translateX(52px) scaleX(1.45); }
                100% { transform: translateX(175px) scaleX(0.6); }
              }
            `,
          }}
        />
      </head>
      <body>
        <div
          id="app-initial-loader"
          role="progressbar"
          aria-label="Loading SpeakwithMaya..."
        >
          <div className="bg-orb-top" />
          <div className="bg-orb-bottom" />

          <div className="loader-card">
            <div className="avatar-area">
              <div className="ambient-glow" />
              <div className="inner-ring-border" />
              <div className="pulse-aura pulse-aura-1" />
              <div className="pulse-aura pulse-aura-2" />
              <div className="avatar-wrapper">
                <img
                  src="/maya-avatar.png"
                  alt="Maya AI"
                  className="avatar-img"
                  decoding="async"
                  fetchPriority="high"
                />
                <div className="online-badge" />
              </div>
            </div>

            <div className="brand-section">
              <div className="brand-title">
                Speakwith<span>Maya</span>
              </div>
              <div className="tagline-pill">
                <div className="brand-tagline">
                  Practice &nbsp;·&nbsp; Improve &nbsp;·&nbsp; Be Confident
                </div>
              </div>
            </div>

            <div className="status-container">
              <div className="voice-status-pill">
                <div className="wave-row">
                  <div className="wave-bar wave-1" />
                  <div className="wave-bar wave-2" />
                  <div className="wave-bar wave-3" />
                  <div className="wave-bar wave-4" />
                </div>
                <div className="loading-msg">Loading SpeakwithMaya...</div>
              </div>

              <div className="progress-track">
                <div className="progress-bar" />
              </div>
            </div>
          </div>
        </div>

        {/* Fail-safe timeout & instant dismissal helper for pre-bundle loader */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isDismissed = false;
                function dismissLoader() {
                  if (isDismissed) return;
                  isDismissed = true;
                  var loader = document.getElementById('app-initial-loader');
                  if (loader) {
                    loader.style.transition = 'opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
                    loader.style.opacity = '0';
                    loader.style.pointerEvents = 'none';
                    setTimeout(function() {
                      if (loader && loader.parentNode) {
                        loader.parentNode.removeChild(loader);
                      }
                    }, 300);
                  }
                }
                // Safety escape hatch: only in the unlikely event JavaScript crashes, dismiss after 15s
                var timer = setTimeout(dismissLoader, 15000);
                window.__dismissAppLoader = function() {
                  clearTimeout(timer);
                  dismissLoader();
                };
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}