/*
  upload.js — share a story
  Requires sign-in. Writes uploads/{topic}/{id} = {uid, content, name, timestamp, cw?}
  and keeps the user's uploadCount / uploads list in sync (as before).
  Adds: anonymous posting + optional content warning.
*/
(function () {
  "use strict";
  var db = window.SP.db;
  var TS = firebase.database.ServerValue.TIMESTAMP;

  var me = null, profile = null, existingTopics = {};
  var $ = function (id) { return document.getElementById(id); };
  function msg(type, text) {
    var el = $("share-msg");
    el.className = "msg-box show " + type;
    el.textContent = text;
    if (type !== "success") setTimeout(function () { el.className = "msg-box"; }, 6000);
  }

  window.SP.requireAuth(function (user, prof) {
    me = user; profile = prof;
    $("me-name").textContent = prof.username;
    $("me-avatar").textContent = window.SP.initials(prof.username);
    loadTopics();
  });

  function loadTopics() {
    db.ref("uploads").once("value").then(function (snap) {
      var sel = $("topic-select");
      var keys = snap.exists() ? Object.keys(snap.val()) : [];
      keys.sort(function (a, b) { return a.localeCompare(b); });
      keys.forEach(function (k) {
        existingTopics[k.toLowerCase()] = k;
        var opt = document.createElement("option");
        opt.value = k;
        opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
        sel.insertBefore(opt, sel.querySelector('option[value="__new__"]'));
      });
    });
  }

  // Toggles
  $("anon").addEventListener("change", function () {
    var on = this.checked;
    $("anon-note").hidden = !on;
    $("me-name").style.opacity = on ? "0.45" : "1";
  });
  $("topic-select").addEventListener("change", function () {
    var isNew = this.value === "__new__";
    $("topic-new").hidden = !isNew;
    if (isNew) $("topic-new").focus();
  });
  $("cw-toggle").addEventListener("change", function () {
    $("cw-text").hidden = !this.checked;
    $("cw-note").hidden = !this.checked;
    if (this.checked) $("cw-text").focus();
  });

  function resolveTopic() {
    var sel = $("topic-select").value;
    if (sel && sel !== "__new__") return sel;
    var raw = $("topic-new").value.trim().replace(/[.#$\[\]/]/g, "");
    if (!raw) return null;
    var match = existingTopics[raw.toLowerCase()];
    if (match) return match; // reuse existing topic, exact key
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  $("share-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!me || !profile) return;
    var content = $("content").value.trim();
    var topic = resolveTopic();
    if (!topic) return msg("error", "Please choose a topic or name a new one.");
    if (!content) return msg("error", "Your story can't be empty — even a sentence is enough.");

    var name = $("anon").checked ? "Anonymous" : profile.username;
    var post = { uid: me.uid, content: content, name: name, timestamp: TS };
    if ($("cw-toggle").checked && $("cw-text").value.trim()) {
      post.cw = $("cw-text").value.trim();
    }

    var btn = $("share-btn");
    btn.disabled = true; btn.textContent = "Sharing…";

    var ref = db.ref("uploads/" + topic).push();
    var postId = ref.key;
    ref.set(post)
      .then(function () {
        // Keep the user's own records in sync (same as before).
        return Promise.all([
          db.ref("users/" + me.uid + "/uploadCount").transaction(function (n) { return (n || 0) + 1; }),
          db.ref("users/" + me.uid + "/uploads/" + postId).set({
            topic: topic, preview: content.slice(0, 120), timestamp: TS,
          }),
        ]);
      })
      .then(function () {
        msg("success", "Your story is live. Thank you for sharing 💛");
        setTimeout(function () {
          location.href = "post?topic=" + encodeURIComponent(topic) + "&postId=" + encodeURIComponent(postId);
        }, 1100);
      })
      .catch(function (err) {
        console.error("[upload] failed", err);
        msg("error", "Something went wrong. Please try again.");
        btn.disabled = false; btn.textContent = "Share your story";
      });
  });
})();
