// Squad and player profiles: development goals, observations, player links.
import * as S from '../store.js';
import { GOAL_STATUS } from '../store.js';
import { esc, icon, uid, today, fmtD, bindFields, actions, debounce, confirmSheet, sheet, closeSheet, toast } from '../util.js';
import { shareSheet, refreshPlayers } from './sharing.js';
import * as cloud from '../cloud.js';

const POS = ['GK', 'RB', 'CB', 'LB', 'FB', '6', '8', 'CM', '10', 'RW', 'LW', 'W', 'CF'];

export default function squad(el, params, ctx) {
  const t = S.team(); const T = t.id; ctx.setTop({});
  const ps = S.players(T); const opt = t.playerShare || { principles: true, keys: true, setpieces: true };
  const links = ps.filter(p => p.share && p.share.token).length;
  el.innerHTML = `<div class="split wide-right"><div class="stack">
    <div class="row between"><div><div class="h1">Squad</div><div class="small muted" style="margin-top:4px">${ps.length} players · ${esc(t.name)}</div></div>
      <div class="row" style="gap:8px"><button class="btn" data-act="import">Paste a list</button><button class="btn pri" data-act="add">${icon('plus')}Add player</button></div></div>
    ${ps.length ? `<div class="list">${ps.map(p => { const g = (p.goals || []).filter(x => x.status === 'on').length;
      return `<a class="item" href="#/player/${p.id}"><span class="badge-num" style="${p.pos === 'GK' ? 'background:#2FB67A' : ''}">${esc(p.num)}</span><span class="grow"><span class="t" style="display:block">${esc(p.name)}</span><span class="s">${esc(p.pos)}${p.pos2 ? ' / ' + esc(p.pos2) : ''}${g ? ` · ${g} goal${g > 1 ? 's' : ''} on the go` : ' · no development goal'}</span></span>${p.share && p.share.token ? `<span class="pill ${p.share.enabled === false ? 'grey' : 'good'}">${icon('link', 'style="width:12px;height:12px"')}Link</span>` : ''}</a>`; }).join('')}</div>` : '<div class="empty">No players yet.</div>'}
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
  el.querySelectorAll('[data-o]').forEach(c => c.onchange = () => { t.playerShare = { ...opt, ...(t.playerShare || {}), [c.dataset.o]: c.checked }; S.put(t); });
  actions(el, {
    add: () => addSheet(T),
    import: () => importSheet(T, ctx),
    pushAll: async () => {
      if (!cloud.signedIn()) return toast('Sign in to cloud sync first (More > Cloud sync)');
      try { const n = await refreshPlayers(T); toast(`Updated ${n} player page${n === 1 ? '' : 's'}`); } catch (e) { toast(e.message || 'Could not update'); }
    }
  });
}

function addSheet(T) {
  const used = new Set(S.players(T).map(p => +p.num)); let n = 1; while (used.has(n)) n++;
  const el = sheet(`<div class="stack"><div class="h2">Add player</div>
    <div class="row nowrap"><label class="field" style="width:90px"><span>Number</span><input type="number" inputmode="numeric" id="apN" value="${n}"></label><label class="field grow"><span>Name</span><input type="text" id="apM" autofocus></label></div>
    <label class="field"><span>Position</span><select id="apP">${POS.map(p => `<option>${p}</option>`).join('')}</select></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="apX">Cancel</button><button class="btn pri" id="apS">Add</button></div></div>`);
  el.querySelector('#apX').onclick = closeSheet;
  el.querySelector('#apS').onclick = () => {
    const name = el.querySelector('#apM').value.trim(); if (!name) return toast('Add a name');
    const p = S.create('player', T, { num: +el.querySelector('#apN').value || '', name, short: '', pos: el.querySelector('#apP').value, pos2: '', foot: '', notes: '', goals: [], obs: [] });
    closeSheet(); location.hash = '#/player/' + p.id;
  };
}

function importSheet(T, ctx) {
  const el = sheet(`<div class="stack"><div class="h2">Paste a squad list</div>
    <p class="small muted" style="margin:0">One player per line: number, name, position. For example:<br><code>7 Jane Smith RW</code><br>If a number already exists, that player’s name and position are updated, so you can replace the dummy names in one go.</p>
    <textarea id="imT" style="min-height:200px" placeholder="1 Name Surname GK"></textarea>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="imX">Cancel</button><button class="btn pri" id="imS">Import</button></div></div>`);
  el.querySelector('#imX').onclick = closeSheet;
  el.querySelector('#imS').onclick = () => {
    const existing = S.players(T); let add = 0, upd = 0;
    el.querySelector('#imT').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      const m = l.match(/^(\d+)[\s.,:-]+(.+?)(?:[\s,]+(GK|RB|CB|LB|FB|RWB|LWB|DM|CM|AM|6|8|10|RM|LM|RW|LW|W|CF|ST|9))?$/i);
      if (!m) return;
      const num = +m[1], name = m[2].trim(), pos = (m[3] || '').toUpperCase();
      const cur = existing.find(p => +p.num === num);
      if (cur) { cur.name = name; if (pos) cur.pos = pos; S.put(cur); upd++; }
      else { S.create('player', T, { num, name, short: '', pos: pos || 'CM', pos2: '', foot: '', notes: '', goals: [], obs: [] }); add++; }
    });
    closeSheet(); toast(`${add} added, ${upd} updated`); ctx.refresh();
  };
}

export function playerView(el, [id], ctx) {
  const p = S.get(id);
  if (!p) { ctx.setTop({ back: '#/squad', title: 'Player' }); el.innerHTML = '<div class="empty">This player has been removed.</div>'; return; }
  const T = p.team; p.goals ||= [];
  ctx.setTop({ back: '#/squad', title: p.name, sub: '#' + p.num + ' · ' + p.pos });
  const save = debounce(() => S.put(p), 400);
  const obs = S.reviews(T).filter(r => (r.playerObs || {})[p.id] && r.playerObs[p.id].trim()).map(r => ({ date: r.date, text: r.playerObs[p.id], r }));
  const nm = S.nextMatch(T); const ins = nm ? (nm.instructions || {})[p.id] : '';

  el.innerHTML = `<div class="split wide-right"><div class="stack">
    <div class="card row nowrap" style="gap:16px"><span class="display" style="font-size:64px;color:var(--accent);min-width:64px;text-align:center">${esc(p.num)}</span><div class="grow"><div class="h1" style="font-size:32px">${esc(p.name)}</div><div class="small muted">${esc(p.pos)}${p.pos2 ? ' / ' + esc(p.pos2) : ''}${p.foot ? ' · ' + esc(p.foot) + ' foot' : ''}</div></div></div>
    <div class="card stack tight">
      <div class="row nowrap"><label class="field" style="width:90px"><span>Number</span><input type="number" inputmode="numeric" data-f="num"></label><label class="field grow"><span>Name</span><input type="text" data-f="name"></label></div>
      <div class="grid2" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <label class="field"><span>Position</span><select data-f="pos">${POS.concat(POS.includes(p.pos) ? [] : [p.pos]).map(x => `<option ${x === p.pos ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
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

  bindFields(el, p, (path) => { save(); if (path === 'name') ctx.setTop({ back: '#/squad', title: p.name, sub: '#' + p.num + ' · ' + p.pos }); });
  actions(el, {
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
