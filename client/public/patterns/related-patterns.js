/**
 * Central catalog of all published patterns.
 * The Related Patterns section on each page uses this to display 3 random cards.
 */
const PATTERN_CATALOG = [
  {
    slug: "kawaii-strawberry",
    href: "kawaii-strawberry.html",
    name: "Kawaii Strawberry",
    image: null,
    bgColor: "#c47a9a",
    beads: "999",
    colors: "9",
    tag: "Kawaii",
    swatches: ["#d43f3f","#e8735a","#f4c2c2","#2e7d32","#66bb6a"],
    swatchColors: ["#d43f3f","#2e7d32","#c47a9a"]
  },
  {
    slug: "teddy-bear",
    href: "teddy-bear.html",
    name: "Kawaii Teddy Bear",
    image: "/assets/patterns/teddy-bear.png",
    beads: "4,740",
    colors: "14",
    tag: "Kawaii",
    swatches: ["#FE9F72","#8A4526","#D37C46","#B7714A","#000000"],
    swatchColors: ["#D37C46","#8A4526","#B7714A"]
  },
  {
    slug: "psyduck-usagi",
    href: "psyduck-usagi.html",
    name: "Usagi Psyduck",
    image: "/assets/patterns/psyduck-usagi-fuse-beads-preview.jpeg",
    beads: "1,347",
    colors: "14",
    tag: "Characters",
    swatches: ["#FFD67D","#8D614C","#F5ECD2","#F2D9BA","#D19066"],
    swatchColors: ["#FFD67D","#8D614C","#D19066"]
  },
  {
    slug: "ditto-transforming-into-lapras",
    href: "ditto-transforming-into-lapras.html",
    name: "Ditto Transforming into Lapras",
    image: "/assets/patterns/ditto-transforming-into-lapras.png",
    beads: "353",
    colors: "19",
    tag: "Characters",
    swatches: ["#7CC4FF","#000000","#FEFFFF","#34488E","#AEB4F2"],
    swatchColors: ["#7CC4FF","#34488E","#AEB4F2"]
  },
  {
    slug: "cat-forest-pixel-art-fuse-beads-pattern",
    href: "cat-forest-pixel-art-fuse-beads-pattern.html",
    name: "Cat Forest",
    image: "/assets/patterns/cat-forest-pixel-art-fuse-beads-pattern-preview.png",
    beads: "6,241",
    colors: "15",
    tag: "Animals",
    swatches: ["#4A7038","#E87830","#2D5C28","#8EC06A","#5A3820"],
    swatchColors: ["#4A7038","#E87830","#2D5C28"]
  },
  {
    slug: "cute-cat-pixel-art-fuse-beads-pattern",
    href: "cute-cat-pixel-art-fuse-beads-pattern.html",
    name: "Cute Cat",
    image: "/assets/patterns/cute-cat-pixel-art-fuse-beads-pattern-preveiw.png",
    beads: "1,600",
    colors: "38",
    tag: "Animals",
    swatches: ["#1C1C14","#5ABD50","#E8A030","#E0B8C8","#A8D830"],
    swatchColors: ["#5ABD50","#E8A030","#1C1C14"]
  },
  {
    slug: "ditto-pokemon-pixel-art-fuse-beads-pattern",
    href: "ditto-pokemon-pixel-art-fuse-beads-pattern.html",
    name: "Ditto Pok\u00e9mon",
    image: "/assets/patterns/ditto-pokemon-pixel-art-fuse-beads-pattern-preview.png",
    beads: "868",
    colors: "15",
    tag: "Characters",
    swatches: ["#4A3870","#8A70C0","#C0AADE","#E8D8F4","#1A1030"],
    swatchColors: ["#8A70C0","#4A3870","#C0AADE"]
  },
  {
    slug: "kawaii-cat-girl-drinking-tea-pixel-art-fuse-beads-pattern",
    href: "kawaii-cat-girl-drinking-tea-pixel-art-fuse-beads-pattern.html",
    name: "Kawaii Cat Girl Drinking Tea",
    image: "/assets/patterns/kawaii-cat-girl-drinking-tea-pixel-art-fuse-beads-pattern-preview.png",
    beads: "8,422",
    colors: "49",
    tag: "Characters",
    swatches: ["#1C3850","#2A6878","#4A9878","#C87890","#E8C098"],
    swatchColors: ["#2A6878","#C87890","#4A9878"]
  },
  {
    slug: "kikis-delivery-service-lighthouse-pixel-art-fuse-beads-pattern",
    href: "kikis-delivery-service-lighthouse-pixel-art-fuse-beads-pattern.html",
    name: "Kiki\u2019s Lighthouse",
    image: "/assets/patterns/kikis-delivery-service-lighthouse-pixel-art-fuse-beads-pattern-preview.png",
    beads: "1,024",
    colors: "29",
    tag: "Characters",
    swatches: ["#3860A8","#E88030","#F0C040","#C86020","#0C1825"],
    swatchColors: ["#3860A8","#E88030","#F0C040"]
  },
  {
    slug: "maomao-apothecary-diaries-kimono-pixel-art-fuse-beads-pattern",
    href: "maomao-apothecary-diaries-kimono-pixel-art-fuse-beads-pattern.html",
    name: "Maomao Kimono",
    image: "/assets/patterns/maomao-apothecary-diaries-kimono-pixel-art-fuse-beads-pattern-preview.png",
    beads: "6,370",
    colors: "50",
    tag: "Characters",
    swatches: ["#2A6040","#3A8870","#4878A8","#E8B888","#0C1020"],
    swatchColors: ["#2A6040","#4878A8","#E8B888"]
  },
  {
    slug: "maomao-apothecary-diaries-pixel-art-fuse-beads-pattern",
    href: "maomao-apothecary-diaries-pixel-art-fuse-beads-pattern.html",
    name: "Maomao Apothecary Diaries",
    image: "/assets/patterns/maomao-apothecary-diaries-pixel-art-fuse-beads-pattern-preview.png",
    beads: "13,800",
    colors: "50",
    tag: "Characters",
    swatches: ["#3848A0","#2A8890","#D8A830","#E86030","#1C1430"],
    swatchColors: ["#3848A0","#D8A830","#E86030"]
  },
  {
    slug: "tanjiro-demon-slayer-pixel-art-fuse-beads-pattern",
    href: "tanjiro-demon-slayer-pixel-art-fuse-beads-pattern.html",
    name: "Tanjiro Demon Slayer",
    image: "/assets/patterns/tanjiro-demon-slayer-pixel-art-fuse-beads-pattern-preview.png",
    beads: "3,392",
    colors: "35",
    tag: "Characters",
    swatches: ["#7A1810","#C83020","#E87030","#F0B820","#0C0C0C"],
    swatchColors: ["#C83020","#E87030","#F0B820"]
  },
  {
    slug: "tanjiro-kamado-demon-slayer-wisteria-pixel-art-fuse-beads-pattern",
    href: "tanjiro-kamado-demon-slayer-wisteria-pixel-art-fuse-beads-pattern.html",
    name: "Tanjiro & Wisteria",
    image: "/assets/patterns/tanjiro-kamado-demon-slayer-wisteria-pixel-art-fuse-beads-pattern-preview.png",
    beads: "26,410",
    colors: "65",
    tag: "Characters",
    swatches: ["#9070B8","#C8B8E0","#3858A8","#E8B888","#1C1830"],
    swatchColors: ["#9070B8","#3858A8","#C8B8E0"]
  },
  {
    slug: "vintage-cat-portrait-pixel-art-fuse-beads-pattern",
    href: "vintage-cat-portrait-pixel-art-fuse-beads-pattern.html",
    name: "Vintage Cat Portrait",
    image: "/assets/patterns/vintage-cat-portrait-pixel-art-fuse-beads-pattern-preview.png",
    beads: "11,040",
    colors: "41",
    tag: "Animals",
    swatches: ["#C89030","#D87030","#C83028","#F0E0C0","#1A1512"],
    swatchColors: ["#C89030","#C83028","#D87030"]
  }
];

(function () {
  var i18n = window.__i18nPatterns;
  var lang = i18n ? i18n.getLang() : "en";
  function t(key) { return i18n ? i18n.t(key, lang) : key; }

  var currentSlug = location.pathname.split("/").pop().replace(".html", "");
  var grid = document.querySelector(".related-section .pattern-grid");
  if (!grid) return;

  // Filter out current pattern
  var others = PATTERN_CATALOG.filter(function (p) { return p.slug !== currentSlug; });

  // Shuffle (Fisher-Yates) and pick up to 3
  for (var i = others.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = others[i]; others[i] = others[j]; others[j] = tmp;
  }
  var picks = others.slice(0, 3);

  if (picks.length === 0) {
    grid.closest(".related-section").style.display = "none";
    return;
  }

  grid.innerHTML = picks.map(function (p) {
    var previewInner = p.image
      ? '<img src="' + p.image + '" alt="' + p.name + ' fuse bead pattern preview" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">'
      : '<div style="position:absolute;inset:0;background:' + p.bgColor + ';"></div>' +
        '<div class="card-preview-dots" style="opacity:0.15;"></div>';

    return '<a class="pattern-card" href="' + p.href + '" role="listitem" aria-label="View ' + p.name + ' pattern">' +
      '<div class="card-preview" aria-hidden="true">' + previewInner + '</div>' +
      '<div class="card-swatches" aria-hidden="true">' +
        p.swatches.map(function (c) { return '<div class="card-swatch" style="background:' + c + '"></div>'; }).join("") +
      '</div>' +
      '<div class="card-body">' +
        '<h3 class="card-name">' + p.name + '</h3>' +
        '<div class="card-meta">' +
          '<span class="card-meta-item">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.5" fill="currentColor"/><circle cx="2" cy="6" r="1.5" fill="currentColor" opacity="0.5"/><circle cx="10" cy="6" r="1.5" fill="currentColor" opacity="0.5"/></svg> ' +
            p.beads + ' ' + t('beadsTotal') +
          '</span>' +
          '<span class="card-meta-item">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="3" cy="6" r="2" fill="' + p.swatchColors[0] + '"/><circle cx="7" cy="4" r="2" fill="' + p.swatchColors[1] + '"/><circle cx="9.5" cy="7" r="2" fill="' + p.swatchColors[2] + '"/></svg> ' +
            p.colors + ' ' + t('colors') +
          '</span>' +
        '</div>' +
        '<div class="card-footer">' +
          '<span class="card-tag">' + p.tag + '</span>' +
          '<div class="card-arrow" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6h6M6.5 3.5L9 6l-2.5 2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '</div>' +
      '</div>' +
    '</a>';
  }).join("\n");
})();
