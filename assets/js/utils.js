(function () {
  var CATEGORY_ICONS = {
    football: "⚽",
    soccer: "⚽",
    basketball: "🏀",
    nba: "🏀",
    ufc: "🥊",
    mma: "🥊",
    nfl: "🏈",
    americanfootball: "🏈",
    americanfootballleague: "🏈",
    baseball: "⚾",
    mlb: "⚾",
    hockey: "🏒",
    tennis: "🎾",
    cricket: "🏏"
  };

  var CATEGORY_LANDING_PAGES = {
    all: {
      href: "index.html",
      path: "/",
      label: "All Sports"
    },
    football: {
      href: "football.html",
      path: "/football",
      label: "Football"
    },
    soccer: {
      href: "football.html",
      path: "/football",
      label: "Football"
    },
    basketball: {
      href: "basketball.html",
      path: "/basketball",
      label: "Basketball"
    },
    nba: {
      href: "basketball.html",
      path: "/basketball",
      label: "Basketball"
    },
    ufc: {
      href: "ufc.html",
      path: "/ufc",
      label: "UFC"
    },
    mma: {
      href: "ufc.html",
      path: "/ufc",
      label: "UFC"
    },
    nfl: {
      href: "nfl.html",
      path: "/nfl",
      label: "NFL"
    },
    americanfootball: {
      href: "nfl.html",
      path: "/nfl",
      label: "NFL"
    },
    americanfootballleague: {
      href: "nfl.html",
      path: "/nfl",
      label: "NFL"
    },
    baseball: {
      href: "baseball.html",
      path: "/baseball",
      label: "Baseball"
    },
    mlb: {
      href: "baseball.html",
      path: "/baseball",
      label: "Baseball"
    }
  };

  function normalizeCategory(value) {
    return String(value || "all")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "all";
  }

  function slugify(value) {
    return String(value || "match")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "match";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseMatchDate(timeValue, referenceDate) {
    var now = referenceDate instanceof Date ? new Date(referenceDate) : new Date();
    var match = String(timeValue || "").match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
      return null;
    }

    var hours = Number(match[1]);
    var minutes = Number(match[2]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    var offsets = [-1, 0, 1];
    var bestDate = null;
    var bestDiff = Infinity;

    offsets.forEach(function (offset) {
      var candidate = new Date(now);
      candidate.setHours(hours, minutes, 0, 0);
      candidate.setDate(candidate.getDate() + offset);
      var diff = Math.abs(candidate.getTime() - now.getTime());

      if (diff < bestDiff) {
        bestDiff = diff;
        bestDate = candidate;
      }
    });

    return bestDate;
  }

  function formatMatchTime(timeValue) {
    var matchDate = parseMatchDate(timeValue);

    if (!matchDate) {
      return "TBD";
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(matchDate);
  }

  function isLiveMatch(timeValue) {
    var matchDate = parseMatchDate(timeValue);

    if (!matchDate) {
      return false;
    }

    var diffMinutes = Math.abs(matchDate.getTime() - Date.now()) / 60000;
    return diffMinutes <= 30;
  }

  function getCategoryIcon(category, label) {
    var normalized = normalizeCategory(category || label).replace(/-/g, "");
    return CATEGORY_ICONS[normalized] || CATEGORY_ICONS[normalizeCategory(label)] || "🎯";
  }

  function buildMatchHref(match) {
    var id = encodeURIComponent(match && match.id ? match.id : "");
    var slug = encodeURIComponent(slugify(match && match.title ? match.title : "match"));
    return "match.html?id=" + id + "&title=" + slug;
  }

  function getCategoryLandingPage(category) {
    var normalized = normalizeCategory(category).replace(/-/g, "");
    return CATEGORY_LANDING_PAGES[normalized] || CATEGORY_LANDING_PAGES.all;
  }

  function readCachedItem(storageKey, maxAgeMs) {
    try {
      var raw = window.sessionStorage.getItem(storageKey);

      if (!raw) {
        return null;
      }

      var parsed = JSON.parse(raw);

      if (!parsed || !parsed.timestamp || !parsed.data) {
        return null;
      }

      if (Date.now() - parsed.timestamp > maxAgeMs) {
        return null;
      }

      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  function writeCachedItem(storageKey, data) {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (error) {
      return;
    }
  }

  function setMetaContent(selector, value) {
    var element = document.querySelector(selector);

    if (element && value) {
      element.setAttribute("content", value);
    }
  }

  function setCanonical(path) {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", "https://ovostreams.top" + path);
    }
  }

  window.OvoUtils = {
    API_URL: "https://ovo.ppvtv.top/api/matches",
    CACHE_TTL_MS: 55000,
    normalizeCategory: normalizeCategory,
    slugify: slugify,
    escapeHtml: escapeHtml,
    parseMatchDate: parseMatchDate,
    formatMatchTime: formatMatchTime,
    isLiveMatch: isLiveMatch,
    getCategoryIcon: getCategoryIcon,
    buildMatchHref: buildMatchHref,
    getCategoryLandingPage: getCategoryLandingPage,
    readCachedItem: readCachedItem,
    writeCachedItem: writeCachedItem,
    setMetaContent: setMetaContent,
    setCanonical: setCanonical
  };
})();