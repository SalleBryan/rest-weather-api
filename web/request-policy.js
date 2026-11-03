/* Shared request guard. Browser limits are convenience controls, not provider quotas. */
(function (root) {
  "use strict";
  const LIMITS = Object.freeze({ minute: 10, day: 100 });
  function create({
    storage,
    fetcher = (...args) => fetch(...args),
    now = Date.now,
    locks,
  } = {}) {
    const memory = new Map(),
      pending = new Map();
    const read = (key) => {
      const raw = storage ? storage.getItem(key) : memory.get(key);
      return raw ? JSON.parse(raw) : null;
    };
    const write = (key, value) => {
      const raw = JSON.stringify(value);
      if (storage) storage.setItem(key, raw);
      else memory.set(key, raw);
    };
    function ledger(group) {
      const saved = read("wb-budget-v1-" + group),
        time = now();
      if (
        saved &&
        (!Array.isArray(saved.calls) ||
          saved.calls.some((t) => !Number.isFinite(t)) ||
          !Number.isFinite(saved.cooldown))
      )
        throw Error("Request counter is unavailable. Check browser storage.");
      const day = new Date(time).toISOString().slice(0, 10);
      return {
        day,
        calls: saved?.day === day ? saved.calls.filter((t) => t <= time) : [],
        cooldown: saved?.cooldown || 0,
      };
    }
    function usage(group) {
      const record = ledger(group),
        time = now();
      return {
        day: record.calls.length,
        minute: record.calls.filter((t) => t > time - 60000).length,
        cooldown: record.cooldown,
        limits: LIMITS,
      };
    }
    function reserve(group) {
      const record = ledger(group),
        time = now();
      if (record.cooldown > time)
        throw Error(
          "Provider cooldown. Try again after " +
            new Date(record.cooldown).toLocaleTimeString() +
            ".",
        );
      if (record.calls.length >= LIMITS.day)
        throw Error(
          "Daily browser limit reached (100 requests). Try again after 00:00 UTC.",
        );
      if (record.calls.filter((t) => t > time - 60000).length >= LIMITS.minute)
        throw Error(
          "Minute limit reached (10 requests). Wait a minute and try again.",
        );
      record.calls.push(time);
      write("wb-budget-v1-" + group, record);
    }
    const locked = (group, fn) =>
      locks
        ? locks.request("wb-budget-" + group, fn)
        : Promise.resolve().then(fn);
    async function request(
      url,
      { group = "weather", ttl = 0, method = "GET", body, signal } = {},
    ) {
      const cacheKey = "wb-cache-v1",
        key = method + " " + url;
      if (ttl && method !== "GET") throw Error("Only reads may be cached.");
      // Cache reads never consume the request allowance.
      if (ttl) {
        try {
          const hit = (read(cacheKey) || []).find(
            (it) => it.key === key && it.expires > now(),
          );
          if (hit) return { ...hit.value, cached: true };
        } catch {
          /* Ignore damaged/disabled cache, but never ignore a damaged budget. */
        }
      }
      if (method === "GET" && pending.has(key)) return pending.get(key);
      const work = (async () => {
        await locked(group, () => reserve(group));
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 10000);
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) controller.abort();
        try {
          const response = await fetcher(url, {
            method,
            body,
            signal: controller.signal,
            credentials: "omit",
            redirect: "error",
            headers: body ? { "Content-Type": "application/json" } : {},
          });
          const data = await response.json().catch(() => null);
          if (response.status === 429) {
            const header = response.headers.get("Retry-After");
            const until = /^\d+$/.test(header || "")
              ? now() + Number(header) * 1000
              : Date.parse(header);
            await locked(group, () => {
              const record = ledger(group);
              record.cooldown = Math.max(
                record.cooldown,
                now() + 60000,
                Math.min(Number.isFinite(until) ? until : 0, now() + 86400000),
              );
              write("wb-budget-v1-" + group, record);
            });
          }
          if (!response.ok) {
            const error = Error(
              response.status === 429
                ? "Provider request limit reached. Wait before trying again."
                : data?.reason ||
                    data?.message ||
                    "The provider could not complete this request (" +
                      response.status +
                      ").",
            );
            error.status = response.status;
            error.data = data;
            throw error;
          }
          if (!data || typeof data !== "object")
            throw Error("The provider returned an invalid response.");
          const value = {
            data,
            status: response.status,
            fetchedAt: now(),
            cached: false,
          };
          if (ttl) {
            try {
              const entries = (read(cacheKey) || [])
                .filter((it) => it.key !== key && it.expires > now())
                .slice(-29);
              entries.push({ key, value, expires: now() + ttl });
              write(cacheKey, entries);
            } catch {
              /* Request budget has already been persisted. */
            }
          }
          return value;
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
        }
      })();
      if (method === "GET") pending.set(key, work);
      try {
        return await work;
      } finally {
        if (pending.get(key) === work) pending.delete(key);
      }
    }
    return { request, usage };
  }
  function apiBase(value) {
    const url = new URL(value.trim());
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error(
        "Use an HTTPS base URL without credentials, query parameters, or a fragment. HTTP is allowed for localhost.",
      );
    return url.href.replace(/\/+$/, "");
  }
  const api = { create, apiBase, LIMITS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RequestPolicy = api;
})(typeof globalThis === "undefined" ? this : globalThis);
