import test from "node:test";
import assert from "node:assert/strict";
import { detectSession, makeTrades, respond } from "../src/demoApi.js";

const now = Date.UTC(2026, 9, 30, 12);
const trades = makeTrades(now);
const get = (path, period = "all") => respond(path, new URLSearchParams({ period }), trades);

test("sessions match journal/sessions.py boundaries", () => {
  assert.deepEqual([0, 7, 8, 14, 15, 20, 21, 23].map(detectSession), ["asian", "asian", "london", "london", "new_york", "new_york", "off_hours", "off_hours"]);
});

test("stats, equity and groupings agree", () => {
  const stats = get("/api/stats");
  const equity = get("/api/stats/equity");
  assert.equal(stats.total_trades, 90);
  assert.equal(stats.open_trades, 1);
  assert.equal(equity.at(-1).cumulative, stats.net_pnl);
  assert.equal(get("/api/stats/sessions").reduce((a, s) => a + s.count, 0), 90);
  assert.equal(get("/api/stats/symbols").reduce((a, s) => a + s.count, 0), 90);
  assert.equal(get("/api/stats/calendar").reduce((a, s) => a + s.count, 0), 90);
});

test("trades filter, page and look up by id", () => {
  const page = respond("/api/trades", new URLSearchParams({ symbol: "EURUSD", limit: "5" }), trades);
  assert.equal(page.trades.length, 5);
  assert.ok(page.total > 5 && page.trades.every((t) => t.symbol === "EURUSD"));
  assert.equal(get("/api/trades/3").id, 3);
  assert.equal(get("/api/trades/999"), null);
});
