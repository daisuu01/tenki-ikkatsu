(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TenkiData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PREFS = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
  ].sort(function (a, b) { return b.length - a.length; });

  const WIND_DIRS = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];

  const JMA_CODES = {
    100: "晴", 101: "晴時々曇", 102: "晴一時雨", 103: "晴時々雨", 104: "晴一時雪",
    105: "晴時々雪", 106: "晴一時雨か雪", 107: "晴時々雨か雪", 108: "晴一時雷雨",
    110: "晴後時々曇", 111: "晴後曇", 112: "晴後一時雨", 113: "晴後時々雨", 114: "晴後雨",
    115: "晴後一時雪", 116: "晴後時々雪", 117: "晴後雪", 118: "晴後雨か雪", 119: "晴後雷雨",
    120: "晴朝夕一時雨", 121: "晴朝一時雨", 122: "晴夕方一時雨", 123: "晴山沿い雷雨",
    124: "晴山沿い雪", 125: "晴午後雷雨", 126: "晴昼から雨", 127: "晴夕方から雨",
    128: "晴夜は雨", 130: "朝霧後晴", 131: "晴明け方霧", 132: "晴朝夕曇",
    140: "晴時々雨雷", 160: "晴一時雪か雨", 170: "晴時々雪か雨", 181: "晴後雪か雨",
    200: "曇", 201: "曇時々晴", 202: "曇一時雨", 203: "曇時々雨", 204: "曇一時雪",
    205: "曇時々雪", 206: "曇一時雨か雪", 207: "曇時々雨か雪", 208: "曇一時雷雨", 209: "霧",
    210: "曇後時々晴", 211: "曇後晴", 212: "曇後一時雨", 213: "曇後時々雨", 214: "曇後雨",
    215: "曇後一時雪", 216: "曇後時々雪", 217: "曇後雪", 218: "曇後雨か雪", 219: "曇後雷雨",
    220: "曇朝夕一時雨", 221: "曇朝一時雨", 222: "曇夕方一時雨", 223: "曇日中時々晴",
    224: "曇昼から雨", 225: "曇夕方から雨", 226: "曇夜は雨", 228: "曇昼から雪",
    229: "曇夕方から雪", 230: "曇夜は雪", 231: "曇海岸は霧", 240: "曇時々雨雷",
    250: "曇時々雪雷", 260: "曇一時雪か雨", 270: "曇時々雪か雨", 281: "曇後雪か雨",
    300: "雨", 301: "雨時々晴", 302: "雨時々止む", 303: "雨時々雪", 304: "雨か雪",
    306: "大雨", 308: "雨で暴風", 309: "雨一時雪", 311: "雨後晴", 313: "雨後曇",
    314: "雨後時々雪", 315: "雨後雪", 316: "雨か雪後晴", 317: "雨か雪後曇",
    320: "朝雨後晴", 321: "朝雨後曇", 322: "雨朝晩一時雪", 323: "雨昼から晴",
    324: "雨夕方から晴", 325: "雨夜は晴", 326: "雨夕方から雪", 327: "雨夜は雪",
    328: "雨一時強く", 329: "雨一時みぞれ", 340: "雪か雨", 350: "雨で雷",
    361: "雪か雨後晴", 371: "雪か雨後曇",
    400: "雪", 401: "雪時々晴", 402: "雪時々止む", 403: "雪時々雨", 405: "大雪",
    406: "風雪強い", 407: "暴風雪", 409: "雪一時雨", 411: "雪後晴", 413: "雪後曇",
    414: "雪後雨", 420: "朝雪後晴", 421: "朝雪後曇", 422: "雪昼から雨",
    423: "雪夕方から雨", 425: "雪一時強く", 426: "雪後みぞれ", 427: "雪一時みぞれ",
    450: "雪で雷"
  };

  function tokyoToday(now) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now || new Date());
  }

  function tokyoHour(now) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now || new Date());
    return Number(parts.find(function (part) { return part.type === "hour"; }).value);
  }

  function addDays(ymd, days) {
    const parts = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function weekday(ymd) {
    const label = new Intl.DateTimeFormat("ja-JP", {
      weekday: "short",
      timeZone: "Asia/Tokyo"
    }).format(new Date(ymd + "T12:00:00+09:00"));
    return label.replace("曜日", "").replace("曜", "");
  }

  function cleanText(text) {
    return String(text).replace(/\u3000/g, " ").replace(/\s+/g, " ").trim()
      .replaceAll("くもり", "曇").replaceAll("晴れ", "晴");
  }

  function numberOrNull(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function wmoSky(code) {
    if (code == null) return null;
    if (code === 0 || code === 1) return "晴";
    if (code === 2) return "晴時々曇";
    if (code === 3) return "曇";
    if (code === 45 || code === 48) return "霧";
    if (code >= 51 && code <= 57) return "霧雨";
    if (code >= 61 && code <= 67) return "雨";
    if (code >= 71 && code <= 77) return "雪";
    if (code >= 80 && code <= 82) return "にわか雨";
    if (code === 85 || code === 86) return "にわか雪";
    if (code >= 95) return "雷雨";
    return "曇";
  }

  function jmaSky(code) {
    if (code == null || code === "") return null;
    return JMA_CODES[Number(code)] || null;
  }

  function windFromDegrees(speed, direction) {
    if (speed == null && direction == null) return null;
    const name = direction == null ? "" : WIND_DIRS[Math.round(Number(direction) / 22.5) % 16];
    const speedLabel = speed == null ? "" : Math.round(Number(speed)) + "m/s";
    return [name, speedLabel].filter(Boolean).join(" ");
  }

  function mmLabel(value) {
    if (value == null) return null;
    if (value < 0.05) return "0mm";
    const rounded = Math.round(value * 10) / 10;
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + "mm";
  }

  function alignToEnd(times, values) {
    const list = values || [];
    const offset = Math.max(0, times.length - list.length);
    return times.map(function (time, index) {
      return { time: time, value: index < offset ? null : list[index - offset] };
    });
  }

  function selectArea(areas, wanted) {
    if (!areas || !areas.length) return null;
    const byCode = areas.find(function (area) { return wanted.code && area.area.code === wanted.code; });
    if (byCode) return byCode;
    const byName = areas.find(function (area) { return wanted.name && area.area.name === wanted.name; });
    return byName || null;
  }

  function chainOf(areas, class20Code) {
    const city = areas.class20s[class20Code];
    const middle = areas.class15s[city.parent];
    const region = areas.class10s[middle.parent];
    const office = areas.offices[region.parent];
    return {
      officeCode: region.parent,
      officeName: office.name,
      class10Code: middle.parent,
      class10Name: region.name,
      class20Name: city.name
    };
  }

  function resolveJma(areas, candidate) {
    const cities = areas.class20s;
    let code = "";
    if (candidate.addressCode && String(candidate.addressCode).length >= 5) {
      const prefix = String(candidate.addressCode).slice(0, 5);
      const keys = Object.keys(cities).filter(function (key) { return key.startsWith(prefix); });
      keys.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
      code = keys[0] || "";
    }
    if (!code) {
      const pref = PREFS.find(function (name) { return candidate.title.startsWith(name); });
      const rest = pref ? candidate.title.slice(pref.length) : candidate.title;
      const scored = Object.keys(cities).map(function (key) {
        return { key: key, score: scoreName(rest, cities[key].name), link: chainOf(areas, key) };
      }).filter(function (item) { return item.score > 0; });
      scored.sort(function (a, b) { return b.score - a.score || b.link.class20Name.length - a.link.class20Name.length; });
      const best = scored.length ? scored[0].score : 0;
      let pool = scored.filter(function (item) { return item.score === best; });
      if (pref) {
        const inPref = pool.filter(function (item) { return item.link.officeName === pref; });
        if (inPref.length) pool = inPref;
      }
      code = pool.length ? pool[0].key : "";
    }
    return code ? chainOf(areas, code) : null;
  }

  function scoreName(rest, name) {
    if (!rest || !name) return 0;
    if (rest === name) return 1000 + name.length;
    if (rest.startsWith(name) && name.length >= 2) return 800 + name.length;
    const city = rest.match(/^(.+?市)/);
    if (city && name.startsWith(city[1]) && city[1].length >= 2) return 400 + city[1].length;
    return 0;
  }

  async function loadAreas(fetcher) {
    const response = await (fetcher || fetch)("https://www.jma.go.jp/bosai/common/const/area.json");
    if (!response.ok) throw new Error("地域表を取得できませんでした。");
    return response.json();
  }

  async function searchPlaces(query, fetcher) {
    const q = query.trim();
    if (!q) return [];
    const get = fetcher || fetch;
    try {
      const response = await get("https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(q));
      if (response.ok) {
        const data = await response.json();
        const rows = Array.isArray(data) ? data : [];
        const items = rows.slice(0, 6).map(function (feature) {
          return {
            title: feature.properties.title,
            lat: feature.geometry.coordinates[1],
            lon: feature.geometry.coordinates[0],
            addressCode: feature.properties.addressCode || ""
          };
        }).filter(function (item) { return Number.isFinite(item.lat) && Number.isFinite(item.lon); });
        if (items.length) return items;
      }
    } catch (error) {
      /* 国土地理院が使えないときは別の地名検索に進む */
    }
    const response = await get("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(q) + "&count=6&language=ja&format=json");
    if (!response.ok) throw new Error("地名を検索できませんでした。");
    const data = await response.json();
    return (data.results || []).filter(function (item) { return item.country_code === "JP"; }).map(function (item) {
      const title = item.admin1 && item.name && item.name.indexOf(item.admin1) !== 0
        ? item.admin1 + item.name
        : (item.name || q);
      return { title: title, lat: item.latitude, lon: item.longitude, addressCode: "" };
    });
  }

  function putDaily(bucket, date, key, value) {
    if (!value) return;
    if (!bucket[date]) bucket[date] = {};
    bucket[date][key] = value;
  }

function at(daily, key, index) {
  const list = daily[key];
  return list ? list[index] : null;
}

function readModel(daily, model, index) {
  const sky = wmoSky(at(daily, "weather_code_" + model, index));
  const hi = numberOrNull(at(daily, "temperature_2m_max_" + model, index));
  const lo = numberOrNull(at(daily, "temperature_2m_min_" + model, index));
  const pop = numberOrNull(at(daily, "precipitation_probability_max_" + model, index));
  const rain = numberOrNull(at(daily, "precipitation_sum_" + model, index));
  const wind = windFromDegrees(
    at(daily, "wind_speed_10m_max_" + model, index),
    at(daily, "wind_direction_10m_dominant_" + model, index)
  );
    if (sky == null && hi == null && lo == null && pop == null && rain == null) return null;
    return { sky: sky, hi: hi, lo: lo, pop: pop, rainMm: rain, wind: wind };
  }

  async function fetchOpenMeteo(place, fetcher) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(place.lat));
    url.searchParams.set("longitude", String(place.lon));
    url.searchParams.set("timezone", "Asia/Tokyo");
    url.searchParams.set("forecast_days", "16");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("precipitation_unit", "mm");
    url.searchParams.set("models", "jma_msm,ecmwf_ifs,gfs_seamless");
    url.searchParams.set("daily", [
      "weather_code", "temperature_2m_max", "temperature_2m_min",
      "precipitation_probability_max", "precipitation_sum",
      "wind_speed_10m_max", "wind_direction_10m_dominant"
    ].join(","));
    url.searchParams.set("hourly", "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m");
    const response = await (fetcher || fetch)(url);
    if (!response.ok) throw new Error("数値予報を取得できませんでした。");
    const data = await response.json();
    const days = {};
    data.daily.time.forEach(function (date, index) {
      putDaily(days, date, "msm", readModel(data.daily, "jma_msm", index));
      putDaily(days, date, "ecmwf", readModel(data.daily, "ecmwf_ifs", index));
      putDaily(days, date, "gfs", readModel(data.daily, "gfs_seamless", index));
    });
    const hourly = data.hourly.time.map(function (time, index) {
      return {
        time: time,
        sky: wmoSky(data.hourly.weather_code_jma_msm[index]),
        temp: numberOrNull(data.hourly.temperature_2m_jma_msm[index]),
        rainMm: numberOrNull(data.hourly.precipitation_jma_msm[index]),
        wind: windFromDegrees(data.hourly.wind_speed_10m_jma_msm[index], data.hourly.wind_direction_10m_jma_msm[index])
      };
    }).filter(function (hour) { return hour.sky != null || hour.temp != null; });
    return { days: days, hourly: hourly };
  }

  function absorbJma(days, payload, place) {
    const wanted = { code: place.class10Code, name: place.class10Name };
    payload.forEach(function (block) {
(block.timeSeries || []).forEach(function (series) {
      const sample = series.areas && series.areas[0];
      const isTemp = sample && (sample.temps || sample.tempsMax || sample.tempsMin);
      const area = selectArea(series.areas, wanted) || (isTemp ? sample : null);
      if (!area) return;
        if (area.weathers || (area.weatherCodes && !area.pops && !area.tempsMax)) {
          alignToEnd(series.timeDefines, area.weathers).forEach(function (item, index) {
            const date = item.time.slice(0, 10);
            const code = alignToEnd(series.timeDefines, area.weatherCodes)[index].value;
            const wind = area.winds ? alignToEnd(series.timeDefines, area.winds)[index].value : null;
            const current = days[date] && days[date].jma;
            const sky = item.value ? cleanText(item.value) : jmaSky(code);
            if (!sky && !wind) return;
            putDaily(days, date, "jma", Object.assign({}, current, {
              sky: sky || (current && current.sky) || null,
              hi: current ? current.hi : null,
              lo: current ? current.lo : null,
              pop: current ? current.pop : null,
              wind: wind ? cleanText(wind) : (current && current.wind) || null,
              reliability: current ? current.reliability : null
            }));
          });
        } else if (area.pops && area.weatherCodes) {
          const codes = alignToEnd(series.timeDefines, area.weatherCodes);
          const pops = alignToEnd(series.timeDefines, area.pops);
          const trusts = alignToEnd(series.timeDefines, area.reliabilities || []);
          codes.forEach(function (item, index) {
            const date = item.time.slice(0, 10);
            const current = (days[date] && days[date].jma) || {};
            const pop = numberOrNull(pops[index].value);
            putDaily(days, date, "jma", {
              sky: current.sky || jmaSky(item.value),
              hi: current.hi != null ? current.hi : null,
              lo: current.lo != null ? current.lo : null,
              pop: current.pop != null ? current.pop : pop,
              wind: current.wind || null,
              reliability: trusts[index] && trusts[index].value ? trusts[index].value : current.reliability || null
            });
          });
        } else if (area.pops) {
          const grouped = {};
          alignToEnd(series.timeDefines, area.pops).forEach(function (item) {
            const pop = numberOrNull(item.value);
            if (pop == null) return;
            const date = item.time.slice(0, 10);
            grouped[date] = grouped[date] == null ? pop : Math.max(grouped[date], pop);
          });
          Object.keys(grouped).forEach(function (date) {
            const current = (days[date] && days[date].jma) || {};
            putDaily(days, date, "jma", Object.assign({
              sky: null, hi: null, lo: null, wind: null, reliability: null
            }, current, { pop: grouped[date] }));
          });
        } else if (area.temps) {
          alignToEnd(series.timeDefines, area.temps).forEach(function (item) {
            const temp = numberOrNull(item.value);
            if (temp == null) return;
            const date = item.time.slice(0, 10);
            const hour = Number(item.time.slice(11, 13));
            const current = (days[date] && days[date].jma) || {};
            const next = Object.assign({
              sky: null, hi: null, lo: null, pop: null, wind: null, reliability: null
            }, current);
            if (hour < 6) next.lo = temp;
            else next.hi = temp;
            putDaily(days, date, "jma", next);
          });
        } else if (area.tempsMax || area.tempsMin) {
          const dates = series.timeDefines.map(function (time) { return time.slice(0, 10); });
          dates.forEach(function (date, index) {
            const current = (days[date] && days[date].jma) || {};
            const hi = numberOrNull(area.tempsMax && area.tempsMax[index]);
            const lo = numberOrNull(area.tempsMin && area.tempsMin[index]);
            putDaily(days, date, "jma", Object.assign({
              sky: null, pop: null, wind: null, reliability: null
            }, current, {
              hi: current.hi != null ? current.hi : hi,
              lo: current.lo != null ? current.lo : lo
            }));
          });
        }
      });
    });
    const report = payload.map(function (block) { return block.reportDatetime; }).filter(Boolean).sort();
    return report.length ? report[report.length - 1] : null;
  }

  function pickTempSeries(block, place) {
    return (block.timeSeries || []).map(function (series) {
      const sample = series.areas && series.areas[0];
      if (!sample || !sample.temps && !sample.tempsMax) return series;
      const hints = [place.class20Name, place.title, place.class10Name].filter(Boolean);
      const area = series.areas.find(function (item) {
        return item.area.name.length >= 2 && hints.some(function (hint) {
          return hint.indexOf(item.area.name) !== -1;
        });
      });
      if (!area) return series;
      return Object.assign({}, series, { areas: [area].concat(series.areas.filter(function (item) { return item !== area; })) });
    });
  }

  async function fetchJma(place, fetcher) {
    const response = await (fetcher || fetch)("https://www.jma.go.jp/bosai/forecast/data/forecast/" + place.officeCode + ".json");
    if (!response.ok) throw new Error("気象庁の発表を取得できませんでした。");
    const payload = await response.json();
    payload.forEach(function (block, index) {
      payload[index] = Object.assign({}, block, { timeSeries: pickTempSeries(block, place) });
    });
    return payload;
  }

  async function fetchBundle(place, fetcher) {
    const today = tokyoToday();
    const dates = Array.from({ length: 16 }, function (_, index) { return addDays(today, index); });
    const errors = [];
    const [models, announcement] = await Promise.all([
      fetchOpenMeteo(place, fetcher).catch(function (error) {
        errors.push(error.message || "数値予報を取得できませんでした。");
        return { days: {}, hourly: [] };
      }),
      place.officeCode
        ? fetchJma(place, fetcher).catch(function (error) {
          errors.push(error.message || "気象庁の発表を取得できませんでした。");
          return null;
        })
        : Promise.resolve(null)
    ]);
    const days = {};
    dates.forEach(function (date) {
      days[date] = Object.assign({ jma: null, msm: null, ecmwf: null, gfs: null }, models.days[date]);
    });
    let reportDatetime = null;
    if (announcement) reportDatetime = absorbJma(days, announcement, place);
    if (!place.officeCode) errors.push("この地点は気象庁の予報区に結び付いていないため、気象庁の発表は出ていません。");
    return {
      fetchedAt: Date.now(),
      reportDatetime: reportDatetime,
      days: days,
      hourly: models.hourly,
      errors: errors
    };
  }

  async function fetchClimate(place, fetcher) {
    const today = tokyoToday();
    const end = addDays(today, -1);
    const start = (Number(end.slice(0, 4)) - 10) + "-01-01";
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(place.lat));
    url.searchParams.set("longitude", String(place.lon));
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
    url.searchParams.set("timezone", "Asia/Tokyo");
    const response = await (fetcher || fetch)(url);
    if (!response.ok) throw new Error("平年の統計を取得できませんでした。");
    const data = await response.json();
    if (!data.daily || !data.daily.time) throw new Error("平年の統計を取得できませんでした。");
    const groups = {};
    data.daily.time.forEach(function (date, index) {
      const hi = numberOrNull(data.daily.temperature_2m_max[index]);
      const lo = numberOrNull(data.daily.temperature_2m_min[index]);
      const rain = numberOrNull(data.daily.precipitation_sum[index]);
      if (hi == null || lo == null || rain == null) return;
      const key = date.slice(5);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ hi: hi, lo: lo, wet: rain >= 1 });
    });
    const summary = {};
    Object.keys(groups).forEach(function (key) {
      const rows = groups[key];
      const hi = Math.round(rows.reduce(function (sum, row) { return sum + row.hi; }, 0) / rows.length);
      const lo = Math.round(rows.reduce(function (sum, row) { return sum + row.lo; }, 0) / rows.length);
      const ratio = rows.filter(function (row) { return row.wet; }).length / rows.length;
      summary[key] = { hi: hi, lo: lo, rain: rainLabel(ratio), samples: rows.length };
    });
    return summary;
  }

  function rainLabel(ratio) {
    const tenths = Math.round(ratio * 10);
    if (tenths <= 0) return "雨少";
    if (tenths >= 10) return "雨多";
    return "雨" + tenths + "割";
  }

  function spreadOf(day) {
    const pops = ["jma", "msm", "ecmwf", "gfs"].map(function (key) {
      return day[key] && day[key].pop != null ? day[key].pop : null;
    }).filter(function (pop) { return pop != null; });
    if (pops.length < 2) return 0;
    return Math.max.apply(null, pops) - Math.min.apply(null, pops);
  }

  function popRange(day) {
    const pops = ["jma", "msm", "ecmwf", "gfs"].map(function (key) {
      return day[key] && day[key].pop != null ? day[key].pop : null;
    }).filter(function (pop) { return pop != null; });
if (!pops.length) return "";
  const low = Math.min.apply(null, pops);
  const high = Math.max.apply(null, pops);
  return low === high ? low + "%" : low + "〜" + high + "%";
  }

  return {
    tokyoToday: tokyoToday,
    tokyoHour: tokyoHour,
    addDays: addDays,
    weekday: weekday,
    resolveJma: resolveJma,
    loadAreas: loadAreas,
    searchPlaces: searchPlaces,
    fetchBundle: fetchBundle,
    fetchClimate: fetchClimate,
    spreadOf: spreadOf,
    popRange: popRange,
    mmLabel: mmLabel,
    cleanText: cleanText
  };
});
