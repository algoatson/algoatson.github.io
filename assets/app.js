/* ============================================================================
   segfault.sh — frontend behavior. No dependencies.
   Progressive enhancement: the site is fully readable with this file removed.
   ========================================================================= */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- a cat lives in the console (hi, you opened devtools) -------------- */
  try {
    console.log(
      '%c\n             :                   :-===\n             -. ..             :======\n         ...:=-  -=:         .-=======\n      . ....:-=--=-.     .-: :=-======\n       :--:-:..:==.   . ..:=--=-:===:.\n   :=::--:---::.:=:      --==-:...:..:\n    .::-:----:-: ..       -=-:---:.-==\n        ..::::.            .:--:--:.:-\n             .               :--:::=:\n            .           .--:. ......\n                  ..:.  .==-::..:-:.\n                 :=====-.:--==:.-==-\n......::-:. .. .--======-.=====::-:\n.::-::::::::...-======--. -====--==.\n..............:==-:::-----.-=======:..\n      ......:.:::::-=======-=====----:\n   ..   :---:-=-=================. ..:\n .---:---=======================-\n.  :-===========================.\n',
      'font-family:monospace;line-height:1.05;color:#e7e7e7');
    console.log('%c  segfault.sh — built from a folder of text files. source is readable on purpose.',
      'color:#8c8c8c');
  } catch (e) {}

  /* ---- persisted prefs (real site, so localStorage is appropriate) ------- */
  const PREF = {
    get(k, d) { try { const v = localStorage.getItem('sf.' + k); return v === null ? d : v; }
                catch { return d; } },
    set(k, v) { try { localStorage.setItem('sf.' + k, v); } catch {} }
  };

  const root = document.documentElement;
  function applyMode(m) { root.dataset.mode = m; PREF.set('mode', m); }
  function applyCrt(c)  { root.dataset.crt  = c; PREF.set('crt', c); }
  if (PREF.get('mode')) applyMode(PREF.get('mode'));
  if (PREF.get('crt'))  applyCrt(PREF.get('crt'));

  /* ---- theme + crt toggles ----------------------------------------------- */
  $$('[data-toggle="mode"]').forEach(b => b.addEventListener('click', () =>
    applyMode(root.dataset.mode === 'light' ? 'dark' : 'light')));
  $$('[data-toggle="crt"]').forEach(b => b.addEventListener('click', () =>
    applyCrt(root.dataset.crt === 'on' ? 'off' : 'on')));

  /* ---- per-listing line-number toggle (ephemeral; resets on reload) ------- */
  /* the '#' button hides only its own gutter. Delegated so it survives the
     preview router swapping posts in and out — no re-binding on route. */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-toggle="nums"]'); if (!b) return;
    const fig = b.closest('.codeblock'); if (!fig) return;
    const hidden = fig.classList.toggle('nonums');   // true once the gutter is hidden
    b.setAttribute('aria-pressed', String(!hidden)); // pressed = numbers shown
  });

  /* ---- copy buttons on code listings ------------------------------------- */
  function bindCopy(scope = document) {
    $$('.codeblock', scope).forEach(block => {
      const btn = $('.copy', block);
      if (!btn || btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        const codeCell = $('td.code', block) || $('.highlight pre', block) || $('pre', block);
        const text = (codeCell ? codeCell.innerText : '').replace(/\n$/, '');
        try { await navigator.clipboard.writeText(text); }
        catch {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch {}
          ta.remove();
        }
        const old = btn.textContent;
        btn.textContent = 'copied'; btn.classList.add('done');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1100);
      });
    });
  }
  bindCopy();

  /* ---- typed hero command (once per session) ----------------------------- */
  function bootTyped() {
    const typed = $('.cmd .typed');
    if (!typed || typed.dataset.bound) return;
    typed.dataset.bound = '1';
    const text = typed.dataset.text || '';
    const played = sessionStorage.getItem('sf.typed');
    if (REDUCED || played) { typed.textContent = text; }
    else {
      sessionStorage.setItem('sf.typed', '1');
      let i = 0;
      typed.style.borderRightColor = 'var(--accent)';
      (function step() {
        typed.textContent = text.slice(0, i++);
        if (i <= text.length) setTimeout(step, 28);
        else setTimeout(() => { typed.style.borderRightColor = 'transparent'; }, 600);
      })();
    }
  }
  bootTyped();

  /* ---- reading progress bar + sticky-TOC scroll-spy (posts) -------------- */
  const progress = $('.progress');
  function updateProgress() {
    if (!progress) return;
    const de = document.documentElement;
    const max = de.scrollHeight - de.clientHeight;
    const p = ($('.prose') && max > 0) ? (de.scrollTop || document.body.scrollTop) / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  }

  let tocLinks = [], tocHeads = [];
  // long series boxes are capped + scrollable; keep the current part in view.
  function bootSeries() {
    const list = $('.series__list'), cur = list && $('.cur', list);
    if (cur && list.scrollHeight > list.clientHeight)
      list.scrollTop = cur.offsetTop - (list.clientHeight - cur.offsetHeight) / 2;
  }

  function bootToc() {
    tocLinks = []; tocHeads = [];
    const toc = $('.toc');
    if (!toc) return;
    $$('a[href^="#"]', toc).forEach(a => {
      const el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (el) { tocLinks.push(a); tocHeads.push(el); }
    });
    spyToc();
  }
  function spyToc() {
    if (!tocHeads.length) return;
    let idx = 0;                                  // last heading whose top cleared the gutter
    for (let i = 0; i < tocHeads.length; i++) {
      if (tocHeads[i].getBoundingClientRect().top <= 90) idx = i; else break;
    }
    // a short trailing section can't scroll its heading up to the gutter line —
    // the page bottoms out first — so it could never light up or feel "reached".
    // once we're at the bottom, the final heading is the current one.
    const de = document.documentElement;
    if (Math.ceil(window.scrollY + window.innerHeight) >= de.scrollHeight - 1) {
      idx = tocHeads.length - 1;
    }
    tocLinks.forEach((a, i) => a.classList.toggle('active', i === idx));
  }

  addEventListener('scroll', () => { updateProgress(); spyToc(); }, { passive: true });
  addEventListener('resize', updateProgress);
  bootToc(); bootSeries(); updateProgress();

  /* ---- image lightbox (click to zoom; no JS = plain inline image) -------- */
  let lbEl = null, lbReturn = null;
  function lightbox() {
    if (lbEl) return lbEl;
    lbEl = document.createElement('div');
    lbEl.className = 'lightbox';
    lbEl.setAttribute('role', 'dialog');
    lbEl.setAttribute('aria-modal', 'true');
    lbEl.tabIndex = -1;
    lbEl.innerHTML = '<img alt="">';
    lbEl.addEventListener('click', closeLightbox);
    document.body.appendChild(lbEl);
    return lbEl;
  }
  function openLightbox(img) {
    const box = lightbox(), full = $('img', box);
    full.src = img.currentSrc || img.src;
    full.alt = img.alt || '';
    lbReturn = document.activeElement;
    box.classList.add('open'); document.body.style.overflow = 'hidden'; box.focus();
  }
  function closeLightbox() {
    if (!lbEl || !lbEl.classList.contains('open')) return;
    lbEl.classList.remove('open'); document.body.style.overflow = '';
    if (lbReturn && lbReturn.focus) lbReturn.focus();
  }
  const lbOpen = () => !!(lbEl && lbEl.classList.contains('open'));
  function bootLightbox() {
    $$('.prose img').forEach(img => {
      if (img.dataset.lb) return;
      img.dataset.lb = '1';
      img.addEventListener('click', () => openLightbox(img));
    });
  }
  bootLightbox();

  /* ===================  FUZZY SEARCH (fzf-style)  ========================== */
  const DATA = (window.SEARCH || []).map(it => ({
    ...it,
    _t: it.title.toLowerCase(),
    _g: (it.tags || []).join(' ').toLowerCase(),
    _x: (it.text || '').toLowerCase()
  }));

  // subsequence fuzzy match -> {score, positions} or null. fzf-ish heuristics.
  function fuzzy(needle, hay) {
    if (!needle) return { score: 0, positions: [] };
    let h = 0, n = 0, score = 0, run = 0, positions = [];
    let prevMatch = -2;
    while (h < hay.length && n < needle.length) {
      if (hay[h] === needle[n]) {
        positions.push(h);
        run++;
        let bonus = 1;
        if (h === prevMatch + 1) bonus += run * 3;          // consecutive
        if (h === 0 || /[\s\-_/.]/.test(hay[h - 1])) bonus += 6; // word boundary
        score += bonus; prevMatch = h; n++;
      } else { run = 0; }
      h++;
    }
    if (n < needle.length) return null;                      // not all matched
    score -= (positions[positions.length - 1] - positions[0]) * 0.1; // tightness
    return { score, positions };
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  }
  function markPositions(str, positions) {
    if (!positions || !positions.length) return escapeHTML(str);
    const set = new Set(positions); let out = '';
    for (let i = 0; i < str.length; i++) {
      const c = escapeHTML(str[i]);
      out += set.has(i) ? `<mark>${c}</mark>` : c;
    }
    return out;
  }
  function snippet(item, terms) {
    if (!terms.length || !item._x) return '';
    let idx = -1, hit = '';
    for (const t of terms) { const i = item._x.indexOf(t); if (i >= 0 && (idx < 0 || i < idx)) { idx = i; hit = t; } }
    if (idx < 0) return '';
    const start = Math.max(0, idx - 32), end = Math.min(item.text.length, idx + 88);
    let s = item.text.slice(start, end);
    s = escapeHTML(s);
    for (const t of terms) {
      if (!t) continue;
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      s = s.replace(re, '<mark>$1</mark>');
    }
    return (start > 0 ? '…' : '') + s + (end < item.text.length ? '…' : '');
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return DATA.map(it => ({ it, titleHTML: escapeHTML(it.title), snip: '' }));
    const terms = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (const it of DATA) {
      let total = 0, ok = true, titlePos = null;
      for (const term of terms) {
        const f = fuzzy(term, it._t);
        let best = f ? f.score + 1000 : -Infinity, pos = f ? f.positions : null, from = f ? 'title' : null;
        const sub = it._t.indexOf(term);
        if (sub >= 0 && 900 - sub > best) { best = 900 - sub; pos = range(sub, term.length); from = 'title'; }
        if (it._g.indexOf(term) >= 0 && 600 > best) { best = 600; from = 'tag'; pos = null; }
        const xb = it._x.indexOf(term);
        if (xb >= 0 && 350 - Math.min(xb, 300) > best) { best = 350 - Math.min(xb, 300); from = 'text'; pos = null; }
        if (best === -Infinity) { ok = false; break; }
        total += best;
        if (from === 'title' && pos) titlePos = mergePos(titlePos, pos);
      }
      if (!ok) continue;
      total -= it.title.length * 0.3;        // prefer tighter titles
      out.push({ it, score: total, titleHTML: markPositions(it.title, titlePos), snip: snippet(it, terms) });
    }
    out.sort((a, b) => b.score - a.score || (a.it.title.length - b.it.title.length));
    return out;
  }
  const range = (s, len) => Array.from({ length: len }, (_, i) => s + i);
  const mergePos = (a, b) => a ? [...new Set([...a, ...b])].sort((x, y) => x - y) : b;

  /* ---- modal focus handling (return focus to opener on close) ------------ */
  let lastFocus = null;

  /* ---- palette UI -------------------------------------------------------- */
  const mask = $('.palette-mask');
  if (mask) {
    const input   = $('.palette__input input', mask);
    const results = $('.palette__results', mask);
    const counter = $('.palette__count .n', mask);
    let cur = 0, items = [];

    const open = () => {
      lastFocus = document.activeElement;
      mask.classList.add('open'); document.body.style.overflow = 'hidden';
      input.value = ''; render(''); input.focus();
    };
    const close = () => {
      const wasOpen = mask.classList.contains('open');
      mask.classList.remove('open'); document.body.style.overflow = '';
      if (wasOpen && lastFocus && lastFocus.focus) lastFocus.focus();
    };
    const isOpen = () => mask.classList.contains('open');

    function render(q) {
      items = search(q);
      counter.textContent = `${items.length}/${DATA.length}`;
      if (!items.length) {
        results.innerHTML = `<div class="palette__empty">no match for “${escapeHTML(q)}”. try fewer chars.</div>`;
        return;
      }
      cur = 0;
      results.innerHTML = items.map((r, i) => `
        <a class="presult" href="${r.it.url}" data-i="${i}" aria-selected="${i === 0}">
          <span class="pt">${r.titleHTML}</span><span class="pmeta">${r.it.date} · ${r.it.min}m${r.it.tags && r.it.tags[0] ? ' · ' + escapeHTML(r.it.tags[0]) : ''}</span>
          ${r.snip ? `<span class="psnip">${r.snip}</span>` : ''}
        </a>`).join('');
      $$('.presult', results).forEach(el => {
        el.addEventListener('mousemove', () => select(+el.dataset.i));
      });
      scrollSel();
    }
    function select(i) {
      const els = $$('.presult', results);
      if (!els.length) return;
      cur = (i + els.length) % els.length;
      els.forEach((el, n) => el.setAttribute('aria-selected', n === cur));
      scrollSel();
    }
    function scrollSel() {
      const el = $(`.presult[data-i="${cur}"]`, results);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
    const go = () => { const el = $(`.presult[data-i="${cur}"]`, results); if (el) { close(); location.href = el.href; } };

    input.addEventListener('input', () => render(input.value));
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j') || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); select(cur + 1); }
      else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k') || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); select(cur - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    // openers
    $$('[data-open="search"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(); }));
    window.__openPalette = open;
    window.__paletteOpen = isOpen;
  }

  /* ---- help overlay ------------------------------------------------------ */
  const help = $('.help-mask');
  const helpBox = help && $('.help', help);
  if (helpBox) helpBox.setAttribute('tabindex', '-1');
  const helpOpen  = () => { if (!help) return; lastFocus = document.activeElement;
    help.classList.add('open'); if (helpBox) helpBox.focus(); };
  const helpClose = () => {
    if (!help) return;
    const wasOpen = help.classList.contains('open');
    help.classList.remove('open');
    if (wasOpen && lastFocus && lastFocus.focus) lastFocus.focus();
  };
  if (help) {
    help.addEventListener('click', e => { if (e.target === help) helpClose(); });
    // nothing focusable inside the help dialog, so just trap Tab on it
    help.addEventListener('keydown', e => { if (e.key === 'Tab') e.preventDefault(); });
  }

  /* ---- list keyboard nav (j/k/enter/g/G) --------------------------------- */
  // only the primary index/tag listing — not the "related" listing inside a
  // post (that one would hijack j/k away from page scrolling on a post page).
  const getRows = () => $$('.listing .row').filter(r => !r.closest('.related'));
  let ri = -1;
  function rowSel(i) {
    const rows = getRows();
    if (!rows.length) return;
    ri = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((r, n) => r.classList.toggle('is-active', n === ri));
    rows[ri].scrollIntoView({ block: 'nearest' });
  }

  /* ---- re-init page-local behavior after a client route change (preview) -- */
  document.addEventListener('sf:route', () => { ri = -1; bindCopy(); bootTyped(); bootToc(); bootSeries(); updateProgress(); bootLightbox(); });

  /* ---- expand collapsed <details> for printing, restore afterwards ------- */
  let printOpened = [];
  addEventListener('beforeprint', () => {
    printOpened = $$('details:not([open])');
    printOpened.forEach(d => { d.open = true; });
  });
  addEventListener('afterprint', () => {
    printOpened.forEach(d => { d.open = false; });
    printOpened = [];
  });

  /* ---- global keys ------------------------------------------------------- */
  let lastG = 0;
  document.addEventListener('keydown', e => {
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    const paletteOpen = window.__paletteOpen && window.__paletteOpen();

    if (lbOpen()) { if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); } return; }

    if (!typing && !paletteOpen && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.ctrlKey && e.key.toLowerCase() === 'p'))) {
      if (window.__openPalette) { e.preventDefault(); window.__openPalette(); return; }
    }
    if (typing || paletteOpen) {
      if (e.key === 'Escape') { helpClose(); }
      return;
    }
    if (help && help.classList.contains('open')) { if (e.key === 'Escape' || e.key === '?') helpClose(); return; }

    // a post listing (home, tag pages) takes j/k/g/G as row navigation; any
    // other page (a post, /about, 404) takes them as vim-style page scrolling.
    const hasRows = () => getRows().length > 0;
    const STEP = 72;
    switch (e.key) {
      case '?': e.preventDefault(); helpOpen(); break;
      case 'j':
        e.preventDefault();
        if (hasRows()) rowSel(ri + 1); else scrollTo({ top: scrollY + STEP });
        break;
      case 'k':
        e.preventDefault();
        if (hasRows()) rowSel(ri - 1); else scrollTo({ top: scrollY - STEP });
        break;
      case 'G':
        e.preventDefault();
        if (hasRows()) rowSel(getRows().length - 1);
        else scrollTo({ top: document.documentElement.scrollHeight });
        break;
      case 'g': {
        const now = Date.now();
        if (now - lastG < 400) {
          e.preventDefault(); lastG = 0;
          if (hasRows()) rowSel(0); else scrollTo({ top: 0 });
        } else { lastG = now; }
        break;
      }
      case 'Enter': {
        const rows = getRows();
        if (rows.length && ri >= 0) { e.preventDefault(); rows[ri].click(); }
        break;
      }
      case 't': applyMode(root.dataset.mode === 'light' ? 'dark' : 'light'); break;
    }
  });

  /* test hook — undefined in a browser, so this is a no-op there; lets a node
     harness unit-test the fuzzy ranker (the signature feature). */
  if (typeof module !== 'undefined' && module.exports) module.exports = { fuzzy, search };
})();
