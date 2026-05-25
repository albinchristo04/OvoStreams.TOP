(function () {
  var utils = window.OvoUtils;

  if (!utils) {
    return;
  }

  var state = {
    matches: [],
    activeCategory: utils.normalizeCategory(document.body.getAttribute("data-default-category") || "all"),
    searchTerm: "",
    generated: "",
    isLoading: true
  };

  var dom = {
    matchGrid: document.getElementById("matchGrid"),
    categoryFilters: document.getElementById("categoryFilters"),
    statusRegion: document.querySelector("[data-status-region]"),
    statusPill: document.querySelector("[data-status-pill]"),
    lastUpdated: document.querySelector("[data-last-updated]"),
    refreshButtons: Array.prototype.slice.call(document.querySelectorAll("[data-refresh-button]")),
    navLinks: Array.prototype.slice.call(document.querySelectorAll("[data-nav-filter]")),
    searchToggle: document.querySelector("[data-search-toggle]"),
    searchPanel: document.getElementById("search-panel"),
    searchForm: document.querySelector("[data-search-form]"),
    searchInput: document.getElementById("match-search")
  };

  function init() {
    wireEvents();
    syncNavState();
    hydrateSearchFromUrl();
    renderSkeletons();
    loadMatches({ showSkeleton: true });
    window.setInterval(function () {
      loadMatches({ force: true, silent: true });
    }, 60000);
  }

  function wireEvents() {
    dom.refreshButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        loadMatches({ force: true });
      });
    });

    dom.categoryFilters.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-category]");
      if (!button) {
        return;
      }

      state.activeCategory = button.getAttribute("data-category") || "all";
      syncNavState();
      renderFilters();
      renderMatches();
    });

    dom.navLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var href = link.getAttribute("href") || "";
        var filter = link.getAttribute("data-nav-filter") || "all";

        if (href && href.indexOf(".html") !== -1) {
          return;
        }

        if (href === "/" || href === "#matches") {
          event.preventDefault();
        }

        state.activeCategory = filter;
        syncNavState();
        renderFilters();
        renderMatches();
      });
    });

    if (dom.searchToggle) {
      dom.searchToggle.addEventListener("click", function () {
        var isExpanded = dom.searchToggle.getAttribute("aria-expanded") === "true";
        dom.searchToggle.setAttribute("aria-expanded", String(!isExpanded));
        dom.searchPanel.hidden = isExpanded;
        if (!isExpanded) {
          dom.searchInput.focus();
        }
      });
    }

    if (dom.searchForm) {
      dom.searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        state.searchTerm = (dom.searchInput.value || "").trim();
        updateSearchQuery();
        renderMatches();
      });
    }

    dom.matchGrid.addEventListener("click", function (event) {
      if (event.target.closest("a, button")) {
        return;
      }

      var card = event.target.closest(".match-card[data-href]");
      if (card) {
        window.location.href = card.getAttribute("data-href");
      }
    });

    dom.matchGrid.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      var card = event.target.closest(".match-card[data-href]");
      if (card) {
        event.preventDefault();
        window.location.href = card.getAttribute("data-href");
      }
    });
  }

  function hydrateSearchFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var query = (params.get("q") || "").trim();

    if (query) {
      state.searchTerm = query;
      dom.searchPanel.hidden = false;
      dom.searchToggle.setAttribute("aria-expanded", "true");
      dom.searchInput.value = query;
    }
  }

  async function loadMatches(options) {
    var config = options || {};
    var cached = !config.force ? utils.readCachedItem("ovostreams.matches", utils.CACHE_TTL_MS) : null;

    if (cached) {
      applyMatchPayload(cached, { silent: false, source: "cache" });
      return;
    }

    if (config.showSkeleton) {
      renderSkeletons();
    } else if (!config.silent) {
      setStatus("Refreshing the latest schedule...", false);
    }

    try {
      var response = await fetch(utils.API_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var payload = await response.json();
      utils.writeCachedItem("ovostreams.matches", payload);
      applyMatchPayload(payload, { silent: !!config.silent, source: "network" });
    } catch (error) {
      if (!state.matches.length) {
        renderError(error);
      } else {
        setStatus("Live update failed. Showing the most recent schedule we already loaded.", true);
      }
    }
  }

  function applyMatchPayload(payload, options) {
    state.matches = Array.isArray(payload && payload.matches) ? payload.matches : [];
    state.generated = payload && payload.generated ? payload.generated : "";
    state.isLoading = false;

    renderFilters();
    renderMatches();
    syncNavState();

    var updatedText = buildUpdatedText(options && options.source);
    dom.lastUpdated.textContent = updatedText;
    dom.statusPill.textContent = state.matches.length
      ? state.matches.length + (state.matches.length === 1 ? " live event listed" : " live events listed")
      : "No live events right now";

    if (!(options && options.silent)) {
      setStatus(state.matches.length ? "Schedule updated successfully." : "No matches scheduled right now - check back soon.", false);
    }
  }

  function hasCategory(category) {
    var normalized = utils.normalizeCategory(category);
    return state.matches.some(function (match) {
      return utils.normalizeCategory(match.category || match.category_label) === normalized;
    });
  }

  function buildUpdatedText(source) {
    var sourceLabel = source === "cache" ? "Loaded from session cache" : "Updated";
    var timestamp = state.generated ? new Date(state.generated) : new Date();

    return sourceLabel + " " + new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(timestamp);
  }

  function getCategoryGroups() {
    var groups = state.matches.reduce(function (accumulator, match) {
      var key = utils.normalizeCategory(match.category || match.category_label);
      var label = match.category_label || match.category || "All Sports";
      if (!accumulator[key]) {
        accumulator[key] = {
          key: key,
          label: label,
          count: 0,
          icon: utils.getCategoryIcon(match.category, label)
        };
      }
      accumulator[key].count += 1;
      return accumulator;
    }, {});

    var categories = Object.keys(groups).sort().map(function (key) {
      return groups[key];
    });

    categories.unshift({
      key: "all",
      label: "All Sports",
      count: state.matches.length,
      icon: "🎥"
    });

    if (state.activeCategory !== "all" && !groups[state.activeCategory]) {
      categories.splice(1, 0, {
        key: state.activeCategory,
        label: utils.getCategoryLandingPage(state.activeCategory).label,
        count: 0,
        icon: utils.getCategoryIcon(state.activeCategory, utils.getCategoryLandingPage(state.activeCategory).label)
      });
    }

    return categories;
  }

  function renderFilters() {
    var categories = getCategoryGroups();
    dom.categoryFilters.innerHTML = categories.map(function (item) {
      var isActive = item.key === state.activeCategory;
      return "<button class=\"category-pill" + (isActive ? " is-active" : "") + "\" type=\"button\" data-category=\"" + utils.escapeHtml(item.key) + "\">"
        + "<span>" + utils.escapeHtml(item.icon) + " " + utils.escapeHtml(item.label) + "</span>"
        + "<span class=\"category-pill__count\">" + item.count + "</span>"
        + "</button>";
    }).join("");
  }

  function getVisibleMatches() {
    return state.matches.filter(function (match) {
      var normalizedCategory = utils.normalizeCategory(match.category || match.category_label);
      var categoryPass = state.activeCategory === "all" || normalizedCategory === state.activeCategory;

      if (!categoryPass) {
        return false;
      }

      if (!state.searchTerm) {
        return true;
      }

      var haystack = [
        match.title,
        match.category,
        match.category_label
      ].join(" ").toLowerCase();

      return haystack.indexOf(state.searchTerm.toLowerCase()) !== -1;
    });
  }

  function renderMatches() {
    var visibleMatches = getVisibleMatches();

    if (!state.matches.length) {
      dom.matchGrid.innerHTML = renderEmptyState(
        "No matches scheduled right now - check back soon",
        "The OvoStreams board refreshes every minute, so football, basketball, UFC, and other live sports listings will appear here as soon as they are available.",
        "Refresh Now"
      );
      attachEmptyStateRefresh();
      return;
    }

    if (!visibleMatches.length) {
      dom.matchGrid.innerHTML = renderEmptyState(
        "No matches match this filter yet",
        "Try another category or search phrase to explore more free sports streams on OvoStreams.",
        "Reset Filters"
      );
      var resetButton = document.querySelector("[data-reset-filters]");
      if (resetButton) {
        resetButton.addEventListener("click", function () {
          state.activeCategory = "all";
          state.searchTerm = "";
          dom.searchInput.value = "";
          updateSearchQuery();
          syncNavState();
          renderFilters();
          renderMatches();
        });
      }
      return;
    }

    dom.matchGrid.innerHTML = visibleMatches.map(renderCard).join("");
  }

  function renderCard(match) {
    var isLive = utils.isLiveMatch(match.time);
    var title = utils.escapeHtml(match.title || "Live Match");
    var categoryLabel = utils.escapeHtml(match.category_label || match.category || "Live Sports");
    var icon = utils.escapeHtml(utils.getCategoryIcon(match.category, match.category_label));
    var streamCount = Number(match.streams_available || (Array.isArray(match.channels) ? match.channels.length : 0));
    var href = utils.buildMatchHref(match);

    return "<article class=\"match-card\" tabindex=\"0\" role=\"link\" data-href=\"" + href + "\" data-category=\"" + utils.escapeHtml(utils.normalizeCategory(match.category || match.category_label)) + "\">"
      + "<div class=\"match-card__header\">"
      + "<span class=\"match-card__icon\">" + icon + " " + categoryLabel + "</span>"
      + "<span class=\"stream-count\">" + streamCount + " Streams Available</span>"
      + "</div>"
      + "<h3 class=\"match-card__title\">" + title + "</h3>"
      + "<div class=\"match-card__footer\">"
      + "<span class=\"match-time\">"
      + (isLive ? "<span class=\"live-indicator\"><span class=\"live-dot\"></span>LIVE</span>" : "")
      + "<span class=\"match-timecode\">" + utils.escapeHtml(utils.formatMatchTime(match.time)) + "</span>"
      + "</span>"
        + "<a class=\"btn-watch\" href=\"" + href + "\">Watch Now &rarr;</a>"
      + "</div>"
      + "</article>";
  }

  function renderSkeletons() {
    var placeholders = [];
    var index;
    for (index = 0; index < 6; index += 1) {
      placeholders.push(
        "<div class=\"skeleton-card\">"
        + "<div class=\"skeleton skeleton-card__top\"></div>"
        + "<div class=\"skeleton skeleton-card__title\"></div>"
        + "<div class=\"skeleton skeleton-card__title\"></div>"
        + "<div class=\"skeleton skeleton-card__footer\"></div>"
        + "</div>"
      );
    }
    dom.matchGrid.innerHTML = placeholders.join("");
    setStatus("Loading live matches...", false);
  }

  function renderEmptyState(title, copy, buttonLabel) {
    var dataAttribute = buttonLabel === "Reset Filters" ? "data-reset-filters" : "data-refresh-empty";
    return "<div class=\"empty-state\">"
      + "<div class=\"empty-state__icon\">&#9673;</div>"
      + "<h3>" + utils.escapeHtml(title) + "</h3>"
      + "<p>" + utils.escapeHtml(copy) + "</p>"
      + "<button class=\"btn btn--primary\" type=\"button\" " + dataAttribute + ">" + utils.escapeHtml(buttonLabel) + "</button>"
      + "</div>";
  }

  function attachEmptyStateRefresh() {
    var button = document.querySelector("[data-refresh-empty]");
    if (button) {
      button.addEventListener("click", function () {
        loadMatches({ force: true, showSkeleton: true });
      });
    }
  }

  function renderError(error) {
    dom.matchGrid.innerHTML = "<div class=\"empty-state\">"
      + "<div class=\"empty-state__icon\">!</div>"
      + "<h3>We could not load the live board</h3>"
      + "<p>The OvoStreams API request failed just now. Use the retry button to fetch the latest football, NBA, UFC, and other live events again.</p>"
      + "<button class=\"btn btn--primary\" type=\"button\" data-refresh-empty>Retry</button>"
      + "</div>";
    attachEmptyStateRefresh();
    setStatus("Unable to reach the match feed right now.", true);
    dom.statusPill.textContent = "Feed unavailable";
    dom.lastUpdated.textContent = error && error.message ? error.message : "Feed unavailable";
  }

  function setStatus(message, isError) {
    dom.statusRegion.innerHTML = "<span class=\"status-message" + (isError ? " status-message--error" : "") + "\">" + utils.escapeHtml(message) + "</span>";
  }

  function syncNavState() {
    dom.navLinks.forEach(function (link) {
      var filter = link.getAttribute("data-nav-filter") || "all";
      var isActive = state.activeCategory === filter || (filter === "all" && state.activeCategory === "all");
      link.classList.toggle("is-active", isActive);
    });
  }

  function updateSearchQuery() {
    var url = new URL(window.location.href);
    if (state.searchTerm) {
      url.searchParams.set("q", state.searchTerm);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url);
  }

  init();
})();