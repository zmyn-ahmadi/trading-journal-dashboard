// Stand-in for the FastAPI backend in the public demo. Invented trades only,
// answering the same /api routes, so App.jsx runs unchanged.
const SYMBOLS = [
  ["EURUSD", 1.08, 0.0005],
  ["GBPUSD", 1.27, 0.0006],
  ["USDJPY", 151.2, 0.06],
  ["XAUUSD", 2650, 2.5],
];
const RESULTS = [120, -60, 85, -60, 210, 40, -75, 150, -30, 95, -60, 180, -80, -60, 260, 70, -60, 130, 55, -70, 110, 220, -60, 90, -25, 140, -60, 100, 175, -65];
const DAY = 86400000;

export function detectSession(hour) {
  if (hour < 8) return "asian";
  if (hour < 15) return "london";
  if (hour < 21) return "new_york";
  return "off_hours";
}

export function makeTrades(now = Date.now()) {
  const closed = Array.from({ length: 90 }, (_, i) => {
    const [symbol, base, pip] = SYMBOLS[i % SYMBOLS.length];
    const side = i % 3 === 0 ? "SELL" : "BUY";
    const direction = side === "BUY" ? 1 : -1;
    const net = RESULTS[i % RESULTS.length] + (i % 7) * 3;
    const entryAt = new Date(now - (89 - i) * DAY + ((i * 5) % 20) * 3600000 - 21 * 3600000);
    const exitAt = new Date(entryAt.getTime() + (1 + i % 4) * 3600000);
    const entry = +(base * (1 + (i % 9) / 500)).toFixed(4);
    return {
      id: i + 1, position_id: 900000 + i, symbol, side, lots: 0.5,
      entry_price: entry, exit_price: +(entry + direction * pip * (net / 10)).toFixed(4),
      entry_time: entryAt.toISOString(), exit_time: exitAt.toISOString(),
      stop_loss: +(entry - direction * pip * 12).toFixed(4), take_profit: +(entry + direction * pip * 24).toFixed(4),
      gross_profit: net + 4, commission: -3, swap: -1, net_profit: net,
      session: detectSession(entryAt.getUTCHours()), status: "closed",
      notes: i % 8 === 0 ? [{ id: i + 1, content: "Sample note: waited for the retest.", note_type: "general", created_at: exitAt.toISOString() }] : [],
      screenshots: [],
    };
  });
  const entryAt = new Date(now - 2 * 3600000);
  const open = { ...closed[0], id: 91, position_id: 900090, entry_time: entryAt.toISOString(), exit_time: null, exit_price: null, gross_profit: null, commission: null, swap: null, net_profit: null, session: detectSession(entryAt.getUTCHours()), status: "open", notes: [] };
  return [...closed, open];
}

const trades = makeTrades();
const round = (value) => Math.round(value * 100) / 100;

function since(period, now = Date.now()) {
  const days = { week: 7, month: 30, "3months": 90, year: 365 }[period];
  if (period === "today") return new Date(now).setUTCHours(0, 0, 0, 0);
  return days ? now - days * DAY : 0;
}

function group(closed, keyOf, name) {
  const groups = {};
  for (const t of closed) {
    const key = keyOf(t);
    const g = (groups[key] ||= { [name]: key, count: 0, pnl: 0, winners: 0, losers: 0 });
    g.count += 1;
    g.pnl = round(g.pnl + t.net_profit);
    if (t.net_profit > 0) g.winners += 1;
    else if (t.net_profit < 0) g.losers += 1;
  }
  return Object.values(groups);
}
const withWinRate = (rows) => rows.map((r) => ({ ...r, win_rate: round((r.winners / r.count) * 100) }));

function stats(all, closed) {
  const winners = closed.filter((t) => t.net_profit > 0);
  const losers = closed.filter((t) => t.net_profit < 0);
  const wins = winners.reduce((a, t) => a + t.net_profit, 0);
  const losses = Math.abs(losers.reduce((a, t) => a + t.net_profit, 0));
  const avgWin = winners.length ? wins / winners.length : 0;
  const avgLoss = losers.length ? losses / losers.length : 0;
  const pick = (t) => (t ? { id: t.id, symbol: t.symbol, pnl: t.net_profit } : null);
  const sorted = [...closed].sort((a, b) => b.net_profit - a.net_profit);
  return {
    total_trades: closed.length, open_trades: all.filter((t) => t.status === "open").length,
    winners: winners.length, losers: losers.length, breakeven: closed.length - winners.length - losers.length,
    win_rate: closed.length ? round((winners.length / closed.length) * 100) : 0,
    net_pnl: round(closed.reduce((a, t) => a + t.net_profit, 0)),
    gross_pnl: round(closed.reduce((a, t) => a + t.gross_profit, 0)),
    avg_winner: round(avgWin), avg_loser: round(-avgLoss),
    best_trade: pick(sorted[0]), worst_trade: pick(sorted[sorted.length - 1]),
    profit_factor: losses ? round(wins / losses) : null, avg_rr: avgLoss ? round(avgWin / avgLoss) : null,
  };
}

export function respond(path, query, source = trades) {
  const from = since(query.get("period") || "all");
  const all = source.filter((t) => Date.parse(t.entry_time) >= from);
  const closed = all.filter((t) => t.status === "closed");
  const detail = path.match(/^\/api\/trades\/(\d+)$/);
  if (detail) return source.find((t) => t.id === +detail[1]) ?? null;
  switch (path) {
    case "/api/trades": {
      const filters = [["symbol", "symbol"], ["side", "side"], ["session", "session"], ["status", "status"]];
      const rows = filters.reduce((list, [param, key]) => (query.get(param) ? list.filter((t) => t[key].toLowerCase() === query.get(param).toLowerCase()) : list), all)
        .sort((a, b) => b.entry_time.localeCompare(a.entry_time));
      const offset = +(query.get("offset") || 0);
      const limit = +(query.get("limit") || 200);
      return { trades: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
    }
    case "/api/stats": return stats(all, closed);
    case "/api/stats/sessions": return withWinRate(group(closed, (t) => t.session, "session"));
    case "/api/stats/symbols": return withWinRate(group(closed, (t) => t.symbol, "symbol")).sort((a, b) => b.pnl - a.pnl);
    case "/api/stats/calendar": return group(closed, (t) => t.exit_time.slice(0, 10), "date").sort((a, b) => a.date.localeCompare(b.date));
    case "/api/stats/equity": {
      let cumulative = 0;
      return [...closed].sort((a, b) => a.exit_time.localeCompare(b.exit_time)).map((t) => {
        cumulative = round(cumulative + t.net_profit);
        return { date: t.exit_time, pnl: t.net_profit, cumulative, symbol: t.symbol, trade_id: t.id };
      });
    }
    case "/api/filters": return { symbols: [...new Set(source.map((t) => t.symbol))].sort(), sessions: [...new Set(source.map((t) => t.session))].sort() };
    default: return null;
  }
}

function changeNotes(url, init) {
  const add = url.pathname.match(/^\/api\/trades\/(\d+)\/notes$/);
  const remove = url.pathname.match(/^\/api\/trades\/(\d+)\/notes\/(\d+)$/);
  if (add) {
    const trade = trades.find((t) => t.id === +add[1]);
    const note = { id: Date.now(), content: init.body.get("content"), note_type: init.body.get("note_type") || "general", created_at: new Date().toISOString() };
    trade.notes = [...trade.notes, note];
    return note;
  }
  if (remove) {
    const trade = trades.find((t) => t.id === +remove[1]);
    trade.notes = trade.notes.filter((n) => n.id !== +remove[2]);
  }
  return { ok: true };
}

if (typeof window !== "undefined") {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(input, window.location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
    const method = (init.method || "GET").toUpperCase();
    const body = method === "GET" ? respond(url.pathname, url.searchParams) : changeNotes(url, init);
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  };
  const badge = document.createElement("div");
  badge.textContent = "Demo: invented sample trades";
  badge.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9999;padding:6px 10px;border-radius:6px;background:#16161f;border:1px solid #282840;color:#e4e4ec;font:12px sans-serif";
  document.body.append(badge);
}
