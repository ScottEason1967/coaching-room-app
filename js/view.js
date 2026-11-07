// The page players and staff open from a link. Needs the PIN; shows only the snapshot Joe shared.
import cfg from './config.js';
import { esc, nl2br, fmtD, fmtAgo } from './util.js';
import { frameSvg, drillSvg } from './pitch.js';

const vp = document.getElementById('vp');
const tok = location.hash.replace(/^#/, '').trim();
const KEY = 'cr.pin.' + tok;
let sb = null, pin = null, data = null;

function shell(inner) { vp.innerHTML = inner; }
function brand() {
  return `<div class="row nowrap" style="gap:10px;margin-bottom:18px"><svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true"><g fill="none" stroke-width="3.2" stroke-linecap="round">${[0, 1, 2, 3].map(i => `<circle cx="13" cy="13" r="9.5" stroke="${i === 1 ? '#3D7BFF' : i === 0 ? 'rgba(61,123,255,.5)' : 'rgba(255,255,255,.18)'}" stroke-dasharray="12.5 47.2" transform="rotate(${-86 + i * 90} 13 13)"/>`).join('')}</g></svg><span class="display" style="font-size:18px;letter-spacing:.06em">The Coaching Room</span></div>`;
}

function pinScreen(msg = '') {
  shell(`${brand()}<div class="card stack" style="max-width:420px;margin:40px auto 0;text-align:center;padding:24px">
    <div class="h2">Enter your PIN</div><p class="small muted" style="margin:0">Your coach gave you a PIN with this link.</p>
    <form id="pf" class="stack" autocomplete="off">
      <div class="pinbox">${[0, 1, 2, 3].map(i => `<input type="tel" inputmode="numeric" autocomplete="one-time-code" aria-label="PIN digit ${i + 1}" data-i="${i}" ${i ? '' : 'autofocus'}>`).join('')}</div>
      <label class="check" style="justify-content:center"><input type="checkbox" id="rem" checked> Remember on this phone</label>
      <button class="btn pri block" type="submit">Open</button>
      <div class="small" id="pm" role="status" style="color:var(--lamp);min-height:20px">${esc(msg)}</div>
    </form></div>`);
  const ins = [...vp.querySelectorAll('.pinbox input')];
  ins.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const v = inp.value.replace(/\D/g, '');
      if (v.length > 1) { v.split('').slice(0, 4 - i).forEach((d, k) => ins[i + k].value = d); ins[Math.min(3, i + v.length - 1)].focus(); }
      else { inp.value = v; if (v && i < 3) ins[i + 1].focus(); }
      if (ins.every(x => x.value)) vp.querySelector('#pf').requestSubmit();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && i) ins[i - 1].focus(); });
  });
  vp.querySelector('#pf').onsubmit = e => { e.preventDefault(); const p = ins.map(x => x.value).join(''); if (p.length === 4) open(p, vp.querySelector('#rem').checked); };
  setTimeout(() => ins[0].focus(), 50);
}

async function open(p, remember) {
  const m = vp.querySelector('#pm'); if (m) m.textContent = 'Checking…';
  try {
    const { data: r, error } = await sb.rpc('open_share', { p_token: tok, p_pin: p });
    if (error) throw error;
    if (!r.ok) {
      try { localStorage.removeItem(KEY); } catch (e) {}
      if (r.reason === 'gone') return shell(`${brand()}<div class="card" style="text-align:center">This link has been turned off or deleted. Ask your coach for a new one.</div>`);
      if (r.reason === 'locked') return pinScreen('Too many wrong PINs. Try again in 15 minutes.');
      return pinScreen(`That PIN didn’t work. ${r.left} tr${r.left === 1 ? 'y' : 'ies'} left before the link locks for 15 minutes.`);
    }
    pin = p; data = r;
    try { if (remember) localStorage.setItem(KEY, p); } catch (e) {}
    render();
  } catch (e) {
    pinScreen(navigator.onLine ? 'Couldn’t reach the server. Try again.' : 'You’re offline. Connect and try again.');
  }
}

const board = (b, pm) => `<div class="card stack"><div class="row between"><div class="h2">${esc(b.name)}</div><span class="tiny muted">${b.frames.length} frame${b.frames.length === 1 ? '' : 's'}</span></div>
  ${b.frames.map((f, i) => `<div class="stack tight"><div class="h3">${i + 1}. ${esc(f.name || '')}</div>${frameSvg(f, pm, { style: 'width:100%;height:auto;border-radius:14px;max-height:80vh' })}${f.notes ? `<div class="small" style="color:var(--text2)">${nl2br(f.notes)}</div>` : ''}</div>`).join('')}</div>`;
const list = (title, arr) => arr && arr.length ? `<div class="card stack tight"><div class="h3">${title}</div><ul class="small" style="margin:0;padding-left:18px;color:var(--text2)">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
const row = (l, v) => v ? `<div class="stack tight" style="padding:8px 0;border-top:1px solid var(--line)"><div class="eyebrow">${l}</div><div class="small">${nl2br(v)}</div></div>` : '';

function render() {
  const d = data.data || {}; const team = d.team || {}; let h = brand();
  h += `<div class="eyebrow">${esc(team.name || '')}${team.season ? ' · ' + esc(team.season) : ''}</div>`;
  if (data.kind === 'player') {
    const p = d.player || {};
    h += `<div class="row nowrap" style="gap:16px;margin:8px 0 16px"><span class="display" style="font-size:72px;color:var(--accent);line-height:.9">${esc(p.num)}</span><div><div class="h1" style="font-size:36px">${esc(p.name)}</div><div class="small muted">${esc(p.pos || '')}</div></div></div><div class="stack">`;
    if (d.match) {
      h += `<div class="card stack tight"><div class="eyebrow">Next match</div><div class="h1" style="font-size:34px">v ${esc(d.match.opponent)}</div><div class="small muted">${fmtD(d.match.date)}${d.match.ko ? ' · ' + esc(d.match.ko) : ''}${d.match.venue ? ' · ' + esc(d.match.venue) : ''}</div>
        ${d.match.instruction ? `<div class="job stack tight" style="margin-top:8px"><div class="eyebrow" style="color:#8FB4FF">Your job</div><div style="font-size:16px">${nl2br(d.match.instruction)}</div></div>` : ''}
        ${d.match.keys && d.match.keys.length ? `<div class="eyebrow" style="margin-top:8px">What wins us the game</div><ol class="small" style="margin:0;padding-left:20px">${d.match.keys.map(k => `<li>${esc(k)}</li>`).join('')}</ol>` : ''}</div>`;
    }
    if ((d.goals || []).length) h += `<div class="card stack tight"><div class="h3">Your development goals</div>${d.goals.map(g => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="row between nowrap"><span style="font-weight:600">${esc(g.text)}</span><span class="pill ${g.status === 'Achieved' ? 'good' : ''}">${esc(g.status)}</span></div>${g.how ? `<div class="small muted">${nl2br(g.how)}</div>` : ''}</div>`).join('')}</div>`;
    (d.boards || []).forEach(b => h += board(b, d.players));
    if ((d.principles || []).length) h += `<div class="card stack tight"><div class="h3">How we play</div>${d.principles.map(x => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="eyebrow">${esc(x.phase)}</div><div style="font-weight:600">${esc(x.title)}</div>${x.why ? `<div class="small muted">${esc(x.why)}</div>` : ''}${x.subs.length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${x.subs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>`;
    h += '</div>';
  } else if (data.kind === 'session') {
    const s = d.session || {};
    h += `<div class="h1" style="margin:6px 0 4px">${esc(s.theme || 'Session plan')}</div><div class="small muted">${fmtD(s.date)}${s.time ? ' · ' + esc(s.time) : ''}${s.venue ? ' · ' + esc(s.venue) : ''} · ${s.total || 0} min</div><div class="stack" style="margin-top:14px">
      ${list('Principles', s.principles)}${s.lookFor ? `<div class="card small">${row('Looking for', s.lookFor)}</div>` : ''}${s.staff ? `<div class="card small">${nl2br(s.staff)}</div>` : ''}${list('Kit', s.kit)}${s.notes ? `<div class="card small">${nl2br(s.notes)}</div>` : ''}
      ${(s.blocks || []).map((b, i) => b.drill ? `<div class="card stack tight"><div class="row between nowrap"><div class="h2">${i + 1}. ${esc(b.drill.name)}</div><span class="pill grey">${esc(b.minutes || 0)} min</span></div><div class="tiny muted">${esc(b.drill.type || '')}${b.note ? ' · ' + esc(b.note) : ''}</div>
        ${drillSvg(b.drill, { style: 'width:100%;height:auto;max-height:60vh;border-radius:14px' })}${row('Objective', b.drill.objective)}${row('Organisation', b.drill.org)}${row('How it works', b.drill.how)}${row('Transition', b.drill.transition)}${row('Coaching points', b.drill.points)}${row('Success looks like', b.drill.success)}${row('Questions', b.drill.questions)}${row('Progress', b.drill.prog)}${row('Regress', b.drill.reg)}</div>` : '').join('')}</div>`;
  } else if (data.kind === 'match') {
    const m = d.match || {}; const p = m.plan || {}; const o = m.opp || {};
    h += `<div class="h1" style="margin:6px 0 4px">v ${esc(m.opponent)}</div><div class="small muted">${fmtD(m.date)}${m.ko ? ' · ' + esc(m.ko) : ''}${m.venue ? ' · ' + esc(m.venue) : ''}${m.comp ? ' · ' + esc(m.comp) : ''}</div><div class="stack" style="margin-top:14px">
      ${(p.keys || []).length ? `<div class="card stack tight" style="border-color:var(--accent-line)"><div class="h3">What wins us the game</div><ol class="small" style="margin:0;padding-left:20px">${p.keys.map(k => `<li>${esc(k)}</li>`).join('')}</ol></div>` : ''}
      <div class="card">${row('Their threat and our answer', p.threat)}${row('First ten minutes', p.first)}${row('Plan B', p.planB)}${row('Substitutions', p.subs)}${row('Our plan in possession', p.ip)}${row('Our plan out of possession', p.op)}${row('Our set pieces', p.sp)}${row('Their set pieces', p.spAgainst)}${row('Selection', p.selection)}${row('Team talk', p.talk)}</div>
      <div class="card"><div class="h3">How they play</div>${row('In possession', o.ip)}${row('Out of possession', o.op)}${row('When they win it', o.ta)}${row('When they lose it', o.td)}${row('Set pieces', o.sp)}${row('Key individuals', o.people)}</div>
      ${(m.squad || []).length ? `<div class="card"><div class="h3">Individual instructions</div>${m.squad.map(s => row(esc(s.num) + ' · ' + esc(s.name), s.instruction || '—')).join('')}</div>` : ''}
      ${(d.boards || []).map(b => board(b, d.players)).join('')}</div>`;
  } else if (data.kind === 'board') {
    h += `<div class="stack" style="margin-top:10px">${board(d.board || { name: '', frames: [] }, d.players)}</div>`;
  }
  if (data.kind !== 'player') {
    const cs = data.comments || [];
    h += `<div class="card stack tight" id="vpComments" style="margin-top:14px"><div class="h3">Comments for Joe</div>
      ${cs.map(c => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><b>${esc(c.name)}</b> <span class="tiny muted">${fmtAgo(c.at)}</span><br>${esc(c.text)}</div>`).join('')}
      <form id="cf" class="stack tight"><input type="text" id="cn" placeholder="Your name" maxlength="40"><textarea id="ct" placeholder="Question or suggestion" maxlength="1000" style="min-height:70px"></textarea><button class="btn" type="submit">Send comment</button></form></div>`;
  }
  h += `<div class="row noprint" style="margin-top:16px"><span class="tiny muted grow">Updated ${fmtAgo(data.updated_at)}</span><button class="btn sm" id="rf">Refresh</button>${data.kind !== 'player' ? '<button class="btn sm" id="pr">Print</button>' : ''}<button class="btn sm" id="lo">Lock</button></div>`;
  shell(h);
  vp.querySelector('#rf').onclick = () => open(pin, true);
  vp.querySelector('#pr')?.addEventListener('click', () => window.print());
  vp.querySelector('#lo').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} pin = null; data = null; pinScreen(); };
  const cf = vp.querySelector('#cf');
  if (cf) cf.onsubmit = async e => {
    e.preventDefault(); const text = vp.querySelector('#ct').value.trim(); if (!text) return;
    const name = vp.querySelector('#cn').value.trim(); try { localStorage.setItem('cr.name', name); } catch (er) {}
    const { data: r, error } = await sb.rpc('add_share_comment', { p_token: tok, p_pin: pin, p_name: name, p_text: text });
    if (error || !r.ok) { alert('Could not send the comment. Try again.'); return; }
    data.comments = r.comments; render();
  };
  const cn = vp.querySelector('#cn'); if (cn) { try { cn.value = localStorage.getItem('cr.name') || ''; } catch (e) {} }
}

function boot() {
  if (!tok || tok.length < 20) return shell(`${brand()}<div class="card" style="text-align:center">This link is incomplete. Ask your coach to send it again.</div>`);
  if (!cfg.url || !cfg.anonKey || !window.supabase) return shell(`${brand()}<div class="card" style="text-align:center">Links aren’t switched on for this app yet.</div>`);
  sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) open(saved, true); else pinScreen();
}
window.addEventListener('hashchange', () => location.reload());
boot();
