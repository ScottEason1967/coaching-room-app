// Staff: who coaches this team with you, their roles, and invitations.
// Joe makes an invite in the app and sends the link himself (WhatsApp, text or email). Supabase's own
// email only reaches people on the Supabase account's team, so the app never relies on it.
// #/join/<token> opens an invitation for someone already signed in (the sign-in screen handles the rest).
import * as S from '../store.js';
import * as cloud from '../cloud.js';
import { esc, icon, actions, toast, sheet, closeSheet, confirmSheet, fmtD } from '../util.js';

export const ROLE = { owner: 'Owner', admin: 'Admin', coach: 'Coach', viewer: 'Viewer', player: 'Player' };
export const ROLE_SAYS = { owner: 'Set up the team. Can do everything.', admin: 'Can change everything, and invite and manage staff.', coach: 'Can change everything.', viewer: 'Can see everything, change nothing.' };
const REASON = { gone: 'This invite has been cancelled, or the link is not complete.', used: 'This invite has already been used.', expired: 'This invite has run out. Ask for a new one.', email: 'This invite is for a different email address.', cloud: 'Cloud sync is not set up on this copy of the app.' };
export const reasonText = r => REASON[r] || 'This invite can’t be used.';

// The message Joe sends with the link.
function inviteText(t, inv, url) {
  const from = (S.coach() || {}).name || 'Your coach';
  return `${from} has invited you to join ${inv.teams && inv.teams.length ? inv.teams.join(' and ') : t.name} on The Coaching Room as ${ROLE[inv.role].toLowerCase()}. Open this link to join${inv.email ? ` (it is for ${inv.email})` : ''}: ${url}`;
}
export function sendSheet(t, inv) {
  const url = cloud.joinUrl(inv.token); const text = inviteText(t, inv, url);
  const el = sheet(`<div class="stack" id="sendInvite"><div class="h2">Send the invite</div>
    <p class="small" style="margin:0">Send ${esc(inv.name || 'them')} this link from your phone. It works once${inv.email ? `, for ${esc(inv.email)},` : ''} within 14 days.</p>
    <div class="small" style="word-break:break-all;background:var(--bg);border-radius:10px;padding:10px 12px" id="invUrl">${esc(url)}</div>
    <div class="stack tight">
      ${navigator.share ? `<button class="btn pri block" id="iShare">${icon('share')}Share…</button>` : ''}
      <a class="btn block" id="iWa" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn block" id="iMail" href="mailto:${encodeURIComponent(inv.email || '')}?subject=${encodeURIComponent('Join ' + t.name + ' on The Coaching Room')}&body=${encodeURIComponent(text)}">Email</a>
      <button class="btn block" id="iCopy">Copy the link</button>
    </div>
    <button class="btn" id="iX">Done</button></div>`);
  el.querySelector('#iX').onclick = closeSheet;
  el.querySelector('#iShare')?.addEventListener('click', () => navigator.share({ title: 'Join ' + t.name, text }).catch(() => {}));
  el.querySelector('#iCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (e) { toast('Copy it from the box above'); } };
}

export default function staffView(el, params, ctx) {
  const t = S.team(); const T = t.id;
  ctx.setTop({ back: '#/teamhome', title: 'Staff', sub: t.name });
  if (!cloud.configured() || !cloud.signedIn()) {
    el.innerHTML = `<div class="empty">Working with other coaches needs cloud sync and a sign-in. <a href="#/cloud">Cloud sync</a></div>`; return;
  }
  if (!S.meta().members) {
    el.innerHTML = `<div class="card stack tight"><div class="h3">Not switched on yet</div><p class="small" style="margin:0">The database needs its update before you can invite anyone. Run the latest supabase/schema.sql in Supabase (SQL Editor), then come back here.</p><button class="btn sm" data-act="retry">Check again</button></div>`;
    actions(el, { retry: async () => { await cloud.refreshMembers(); ctx.refresh(); } }); return;
  }
  const me = cloud.myId(); const mine = S.roleIn(T); const admin = mine === 'owner' || mine === 'admin';
  // Teams this person can invite to: the ones they own or administer.
  const myTeams = S.teams().filter(x => ['owner', 'admin'].includes(S.roleIn(x.id)));
  const ms = S.members(T);
  const who = m => m.user_id === me ? ((S.coach() || {}).name || 'You') : (m.name || m.email || 'Coach');
  const row = m => `<div class="gr" style="cursor:default" data-member="${m.user_id}">
      <span class="badge-num" style="width:36px;height:36px;font-size:14px;background:${m.user_id === me ? '#0B0F19' : 'var(--surface2)'};color:${m.user_id === me ? '#fff' : 'var(--text)'}">${esc((who(m)[0] || '?').toUpperCase())}</span>
      <span class="lbl">${esc(who(m))}${m.user_id === me ? ' <span class="muted">(you)</span>' : ''}<small>${esc(m.email || '')}${m.email ? ' · ' : ''}${esc(ROLE_SAYS[m.role] || '')}${(() => { const o = (S.meta().members || []).filter(x => x.user_id === m.user_id && x.team_id !== T).map(x => (S.get(x.team_id) || {}).name).filter(Boolean); return o.length ? ` · Also on ${esc(o.join(', '))}` : ` · Only this team`; })()}</small></span>
      ${admin && m.role !== 'owner' && m.user_id !== me ? `<select data-role="${m.user_id}" aria-label="Role for ${esc(who(m))}" style="width:auto;min-height:36px;padding:4px 30px 4px 10px">${['admin', 'coach', 'viewer'].map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select>`
        : `<span class="pill ${m.role === 'owner' ? '' : 'grey'}">${ROLE[m.role] || m.role}</span>`}
      ${(admin && m.role !== 'owner' && m.user_id !== me) ? `<button class="btn icon sm danger" data-act="rm" data-arg="${m.user_id}" aria-label="Remove ${esc(who(m))} from the team">${icon('x')}</button>` : ''}
    </div>`;
  el.innerHTML = `<div class="stack" style="max-width:760px">
    <p class="small muted" style="margin:0">Everyone here works on the same game model, squad, sessions, match plans and analysis, and sees each other’s changes within a second or two. Your profile, pathway and logbook stay private to you.</p>
    <div class="ghead">Coaching staff</div>
    <div class="gl" id="members">${ms.map(row).join('') || '<div class="gr">Only you so far.</div>'}</div>
    ${mine && mine !== 'owner' ? `<div class="row"><button class="btn sm" data-act="leave">Leave this team</button></div>` : ''}
    ${admin ? `<div class="ghead">Invite someone</div>
    <form class="card stack" id="invF">
      <div class="grid2"><label class="field"><span>Name</span><input type="text" id="iN" placeholder="e.g. Dave Smith" autocomplete="off"></label>
      <label class="field"><span>Email</span><input type="email" id="iE" placeholder="The email they will sign in with" inputmode="email" autocomplete="off"></label></div>
      ${myTeams.length > 1 ? `<div class="field" id="iTeams"><span>Which teams they can see</span><div class="stack tight">${myTeams.map(x => `<label class="check"><input type="checkbox" data-team="${x.id}" ${x.id === T ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}</div><span class="tiny muted">They only see the teams you tick. To add someone who’s already here to another team, invite them again with that team ticked.</span></div>` : ''}
      <div class="field"><span>Role</span><div class="seg" role="radiogroup" id="iR">${['coach', 'admin', 'viewer'].map(r => `<button type="button" role="radio" aria-checked="${r === 'coach'}" class="${r === 'coach' ? 'on' : ''}" data-r="${r}">${ROLE[r]}</button>`).join('')}</div><span class="tiny muted" id="iRs">${ROLE_SAYS.coach}</span></div>
      <button class="btn pri" type="submit" id="iGo">${icon('plus')}Make the invite link</button>
      <p class="tiny muted" style="margin:0">You send the link yourself, by WhatsApp, text or email. It works once, for that email address, within 14 days.</p>
    </form>
    <div class="ghead">Waiting to join</div><div class="gl" id="pending"><div class="gr" style="cursor:default"><span class="lbl muted">Checking…</span></div></div>` : `<p class="small muted">Only the team’s owner or an admin can invite people.</p>`}
  </div>`;

  let role = 'coach';
  el.querySelectorAll('#iR [data-r]').forEach(b => b.onclick = () => { role = b.dataset.r; el.querySelectorAll('#iR [data-r]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); el.querySelector('#iRs').textContent = ROLE_SAYS[role]; });
  const f = el.querySelector('#invF');
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const name = el.querySelector('#iN').value.trim(), em = el.querySelector('#iE').value.trim();
    if (!em || !/^\S+@\S+\.\S+$/.test(em)) return toast('Put in the email they will sign in with');
    const picked = myTeams.length > 1 ? [...el.querySelectorAll('#iTeams [data-team]:checked')].map(c => c.dataset.team) : [T];
    if (!picked.length) return toast('Tick at least one team');
    try {
      const toks = []; for (const tm of picked) toks.push(await cloud.createInvite({ team: tm, role, name, email: em }));
      // One link for all the teams ticked.
      sendSheet(t, { token: toks.join('.'), role, name, email: em, teams: picked.map(id => (S.get(id) || {}).name).filter(Boolean) }); loadPending(); f.reset();
    }
    catch (er) { toast(er.message || 'Could not make the invite'); }
  };
  let pend = [];
  async function loadPending() {
    const box = el.querySelector('#pending'); if (!box) return;
    pend = await cloud.listInvites(T);
    box.innerHTML = pend.length ? pend.map(i => `<div class="gr" style="cursor:default"><span class="lbl">${esc(i.name || i.email || 'Invite')}<small>${esc(i.email || '')} · ${ROLE[i.role]} · until ${fmtD(i.expires_at.slice(0, 10))}</small></span><button class="btn sm" data-act="resend" data-arg="${i.token}">Send</button><button class="btn sm" data-act="cancel" data-arg="${i.token}">Cancel</button></div>`).join('')
      : '<div class="gr" style="cursor:default"><span class="lbl muted">Nobody waiting.</span></div>';
  }
  if (admin) loadPending();
  el.querySelectorAll('[data-role]').forEach(s => s.onchange = async () => { try { await cloud.setRole(T, s.dataset.role, s.value); toast('Role changed to ' + ROLE[s.value]); } catch (e) { toast(e.message); ctx.refresh(); } });
  actions(el, {
    resend: tok => { const i = pend.find(x => x.token === tok); if (i) sendSheet(t, i); },
    cancel: async tok => { if (!(await confirmSheet('Cancel this invite?', 'The link will stop working.', 'Cancel invite'))) return; try { await cloud.cancelInvite(tok); toast('Invite cancelled'); loadPending(); } catch (e) { toast(e.message); } },
    rm: async uid => { const m = ms.find(x => x.user_id === uid); if (!(await confirmSheet(`Remove ${who(m)} from ${t.name}?`, 'They will no longer see or change anything in this team. Their own drills stay theirs.', 'Remove'))) return; try { await cloud.removeMember(T, uid); toast('Removed'); ctx.refresh(); } catch (e) { toast(e.message); } },
    leave: async () => { if (!(await confirmSheet(`Leave ${t.name}?`, 'You will no longer see this team. Someone will have to invite you again.', 'Leave'))) return; try { await cloud.removeMember(T, me); location.hash = '#/home'; } catch (e) { toast(e.message); } }
  });
}

// Signed in and opening an invite link.
// A link can carry invites for several teams ("tok1.tok2"): read them all and show them as one.
export async function readInvites(tokenStr) {
  const toks = String(tokenStr || '').split('.').filter(Boolean);
  const infos = await Promise.all(toks.map(tk => cloud.inviteInfo(tk)));
  const ok = toks.map((tk, i) => ({ tk, info: infos[i] })).filter(x => x.info && x.info.ok);
  if (!ok.length) return { ok: false, reason: (infos[0] || {}).reason, toks: [] };
  const first = ok[0].info;
  return { ...first, ok: true, team: ok.map(x => x.info.team || 'a team').join(' and '), toks: ok.map(x => x.tk) };
}
export async function acceptAll(toks) {
  let first = null, why = null;
  for (const tk of toks) { const r = await cloud.acceptInvite(tk); if (r && r.ok) first ||= r.team_id; else why ||= r && r.reason; }
  return first ? { ok: true, team_id: first } : { ok: false, reason: why };
}
export function joinView(el, [token], ctx) {
  ctx.setTop({ back: '#/home', title: 'Join a team' });
  el.innerHTML = '<div class="empty">Checking the invite…</div>';
  readInvites(token).then(info => {
    if (!info || !info.ok) { el.innerHTML = `<div class="card stack tight"><div class="h3">This invite can’t be used</div><p class="small" style="margin:0">${esc(reasonText(info && info.reason))}</p><a class="btn sm" href="#/home">Go home</a></div>`; return; }
    el.innerHTML = `<div class="card stack" style="max-width:520px"><div class="h2">${esc(info.team || 'A team')}</div>
      <p class="small" style="margin:0">${esc(info.from || 'A coach')} has invited you to join as <b>${esc((ROLE[info.role] || '').toLowerCase())}</b>: ${esc(ROLE_SAYS[info.role] || '')}</p>
      ${info.email && info.email.toLowerCase() !== cloud.email().toLowerCase() ? `<p class="small" style="margin:0;color:var(--lamp-text)">It is for ${esc(info.email)}, but you are signed in as ${esc(cloud.email())}. Sign out and open the link again to join as ${esc(info.email)}.</p>` : `<button class="btn pri" data-act="join" id="joinGo">Join ${esc(info.team || 'the team')}</button>`}</div>`;
    actions(el, { join: async () => {
      try { const r = await acceptAll(info.toks); if (!r.ok) return toast(reasonText(r.reason)); await cloud.syncFully(); if (S.get(r.team_id)) S.setTeam(r.team_id); toast('You’re in. Welcome to ' + (info.team || 'the team')); location.hash = '#/home'; }
      catch (e) { toast(e.message); }
    } });
  });
}
