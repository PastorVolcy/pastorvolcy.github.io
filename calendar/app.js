/* FAC Social Calendar: monthly approval app. Data: data/index.json + data/<YYYY-MM>.json */
(function () {
  'use strict';
  var APPROVAL_EMAIL = 'ecyapres@gmail.com';
  var APP_URL = 'https://pastorvolcy.github.io/calendar/';
  var $ = function (id) { return document.getElementById(id); };
  var state = { index: null, month: null, key: null, filter: null, current: -1, store: null };

  var ICON = {
    play: '<svg viewBox="0 0 12 14"><path d="M1 1l10 6-10 6z" fill="#fff"/></svg>',
    stack: '<svg class="kind" viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="15" height="15" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M3 7v12.5A1.5 1.5 0 0 0 4.5 21H17" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    video: '<svg class="kind" viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="13" height="13" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M15.5 10.5 21 7v10l-5.5-3.5z" fill="#fff"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.6 2h-3.3v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.2a6.3 6.3 0 1 0 5.3 6.2V8.6a8 8 0 0 0 4.4 1.3V6.6a4.6 4.6 0 0 1-4.4-4.6z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V2h-2.6C11.5 2 10.6 3.4 10.6 5.8V8H8v3h2.6v11H14V11h2.6l.4-3z"/></svg>',
    chevL: '<svg viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevR: '<svg viewBox="0 0 12 20"><path d="M2 2l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var TYPE_LABEL = { clip: 'Sermon clip', carousel: 'Carousel', graphic: 'Graphic' };
  var TYPE_PLURAL = { clip: ['sermon clip', 'sermon clips'], carousel: ['carousel', 'carousels'], graphic: ['graphic', 'graphics'] };
  var PLATFORM = { tiktok: 'TikTok', facebook: 'Facebook' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON3 = MONTHS.map(function (m) { return m.slice(0, 3); });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function parseDate(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtTime(t) { var p = t.split(':'), h = +p[0], m = p[1]; var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m + ' ' + ap; }
  function fmtShort(d) { var x = parseDate(d); return MON3[x.getMonth()] + ' ' + x.getDate(); }
  function fmtLong(p) { var x = parseDate(p.date); return DAYS[x.getDay()] + ', ' + MON3[x.getMonth()] + ' ' + x.getDate() + ' \u00b7 ' + fmtTime(p.time) + ' ET'; }
  function hms(s) { s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
  function monthLabel(key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }

  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200); }

  /* ---------- storage ---------- */
  function storeKey() { return 'fac-cal:' + state.key; }
  function loadStore() { try { state.store = JSON.parse(localStorage.getItem(storeKey())) || {}; } catch (e) { state.store = {}; } if (!state.store.d) state.store.d = {}; }
  function saveStore() { try { localStorage.setItem(storeKey(), JSON.stringify(state.store)); } catch (e) { } }
  function decision(id) { return state.store.d[id] || null; }
  function counts() {
    var a = 0, c = 0, posts = state.month.posts;
    posts.forEach(function (p) { var d = decision(p.id); if (d && d.s === 'approved') a++; else if (d && d.s === 'change') c++; });
    return { approved: a, change: c, decided: a + c, total: posts.length };
  }

  /* ---------- loading ---------- */
  function fetchJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }); }

  function init() {
    fetchJSON('data/index.json').then(function (idx) {
      state.index = idx;
      var want = new URLSearchParams(location.search).get('m') || (location.hash || '').replace('#', '');
      var months = idx.months || [];
      var pick = months.filter(function (m) { return m.month === want; })[0] || months.filter(function (m) { return m.month === idx.current; })[0] || months[months.length - 1];
      if (!pick) throw new Error('No months listed');
      return openMonth(pick.month);
    }).catch(function (e) {
      $('monthTitle').textContent = 'Calendar';
      $('monthSub').textContent = 'Could not load the calendar. Check your connection and reopen the app.';
      console.error(e);
    });
  }

  function openMonth(key) {
    return fetchJSON('data/' + key + '.json').then(function (m) {
      state.month = m; state.key = key; state.filter = null;
      m.posts.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
      loadStore();
      if (history.replaceState) history.replaceState(null, '', '?m=' + key);
      render();
    });
  }

  /* ---------- main render ---------- */
  function render() {
    var m = state.month;
    var name = MONTHS[+state.key.split('-')[1] - 1];
    $('monthTitle').textContent = name;
    document.title = name + ' \u00b7 FAC Social Calendar';
    $('monthSub').textContent = (m.church || 'First Alliance Church') + ' \u00b7 ' + m.posts.length + ' posts';
    var fb = (m.notes || []).filter(function (n) { return /facebook/i.test(n); })[0];
    $('fbNote').textContent = fb ? 'Facebook: waiting on page access' : 'Info';
    renderGrid(); renderChips(); renderStatus();
  }

  function weekStart(d) { var x = parseDate(d); x.setDate(x.getDate() - x.getDay()); return x; }
  function weekLabel(ws) {
    var we = new Date(ws); we.setDate(we.getDate() + 6);
    var a = MON3[ws.getMonth()] + ' ' + ws.getDate();
    var b = (we.getMonth() === ws.getMonth() ? '' : MON3[we.getMonth()] + ' ') + we.getDate();
    return 'Week of ' + a + '\u2013' + b;
  }
  function renderGrid() {
    var g = $('grid'); var html = '', lastWeek = null, m = +state.key.split('-')[1] - 1;
    var posts = state.month.posts;
    posts.forEach(function (p, i) {
      var ws = weekStart(p.date), wk = ws.getTime();
      if (wk !== lastWeek) {
        lastWeek = wk;
        var n = 0, a = 0;
        posts.forEach(function (q) { if (weekStart(q.date).getTime() === wk) { n++; var dq = decision(q.id); if (dq) a++; } });
        html += '<h2 class="weekhead" role="presentation"><span>' + esc(weekLabel(ws)) + '</span><span class="wkmeta">' + n + ' posts' + (a ? ' \u00b7 ' + a + ' reviewed' : '') + '</span></h2>';
      }
      var d = decision(p.id);
      var dim = state.filter && p.type !== state.filter ? ' dim' : '';
      var img = p.thumb || (p.images && p.images[0]) || (p.youtube && p.youtube.thumbnail) || '';
      html += '<button class="tile' + dim + '" role="listitem" data-i="' + i + '" aria-label="' + esc(TYPE_LABEL[p.type] + ', ' + fmtLong(p) + ': ' + p.title + (d ? (d.s === 'approved' ? ', approved' : ', needs change') : '')) + '">' +
        '<img src="' + esc(img) + '" alt="" width="400" height="500" loading="' + (i < 9 ? 'eager' : 'lazy') + '" decoding="async">' +
        (p.type === 'clip' ? '<span class="play">' + ICON.play + '</span>' + ICON.video : '') +
        (p.type === 'carousel' ? ICON.stack : '') +
        '<span class="date">' + fmtShort(p.date) + ' \u00b7 ' + fmtTime(p.time).replace(':00', '').replace(' ', '') + '</span>' +
        (d ? '<span class="badge ' + (d.s === 'approved' ? 'ok">\u2713' : 'chg">!') + '</span>' : '') +
        '</button>';
    });
    g.innerHTML = html || '<p class="empty">No posts this month yet.</p>';
  }

  function renderChips() {
    var c = { clip: 0, carousel: 0, graphic: 0 };
    state.month.posts.forEach(function (p) { c[p.type] = (c[p.type] || 0) + 1; });
    $('chips').innerHTML = ['clip', 'carousel', 'graphic'].filter(function (t) { return c[t]; }).map(function (t) {
      return '<button class="chip" data-type="' + t + '" aria-pressed="' + (state.filter === t) + '">' + c[t] + ' ' + TYPE_PLURAL[t][c[t] === 1 ? 0 : 1] + '</button>';
    }).join('');
  }

  function renderStatus() {
    var k = counts(), pill = $('statusPill'), btn = $('btnPrimary'), hint = $('hint');
    pill.className = 'pill';
    if (state.store.sentAt && k.decided === k.total) {
      pill.classList.add('sent'); pill.textContent = 'Sent ' + new Date(state.store.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (k.decided === k.total) {
      pill.classList.add('ready'); pill.textContent = 'Reviewed \u00b7 ready to send';
    } else if (k.decided) {
      pill.textContent = k.decided + ' of ' + k.total + ' reviewed';
    } else {
      pill.textContent = 'Ready for your approval';
    }
    if (k.decided === k.total) {
      btn.textContent = state.store.sentAt ? 'Send approval again' : 'Send approval';
      btn.classList.toggle('done', !!state.store.sentAt);
      hint.textContent = k.approved + ' approved' + (k.change ? ' \u00b7 ' + k.change + ' with changes' : '') + ' \u00b7 tap any post to edit';
    } else {
      var left = k.total - k.decided;
      btn.textContent = k.decided ? 'Approve remaining ' + left : 'Approve all ' + k.total;
      btn.classList.remove('done');
      hint.textContent = k.decided ? 'Posts you marked keep your choice' : 'or tap any post to leave a note';
    }
  }

  /* ---------- post sheet ---------- */
  function openPost(i) {
    state.current = i;
    var p = state.month.posts[i];
    $('pCount').textContent = (i + 1) + ' of ' + state.month.posts.length;
    $('pPrev').disabled = i === 0; $('pNext').disabled = i === state.month.posts.length - 1;
    $('pWhen').textContent = fmtLong(p);
    $('pTitle').textContent = p.title;
    $('pTags').innerHTML = '<span class="tag type">' + TYPE_LABEL[p.type] + (p.type === 'carousel' ? ' \u00b7 ' + p.images.length + ' slides' : '') + '</span>' +
      (p.platforms || []).map(function (x) { return '<span class="tag">' + (ICON[x] || '') + esc(PLATFORM[x] || x) + '</span>'; }).join('');
    $('pCaption').textContent = p.caption || '';
    $('pHashtags').textContent = p.hashtags || '';
    var flags = [];
    if (p.confirm) flags.push(p.confirm);
    $('pFlag').hidden = !flags.length; $('pFlag').textContent = flags.join(' ');
    renderMedia(p);
    var clip = $('pClip');
    if (p.type === 'clip' && p.youtube) {
      var y = p.youtube;
      clip.hidden = false;
      clip.innerHTML = '<b>Clip ' + hms(y.start) + ' \u2013 ' + hms(y.end) + '</b> (' + Math.round(y.end - y.start) + 's) from \u201c' + esc(p.sermon || 'Sunday sermon') + '\u201d' + (p.sermonDate ? ', ' + fmtShort(p.sermonDate) : '') + '.<br>' +
        (p.clipNote ? esc(p.clipNote) + '<br>' : '') +
        (p.timestampConfirmed === false ? '<span class="warn">Timestamp to confirm.</span> ' : '') +
        '<a href="' + esc(y.url) + '" target="_blank" rel="noopener">Open on YouTube \u2197</a>';
    } else clip.hidden = true;
    var d = decision(p.id);
    $('pNote').value = d && d.n ? d.n : '';
    renderDecided(d);
    show('postSheet');
    $('pBody').scrollTop = 0;
  }

  function renderDecided(d) {
    var el = $('pDecided');
    el.className = 'decided';
    if (!d) { el.textContent = 'Not reviewed yet'; return; }
    if (d.s === 'approved') { el.classList.add('ok'); el.textContent = '\u2713 Approved' + (d.n ? ' with a note' : ''); }
    else { el.classList.add('chg'); el.textContent = 'Marked: needs change'; }
  }

  function renderMedia(p) {
    var box = $('pMedia');
    if (p.type === 'clip' && p.youtube) {
      var y = p.youtube;
      var poster = y.thumbnail || (p.images && p.images[0]);
      box.innerHTML = '<div class="video"><img class="poster" src="' + esc(poster) + '" alt=""><button class="bigplay" aria-label="Play clip">' + ICON.play.replace('viewBox', 'width="22" height="22" viewBox') + '</button></div>' +
        (p.images && p.images[0] ? '<div class="clipcover"><img src="' + esc(p.images[0]) + '" alt="Cover image">Cover image for TikTok/Facebook. The video plays the clip range from the sermon.</div>' : '');
      box.querySelector('.bigplay').addEventListener('click', function () {
        var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(y.id) + '?start=' + Math.floor(y.start) + '&end=' + Math.ceil(y.end) + '&autoplay=1&playsinline=1&rel=0&modestbranding=1';
        box.querySelector('.video').innerHTML = '<iframe src="' + src + '" title="Sermon clip" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
      });
    } else if (p.type === 'carousel' && p.images.length > 1) {
      box.innerHTML = '<div class="carousel" id="car">' + p.images.map(function (src, k) { return '<img src="' + esc(src) + '" alt="Slide ' + (k + 1) + '" ' + (k ? 'loading="lazy"' : '') + '>'; }).join('') + '</div>' +
        '<span class="slidecount" id="carCount">1/' + p.images.length + '</span>' +
        '<button class="cnav l" aria-label="Previous slide">' + ICON.chevL + '</button><button class="cnav r" aria-label="Next slide">' + ICON.chevR + '</button>' +
        '<div class="dots">' + p.images.map(function (_, k) { return '<i' + (k ? '' : ' class="on"') + '></i>'; }).join('') + '</div>';
      var car = $('car'), dots = box.querySelectorAll('.dots i');
      var idx = function () { return Math.round(car.scrollLeft / car.clientWidth); };
      car.addEventListener('scroll', function () {
        var k = idx(); dots.forEach(function (d, j) { d.classList.toggle('on', j === k); });
        $('carCount').textContent = (k + 1) + '/' + p.images.length;
      }, { passive: true });
      box.querySelector('.cnav.l').addEventListener('click', function () { car.scrollTo({ left: (idx() - 1) * car.clientWidth, behavior: 'smooth' }); });
      box.querySelector('.cnav.r').addEventListener('click', function () { car.scrollTo({ left: (idx() + 1) * car.clientWidth, behavior: 'smooth' }); });
    } else {
      box.innerHTML = '<img class="single" src="' + esc(p.images[0]) + '" alt="' + esc(p.title) + '">';
    }
  }

  function decide(kind) {
    var p = state.month.posts[state.current];
    var note = $('pNote').value.trim();
    if (kind === 'change' && !note) { toast('Add a note so Hark knows what to change'); $('pNote').focus(); return; }
    state.store.d[p.id] = { s: kind, n: note, t: Date.now() };
    saveStore(); renderGrid(); renderStatus(); renderDecided(state.store.d[p.id]);
    toast(kind === 'approved' ? 'Approved' : 'Change noted');
    if (state.current < state.month.posts.length - 1) setTimeout(function () { openPost(state.current + 1); }, 380);
    else setTimeout(function () { hide('postSheet'); }, 380);
  }

  /* ---------- approve all / send ---------- */
  function primary() {
    var k = counts();
    if (k.decided < k.total) {
      state.month.posts.forEach(function (p) { if (!decision(p.id)) state.store.d[p.id] = { s: 'approved', n: '', t: Date.now() }; });
      saveStore(); renderGrid(); renderStatus();
      toast('All ' + k.total + ' posts approved');
      setTimeout(openSend, 450);
    } else openSend();
  }

  function subject() { return 'FAC Social Calendar approval - ' + monthLabel(state.key); }
  /* One short line per post. Notes are flattened and capped so the mailto stays small. */
  function lineFor(p) {
    var d = decision(p.id), n = d && d.n ? d.n.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    if (!d) return p.id + ' PENDING';
    if (d.s === 'approved') return p.id + ' APPROVED' + (n ? ' (note: ' + n + ')' : '');
    return p.id + ' CHANGE: ' + n;
  }
  var MAILTO_MAX = 1800; // iOS Mail truncates long mailto links; stay under this
  function mailtoFor(b) { return 'mailto:' + APPROVAL_EMAIL + '?subject=' + encodeURIComponent(subject()) + '&body=' + encodeURIComponent(b); }
  function body() {
    var k = counts(), posts = state.month.posts;
    var head = [subject(), ''];
    var foot = ['', k.approved + ' approved, ' + k.change + ' changes, ' + (k.total - k.decided) + ' pending (' + k.total + ' posts).', 'Sent from ' + APP_URL + '?m=' + state.key];
    var full = head.concat(posts.map(lineFor), foot).join('\n');
    if (mailtoFor(full).length <= MAILTO_MAX) return full;
    /* compact format */
    var plain = function (p) { var d = decision(p.id); return d && d.s === 'approved' && !d.n; };
    var others = posts.filter(function (p) { return !plain(p); });
    var lines = others.length ? others.map(lineFor).concat(['All others APPROVED (' + (k.total - others.length) + ' of ' + k.total + ')'])
                              : ['APPROVED ALL (' + k.total + ' posts, ' + posts[0].id + '-' + posts[posts.length - 1].id + ')'];
    return head.concat(['Format: compact'], lines, foot).join('\n');
  }
  function openSend() {
    var k = counts(), b = body(), len = mailtoFor(b).length;
    $('sSummary').textContent = k.approved + ' approved \u00b7 ' + k.change + ' need changes' + (k.total - k.decided ? ' \u00b7 ' + (k.total - k.decided) + ' not reviewed' : '') + '. This goes to Hark at ' + APPROVAL_EMAIL + '.';
    $('sPreview').textContent = 'To: ' + APPROVAL_EMAIL + '\nSubject: ' + subject() + '\n\n' + b;
    $('sLong').hidden = len <= MAILTO_MAX;
    show('sendSheet');
  }
  function send() {
    var url = mailtoFor(body());
    state.store.sentAt = Date.now(); saveStore(); renderStatus();
    hide('sendSheet');
    window.location.href = url;
    toast('Opening your email app\u2026');
  }
  function copyApproval() {
    var txt = body();
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Approval text copied'); }, function () { prompt('Copy this text', txt); });
    else prompt('Copy this text', txt);
  }

  /* ---------- months / info / share ---------- */
  function openMonths() {
    var ms = (state.index && state.index.months) || [];
    $('monthList').innerHTML = ms.slice().reverse().map(function (m) {
      var st = null; try { st = JSON.parse(localStorage.getItem('fac-cal:' + m.month) || 'null'); } catch (e) { }
      var reviewed = st && st.d ? Object.keys(st.d).length : 0;
      var meta = (m.posts || '?') + ' posts \u00b7 ' + (st && st.sentAt ? 'sent' : reviewed ? reviewed + ' reviewed' : (m.status === 'ready' ? 'ready for approval' : (m.status || '')));
      return '<li class="' + (m.month === state.key ? 'cur' : '') + '"><button data-m="' + esc(m.month) + '"><span><span class="mname">' + esc(m.label || monthLabel(m.month)) + '</span><br><span class="mmeta">' + esc(meta) + '</span></span>' + ICON.chevR.replace('viewBox', 'width="9" height="15" style="color:#c7c7cc" viewBox') + '</button></li>';
    }).join('') || '<li><p class="empty">No calendars yet.</p></li>';
    show('monthSheet');
  }
  function openInfo() {
    var m = state.month;
    var fb = (m.notes || []).filter(function (n) { return /facebook/i.test(n); });
    var other = (m.notes || []).filter(function (n) { return !/facebook/i.test(n); });
    $('infoBody').innerHTML = (fb.length ? '<div class="fb"><b>Facebook: waiting on page access.</b><br>' + esc(fb[0].replace(/^Facebook:\s*waiting on page access\.?\s*/i, '')) + '</div>' : '') +
      '<p><b>How approval works</b></p><ul>' +
      '<li>Tap a post to preview it, read the caption, and approve it or leave a note.</li>' +
      '<li><b>Approve all</b> approves everything you haven\u2019t marked yet. Your notes stay.</li>' +
      '<li><b>Send approval</b> opens an email to Hark with every post\u2019s status. Nothing is posted until Hark gets it.</li>' +
      '<li>Your choices are saved on this device until you send.</li></ul>' +
      (other.length ? '<ul>' + other.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="mmeta" style="color:#6b6b73;font-size:13px">Prepared by ' + esc(m.preparedBy || 'Hark') + (m.updated ? ' \u00b7 updated ' + esc(m.updated) : '') + '</p>' +
      '<button class="reset" id="btnReset">Clear my choices for ' + esc(monthLabel(state.key)) + '</button>';
    $('btnReset').addEventListener('click', function () {
      if (!confirm('Clear all approvals and notes for ' + monthLabel(state.key) + ' on this device?')) return;
      state.store = { d: {} }; saveStore(); renderGrid(); renderStatus(); hide('infoSheet'); toast('Choices cleared');
    });
    show('infoSheet');
  }
  function share() {
    var data = { title: 'FAC Social Calendar', text: 'First Alliance Church social calendar for ' + monthLabel(state.key), url: APP_URL };
    if (navigator.share) { navigator.share(data).catch(function () { }); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(APP_URL).then(function () { toast('Link copied'); }, function () { prompt('Copy this link', APP_URL); });
    else prompt('Copy this link', APP_URL);
  }

  /* ---------- sheets ---------- */
  var lastFocus = null;
  function show(id) { var el = $(id); if (el.hidden) lastFocus = document.activeElement; el.hidden = false; document.body.style.overflow = 'hidden'; var f = el.querySelector('[data-close].link'); if (f) f.focus({ preventScroll: true }); }
  function hide(id) {
    var el = $(id); el.hidden = true;
    if (id === 'postSheet') $('pMedia').innerHTML = '';
    if (!document.querySelector('.sheet-wrap:not([hidden])')) { document.body.style.overflow = ''; if (lastFocus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { } }
  }
  document.querySelectorAll('.sheet-wrap').forEach(function (w) {
    w.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) hide(w.id); });
  });
  document.addEventListener('keydown', function (e) {
    var open = document.querySelector('.sheet-wrap:not([hidden])'); if (!open) return;
    if (e.key === 'Escape') hide(open.id);
    if (open.id === 'postSheet' && document.activeElement !== $('pNote')) {
      if (e.key === 'ArrowRight' && state.current < state.month.posts.length - 1) openPost(state.current + 1);
      if (e.key === 'ArrowLeft' && state.current > 0) openPost(state.current - 1);
    }
  });

  /* ---------- events ---------- */
  $('grid').addEventListener('click', function (e) { var t = e.target.closest('.tile'); if (t) openPost(+t.dataset.i); });
  $('chips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    state.filter = state.filter === c.dataset.type ? null : c.dataset.type; renderGrid(); renderChips();
  });
  $('btnPrimary').addEventListener('click', primary);
  $('pApprove').addEventListener('click', function () { decide('approved'); });
  $('pChange').addEventListener('click', function () { decide('change'); });
  $('pPrev').addEventListener('click', function () { if (state.current > 0) openPost(state.current - 1); });
  $('pNext').addEventListener('click', function () { if (state.current < state.month.posts.length - 1) openPost(state.current + 1); });
  $('pCopy').addEventListener('click', function () {
    var p = state.month.posts[state.current]; var txt = (p.caption || '') + '\n\n' + (p.hashtags || '');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Caption copied'); }, function () { toast('Copy not available'); });
  });
  $('sSend').addEventListener('click', send);
  $('sCopy').addEventListener('click', copyApproval);
  $('btnMonths').addEventListener('click', openMonths);
  $('monthList').addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; hide('monthSheet'); openMonth(b.dataset.m); });
  $('btnInfo').addEventListener('click', openInfo);
  $('btnShare').addEventListener('click', share);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
  init();
})();
