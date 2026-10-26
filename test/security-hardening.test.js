const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");

const root = pathToFileURL(`${__dirname}\\..\\`);

function read(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

test("security headers keep browser capabilities on the same origin", () => {
  const headers = read("public/_headers");

  assert.match(headers, /Strict-Transport-Security: max-age=31536000/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.match(headers, /worker-src 'self'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.doesNotMatch(headers, /img-src 'self' data:/);
});

test("saved counter state is bounded and projected onto known fields", () => {
  const counter = read("public/counter/counter.js");

  assert.match(counter, /MAX_SAVED_STATE_LENGTH = 2_000_000/);
  assert.match(counter, /savedText\.length <= MAX_SAVED_STATE_LENGTH/);
  assert.match(counter, /!Array\.isArray\(saved\)/);
  assert.match(counter, /function normalizeName\(value, fallback\)/);
  assert.match(counter, /Object\.prototype\.hasOwnProperty\.call\(saved, key\)/);
  assert.doesNotMatch(counter, /state = \{ \.\.\.state, \.\.\.saved \}/);
  assert.doesNotMatch(counter, /\.innerHTML\s*=/);
});

test("malformed saved names cannot expand the persisted state shape", () => {
  const counter = read("public/counter/counter.js").replaceAll("\r\n", "\n");
  const initialization = counter.slice(
    0,
    counter.indexOf("/* ==================================================\n   保存")
  );
  const saved = {
    nameA: "  12345678901234567890  ",
    unassignedA: [1],
    unassignedB: [0],
    inningsA: [[2]],
    inningsB: [[0]],
    inning: 1,
    inningA: 1,
    inningB: 1,
    overflowA: {
      count: { toString: 1 },
      discarded: { valueOf: 1 }
    },
    unknownField: "must be dropped"
  };
  const context = {
    console,
    localStorage: {
      getItem: () => JSON.stringify(saved)
    }
  };

  vm.runInNewContext(
    `${initialization}\n;globalThis.__state = state;`,
    context
  );

  assert.equal(context.__state.nameA, "123456789012");
  assert.equal(context.__state.nameB, "3塁側");
  assert.equal(context.__state.unknownField, undefined);
});

test("count normalization rejects object coercion and accepts bounded numeric values", () => {
  const counter = read("public/counter/counter.js").replaceAll("\r\n", "\n");
  const normalizeSource = counter.slice(
    0,
    counter.indexOf("state.inning = Math.max")
  );
  const context = {
    console,
    localStorage: { getItem: () => null }
  };

  vm.runInNewContext(
    `${normalizeSource}\n;globalThis.__normalizeCount = normalizeCount;`,
    context
  );

  assert.equal(context.__normalizeCount({ toString: 1 }), 0);
  assert.equal(context.__normalizeCount(true), 0);
  assert.equal(context.__normalizeCount("12"), 12);
  assert.equal(context.__normalizeCount(2_000), 999);
});

test("service worker caches only the declared shell and same path responses", () => {
  const serviceWorker = read("public/counter/sw.js");

  assert.match(serviceWorker, /const APP_SHELL_URLS = new Set/);
  assert.match(serviceWorker, /url\.href/);
  assert.match(serviceWorker, /url\.origin === self\.location\.origin/);
  assert.match(serviceWorker, /responseUrl\.origin === self\.location\.origin/);
  assert.match(serviceWorker, /requestUrl\.pathname !== responseUrl\.pathname/);
  assert.match(serviceWorker, /url\.pathname !== "\/counter\/"/);
  assert.match(serviceWorker, /key\.startsWith\("pitch-counter-shell-"\)/);
  assert.match(serviceWorker, /caches\.open\(CACHE_NAME\)/);
  assert.doesNotMatch(serviceWorker, /caches\.match\(/);
});

test("service worker does not let an asset navigation replace the app shell", async () => {
  const serviceWorker = read("public/counter/sw.js");
  const handlers = {};
  const cachedRequests = [];
  const cacheEntries = new Map([
    ["pitch-counter-shell-v59", new Map()],
    [
      "other-cache",
      new Map([
        ["/counter/", new Response("poison")],
        [
          "https://example.test/counter/counter.js?v=49",
          new Response("poison")
        ]
      ])
    ]
  ]);
  const cacheKey = (request) =>
    typeof request === "string" ? request : request.url;
  const namedCache = {
    match: async (request) =>
      cacheEntries.get("pitch-counter-shell-v59").get(cacheKey(request)) || null,
    put: async (request, response) => {
      const key = cacheKey(request);
      cachedRequests.push(key);
      cacheEntries.get("pitch-counter-shell-v59").set(key, response);
    }
  };
  const otherCache = {
    match: async (request) =>
      cacheEntries.get("other-cache").get(cacheKey(request)) || null
  };
  const cache = {
    match: async () => {
      throw new Error("global CacheStorage.match must not be used");
    },
    open: async (name) =>
      name === "pitch-counter-shell-v59" ? namedCache : otherCache,
    keys: async () => [],
    delete: async () => true
  };
  let failFetch = false;
  const responseFor = (path, body = "network") => {
    const response = new Response(body, { status: 200 });
    Object.defineProperty(response, "url", {
      value: `https://example.test${path}`
    });
    return response;
  };
  const context = {
    Response,
    Request,
    URL,
    console,
    fetch: async (request) => {
      if (failFetch) {
        throw new Error("offline");
      }

      return responseFor(new URL(request.url).pathname);
    },
    caches: cache,
    self: {
      location: { origin: "https://example.test" },
      addEventListener: (type, handler) => {
        handlers[type] = handler;
      },
      clients: { claim: async () => undefined },
      skipWaiting: async () => undefined
    }
  };

  vm.runInNewContext(serviceWorker, context);

  let assetNavigationResponse;
  handlers.fetch({
    request: {
      url: "https://example.test/assets/install-iphone-share.png",
      method: "GET",
      mode: "navigate"
    },
    respondWith: (response) => {
      assetNavigationResponse = response;
    },
    waitUntil: () => undefined
  });

  assert.equal(assetNavigationResponse, undefined);

  let tamperedAssetResponse;
  handlers.fetch({
    request: {
      url: "https://example.test/counter/counter.js?tampered=1",
      method: "GET",
      mode: "same-origin"
    },
    respondWith: (response) => {
      tamperedAssetResponse = response;
    },
    waitUntil: () => undefined
  });

  assert.equal(tamperedAssetResponse, undefined);

  let shellResponse;
  const pendingWrites = [];
  handlers.fetch({
    request: {
      url: "https://example.test/counter/",
      method: "GET",
      mode: "navigate"
    },
    respondWith: (response) => {
      shellResponse = response;
    },
    waitUntil: (promise) => {
      pendingWrites.push(promise);
    }
  });

  await shellResponse;
  await Promise.all(pendingWrites);
  assert.deepEqual(cachedRequests, ["/counter/"]);

  cacheEntries
    .get("pitch-counter-shell-v59")
    .set(
      "https://example.test/counter/counter.js?v=49",
      new Response("trusted-cache")
    );
  failFetch = true;
  let offlineAssetResponse;
  handlers.fetch({
    request: {
      url: "https://example.test/counter/counter.js?v=49",
      method: "GET",
      mode: "same-origin"
    },
    respondWith: (response) => {
      offlineAssetResponse = response;
    },
    waitUntil: () => undefined
  });

  const offlineAsset = await offlineAssetResponse;
  assert.equal(offlineAsset.status, 200);
  assert.equal(await offlineAsset.text(), "trusted-cache");
});

test("dependency metadata uses one pinned pnpm lockfile", () => {
  const packageJson = JSON.parse(read("package.json"));
  const lockfile = read("pnpm-lock.yaml");

  assert.equal(packageJson.devDependencies.wrangler, "4.152.0");
  assert.equal(packageJson.packageManager, "pnpm@10.26.0");
  assert.equal(packageJson.pnpm.overrides.undici, "7.30.1");
  assert.match(lockfile, /specifier: 4\.152\.0/);
  assert.match(lockfile, /version: 4\.152\.0/);
  assert.match(lockfile, /undici: 7\.30\.1/);
  assert.match(lockfile, /undici@7\.30\.1/);
  assert.equal(existsSync(new URL("package-lock.json", root)), false);
});
