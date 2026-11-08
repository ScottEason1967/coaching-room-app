// Stand-in for supabase-js, talking to a test server through window.__srv.
(() => {
  const call = async (op, p) => JSON.parse(await window.__srv(op, JSON.stringify(p)));
  let session = JSON.parse(localStorage.getItem('mock.session') || 'null');
  const cbs = [];
  const setSession = s => { session = s; localStorage.setItem('mock.session', JSON.stringify(s)); cbs.forEach(cb => cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s)); };
  function query(table) {
    const q = { table, filters: [], op: 'select', uid: () => session ? session.user.id : null };
    const run = async () => call('query', { table, op: q.op, rows: q.rows, patch: q.patch, filters: q.filters, order: q.order, limit: q.limit, single: q.single, uid: q.uid() });
    const b = {
      select() { return b; }, upsert(rows) { q.op = 'upsert'; q.rows = rows; return b; }, update(p) { q.op = 'update'; q.patch = p; return b; }, delete() { q.op = 'delete'; return b; },
      order(c) { q.order = c; return b; }, limit(n) { q.limit = n; return b; }, gt(c, v) { q.filters.push(['gt', c, v]); return b; }, not(c, o, v) { q.filters.push(['not', c, v]); return b; }, eq(c, v) { q.filters.push(['eq', c, v]); return b; },
      maybeSingle() { q.single = true; return b; }, then(res, rej) { return run().then(res, rej); }
    };
    return b;
  }
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: cb => { cbs.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async ({ email, password }) => { const r = await call('signin', { email, password }); if (r.error) return { error: r.error }; setSession({ user: r.user }); return { data: { session } }; },
      signUp: async ({ email, password }) => { const r = await call('signup', { email, password }); if (r.error) return { error: r.error }; setSession({ user: r.user }); return { data: { session } }; },
      signOut: async () => { setSession(null); return {}; },
      resetPasswordForEmail: async () => ({}),
      updateUser: async () => ({ data: {}, error: null })
    },
    from: query,
    rpc: async (name, params) => call('rpc', { name, params, uid: session ? session.user.id : null })
  }) };
})();
