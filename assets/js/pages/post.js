/*
  post.js — single story detail
  Public to read; reacting, replying, and reporting require sign-in.
  Reactions: Heart (legacy likes node), Support + Hug (reactions/{type}).
*/
(function () {
  "use strict";
  var db = window.SP.db;
  var TS = firebase.database.ServerValue.TIMESTAMP;

  var params = new URLSearchParams(location.search);
  var topic = params.get("topic");
  var postId = params.get("postId");
  if (!topic || !postId) { location.href = "read"; return; }

  var P = "interactions/" + topic + "/" + postId;
  var RX = { heart: "likes", support: "reactions/support", hug: "reactions/hug" };

  var me = null, myProfile = null, isAdmin = false, post = null;
  var rxData = { heart: {}, support: {}, hug: {} };

  var $ = function (id) { return document.getElementById(id); };
  function countKeys(o) { return o ? Object.keys(o).length : 0; }
  function excerpt(t, n) { t = (t || "").trim(); return t.length > n ? t.slice(0, n) + "…" : t; }

  /* ---------- auth ---------- */
  window.SP.observe(function (user, profile) {
    me = user; myProfile = profile; isAdmin = !!(user && window.SP.isAdmin(user.uid));
    var form = $("comment-form"), prompt = $("guest-prompt");
    if (user && profile) {
      form.style.display = "flex";
      prompt.classList.add("hidden");
      $("my-avatar").textContent = window.SP.initials(profile.username);
    } else {
      form.style.display = "none";
      prompt.classList.remove("hidden");
    }
    paintReactions();
    updateDeleteBtn();
  });

  /* ---------- load post ---------- */
  db.ref("uploads/" + topic + "/" + postId).once("value").then(function (snap) {
    if (!snap.exists()) {
      $("post-loading").innerHTML = '<div class="empty"><div class="ico">🔍</div><h3>Story not found</h3><p>It may have been removed.</p><a href="read" class="btn btn-primary mt-1">Back to stories</a></div>';
      return;
    }
    post = snap.val();
    renderPost();
    attachReactions();
    attachComments();
    $("post-loading").hidden = true;
    $("post").hidden = false;
    $("comments").hidden = false;
    updateDeleteBtn();
  }).catch(function (e) {
    console.error("[post] load failed", e);
    $("post-loading").innerHTML = '<div class="empty"><div class="ico">⚠️</div><h3>Couldn’t load this story</h3></div>';
  });

  function renderPost() {
    document.title = (post.name || "A story") + " · Society Poems";
    $("post-badges").innerHTML =
      '<span class="topic-badge">' + window.SP.escapeHTML(topic.charAt(0).toUpperCase() + topic.slice(1)) + "</span>" +
      (post.cw ? ' <span class="topic-badge warn">⚠ ' + window.SP.escapeHTML(post.cw) + "</span>" : "");
    $("post-avatar").textContent = window.SP.initials(post.name);
    $("post-author").textContent = post.name || "Anonymous";
    $("post-time").textContent = window.SP.timeAgo(post.timestamp);
    $("post-body").textContent = post.content;
    if (post.cw) {
      $("post-cw").hidden = false;
      $("post-cw-text").textContent = post.cw;
      $("reveal-btn").addEventListener("click", function () {
        $("post-cw").hidden = true;
        $("post-body").hidden = false;
      });
    } else {
      $("post-body").hidden = false;
    }
  }

  /* ---------- reactions ---------- */
  function attachReactions() {
    Object.keys(RX).forEach(function (type) {
      db.ref(P + "/" + RX[type]).on("value", function (snap) {
        rxData[type] = snap.val() || {};
        paintReactions();
      });
    });
    document.querySelectorAll(".reaction-btn[data-rx]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-rx");
        if (!me || !myProfile) { window.SP.toast("Please sign in to react"); return; }
        var ref = db.ref(P + "/" + RX[type] + "/" + me.uid);
        if (rxData[type][me.uid]) ref.remove();
        else ref.set({ username: myProfile.username, timestamp: TS });
      });
    });
  }
  function paintReactions() {
    $("c-heart").textContent = countKeys(rxData.heart);
    $("c-support").textContent = countKeys(rxData.support);
    $("c-hug").textContent = countKeys(rxData.hug);
    document.querySelectorAll(".reaction-btn[data-rx]").forEach(function (btn) {
      var type = btn.getAttribute("data-rx");
      btn.classList.toggle("on", !!(me && rxData[type][me.uid]));
    });
  }

  /* ---------- comments ---------- */
  function attachComments() {
    db.ref(P + "/comments").orderByChild("timestamp").on("value", function (snap) {
      var list = $("comment-list");
      var items = [];
      snap.forEach(function (c) { items.push({ id: c.key, v: c.val() }); });
      $("comment-count").textContent = items.length ? "(" + items.length + ")" : "";
      if (!items.length) {
        list.innerHTML = '<p class="muted" style="padding:1rem 0;">No replies yet — be the first to offer some support.</p>';
        return;
      }
      list.innerHTML = items.map(function (it) {
        var c = it.v;
        var canDel = me && (c.uid === me.uid || isAdmin);
        return (
          '<div class="comment"><span class="avatar" style="width:36px;height:36px;font-size:.8rem;">' +
          window.SP.initials(c.username) + '</span><div class="bubble"><b>' +
          window.SP.escapeHTML(c.username || "Someone") + "</b><p>" + window.SP.escapeHTML(c.content) +
          '</p><div class="c-meta"><span>' + window.SP.timeAgo(c.timestamp) + "</span>" +
          (canDel ? '<button class="c-del" data-del="' + it.id + '">Delete</button>' : "") +
          "</div></div></div>"
        );
      }).join("");
      list.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (confirm("Delete this reply?")) db.ref(P + "/comments/" + b.getAttribute("data-del")).remove();
        });
      });
    });
  }

  $("comment-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!me || !myProfile) { window.SP.toast("Please sign in to reply"); return; }
    var input = $("comment-input");
    var text = input.value.trim();
    if (!text) return;
    db.ref(P + "/comments").push({
      uid: me.uid, username: myProfile.username, content: text, timestamp: TS,
    }).then(function () { input.value = ""; }).catch(function () { window.SP.toast("Couldn’t post reply", "error"); });
  });

  /* ---------- report ---------- */
  var modal = $("report-modal");
  $("report-btn").addEventListener("click", function () {
    if (!me || !myProfile) { window.SP.toast("Please sign in to report"); return; }
    modal.classList.add("open");
  });
  $("report-cancel").addEventListener("click", function () { modal.classList.remove("open"); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.classList.remove("open"); });
  $("report-submit").addEventListener("click", function () {
    var reason = document.querySelector('input[name="reason"]:checked');
    if (!reason) { window.SP.toast("Please choose a reason"); return; }
    db.ref("reports/" + topic + "/" + postId).push({
      reason: reason.value,
      details: $("report-details").value.trim(),
      reportedBy: me.uid,
      reporterUsername: myProfile.username,
      postAuthor: post.name || "Anonymous",
      postContent: excerpt(post.content, 200),
      timestamp: TS,
      status: "pending",
    }).then(function () {
      modal.classList.remove("open");
      window.SP.toast("Thank you — our team will review this", "success");
    }).catch(function () { window.SP.toast("Couldn’t submit report", "error"); });
  });

  /* ---------- delete / moderate ---------- */
  function updateDeleteBtn() {
    var btn = $("delete-btn");
    var canDelete = me && post && (isAdmin || post.uid === me.uid);
    btn.classList.toggle("hidden", !canDelete);
  }
  $("delete-btn").addEventListener("click", function () {
    if (!confirm("Delete this story permanently? This can't be undone.")) return;
    var jobs = [
      db.ref("uploads/" + topic + "/" + postId).remove(),
      db.ref(P).remove(),
    ];
    // Only the owner can adjust their own user record (rules); the scheduled
    // sync job reconciles counts for admin removals.
    if (me && post.uid === me.uid) {
      jobs.push(db.ref("users/" + me.uid + "/uploads/" + postId).remove());
      jobs.push(db.ref("users/" + me.uid + "/uploadCount").transaction(function (n) {
        return Math.max(0, (n || 0) - 1);
      }));
    }
    Promise.all(jobs).then(function () {
      window.SP.toast("Story removed", "success");
      setTimeout(function () { location.href = "read"; }, 800);
    }).catch(function (e) {
      console.error(e);
      window.SP.toast("Couldn’t delete — you may not have permission", "error");
    });
  });
})();
