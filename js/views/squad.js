// Squad and player profiles: development goals, observations, player links.
import * as S from '../store.js';
import { GOAL_STATUS } from '../store.js';
import { esc, icon, uid, today, fmtD, bindFields, actions, debounce, confirmSheet, sheet, closeSheet, toast, avatar } from '../util.js';
import { shareSheet, refreshPlayers } from './sharing.js';
import * as cloud from '../cloud.js';

const POS = ['GK', 'RB', 'CB', 'LB', 'FB', '6', '8', 'CM', '10', 'RW', 'LW', 'W', 'CF'];
// Every position comes from this one list, so the squad stays consistent.
export const posOptions = cur => `<option value="" ${cur ? '' : 'selected'}>Position…</option>` + POS.concat(cur && !POS.includes(cur) ? [cur] : []).map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
// Positions typed in a pasted list are mapped onto the same list; anything else is ignored.
const POS_MAP = { ST: 'CF', 9: 'CF', DM: '6', AM: '10', RWB: 'RB', LWB: 'LB', RM: 'RW', LM: 'LW' };
const toPos = x => { const u = String(x || '').toUpperCase(); return POS.includes(u) ? u : (POS_MAP[u] || ''); };

export default function squad(el, params, ctx) {
  const t = S.team(); const T = t.id; ctx.setTop({});
  const ps = S.players(T); const opt = t.playerShare || { principles: true, keys: true, setpieces: true };
  const links = ps.filter(p => p.share && p.share.token).length;
  el.innerHTML = `<div class="split wide-right"><div class="stack">
    <div class="row between"><div><div class="h1">Squad</div><div class="small muted" style="margin-top:4px">${ps.length} players · ${esc(t.name)}</div></div>
      <div class="row" style="gap:8px"><button class="btn" data-act="import">Paste a list</button><button class="btn pri" data-act="add">${icon('plus')}Add player</button></div></div>
    ${ps.length ? `<div class="list" id="squadList">${ps.map(p => { const g = (p.goals || []).filter(x => x.status === 'on').length;
      return `<div class="item" style="cursor:default"><a class="row nowrap grow" style="gap:12px;color:inherit;text-decoration:none;min-width:0" href="#/player/${p.id}">${avatar(S.photoOf(p.id), 40, `<span class="badge-num" style="${p.pos === 'GK' ? 'background:#2FB67A' : ''}">${esc(p.num)}</span>`)}<span class="grow" style="min-width:0"><span class="t" style="display:block">${S.photoOf(p.id) ? `<span class="muted">${esc(p.num)}</span> ` : ''}${esc(p.name)}</span><span class="s">${p.capt ? `<b style="color:var(--text)">${p.capt === 'c' ? 'Captain' : 'Vice-captain'}</b> · ` : ''}${g ? `${g} goal${g > 1 ? 's' : ''} on the go` : 'No development goal'}</span></span>${p.share && p.share.token ? `<span class="pill ${p.share.enabled === false ? 'grey' : 'good'}">${icon('link', 'style="width:12px;height:12px"')}Link</span>` : ''}</a>
        <select data-pos="${p.id}" aria-label="Position for ${esc(p.name)}" style="width:auto;min-width:96px;flex:none">${posOptions(p.pos)}</select>
        <span class="capts">${['c', 'vc'].map(v => `<button type="button" class="capt ${p.capt === v ? 'on' : ''}" data-capt="${p.id}" data-v="${v}" aria-pressed="${p.capt === v}" aria-label="${v === 'c' ? 'Captain' : 'Vice-captain'}: ${esc(p.name)}" title="${v === 'c' ? 'Captain' : 'Vice-captain'}">${v.toUpperCase()}</button>`).join('')}</span></div>`; }).join('')}</div>` : '<div class="empty">No players yet.</div>'}
  </div>
  <div class="stack">
    <div class="card stack tight"><div class="h3">Player pages</div>
      <p class="small muted" style="margin:0">Each player can have a private link and PIN to her own page. Choose what goes on every page:</p>
      <label class="check"><input type="checkbox" data-o="principles" ${opt.principles ? 'checked' : ''}> Agreed principles of play</label>
      <label class="check"><input type="checkbox" data-o="keys" ${opt.keys ? 'checked' : ''}> Keys to winning for the next match</label>
      <label class="check"><input type="checkbox" data-o="setpieces" ${opt.setpieces ? 'checked' : ''}> Boards marked “show on player pages”</label>
      <p class="tiny muted" style="margin:0">Always on: her number, development goals and her own match instruction. Never: your private notes or anyone else’s profile.</p>
      <button class="btn" data-act="pushAll" ${links ? '' : 'disabled'}>${icon('rotate')}Update all ${links} player page${links === 1 ? '' : 's'}</button>
      <p class="tiny muted" style="margin:0">If any players are under 18, check your club’s safeguarding policy before sending links (for example, send through a parent).</p>
    </div>
  </div></div>`;
  el.querySelectorAll('[data-pos]').forEach(sel => sel.onchange = () => { const p = S.get(sel.dataset.pos); if (!p) return; p.pos = sel.value; S.put(p); toast(p.name + ': ' + (sel.value || 'position not set')); });
  el.querySelectorAll('[data-capt]').forEach(b => b.onclick = () => { const p = S.get(b.dataset.capt); if (!p) return; setCapt(T, p, p.capt === b.dataset.v ? '' : b.dataset.v); ctx.refresh(); });
  el.querySelectorAll('[data-o]').forEach(c => c.onchange = () => { t.playerShare = { ...opt, ...(t.playerShare || {}), [c.dataset.o]: c.checked }; S.put(t); });
  actions(el, {
    add: () => addSheet(T),
    import: () => importSheet(T, ctx),
    pushAll: async () => {
      if (!cloud.signedIn()) return toast('Sign in to cloud sync first (your profile picture > Cloud sync)');
      try { const n = await refreshPlayers(T); toast(`Updated ${n} player page${n === 1 ? '' : 's'}`); } catch (e) { toast(e.message || 'Could not update'); }
    }
  });
}

function addSheet(T) {
  const used = new Set(S.players(T).map(p => +p.num)); let n = 1; while (used.has(n)) n++;
  const el = sheet(`<div class="stack"><div class="h2">Add player</div>
    <div class="row nowrap"><label class="field" style="width:90px"><span>Number</span><input type="number" inputmode="numeric" id="apN" value="${n}"></label><label class="field grow"><span>Name</span><input type="text" id="apM" autofocus></label></div>
    <label class="field"><span>Position</span><select id="apP">${posOptions('')}</select></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="apX">Cancel</button><button class="btn pri" id="apS">Add</button></div></div>`);
  el.querySelector('#apX').onclick = closeSheet;
  el.querySelector('#apS').onclick = () => {
    const name = el.querySelector('#apM').value.trim(); if (!name) return toast('Add a name');
    const p = S.create('player', T, { num: +el.querySelector('#apN').value || '', name, short: '', pos: el.querySelector('#apP').value, pos2: '', foot: '', notes: '', goals: [], obs: [] });
    closeSheet(); location.hash = '#/player/' + p.id;
  };
}

const isExample = p => /^Player \d+$/.test(p.name || '');
// One captain and one vice-captain per team: giving the armband to one player takes it from the other.
export function setCapt(T, p, v) {
  if (v) S.players(T).forEach(o => { if (o.id !== p.id && o.capt === v) { o.capt = ''; S.put(o); } });
  p.capt = v || ''; S.put(p);
  toast(v ? `${p.name} is ${v === 'c' ? 'captain' : 'vice-captain'}` : `${p.name}: no armband`);
}
const POS_RE = 'GK|RB|CB|LB|FB|RWB|LWB|DM|CM|AM|6|8|10|RM|LM|RW|LW|W|CF|ST|9';

// Reads a pasted squad. Copes with one player per line, and with a list whose line
// breaks were lost on the way in ("1 Jane Smith 2 Amy Jones ..."): a number followed by
// a name always starts a new player, so squad numbers are never folded into a name.
export function parseSquad(text) {
  const out = [];
  String(text || '').replace(/\r/g, '').split('\n').forEach(line => {
    line.trim().split(/\s+(?=\d{1,3}[\s.,:-]+[A-Za-z\u00C0-\u024F])/).forEach(chunk => {
      const m = chunk.trim().match(new RegExp('^(\\d{1,3})[\\s.,:-]+(.+?)(?:[\\s,]+(' + POS_RE + '))?$', 'i'));
      if (!m) return;
      const mk = m[2].match(/\s*\((c|capt?|captain|vc|v\.c\.|vice[- ]?capt(?:ain)?)\)\s*$/i);
      const name = m[2].replace(/\s*\((c|capt?|captain|vc|v\.c\.|vice[- ]?capt(?:ain)?)\)\s*$/i, '').trim();
      if (!name || /\d/.test(name)) return;
      out.push({ num: +m[1], name, pos: toPos(m[3]), capt: mk ? (/^v/i.test(mk[1]) ? 'vc' : 'c') : '' });
    });
  });
  return out;
}

function importSheet(T, ctx) {
  const el = sheet(`<div class="stack"><div class="h2">Paste a squad list</div>
    <p class="small muted" style="margin:0">Number, name, and position if you know it. One player per line is best, for example:<br><code>7 Jane Smith RW</code><br>Put (c) after the captain’s name and (vc) after the vice-captain’s. Each player keeps her squad number. Positions are picked from the dropdown on the squad list, so leave them out if you’re not sure.</p>
    <textarea id="imT" style="min-height:200px" placeholder="1 Name Surname GK"></textarea>
    <div class="tiny muted" id="imP">Nothing pasted yet.</div>
    <label class="check"><input type="checkbox" id="imR" checked> Replace the whole squad with this list (anyone not on it is removed)</label>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="imX">Cancel</button><button class="btn pri" id="imS">Import</button></div></div>`);
  const ta = el.querySelector('#imT'), prev = el.querySelector('#imP');
  ta.oninput = () => { const r = parseSquad(ta.value); prev.textContent = r.length ? `${r.length} player${r.length === 1 ? '' : 's'} found: ` + r.map(x => x.num + ' ' + x.name).join(', ') : 'No players found yet.'; };
  el.querySelector('#imX').onclick = closeSheet;
  el.querySelector('#imS').onclick = async () => {
    const rows = parseSquad(ta.value);
    if (!rows.length) return toast('No players found. Put a number then a name, for example 7 Jane Smith');
    const nums = new Set(rows.map(r => r.num));
    if (nums.size < rows.length) return toast('The same squad number appears twice. Check the list.');
    const replace = el.querySelector('#imR').checked;
    const existing = S.players(T);
    const going = replace ? existing.filter(p => !nums.has(+p.num)) : [];
    closeSheet();
    if (going.some(p => !isExample(p)) && !await confirmSheet(`Remove ${going.length} player${going.length === 1 ? '' : 's'}?`,
      'Not on your list: ' + going.map(p => (p.num || '?') + ' ' + p.name).join(', ') + '. They come off boards and match squads, and their player links are deleted.', 'Import and remove')) return;
    let add = 0, upd = 0;
    rows.forEach(r => {
      const cur = existing.find(p => +p.num === r.num);
      if (cur) { const wasExample = isExample(cur); cur.name = r.name; if (r.pos) cur.pos = r.pos; else if (wasExample) { cur.pos = ''; cur.pos2 = ''; } S.put(cur); upd++; }
      else { S.create('player', T, { num: r.num, name: r.name, short: '', pos: r.pos, pos2: '', foot: '', notes: '', goals: [], obs: [] }); add++; }
    });
    for (const p of going) {
      if (p.share && p.share.token) { try { await cloud.deleteShare(p.share.token); } catch (e) { /* link stays off-line; removed with the player */ } }
      S.del(p.id);
    }
    rows.filter(r => r.capt).forEach(r => { const pl = S.players(T).find(x => +x.num === r.num); if (pl) setCapt(T, pl, r.capt); });
    toast(`${add} added, ${upd} updated${going.length ? `, ${going.length} removed` : ''}`); ctx.refresh();
  };
}

export function playerView(el, [id], ctx) {
  const p = S.get(id);
  if (!p) { ctx.setTop({ back: '#/squad', title: 'Player' }); el.innerHTML = '<div class="empty">This player has been removed.</div>'; return; }
  const T = p.team; p.goals ||= [];
  ctx.setTop({ back: '#/squad', title: p.name, sub: '#' + p.num + ' · ' + (p.pos || 'Position not set') });
  const save = debounce(() => S.put(p), 400);
  const obs = S.reviews(T).filter(r => (r.playerObs || {})[p.id] && r.playerObs[p.id].trim()).map(r => ({ date: r.date, text: r.playerObs[p.id], r }));
  const nm = S.nextMatch(T); const ins = nm ? (nm.instructions || {})[p.id] : '';

  el.innerHTML = `<div class="split wide-right"><div class="stack">
    <div class="card stack tight"><div class="row nowrap" style="gap:16px">${avatar(S.photoOf(p.id), 72)}<span class="display" style="font-size:64px;color:var(--accent);min-width:64px;text-align:center">${esc(p.num)}</span><div class="grow" style="min-width:0"><div class="h1" style="font-size:32px">${esc(p.name)}</div><div class="small muted">${p.pos ? esc(p.pos) : 'Position not set'}${p.pos2 ? ' / ' + esc(p.pos2) : ''}${p.foot ? ' · ' + esc(p.foot) + ' foot' : ''}</div></div></div>
      <div class="row nowrap tiny muted" id="photoNote" style="gap:8px">${S.photoOf(p.id) ? `<span class="grow">She added this photo from her player page.</span><button class="btn sm" data-act="unphoto">Remove</button>` : `<span>Photo: players add their own from their player page, if they want to.${p.share && p.share.token ? '' : ' Create her link first.'}</span>`}</div></div>
    <div class="card stack tight">
      <div class="row nowrap"><label class="field" style="width:90px"><span>Number</span><input type="number" inputmode="numeric" data-f="num"></label><label class="field grow"><span>Name</span><input type="text" data-f="name"></label></div>
      <div class="grid2" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <label class="field"><span>Position</span><select data-f="pos">${posOptions(p.pos)}</select></label>
        <div class="field"><span>Armband</span><div class="row" style="gap:14px" id="armband"><label class="check"><input type="checkbox" data-cap="c" ${p.capt === 'c' ? 'checked' : ''}> Captain</label><label class="check"><input type="checkbox" data-cap="vc" ${p.capt === 'vc' ? 'checked' : ''}> Vice-captain</label></div></div>
        <label class="field"><span>Also plays</span><select data-f="pos2"><option value="">—</option>${POS.map(x => `<option ${x === p.pos2 ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field"><span>Name on the board</span><input type="text" data-f="short" maxlength="12" placeholder="Short name"></label>
        <label class="field"><span>Foot</span><select data-f="foot"><option value="">—</option>${['Right', 'Left', 'Both'].map(x => `<option ${x === p.foot ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="card stack"><div class="row between"><div class="h3">Development goals</div><button class="btn sm" data-act="goal">${icon('plus')}Add</button></div>
      <p class="tiny muted" style="margin:0">Agree them with her. She sees these on her player page (parked goals are hidden).</p>
      ${p.goals.length ? p.goals.map((g, i) => `<div class="card inset stack tight">
        <input type="text" data-f="goals.${i}.text" placeholder="What she’s working on">
        <textarea data-f="goals.${i}.how" style="min-height:56px" placeholder="How we’ll work on it together"></textarea>
        <div class="seg">${Object.entries(GOAL_STATUS).map(([k, l]) => `<button class="${g.status === k ? 'on ' + (k === 'done' ? 'good' : k === 'park' ? '' : '') : ''}" data-act="gs" data-arg="${i}:${k}">${l}</button>`).join('')}</div>
        <div class="row between"><span class="tiny muted">Set ${fmtD(g.set)}</span><button class="btn sm danger" data-act="gdel" data-arg="${i}">${icon('trash')}Remove</button></div></div>`).join('') : '<div class="small muted">No goals yet.</div>'}
    </div>
    <div class="card stack tight"><div class="h3">Observations from reviews</div>
      ${obs.length ? obs.map(o => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><a href="#/review/${o.r.id}" class="tiny">${fmtD(o.date)}</a> ${esc(o.text)}</div>`).join('') : '<div class="small muted">Notes you write about her in session and match reviews appear here.</div>'}
    </div>
    <div class="card stack tight"><label class="field"><span>${icon('lock', 'style="width:14px;height:14px;vertical-align:-2px"')} Private notes (staff only, never on her page)</span><textarea data-f="notes"></textarea></label>
      <div class="tiny muted">Don’t record medical or other health details here.</div></div>
    <div class="row"><div class="grow"></div><button class="btn danger" data-act="del">${icon('trash')}Remove from squad</button></div>
  </div>
  <div class="stack">
    <div class="card stack tight"><div class="h3">Her player page</div>
      <div class="small muted">${p.share && p.share.token ? `Link ${p.share.enabled === false ? 'turned off' : 'live'}.` : 'No link yet.'}</div>
      <button class="btn pri" data-act="link">${icon('link')}${p.share && p.share.token ? 'Link and PIN' : 'Create her link'}</button></div>
    ${nm ? `<div class="card stack tight"><div class="eyebrow">Next match: v ${esc(nm.opponent)}</div><div class="small">${ins ? esc(ins) : '<span class="muted">No individual instruction yet.</span>'}</div><a class="small" href="#/match/${nm.id}">Open match plan</a></div>` : ''}
  </div></div>`;

  el.querySelectorAll('[data-cap]').forEach(c => c.onchange = () => { save.flush(); setCapt(p.team, p, c.checked ? c.dataset.cap : ''); ctx.refresh(); });
  bindFields(el, p, (path) => { save(); if (path === 'name') ctx.setTop({ back: '#/squad', title: p.name, sub: '#' + p.num + ' · ' + (p.pos || 'Position not set') }); });
  actions(el, {
    unphoto: async () => {
      if (!await confirmSheet('Remove her photo?', 'It comes off the squad list and her page. She can add one again from her page.', 'Remove', false)) return;
      try { if (p.share && p.share.token) await cloud.removePlayerPhoto(p.share.token); S.setPhotos([[p.id, null]]); toast('Photo removed'); }
      catch (e) { toast(e.message || 'Could not reach the cloud'); }
    },
    goal: () => { p.goals.push({ id: uid(), text: '', how: '', status: 'on', set: today() }); S.put(p); ctx.refresh(); setTimeout(() => { const g = el.querySelectorAll('[data-f$=".text"]'); g[g.length - 1]?.focus(); }, 30); },
    gs: a => { const [i, k] = a.split(':'); p.goals[+i].status = k; if (k === 'done') p.goals[+i].done = today(); S.put(p); ctx.refresh(); },
    gdel: i => { p.goals.splice(+i, 1); S.put(p); ctx.refresh(); },
    link: () => { save.flush(); shareSheet('player', p); },
    del: async () => {
      if (!await confirmSheet('Remove ' + p.name + '?', 'She comes off boards and match squads, and her player link is deleted.')) return;
      if (p.share && p.share.token) { try { await cloud.deleteShare(p.share.token); } catch (e) { toast('Could not delete her link online. Turn it off from another device.'); } }
      S.del(p.id); location.hash = '#/squad';
    }
  });
  return () => save.flush();
}
