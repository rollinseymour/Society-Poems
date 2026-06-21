/*
  read.js — the story feed
  Loads all uploads + interactions once, then renders a filterable,
  sortable feed. Public (guests can read); reactions happen on the
  post detail page.
*/
(function () {
  "use strict";
  var db = window.SP.db;

  var feedEl = document.getElementById("feed");
  var chipsEl = document.getElementById("topic-chips");
  var sortEl = document.getElementById("sort");
  var emptyEl = document.getElementById("empty");
  var headEl = document.getElementById("page-head");

  var params = new URLSearchParams(location.search);
  var state = {
    topic: params.get("topic") || "all",
    author: params.get("author") || null,
    sort: "new",
    posts: [],
    topics: {},
  };

  function titleCase(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function countKeys(obj) {
    return obj ? Object.keys(obj).length : 0;
  }
  function excerpt(text, n) {
    text = (text || "").trim();
    return text.length > n ? text.slice(0, n).trim() + "…" : text;
  }

  function load() {
    Promise.all([db.ref("uploads").once("value"), db.ref("interactions").once("value")])
      .then(function (res) {
        var uploads = res[0].val() || {};
        var inter = res[1].val() || {};
        var posts = [];
        var topics = {};
        Object.keys(uploads).forEach(function (topic) {
          var byId = uploads[topic] || {};
          Object.keys(byId).forEach(function (id) {
            var p = byId[id];
            if (!p || typeof p !== "object" || !p.content) return;
            var ix = (inter[topic] && inter[topic][id]) || {};
            var rx = ix.reactions || {};
            posts.push({
              topic: topic,
              id: id,
              uid: p.uid,
              name: p.name || "Anonymous",
              content: p.content,
              cw: p.cw || null,
              timestamp: p.timestamp || 0,
              hearts: countKeys(ix.likes),
              support: countKeys(rx.support),
              hugs: countKeys(rx.hug),
              comments: countKeys(ix.comments),
            });
            topics[topic] = (topics[topic] || 0) + 1;
          });
        });
        state.posts = posts;
        state.topics = topics;
        renderChips();
        render();
      })
      .catch(function (err) {
        console.error("[read] load failed", err);
        feedEl.innerHTML = '<div class="empty"><div class="ico">⚠️</div><h3>Couldn’t load stories</h3><p>Please check your connection and try again.</p></div>';
      });
  }

  function renderChips() {
    var topics = Object.keys(state.topics).sort(function (a, b) {
      return state.topics[b] - state.topics[a];
    });
    var total = state.posts.length;
    var html =
      '<button class="chip' + (state.topic === "all" ? " active" : "") +
      '" data-topic="all">All <span class="count">' + total + "</span></button>";
    html += topics
      .map(function (t) {
        return (
          '<button class="chip' + (state.topic === t ? " active" : "") +
          '" data-topic="' + window.SP.escapeHTML(t) + '">' +
          window.SP.escapeHTML(titleCase(t)) +
          ' <span class="count">' + state.topics[t] + "</span></button>"
        );
      })
      .join("");
    chipsEl.innerHTML = html;
    chipsEl.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.topic = chip.getAttribute("data-topic");
        state.author = null;
        renderChips();
        render();
      });
    });
  }

  function visiblePosts() {
    var list = state.posts.slice();
    if (state.author) list = list.filter(function (p) { return p.name === state.author; });
    if (state.topic !== "all") list = list.filter(function (p) { return p.topic === state.topic; });
    if (state.sort === "new") list.sort(function (a, b) { return b.timestamp - a.timestamp; });
    else if (state.sort === "old") list.sort(function (a, b) { return a.timestamp - b.timestamp; });
    else if (state.sort === "support") list.sort(function (a, b) {
      return (b.hearts + b.support + b.hugs) - (a.hearts + a.support + a.hugs);
    });
    return list;
  }

  function cardHTML(p) {
    var badges =
      '<span class="topic-badge">' + window.SP.escapeHTML(titleCase(p.topic)) + "</span>" +
      (p.cw ? '<span class="topic-badge warn">⚠ ' + window.SP.escapeHTML(p.cw) + "</span>" : "");
    var body = p.cw
      ? '<div class="cw-veil"><div class="cw-tag">Content warning</div><p>' +
        window.SP.escapeHTML(p.cw) + '</p><button class="btn btn-soft btn-sm" data-reveal>Show story</button></div>' +
        '<p class="excerpt" hidden>' + window.SP.escapeHTML(excerpt(p.content, 240)) + "</p>"
      : '<p class="excerpt">' + window.SP.escapeHTML(excerpt(p.content, 240)) + "</p>";
    var rx =
      '<span class="reactions"><span class="rx">❤ ' + p.hearts + "</span>" +
      '<span class="rx">🤝 ' + p.support + "</span>" +
      '<span class="rx">💬 ' + p.comments + "</span></span>";
    return (
      '<article class="story-card" data-topic="' + window.SP.escapeHTML(p.topic) +
      '" data-id="' + window.SP.escapeHTML(p.id) + '" style="cursor:pointer;">' +
      '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">' + badges + "</div>" +
      body +
      '<div class="story-foot"><span class="author" data-author="' + window.SP.escapeHTML(p.name) +
      '"><span class="avatar" style="width:30px;height:30px;font-size:.75rem;">' + window.SP.initials(p.name) +
      "</span> " + window.SP.escapeHTML(p.name) + "</span>" + rx + "</div></article>"
    );
  }

  function render() {
    var list = visiblePosts();

    // Author sub-header
    var existing = document.getElementById("author-banner");
    if (existing) existing.remove();
    if (state.author) {
      var banner = document.createElement("div");
      banner.id = "author-banner";
      banner.className = "callout mt-1";
      banner.style.marginBottom = "1.5rem";
      banner.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">' +
        "<div><strong>Stories by " + window.SP.escapeHTML(state.author) + "</strong>" +
        '<div class="muted" style="font-size:.9rem;">' + list.length + " stor" + (list.length === 1 ? "y" : "ies") + "</div></div>" +
        '<button class="btn btn-ghost btn-sm" id="clear-author">Back to all</button></div>';
      headEl.after(banner);
      document.getElementById("clear-author").addEventListener("click", function () {
        state.author = null;
        render();
      });
    }

    if (!list.length) {
      feedEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    feedEl.innerHTML = list.map(cardHTML).join("");

    feedEl.querySelectorAll(".story-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("[data-reveal]")) {
          var veil = card.querySelector(".cw-veil");
          var ex = card.querySelector(".excerpt");
          if (veil) veil.style.display = "none";
          if (ex) ex.hidden = false;
          return;
        }
        if (e.target.closest("[data-author]")) {
          e.stopPropagation();
          state.author = e.target.closest("[data-author]").getAttribute("data-author");
          state.topic = "all";
          renderChips();
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        location.href = "post?topic=" + encodeURIComponent(card.getAttribute("data-topic")) +
          "&postId=" + encodeURIComponent(card.getAttribute("data-id"));
      });
    });
  }

  sortEl.querySelectorAll("button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      sortEl.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.sort = btn.getAttribute("data-sort");
      render();
    });
  });

  load();
})();
