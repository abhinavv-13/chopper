// Analytics first-party ClipOnIt → POST /api/t. Contrat (format, props, cookies cv_vid/cv_ft) : tête de src/routes/analytics.rs.
// Vie privée : chemin sans query dans `p`, ctx.url réduite aux utm_*/ref/click ids, jamais de valeur saisie, pas de fingerprint.
// Tout est sous try/catch : le tracker ne doit jamais casser la page. `window.__cvOff = true` coupe l'envoi.
(function (w, d) {
  var KEEP = /^(utm_\w+|ref|gclid|fbclid|ttclid|msclkid)$/, CID = ["gclid", "fbclid", "ttclid", "msclkid"];
  var CO = /(^|\.)cliponit\.app$/; // cliponit.app + ses sous-domaines de langue (proxy glot) = un seul site
  var CLK = "a,button,[role=button],input,label,select,textarea,summary";
  // video/audio[controls] : le clic lit ou met en pause sans toucher au DOM → faux « dead_click » (#vp-video, prod nov.)
  var INTER = CLK + ",[role=link],[onclick],[tabindex],[contenteditable],video[controls],audio[controls]";
  // ── fonctions pures (testées via window.__cvTest) ──
  // sélecteur court stable : data-track > id (non généré) > tag.classe1.classe2 (classes « propres » seulement)
  function sel(el) {
    var a = el.getAttribute && el.getAttribute("data-track");
    if (a) return '[data-track="' + a.slice(0, 60) + '"]';
    if (el.id && !/\d{3,}|^\d|:/.test(el.id)) return "#" + el.id.slice(0, 60);
    var c = ((el.getAttribute && el.getAttribute("class")) || "").split(/\s+/).filter(function (x) { return /^[a-z_][\w-]{0,30}$/i.test(x); });
    return (el.tagName || "?").toLowerCase() + (c.length ? "." + c.slice(0, 2).join(".") : "");
  }
  // URL de ctx : seuls utm_*, ref et click ids survivent (pas d'email/token en query), pas de hash
  function cleanUrl(href) {
    var u = new URL(href), ks = [];
    u.searchParams.forEach(function (v, k) { if (!KEEP.test(k)) ks.push(k); });
    ks.forEach(function (k) { u.searchParams.delete(k); });
    u.hash = ""; return u.href.slice(0, 500);
  }
  // premier contact (cookie cv_ft) : referrer externe seulement (*.cliponit.app = interne), landing, utm_*, click_id "gclid:…", ts (ms)
  function firstTouch(href, ref) {
    var u = new URL(href), q = u.searchParams, o = {}, r = "";
    try { var rh = ref && new URL(ref); r = rh && rh.host !== u.host && !(CO.test(rh.hostname) && CO.test(u.hostname)) ? ref : ""; } catch (e) {}
    if (r) o.ref = r.slice(0, 200);
    o.landing = u.pathname.slice(0, 200);
    ["source", "medium", "campaign", "term", "content"].forEach(function (k) { var v = q.get("utm_" + k); if (v) o["utm_" + k] = v.slice(0, 100); });
    CID.some(function (k) { var v = q.get(k); return v && (o.click_id = k + ":" + v.slice(0, 150)); });
    o.ts = Date.now(); return o;
  }
  // rage : garde les clics < 800 ms et < 30 px du clic courant ; ≥ 3 → rage (l'appelant vide la liste)
  function rage(list, c) {
    list = list.filter(function (p) { return c.t - p.t < 800 && Math.hypot(p.x - c.x, p.y - c.y) < 30; });
    list.push(c); return list;
  }
  // thrash : h = 2 dernières pages vues [{p,t}] ; retour sur l'avant-dernière (A→B→A) en < 10 s = utilisateur perdu
  function thrash(h, p, t) { return h.length == 2 && h[0].p == p && h[1].p != p && t - h[0].t < 1e4; }
  if (w.__cvTestMode) w.__cvTest = { sel: sel, cleanUrl: cleanUrl, firstTouch: firstTouch, rage: rage, thrash: thrash };

  try {
    var nav = navigator, L = location;
    if (w.__cvT || nav.webdriver || (nav.languages && !nav.languages.length) || /HeadlessChrome|bot|crawl|spider/i.test(nav.userAgent) || L.pathname.indexOf("/api") === 0) return;
    w.__cvT = 1;
    var now = Date.now, q = [], SK = "cv_s", ctx = null;
    var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
    var ck = function (k) { var m = d.cookie.match("(?:^|; )" + k + "=([^;]*)"); return m && m[1]; };
    // sur *.cliponit.app : cookie partagé par tous les sous-domaines (Domain=.cliponit.app), l'ancien cookie de l'hôte seul est effacé ; localhost/dev : cookie d'hôte
    var DOM = CO.test(L.hostname) ? "; Domain=.cliponit.app" : "";
    var setCk = function (k, v) { if (DOM) d.cookie = k + "=; Max-Age=0; Path=/"; d.cookie = k + "=" + v + "; Max-Age=31536000; Path=/; SameSite=Lax" + DOM + (L.protocol == "https:" ? "; Secure" : ""); };
    var uuid = function () {
      try { return crypto.randomUUID(); } catch (e) {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) { return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16); });
      }
    };
    var UU = /^[0-9a-f-]{36}$/;
    // visiteur : cookie (partagé entre sous-domaines) puis localStorage (propre à chaque origine) ; re-posé à chaque visite (1 an glissant)
    var vid = ck("cv_vid"); if (!UU.test(vid || "")) vid = ls("cv_vid"); if (!UU.test(vid || "")) vid = uuid();
    ls("cv_vid", vid); setCk("cv_vid", vid);
    // premier contact : calculé une seule fois, valeur jamais réécrite (cookie puis localStorage) ; re-posé pour le partager entre sous-domaines
    var ft = ck("cv_ft") || ls("cv_ft") || encodeURIComponent(JSON.stringify(firstTouch(L.href, d.referrer)));
    ls("cv_ft", ft); setCk("cv_ft", ft);
    // session : localStorage (partagée entre onglets), expire après 30 min sans événement ; ctx préparé à la création
    var sess = function () {
      var s; try { s = JSON.parse(ls(SK)); } catch (e) {}
      if (!s || !s.i || now() - s.a > 18e5) {
        s = { i: uuid() };
        ctx = { ref: (d.referrer || "").slice(0, 300), url: cleanUrl(L.href), lang: nav.language, tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone, sw: screen.width, sh: screen.height };
      }
      s.a = now(); ls(SK, JSON.stringify(s)); return s.i;
    };
    var sid = sess();

    var flush = function () {
      try {
        if (w.__cvOff) { q = []; return; }
        while (q.length) {
          var b = { v: vid, s: sid }; if (ctx) b.ctx = ctx; b.e = q.splice(0, 40);
          var s = JSON.stringify(b), ok = false;
          try { ok = nav.sendBeacon("/api/t", new Blob([s], { type: "application/json" })); } catch (e) {}
          if (!ok) try { fetch("/api/t", { method: "POST", body: s, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" } }).catch(function () {}); } catch (e) {}
          ctx = null; // ctx seulement dans le 1er beacon de la session
        }
      } catch (e) {}
    };
    var ev = function (n, p) {
      try {
        if (w.__cvOff) return;
        sid = sess();
        var e = { n: n, p: path, t: now() };
        for (var k in p) if (!(k in e) && p[k] != null && p[k] !== "") e[k] = p[k];
        q.push(e); if (q.length >= 20) flush(); return e;
      } catch (x) {}
    };
    // erreurs API vues par l'utilisateur (4xx/5xx sur /api/*, sauf /api/t et le 401 de /api/me des visiteurs) : inscription refusée, quota, import…
    var F = w.fetch;
    if (F) w.fetch = function (u, o) {
      var r = F.apply(this, arguments);
      try {
        // même origine seulement : le widget glot Review (app.glotlang.com/api/review/…) remontait ses 403 comme les nôtres
        var raw = typeof u == "string" ? u : (u && u.url) || "", path = raw.indexOf(location.origin) == 0 || !/^https?:/.test(raw) ? raw.replace(/^https?:\/\/[^/]+/, "").split("?")[0] : "", t0 = now();
        if (path.indexOf("/api/") == 0 && path != "/api/t") r.then(function (x) {
          var ms = now() - t0; apiT.push(ms); if (ms > 3e3) lim("slow_api", { api: path.slice(0, 80), ms: ms }, 20);
          if (x.status >= 400 && !(x.status == 401 && path == "/api/me")) ev("api_error", { api: path.slice(0, 80), status: x.status, method: ((o && o.method) || "GET").toUpperCase() });
        }, function () {});
      } catch (e) {}
      return r;
    };
    w.cvTrack = function (n, p) { ev(String(n).slice(0, 64), p && typeof p == "object" ? p : {}); };

    var on = function (t, n, f, c) { t.addEventListener(n, function (e) { try { f(e); } catch (x) {} }, c); };
    // ── état par page ── (cnt : plafonds anti-spam par nom d'événement, remis à zéro à chaque page vue)
    var path = "", acc, visT, maxSc, steps, forms, deadN, errN, rq = [], deadW = 0, vitalsSent = 0, V = {};
    var cnt, seen, pg = 0, hist = [], actMs = 0, lastAct = 0, ltN = 0, ltMax = 0, apiT = [], navT = 0, lastMut = 0, calm, io;
    var lim = function (n, p, max) { if ((cnt[n] = (cnt[n] || 0) + 1) <= max) ev(n, p); };
    var visMs = function () { return acc + (visT ? now() - visT : 0); };
    var docH = function () { return Math.max(d.documentElement.scrollHeight, (d.body && d.body.scrollHeight) || 0, 1); };
    var scrollPct = function () { return Math.min(100, Math.round((w.scrollY + w.innerHeight) / docH() * 100)); };
    // leave : ms = temps VISIBLE depuis le dernier leave (onglet caché → horloge en pause), donc à SOMMER par page vue.
    // active_ms : part avec activité dans les 30 s précédentes. Deltas aussi pour long_task et api_timing.
    // form_abandon seulement au vrai départ (hard : nav SPA / pagehide), pas quand l'onglet est juste caché.
    // Un aller-retour d'onglet produit 2 leaves (deltas) ; un pagehide juste après le hidden (ms = 0) n'en produit pas.
    var leave = function (hard) {
      var ms = visMs(); acc = 0; visT = d.visibilityState == "hidden" ? 0 : now();
      maxSc = Math.max(maxSc, scrollPct());
      if (ms > 0) ev("leave", { ms: ms, scroll: maxSc, active_ms: Math.min(ms, actMs + (lastAct ? Math.min(now() - lastAct, 3e4) : 0)) });
      actMs = lastAct = 0;
      if (ltN) ev("long_task", { count: ltN, max: Math.round(ltMax) }); ltN = ltMax = 0;
      if (apiT.length) { apiT.sort(function (a, b) { return a - b; }); ev("api_timing", { count: apiT.length, p50: apiT[apiT.length >> 1], max: apiT[apiT.length - 1] }); apiT = []; }
      if (hard) for (var f in forms) if (!forms[f].done) { forms[f].done = 1; ev("form_abandon", { form: f, field: forms[f].field }); }
      if (!vitalsSent) { vitalsSent = 1; for (var m in V) ev("vitals", { metric: m, value: m == "CLS" ? Math.round(V[m] * 1e4) / 1e4 : Math.round(V[m]) }); }
    };
    var page = function () {
      var np = L.pathname; if (np === path) return; // même chemin (query/hash/replaceState) : pas de nouvelle page vue
      if (path) leave(1);
      navT = path ? now() : 0; // nav SPA : nav_timing mesuré jusqu'au DOM calme
      path = np; acc = 0; visT = d.visibilityState == "hidden" ? 0 : now(); maxSc = 0; steps = {}; forms = {}; deadN = errN = 0;
      cnt = {}; seen = {}; pg++; if (io) io.disconnect(); // les [data-track-view] sont ré-observés par scan()
      var e = ev("pageview", { title: d.title.slice(0, 120) });
      setTimeout(function () { try { if (e) e.title = d.title.slice(0, 120); } catch (x) {} }, 500); // Leptos pose le titre après le pushState
      if (thrash(hist, np, now())) ev("thrash", { via: hist[1].p });
      hist = hist.concat({ p: np, t: now() }).slice(-2);
      settle();
    };

    // ── view : [data-track-view] visible ≥ 50 % (ou ≥ 50 % de l'écran) pendant 1 s, une fois par page vue ──
    if (w.IntersectionObserver) io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { try {
        var el = x.target, id = (el.getAttribute("data-track-view") || sel(el)).slice(0, 80), g = pg;
        clearTimeout(el.__cvT);
        if (x.isIntersecting && (x.intersectionRatio >= .5 || x.intersectionRect.height >= w.innerHeight / 2) && !seen[id])
          el.__cvT = setTimeout(function () { if (g == pg && !seen[id]) { seen[id] = 1; ev("view", { id: id }); } }, 1000);
      } catch (e) {} });
    }, { threshold: [0, .1, .25, .5] });

    // ── vidéos (30 événements max chacune) ; déco autoplay+muted+loop ignorée sauf data-track ──
    var video = function (v) {
      var tr = v.getAttribute("data-track");
      if (v.__cvM || (!tr && v.autoplay && v.muted && v.loop)) return;
      var s = v.__cvM = {}, n = 0, pct = function () { return v.duration > 0 ? Math.round(v.currentTime / v.duration * 100) : 0; };
      var f = function (k, p) { if (n++ < 30) { p.id = (tr || (v.currentSrc || v.src || "").split(/[?#]/)[0].split("/").pop() || "video").slice(0, 80); ev(k, p); } };
      var prog = function (end) { var c = end ? 100 : pct(); [25, 50, 75, 100].forEach(function (k) { if (c >= k && !s[k]) { s[k] = 1; f("video_progress", { pct: k }); } }); };
      on(v, "play", function () { f("video_play", { autoplay: !!v.autoplay }); });
      on(v, "pause", function () { if (!v.ended) f("video_pause", { pct: pct() }); });
      on(v, "timeupdate", function () { prog(); });
      on(v, "ended", function () { prog(1); });
      on(v, "error", function () { f("video_error", { code: v.error && v.error.code }); });
    };

    // ── ui_error : erreur visible, jamais son texte sauf data-track-text ; re-signalée si elle réapparaît / change de longueur ──
    var ERR = "[role=alert],.error,.toast-error,[aria-invalid=true]";
    var uiErr = function (el) {
      var inv = el.getAttribute("aria-invalid") == "true", len = (el.textContent || "").trim().length;
      var sig = el.getClientRects().length && (inv || len) ? len + 1 : 0;
      if (sig && sig != el.__cvE) lim("ui_error", { sel: sel(el), key: (el.getAttribute("data-i18n") || el.getAttribute("data-error") || el.getAttribute("class") || "").slice(0, 80),
        len: inv ? null : len, text: el.hasAttribute("data-track-text") ? el.textContent.trim().slice(0, 200) : null }, 10);
      el.__cvE = sig;
    };
    var scan = function () {
      [].forEach.call(d.querySelectorAll("[data-track-view],video," + ERR), function (el) { try {
        if (io && el.__cvV != pg && el.hasAttribute("data-track-view")) { el.__cvV = pg; io.observe(el); }
        if (el.tagName == "VIDEO") video(el);
        if (el.matches(ERR)) uiErr(el);
      } catch (e) {} });
    };
    // DOM calme 300 ms → nav_timing (pushState → dernière mutation) puis scan ; scan aussi toutes les 5 s
    var settle = function () { clearTimeout(calm); calm = setTimeout(function () { try {
      if (navT) { ev("nav_timing", { ms: Math.max(0, lastMut - navT) }); navT = 0; }
      scan();
    } catch (e) {} }, 300); };
    // ponytail: DOM jamais calme (animation JS) = pas de nav_timing ; plafond si ça se voit
    try { new MutationObserver(function () { lastMut = now(); settle(); }).observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-invalid", "class", "hidden"] }); } catch (e) {}

    // navigation SPA : le routeur Leptos passe par history.pushState
    ["pushState", "replaceState"].forEach(function (k) {
      var o = history[k];
      history[k] = function () { var r = o.apply(this, arguments); try { page(); } catch (e) {} return r; };
    });
    w.addEventListener("popstate", function () { try { page(); } catch (e) {} });
    page();

    // ── activité (pour active_ms) ──
    var act = function () { var t = now(); if (lastAct) actMs += Math.min(t - lastAct, 3e4); lastAct = t; };
    ["mousemove", "keydown", "scroll", "touchstart", "pointerdown"].forEach(function (k) { on(d, k, act, { capture: true, passive: true }); });
    // ── exit_intent, copy, paste (longueur seule), file_pick (jamais le nom), réseau ──
    on(d, "mouseout", function (e) { if (!e.relatedTarget && e.clientY <= 0) lim("exit_intent", {}, 1); });
    var elOf = function (t) { return t && t.nodeType != 1 ? t.parentElement : t; };
    on(d, "copy", function (e) { var t = elOf(e.target); if (t) lim("copy", { sel: sel(t) }, 20); }, true);
    on(d, "paste", function (e) {
      var t = elOf(e.target), c = e.clipboardData;
      if (t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) lim("paste", { sel: sel(t), len: c ? c.getData("text").length : null }, 20);
    }, true);
    on(d, "change", function (e) {
      var t = e.target, fs = t && t.type == "file" && t.files, sz = 0; if (!fs) return;
      [].forEach.call(fs, function (x) { sz += x.size; });
      lim("file_pick", { accept: (t.getAttribute("accept") || "").slice(0, 100), size_mb: Math.round(sz / 104857.6) / 10, type: fs[0] ? fs[0].type : null, count: fs.length }, 20);
    }, true);
    on(w, "offline", function () { lim("offline", {}, 10); });
    on(w, "online", function () { lim("online", {}, 10); });

    on(w, "scroll", function () {
      var p = scrollPct(); if (p > maxSc) maxSc = p;
      [25, 50, 75, 100].forEach(function (s) { if (p >= s && !steps[s]) { steps[s] = 1; ev("scroll", { pct: s }); } });
    }, { passive: true });

    // ── clics : heatmap (x/y en ‰ du document), rage, dead, outbound ──
    on(d, "click", function (e) {
      var t = e.target; if (t && t.nodeType != 1) t = t.parentElement; if (!t || !t.closest) return;
      var el = t.closest("[data-track]") || t.closest(CLK) || t, tag = el.tagName;
      var noLbl = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || el.isContentEditable;
      var de = d.documentElement, info = {
        sel: sel(el),
        label: noLbl ? "" : (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || el.getAttribute("alt") || "").replace(/\s+/g, " ").trim().slice(0, 60),
        x: Math.round(e.pageX / Math.max(de.scrollWidth, de.clientWidth, 1) * 1000), y: Math.round(e.pageY / docH() * 1000), vw: w.innerWidth
      };
      ev("click", info);
      rq = rage(rq, { x: e.clientX, y: e.clientY, t: now() });
      if (rq.length >= 3) { rq = []; ev("rage_click", info); }
      var a = t.closest("a[href]");
      if (a && /^https?:$/.test(a.protocol) && a.host && a.host != L.host && !(CO.test(a.hostname) && CO.test(L.hostname))) ev("outbound", { href: a.hostname });
      // dead : élément non interactif, aucune mutation DOM ni changement d'URL en 1 s. Prudent : pas de double-clic ni de
      // sélection de texte, pas body/html, une fenêtre d'observation à la fois, 5 max par page.
      // shadow DOM (<glot-locale-switcher>) : `t` = l'hôte, le vrai bouton est dans composedPath, et le menu ouvert ne mute pas
      // le DOM observé → faux dead_click (1 962 le 19/11). On teste la cible réelle.
      var p0 = e.composedPath && e.composedPath()[0];
      if (deadW || deadN >= 5 || e.detail > 1 || t.closest(INTER) || (p0 && p0 != t && p0.closest && p0.closest(INTER)) || t == d.body || t == de || (w.getSelection ? String(getSelection()) : "").length) return;
      var changed = 0, href = L.href, mo = new MutationObserver(function () { changed = 1; });
      mo.observe(de, { childList: true, subtree: true, attributes: true, characterData: true }); deadW = 1;
      setTimeout(function () { mo.disconnect(); deadW = 0; if (!changed && href == L.href && deadN < 5) { deadN++; ev("dead_click", info); } }, 1000);
    }, true);

    // ── formulaires : start / submit / abandon (nom du dernier champ touché, jamais sa valeur) ──
    var fid = function (f) { return (f.id || f.getAttribute("name") || (f.getAttribute("action") || "").split("?")[0] || sel(f)).slice(0, 80); };
    var fieldOf = function (t) { var f = t && t.closest && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.closest("form"); return f && [fid(f), (t.getAttribute("name") || t.id || t.type || "").slice(0, 60)]; };
    var touch = function (e) {
      var r = fieldOf(e.target); if (!r) return;
      var s = forms[r[0]]; if (!s) { s = forms[r[0]] = { field: r[1] }; ev("form_start", { form: r[0], field: r[1] }); }
      if (!s.done) s.field = r[1];
    };
    on(d, "focusin", touch, true); on(d, "change", touch, true);
    on(d, "submit", function (e) {
      var f = e.target; if (!f || f.tagName != "FORM") return;
      var k = fid(f), s = forms[k] || (forms[k] = {}); s.done = 1; ev("form_submit", { form: k, field: s.field });
    }, true);

    // ── erreurs JS (pas les erreurs de chargement de ressources : écoute en bulle), 10 max par page ──
    var err = function (msg, src, line) { if (errN++ < 10) ev("error", { msg: String(msg || "error").slice(0, 200), src: String(src || "").split("?")[0].slice(0, 200), line: line }); };
    on(w, "error", function (e) { err(e.message, e.filename, e.lineno); });
    on(w, "unhandledrejection", function (e) { var r = e.reason; err(r && r.message || r); });
    // panic Rust (console_error_panic_hook → console.error « panicked at … ») : le message, sinon seul « unreachable » arrive
    try { var ce = console.error; console.error = function (m) { try { if (typeof m == "string" && m.indexOf("panicked at") >= 0) err(m, "wasm-panic", 0); } catch (x) {} return ce.apply(this, arguments); }; } catch (e) {}

    // ── web vitals (approx) : envoyés une fois, au leave de la 1re page ──
    // ponytail: CLS = somme brute (pas de fenêtres de session), INP = pire interaction (pas p98) ; web-vitals si la précision compte.
    var po = function (type, f, o) { try { new PerformanceObserver(function (l) { l.getEntries().forEach(f); }).observe(Object.assign({ type: type, buffered: true }, o)); } catch (e) {} };
    po("largest-contentful-paint", function (x) { V.LCP = x.startTime; });
    po("layout-shift", function (x) { if (!x.hadRecentInput) V.CLS = (V.CLS || 0) + x.value; });
    po("event", function (x) { if (x.interactionId && x.duration > (V.INP || 0)) V.INP = x.duration; }, { durationThreshold: 40 });
    po("paint", function (x) { if (x.name == "first-contentful-paint") V.FCP = x.startTime; });
    // long tasks > 200 ms agrégées au leave ; > 1 s = freeze (Chromium seulement)
    po("longtask", function (x) { var u = x.duration; if (u > 200) { ltN++; if (u > ltMax) ltMax = u; if (u > 1e3) lim("freeze", { ms: Math.round(u) }, 3); } });
    try { var nt = performance.getEntriesByType("navigation")[0]; if (nt && nt.responseStart > 0) V.TTFB = nt.responseStart; } catch (e) {}

    // ── envoi : toutes les 5 s, à 20 événements, et au départ (sendBeacon survit au déchargement) ──
    setInterval(function () { flush(); try { scan(); } catch (e) {} }, 5000);
    on(d, "visibilitychange", function () { if (d.visibilityState == "hidden") { leave(); flush(); } else visT = now(); });
    on(w, "pagehide", function () { leave(1); flush(); });
  } catch (e) {}
})(window, document);
