(() => {
  "use strict";

  let priceInput = null;
  let lastSavedPrice = null;
  let lastSavedDirection = null;
  let pollInterval = null;
  let bootstrapInterval = null;
  let directionObserver = null;

  // ──────────────────────────────────────────────
  // Price Input 찾기
  // ──────────────────────────────────────────────

  function findPriceInput() {
    // 1. id가 "limitPrice"로 시작 (가장 정확: id="limitPrice-435")
    const byId = document.querySelector('input[id^="limitPrice"]');
    if (byId) return byId;

    // 2. class="bn-textField-input" + inputmode="numeric"
    const byClass = document.querySelector(
      'input.bn-textField-input[inputmode="numeric"]',
    );
    if (byClass) return byClass;

    // 3. "Price" 라벨 텍스트에서 인접 input 탐색
    for (const node of document.querySelectorAll("div, span, label")) {
      if (node.children.length === 0 && node.textContent.trim() === "Price") {
        let parent = node.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!parent) break;
          const inp = parent.querySelector(
            'input[inputmode="numeric"], input[type="text"]',
          );
          if (inp && inp !== node) return inp;
          parent = parent.parentElement;
        }
      }
    }

    // 4. "USDT" 인접 input 탐색
    for (const node of document.querySelectorAll("*")) {
      if (node.children.length === 0 && node.textContent.trim() === "USDT") {
        let parent = node.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!parent) break;
          const inp = parent.querySelector("input");
          if (inp && inp.type !== "hidden") return inp;
          parent = parent.parentElement;
        }
      }
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // 방향 감지 (Long / Short)
  // ──────────────────────────────────────────────

  function detectDirection() {
    // 1. role="tab" aria-selected
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      if (tab.getAttribute("aria-selected") !== "true") continue;
      const t = tab.textContent.trim().toLowerCase();
      if (t.startsWith("buy")) return "long";
      if (t.startsWith("sell")) return "short";
    }

    // 2. button class active/selected
    for (const btn of document.querySelectorAll("button")) {
      const t = btn.textContent.trim().toLowerCase();
      if (t !== "buy" && t !== "sell") continue;
      if (/active|selected|primary/i.test(btn.className)) {
        return t === "buy" ? "long" : "short";
      }
    }

    // 3. 배경색으로 판단
    for (const btn of document.querySelectorAll("button")) {
      const t = btn.textContent.trim().toLowerCase();
      if (t !== "buy" && t !== "sell") continue;
      const bg = getComputedStyle(btn).backgroundColor;
      if (/14,\s*203,\s*129/.test(bg)) return "long"; // #0ECB81
      if (/246,\s*70,\s*93/.test(bg)) return "short"; // #F6465D
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // Storage 저장
  // ──────────────────────────────────────────────

  function isContextValid() {
    try { return !!chrome.runtime.id; } catch { return false; }
  }

  function saveIfChanged(price, direction) {
    if (!isContextValid()) { stopPolling(); return; }
    if (price === lastSavedPrice && direction === lastSavedDirection) return;
    lastSavedPrice = price;
    lastSavedDirection = direction;
    console.log("[SL/TP] save →", { price, direction });
    try {
      chrome.storage.local.set({ price, direction, updatedAt: Date.now() });
    } catch { stopPolling(); }
  }

  // ──────────────────────────────────────────────
  // 폴링: 300ms마다 값 체크
  // ──────────────────────────────────────────────

  function startPolling(input) {
    if (pollInterval) clearInterval(pollInterval);
    console.log("[SL/TP] polling started on:", input);

    pollInterval = setInterval(() => {
      // input이 DOM에서 사라진 경우 → 재탐색
      if (!document.contains(input)) {
        console.log("[SL/TP] input removed, restarting...");
        stopPolling();
        priceInput = null;
        startBootstrap();
        return;
      }

      const raw = input.value.replace(/,/g, "");
      const val = parseFloat(raw);
      const price = !isNaN(val) && val > 0 ? input.value : null;
      const direction = detectDirection();
      saveIfChanged(price, direction);
    }, 300);

    // 방향 변화는 즉시 반영 (Observer)
    if (directionObserver) directionObserver.disconnect();
    directionObserver = new MutationObserver(() => {
      const direction = detectDirection();
      if (direction !== lastSavedDirection) {
        lastSavedDirection = direction;
        chrome.storage.local.set({
          price: lastSavedPrice,
          direction,
          updatedAt: Date.now(),
        });
      }
    });
    directionObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected", "class"],
    });
  }

  // context 무효화 감지 → 모든 interval 정리
  const contextCheckInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(contextCheckInterval);
      stopPolling();
      if (bootstrapInterval) { clearInterval(bootstrapInterval); }
    }
  }, 2000);

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (directionObserver) {
      directionObserver.disconnect();
      directionObserver = null;
    }
  }

  // ──────────────────────────────────────────────
  // Bootstrap: input이 렌더링될 때까지 대기
  // ──────────────────────────────────────────────

  function startBootstrap() {
    if (bootstrapInterval) clearInterval(bootstrapInterval);
    console.log("[SL/TP] bootstrap: waiting for price input...");

    bootstrapInterval = setInterval(() => {
      const input = findPriceInput();
      if (input) {
        clearInterval(bootstrapInterval);
        bootstrapInterval = null;
        priceInput = input;
        console.log("[SL/TP] price input found:", input.id, input.className);
        startPolling(input);
      }
    }, 800);
  }

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────

  function init() {
    stopPolling();
    const input = findPriceInput();
    if (input) {
      priceInput = input;
      console.log("[SL/TP] init: found immediately", input.id);
      startPolling(input);
    } else {
      startBootstrap();
    }
  }

  // SPA 네비게이션 처리
  const reInit = () => {
    stopPolling();
    priceInput = null;
    setTimeout(init, 600);
  };
  window.addEventListener("popstate", reInit);
  window.addEventListener("hashchange", reInit);

  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState = (...a) => {
    _push(...a);
    reInit();
  };
  history.replaceState = (...a) => {
    _replace(...a);
    reInit();
  };

  init();
})();
