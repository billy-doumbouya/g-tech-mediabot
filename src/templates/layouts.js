/**
 * src/templates/layouts.js
 * ============================================================
 * DYNAMIC HTML TEMPLATE ENGINE — 5 VISUAL LAYOUTS
 * ============================================================
 * WHY HTML-TO-IMAGE INSTEAD OF EXTERNAL TOOLS:
 * - No external API cost or rate limits
 * - Full design control
 * - Works offline / in Railway containers
 * - Fast (Puppeteer screenshot takes ~2 seconds)
 * - CSS gives us gradients, typography, animations
 *
 * IMAGE DIMENSIONS: 1200x630px (optimal for Facebook)
 *
 * THE 5 LAYOUTS:
 * 1. morning-glow    — Warm gradient, motivational energy
 * 2. tech-grid       — Dark tech aesthetic, code vibes
 * 3. cta-blast       — Bold CTA layout, conversion-focused
 * 4. quote-card      — Minimal, centered quote design
 * 5. academy-banner  — G-tech-academy branded layout
 * ============================================================
 */

/**
 * Shared CSS variables and base styles for all templates
 * WHY: Keeps brand colors consistent across all layouts
 */
const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --purple: #7C3AED;
    --purple-light: #A78BFA;
    --blue: #2563EB;
    --blue-light: #60A5FA;
    --cyan: #06B6D4;
    --orange: #F97316;
    --green: #10B981;
    --dark: #0F0F1A;
    --dark-2: #1A1A2E;
    --dark-3: #16213E;
    --white: #FFFFFF;
    --gray: #94A3B8;
    --font-main: 'Space Grotesk', sans-serif;
    --font-mono: 'Space Mono', monospace;
  }
`;

// ============================================================
// LAYOUT 1: MORNING GLOW
// Warm, energetic gradient. Best for motivational content.
// ============================================================
export const morningGlow = ({ title, bodyText, cta, hashtags, designSuggestion }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${BASE_STYLES}

  body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: var(--font-main);
    background: linear-gradient(135deg, #0F0F1A 0%, #1a0533 40%, #2D1B69 100%);
    position: relative;
  }

  /* Decorative geometric circles */
  .circle-1 {
    position: absolute; width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%);
    top: -100px; right: -80px;
  }
  .circle-2 {
    position: absolute; width: 300px; height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%);
    bottom: -80px; left: -60px;
  }
  .circle-3 {
    position: absolute; width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%);
    top: 50%; left: 40%;
  }

  /* Grid lines background */
  .grid-bg {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px);
    background-size: 50px 50px;
  }

  /* Main content container */
  .content {
    position: relative; z-index: 10;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 50px 70px;
  }

  /* Top: Brand tag */
  .brand-tag {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: linear-gradient(135deg, var(--orange), var(--purple-light));
    box-shadow: 0 0 15px rgba(249,115,22,0.6);
  }
  .brand-name {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--gray);
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  /* Center: Main message */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
  }

  .title {
    font-size: 54px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--white);
    background: linear-gradient(135deg, var(--white) 0%, var(--purple-light) 50%, var(--orange) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    max-width: 720px;
  }

  .body-text {
    font-size: 20px;
    font-weight: 400;
    line-height: 1.6;
    color: rgba(255,255,255,0.75);
    max-width: 680px;
  }

  /* Bottom: CTA + hashtags */
  .bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cta-button {
    background: linear-gradient(135deg, var(--purple), var(--orange));
    color: var(--white);
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 700;
    padding: 14px 32px;
    border-radius: 50px;
    letter-spacing: 1px;
    box-shadow: 0 8px 30px rgba(124,58,237,0.4);
    white-space: nowrap;
  }

  .hashtags {
    font-family: var(--font-mono);
    font-size: 13px;
    color: rgba(167,139,250,0.6);
    letter-spacing: 0.5px;
    text-align: right;
    line-height: 1.8;
  }
</style>
</head>
<body>
  <div class="circle-1"></div>
  <div class="circle-2"></div>
  <div class="circle-3"></div>
  <div class="grid-bg"></div>
  <div class="content">
    <div class="brand-tag">
      <div class="brand-dot"></div>
      <span class="brand-name">G-tech-academy × Billy Doumbouya</span>
    </div>
    <div class="main-content">
      <div class="title">${escapeHtml(title)}</div>
      <div class="body-text">${escapeHtml(bodyText)}</div>
    </div>
    <div class="bottom-row">
      <div class="cta-button">${escapeHtml(cta)}</div>
      <div class="hashtags">${hashtags.slice(0, 4).join('<br>')}</div>
    </div>
  </div>
</body>
</html>
`;

// ============================================================
// LAYOUT 2: TECH GRID
// Dark, matrix-inspired. Best for tech/developer content.
// ============================================================
export const techGrid = ({ title, bodyText, cta, hashtags }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${BASE_STYLES}

  body {
    width: 1200px; height: 630px;
    overflow: hidden;
    font-family: var(--font-main);
    background: var(--dark);
    position: relative;
  }

  /* Terminal-style scanlines */
  body::after {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px
    );
    pointer-events: none;
  }

  /* Side accent bar */
  .side-bar {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 6px;
    background: linear-gradient(180deg, var(--cyan), var(--purple), var(--blue));
  }

  /* Code decorations */
  .code-bg {
    position: absolute;
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(6,182,212,0.06);
    line-height: 1.8;
    top: 30px; right: 40px;
    text-align: right;
    pointer-events: none;
  }

  .content {
    position: relative; z-index: 10;
    height: 100%;
    display: flex;
    padding: 50px 70px 50px 80px;
    gap: 60px;
    align-items: center;
  }

  /* Left: Main text */
  .left { flex: 1; display: flex; flex-direction: column; gap: 20px; }

  .category-tag {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--cyan);
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .category-tag::before { content: '> '; }

  .title {
    font-size: 46px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--white);
    border-left: 3px solid var(--cyan);
    padding-left: 20px;
  }

  .body-text {
    font-size: 17px;
    color: rgba(255,255,255,0.65);
    line-height: 1.7;
    padding-left: 23px;
  }

  .cta-line {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--cyan);
    padding-left: 23px;
    margin-top: 8px;
  }
  .cta-line::before { content: '$ '; opacity: 0.5; }

  /* Right: Stats box */
  .right {
    width: 260px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(6,182,212,0.2);
    border-radius: 12px;
    padding: 30px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    backdrop-filter: blur(10px);
  }

  .stat-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--gray);
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .stat-value {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--cyan);
  }

  .divider {
    height: 1px;
    background: rgba(6,182,212,0.15);
  }

  .brand-bottom {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    position: absolute;
    bottom: 30px; right: 70px;
    letter-spacing: 2px;
  }
</style>
</head>
<body>
  <div class="side-bar"></div>
  <div class="code-bg">
    01101001 01101110<br>01110100 01100101<br>01101100<br>01101100 01101001<br>01100111 01100101<br>01101110 01100011<br>01100101
  </div>
  <div class="content">
    <div class="left">
      <div class="category-tag">G-tech-academy</div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="body-text">${escapeHtml(bodyText)}</div>
      <div class="cta-line">${escapeHtml(cta)}</div>
    </div>
    <div class="right">
      <div class="stat-row">
        <div class="stat-label">Formation</div>
        <div class="stat-value">Tech & Code</div>
      </div>
      <div class="divider"></div>
      <div class="stat-row">
        <div class="stat-label">Langue</div>
        <div class="stat-value">Français</div>
      </div>
      <div class="divider"></div>
      <div class="stat-row">
        <div class="stat-label">Accès</div>
        <div class="stat-value">En ligne</div>
      </div>
      <div class="divider"></div>
      <div class="stat-row">
        <div class="stat-label">Communauté</div>
        <div class="stat-value">Afrique 🌍</div>
      </div>
    </div>
  </div>
  <div class="brand-bottom">GTECH-ACADEMY.COM</div>
</body>
</html>
`;

// ============================================================
// LAYOUT 3: CTA BLAST
// Full-impact conversion layout. Best for evening CTA posts.
// ============================================================
export const ctaBlast = ({ title, bodyText, cta, hashtags }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${BASE_STYLES}

  body {
    width: 1200px; height: 630px;
    overflow: hidden;
    font-family: var(--font-main);
    background: linear-gradient(160deg, #0F0F1A 0%, #0D2137 50%, #061424 100%);
    position: relative;
  }

  /* Glowing border */
  .glow-border {
    position: absolute;
    inset: 20px;
    border: 1px solid rgba(124,58,237,0.3);
    border-radius: 20px;
    pointer-events: none;
  }
  .glow-border::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(124,58,237,0.2), transparent, rgba(6,182,212,0.2));
  }

  /* Top gradient accent */
  .top-accent {
    position: absolute; top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--purple), var(--cyan), var(--purple));
  }

  .content {
    position: relative; z-index: 10;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 50px 120px;
    gap: 28px;
  }

  .badge {
    background: rgba(124,58,237,0.2);
    border: 1px solid rgba(124,58,237,0.4);
    color: var(--purple-light);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 8px 20px;
    border-radius: 50px;
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  .title {
    font-size: 52px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--white);
    text-shadow: 0 0 60px rgba(124,58,237,0.3);
  }

  .body-text {
    font-size: 19px;
    color: rgba(255,255,255,0.7);
    line-height: 1.6;
    max-width: 800px;
  }

  /* Large CTA button — the hero element */
  .cta-button {
    background: linear-gradient(135deg, var(--purple), var(--blue));
    color: var(--white);
    font-size: 18px;
    font-weight: 700;
    padding: 18px 48px;
    border-radius: 50px;
    margin-top: 8px;
    box-shadow:
      0 0 40px rgba(124,58,237,0.4),
      0 8px 30px rgba(0,0,0,0.3);
    letter-spacing: 0.5px;
  }

  .hashtags {
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(124,58,237,0.5);
    letter-spacing: 1px;
  }
</style>
</head>
<body>
  <div class="top-accent"></div>
  <div class="glow-border"></div>
  <div class="content">
    <div class="badge">★ G-tech-academy ★</div>
    <div class="title">${escapeHtml(title)}</div>
    <div class="body-text">${escapeHtml(bodyText)}</div>
    <div class="cta-button">${escapeHtml(cta)}</div>
    <div class="hashtags">${hashtags.slice(0, 5).join('  ·  ')}</div>
  </div>
</body>
</html>
`;

// ============================================================
// LAYOUT 4: QUOTE CARD
// Minimal, elegant. Best for powerful short quotes.
// ============================================================
export const quoteCard = ({ title, bodyText, cta, hashtags }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${BASE_STYLES}

  body {
    width: 1200px; height: 630px;
    overflow: hidden;
    font-family: var(--font-main);
    background: #0A0A14;
    position: relative;
  }

  /* Subtle texture */
  body::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 600px 400px at 20% 50%, rgba(124,58,237,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 400px 300px at 80% 50%, rgba(6,182,212,0.08) 0%, transparent 60%);
  }

  /* Large decorative quote mark */
  .quote-mark {
    position: absolute;
    font-family: Georgia, serif;
    font-size: 280px;
    color: rgba(124,58,237,0.08);
    top: -40px; left: 40px;
    line-height: 1;
    user-select: none;
  }

  .content {
    position: relative; z-index: 10;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 70px 100px 70px 120px;
    gap: 30px;
  }

  .title {
    font-size: 50px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--white);
    max-width: 780px;
    position: relative;
  }

  /* Accent line left of title */
  .title::before {
    content: '';
    position: absolute;
    left: -30px; top: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--purple), var(--cyan));
    border-radius: 4px;
  }

  .body-text {
    font-size: 20px;
    color: rgba(255,255,255,0.6);
    line-height: 1.6;
    max-width: 700px;
    font-style: italic;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
  }

  .author-avatar {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--purple), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 20px; color: white;
    flex-shrink: 0;
  }

  .author-info { display: flex; flex-direction: column; gap: 2px; }
  .author-name { font-size: 16px; font-weight: 600; color: var(--white); }
  .author-title { font-size: 13px; color: var(--gray); font-family: var(--font-mono); }

  .hashtags {
    position: absolute;
    bottom: 40px; right: 70px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(124,58,237,0.45);
    text-align: right;
    line-height: 1.9;
  }
</style>
</head>
<body>
  <div class="quote-mark">"</div>
  <div class="content">
    <div class="title">${escapeHtml(title)}</div>
    <div class="body-text">${escapeHtml(bodyText)}</div>
    <div class="author-row">
      <div class="author-avatar">B</div>
      <div class="author-info">
        <div class="author-name">Billy Doumbouya</div>
        <div class="author-title">Fondateur · G-tech-academy</div>
      </div>
    </div>
  </div>
  <div class="hashtags">${hashtags.slice(0, 4).join('<br>')}</div>
</body>
</html>
`;

// ============================================================
// LAYOUT 5: ACADEMY BANNER
// Full brand layout. Best for institutional/academy announcements.
// ============================================================
export const academyBanner = ({ title, bodyText, cta, hashtags }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${BASE_STYLES}

  body {
    width: 1200px; height: 630px;
    overflow: hidden;
    font-family: var(--font-main);
    background: var(--dark-2);
    position: relative;
  }

  /* Split layout: left dark, right gradient */
  .bg-split {
    position: absolute; inset: 0;
    display: flex;
  }
  .bg-left {
    flex: 1.2;
    background: linear-gradient(160deg, #0F0F1A, #1A1A2E);
  }
  .bg-right {
    flex: 0.8;
    background: linear-gradient(160deg, #1a0533, #0D2137);
    position: relative;
    overflow: hidden;
  }
  .bg-right::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(circle 300px at 70% 40%, rgba(124,58,237,0.25) 0%, transparent 60%),
      radial-gradient(circle 200px at 30% 80%, rgba(6,182,212,0.15) 0%, transparent 60%);
  }

  /* Diagonal divider */
  .divider-diagonal {
    position: absolute;
    top: 0; bottom: 0;
    left: calc(55% - 40px);
    width: 80px;
    background: linear-gradient(160deg, #0F0F1A 50%, #1a0533 50%);
    z-index: 2;
  }

  /* Floating academy logo area */
  .academy-logo-area {
    position: absolute;
    right: 60px; top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .logo-circle {
    width: 120px; height: 120px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--purple), var(--blue), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono);
    font-size: 28px;
    font-weight: 700;
    color: white;
    box-shadow:
      0 0 60px rgba(124,58,237,0.4),
      0 0 120px rgba(124,58,237,0.15);
  }

  .logo-text {
    font-family: var(--font-mono);
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 2px;
    text-align: center;
    line-height: 1.6;
  }

  /* Star elements */
  .stars {
    position: absolute;
    right: 80px; top: 60px;
    font-size: 11px;
    color: rgba(124,58,237,0.3);
    letter-spacing: 4px;
  }

  /* Main content */
  .content {
    position: relative; z-index: 10;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 50px 60px;
    width: 60%;
  }

  .top-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--cyan);
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  .main-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
  }

  .title {
    font-size: 44px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--white);
  }

  .highlight {
    background: linear-gradient(135deg, var(--purple-light), var(--cyan));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .body-text {
    font-size: 17px;
    color: rgba(255,255,255,0.65);
    line-height: 1.65;
    max-width: 520px;
  }

  .cta-row {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .cta-button {
    background: linear-gradient(135deg, var(--purple), var(--cyan));
    color: white;
    font-size: 14px;
    font-weight: 700;
    padding: 14px 30px;
    border-radius: 50px;
    white-space: nowrap;
    box-shadow: 0 8px 25px rgba(124,58,237,0.35);
  }

  .hashtags-inline {
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(255,255,255,0.25);
    line-height: 1.7;
  }
</style>
</head>
<body>
  <div class="bg-split">
    <div class="bg-left"></div>
    <div class="bg-right"></div>
  </div>
  <div class="divider-diagonal"></div>

  <div class="stars">★ ★ ★ ★ ★</div>

  <div class="academy-logo-area">
    <div class="logo-circle">GT</div>
    <div class="logo-text">G-TECH<br>ACADEMY</div>
  </div>

  <div class="content">
    <div class="top-label">// Billy Doumbouya présente</div>
    <div class="main-text">
      <div class="title">${escapeHtml(title)}</div>
      <div class="body-text">${escapeHtml(bodyText)}</div>
    </div>
    <div class="cta-row">
      <div class="cta-button">${escapeHtml(cta)}</div>
      <div class="hashtags-inline">${hashtags.slice(0, 3).join('<br>')}</div>
    </div>
  </div>
</body>
</html>
`;

// ============================================================
// LAYOUT REGISTRY
// Maps layout names to generator functions
// To add a new layout: just add it here + create the function above
// ============================================================
export const LAYOUTS = {
  'morning-glow': morningGlow,
  'tech-grid': techGrid,
  'cta-blast': ctaBlast,
  'quote-card': quoteCard,
  'academy-banner': academyBanner,
};

/**
 * Suggest the best layout for a given category
 * WHY: Different content types have different optimal visual styles
 * @param {string} category - 'morning' | 'midday' | 'evening'
 * @returns {string[]} - Ordered list of layout names to try
 */
export const suggestLayouts = (category) => {
  const suggestions = {
    morning: ['morning-glow', 'quote-card', 'academy-banner'],
    midday: ['tech-grid', 'morning-glow', 'academy-banner'],
    evening: ['cta-blast', 'academy-banner', 'morning-glow'],
  };
  return suggestions[category] || ['morning-glow'];
};

/**
 * Render an HTML template from a layout name and content
 * @param {string} layoutName - Key from LAYOUTS object
 * @param {Object} content - AI-generated content object
 * @returns {string} - Full HTML string
 */
export const renderTemplate = (layoutName, content) => {
  const layoutFn = LAYOUTS[layoutName];
  if (!layoutFn) {
    throw new Error(`Unknown layout: ${layoutName}. Available: ${Object.keys(LAYOUTS).join(', ')}`);
  }
  return layoutFn(content);
};

/**
 * XSS protection: escape HTML special characters in user-provided content
 * WHY: Even though we control the AI output, we should always sanitize
 * content before injecting into HTML to prevent rendering issues.
 * @param {string} str
 * @returns {string}
 */
const escapeHtml = (str = '') => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
