(function () {
  const data = window.TenkiData;
  const PLACE_KEY = "tenki.places.v1";
  const FORECAST_TTL = 30 * 60 * 1000;
  const CLIMATE_TTL = 7 * 24 * 60 * 60 * 1000;
  const SOURCES = [
    ["jma", "気象庁発表", "7日先まで", 7],
    ["msm", "気象庁MSM", "4日先まで", 4],
    ["ecmwf", "ECMWF", "15日先まで", 15],
    ["gfs", "GFS", "16日先まで", 16]
  ];

  const state = {
    view: "",
    id: "",
    span: "today",
    monthIndex: 0,
    bundle: null,
    climate: null,
    candidate: null,
    searchToken: 0
  };

  const app = document.querySelector("#app");

  window.addEventListener("hashchange", onRoute);
  onRoute();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  function onRoute() {
    const route = parseHash();
    const samePlace = state.view === route.view && state.id === route.id;
    state.view = route.view;
    state.id = route.id;
    state.span = route.span;
    if (samePlace && route.view === "detail") {
      paintForecast();
      return;
    }
    state.monthIndex = 0;
    state.bundle = null;
    state.climate = null;
    if (route.view === "detail") renderDetail();
    else renderList();
  }

  function parseHash() {
    const parts = (location.hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
    if (parts[0] === "p" && parts[1]) {
      const span = ["today", "tomorrow", "fortnight", "ninety"].indexOf(parts[2]) >= 0 ? parts[2] : "today";
      return { view: "detail", id: decodeURIComponent(parts[1]), span: span };
    }
    return { view: "list", id: "", span: "today" };
  }

  function loadPlaces() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLACE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function savePlaces(places) {
    localStorage.setItem(PLACE_KEY, JSON.stringify(places));
  }

  function cacheKey(kind, place) {
    return "tenki." + kind + ".v1." + Number(place.lat).toFixed(3) + "." + Number(place.lon).toFixed(3);
  }

  function readCache(key, ttl) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (!parsed || Date.now() - parsed.savedAt > ttl) return null;
      return parsed.value;
    } catch (error) {
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: value }));
    } catch (error) {
      /* 保存できなくても表示は続ける */
    }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key];
      if (key === "class") node.className = value;
      else if (key.slice(0, 2) === "on" && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value != null && value !== false) node.setAttribute(key, value);
    });
    [].concat(children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderList() {
    document.title = "天気予報";
    clear(app);
    const places = loadPlaces();
    const list = el("div", { class: "place-list", id: "place-list" });
    app.append(
      el("header", { class: "page-head" }, [
        el("h1", null, "天気予報"),
        el("p", { class: "muted" }, "登録した地点の予報を、出所ごとに並べます。")
      ]),
      el("form", { class: "register", id: "register-form" }, [
        el("h2", null, "地点を登録"),
        el("label", { class: "field" }, ["名前", el("input", { name: "name", type: "text", autocomplete: "off", placeholder: "自宅", required: "required" })]),
        el("label", { class: "field" }, ["地名", el("input", { name: "place", id: "place-query", type: "text", autocomplete: "off", placeholder: "千代田区", required: "required" })]),
        el("div", { id: "suggestions", class: "suggestions" }),
        el("p", { id: "chosen", class: "muted" }),
        el("p", { id: "form-error", class: "error", role: "alert" }),
        el("button", { class: "primary", type: "submit" }, "登録する")
      ]),
      el("section", { class: "saved" }, [
        el("h2", null, "登録した地点"),
        places.length
          ? list
          : el("p", { class: "muted" }, "地点を登録すると、タップするだけで予報を比べられます。"),
        el("p", { class: "muted note" }, "地点はこのスマホのブラウザに保存されます。パソコンの電源は不要です。ブラウザのデータを消すと地点も消えます。")
      ])
    );
    if (places.length) {
      places.forEach(function (place) { list.append(placeButton(place, null)); });
      refreshSummaries(places);
    }
    const form = document.querySelector("#register-form");
    const query = document.querySelector("#place-query");
    let timer = 0;
    query.addEventListener("input", function () {
      state.candidate = null;
      paintChosen();
      clearTimeout(timer);
      const value = query.value;
      timer = setTimeout(function () { runSearch(value); }, 300);
    });
    form.addEventListener("submit", onRegister);
    form.addEventListener("input", function () {
      const error = document.querySelector("#form-error");
      error.textContent = "";
    });
  }

  function placeButton(place, bundle) {
    const today = bundle && bundle.days[data.tokyoToday()];
    const range = today ? data.popRange(today) : "";
    const spread = today ? data.spreadOf(today) : 0;
    const button = el("button", {
      type: "button",
      class: "place",
      onclick: function () { location.hash = "#/p/" + encodeURIComponent(place.id) + "/today"; }
    }, [
      el("span", { class: "place-name" }, place.name),
      el("span", { class: "place-title" }, place.title)
    ]);
    if (range) {
      button.append(el("span", { class: "place-pop" }, "今日の降水 " + range + (spread >= 20 ? "（差あり）" : "")));
    }
    button.dataset.id = place.id;
    return button;
  }

  async function refreshSummaries(places) {
    for (let index = 0; index < places.length; index += 1) {
      const place = places[index];
      try {
        const bundle = await forecastFor(place, false);
        const current = document.querySelector('.place[data-id="' + cssEscape(place.id) + '"]');
        if (!current || state.view !== "list") return;
        current.replaceWith(placeButton(place, bundle));
      } catch (error) {
        /* 一覧の要約が取れなくても地点自体は残す */
      }
    }
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/"/g, "");
  }

  function paintChosen() {
    const chosen = document.querySelector("#chosen");
    if (!chosen) return;
    chosen.textContent = state.candidate ? "選択中: " + state.candidate.title : "";
  }

  async function runSearch(value) {
    const box = document.querySelector("#suggestions");
    if (!box || state.view !== "list") return;
    clear(box);
    if (value.trim().length < 1) return;
    const token = ++state.searchToken;
    box.append(el("p", { class: "muted" }, "地名を検索しています"));
    try {
      const items = await data.searchPlaces(value);
      if (token !== state.searchToken || state.view !== "list") return;
      clear(box);
      if (!items.length) {
        box.append(el("p", { class: "muted" }, "候補がありません。市区町村名で検索してください。"));
        return;
      }
      items.forEach(function (item) {
        box.append(el("button", {
          type: "button",
          class: "suggestion",
          onclick: function () {
            state.candidate = item;
            document.querySelector("#place-query").value = item.title;
            clear(box);
            paintChosen();
          }
        }, item.title));
      });
    } catch (error) {
      if (token !== state.searchToken) return;
      clear(box);
      box.append(el("p", { class: "error" }, "地名を検索できませんでした。通信を確認してもう一度入力してください。"));
    }
  }

  async function onRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("name").trim();
    const error = document.querySelector("#form-error");
    if (!name) {
      error.textContent = "名前を入力してください。";
      return;
    }
    if (!state.candidate) {
      error.textContent = "地名の候補から選んでください。";
      return;
    }
    error.textContent = "地点を登録しています";
    const candidate = state.candidate;
    let area = null;
    try {
      const areas = await data.loadAreas();
      area = data.resolveJma(areas, candidate);
    } catch (fetchError) {
      area = null;
    }
    const place = {
      id: crypto.randomUUID(),
      name: name,
      title: candidate.title,
      lat: candidate.lat,
      lon: candidate.lon,
      officeCode: area ? area.officeCode : "",
      officeName: area ? area.officeName : "",
      class10Code: area ? area.class10Code : "",
      class10Name: area ? area.class10Name : "",
      class20Name: area ? area.class20Name : ""
    };
    const places = loadPlaces();
    places.push(place);
    savePlaces(places);
    state.candidate = null;
    location.hash = "#/p/" + encodeURIComponent(place.id) + "/today";
  }

  function renderDetail() {
    const place = loadPlaces().find(function (item) { return item.id === state.id; });
    clear(app);
    if (!place) {
      document.title = "天気予報";
      app.append(
        el("p", null, "この地点はスマホに保存されていません。"),
        el("a", { class: "back", href: "#/" }, "一覧に戻る")
      );
      return;
    }
    document.title = place.name + "の天気予報";
    app.append(
      el("header", { class: "detail-head" }, [
        el("div", { class: "detail-top" }, [
          el("a", { class: "back", href: "#/" }, "一覧に戻る"),
          el("button", { class: "text-button", type: "button", onclick: function () { refresh(place); } }, "最新にする")
        ]),
        el("h1", null, place.name),
        el("p", { class: "muted" }, place.title + (place.class10Name ? "（" + place.class10Name + "）" : ""))
      ]),
      el("div", { class: "periods", role: "radiogroup", "aria-label": "表示期間" }, [
        periodButton("today", "今日"),
        periodButton("tomorrow", "明日まで"),
        periodButton("fortnight", "2週間"),
        periodButton("ninety", "90日")
      ]),
      el("p", { class: "muted note" }, "気象庁発表は7日先まで。気象庁MSMは約4日先まで。ECMWFは15日先、GFSは16日先まで。17日目以降は平年の統計値です。MSMの右端は降水確率ではなく降水量です。"),
      el("div", { id: "status", role: "status" }),
      el("div", { id: "forecast" }),
      el("footer", { class: "foot" }, [
        el("p", { id: "fetched-at", class: "muted" }),
        el("p", { class: "muted" }, "出典: 気象庁ホームページの予報をもとに作成。数値予報と平年値は Open-Meteo（CC BY 4.0、気象庁MSM、ECMWF、GFS、過去の観測）。"),
        el("button", {
          class: "danger",
          type: "button",
          onclick: function () { removePlace(place); }
        }, "地点を削除")
      ])
    );
    loadDetail(place, false);
  }

function periodButton(value, label) {
  const selected = state.span === value;
  return el("button", {
    type: "button",
    role: "radio",
    class: selected ? "on" : "",
    "data-span": value,
    "aria-checked": selected ? "true" : "false",
    onclick: function () {
      history.replaceState(null, "", "#/p/" + encodeURIComponent(state.id) + "/" + value);
      state.span = value;
      paintForecast();
    }
  }, label);
}

  async function forecastFor(place, force) {
    const key = cacheKey("forecast", place);
    if (!force) {
      const cached = readCache(key, FORECAST_TTL);
      if (cached && cached.days && cached.days[data.tokyoToday()]) return cached;
    }
    const bundle = await data.fetchBundle(place);
    writeCache(key, bundle);
    return bundle;
  }

  async function climateFor(place, force) {
    const key = cacheKey("climate", place);
    if (!force) {
      const cached = readCache(key, CLIMATE_TTL);
      if (cached) return cached;
    }
    const summary = await data.fetchClimate(place);
    writeCache(key, summary);
    return summary;
  }

  async function loadDetail(place, force) {
    const status = document.querySelector("#status");
    if (!status) return;
    status.textContent = "予報を取得しています";
    try {
      state.bundle = await forecastFor(place, force);
      status.textContent = "";
      paintForecast();
      if (state.span === "ninety") ensureClimate(place, force);
    } catch (error) {
      status.textContent = "予報を取得できませんでした。通信を確認して「最新にする」を押してください。";
    }
  }

  async function ensureClimate(place, force) {
    const status = document.querySelector("#status");
    if (!state.climate) {
      if (status && !status.textContent) status.textContent = "平年の統計を取得しています";
      try {
        state.climate = await climateFor(place, force);
        if (status && status.textContent === "平年の統計を取得しています") status.textContent = "";
        if (state.span === "ninety") paintForecast();
      } catch (error) {
        if (status) status.textContent = "平年の統計を取得できませんでした。16日先までの予報は表示しています。";
      }
    }
  }

  function refresh(place) {
    state.bundle = null;
    state.climate = null;
    localStorage.removeItem(cacheKey("forecast", place));
    localStorage.removeItem(cacheKey("climate", place));
    loadDetail(place, true);
  }

  function removePlace(place) {
    if (!confirm(place.name + "を削除しますか？")) return;
    savePlaces(loadPlaces().filter(function (item) { return item.id !== place.id; }));
    localStorage.removeItem(cacheKey("forecast", place));
    localStorage.removeItem(cacheKey("climate", place));
    location.hash = "#/";
  }

  function paintForecast() {
    const root = document.querySelector("#forecast");
    const place = loadPlaces().find(function (item) { return item.id === state.id; });
    if (!root || !place || !state.bundle) return;
    clear(root);
    const stamp = document.querySelector("#fetched-at");
    if (stamp) {
      const when = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(state.bundle.fetchedAt));
      const report = state.bundle.reportDatetime
        ? " 気象庁の発表 " + state.bundle.reportDatetime.replace("T", " ").slice(0, 16)
        : "";
      stamp.textContent = "取得 " + when + report;
    }
    if (state.bundle.errors.length) {
      root.append(el("p", { class: "error" }, state.bundle.errors.join(" ")));
    }
if (state.span === "today" || state.span === "tomorrow") {
    root.append(dayArticle(0, true));
  }
    if (state.span === "today") root.append(hourlyBlock());
    if (state.span === "tomorrow") root.append(dayArticle(1, true));
    if (state.span === "fortnight") {
      root.append(el("h2", null, "今日から14日"));
      for (let index = 0; index < 14; index += 1) root.append(dayArticle(index, false));
    }
    if (state.span === "ninety") {
      root.append(calendarBlock());
      ensureClimate(place, false);
    }
document.querySelectorAll(".periods button").forEach(function (button) {
    const selected = button.dataset.span === state.span;
    button.classList.toggle("on", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
  }

  function dayRecord(index) {
    const date = data.addDays(data.tokyoToday(), index);
    return { date: date, index: index, sources: state.bundle.days[date] || { jma: null, msm: null, ecmwf: null, gfs: null } };
  }

  function dayArticle(index, withWind) {
    const day = dayRecord(index);
    const spread = data.spreadOf(day.sources);
    const head = [el("h3", null, dayTitle(day.date, index))];
    if (spread >= 20) head.push(el("p", null, "降水確率の差 " + spread + "ポイント"));
    const rows = SOURCES.map(function (source) {
      return sourceRow(source, day, withWind);
    });
    return el("article", { class: spread >= 20 ? "day split" : "day" }, [
      el("div", { class: "day-head" }, head),
      el("ul", { class: "sources" }, rows)
    ]);
  }

  function dayTitle(date, index) {
    const parts = date.split("-");
    const label = Number(parts[1]) + "/" + Number(parts[2]) + "（" + data.weekday(date) + "）";
    if (index === 0) return "今日 " + label;
    if (index === 1) return "明日 " + label;
    return label;
  }

  function sourceRow(source, day, withWind) {
    const value = day.sources[source[0]];
    const row = el("li", { class: "source" }, [el("span", { class: "source-name" }, source[1])]);
    if (!value || (value.sky == null && value.hi == null && value.lo == null && value.pop == null)) {
      row.append(el("span", { class: "missing" }, day.index >= source[3] ? source[2] : "データなし"));
      return row;
    }
    const bits = [value.sky || "—"];
    if (value.reliability) bits.push("信頼度" + value.reliability);
    row.append(el("span", { class: "sky" }, bits.join(" ")));
    row.append(el("span", { class: "num" }, tempText(value)));
    row.append(el("span", { class: "num" }, value.pop != null ? value.pop + "%" : (data.mmLabel(value.rainMm) || "—")));
    if (withWind && value.wind) row.append(el("span", { class: "wind" }, value.wind));
    return row;
  }

  function tempText(value) {
    if (value.hi == null && value.lo == null) return "—";
    const hi = value.hi == null ? "—" : Math.round(value.hi) + "°";
    const lo = value.lo == null ? "—" : Math.round(value.lo) + "°";
    return hi + " / " + lo;
  }

  function hourlyBlock() {
    const today = data.tokyoToday();
    const hourNow = data.tokyoHour();
    const hours = (state.bundle.hourly || []).filter(function (hour) {
      return hour.time.slice(0, 10) === today && Number(hour.time.slice(11, 13)) >= hourNow;
    });
    const block = el("section", { class: "hourly" }, [el("h2", null, "今日の1時間ごと（気象庁MSM）")]);
    if (!hours.length) {
      block.append(el("p", { class: "muted" }, "今日の残り時間はありません。"));
      return block;
    }
    block.append(el("ul", { class: "hours" }, hours.map(function (hour) {
      return el("li", { class: "hour" }, [
        el("span", { class: "num" }, hour.time.slice(11, 13) + "時"),
        el("span", { class: "future" }, "これから"),
        el("span", null, hour.sky || "—"),
        el("span", { class: "num" }, hour.temp == null ? "—" : Math.round(hour.temp) + "°"),
        el("span", { class: "num" }, data.mmLabel(hour.rainMm) || "—")
      ]);
    })));
    return block;
  }

  function calendarBlock() {
    const today = data.tokyoToday();
    const months = [];
    for (let index = 0; index < 90; index += 1) {
      const key = data.addDays(today, index).slice(0, 7);
      if (months.indexOf(key) === -1) months.push(key);
    }
    if (state.monthIndex >= months.length) state.monthIndex = 0;
    const month = months[state.monthIndex];
    const grid = el("div", {
      class: "cal",
      role: "grid",
      "aria-label": monthTitle(month) + "。16日先までは数値予報、17日目以降は統計値"
    });
    ["日", "月", "火", "水", "木", "金", "土"].forEach(function (label) {
      grid.append(el("div", { class: "dow", role: "columnheader" }, label));
    });
    const monthStart = month + "-01";
    const monthEnd = data.addDays(addMonth(monthStart), -1);
    const rangeStart = today;
    const rangeEnd = data.addDays(today, 89);
    const viewStart = monthStart > rangeStart ? monthStart : rangeStart;
    const viewEnd = monthEnd < rangeEnd ? monthEnd : rangeEnd;
    const gridStart = data.addDays(viewStart, -dowIndex(viewStart));
    const gridEnd = data.addDays(viewEnd, 6 - dowIndex(viewEnd));
    for (let date = gridStart; date <= gridEnd; date = data.addDays(date, 1)) {
      const inRange = date >= rangeStart && date <= rangeEnd && date.slice(0, 7) === month;
      if (!inRange) {
        grid.append(el("div", { class: "cell out", role: "gridcell", "aria-label": "このマスは表示中の月の対象外です" }, "範囲外"));
        continue;
      }
      grid.append(calendarCell(date));
    }
    const edge = state.monthIndex === 0 ? "先頭の月です" : state.monthIndex === months.length - 1 ? "最後の月です" : "";
    return el("section", { class: "ninety" }, [
      el("div", { class: "monthbar" }, [
        el("button", {
          type: "button",
          disabled: state.monthIndex === 0 ? "disabled" : null,
          onclick: function () {
            if (state.monthIndex > 0) {
              state.monthIndex -= 1;
              paintForecast();
            }
          }
        }, "前の月"),
        el("p", { "aria-live": "polite" }, monthTitle(month)),
        el("button", {
          type: "button",
          disabled: state.monthIndex === months.length - 1 ? "disabled" : null,
          onclick: function () {
            if (state.monthIndex < months.length - 1) {
              state.monthIndex += 1;
              paintForecast();
            }
          }
        }, "次の月")
      ]),
      edge ? el("p", { class: "muted" }, edge) : null,
      grid,
      el("ul", { class: "legend" }, [
        el("li", null, [el("span", { class: "key" }, "14/5"), "最高/最低（℃）。16日先まではECMWFの例"]),
        el("li", null, [el("span", { class: "key split-key" }, "差"), "降水確率が20ポイント以上離れている日"]),
        el("li", null, [el("span", { class: "key stat-key" }, "統計"), "17日目以降の平年値。同じ日付の直近10年"])
      ])
    ]);
  }

  function calendarCell(date) {
    const index = daysBetween(data.tokyoToday(), date);
    const cell = el("div", { role: "gridcell" });
    const dayNumber = String(Number(date.slice(8, 10)));
    if (index <= 15) {
      const sources = (state.bundle.days[date]) || {};
      const lead = sources.ecmwf || sources.gfs || sources.msm || sources.jma;
      const spread = data.spreadOf(sources);
      cell.className = spread >= 20 ? "cell split" : "cell";
      cell.append(el("span", null, dayNumber));
      cell.append(el("span", { class: "num" }, lead && lead.hi != null ? Math.round(lead.hi) + "/" + Math.round(lead.lo) : "—"));
      if (spread >= 20) cell.append(el("span", { class: "num" }, "差" + spread));
      cell.setAttribute("aria-label", Number(date.slice(5, 7)) + "月" + dayNumber + "日の数値予報。降水確率の差は" + spread + "ポイント。");
      return cell;
    }
    const climate = state.climate && state.climate[date.slice(5)];
    cell.className = "cell stat";
    cell.append(el("span", null, dayNumber));
    if (!climate) {
      cell.append(el("span", null, "統計"));
      cell.setAttribute("aria-label", Number(date.slice(5, 7)) + "月" + dayNumber + "日の統計値はまだ取得できていません。");
      return cell;
    }
    cell.append(el("span", { class: "num" }, climate.hi + "/" + climate.lo));
    cell.append(el("span", { class: "num" }, climate.rain));
    cell.append(el("span", null, "統計"));
    cell.setAttribute("aria-label", Number(date.slice(5, 7)) + "月" + dayNumber + "日は統計値。平年の最高" + climate.hi + "度、最低" + climate.lo + "度、" + climate.rain + "。");
    return cell;
  }

  function monthTitle(month) {
    const parts = month.split("-");
    return Number(parts[0]) + "年" + Number(parts[1]) + "月";
  }

  function addMonth(ymd) {
    const parts = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.toISOString().slice(0, 10);
  }

function dowIndex(ymd) {
  const index = "日月火水木金土".indexOf(data.weekday(ymd));
  return index < 0 ? 0 : index;
}

  function daysBetween(start, end) {
    const a = Date.parse(start + "T00:00:00Z");
    const b = Date.parse(end + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
  }
})();
