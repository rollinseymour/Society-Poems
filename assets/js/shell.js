/*
  shell.js — shared page shell + utilities for Society Poems
  ----------------------------------------------------------
  One source of truth for the site header, footer, theme toggle, mobile
  nav, and the auth/username pattern that used to be copy-pasted into
  every page.

  A page opts in by:
    1. <body data-page="read"> ... </body>
    2. placing <div id="site-header"></div> and <div id="site-footer"></div>
    3. loading firebase compat + firebase-config.js + this file

  Public helpers (window.SP):
    SP.observe(cb)      -> cb(user, profile) on every auth change (no redirect)
    SP.requireAuth(cb)  -> like observe, but redirects guests to /login and
                           users without a username back to /login to finish
    SP.initials(name)   -> "AB" style initials for avatars
    SP.escapeHTML(str)  -> safe text for innerHTML
    SP.timeAgo(ts)      -> "3h ago" relative time
    SP.toast(msg, type) -> transient notification ("success" | "error" | "")
    SP.isAdmin(uid)     -> boolean
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
    var diff = Date.now() - ts;
    var s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    if (d < 7) return d + "d ago";
    var date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
    requestAnimationFrame(function () {
      el.classList.add("show");
    });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () {
        el.remove();
      }, 300);
    }, 3600);
  };

  /* ------------------------------------------------------------- markup */
  var NAV = [
    { href: "/", label: "Home", page: "home" },
    { href: "read", label: "Read", page: "read" },
    { href: "upload", label: "Share", page: "upload" },
    { href: "livechat", label: "Live Circles", page: "livechat" },
    { href: "resources", label: "Get help", page: "resources" },
    { href: "profile", label: "Profile", page: "profile", auth: "user" },
  ];

  var brandSVG = '<span class="brand-logo" aria-hidden="true"></span>';

  function navItems(active) {
    return NAV.map(function (n) {
      var cls = n.page === active ? "active" : "";
      var auth = n.auth ? ' data-auth="' + n.auth + '"' : "";
      return '<li' + auth + '><a href="' + n.href + '" class="' + cls + '">' + n.label + "</a></li>";
    }).join("");
  }

  function headerHTML(active) {
    return (
      '<header class="site-header"><div class="container nav">' +
      '<a href="/" class="brand" aria-label="Society Poems home">' +
      '<span class="brand-name">' + brandSVG + " Society Poems</span>" +
      '<span class="brand-tagline">Society’s Stories</span></a>' +
      '<ul class="nav-links" id="nav-links">' +
      navItems(active) +
      '<li class="nav-mobile-cta" data-auth="guest" style="margin-top:1rem;"><a href="login" class="btn btn-primary btn-block">Sign in</a></li>' +
      '<li class="nav-mobile-cta" data-auth="user" style="margin-top:1rem;"><button type="button" class="btn btn-ghost btn-block" data-action="logout">Log out</button></li>' +
      "</ul>" +
      '<div class="nav-actions">' +
      '<a href="login" class="btn btn-ghost btn-sm nav-desktop-cta" data-auth="guest">Sign in</a>' +
      '<a href="profile" class="avatar nav-desktop-cta" data-auth="user" id="nav-avatar" title="Your profile" style="text-decoration:none;">?</a>' +
      '<button type="button" class="btn btn-ghost btn-sm nav-desktop-cta" data-auth="user" data-action="logout">Log out</button>' +
      '<button id="theme-toggle" class="icon-btn" type="button" aria-label="Switch theme">' +
      '<svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      '<svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14.4A8 8 0 1 1 9.6 4a6.4 6.4 0 0 0 10.4 10.4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>' +
      '<button id="nav-toggle" class="icon-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
      "</div></div></header><div class=\"nav-backdrop\" id=\"nav-backdrop\"></div>"
    );
  }

  function footerHTML() {
    return (
      '<footer class="site-footer"><div class="container">' +
      '<div class="footer-grid">' +
      '<div class="footer-brand"><span class="brand-name">' + brandSVG + " Society Poems</span>" +
      "<p>A warm, global space to share the stories of your life and find support from people who understand. Society’s Stories — written by all of us.</p></div>" +
      '<div class="footer-col"><h4>Explore</h4><a href="read">Read stories</a><a href="upload">Share yours</a><a href="livechat">Live Circles</a></div>' +
      '<div class="footer-col"><h4>Support</h4><a href="resources">Get help now</a><a href="feedback">Send feedback</a><a href="login" data-auth="guest">Sign in</a><a href="profile" data-auth="user">Your profile</a></div>' +
      '<div class="footer-col"><h4>Legal</h4><a href="privacy-policy">Privacy Policy</a><a href="tos">Terms of Service</a></div>' +
      "</div>" +
      '<div class="footer-bottom"><span>&copy; 2026 Society Poems · Society’s Stories</span>' +
      "<span>Made with care for people sharing their stories.</span></div>" +
      "</div></footer>"
    );
  }

  /* ----------------------------------------------------------- behavior */
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sp-theme", theme);
    } catch (e) {}
  }

  function wireTheme() {
    var t = document.getElementById("theme-toggle");
    if (!t) return;
    t.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      setTheme(cur === "dark" ? "light" : "dark");
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
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", close);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function wireLogout() {
    document.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (SP.auth) SP.auth.signOut().then(function () { window.location.href = "/"; });
      });
    });
  }

  // Show/hide elements marked data-auth="user" | "guest"
  function applyAuthVisibility(user) {
    var state = user ? "user" : "guest";
    document.querySelectorAll("[data-auth]").forEach(function (el) {
      el.style.display = el.getAttribute("data-auth") === state ? "" : "none";
    });
  }

  function setAvatar(profile, user) {
    var av = document.getElementById("nav-avatar");
    if (!av) return;
    var name = (profile && profile.username) || (user && user.email) || "";
    av.textContent = SP.initials(name);
  }

  /* --------------------------------------------------------- auth flows */
  function fetchProfile(uid) {
    if (!SP.db) return Promise.resolve(null);
    return SP.db
      .ref("users/" + uid)
      .once("value")
      .then(function (snap) {
        return snap.exists() ? snap.val() : null;
      })
      .catch(function () {
        return null;
      });
  }

  // Public pages: observe without forcing login.
  SP.observe = function (cb) {
    if (!SP.auth) {
      applyAuthVisibility(null);
      if (cb) cb(null, null);
      return;
    }
    SP.auth.onAuthStateChanged(function (user) {
      if (!user) {
        applyAuthVisibility(null);
        if (cb) cb(null, null);
        return;
      }
      fetchProfile(user.uid).then(function (profile) {
        applyAuthVisibility(user);
        setAvatar(profile, user);
        if (cb) cb(user, profile);
      });
    });
  };

  // Protected pages: require a logged-in user WITH a username.
  SP.requireAuth = function (cb) {
    if (!SP.auth) return;
    SP.auth.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.href = "login";
        return;
      }
      fetchProfile(user.uid).then(function (profile) {
        if (!profile || !profile.username) {
          window.location.href = "login";
          return;
        }
        applyAuthVisibility(user);
        setAvatar(profile, user);
        document.body.classList.add("ready");
        if (cb) cb(user, profile);
      });
    });
  };

  /* -------------------------------------------------------------- boot */
  document.addEventListener("DOMContentLoaded", function () {
    var active = document.body.getAttribute("data-page") || "";
    var h = document.getElementById("site-header");
    var f = document.getElementById("site-footer");
    if (h) h.outerHTML = headerHTML(active);
    if (f) f.outerHTML = footerHTML();
    wireTheme();
    wireMobile();
    wireLogout();
    applyAuthVisibility(null); // default to guest view until auth resolves
    // Keep the nav (Sign in vs. avatar/Log out) in sync with auth on every page.
    if (SP.auth) SP.observe();
  });
})();
