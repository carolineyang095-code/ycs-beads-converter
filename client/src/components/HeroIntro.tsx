import { useTranslation } from 'react-i18next';

interface HeroIntroProps {
  onUploadClick: () => void;
  shopUrl: string;
  fileInputId?: string;
  onOpenProjects?: () => void;
}

export default function HeroIntro({ onUploadClick, shopUrl, fileInputId, onOpenProjects }: HeroIntroProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* ── Google Fonts ── */}
      <style>{`
        /* Fonts loaded via index.html */

        .hero-root * { box-sizing: border-box; }

        .hero-root {
          font-family: 'Dosis', sans-serif;
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
          font-family: 'Caveat', cursive;
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
          font-family: 'Dosis', sans-serif;
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
          font-family: 'Dosis', sans-serif;
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
          padding: 24px 32px;
          box-shadow: 0 8px 32px rgba(69,47,96,0.10);
          animation: heroFadeUp 0.5s 0.32s ease both;
          max-width: 640px;
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
          max-width: 240px;
          aspect-ratio: 3 / 4;
          border-radius: 12px;
          object-fit: contain;
          border: 1px solid #EDE7DA;
          background: white;
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
          font-family: 'Caveat', cursive;
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
          font-family: 'Dosis', sans-serif;
        }

        .step-icon { font-size: 30px; margin-bottom: 12px; margin-top: 6px; }

        .step-h3 {
          font-family: 'Caveat', cursive;
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
          font-family: 'Caveat', cursive;
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
          font-family: 'Caveat', cursive;
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
          font-family: 'Dosis', sans-serif;
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
          <div className="hero-badge">🎨 {t('hero.badge')}</div>

          {/* SEO H1 — core keywords in heading */}
          <h1 className="hero-h1">
            {t('hero.titleLine1')}<br />
            <em>{t('hero.titleLine2')}</em>
          </h1>

          <p className="hero-sub">
            {t('hero.subtitle')}
          </p>

          <div className="hero-buttons">
            {fileInputId ? (
              <label htmlFor={fileInputId} className="btn-primary" style={{ cursor: 'pointer' }}>
                {t('hero.uploadBtn')}
              </label>
            ) : (
              <button className="btn-primary" onClick={onUploadClick}>
                {t('hero.uploadBtn')}
              </button>
            )}
            <a className="btn-outline" href={shopUrl} target="_blank" rel="noopener noreferrer">
              {t('hero.shopBtn')}
            </a>
            <a
              className="btn-outline"
              href="https://yayascreativestudio.com/pages/pattern-converter-user-guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('hero.guideBtn')}
            </a>
            <button className="btn-outline" onClick={onOpenProjects}>
              {t('hero.openProjectsBtn')}
            </button>
          </div>

          {/* Before / After — real images */}
          <div className="ba-card">
            <div className="ba-side">
              <img
                src="/hero-cat-original.jpeg"
                alt="Art nouveau white cat illustration"
                className="ba-img"
              />
              <span className="ba-label">{t('hero.yourImage')}</span>
            </div>
            <div className="ba-arrow">→</div>
            <div className="ba-side">
              <img
                src="/hero-cat-pattern.png"
                alt="Fuse bead pattern chart generated from cat image"
                className="ba-img"
              />
              <span className="ba-label">{t('hero.beadPattern')}</span>
            </div>
          </div>
        </section>

        <div className="hero-divider" />

        {/* ══ PATTERN LIBRARY BANNER ══ */}
        <section style={{
          background: 'linear-gradient(135deg, #452F60 0%, #7B6A9B 100%)',
          padding: '48px 24px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }} />
          <p style={{
            fontFamily: "'Dosis', sans-serif",
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '10px',
            position: 'relative',
          }}>{t('hero.freeDownloads')}</p>
          <h2 style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 'clamp(1.4rem, 3vw, 2rem)',
            color: 'white',
            marginBottom: '12px',
            position: 'relative',
            lineHeight: 1.25,
          }}>
            {t('hero.browseLibrary')}
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            maxWidth: '420px',
            margin: '0 auto 28px',
            lineHeight: 1.6,
            position: 'relative',
          }}>
            {t('hero.libraryDesc')}
          </p>
          <a
            href="https://tools.yayascreativestudio.com/patterns/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#F5EFE6',
              color: '#452F60',
              borderRadius: '99px',
              padding: '14px 32px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: "'Dosis', sans-serif",
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
            }}
          >
            {t('hero.exploreLibrary')}
          </a>
        </section>

        <div className="hero-divider" />

        {/* ══ HOW IT WORKS ══ */}
        <section className="section">
          <p className="section-eyebrow">{t('hero.howItWorks')}</p>
          {/* SEO H2 */}
          <h2 className="section-h2">
            {t('hero.fromPhoto')}<br />{t('hero.threeSteps')}
          </h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <div className="step-icon">📸</div>
              <h3 className="step-h3">{t('hero.step1Title')}</h3>
              <p className="step-p">{t('hero.step1Desc')}</p>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div className="step-icon">🎨</div>
              <h3 className="step-h3">{t('hero.step2Title')}</h3>
              <p className="step-p">{t('hero.step2Desc')}</p>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div className="step-icon">📦</div>
              <h3 className="step-h3">{t('hero.step3Title')}</h3>
              <p className="step-p">{t('hero.step3Desc')}</p>
            </div>
          </div>
        </section>

        <div className="hero-divider" />

        {/* ══ FEATURES ══ */}
        <section className="section">
          <p className="section-eyebrow">{t('hero.features')}</p>
          <h2 className="section-h2">{t('hero.everythingYouNeed')}</h2>
          <div className="features-grid">
            {[
              { icon: '🎨', title: t('hero.feat1Title'), desc: t('hero.feat1Desc') },
              { icon: '📊', title: t('hero.feat2Title'), desc: t('hero.feat2Desc') },
              { icon: '✏️', title: t('hero.feat3Title'), desc: t('hero.feat3Desc') },
              { icon: '📥', title: t('hero.feat4Title'), desc: t('hero.feat4Desc') },
              { icon: '🛒', title: t('hero.feat5Title'), desc: t('hero.feat5Desc') },
              { icon: '💾', title: t('hero.feat6Title'), desc: t('hero.feat6Desc') },
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
          <h2 className="cta-h2">{t('hero.ctaHeading')}</h2>
          <p className="cta-p">{t('hero.ctaSubtext')}</p>
          {fileInputId ? (
            <label htmlFor={fileInputId} className="btn-cta" style={{ cursor: 'pointer' }}>
              {t('hero.ctaBtn')}
            </label>
          ) : (
            <button className="btn-cta" onClick={onUploadClick}>
              {t('hero.ctaBtn')}
            </button>
          )}
        </div>

      </div>
    </>
  );
}
