const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

/**
 * Gmail credentials.
 * Prefers environment variables (set them in functions/.env — see .env.example),
 * and falls back to the legacy functions.config() values so existing deploys keep
 * working. functions.config() is deprecated by Google, so migrating to .env is
 * recommended.
 */
const legacyGmail = (() => {
  try {
    return functions.config().gmail || {};
  } catch (e) {
    return {};
  }
})();
const GMAIL_EMAIL = process.env.GMAIL_EMAIL || legacyGmail.email;
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD || legacyGmail.password;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_EMAIL, pass: GMAIL_PASSWORD },
});

// Minimal HTML escaping so feedback content can't inject markup into the email.
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email the admin when new feedback is submitted.
 * Accepts either `username` (current site) or `name` (legacy) for the sender.
 */
exports.sendFeedbackEmail = functions.database
  .ref("/feedback/{pushId}")
  .onCreate((snapshot) => {
    const fb = snapshot.val() || {};
    const sender = fb.username || fb.name || "Someone";
    if (!GMAIL_EMAIL || !GMAIL_PASSWORD) {
      console.error("Gmail credentials are not configured; skipping feedback email.");
      return null;
    }
    const mailOptions = {
      from: `Society Poems Feedback <${GMAIL_EMAIL}>`,
      to: GMAIL_EMAIL,
      replyTo: fb.email || GMAIL_EMAIL,
      subject: `New feedback from ${sender}`,
      html:
        `<p>You have received new feedback on Society Poems.</p><ul>` +
        `<li><b>From:</b> ${esc(sender)}</li>` +
        `<li><b>Email:</b> ${esc(fb.email)}</li>` +
        `<li><b>Message:</b> ${esc(fb.message)}</li></ul>`,
    };
    return transporter.sendMail(mailOptions);
  });

/**
 * When a user is deleted from Firebase Auth, remove their RTDB profile and
 * release their username reservation so it can be reused.
 */
exports.cleanupUser = functions.auth.user().onDelete(async (user) => {
  const db = admin.database();
  const snap = await db.ref(`/users/${user.uid}/username`).once("value");
  const username = snap.val();

  const updates = { [`/users/${user.uid}`]: null };
  if (username) {
    updates[`/usernames/${String(username).toLowerCase()}`] = null;
  }
  return db.ref().update(updates);
});
