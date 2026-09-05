(function () {
  "use strict";

  var SUPABASE_ORIGIN = "https://wmnymdmjiczbmjyztcze.supabase.co";
  var SHARED_STATE_PATH = "/functions/v1/bloggers-api/api/shared-state";
  var EVIDENCE_PATH = "/functions/v1/bloggers-api/api/evidence-reports";
  var EVIDENCE_TTL_MS = 8 * 60 * 1000;
  var originalFetch = window.fetch.bind(window);
  var sharedSnapshots = new Map();
  var evidenceResponses = new Map();

  function requestUrl(input) {
    try {
      return new URL(input instanceof Request ? input.url : String(input), window.location.href);
    } catch (_) {
      return null;
    }
  }

  function requestMethod(input, init) {
    return String((init && init.method) || (input instanceof Request && input.method) || "GET").toUpperCase();
  }

  function requestHeaders(input, init) {
    var headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers((init && init.headers) || undefined).forEach(function (value, key) {
      headers.set(key, value);
    });
    return headers;
  }

  function sessionKey(headers) {
    return headers.get("authorization") || ("access:" + (headers.get("x-nsl-access") || "anonymous"));
  }

  function snapshotRecordKey(record) {
    return String(record && record.namespace || "") + "\u0000" + String(record && record.key || "");
  }

  function mergeSnapshot(snapshot, payload) {
    (payload && Array.isArray(payload.records) ? payload.records : []).forEach(function (record) {
      snapshot.records.set(snapshotRecordKey(record), record);
    });
    var nextUpdatedAt = String(payload && payload.latestUpdatedAt || "");
    if (nextUpdatedAt && nextUpdatedAt > snapshot.latestUpdatedAt) snapshot.latestUpdatedAt = nextUpdatedAt;
  }

  function createSnapshot(payload) {
    var snapshot = { records: new Map(), latestUpdatedAt: "" };
    mergeSnapshot(snapshot, payload || {});
    return snapshot;
  }

  function snapshotResponse(snapshot, stale) {
    return new Response(JSON.stringify({
      records: Array.from(snapshot.records.values()),
      latestUpdatedAt: snapshot.latestUpdatedAt,
      count: snapshot.records.size,
      incrementalTransport: true,
      staleFallback: Boolean(stale)
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-nsl-traffic-guard": stale ? "stale-snapshot" : "incremental"
      }
    });
  }

  function incrementalSharedState(input, init, url, key) {
    var snapshot = sharedSnapshots.get(key);
    if (!snapshot || !snapshot.latestUpdatedAt) {
      return originalFetch(input, init).then(function (response) {
        if (!response.ok) return response;
        response.clone().json().then(function (payload) {
          sharedSnapshots.set(key, createSnapshot(payload));
        }).catch(function () {});
        return response;
      });
    }

    var incrementalUrl = new URL(url.href);
    incrementalUrl.searchParams.set("since", snapshot.latestUpdatedAt);
    var baseRequest;
    try {
      baseRequest = input instanceof Request ? input : new Request(url.href, init || {});
    } catch (_) {
      baseRequest = new Request(url.href, { method: "GET", headers: requestHeaders(input, init) });
    }
    var incrementalRequest = new Request(incrementalUrl.href, baseRequest);

    return originalFetch(incrementalRequest).then(function (response) {
      if (!response.ok) return snapshotResponse(snapshot, true);
      return response.clone().json().then(function (payload) {
        mergeSnapshot(snapshot, payload || {});
        return snapshotResponse(snapshot, false);
      }).catch(function () {
        return snapshotResponse(snapshot, true);
      });
    }).catch(function () {
      return snapshotResponse(snapshot, true);
    });
  }

  function cachedEvidence(input, init, key) {
    var cached = evidenceResponses.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response.clone());
    return originalFetch(input, init).then(function (response) {
      if (response.ok) evidenceResponses.set(key, { response: response.clone(), expiresAt: Date.now() + EVIDENCE_TTL_MS });
      return response;
    });
  }

  window.fetch = function (input, init) {
    var url = requestUrl(input);
    if (!url || url.origin !== SUPABASE_ORIGIN) return originalFetch(input, init);

    var method = requestMethod(input, init);
    var headers = requestHeaders(input, init);
    var key = sessionKey(headers);

    if (url.pathname === SHARED_STATE_PATH) {
      if (method === "GET" && !url.searchParams.has("since")) return incrementalSharedState(input, init, url, key);
      return originalFetch(input, init).then(function (response) {
        if (response.ok && method !== "GET") {
          response.clone().json().then(function (payload) {
            var snapshot = sharedSnapshots.get(key);
            if (snapshot) mergeSnapshot(snapshot, payload || {});
          }).catch(function () {});
        }
        return response;
      });
    }

    if (url.pathname === EVIDENCE_PATH) {
      if (method === "GET") return cachedEvidence(input, init, key);
      evidenceResponses.delete(key);
      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  };

  window.__NSL_TRAFFIC_GUARD__ = { version: "114", incrementalSharedState: true };
})();
