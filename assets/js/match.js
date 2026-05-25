(function () {
  var utils = window.OvoUtils;

  if (!utils) {
    return;
  }

  var dom = {
    breadcrumbs: document.getElementById("breadcrumbs"),
    matchEyebrow: document.getElementById("matchEyebrow"),
    matchTitle: document.getElementById("matchTitle"),
    matchSummary: document.getElementById("matchSummary"),
    matchStats: document.getElementById("matchStats"),
    playerFrame: document.getElementById("playerFrame"),
    streamTabs: document.getElementById("streamTabs"),
    matchDetails: document.getElementById("matchDetails"),
    seoArticle: document.getElementById("seoArticle")
  };

  init();

  async function init() {
    var params = new URLSearchParams(window.location.search);
    var matchId = (params.get("id") || "").trim();

    if (!matchId) {
      renderUnavailable("Missing match selection", "Choose a live event from the OvoStreams homepage to open the correct watch page and stream options.");
      return;
    }

    try {
      var payload = utils.readCachedItem("ovostreams.matches", utils.CACHE_TTL_MS);

      if (!payload) {
        var response = await fetch(utils.API_URL, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        payload = await response.json();
        utils.writeCachedItem("ovostreams.matches", payload);
      }

      var matches = Array.isArray(payload && payload.matches) ? payload.matches : [];
      var match = matches.find(function (item) {
        return String(item.id) === matchId;
      });

      if (!match) {
        renderUnavailable("This stream is not listed right now", "The match may have finished, moved, or not been published yet. Check the live board for the latest football, NBA, UFC, and other streams.");
        return;
      }

      renderMatch(match);
    } catch (error) {
      renderUnavailable("We could not load this match", "The live feed request failed just now. Reload the page or return to the homepage to try again.");
    }
  }

  function renderMatch(match) {
    var categoryLabel = match.category_label || match.category || "Live Sports";
    var isLive = utils.isLiveMatch(match.time);
    var sources = buildSources(match);
    var categoryLanding = utils.getCategoryLandingPage(match.category || categoryLabel);
    var canonicalPath = "/match.html?id=" + encodeURIComponent(match.id) + "&title=" + encodeURIComponent(utils.slugify(match.title));
    var title = match.title + " | OvoStreams - Free Live Sports Streaming";
    var description = buildMetaDescription(match, categoryLabel);

    document.title = title;
    utils.setMetaContent('meta[name="description"]', description);
    utils.setMetaContent('meta[property="og:title"]', title);
    utils.setMetaContent('meta[property="og:description"]', description);
    utils.setMetaContent('meta[property="og:url"]', "https://ovostreams.top" + canonicalPath);
    utils.setMetaContent('meta[name="twitter:title"]', title);
    utils.setMetaContent('meta[name="twitter:description"]', description);
    utils.setCanonical(canonicalPath);

    dom.breadcrumbs.innerHTML = "<a href=\"index.html\">Home</a><span>&gt;</span><a href=\"" + categoryLanding.href + "\">"
      + utils.escapeHtml(categoryLabel)
      + "</a><span>&gt;</span><span>"
      + utils.escapeHtml(match.title)
      + "</span>";

    dom.matchEyebrow.textContent = categoryLabel + (isLive ? " live now" : " stream schedule");
    dom.matchTitle.textContent = match.title;
    dom.matchSummary.textContent = buildSummary(match, categoryLabel);
    dom.matchStats.innerHTML = [
      renderMetaPill(categoryLabel),
      renderMetaPill(utils.formatMatchTime(match.time)),
      renderMetaPill(isLive ? "LIVE now" : "Upcoming"),
      renderMetaPill(sources.length ? String(sources.length) + (sources.length === 1 ? " stream option" : " stream options") : "Stream coming soon")
    ].join("");

    renderPlayer(match, sources);
    renderDetails(match, categoryLabel, isLive, sources.length);
    renderSeoArticle(match, categoryLabel);
    updateStructuredData(match, categoryLabel, isLive, sources, canonicalPath, description);
  }

  function renderMetaPill(text) {
    return "<span class=\"meta-pill\">" + utils.escapeHtml(text) + "</span>";
  }

  function buildSources(match) {
    var candidates = [];
    var channelCount = Array.isArray(match.channels) ? match.channels.length : 0;
    var streamsAvailable = Number(match.streams_available || 0);

    if (match.embed_url && (streamsAvailable > 0 || channelCount > 0)) {
      candidates.push({
        label: "Main Stream",
        url: match.embed_url
      });
    }

    if (Array.isArray(match.channels)) {
      match.channels.forEach(function (channel, index) {
        var resolved = resolveChannel(channel, index);
        if (resolved) {
          candidates.push(resolved);
        }
      });
    }

    return dedupeSources(candidates);
  }

  function resolveChannel(channel, index) {
    if (!channel) {
      return null;
    }

    if (typeof channel === "string") {
      return {
        label: "Stream " + (index + 1),
        url: channel
      };
    }

    if (typeof channel === "object") {
      var url = channel.embed_url || channel.url || channel.href || channel.src || channel.link;
      if (!url) {
        return null;
      }
      return {
        label: channel.label || channel.name || channel.title || ("Stream " + (index + 1)),
        url: url
      };
    }

    return null;
  }

  function dedupeSources(sources) {
    var seen = {};
    return sources.filter(function (source) {
      if (!source.url || seen[source.url]) {
        return false;
      }
      seen[source.url] = true;
      return true;
    });
  }

  function renderPlayer(match, sources) {
    if (!sources.length) {
      dom.playerFrame.innerHTML = "<div class=\"player-shell__placeholder\">Stream coming soon - check back closer to kick-off for the latest OvoStreams player and alternate channels.</div>";
      dom.streamTabs.innerHTML = "";
      return;
    }

    var activeSource = sources[0];
    dom.playerFrame.innerHTML = "<iframe title=\"" + utils.escapeHtml(match.title) + " live stream\" src=\"" + utils.escapeHtml(activeSource.url) + "\" allow=\"autoplay; encrypted-media; picture-in-picture; fullscreen; bluetooth\" loading=\"eager\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>";
    dom.streamTabs.innerHTML = sources.map(function (source, index) {
      return "<button class=\"channel-button" + (index === 0 ? " is-active" : "") + "\" type=\"button\" data-stream-url=\"" + utils.escapeHtml(source.url) + "\">"
        + utils.escapeHtml(source.label)
        + "</button>";
    }).join("");

    dom.streamTabs.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-stream-url]");
      if (!button) {
        return;
      }

      var iframe = dom.playerFrame.querySelector("iframe");
      if (iframe) {
        iframe.src = button.getAttribute("data-stream-url") || iframe.src;
      }

      Array.prototype.forEach.call(dom.streamTabs.querySelectorAll(".channel-button"), function (element) {
        element.classList.remove("is-active");
      });
      button.classList.add("is-active");
    });
  }

  function renderDetails(match, categoryLabel, isLive, sourceCount) {
    dom.matchDetails.innerHTML = [
      detailRow("Category", categoryLabel),
      detailRow("Kick-off", utils.formatMatchTime(match.time)),
      detailRow("Status", isLive ? "Live now" : "Scheduled"),
      detailRow("Streams", String(sourceCount)),
      detailRow("Primary feed", sourceCount ? "Embed available" : "Waiting for stream")
    ].join("");
  }

  function detailRow(label, value) {
    return "<div><dt>" + utils.escapeHtml(label) + "</dt><dd>" + utils.escapeHtml(value) + "</dd></div>";
  }

  function renderSeoArticle(match, categoryLabel) {
    dom.seoArticle.innerHTML = "<h2>Watch "
      + utils.escapeHtml(match.title)
      + " Live Stream Free</h2><p>Watch "
      + utils.escapeHtml(match.title)
      + " live on OvoStreams with a match page designed for fans who want fast access to free sports streams without clutter. If you have used Ovo Streams, Ovogoals, or Ovogoalz to follow big fixtures, this page keeps the stream, time, and alternate viewing options together so you can move from the schedule straight into the player. The live board updates frequently, making it easier to check whether this "
      + utils.escapeHtml(categoryLabel)
      + " event is live now, nearly ready, or still waiting for additional channels.</p><p>Use this watch page to track the official embed, swap between any available stream buttons, and stay ready for match-time changes as the latest feed refreshes. OvoStreams is built for supporters searching for watch live sports free, soccer streams HD, live football streams, NBA streams free, UFC streams free, and broader free sports streaming coverage. When new channels are added closer to kick-off, they appear here so you can keep watching live sports online in HD with fewer interruptions.</p>";
  }

  function updateStructuredData(match, categoryLabel, isLive, sources, canonicalPath, description) {
    var startDate = utils.parseMatchDate(match.time);
    var pageUrl = "https://ovostreams.top" + canonicalPath;
    var sportsEvent = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: match.title,
      sport: categoryLabel,
      description: description,
      url: pageUrl,
      image: "https://ovostreams.top/assets/img/og-image.png",
      eventStatus: isLive ? "https://schema.org/EventInProgress" : "https://schema.org/EventScheduled",
      location: {
        "@type": "VirtualLocation",
        url: pageUrl
      },
      organizer: {
        "@type": "Organization",
        name: "OvoStreams",
        url: "https://ovostreams.top"
      }
    };

    if (startDate) {
      sportsEvent.startDate = startDate.toISOString();
    }

    upsertStructuredData("matchStructuredData", sportsEvent);
    upsertStructuredData("breadcrumbStructuredData", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://ovostreams.top/"
        },
        {
          "@type": "ListItem",
          position: 2,
          name: categoryLabel,
          item: "https://ovostreams.top" + utils.getCategoryLandingPage(match.category || categoryLabel).path
        },
        {
          "@type": "ListItem",
          position: 3,
          name: match.title,
          item: pageUrl
        }
      ]
    });

    if (sources.length) {
      upsertStructuredData("videoStructuredData", {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: match.title + " live stream",
        description: description,
        thumbnailUrl: "https://ovostreams.top/assets/img/og-image.png",
        embedUrl: sources[0].url,
        uploadDate: new Date().toISOString(),
        potentialAction: {
          "@type": "WatchAction",
          target: pageUrl
        },
        publisher: {
          "@type": "Organization",
          name: "OvoStreams",
          url: "https://ovostreams.top"
        }
      });
    } else {
      removeStructuredData("videoStructuredData");
    }
  }

  function upsertStructuredData(id, data) {
    var script = document.getElementById(id);

    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);
  }

  function removeStructuredData(id) {
    var script = document.getElementById(id);
    if (script) {
      script.remove();
    }
  }

  function buildSummary(match, categoryLabel) {
    return "Open " + match.title + " on OvoStreams for a fast " + categoryLabel + " watch page with the latest embed, stream buttons, and live schedule context.";
  }

  function buildMetaDescription(match, categoryLabel) {
    return ("Watch " + match.title + " live on OvoStreams. Free " + categoryLabel + " streaming with HD-ready embeds, fast updates, and alternate stream links when available.").slice(0, 155);
  }

  function renderUnavailable(title, copy) {
    document.title = title + " | OvoStreams";
    utils.setMetaContent('meta[name="description"]', copy.slice(0, 155));
    dom.breadcrumbs.innerHTML = "<a href=\"index.html\">Home</a><span>&gt;</span><span>Unavailable</span>";
    dom.matchEyebrow.textContent = "Stream unavailable";
    dom.matchTitle.textContent = title;
    dom.matchSummary.textContent = copy;
    dom.matchStats.innerHTML = renderMetaPill("Return to live board");
    dom.playerFrame.innerHTML = "<div class=\"player-shell__placeholder\">" + utils.escapeHtml(copy) + "</div>";
    dom.streamTabs.innerHTML = "<a class=\"channel-button is-active\" href=\"index.html\">Back to live matches</a>";
    dom.matchDetails.innerHTML = detailRow("Status", "Unavailable");
    dom.seoArticle.innerHTML = "<h2>Watch Live Sports Free on OvoStreams</h2><p>Return to the homepage to browse the latest football, basketball, UFC, and other free sports streaming events currently listed on OvoStreams.</p>";
    removeStructuredData("matchStructuredData");
    removeStructuredData("breadcrumbStructuredData");
    removeStructuredData("videoStructuredData");
  }
})();