/*
  livechat.js — Live Circles (real-time support rooms)
  Public to browse/read; creating, joining and sending require sign-in.
  Data: chatRooms/{id} = {topic, description, createdBy, createdByName, createdAt, lastActivity}
        chatRooms/{id}/messages/{mid} = {content, uid, username, timestamp}
        chatRooms/{id}/activeUsers/{uid} = {username, joinedAt}
*/
(function () {
  "use strict";
  var db = window.SP.db;
  var TS = firebase.database.ServerValue.TIMESTAMP;
  var $ = function (id) { return document.getElementById(id); };
  function countKeys(o) { return o ? Object.keys(o).length : 0; }

  var me = null, profile = null;
  var room = null; // {id}
  var msgRef = null, activeRef = null, myActiveRef = null;

  window.SP.observe(function (user, prof) { me = user; profile = prof; });

  /* ---------------- rooms list ---------------- */
  db.ref("chatRooms").on("value", function (snap) {
    if (room) return; // don't re-render the list while inside a room
    var rooms = snap.val() || {};
    var ids = Object.keys(rooms);
    var grid = $("rooms-grid");
    $("rooms-stat").textContent = ids.length
      ? ids.length + (ids.length === 1 ? " circle open" : " circles open")
      : "No circles open yet";
    if (!ids.length) {
      grid.innerHTML = "";
      $("rooms-empty").classList.remove("hidden");
      return;
    }
    $("rooms-empty").classList.add("hidden");
    // newest first
    ids.sort(function (a, b) { return (rooms[b].createdAt || 0) - (rooms[a].createdAt || 0); });
    grid.innerHTML = ids.map(function (id) {
      var r = rooms[id];
      var n = countKeys(r.activeUsers);
      return (
        '<article class="circle-card" data-room="' + id + '">' +
        "<h3>" + window.SP.escapeHTML(r.topic || "A circle") + "</h3>" +
        '<p class="c-desc">' + window.SP.escapeHTML(r.description || "A space to talk and be heard.") + "</p>" +
        '<div class="c-foot"><span>by ' + window.SP.escapeHTML(r.createdByName || "someone") + "</span>" +
        "<span><span class='live-dot'></span>" + n + " here</span></div></article>"
      );
    }).join("");
    grid.querySelectorAll(".circle-card").forEach(function (card) {
      card.addEventListener("click", function () { openRoom(card.getAttribute("data-room"), rooms[card.getAttribute("data-room")]); });
    });
  });

  /* ---------------- open / leave a room ---------------- */
  function openRoom(id, r) {
    room = { id: id };
    $("rooms-view").hidden = true;
    $("room-view").hidden = false;
    $("room-topic").textContent = r.topic || "Circle";

    // Join (logged-in only)
    if (me && profile) {
      myActiveRef = db.ref("chatRooms/" + id + "/activeUsers/" + me.uid);
      myActiveRef.set({ username: profile.username, joinedAt: TS });
      myActiveRef.onDisconnect().remove();
    }

    // Messages (show recent context for everyone)
    var box = $("messages");
    box.innerHTML = '<div class="sys-msg">You are in the circle. Be gentle with each other. 💛</div>';
    msgRef = db.ref("chatRooms/" + id + "/messages").orderByChild("timestamp").limitToLast(200);
    msgRef.on("value", function (snap) {
      var items = [];
      snap.forEach(function (m) { items.push(m.val()); });
      renderMessages(items);
    });

    // Active count
    activeRef = db.ref("chatRooms/" + id + "/activeUsers");
    activeRef.on("value", function (snap) {
      var n = countKeys(snap.val());
      $("room-active").textContent = n + (n === 1 ? " here" : " here");
    });
  }

  function renderMessages(items) {
    var box = $("messages");
    var head = '<div class="sys-msg">Be gentle with each other. 💛</div>';
    if (!items.length) {
      box.innerHTML = head + '<div class="sys-msg">No messages yet — say hello.</div>';
      return;
    }
    box.innerHTML = head + items.map(function (m) {
      var mine = me && m.uid === me.uid;
      return (
        '<div class="msg' + (mine ? " mine" : "") + '">' +
        '<span class="avatar" style="width:32px;height:32px;font-size:.72rem;">' + window.SP.initials(m.username) + "</span>" +
        '<div class="bubble"><div class="who">' + window.SP.escapeHTML(m.username || "Someone") + "</div>" +
        '<div class="txt">' + window.SP.escapeHTML(m.content) + "</div>" +
        '<div class="when">' + window.SP.timeAgo(m.timestamp) + "</div></div></div>"
      );
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  function leaveRoom() {
    if (msgRef) { msgRef.off(); msgRef = null; }
    if (activeRef) { activeRef.off(); activeRef = null; }
    if (myActiveRef) { myActiveRef.onDisconnect().cancel(); myActiveRef.remove(); myActiveRef = null; }
    room = null;
    $("room-view").hidden = true;
    $("rooms-view").hidden = false;
    db.ref("chatRooms").once("value"); // nudge list re-render via existing listener on next change
  }
  $("leave-btn").addEventListener("click", leaveRoom);
  window.addEventListener("beforeunload", function () {
    if (myActiveRef) myActiveRef.remove();
  });

  /* ---------------- send ---------------- */
  $("composer").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!me || !profile || !room) return;
    var input = $("msg-input");
    var text = input.value.trim();
    if (!text) return;
    db.ref("chatRooms/" + room.id + "/messages").push({
      content: text, uid: me.uid, username: profile.username, timestamp: TS,
    });
    db.ref("chatRooms/" + room.id + "/lastActivity").set(TS);
    input.value = "";
  });

  /* ---------------- create a circle ---------------- */
  var modal = $("circle-modal");
  function openModal() {
    if (!me || !profile) { window.SP.toast("Please sign in to start a circle"); return; }
    modal.classList.add("open");
    $("circle-topic").focus();
  }
  $("new-circle-btn").addEventListener("click", openModal);
  $("empty-new-btn").addEventListener("click", openModal);
  $("circle-cancel").addEventListener("click", function () { modal.classList.remove("open"); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.classList.remove("open"); });
  $("circle-create").addEventListener("click", function () {
    if (!me || !profile) return;
    var topic = $("circle-topic").value.trim();
    if (!topic) { window.SP.toast("Give your circle a name"); return; }
    var ref = db.ref("chatRooms").push();
    ref.set({
      topic: topic,
      description: $("circle-desc").value.trim(),
      createdBy: me.uid,
      createdByName: profile.username,
      createdAt: TS,
      lastActivity: TS,
    }).then(function () {
      modal.classList.remove("open");
      $("circle-topic").value = "";
      $("circle-desc").value = "";
      openRoom(ref.key, { topic: topic });
    }).catch(function () { window.SP.toast("Couldn’t create circle", "error"); });
  });
})();
