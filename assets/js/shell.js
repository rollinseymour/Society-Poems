/*
  shell.js — shared behavior + utilities for Society Poems
  --------------------------------------------------------
  The header and footer now live as static HTML in every page (so they render
  instantly with no flash on navigation). This file ENHANCES that static markup:
  it marks the active nav link, wires the theme toggle + mobile drawer + logout,
  keeps the nav in sync with auth state, and exposes shared helpers.

  Public helpers (window.SP):
    SP.observe(cb)      -> cb(user, profile) on every auth change (no redirect)
    SP.requireAuth(cb)  -> like observe, but redirects guests to /login and
                           users without a username back to /login to finish
    SP.initials / escapeHTML / timeAgo / toast / isAdmin
*/
(function () {
  "use strict";

  var SP = (window.SP = window.SP || {});

  /* ----------------------------------------------------------- helpers */
  SP.initials = function (name) {
    if (!name) return "?";
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  SP.escapeHTML = function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  SP.timeAgo = function (ts) {
    if (!ts) return "";
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    if (d < 7) return d + "d ago";
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  SP.isAdmin = function (uid) {
    return !!uid && uid === SP.ADMIN_UID;
  };

  SP.toast = function (msg, type) {
    var wrap = document.querySelector(".sp-toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "sp-toasts";
      document.body.appendChild(wrap);
    }
    var el = document.createElement("div");
    el.className = "sp-toast" + (type ? " " + type : "");
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 300);
    }, 3600);
  };

  /* ----------------------------------------------------------- behavior */
  function setActive(page) {
    if (!page) return;
    var link = document.querySelector('.nav-links a[data-nav="' + page + '"]');
    if (link) link.classList.add("active");
  }

  function wireTheme() {
    var t = document.getElementById("theme-toggle");
    if (!t) return;
    t.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("sp-theme", next); } catch (e) {}
    });
  }

  function wireMobile() {
    var toggle = document.getElementById("nav-toggle");
    var menu = document.getElementById("nav-links");
    var backdrop = document.getElementById("nav-backdrop");
    if (!toggle || !menu) return;
    function close() {
      menu.classList.remove("open");
      if (backdrop) backdrop.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    function open() {
      menu.classList.add("open");
      if (backdrop) backdrop.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    toggle.addEventListener("click", function () {
      menu.classList.contains("open") ? close() : open();
    });
    if (backdrop) backdrop.addEventListener("click", close);
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  function wireLogout() {
    document.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (SP.auth) SP.auth.signOut().then(function () { window.location.href = "/"; });
      });
    });
  }

  function applyAuthVisibility(user) {
    var state = user ? "user" : "guest";
    document.querySelectorAll("[data-auth]").forEach(function (el) {
      el.style.display = el.getAttribute("data-auth") === state ? "" : "none";
    });
    document.body.classList.add("auth-ready");
  }

  function setAvatar(profile, user) {
    var av = document.getElementById("nav-avatar");
    if (!av) return;
    av.textContent = SP.initials((profile && profile.username) || (user && user.email) || "");
  }

  /* --------------------------------------------------------- auth flows */
  function fetchProfile(uid) {
    if (!SP.db) return Promise.resolve(null);
    return SP.db.ref("users/" + uid).once("value")
      .then(function (snap) { return snap.exists() ? snap.val() : null; })
      .catch(function () { return null; });
  }

  SP.observe = function (cb) {
    if (!SP.auth) { applyAuthVisibility(null); if (cb) cb(null, null); return; }
    SP.auth.onAuthStateChanged(function (user) {
      if (!user) { applyAuthVisibility(null); if (cb) cb(null, null); return; }
      fetchProfile(user.uid).then(function (profile) {
        applyAuthVisibility(user);
        setAvatar(profile, user);
        if (cb) cb(user, profile);
      });
    });
  };

  SP.requireAuth = function (cb) {
    if (!SP.auth) return;
    SP.auth.onAuthStateChanged(function (user) {
      if (!user) { window.location.href = "login"; return; }
      fetchProfile(user.uid).then(function (profile) {
        if (!profile || !profile.username) { window.location.href = "login"; return; }
        applyAuthVisibility(user);
        setAvatar(profile, user);
        document.body.classList.add("ready");
        if (cb) cb(user, profile);
      });
    });
  };

  /* -------------------------------------------------------------- boot */
  document.addEventListener("DOMContentLoaded", function () {
    setActive(document.body.getAttribute("data-page") || "");
    wireTheme();
    wireMobile();
    wireLogout();
    applyAuthVisibility(null); // default to guest view until auth resolves
    if (SP.auth) SP.observe();
  });
})();
