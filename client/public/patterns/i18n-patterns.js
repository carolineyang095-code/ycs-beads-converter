/**
 * Lightweight i18n for static pattern pages.
 * Reads/writes the same localStorage key (i18nextLng) as the React app.
 */
(function () {
  var TRANSLATIONS = {
    en: {
      tools: "Tools",
      patternLibrary: "Pattern Library",
      downloadPattern: "Download Pattern",
      buyBeads: "Buy Beads",
      colorBreakdown: "Color Breakdown",
      beadBreakdown: "Bead Breakdown by Color",
      copyBreakdown: "Copy breakdown",
      copied: "Copied!",
      exploreMore: "Explore More",
      relatedPatterns: "Related Patterns",
      beadsTotal: "beads total",
      colors: "colors",
      beadConverter: "Bead Converter"
    },
    fr: {
      tools: "Outils",
      patternLibrary: "Biblioth\u00e8que de mod\u00e8les",
      downloadPattern: "T\u00e9l\u00e9charger le mod\u00e8le",
      buyBeads: "Acheter les perles",
      colorBreakdown: "D\u00e9tail des couleurs",
      beadBreakdown: "R\u00e9partition des perles par couleur",
      copyBreakdown: "Copier le d\u00e9tail",
      copied: "Copi\u00e9 !",
      exploreMore: "Explorer plus",
      relatedPatterns: "Mod\u00e8les similaires",
      beadsTotal: "perles au total",
      colors: "couleurs",
      beadConverter: "Convertisseur de perles"
    }
  };

  function getLang() {
    var stored = localStorage.getItem("i18nextLng");
    if (stored && stored.startsWith("fr")) return "fr";
    if (stored && stored.startsWith("en")) return "en";
    // detect browser
    var nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("fr") ? "fr" : "en";
  }

  function setLang(lang) {
    localStorage.setItem("i18nextLng", lang);
    applyTranslations(lang);
    updateToggle(lang);
  }

  function t(key, lang) {
    return (TRANSLATIONS[lang] || TRANSLATIONS.en)[key] || key;
  }

  // Expose t() globally for related-patterns.js
  window.__i18nPatterns = { t: t, getLang: getLang };

  function applyTranslations(lang) {
    // data-i18n attribute on elements
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      el.textContent = t(key, lang);
    });
    // data-i18n-aria for aria-label
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      el.setAttribute("aria-label", t(key, lang));
    });
  }

  function updateToggle(lang) {
    var btn = document.getElementById("lang-toggle");
    if (!btn) return;
    var spans = btn.querySelectorAll("span");
    if (spans.length >= 3) {
      spans[0].style.opacity = lang === "en" ? "1" : "0.4";
      spans[0].style.textDecoration = lang === "en" ? "underline" : "none";
      spans[2].style.opacity = lang === "fr" ? "1" : "0.4";
      spans[2].style.textDecoration = lang === "fr" ? "underline" : "none";
    }
  }

  function createToggle() {
    var lang = getLang();
    // Find the topbar-inner or topbar-nav to insert the toggle
    var topbarInner = document.querySelector(".topbar-inner");
    if (!topbarInner) return;

    var btn = document.createElement("button");
    btn.id = "lang-toggle";
    btn.setAttribute("aria-label", "Toggle language");
    btn.style.cssText = "font-size:11px;font-weight:600;letter-spacing:0.03em;color:#332847;background:none;border:none;cursor:pointer;padding:4px 8px;white-space:nowrap;";

    var enSpan = document.createElement("span");
    enSpan.textContent = "EN";
    enSpan.style.textUnderlineOffset = "2px";

    var sep = document.createElement("span");
    sep.textContent = "|";
    sep.style.cssText = "margin:0 2px;opacity:0.3;";

    var frSpan = document.createElement("span");
    frSpan.textContent = "FR";
    frSpan.style.textUnderlineOffset = "2px";

    btn.appendChild(enSpan);
    btn.appendChild(sep);
    btn.appendChild(frSpan);

    btn.addEventListener("click", function () {
      var current = getLang();
      setLang(current === "fr" ? "en" : "fr");
    });

    topbarInner.appendChild(btn);
    updateToggle(lang);
  }

  // Init
  var lang = getLang();
  document.addEventListener("DOMContentLoaded", function () {
    createToggle();
    applyTranslations(lang);
  });
})();
