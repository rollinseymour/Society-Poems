/*
  profile.js — the signed-in member's own profile
  Shows their details, a tally of support received, and their stories.
*/
(function () {
  "use strict";
  var db = window.SP.db;
  var $ = function (id) { return document.getElementById(id); };
  function countKeys(o) { return o ? Object.keys(o).length : 0; }

  window.SP.requireAuth(function (user, profile) {
    var uploads = profile.uploads && typeof profile.uploads === "object" ? profile.uploads : {};
    var posts = Object.keys(uploads)
      .map(function (id) {
        var u = uploads[id] || {};
        return { id: id, topic: u.topic || "", preview: u.preview || "", timestamp: u.timestamp || 0 };
      })
      .filter(function (p) { return p.topic; })
      .sort(function (a, b) { return b.timestamp - a.timestamp; });

    // Header
    $("p-avatar").textContent = window.SP.initials(profile.username);
    $("p-username").textContent = profile.username;
    $("p-count").textContent = typeof profile.uploadCount === "number" ? profile.uploadCount : posts.length;
    if (profile.joinDate) {
      $("p-joined").textContent = "Member since " + new Date(profile.joinDate).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (profile.email) $("p-email").textContent = profile.email;

    renderPosts(posts);
    tallySupport(posts);
  });

  function renderPosts(posts) {
    var feed = $("my-feed");
    if (!posts.length) {
      feed.innerHTML = "";
      $("my-empty").classList.remove("hidden");
      return;
    }
    feed.innerHTML = posts.map(function (p) {
      var t = p.topic.charAt(0).toUpperCase() + p.topic.slice(1);
      return (
        '<article class="story-card" style="cursor:pointer;" data-topic="' + window.SP.escapeHTML(p.topic) +
        '" data-id="' + window.SP.escapeHTML(p.id) + '">' +
        '<span class="topic-badge">' + window.SP.escapeHTML(t) + "</span>" +
        '<p class="excerpt">' + window.SP.escapeHTML(p.preview) + "…</p>" +
        '<div class="story-foot"><span class="muted" style="font-size:.85rem;">' + window.SP.timeAgo(p.timestamp) +
        '</span><span class="muted" style="font-size:.85rem;">Open →</span></div></article>'
      );
    }).join("");
    feed.querySelectorAll(".story-card").forEach(function (card) {
      card.addEventListener("click", function () {
        location.href = "post?topic=" + encodeURIComponent(card.getAttribute("data-topic")) +
          "&postId=" + encodeURIComponent(card.getAttribute("data-id"));
      });
    });
  }

  function tallySupport(posts) {
    if (!posts.length) return;
    db.ref("interactions").once("value").then(function (snap) {
      var inter = snap.val() || {};
      var total = 0;
      posts.forEach(function (p) {
        var ix = (inter[p.topic] && inter[p.topic][p.id]) || {};
        var rx = ix.reactions || {};
        total += countKeys(ix.likes) + countKeys(rx.support) + countKeys(rx.hug);
      });
      $("p-support").textContent = total;
    }).catch(function () {});
  }
})();
