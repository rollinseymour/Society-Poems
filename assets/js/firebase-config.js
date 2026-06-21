/*
  firebase-config.js — single source of truth for Firebase init
  -------------------------------------------------------------
  Replaces the Firebase config that was previously copy-pasted inline
  into every page. Load AFTER the Firebase compat SDK scripts:

    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
    <script src="/assets/js/firebase-config.js"></script>

  Exposes a small namespace on window.SP that every page can use:
    SP.auth, SP.db, SP.ADMIN_UID
*/
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyDHXEMtVPn46b2qS1CPGUIEuQ8ntLyvLVM",
    authDomain: "society-poems-97f4d.firebaseapp.com",
    databaseURL: "https://society-poems-97f4d-default-rtdb.firebaseio.com",
    projectId: "society-poems-97f4d",
    storageBucket: "society-poems-97f4d.firebasestorage.app",
    messagingSenderId: "723670230106",
    appId: "1:723670230106:web:6d6dda4f8c46626c55a463",
  };

  // Guard against double init if a page accidentally includes this twice.
  if (!window.firebase) {
    console.error("[SP] Firebase SDK not loaded before firebase-config.js");
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.SP = window.SP || {};
  window.SP.auth = firebase.auth();
  window.SP.db = firebase.database();
  window.SP.ADMIN_UID = "SAD2VGjLrtVA80Cg0ay71rDiijQ2";
})();
