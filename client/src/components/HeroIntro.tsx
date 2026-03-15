interface HeroIntroProps {
  onUploadClick: () => void;
  shopUrl: string;
  fileInputId?: string;
}

export default function HeroIntro({ onUploadClick, shopUrl, fileInputId }: HeroIntroProps) {
  return (
    <>
      {/* ── Google Fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@400;500;600&display=swap');

        .hero-root * { box-sizing: border-box; }

        .hero-root {
          font-family: 'Inter', sans-serif;
          background: #F5EFE6;
          color: #2D2040;
          width: 100%;
        }

        /* ── HERO SECTION ── */
        .hero-section {
          min-height: 88vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 24px 48px;
          position: relative;
          overflow: hidden;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, #C4B8D9 1.5px, transparent 1.5px);
          background-size: 28px 28px;
          opacity: 0.3;
          pointer-events: none;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #E8E3F0;
          color: #7B6A9B;
          border: 1px solid #C4B8D9;
          border-radius: 99px;
          padding: 5px 14px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 22px;
          animation: heroFadeUp 0.5s ease both;
        }

        .hero-h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2.2rem, 5vw, 3.6rem);
          font-weight: 700;
          color: #452F60;
          text-align: center;
          line-height: 1.15;
          max-width: 680px;
          margin-bottom: 16px;
          animation: heroFadeUp 0.5s 0.08s ease both;
        }

        .hero-h1 em {
          font-style: italic;
          color: #7B6A9B;
        }

        .hero-sub {
          font-size: 1rem;
          color: #9B8FB0;
          text-align: center;
          max-width: 460px;
          line-height: 1.7;
          margin-bottom: 32px;
          animation: heroFadeUp 0.5s 0.16s ease both;
        }

        .hero-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 52px;
          animation: heroFadeUp 0.5s 0.24s ease both;
        }

        .btn-primary {
          background: #452F60;
          color: white;
          border: none;
          border-radius: 99px;
          padding: 13px 28px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 4px 14px rgba(69,47,96,0.28);
          text-decoration: none;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(69,47,96,0.35); }

        .btn-outline {
          background: transparent;
          color: #7B6A9B;
          border: 1.5px solid #7B6A9B;
          border-radius: 99px;
          padding: 13px 28px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background 0.15s;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-outline:hover { background: #E8E3F0; }

        /* ── BEFORE / AFTER CARD ── */
        .ba-card {
          display: flex;
          align-items: center;
          gap: 20px;
          background: white;
          border: 1.5px solid #DDD5EC;
          border-radius: 20px;
          padding: 20px 28px;
          box-shadow: 0 8px 32px rgba(69,47,96,0.10);
          animation: heroFadeUp 0.5s 0.32s ease both;
          max-width: 560px;
          width: 100%;
        }

        .ba-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .ba-img {
          width: 100%;
          max-width: 200px;
          aspect-ratio: 1;
          border-radius: 12px;
          object-fit: cover;
          border: 1px solid #EDE7DA;
        }

        .ba-label {
          font-size: 10px;
          font-weight: 600;
          color: #9B8FB0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .ba-arrow {
          font-size: 24px;
          color: #7B6A9B;
          flex-shrink: 0;
          line-height: 1;
        }

        /* ── DIVIDER ── */
        .hero-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #DDD5EC, transparent);
          margin: 0 24px;
        }

        /* ── HOW IT WORKS ── */
        .section {
          padding: 72px 24px;
          max-width: 900px;
          margin: 0 auto;
        }

        .section-eyebrow {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7B6A9B;
          margin-bottom: 10px;
        }

        .section-h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.5rem, 3vw, 2.1rem);
          font-weight: 700;
          color: #452F60;
          text-align: center;
          margin-bottom: 48px;
          line-height: 1.25;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          position: relative;
        }

        .steps-grid::before {
          content: '';
          position: absolute;
          top: 46px;
          left: calc(16.67% + 10px);
          right: calc(16.67% + 10px);
          height: 1.5px;
          background: linear-gradient(90deg, #C4B8D9, #7B6A9B, #C4B8D9);
          pointer-events: none;
        }

        .step-card {
          background: white;
          border: 1.5px solid #E8E3F0;
          border-radius: 18px;
          padding: 28px 20px 24px;
          text-align: center;
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .step-card:hover { transform: translateY(-4px); box-shadow: 0 10px 28px rgba(69,47,96,0.09); }

        .step-num {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: #452F60;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
        }

        .step-icon { font-size: 30px; margin-bottom: 12px; margin-top: 6px; }

        .step-h3 {
          font-family: 'Playfair Display', serif;
          font-size: 1rem;
          font-weight: 700;
          color: #452F60;
          margin-bottom: 8px;
        }

        .step-p {
          font-size: 12.5px;
          color: #9B8FB0;
          line-height: 1.6;
        }

        /* ── FEATURES ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .feature-card {
          background: white;
          border: 1.5px solid #E8E3F0;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(69,47,96,0.08); }

        .feature-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #E8E3F0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .feature-h4 {
          font-family: 'Playfair Display', serif;
          font-size: 0.92rem;
          font-weight: 700;
          color: #452F60;
          margin-bottom: 5px;
        }

        .feature-p {
          font-size: 12px;
          color: #9B8FB0;
          line-height: 1.55;
        }

        /* ── CTA ── */
        .cta-section {
          background: #452F60;
          border-radius: 24px;
          padding: 52px 32px;
          text-align: center;
          margin: 0 24px 72px;
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
          position: relative;
          overflow: hidden;
        }

        .cta-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1.5px, transparent 1.5px);
          background-size: 22px 22px;
        }

        .cta-h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.4rem, 3vw, 1.9rem);
          color: white;
          margin-bottom: 10px;
          position: relative;
        }

        .cta-p {
          color: rgba(255,255,255,0.6);
          font-size: 13.5px;
          margin-bottom: 28px;
          position: relative;
        }

        .btn-cta {
          background: #F5EFE6;
          color: #452F60;
          border: none;
          border-radius: 99px;
          padding: 14px 32px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-cta:hover { transform: scale(1.04); box-shadow: 0 4px 20px rgba(0,0,0,0.2); }

        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .steps-grid { grid-template-columns: 1fr; }
          .steps-grid::before { display: none; }
          .features-grid { grid-template-columns: 1fr; }
          .ba-card { flex-direction: column; }
          .ba-arrow { transform: rotate(90deg); }
        }
      `}</style>

      <div className="hero-root">

        {/* ══ HERO ══ */}
        <section className="hero-section">
          <div className="hero-badge">🎨 Free Online Tool · No Sign-up Required</div>

          {/* SEO H1 — core keywords in heading */}
          <h1 className="hero-h1">
            Turn Any Photo into a<br />
            <em>Perler Bead Pattern</em>
          </h1>

          <p className="hero-sub">
            Upload your image and instantly generate a custom bead pattern using the full{' '}
            <strong>Artkal 221 color palette</strong>. Get an exact bead count and order everything in one click.
          </p>

          <div className="hero-buttons">
            {fileInputId ? (
              <label htmlFor={fileInputId} className="btn-primary" style={{ cursor: 'pointer' }}>
                ⬆️ Upload Image
              </label>
            ) : (
              <button className="btn-primary" onClick={onUploadClick}>
                ⬆️ Upload Image
              </button>
            )}
            <a className="btn-outline" href={shopUrl} target="_blank" rel="noopener noreferrer">
              🛍 Visit Shop
            </a>
            <a
              className="btn-outline"
              href="https://yayascreativestudio.com/pages/pattern-converter-user-guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              📖 User Guide
            </a>
          </div>

          {/* Before / After — real images */}
          <div className="ba-card">
            <div className="ba-side">
              <img
                src="/hero-cat-original.jpeg"
                alt="Art nouveau white cat illustration"
                className="ba-img"
              />
              <span className="ba-label">Your Image</span>
            </div>
            <div className="ba-arrow">→</div>
            <div className="ba-side">
              <img
                src="/hero-cat-pattern.png"
                alt="Perler bead pattern chart generated from cat image"
                className="ba-img"
              />
              <span className="ba-label">Bead Pattern</span>
            </div>
          </div>
        </section>

        <div className="hero-divider" />

        {/* ══ HOW IT WORKS ══ */}
        <section className="section">
          <p className="section-eyebrow">How It Works</p>
          {/* SEO H2 */}
          <h2 className="section-h2">
            From photo to finished pattern<br />in 3 simple steps
          </h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <div className="step-icon">📸</div>
              <h3 className="step-h3">Upload Your Image</h3>
              <p className="step-p">Drag & drop any photo — a pet, character, logo, or anything you love. JPG, PNG, and WebP supported.</p>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div className="step-icon">🎨</div>
              <h3 className="step-h3">Auto-Convert to Pattern</h3>
              <p className="step-p">Instantly mapped to the Artkal 221 palette. Adjust grid size, colors, and fine details with live preview.</p>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div className="step-icon">📦</div>
              <h3 className="step-h3">Export & Order Beads</h3>
              <p className="step-p">Download your pattern as PDF, get an exact bead count, and add all required colors to your cart in one click.</p>
            </div>
          </div>
        </section>

        <div className="hero-divider" />

        {/* ══ FEATURES ══ */}
        <section className="section">
          <p className="section-eyebrow">Features</p>
          <h2 className="section-h2">Everything you need to craft</h2>
          <div className="features-grid">
            {[
              { icon: '🎨', title: 'Full Artkal 221 Palette', desc: 'Every color automatically matched to the official Artkal palette — no manual color picking needed.' },
              { icon: '📊', title: 'Exact Bead Count', desc: 'Get a precise count for every color used. Know exactly how many beads to buy before you start.' },
              { icon: '✏️', title: 'Edit Your Pattern', desc: 'Use brush, eraser, and eyedropper tools to refine your design pixel by pixel.' },
              { icon: '📥', title: 'Export Pattern PDF', desc: 'Download a print-ready pattern with color codes, grid lines, and a full color legend.' },
              { icon: '🛒', title: 'One-Click Bead Order', desc: "Add all required colors directly to your Yaya's Creative Studio cart — no manual searching." },
              { icon: '💾', title: 'Save Your Projects', desc: 'Save multiple patterns and come back to them anytime. No account or sign-up required.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="feature-card">
                <div className="feature-icon-box">{icon}</div>
                <div>
                  <h4 className="feature-h4">{title}</h4>
                  <p className="feature-p">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ CTA ══ */}
        <div className="cta-section">
          <h2 className="cta-h2">Ready to start your next bead project?</h2>
          <p className="cta-p">Free to use · No sign-up · Works on any device</p>
          {fileInputId ? (
            <label htmlFor={fileInputId} className="btn-cta" style={{ cursor: 'pointer' }}>
              ⬆️ Upload Image Now
            </label>
          ) : (
            <button className="btn-cta" onClick={onUploadClick}>
              ⬆️ Upload Image Now
            </button>
          )}
        </div>

      </div>
    </>
  );
}
