/* ==========================================================================
   BargaiNest Pilot — app.js
   Vanilla JS single-page app.

   Pilot frontend: authentication, API-backed wallet and customer actions.
   ========================================================================== */

const ICONS = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',

  wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',

  ai: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 17l-1.9-5.3L5 9.8l5.1-1.9L12 3Z"/><path d="M5 19l.9 2.1L8 22l-2.1.9L5 19Z"/></svg>',

  profile: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',

  bell: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',

  search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',

  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',

  chevronLeft: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',

  chevronRight: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6 6-6-6"/></svg>',

  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',

  star: (filled) =>
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="' +
    (filled ? "#F2C14E" : "none") +
    '" stroke="' +
    (filled ? "#F2C14E" : "currentColor") +
    '" stroke-width="2" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1L12 2Z"/></svg>',

  alert: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',

  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>',

  camera: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>',

  grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',

  list: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',

  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',

  copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',

  walletSmall: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H5a3 3 0 0 1 0-6h14v4"/><path d="M4 7h17v14H4a2 2 0 0 1-2-2V5"/><path d="M16 13h5"/></svg>',

  gift: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8Zm0 0h4.5a2.5 2.5 0 1 0 0-5C14 3 12 8 12 8Z"/></svg>',

  clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};


async function apiPatchLocal(path, body) {
  return cloudFetchJson(path, {
    method: "PATCH",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function apiDeleteLocal(path) {
  return cloudFetchJson(path, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
}


const App = {

  data: null,

  view: "home",

  overlay: null,

  overlayStep: null,

  query: "",

  addQuery: "",

  categoryFilter: "All",

  walletView: "list",

  addRetailer: null,

  cardNumber: "",

  capturedPhoto: null,

  scanning: false,

  confirmRemoveId: null,

  detailCardId: null,

  toastTimer: null,

  clockTimer: null,

  refreshTimer: null,

  authScreen: "login",

  authError: "",

  authRoute: null,

  authRouteToken: "",

  authRouteMessage: "",

  busy: false,

  profile: null,

  profileBusy: false,

  profileError: "",

  shoppingLists: [],

  selectedShoppingListId: null,

  shoppingListBusy: false,

  shoppingListError: "",

  shoppingListValue: null,


  /* ========================================================================
     INIT
     ======================================================================== */

  async init() {

    const pathname = window.location.pathname || "";
    const searchParams = new URLSearchParams(window.location.search || "");

    if (/\/reset-password\/?$/i.test(pathname)) {
      this.authRoute = "reset-password";
      this.authRouteToken = searchParams.get("token") || "";
      this.renderAuthRoute();
      return;
    }

    if (/\/verify-email\/?$/i.test(pathname)) {
      this.authRoute = "verify-email";
      this.authRouteToken = searchParams.get("token") || "";
      this.renderAuthRoute();
      return;
    }

    this.view =
      (location.hash || "#home")
        .replace("#", "") || "home";

    if (!["home", "wallet", "shopping", "ai", "profile"].includes(this.view)) {
      this.view = "home";
    }

    window.addEventListener("hashchange", () => {
      this.view = (location.hash || "#home").replace("#", "") || "home";
      this.overlay = null;
      this.overlayStep = null;
      this.addRetailer = null;
      this.cardNumber = "";
      this.capturedPhoto = null;
      this.confirmRemoveId = null;
      this.detailCardId = null;
      this.selectedShoppingListId = null;
      this.shoppingListError = "";
      this.renderAll();
    });

    await this.bootstrapAuth();

    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);

    this.refreshTimer = setInterval(async () => {
      if (!this.data) return;
      const active = document.activeElement;
      const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      if (!typing && !this.overlay && !this.busy) {
        try {
          this.data = await loadPilotState();
          await this.loadShoppingLists();
          this.offlineMode = false;
          this.cacheWalletStateForOffline();
          this.renderAll();
        } catch (e) {
          if (e.status === 401) this.handleLogout(false);
          // Any other error here (network blip during a background
          // refresh) intentionally leaves this.data untouched --
          // whatever's currently on screen (live or already-cached)
          // keeps showing rather than being cleared by a failed
          // refresh attempt.
        }
      }
    }, 60000);

  },


  async bootstrapAuth() {
    try {
      this.busy = true;
      this.data = await loadPilotState();
      await this.loadShoppingLists();
      this.authError = "";
      this.offlineMode = false;
      this.cacheWalletStateForOffline();
      this.renderAll();
    } catch (error) {
      if (error.status === 401) {
        // Genuinely not authenticated -- must NOT fall back to a
        // cached wallet here. Showing a previous session's cached
        // data to someone who isn't currently logged in would be a
        // real privacy problem, not a convenience.
        this.data = null;
        this.authError = "";
        this.renderAll();
      } else {
        // Looks like a network failure, not an auth failure -- fall
        // back to the last successfully cached wallet state, if one
        // exists, rather than showing a hard error screen with no
        // way to see your cards at all.
        const cached = this.loadCachedWalletState();
        if (cached) {
          this.data = cached.data;
          this.offlineMode = true;
          this.offlineCachedAt = cached.cachedAt;
          this.authError = "";
        } else {
          this.data = null;
          this.authError = this.userFacingError(error);
        }
        this.renderAll();
      }
    } finally {
      this.busy = false;
      // If bootstrap ends unauthenticated, render once more after clearing
      // busy so the initial auth button cannot remain stuck on “Please wait…”.
      if (!this.data) this.renderAuth();
    }
  },

  /*
   * BN-031: offline wallet card display. Caches the last successfully
   * loaded wallet state (cards, accounts, retailer catalogue) to
   * localStorage so cards can still be viewed -- read-only -- when a
   * later load fails due to no network connection. Deliberately only
   * used as a fallback on a NETWORK failure, never on a 401: an
   * offline cache must never substitute for real authentication.
   */
  cacheWalletStateForOffline() {
    try {
      localStorage.setItem(
        "bn_offline_wallet_cache",
        JSON.stringify({ data: this.data, cachedAt: Date.now() })
      );
    } catch (e) {
      // Storage full or unavailable (private browsing, etc.) -- offline
      // display simply won't be available this session. Not worth
      // surfacing as an error for what's already a best-effort feature.
    }
  },

  loadCachedWalletState() {
    try {
      const raw = localStorage.getItem("bn_offline_wallet_cache");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  },


  userFacingError(error) {
    if (!error) return "Something went wrong. Please try again.";
    return error.message || "Something went wrong. Please try again.";
  },


  renderAuth() {
    const root = document.getElementById("view-root");
    if (!root) return;
    document.body.classList.add("auth-mode");


    if (this.authScreen === "forgot-password") {
      root.innerHTML =
        '<div class="auth-shell"><div class="auth-card">' +
        '<img class="auth-logo" src="images/bargainest-master.svg?v=4" alt="BargaiNest — Store. Shop. Save.">' +
        '<div class="auth-eyebrow">PASSWORD RECOVERY</div>' +
        '<h1>Forgot your password?</h1>' +
        '<p class="auth-intro">Enter your email address and, if it is registered with BargaiNest, we will send you a password reset link.</p>' +
        '<form id="forgot-password-form" class="auth-form">' +
        '<label class="field-label" for="forgot-password-email">Email address</label>' +
        '<input id="forgot-password-email" class="text-input" type="email" autocomplete="email" required placeholder="you@example.com">' +
        (this.authError ? '<div class="auth-error">' + this.authError + '</div>' : '') +
        (this.authRouteMessage ? '<div class="auth-note">' + this.authRouteMessage + '</div>' : '') +
        '<button class="btn btn-primary btn-block" type="submit" ' + (this.busy ? "disabled" : "") + '>' +
        (this.busy ? "Please wait…" : "Send reset link") +
        '</button>' +
        '</form>' +
        '<div class="auth-switch"><button type="button" class="auth-link" data-action="back-to-login">Back to sign in</button></div>' +
        '</div></div>';

      this.bindForgotPassword();
      return;
    }



    const register = this.authScreen === "register";
    root.innerHTML =
      '<div class="auth-shell"><div class="auth-card">' +
      '<img class="auth-logo" src="images/bargainest-master.svg?v=4" alt="BargaiNest — Store. Shop. Save.">' +
      '<div class="auth-eyebrow">BARGAINEST PILOT</div>' +
      '<h1>' + (register ? "Create your BargaiNest account" : "Welcome back") + '</h1>' +
      '<p class="auth-intro">' + (register ? "Register first, then add your loyalty cards to your personal wallet." : "Sign in to access your personal loyalty wallet.") + '</p>' +
      '<form id="auth-form" class="auth-form">' +
      '<label class="field-label" for="auth-email">Email address</label>' +
      '<input id="auth-email" class="text-input" type="email" autocomplete="email" required placeholder="you@example.com">' +
      '<label class="field-label" for="auth-password">Password</label>' +
      '<input id="auth-password" class="text-input" type="password" autocomplete="' + (register ? "new-password" : "current-password") + '" required minlength="8" placeholder="At least 8 characters">' +
      (this.authError ? '<div class="auth-error">' + this.authError + '</div>' : '') +
      '<button class="btn btn-primary btn-block" type="submit" ' + (this.busy ? "disabled" : "") + '>' + (this.busy ? "Please wait…" : (register ? "Create account" : "Sign in")) + '</button>' +
      '</form>' +
      '<div class="auth-switch">' + (register ? "Already have an account?" : "New to BargaiNest?") +
      ' <button type="button" class="auth-link" data-action="auth-toggle">' + (register ? "Sign in" : "Create an account") + '</button></div>' +
      (!register ? '<div style="text-align:center;margin-top:10px;"><button type="button" class="auth-link" data-action="forgot-password">Forgot password?</button></div>' : '') +
      '<p class="auth-note">Your loyalty data is stored against your authenticated BargaiNest account.</p>' +
      '</div></div>';
    this.bindAuth();
  },



  /* ========================================================================
     BN-026 / BN-023 — PASSWORD RECOVERY + EMAIL VERIFICATION ROUTES
     ======================================================================== */

  renderAuthRoute() {
    document.body.classList.add("auth-mode");

    const root = document.getElementById("view-root");
    if (!root) return;

    if (this.authRoute === "reset-password") {
      if (!this.authRouteToken) {
        root.innerHTML =
          '<div class="auth-shell"><div class="auth-card">' +
          '<img class="auth-logo" src="images/bargainest-master.svg?v=4" alt="BargaiNest — Store. Shop. Save.">' +
          '<div class="auth-eyebrow">PASSWORD RESET</div>' +
          '<h1>Invalid reset link</h1>' +
          '<p class="auth-intro">This password reset link is missing its security token.</p>' +
          '<button type="button" class="btn btn-primary btn-block" data-action="back-to-login">Return to sign in</button>' +
          '</div></div>';
        this.root_click_bind("view-root");
        return;
      }

      root.innerHTML =
        '<div class="auth-shell"><div class="auth-card">' +
        '<img class="auth-logo" src="images/bargainest-master.svg?v=4" alt="BargaiNest — Store. Shop. Save.">' +
        '<div class="auth-eyebrow">PASSWORD RESET</div>' +
        '<h1>Set a new password</h1>' +
        '<p class="auth-intro">Choose a new password for your BargaiNest account.</p>' +
        '<form id="reset-password-form" class="auth-form">' +
        '<label class="field-label" for="reset-password">New password</label>' +
        '<input id="reset-password" class="text-input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required placeholder="At least 8 characters">' +
        '<label class="field-label" for="reset-password-confirm">Confirm new password</label>' +
        '<input id="reset-password-confirm" class="text-input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required placeholder="Enter the password again">' +
        (this.authError ? '<div class="auth-error">' + this.authError + '</div>' : '') +
        '<button class="btn btn-primary btn-block" type="submit" ' + (this.busy ? "disabled" : "") + '>' +
        (this.busy ? "Please wait…" : "Reset password") +
        '</button>' +
        '</form>' +
        '</div></div>';

      const form = document.getElementById("reset-password-form");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          this.submitPasswordReset();
        });
      }
      return;
    }

    if (this.authRoute === "verify-email") {
      root.innerHTML =
        '<div class="auth-shell"><div class="auth-card">' +
        '<img class="auth-logo" src="images/bargainest-master.svg?v=4" alt="BargaiNest — Store. Shop. Save.">' +
        '<div class="auth-eyebrow">EMAIL VERIFICATION</div>' +
        '<h1>' + (this.busy ? "Verifying your email…" : (this.authRouteMessage ? "Email verified" : "Verify your email")) + '</h1>' +
        '<p class="auth-intro">' +
        (this.busy
          ? "Please wait while we confirm your verification link."
          : (this.authRouteMessage || "Your verification link will be checked now.")) +
        '</p>' +
        (this.authError ? '<div class="auth-error">' + this.authError + '</div>' : '') +
        (!this.busy ? '<button type="button" class="btn btn-primary btn-block" data-action="back-to-login">Continue to sign in</button>' : '') +
        '</div></div>';

      this.root_click_bind("view-root");

      if (!this.busy && !this.authRouteMessage && !this.authError) {
        this.submitEmailVerification();
      }
    }
  },


  async submitPasswordReset() {
    const password = String(document.getElementById("reset-password")?.value || "");
    const confirmation = String(document.getElementById("reset-password-confirm")?.value || "");

    if (password.length < 8) {
      this.authError = "Your password must be at least 8 characters.";
      this.renderAuthRoute();
      return;
    }

    if (password !== confirmation) {
      this.authError = "The passwords do not match.";
      this.renderAuthRoute();
      return;
    }

    this.busy = true;
    this.authError = "";
    this.renderAuthRoute();

    try {
      await apiPost("/auth/password-reset/confirm", {
        token: this.authRouteToken,
        newPassword: password
      });

      this.busy = false;
      this.authRoute = null;
      this.authRouteToken = "";
      this.authRouteMessage = "";
      this.authScreen = "login";
      this.authError = "";
      history.replaceState(
        {},
        document.title,
        window.location.pathname.replace(/\/(?:reset-password|verify-email)\/?$/i, "/")
      );
      this.renderAuth();
      this.toast("Password reset successfully. Please sign in.");
    } catch (error) {
      this.busy = false;
      this.authError =
        error.status === 400
          ? (error.message || "This reset link is invalid or has expired.")
          : this.userFacingError(error);
      this.renderAuthRoute();
    }
  },


  async submitEmailVerification() {
    if (!this.authRouteToken) {
      this.authError = "This verification link is missing its security token.";
      this.renderAuthRoute();
      return;
    }

    this.busy = true;
    this.authError = "";
    this.renderAuthRoute();

    try {
      const result = await apiPost("/auth/email-verification/confirm", {
        token: this.authRouteToken
      });

      this.busy = false;
      this.authRoute = null;
      this.authRouteToken = "";
      this.authRouteMessage =
        (result && result.message) ||
        "Your email address has been verified.";
      this.authScreen = "login";
      this.authError = "";
      history.replaceState(
        {},
        document.title,
        window.location.pathname.replace(/\/(?:reset-password|verify-email)\/?$/i, "/")
      );
      this.renderAuth();
      this.toast("Email address verified successfully. Please sign in.");
    } catch (error) {
      this.busy = false;
      this.authError =
        error.status === 400
          ? (error.message || "This verification link is invalid or has expired.")
          : this.userFacingError(error);
      this.renderAuthRoute();
    }
  },


  async submitForgotPassword() {
    const email = String(document.getElementById("forgot-password-email")?.value || "")
      .trim()
      .toLowerCase();

    if (!email) {
      this.authError = "Please enter your email address.";
      this.renderAuth();
      return;
    }

    this.busy = true;
    this.authError = "";
    this.authRouteMessage = "";
    this.renderAuth();

    try {
      const result = await apiPost("/auth/password-reset/request", { email });

      this.busy = false;
      this.authRouteMessage =
        (result && result.message) ||
        "If that email address is registered, a password reset link has been sent.";
      this.renderAuth();
    } catch (error) {
      this.busy = false;
      /* The backend intentionally uses a generic response for this
         endpoint, so do not expose account-existence information. */
      this.authError = this.userFacingError(error);
      this.renderAuth();
    }
  },


  bindForgotPassword() {
    const form = document.getElementById("forgot-password-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitForgotPassword();
      });
    }
    this.root_click_bind("view-root");
  },


  bindAuth() {
    const form = document.getElementById("auth-form");
    if (form) form.addEventListener("submit", (e) => { e.preventDefault(); this.submitAuth(); });
    this.root_click_bind("view-root");
  },


  async submitAuth() {
    const email = String(document.getElementById("auth-email")?.value || "").trim().toLowerCase();
    const password = String(document.getElementById("auth-password")?.value || "");
    if (!email || !password) return;
    this.busy = true;
    this.authError = "";
    this.renderAuth();
    try {
      this.data = this.authScreen === "register"
        ? await registerPilot(email, password)
        : await loginPilot(email, password);
      await this.loadShoppingLists();
      this.busy = false;
      this.renderAll();
    } catch (error) {
      this.busy = false;
      this.authError = this.userFacingError(error);
      this.renderAuth();
    }
  },


  async handleLogout(showMessage) {
    this.busy = true;
    await logoutPilot();
    this.busy = false;
    this.data = null;
    this.authScreen = "login";
    this.authError = "";
    this.renderAll();
    if (showMessage) this.toast("Signed out");
  },


  async loadShoppingLists() {
    if (!this.data) {
      this.shoppingLists = [];
      this.selectedShoppingListId = null;
      return;
    }

    const payload = await apiGet("/me/shopping-lists");
    this.shoppingLists = Array.isArray(payload)
      ? payload
      : (payload && Array.isArray(payload.data) ? payload.data : []);

    if (!this.shoppingLists.some((list) => list.id === this.selectedShoppingListId)) {
      this.selectedShoppingListId = this.shoppingLists[0]?.id || null;
    }

    await this.loadShoppingListValue();
    await this.loadShoppingIntelligence();
  },

  async loadShoppingListValue() {
    this.shoppingListValue = null;
    if (!this.selectedShoppingListId) return;
    try {
      const payload = await apiGet('/me/shopping-lists/' + encodeURIComponent(this.selectedShoppingListId) + '/value');
      this.shoppingListValue = payload && payload.data ? payload.data : payload;
    } catch (error) {
      this.shoppingListValue = null;
    }
  },

  async loadShoppingIntelligence() {
    this.shoppingIntelligence = null;
    const userId = this.data && this.data.user && this.data.user.id;
    if (!userId) return;
    try {
      const payload = await apiGet('/users/' + encodeURIComponent(userId) + '/intelligence-feed');
      this.shoppingIntelligence = payload && payload.data ? payload.data : payload;
    } catch (error) {
      // Intelligence is additive. A feed failure must not prevent shopping lists from loading.
      this.shoppingIntelligence = null;
    }
  },

  ensureShoppingNav() {
    const sidebar = document.querySelector(".sidebar-nav");
    if (sidebar && !sidebar.querySelector('[data-nav="shopping"]')) {
      const button = document.createElement("button");
      button.className = "sidebar-link";
      button.dataset.nav = "shopping";
      button.setAttribute("onclick", "App.setView('shopping')");
      button.innerHTML = ICONS.list + "<span>Shopping Lists</span>";
      sidebar.insertBefore(button, sidebar.querySelector('[data-nav="ai"]') || null);
    }

    const bottom = document.querySelector(".bottom-nav");
    if (bottom && !bottom.querySelector('[data-nav="shopping"]')) {
      const button = document.createElement("button");
      button.className = "bottom-nav-link";
      button.dataset.nav = "shopping";
      button.setAttribute("onclick", "App.setView('shopping')");
      button.innerHTML = ICONS.list + "<span class=\"label\">Lists</span>";
      bottom.insertBefore(button, bottom.querySelector('[data-nav="ai"]') || null);
    }
  },

  ensureShoppingStyles() {
    if (document.getElementById("bargainest-shopping-styles")) return;
    const style = document.createElement("style");
    style.id = "bargainest-shopping-styles";
    style.textContent = `
      .shopping-layout { display:grid; grid-template-columns:minmax(220px,0.7fr) minmax(0,1.5fr); gap:18px; }
      .shopping-list-selector { padding:8px; }
      .shopping-list-selector .profile-row { width:100%; }
      .shopping-list-detail { min-width:0; }
      @media (max-width: 760px) {
        .shopping-layout { grid-template-columns:1fr; }
        .shopping-item-row { grid-template-columns:minmax(0,1fr) 70px 100px 36px !important; }
        .shopping-summary { grid-template-columns:1fr !important; }
        #shopping-item-form { grid-template-columns:minmax(0,1fr) 70px 100px auto !important; }
      }
      @media (max-width: 520px) {
        .shopping-item-row { grid-template-columns:minmax(0,1fr) 64px 92px 32px !important; gap:6px !important; }
        .shopping-summary { grid-template-columns:1fr !important; }
        #shopping-item-form { grid-template-columns:1fr 64px 92px !important; }
        #shopping-item-form button { grid-column:1 / -1; }
      }
    `;
    document.head.appendChild(style);
  },


  setView(v) {

    location.hash = "#" + v;

    // When the app was started from a special auth route
    // (/reset-password or /verify-email), the normal hashchange
    // listener is not registered. Render immediately so menu
    // navigation still works after login without requiring refresh.
    this.view = v;
    this.overlay = null;
    this.overlayStep = null;
    this.addRetailer = null;
    this.cardNumber = "";
    this.capturedPhoto = null;
    this.confirmRemoveId = null;
    this.detailCardId = null;
    this.selectedShoppingListId = null;
    this.shoppingListError = "";
    this.renderAll();

  },


  openCard(id) {

    const card =
      this.data.cards.find(
        (c) => c.id === id
      );

    if (!card) {
      return;
    }

    this.detailCardId = id;

    this.confirmRemoveId = null;

    this.overlay = "cardDetail";

    this.renderOverlay();

  },


  /* ========================================================================
     GENERAL
     ======================================================================== */

  persist() {
    /* Loyalty data is API-backed. Only UI preferences are persisted locally. */
    return true;
  },


  toast(msg) {

    const root =
      document.getElementById(
        "toast-root"
      );

    if (!root) {
      return;
    }

    root.innerHTML =
      '<div class="toast">' +
      ICONS.check +
      "<span>" +
      msg +
      "</span></div>";

    clearTimeout(
      this.toastTimer
    );

    this.toastTimer =
      setTimeout(
        () => {
          root.innerHTML = "";
        },
        2400
      );

  },


  tickClock() {

    const { time, date } =
      liveClock();

    const t =
      document.getElementById(
        "clock-time"
      );

    const d =
      document.getElementById(
        "clock-date"
      );

    if (t) {
      t.textContent = time;
    }

    if (d) {
      d.textContent = date;
    }

  },


  renderAll() {

    if (!this.data) {
      this.renderAuth();
      return;
    }

    document.body.classList.remove("auth-mode");
    this.renderChrome();
    this.renderView();
    this.renderOverlay();

  },


  renderChrome() {

    this.ensureShoppingNav();
    this.ensureShoppingStyles();

    document
      .querySelectorAll("[data-nav]")
      .forEach(
        (el) => {

          el.classList.toggle(
            "active",
            el.dataset.nav === this.view
          );

        }
      );

    const initial =
      document.getElementById(
        "user-initial"
      );

    const name =
      document.getElementById(
        "user-name-display"
      );

    const email =
      document.getElementById(
        "user-role-display"
      );

    if (!this.data) {
      return;
    }

    if (initial) {
      initial.textContent =
        this.data.user.initial;
    }

    if (name) {
      name.textContent =
        this.data.user.name;
    }

    if (email) {
      email.textContent =
        this.data.user.email;
    }

  },


  renderView() {

    const root =
      document.getElementById(
        "view-root"
      );

    if (!root) {
      return;
    }

    let html = "";

    if (this.view === "home") {
      html = this.renderHome();
    }

    else if (this.view === "wallet") {
      html = this.renderWallet();
    }

    else if (this.view === "shopping") {
      html = this.renderShopping();
    }
    else if (this.view === "ai") {
      html = this.renderAi();
    }

    else {
      html = this.renderProfile();
    }

    root.innerHTML =
      '<div class="view-inner">' +
      html +
      "</div>";

    this.bindView();

  },


  /* ========================================================================
     HELPERS
     ======================================================================== */

  /**
   * REG-001: the dashboard hero panel previously showed a raw sum
   * across all cards, which reads as "R0.00 / 0 points" even when NO
   * card has ever actually synced -- indistinguishable from a
   * genuinely confirmed zero. Uses the same lastSyncedAt signal
   * already correctly used in Wallet's per-card view (see
   * rewardHeadline) and Insights' per-retailer breakdown, applied
   * here at the aggregate level: if the user has cards but none of
   * them has ever synced, there is nothing real to sum yet.
   */
  hasAnySyncedCard() {
    return this.data.cards.some((c) => c.lastSyncedAt);
  },

  /**
   * Prefers this.vouchers (set fresh whenever the Vouchers screen
   * itself has been opened via loadVouchers()) over
   * this.data.vouchers (populated once at app bootstrap) -- so a
   * voucher added/removed while browsing is reflected immediately,
   * without needing a full app reload, while still having real data
   * available on Home before the user ever visits Vouchers at all.
   */
  getWalletVouchersForDashboard() {
    if (Array.isArray(this.vouchers)) return this.vouchers;
    if (this.data && Array.isArray(this.data.vouchers)) return this.data.vouchers;
    return [];
  },

  totals() {

    const cards =
      this.data.cards;

    const value =
      cards.reduce(
        (s, c) =>
          s + Number(c.value || 0),
        0
      );

    const points =
      cards
        .filter(
          (c) =>
            c.rewardType === "points"
        )
        .reduce(
          (s, c) =>
            s + Number(c.points || 0),
          0
        );

    const cashback =
      cards
        .filter(
          (c) =>
            c.rewardType === "cashback"
        )
        .reduce(
          (s, c) =>
            s + Number(c.cashback || 0),
          0
        );

    const vouchers =
      cards
        .reduce(
          (s, c) =>
            s + Number(c.vouchers || 0),
          0
        );

    return {
      value,
      points,
      cashback,
      vouchers
    };

  },


  expiringCard() {

    return this.data.cards.find(
      (c) =>
        c.expiresAt &&
        c.expiresAt > Date.now()
    );

  },


  rewardHeadline(c) {

    // BN-025: a card that has never actually synced doesn't have a
    // confirmed value of zero -- it has no confirmed value at all.
    // Showing "0 pts" here implied the customer genuinely has zero
    // points/rewards, when the real situation is "we don't know yet".
    // c.lastSyncedAt is the same signal already used a few lines below
    // in the LIVE SYNC section to distinguish these states -- reused
    // here rather than inventing a second way to ask the same question.
    if (!c.lastSyncedAt) {
      return "Not yet synced";
    }

    if (
      c.rewardType === "points"
    ) {

      return (
        Number(c.points || 0)
          .toLocaleString("en-ZA") +
        " pts"
      );

    }

    if (
      c.rewardType === "cashback"
    ) {

      return formatRand(
        c.cashback
      );

    }

    if (
      c.rewardType === "voucher"
    ) {

      return (
        c.vouchers +
        (
          c.vouchers === 1
            ? " voucher"
            : " vouchers"
        )
      );

    }

    if (c.vouchers > 0) {

      return (
        c.vouchers +
        (
          c.vouchers === 1
            ? " voucher"
            : " vouchers"
        )
      );

    }

    return "Rewards";

  },


  rewardLabel(c) {

    if (
      c.rewardType === "points"
    ) {
      return "Points balance";
    }

    if (
      c.rewardType === "cashback"
    ) {
      return "Cashback balance";
    }

    if (
      c.rewardType === "voucher"
    ) {
      return "Available vouchers";
    }

    return "Rewards balance";

  },


  badge(retailer, size) {

    size = size || 42;

    return (
      '<div class="retailer-badge" style="width:' +
      size +
      "px;height:" +
      size +
      "px;background:" +
      retailer.color +
      ";font-size:" +
      Math.round(size * 0.36) +
      "px;color:" +
      retailer.textColor +
      '">' +
      retailer.initials +
      "</div>"
    );

  },


  /* ========================================================================
     STEP 3 — CONSISTENT BARCODE
     ======================================================================== */

  barcode(seed) {

    seed =
      String(seed || "");

    let hash = 0;

    for (
      let i = 0;
      i < seed.length;
      i++
    ) {

      hash =
        (
          hash * 31 +
          seed.charCodeAt(i)
        ) >>> 0;

    }

    let bars = "";

    for (
      let i = 0;
      i < 64;
      i++
    ) {

      hash =
        (
          hash * 1664525 +
          1013904223
        ) >>> 0;

      const width =
        1 + (hash % 3);

      bars +=
        '<span class="bar" style="width:' +
        width +
        'px"></span>';

    }

    return (
      '<div class="barcode">' +
      bars +
      "</div>"
    );

  },


  /* ========================================================================
     HOME
     ======================================================================== */

  renderOfflineBanner() {
    if (!this.offlineMode) return "";

    const cachedAtLabel = this.offlineCachedAt
      ? timeAgo(new Date(this.offlineCachedAt).toISOString())
      : "earlier";

    return (
      '<div class="auth-error" style="background:var(--gold-tint);color:var(--gold-deep);margin-bottom:14px;display:flex;align-items:center;gap:8px">' +
      '<span>You\'re offline — showing cards saved from ' + cachedAtLabel + '. Some information may be out of date.</span>' +
      "</div>"
    );
  },

  renderHome() {

    const t =
      this.totals();

    const expiring =
      this.expiringCard();

    const g =
      liveGreeting();

    let html = "";

    html += this.renderOfflineBanner();

    html +=
      '<div class="greeting-row"><div><div class="greeting-title">' +
      g +
      ", " +
      this.data.user.name.split(" ")[0] +
      " — welcome back!</div></div></div>";

    html +=
      '<div class="hero-panel"><div class="hero-label">Total rewards value</div>';

    // REG-001: cards.length > 0 but hasAnySyncedCard() false means
    // every card is genuinely unsynced -- nothing real to report yet,
    // as opposed to a wallet with zero cards at all (nothing to sync,
    // R0.00 is the honest answer there) or cards that have actually
    // synced and confirmed a real total (possibly a real zero).
    const pendingSync =
      this.data.cards.length > 0 && !this.hasAnySyncedCard();

    html +=
      '<div class="hero-value" id="hero-count">' +
      (pendingSync ? "Pending sync" : formatRand(t.value)) +
      "</div>";

    html +=
      '<div class="hero-caption">Across ' +
      this.data.cards.length +
      " loyalty cards</div>";

    html +=
      '<div class="hero-stats">';

    html +=
      '<div class="hero-stat"><div class="num">' +
      (pendingSync ? "—" : t.points.toLocaleString("en-ZA")) +
      '</div><div class="lbl">' + (pendingSync ? "Pending sync" : "Points") + '</div></div>';

    html +=
      '<div class="hero-stat"><div class="num">' +
      (pendingSync ? "—" : formatRand(t.cashback)) +
      '</div><div class="lbl">' + (pendingSync ? "Pending sync" : "Cashback") + '</div></div>';

    // REG-001 follow-up: manually-captured wallet vouchers are never
    // "pending sync" -- combining them with the sync-derived voucher
    // count, matching the same logic in the Insights overlay.
    const activeWalletVoucherCount = this.getWalletVouchersForDashboard().filter((v) => v.effectiveStatus === "ACTIVE").length;
    const combinedDashboardVoucherCount = (pendingSync ? 0 : t.vouchers) + activeWalletVoucherCount;
    const dashboardVouchersPending = pendingSync && activeWalletVoucherCount === 0;

    html +=
      '<div class="hero-stat"><div class="num">' +
      (dashboardVouchersPending ? "Pending sync" : combinedDashboardVoucherCount) +
      '</div><div class="lbl">Vouchers</div></div>';

    html += "</div></div>";

    if (expiring) {

      const days =
        daysUntil(
          expiring.expiresAt
        );

      html +=
        '<button class="alert-banner" data-action="open-card" data-id="' +
        expiring.id +
        '">' +
        ICONS.alert +
        '<div><div class="title">Rewards expiring soon</div><div class="detail">' +
        (
          expiring.expiringPoints ||
          0
        ) +
        " pts at " +
        retailerOf(
          expiring.retailerId
        ).name +
        " expire in " +
        days +
        (
          days === 1
            ? " day"
            : " days"
        ) +
        "</div></div>" +
        ICONS.chevronRight +
        "</button>";

    }

    html +=
      '<div class="quick-actions">';

    html +=
      '<button class="btn btn-primary" data-action="open-add">' +
      ICONS.plus +
      " Add a card</button>";

    html +=
      '<button class="btn btn-secondary" data-action="goto-wallet">View wallet</button>';

    html +=
      '<button class="btn btn-secondary" data-action="open-promotions">' +
      "Browse specials</button>";

    html +=
      '<button class="btn btn-secondary" data-action="open-insights">' +
      "My insights</button>";

    html +=
      '<button class="btn btn-secondary" data-action="open-receipt-scan">' +
      "Scan receipt</button>";

    html +=
      '<button class="btn btn-secondary" data-action="open-vouchers">' +
      "My vouchers</button>";

    html +=
      '<button class="btn btn-secondary" data-action="open-purchases">' +
      "Purchase history</button>";

    html += "</div>";

    html +=
      '<div class="grid-2">';

    html +=
      '<div><div class="panel-title">Recent activity</div><div class="panel">';

    const allActivity = [];

    this.data.cards.forEach(
      (c) => {

        (
          c.activity || []
        ).forEach(
          (a) => {

            allActivity.push(
              Object.assign(
                {},
                a,
                {
                  retailerId:
                    c.retailerId
                }
              )
            );

          }
        );

      }
    );

    allActivity.sort(
      (a, b) =>
        b.at - a.at
    );

    allActivity
      .slice(0, 5)
      .forEach(
        (a) => {

          const r =
            retailerOf(
              a.retailerId
            );

          html +=
            '<div class="activity-row">' +
            this.badge(r, 34) +
            '<div><div class="label">' +
            a.label +
            '</div><div class="meta">' +
            r.name +
            " · " +
            timeAgo(a.at) +
            "</div></div><div class=\"amount\">" +
            a.detail +
            "</div></div>";

        }
      );

    if (
      allActivity.length === 0
    ) {

      html +=
        '<div class="empty-state">No activity yet.</div>';

    }

    html += "</div></div>";

    html +=
      '<div><div class="panel-title">Your cards</div><div class="panel">';

    this.data.cards
      .slice(0, 4)
      .forEach(
        (c) => {

          const r =
            retailerOf(
              c.retailerId
            );

          html +=
            '<div class="activity-row" data-action="open-card" data-id="' +
            c.id +
            '" style="cursor:pointer">' +
            this.badge(r, 34) +
            '<div><div class="label">' +
            r.name +
            '</div><div class="meta">' +
            c.category +
            "</div></div><div class=\"amount\">" +
            this.rewardHeadline(c) +
            "</div></div>";

        }
      );

    html += "</div></div>";

    html += "</div>";

    return html;

  },


  /* ========================================================================
     WALLET
     ======================================================================== */

  renderWallet() {

    const cats =
      ["All"].concat(
        Array.from(
          new Set(
            this.data.cards.map(
              (c) =>
                c.category
            )
          )
        )
      );

    const filtered =
      this.data.cards.filter(
        (c) => {

          const r =
            retailerOf(
              c.retailerId
            );

          const matchCat =
            this.categoryFilter ===
              "All" ||
            c.category ===
              this.categoryFilter;

          const search =
            this.query
              .toLowerCase();

          const matchQuery =
            !search ||
            r.name
              .toLowerCase()
              .includes(search) ||
            String(
              c.displayMemberNo || ""
            )
              .toLowerCase()
              .includes(search) ||
            String(
              c.memberNo || ""
            )
              .toLowerCase()
              .includes(search);

          return (
            matchCat &&
            matchQuery
          );

        }
      );

    let html = "";

    html += this.renderOfflineBanner();

    html +=
      '<div class="wallet-toolbar"><h2 class="section-title" style="margin:0">Your wallet</h2>';

    html +=
      '<div style="display:flex;gap:10px;align-items:center">';

    html +=
      '<div class="view-toggle"><button data-action="view-list" class="' +
      (
        this.walletView ===
        "list"
          ? "active"
          : ""
      ) +
      '">' +
      ICONS.list +
      '</button><button data-action="view-grid" class="' +
      (
        this.walletView ===
        "grid"
          ? "active"
          : ""
      ) +
      '">' +
      ICONS.grid +
      "</button></div>";

    html +=
      '<button class="btn btn-primary" data-action="open-add" style="display:none" id="wallet-add-btn">' +
      ICONS.plus +
      " Add card</button>";

    html += "</div></div>";

    html +=
      '<div class="search-bar">' +
      ICONS.search +
      '<input id="wallet-search-input" placeholder="Search your cards" value="' +
      this.query.replace(
        /"/g,
        "&quot;"
      ) +
      '"></div>';

    html +=
      '<div class="chip-row">';

    cats.forEach(
      (c) => {

        html +=
          '<button class="chip ' +
          (
            this.categoryFilter ===
            c
              ? "active"
              : ""
          ) +
          '" data-action="filter-cat" data-cat="' +
          c +
          '">' +
          c +
          "</button>";

      }
    );

    html += "</div>";

    if (
      filtered.length === 0
    ) {

      html +=
        '<div class="empty-state">No cards match your search.</div>';

    }

    else if (
      this.walletView ===
      "list"
    ) {

      filtered.forEach(
        (c) => {

          const r =
            retailerOf(
              c.retailerId
            );

          html +=
            '<button class="wallet-list-row" data-action="open-card" data-id="' +
            c.id +
            '">' +

            this.badge(r) +

            '<div style="min-width:0"><div class="name">' +
            r.name +
            '</div><div class="sub">' +
            c.category +
            " · " +
            c.tier +
            '</div><div class="sub">' +
            (
              c.displayMemberNo ||
              maskMembershipNumber(
                c.memberNo
              )
            ) +
            "</div></div>" +

            '<div class="balance">' +
            this.rewardHeadline(c) +
            "</div>" +

            '<span class="fav-btn" data-action="toggle-fav" data-id="' +
            c.id +
            '" data-stop="1">' +
            ICONS.star(
              c.favourite
            ) +
            "</span>" +

            "</button>";

        }
      );

    }

    else {

      html +=
        '<div class="wallet-grid">';

      filtered.forEach(
        (c) => {

          const r =
            retailerOf(
              c.retailerId
            );

          html +=
            '<button class="wallet-grid-tile" style="background:' +
            r.color +
            '" data-action="open-card" data-id="' +
            c.id +
            '">' +

            '<div class="top-row"><span class="tier-badge">' +
            c.tier +
            '</span><span data-action="toggle-fav" data-id="' +
            c.id +
            '" data-stop="1">' +
            ICONS.star(
              c.favourite
            ) +
            "</span></div>" +

            '<div><div class="name">' +
            r.name +
            '</div><div class="balance">' +
            this.rewardHeadline(c) +
            "</div><div style=\"font-size:11px;opacity:.8;margin-top:4px\">" +
            (
              c.displayMemberNo ||
              maskMembershipNumber(
                c.memberNo
              )
            ) +
            "</div></div>" +

            "</button>";

        }
      );

      html += "</div>";

    }

    html +=
      '<button class="fab" data-action="open-add" aria-label="Add a loyalty card">' +
      ICONS.plus +
      "</button>";

    return html;

  },


  /* ========================================================================
     SHOPPING LISTS
     ======================================================================== */
  renderShopping() {
    const lists = Array.isArray(this.shoppingLists) ? this.shoppingLists : [];
    let selected = lists.find((list) => list.id === this.selectedShoppingListId);
    if (!selected && lists.length) {
      selected = lists[0];
      this.selectedShoppingListId = selected.id;
    }

    let html = '<div class="wallet-toolbar"><div><h2 class="section-title" style="margin:0">Shopping lists</h2>' +
      '<div class="pilot-card-note" style="margin-top:6px">Build a basket and let BargaiNest find the best value across retailers.</div></div>' +
      '<button class="btn btn-primary" data-action="create-shopping-list">' + ICONS.plus + ' New list</button></div>';

    if (this.shoppingListError) html += '<div class="auth-error" style="margin:14px 0">' + this.escapeHtml(this.shoppingListError) + '</div>';

    if (!lists.length) {
      html += '<div class="panel" style="margin-top:18px"><div class="empty-state">You do not have any shopping lists yet.</div>' +
        '<div style="display:flex;justify-content:center;margin-top:14px"><button class="btn btn-secondary" data-action="create-shopping-list">Create your first list</button></div></div>';
      return html;
    }

    html += '<div class="shopping-layout" style="margin-top:18px">';
    html += '<div class="panel shopping-list-selector">';
    lists.forEach((list) => {
      const active = selected && list.id === selected.id;
      const activeItems = (list.items || []).filter((item) => String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
      html += '<button class="profile-row" style="text-align:left;' + (active ? 'background:var(--navy-tint);' : '') + '" data-action="select-shopping-list" data-id="' + list.id + '">' +
        '<span><strong>' + this.escapeHtml(list.name) + '</strong><small style="display:block;color:var(--grey-faint);margin-top:3px">' + activeItems.length + (activeItems.length === 1 ? ' item' : ' items') + '</small></span>' + ICONS.chevronRight + '</button>';
    });
    html += '</div>';

    html += '<div class="panel shopping-list-detail">';
    if (selected) {
      const activeItems = (selected.items || []).filter((item) => String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
      const value = this.shoppingListValue && this.shoppingListValue.shoppingListId === selected.id ? this.shoppingListValue : null;
      const valueItems = value && Array.isArray(value.items) ? value.items : [];
      const valueByItem = new Map(valueItems.map((item) => [item.itemId, item]));
      const summary = value ? value.summary || {} : {};
      const baskets = Array.isArray(summary.retailerBaskets) ? summary.retailerBaskets : [];
      const cheapest = summary.cheapestRetailerName || null;
      const basketSavings = Number(summary.basketSavings);
      const targetSavings = Number(summary.potentialSavings);

      html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div class="panel-title" style="margin:0">' + this.escapeHtml(selected.name) + '</div>' +
        '<div style="font-size:12px;color:var(--grey-faint);margin-top:4px">' + activeItems.length + (activeItems.length === 1 ? ' item' : ' items') + '</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn btn-ghost" data-action="rename-shopping-list" data-id="' + selected.id + '">Rename</button>' +
        '<button class="btn btn-ghost" style="color:#b42318" data-action="delete-shopping-list" data-id="' + selected.id + '">Delete</button>' +
        '<button class="btn btn-ghost" data-action="complete-shopping-list" data-id="' + selected.id + '">Complete</button>' +
        '</div></div>';

      if (value) {
        const comparable = Number(summary.comparableItems) || 0;
        const unmatched = Number(summary.itemsWithoutProduct) || 0;
        const bestBasket = Number(summary.bestKnownBasketValue);
        html += '<div class="shopping-summary" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px">' +
          '<div class="panel" style="padding:14px;background:var(--navy-tint)"><div style="font-size:12px;color:var(--grey-faint)">Best basket</div><strong style="display:block;font-size:20px;margin-top:4px">' + (Number.isFinite(bestBasket) ? formatRand(bestBasket) : '—') + '</strong><div style="font-size:11px;color:var(--grey-faint);margin-top:3px">' + (cheapest ? 'At ' + this.escapeHtml(cheapest) : 'Complete basket comparison pending') + '</div></div>' +
          '<div class="panel" style="padding:14px"><div style="font-size:12px;color:var(--grey-faint)">Basket savings</div><strong style="display:block;font-size:20px;margin-top:4px;color:var(--green)">' + (Number.isFinite(basketSavings) && basketSavings > 0 ? formatRand(basketSavings) : '—') + '</strong><div style="font-size:11px;color:var(--grey-faint);margin-top:3px">Compared with the highest complete basket</div></div>' +
          '<div class="panel" style="padding:14px"><div style="font-size:12px;color:var(--grey-faint)">Target savings</div><strong style="display:block;font-size:20px;margin-top:4px;color:var(--green)">' + (Number.isFinite(targetSavings) && targetSavings > 0 ? formatRand(targetSavings) : '—') + '</strong><div style="font-size:11px;color:var(--grey-faint);margin-top:3px">Against your target prices</div></div>' +
          '</div>';

        if (baskets.length) {
          html += '<div class="panel" style="margin-top:14px;padding:14px"><div class="panel-title" style="margin:0">Retailer basket comparison</div><div style="font-size:12px;color:var(--grey-faint);margin-top:4px">Complete baskets (every item available) are ranked first; partial baskets are shown too so you can weigh a missing item against a lower price.</div>';
          let shownBestBadge = false;
          baskets.forEach((basket) => {
            const isBest = basket.isComplete && !shownBestBadge;
            if (isBest) shownBestBadge = true;
            const partialBadge = basket.isComplete ? '' :
              '<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;background:var(--gold-tint);color:var(--gold-deep);font-size:10px;font-weight:600;vertical-align:middle">MISSING ' + basket.missingItemCount + (basket.missingItemCount === 1 ? ' ITEM' : ' ITEMS') + '</span>';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)">' +
              '<div style="min-width:0"><strong>' + (isBest ? '🏆 ' : '') + this.escapeHtml(basket.retailerName) + '</strong>' + partialBadge + '<div style="font-size:11px;color:var(--grey-faint);margin-top:2px">' + basket.itemCount + ' of ' + comparable + ' comparable items</div></div>' +
              '<strong>' + formatRand(basket.basketValue) + '</strong></div>';
          });
          html += '</div>';
        } else if (activeItems.length) {
          html += '<div class="panel" style="margin-top:14px;padding:14px;background:var(--surface-muted)"><strong>Basket comparison needs matched retailer offers</strong><div style="font-size:12px;color:var(--grey-faint);margin-top:4px">BargaiNest needs a current comparable retailer offer for each item before it can compare complete retailer baskets.</div></div>';
        }

        const mixedBasket = summary.mixedBasket;
        if (mixedBasket && Array.isArray(mixedBasket.assignments) && mixedBasket.assignments.length) {
          const mixedSavings = Number(mixedBasket.savingsVsBestCompleteBasket) || 0;
          html += '<div class="panel" style="margin-top:14px;padding:14px;border-left:4px solid var(--green)"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><div class="panel-title" style="margin:0">Absolute cheapest — split across ' + mixedBasket.retailerCount + (mixedBasket.retailerCount === 1 ? ' store' : ' stores') + '</div><div style="font-size:12px;color:var(--grey-faint);margin-top:4px">Buying each item at whichever retailer currently has it cheapest.</div></div>' +
            '<div style="text-align:right;flex-shrink:0"><strong style="display:block;font-size:18px;color:var(--green-deep)">' + formatRand(mixedBasket.totalValue) + '</strong>' + (mixedSavings > 0 ? '<div style="font-size:11px;color:var(--green-deep);margin-top:2px">' + formatRand(mixedSavings) + ' less than your best single-store basket</div>' : '<div style="font-size:11px;color:var(--grey-faint);margin-top:2px">Same as your best single-store basket</div>') + '</div></div>';
          if (mixedBasket.retailerCount > 1) {
            html += '<div style="margin-top:10px">';
            mixedBasket.assignments.forEach((assignment) => {
              html += '<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12px"><span style="color:var(--grey-faint)">' + this.escapeHtml(assignment.description) + '</span><span>' + this.escapeHtml(assignment.retailerName) + ' · ' + formatRand(assignment.lineValue) + '</span></div>';
            });
            html += '</div>';
          }
          html += '</div>';
        }

        if (unmatched > 0) {
          html += '<div class="panel" style="margin-top:14px;padding:14px;border-left:4px solid var(--gold)"><div class="panel-title" style="margin:0">Items needing a match</div><div style="font-size:12px;color:var(--grey-faint);margin-top:4px">BargaiNest could not confidently match these items to a current retailer offer yet.</div>';
          valueItems.filter((item) => !item.comparable).forEach((item) => {
            html += '<div style="padding:9px 0;border-bottom:1px solid var(--line)"><strong>' + this.escapeHtml(item.description || 'Item') + '</strong><div style="font-size:11px;color:var(--grey-faint);margin-top:2px">Needs a current retailer offer</div></div>';
          });
          html += '</div>';
        }
      } else if (activeItems.length) {
        html += '<div class="panel" style="margin-top:18px;padding:14px;background:var(--surface-muted)"><strong>Calculating basket value…</strong><div style="font-size:12px;color:var(--grey-faint);margin-top:4px">BargaiNest is checking current retailer prices and offers.</div></div>';
      }

      html += '<div style="margin-top:18px">';
      if (!activeItems.length) {
        html += '<div class="empty-state">This list is empty. Add your first item below.</div>';
      } else {
        activeItems.forEach((item) => {
          const row = valueByItem.get(item.id);
          let priceText = 'Needs a current retailer offer';
          let promoBadge = '';
          if (row && row.bestPrice != null) {
            priceText = 'Best ' + formatRand(row.bestPrice) + (row.bestRetailerName ? ' at ' + this.escapeHtml(row.bestRetailerName) : '') + (Number(item.quantity || 1) !== 1 ? ' · Line ' + formatRand(row.lineValue) : '');
            if (row.bestObservedAt) {
              priceText += ' · Checked ' + timeAgo(row.bestObservedAt);
            }
            if (row.bestIsPromotion) {
              promoBadge = '<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;background:var(--green-tint);color:var(--green-deep);font-size:10px;font-weight:600;vertical-align:middle">SPECIAL' + (row.bestPromotionText ? ': ' + this.escapeHtml(row.bestPromotionText) : '') + '</span>';
            }
          } else if (row && row.targetStatus === 'NO_PRICE') {
            priceText = 'Price unavailable';
          }
          html += '<div class="shopping-item-row" style="display:grid;grid-template-columns:minmax(0,1fr) 82px 110px 36px;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)">' +
            '<div style="min-width:0"><input class="text-input" data-shopping-item-field="description" data-id="' + item.id + '" value="' + this.escapeAttr(item.description || '') + '" aria-label="Item description">' +
            '<div style="font-size:11px;color:var(--grey-faint);margin-top:4px">' + priceText + promoBadge + '</div></div>' +
            '<input class="text-input" data-shopping-item-field="quantity" data-id="' + item.id + '" type="number" min="1" step="1" value="' + this.escapeAttr(item.quantity == null ? '1' : item.quantity) + '" aria-label="Quantity">' +
            '<input class="text-input" data-shopping-item-field="targetPrice" data-id="' + item.id + '" type="number" min="0" step="0.01" value="' + this.escapeAttr(item.targetPrice == null ? '' : item.targetPrice) + '" placeholder="Target price" aria-label="Target price">' +
            '<button class="icon-btn" data-action="remove-shopping-item" data-id="' + item.id + '" aria-label="Remove item">' + ICONS.trash + '</button>' +
            '</div>';
        });
      }
      html += '</div>';
      html += '<form id="shopping-item-form" style="display:grid;grid-template-columns:minmax(0,1fr) 82px 110px auto;gap:8px;margin-top:16px">' +
        '<input id="shopping-item-description" class="text-input" placeholder="Add an item" required maxlength="191">' +
        '<input id="shopping-item-quantity" class="text-input" type="number" min="1" step="1" value="1" aria-label="Quantity">' +
        '<input id="shopping-item-target-price" class="text-input" type="number" min="0" step="0.01" placeholder="Target price" aria-label="Target price">' +
        '<button class="btn btn-secondary" type="submit" ' + (this.shoppingListBusy ? 'disabled' : '') + '>' + ICONS.plus + ' Add</button></form>';
    }
    html += '</div></div>';
    return html;
  },

  escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[char]);
  },

  escapeAttr(value) { return this.escapeHtml(value).replace(/'/g, '&#39;'); },

  async createShoppingList() {
    if (this.shoppingListBusy) return;
    const name = window.prompt('Name your shopping list');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) { this.toast('Please enter a list name'); return; }
    this.shoppingListBusy = true;
    this.shoppingListError = '';
    try {
      const created = await apiPost('/me/shopping-lists', { name: trimmed });
      this.shoppingLists = Array.isArray(this.shoppingLists) ? this.shoppingLists : [];
      this.shoppingLists.push(created);
      this.selectedShoppingListId = created.id;
      this.shoppingListValue = null;
      this.toast('Shopping list created');
      this.renderView();
    } catch (error) { this.shoppingListError = this.userFacingError(error); this.renderView(); }
    finally { this.shoppingListBusy = false; this.renderView(); }
  },

  async addShoppingItem() {
    if (this.shoppingListBusy || !this.selectedShoppingListId) return;
    const listId = this.selectedShoppingListId;
    const description = String(document.getElementById('shopping-item-description')?.value || '').trim();
    const quantityRaw = document.getElementById('shopping-item-quantity')?.value;
    const targetRaw = document.getElementById('shopping-item-target-price')?.value;
    if (!description) return;
    const quantity = Number(quantityRaw || 1);
    const targetPrice = targetRaw === '' || targetRaw == null ? undefined : Number(targetRaw);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity) || (targetPrice !== undefined && (!Number.isFinite(targetPrice) || targetPrice < 0))) {
      this.toast('Please enter valid item values'); return;
    }

    this.shoppingListBusy = true;
    this.shoppingListError = '';
    this.renderView();

    try {
      const item = await apiPost('/me/shopping-lists/' + encodeURIComponent(listId) + '/items', {
        description, quantity, ...(targetPrice !== undefined ? { targetPrice } : {})
      });
      const list = this.shoppingLists.find((entry) => entry.id === listId);
      if (list) {
        list.items = Array.isArray(list.items) ? list.items : [];
        list.items.push(item);
      }

      // The item is now usable immediately. Do not make the user wait for
      // the slower basket-value calculation before enabling another Add.
      this.shoppingListBusy = false;
      this.toast('Item added');
      this.renderView();

      // Refresh pricing/savings in the background. If the user has moved to
      // another list meanwhile, don't overwrite that list's displayed value.
      try {
        await this.loadShoppingListValue();
        if (this.selectedShoppingListId === listId) this.renderView();
      } catch (_) {
        // Pricing is additive; the saved shopping-list item remains valid.
      }
    } catch (error) {
      this.shoppingListBusy = false;
      this.shoppingListError = this.userFacingError(error);
      this.renderView();
    }
  },

  async updateShoppingItem(itemId, field, value) {
    const payload = {};
    if (field === 'description') {
      const text = String(value || '').trim();
      if (!text) { this.toast('Item description cannot be empty'); return; }
      payload.description = text;
    } else if (field === 'quantity') {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) { this.toast('Quantity must be greater than zero'); return; }
      if (!Number.isInteger(number)) { this.toast('Quantity must be a whole number of items'); return; }
      payload.quantity = number;
    } else if (field === 'targetPrice') {
      if (value === '') payload.targetPrice = null;
      else { const number = Number(value); if (!Number.isFinite(number) || number < 0) { this.toast('Target price must be zero or more'); return; } payload.targetPrice = number; }
    } else return;

    const listId = this.selectedShoppingListId;
    try {
      const updated = await apiPatchLocal('/me/shopping-list-items/' + encodeURIComponent(itemId), payload);
      const list = this.shoppingLists.find((entry) => entry.id === listId);
      const item = list && (list.items || []).find((entry) => entry.id === itemId);
      if (item && updated) Object.assign(item, updated);
      this.shoppingListError = '';
      this.toast('Item updated');
      this.renderView();

      // Recalculate value asynchronously so the edit remains responsive.
      await this.loadShoppingListValue();
      if (this.selectedShoppingListId === listId) this.renderView();
    } catch (error) {
      this.shoppingListError = this.userFacingError(error);
      this.renderView();
    }
  },

  async removeShoppingItem(itemId) {
    if (this.shoppingListBusy || !window.confirm('Remove this item from the list?')) return;
    const listId = this.selectedShoppingListId;
    this.shoppingListBusy = true;
    this.renderView();
    try {
      await apiDeleteLocal('/me/shopping-list-items/' + encodeURIComponent(itemId));
      const list = this.shoppingLists.find((entry) => entry.id === listId);
      if (list) list.items = (list.items || []).map((item) => item.id === itemId ? Object.assign({}, item, { status: 'REMOVED' }) : item);
      this.shoppingListBusy = false;
      this.toast('Item removed');
      this.renderView();
      await this.loadShoppingListValue();
      if (this.selectedShoppingListId === listId) this.renderView();
    } catch (error) {
      this.shoppingListBusy = false;
      this.shoppingListError = this.userFacingError(error);
      this.renderView();
    }
  },

  async renameShoppingList(listId) {
    if (this.shoppingListBusy) return;
    const list = (this.shoppingLists || []).find((entry) => entry.id === listId);
    if (!list) return;
    const name = window.prompt('Rename your shopping list', list.name || '');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) { this.toast('Please enter a list name'); return; }
    if (trimmed === String(list.name || '').trim()) return;
    this.shoppingListBusy = true;
    this.shoppingListError = '';
    try {
      const updated = await apiPatchLocal('/me/shopping-lists/' + encodeURIComponent(listId), { name: trimmed });
      if (updated) {
        const index = this.shoppingLists.findIndex((entry) => entry.id === listId);
        if (index >= 0) this.shoppingLists[index] = updated;
      } else {
        list.name = trimmed;
      }
      await this.loadShoppingListValue();
      this.toast('Shopping list renamed');
      this.renderView();
    } catch (error) { this.shoppingListError = this.userFacingError(error); this.renderView(); }
    finally { this.shoppingListBusy = false; this.renderView(); }
  },

  async deleteShoppingList(listId) {
    if (this.shoppingListBusy) return;
    const list = (this.shoppingLists || []).find((entry) => entry.id === listId);
    if (!list) return;
    const itemCount = (list.items || []).filter((item) => String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const message = itemCount
      ? 'Delete “' + String(list.name || 'this list') + '”? This will also delete its ' + itemCount + (itemCount === 1 ? ' item.' : ' items.')
      : 'Delete “' + String(list.name || 'this list') + '”?';
    if (!window.confirm(message)) return;
    this.shoppingListBusy = true;
    this.shoppingListError = '';
    try {
      await apiDeleteLocal('/me/shopping-lists/' + encodeURIComponent(listId));
      this.shoppingLists = (this.shoppingLists || []).filter((entry) => entry.id !== listId);
      this.selectedShoppingListId = this.shoppingLists[0]?.id || null;
      await this.loadShoppingListValue();
      this.toast('Shopping list deleted');
      this.renderView();
    } catch (error) { this.shoppingListError = this.userFacingError(error); this.renderView(); }
    finally { this.shoppingListBusy = false; this.renderView(); }
  },

  async completeShoppingList(listId) {
    if (this.shoppingListBusy || !window.confirm('Mark this shopping list as complete?')) return;
    this.shoppingListBusy = true;
    try {
      await apiPatchLocal('/me/shopping-lists/' + encodeURIComponent(listId), { status: 'COMPLETED' });
      this.shoppingLists = (this.shoppingLists || []).filter((list) => list.id !== listId);
      this.selectedShoppingListId = this.shoppingLists[0]?.id || null;
      this.shoppingListValue = null;
      this.toast('Shopping list completed');
      this.renderView();
    } catch (error) { this.shoppingListError = this.userFacingError(error); this.renderView(); }
    finally { this.shoppingListBusy = false; this.renderView(); }
  },

  /* ========================================================================
     AI
     ======================================================================== */

  renderAi() {

    let html = "";

    html +=
      '<h2 class="section-title">AI Assistant</h2>';

    html +=
      '<div class="ai-badge">' +
      ICONS.ai +
      " Arriving in Release 2</div>";

    html +=
      '<div class="ai-hero"><div class="lbl">Weekly insight</div><div class="quote">"This month you saved R420 using BargaiNest."</div></div>';

    const items = [
      {
        t: "Best retailer this week",
        d: "BargaiNest can recommend where your usual basket goes furthest."
      },
      {
        t: "Reward expiry risk",
        d: "Points close to expiring will surface here automatically."
      },
      {
        t: "Savings prediction",
        d: "Following current recommendations could save you money next month."
      }
    ];

    items.forEach(
      (it) => {

        html +=
          '<button class="ai-card" data-action="ai-teaser">' +
          '<div class="t">' +
          it.t +
          '</div><div class="d">' +
          it.d +
          "</div></button>";

      }
    );

    html +=
      '<div class="ai-input">' +
      ICONS.search +
      '<input disabled placeholder="Ask about your loyalty rewards…"></div>';

    return html;

  },


  /* ========================================================================
     PROFILE
     ======================================================================== */

  renderProfile() {

    const u =
      this.data.user;

    let html = "";

    html +=
      '<h2 class="section-title">Profile</h2>';

    html +=
      '<div class="profile-head" style="margin-top:16px"><div class="profile-avatar">' +
      u.initial +
      '</div><div><div class="profile-name">' +
      u.name +
      '</div><div class="profile-email">' +
      u.email +
      "</div></div></div>";

    html +=
      '<div class="panel">';

    html +=
      '<button class="profile-row" data-action="edit-profile">' +
      "<span>Account details</span>" +
      ICONS.chevronRight +
      "</button>";

    const profileRows = [
      { label: "My location", action: "open-location" },
      { label: "Household management", action: "open-household" },
      { label: "Notifications", action: "open-notifications" },
      { label: "Privacy & consent", action: "open-privacy" },
      { label: "Purchase history", action: "open-purchases" },
      { label: "Support", action: "open-support" }
    ];

    profileRows.forEach(
      (r) => {

        html +=
          '<button class="profile-row" data-action="' + r.action + '">' +
          "<span>" +
          r.label +
          "</span>" +
          ICONS.chevronRight +
          "</button>";

      }
    );

    html += "</div>";

    html +=
      '<div style="margin-top:24px"><button class="btn btn-ghost" data-action="logout">Sign out</button></div>';

    html +=
      '<p style="font-size:11.5px;color:var(--grey-faint);margin-top:10px">Your loyalty accounts and cards are managed by the BargaiNest backend.</p>';

    return html;

  },


  /* ========================================================================
     OVERLAY
     ======================================================================== */

  renderOverlay() {

    const root =
      document.getElementById(
        "overlay-root"
      );

    if (!root) {
      return;
    }

    if (!this.overlay) {
      root.innerHTML = "";
      return;
    }

    let inner = "";

    if (
      this.overlay ===
      "add"
    ) {

      inner =
        this.renderAddOverlay();

    }

    else if (
      this.overlay ===
      "cardDetail"
    ) {

      inner =
        this.renderCardDetailOverlay();

    }

    else if (this.overlay === "profileEdit") {
      inner = this.renderProfileEditOverlay();
    }

    else if (this.overlay === "household") {
      inner = this.renderHouseholdOverlay();
    }

    else if (this.overlay === "notifications") {
      inner = this.renderNotificationsOverlay();
    }

    else if (this.overlay === "privacy") {
      inner = this.renderPrivacyOverlay();
    }

    else if (this.overlay === "support") {
      inner = this.renderSupportOverlay();
    }

    else if (this.overlay === "promotions") {
      inner = this.renderPromotionsOverlay();
    }

    else if (this.overlay === "insights") {
      inner = this.renderInsightsOverlay();
    }

    else if (this.overlay === "vouchers") {
      inner = this.renderVouchersOverlay();
    }

    else if (this.overlay === "voucher-detail") {
      inner = this.renderVoucherDetailOverlay();
    }

    else if (this.overlay === "location") {
      inner = this.renderLocationOverlay();
    }

    else if (this.overlay === "receiptScan") {
      inner = this.renderReceiptScanOverlay();
    }

    else if (this.overlay === "purchases") {
      inner = this.renderPurchasesOverlay();
    }

    else if (this.overlay === "purchaseDetail") {
      inner = this.renderPurchaseDetailOverlay();
    }

    root.innerHTML =
      '<div class="overlay-backdrop" id="overlay-backdrop"><div class="overlay-panel">' +
      inner +
      "</div></div>";

    const backdrop =
      document.getElementById(
        "overlay-backdrop"
      );

    if (backdrop) {

      backdrop.addEventListener(
        "click",
        (e) => {

          if (
            e.target ===
            backdrop
          ) {

            this.closeOverlay();

          }

        }
      );

    }

    this.bindOverlay();

  },


  /* ========================================================================
     ADD CARD
     ======================================================================== */

  renderAddOverlay() {

    let html = "";

    if (
      this.overlayStep ===
        "details" &&
      this.addRetailer
    ) {

      const r =
        this.addRetailer;

      html +=
        '<div class="overlay-header"><button class="overlay-back" data-action="add-back">' +
        ICONS.chevronLeft +
        '</button><span class="title">Add ' +
        r.name +
        '</span><button class="overlay-close" data-action="close-overlay">' +
        ICONS.x +
        "</button></div>";

      html +=
        '<div class="overlay-body">';

      html +=
        '<div class="retailer-preview" style="background:' +
        r.color +
        '"><div class="cat">' +
        r.category +
        '</div><div class="name">' +
        r.name +
        "</div></div>";

      html +=
        '<label class="field-label" for="card-number-input">Card or membership number</label>';

      html +=
        '<input id="card-number-input" class="text-input" placeholder="Enter number" value="' +
        this.cardNumber +
        '" style="margin-bottom:18px">';

      if (
        this.capturedPhoto
      ) {

        html +=
          '<div class="capture-preview"><img src="' +
          this.capturedPhoto +
          '" alt="Captured card photo"><div><div class="t">' +
          (
            this.scanning
              ? "Photo captured"
              : "Photo captured"
          ) +
          '</div><div class="d">' +
          (
            this.scanning
              ? "Enter the card number below"
              : "Confirm or edit the number below"
          ) +
          "</div></div></div>";

      }

      html +=
        '<div class="capture-row">';

      html +=
        '<label class="capture-btn" for="capture-file-input">' +
        ICONS.camera +
        "<span>Take or upload a photo</span></label>";

      html +=
        '<input type="file" id="capture-file-input" accept="image/*" capture="environment" style="display:none">';

      html += "</div>";

      /*
       * Feature-detected: BarcodeDetector (Chrome/Edge/Android Chrome)
       * covers a meaningful share of real users automatically. Where
       * it isn't available (Safari/iOS, Firefox — no polyfill bundled
       * here, no build step to add one via npm), this button simply
       * isn't shown, and the photo-capture-plus-manual-entry flow
       * above remains the only path, completely unchanged. See
       * BN-021-BARCODE-QR-SCANNING.md for what this needs from a real
       * device to confirm, since a headless sandbox has no camera and
       * no real browser to test this against.
       */
      if (this.barcodeDetectionSupported()) {
        html += '<div class="capture-row" style="margin-top:8px">';
        if (this.scanningLive) {
          html +=
            '<div class="capture-preview" style="width:100%"><video id="barcode-scan-video" autoplay playsinline muted style="width:100%;border-radius:10px;background:#000"></video>' +
            '<div><div class="t">Scanning…</div><div class="d">Hold the barcode steady in view</div></div></div>';
          html += '<button class="btn btn-secondary btn-block" data-action="cancel-barcode-scan" style="margin-top:8px">Cancel scan</button>';
        } else {
          html +=
            '<button class="capture-btn" type="button" data-action="start-barcode-scan">' +
            ICONS.camera +
            "<span>Scan barcode automatically</span></button>";
        }
        html += "</div>";
      } else if (this.barcodeScanUnsupportedMessage) {
        html += '<p style="font-size:11px;color:var(--grey-muted);margin-top:8px">' + this.escapeHtml(this.barcodeScanUnsupportedMessage) + '</p>';
      }

      html +=
        '<button class="btn btn-primary btn-block" id="confirm-add-btn" data-action="confirm-add" ' +
        (
          this.cardNumber
            ? ""
            : "disabled"
        ) +
        ">Add to wallet</button>";

      html += "</div>";

    }

    else {

      html +=
        '<div class="overlay-header"><span class="title">Add a loyalty card</span><button class="overlay-close" data-action="close-overlay">' +
        ICONS.x +
        "</button></div>";

      html +=
        '<div class="overlay-body">';

      html +=
        '<div class="search-bar"><input id="add-search-input" placeholder="Search retailers" value="' +
        this.addQuery.replace(
          /"/g,
          "&quot;"
        ) +
        '" autofocus></div>';

      const available =
        activeRetailers().filter(
          (r) =>
            r.name.toLowerCase().includes(this.addQuery.toLowerCase()) ||
            r.loyaltyProgram.toLowerCase().includes(this.addQuery.toLowerCase())
        );

      if (
        available.length ===
        0
      ) {

        html +=
          '<div class="empty-state">You\'ve already added every retailer we support.</div>';

      }

      else {

        available.forEach(
          (r) => {

            html +=
              '<button class="retailer-option" data-action="pick-retailer" data-id="' +
              r.id +
              '">' +
              this.badge(r) +
              '<div><div class="name">' +
              r.name +
              '</div><div class="cat">' +
              r.category +
              "</div></div></button>";

          }
        );

      }

      html += "</div>";

    }

    return html;

  },


  /* ========================================================================
     CARD DETAIL
     ======================================================================== */

  renderCardDetailOverlay() {

    const c =
      this.data.cards.find(
        (card) =>
          card.id ===
          this.detailCardId
      );

    if (!c) {
      return "";
    }

    const r =
      retailerOf(
        c.retailerId
      );

    const displayNumber =
      c.displayMemberNo ||
      maskMembershipNumber(
        c.memberNo
      );

    const fullNumber =
      c.memberNo ||
      "";

    const benefits =
      Array.isArray(c.benefits)
        ? c.benefits
        : [];

    const activity =
      Array.isArray(c.activity)
        ? c.activity
            .slice()
            .sort(
              (a, b) =>
                b.at - a.at
            )
        : [];

    let html = "";

    html +=
      '<div class="overlay-header card-detail-header">' +

      '<button class="overlay-back" data-action="close-card-detail" aria-label="Back to wallet">' +
      ICONS.chevronLeft +
      "</button>" +

      '<div class="card-detail-title-wrap">' +
      '<span class="title">' +
      r.name +
      "</span>" +
      '<span class="card-detail-program">' +
      r.loyaltyProgram +
      "</span>" +
      "</div>" +

      '<button class="card-detail-favourite" data-action="toggle-fav" data-id="' +
      c.id +
      '" aria-label="' +
      (
        c.favourite
          ? "Remove favourite"
          : "Add favourite"
      ) +
      '">' +
      ICONS.star(c.favourite) +
      "</button>" +

      "</div>";

    html +=
      '<div class="overlay-body card-detail-body">';

    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-digital-card" style="background:' +
      r.color +
      ";color:" +
      r.textColor +
      '">';

    html +=
      '<div class="bn-card-top">' +

      '<div class="bn-card-brand">' +

      '<div class="bn-card-brand-mark">' +
      r.initials +
      "</div>" +

      '<div>' +

      '<div class="bn-card-category">' +
      r.category +
      "</div>" +

      '<div class="bn-card-retailer">' +
      r.name +
      "</div>" +

      "</div>" +

      "</div>" +

      '<span class="bn-card-tier">' +
      c.tier +
      "</span>" +

      "</div>";

    html +=
      '<div class="bn-card-program">' +
      r.loyaltyProgram +
      "</div>";

    html +=
      '<div class="bn-card-number-label">MEMBERSHIP NUMBER</div>';

    html +=
      '<div class="bn-card-number">' +
      displayNumber +
      "</div>";

    html +=
      '<div class="bn-card-footer">' +
      "<span>" +
      r.loyaltyType +
      "</span>" +
      "<span>BargaiNest Wallet</span>" +
      "</div>";

    html +=
      "</div>";

    html +=
      '<div class="bn-card-info-grid">';

    html +=
      '<div class="bn-card-info-item">' +
      '<span class="bn-card-info-label">Retailer</span>' +
      '<strong>' +
      r.name +
      "</strong>" +
      "</div>";

    html +=
      '<div class="bn-card-info-item">' +
      '<span class="bn-card-info-label">Programme</span>' +
      '<strong>' +
      r.loyaltyProgram +
      "</strong>" +
      "</div>";

    html +=
      '<div class="bn-card-info-item">' +
      '<span class="bn-card-info-label">Tier</span>' +
      '<strong>' +
      c.tier +
      "</strong>" +
      "</div>";

    html +=
      '<div class="bn-card-info-item">' +
      '<span class="bn-card-info-label">Membership number</span>' +
      '<strong>' +
      fullNumber +
      "</strong>" +
      "</div>";

    html += "</div>";

    html +=
      '<button class="bn-copy-number" data-action="copy-card-number" data-id="' +
      c.id +
      '">' +
      ICONS.copy +
      "<span>Copy membership number</span>" +
      "</button>";

    html +=
      "</section>";

    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-section-heading">' +
      '<div>' +
      '<div class="bn-eyebrow">MEMBERSHIP CARD</div>' +
      '<div class="bn-heading">Scan at checkout</div>' +
      "</div>" +
      "</div>";

    html +=
      '<div class="bn-barcode-section">';

    html +=
      '<div class="bn-barcode-frame">' +
      this.barcode(fullNumber) +
      "</div>";

    html +=
      '<div class="bn-barcode-number">' +
      fullNumber +
      "</div>";

    html +=
      "</div>";

    html +=
      "</section>";

    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-section-heading">' +
      '<div>' +
      '<div class="bn-eyebrow">REWARDS</div>' +
      '<div class="bn-heading">Your rewards</div>' +
      "</div>" +
      "</div>";

    html +=
      '<div class="bn-reward-grid">';

    html +=
      '<div class="bn-reward-card">' +
      '<div class="bn-reward-label">' +
      this.rewardLabel(c) +
      "</div>" +
      '<div class="bn-reward-value">' +
      this.rewardHeadline(c) +
      "</div>" +
      '<div class="bn-reward-sub">' +
      r.loyaltyProgram +
      "</div>" +
      "</div>";

    html +=
      '<div class="bn-reward-card bn-reward-value-card">' +
      '<div class="bn-reward-label">Estimated value</div>' +
      '<div class="bn-reward-value">' +
      formatRand(c.value) +
      "</div>" +
      '<div class="bn-reward-sub">Estimated monetary worth</div>' +
      "</div>";

    html +=
      "</div>";

    html +=
      '<div class="bn-detail-list">';

    if (
      c.rewardType ===
      "points"
    ) {

      html +=
        '<div class="bn-detail-row"><div><span class="bn-detail-label">Points balance</span><span class="bn-detail-meta">Available rewards</span></div><strong>' +
        (
          c.lastSyncedAt
            ? Number(c.points || 0).toLocaleString("en-ZA") + " pts"
            : "Not yet synced"
        ) +
        "</strong></div>";

    }

    if (
      Number(c.cashback || 0) >
      0
    ) {

      html +=
        '<div class="bn-detail-row"><div><span class="bn-detail-label">Cashback balance</span><span class="bn-detail-meta">Available cashback</span></div><strong>' +
        formatRand(
          c.cashback
        ) +
        "</strong></div>";

    }

    if (
      Number(c.vouchers || 0) >
      0
    ) {

      html +=
        '<div class="bn-detail-row"><div><span class="bn-detail-label">Available vouchers</span><span class="bn-detail-meta">Rewards ready to use</span></div><strong>' +
        c.vouchers +
        (
          c.vouchers === 1
            ? " voucher"
            : " vouchers"
        ) +
        "</strong></div>";

    }

    html +=
      "</div>";

    html +=
      "</section>";

    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-section-heading">' +
      '<div>' +
      '<div class="bn-eyebrow">MEMBERSHIP</div>' +
      '<div class="bn-heading">Membership details</div>' +
      "</div>" +
      "</div>";

    html +=
      '<div class="bn-detail-list">';

    html +=
      '<div class="bn-detail-row">' +
      '<div><span class="bn-detail-label">Tier</span><span class="bn-detail-meta">Current membership status</span></div>' +
      "<strong>" +
      c.tier +
      "</strong>" +
      "</div>";

    if (c.expiresAt) {

      const days =
        daysUntil(
          c.expiresAt
        );

      const expiryDate =
        new Intl.DateTimeFormat(
          "en-ZA",
          {
            day: "numeric",
            month: "short",
            year: "numeric"
          }
        ).format(
          new Date(
            c.expiresAt
          )
        );

      html +=
        '<div class="bn-detail-row">' +
        '<div><span class="bn-detail-label">Expiry</span><span class="bn-detail-meta">' +
        (
          days > 0
            ? "Membership/rewards expiry"
            : "Expired"
        ) +
        "</span></div>" +
        "<strong>" +
        expiryDate +
        "</strong>" +
        "</div>";

    }

    html +=
      "</div>";

    html +=
      "</section>";

    /* Live sync — surfaces the rewards/vouchers/offers data that now
       actually flows through from the retailer sync, instead of the
       card detail view only ever showing points and hardcoded zeros. */
    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-section-heading"><div>' +
      '<div class="bn-eyebrow">LIVE SYNC</div>' +
      '<div class="bn-heading">' +
      (c.connected ? "Synced with " + r.name : "Not yet connected") +
      "</div></div>";

    if (c.liveSyncAvailable) {
      html +=
        '<button class="btn btn-secondary" data-action="sync-card" data-id="' + c.id + '"' +
        (this.cardSyncBusy === c.id ? " disabled" : "") + ">" +
        (this.cardSyncBusy === c.id ? "Syncing…" : (c.connected ? "Sync now" : "Connect &amp; sync")) +
        "</button>";
    }

    html += "</div>";

    if (c.lastSyncedAt) {
      html +=
        '<div class="bn-reward-sub" style="margin-top:-6px;margin-bottom:12px">Last synced ' +
        timeAgo(c.lastSyncedAt) + "</div>";
    } else if (!c.liveSyncAvailable) {
      html +=
        '<div class="bn-benefits-empty">' + r.name + " does not have a live sync integration yet — points and rewards are tracked manually for now.</div>";
    } else if (!c.connected) {
      html +=
        '<div class="bn-benefits-empty">Live sync is available for ' + r.name + " — connect to automatically load your points, rewards and vouchers.</div>";
    }

    const rewardsList = Array.isArray(c.rewards) ? c.rewards : [];
    if (rewardsList.length) {
      html += '<div class="bn-detail-list">';
      rewardsList.forEach((reward) => {
        const isAvailable = String(reward.status || "AVAILABLE").toUpperCase() === "AVAILABLE";
        html +=
          '<div class="bn-detail-row"><div><span class="bn-detail-label">' + this.escapeHtml(reward.title) +
          '</span><span class="bn-detail-meta">' + this.escapeHtml(reward.status || "AVAILABLE") + "</span></div>" +
          '<div style="display:flex;align-items:center;gap:8px">' +
          (reward.value != null ? "<strong>" + formatRand(reward.value) + "</strong>" : "") +
          (isAvailable
            ? '<button class="btn btn-secondary btn-small" data-action="mark-reward-redeemed" data-id="' + this.escapeHtml(reward.externalId) + '" data-account-id="' + c.loyaltyAccountId + '">Mark used</button>'
            : "") +
          "</div></div>";
      });
      html += "</div>";
    }

    const voucherList = Array.isArray(c.voucherList) ? c.voucherList : [];
    if (voucherList.length) {
      html += '<div class="bn-detail-list">';
      voucherList.forEach((voucher) => {
        const isAvailable = String(voucher.status || "AVAILABLE").toUpperCase() === "AVAILABLE";
        html +=
          '<div class="bn-detail-row"><div><span class="bn-detail-label">' + this.escapeHtml(voucher.title) +
          '</span><span class="bn-detail-meta">' + (voucher.code ? "Code: " + this.escapeHtml(voucher.code) : this.escapeHtml(voucher.status || "AVAILABLE")) + "</span></div>" +
          '<div style="display:flex;align-items:center;gap:8px">' +
          (voucher.value != null ? "<strong>" + formatRand(voucher.value) + "</strong>" : "") +
          (isAvailable
            ? '<button class="btn btn-secondary btn-small" data-action="mark-voucher-redeemed" data-id="' + this.escapeHtml(voucher.externalId) + '" data-account-id="' + c.loyaltyAccountId + '">Mark used</button>'
            : "") +
          "</div></div>";
      });
      html += "</div>";
    }

    const offerList = Array.isArray(c.offers) ? c.offers : [];
    if (offerList.length) {
      html += '<div class="bn-detail-list">';
      offerList.forEach((offer) => {
        html +=
          '<div class="bn-detail-row"><div><span class="bn-detail-label">' + this.escapeHtml(offer.title) + "</span></div></div>";
      });
      html += "</div>";
    }

    html +=
      "</section>";

    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-benefits">';

    html +=
      '<div class="bn-benefits-title">' +
      ICONS.gift +
      "<span>Member benefits</span>" +
      "</div>";

    if (
      benefits.length > 0
    ) {

      html +=
        '<ul class="bn-benefits-list">';

      benefits.forEach(
        (benefit) => {

          html +=
            "<li>" +
            ICONS.check +
            "<span>" +
            benefit +
            "</span></li>";

        }
      );

      html +=
        "</ul>";

    }

    else {

      html +=
        '<div class="bn-benefits-empty">No membership benefits have been added yet.</div>';

    }

    html +=
      "</div>";

    html +=
      "</section>";

    if (
      c.expiringPoints &&
      c.expiresAt &&
      c.expiresAt >
        Date.now()
    ) {

      const days =
        daysUntil(
          c.expiresAt
        );

      html +=
        '<div class="bn-expiry-alert">' +
        ICONS.alert +
        '<div><strong>' +
        c.expiringPoints +
        " points expire in " +
        days +
        (
          days === 1
            ? " day"
            : " days"
        ) +
        "</strong><span>Use your rewards before they expire.</span></div>" +
        "</div>";

    }

    html +=
      '<section class="bn-detail-section">';

    html +=
      '<div class="bn-section-heading bn-activity-heading">' +
      '<div>' +
      '<div class="bn-eyebrow">ACTIVITY</div>' +
      '<div class="bn-heading">Recent activity</div>' +
      "</div>" +
      "</div>";

    html +=
      '<div class="bn-activity-list">';

    if (
      activity.length ===
      0
    ) {

      html +=
        '<div class="empty-state">No activity yet.</div>';

    }

    else {

      activity.forEach(
        (a) => {

          let iconClass =
            "reward";

          let symbol =
            "+";

          if (
            a.type ===
            "purchase"
          ) {

            iconClass =
              "purchase";

            symbol =
              "−";

          }

          else if (
            a.type ===
            "earned"
          ) {

            iconClass =
              "earned";

            symbol =
              "+";

          }

          else if (
            a.type ===
            "redeemed"
          ) {

            iconClass =
              "reward";

            symbol =
              "✓";

          }

          html +=
            '<div class="bn-activity-item">' +

            '<div class="bn-activity-icon ' +
            iconClass +
            '">' +
            symbol +
            "</div>" +

            '<div class="bn-activity-copy">' +

            '<div class="bn-activity-title">' +
            a.label +
            "</div>" +

            '<div class="bn-activity-meta">' +
            timeAgo(a.at) +
            "</div>" +

            "</div>" +

            '<div class="bn-activity-amount">' +
            a.detail +
            "</div>" +

            "</div>";

        }
      );

    }

    html +=
      "</div>";

    html +=
      "</section>";

    /* ----------------------------------------------------------------------
       STEP 4 — CARD ACTIONS
       ---------------------------------------------------------------------- */

    html +=
      '<section class="bn-card-actions">';

    html +=
      '<button class="bn-action-button" data-action="toggle-fav" data-id="' +
      c.id +
      '">' +
      ICONS.star(c.favourite) +
      "<span>" +
      (
        c.favourite
          ? "Remove from favourites"
          : "Add to favourites"
      ) +
      "</span>" +
      "</button>";

    html +=
      '<button class="bn-action-button" data-action="edit-card" data-id="' +
      c.id +
      '">' +
      "<span>Edit membership number</span>" +
      "</button>";

    html +=
      '<button class="bn-action-button bn-action-copy" data-action="copy-card-number" data-id="' +
      c.id +
      '">' +
      ICONS.copy +
      "<span>Copy membership number</span>" +
      "</button>";

    html +=
      '<button class="bn-action-button" data-action="start-remove" data-id="' +
      c.id +
      '" style="color:#b42318;border-color:#fecdca">' +
      "<span>Remove card</span>" +
      "</button>";

    if (this.confirmRemoveId === c.id) {
      html +=
        '<div style="margin-top:12px;padding:14px;border:1px solid #fecdca;border-radius:10px;background:#fff7f6">' +
        '<div style="font-weight:600;font-size:13px;color:#7a271a;margin-bottom:6px">Remove this loyalty card?</div>' +
        '<div style="font-size:12px;color:var(--grey-muted);margin-bottom:12px">This removes the card from your BargaiNest wallet. It does not delete your retailer account.</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-danger" data-action="remove-card" data-id="' +
        c.id +
        '">Remove card</button>' +
        '<button class="btn" data-action="cancel-remove" data-id="' +
        c.id +
        '">Cancel</button>' +
        '</div>' +
        '</div>';
    }

    html +=
      '<div class="pilot-card-note">Card management is connected to your BargaiNest account.</div>';

    html +=
      "</section>";

    html +=
      "</div>";

    return html;

  },


  renderProfileEditOverlay() {

    const profile =
      this.profile || {
        firstName: "",
        lastName: "",
        phone: ""
      };

    let html = "";

    html +=
      '<div class="overlay-header">' +
      '<button class="overlay-back" data-action="close-overlay" aria-label="Back to profile">' +
      ICONS.chevronLeft +
      "</button>" +
      '<span class="title">Account details</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' +
      ICONS.x +
      "</button>" +
      "</div>";

    html +=
      '<div class="overlay-body">';

    html +=
      '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 20px;line-height:1.5">' +
      "Keep your BargaiNest profile details up to date." +
      "</p>";

    if (this.profileError) {
      html +=
        '<div class="auth-error" style="margin-bottom:16px">' +
        this.profileError +
        "</div>";
    }

    html +=
      '<label class="field-label" for="profile-first-name">First name</label>';

    html +=
      '<input id="profile-first-name" class="text-input" type="text" autocomplete="given-name" maxlength="191" value="' +
      String(profile.firstName || "").replace(/"/g, "&quot;") +
      '" placeholder="First name" ' +
      (this.profileBusy ? "disabled" : "") +
      ">";

    html +=
      '<label class="field-label" for="profile-last-name" style="margin-top:16px">Last name</label>';

    html +=
      '<input id="profile-last-name" class="text-input" type="text" autocomplete="family-name" maxlength="191" value="' +
      String(profile.lastName || "").replace(/"/g, "&quot;") +
      '" placeholder="Last name" ' +
      (this.profileBusy ? "disabled" : "") +
      ">";

    html +=
      '<label class="field-label" for="profile-phone" style="margin-top:16px">Phone number</label>';

    html +=
      '<input id="profile-phone" class="text-input" type="tel" autocomplete="tel" maxlength="191" value="' +
      String(profile.phone || "").replace(/"/g, "&quot;") +
      '" placeholder="Phone number" ' +
      (this.profileBusy ? "disabled" : "") +
      ">";

    html +=
      '<button class="btn btn-primary btn-block" data-action="save-profile" style="margin-top:22px" ' +
      (this.profileBusy ? "disabled" : "") +
      ">" +
      (this.profileBusy ? "Saving…" : "Save changes") +
      "</button>";

    const email = (this.data && this.data.user && this.data.user.email) || "";
    const emailVerified = !!(this.data && this.data.user && this.data.user.emailVerified);

    html +=
      '<div class="bn-detail-section" style="margin-top:28px;padding-top:20px;border-top:1px solid var(--line)">';
    html += '<div class="bn-eyebrow">EMAIL ADDRESS</div>';
    html +=
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px">' +
      '<span style="font-size:14px">' + this.escapeHtml(email) + '</span>' +
      (emailVerified
        ? '<span class="chip" style="background:var(--green-tint);color:var(--green-deep);font-size:11px">VERIFIED</span>'
        : '<span class="chip" style="background:var(--gold-tint);color:var(--gold-deep);font-size:11px">UNVERIFIED</span>') +
      "</div>";

    if (!emailVerified) {
      html +=
        '<button class="btn btn-secondary btn-block" data-action="resend-verification" style="margin-top:10px" ' +
        (this.verificationBusy ? "disabled" : "") + ">" +
        (this.verificationBusy ? "Sending…" : "Resend verification email") +
        "</button>";
    }
    html += "</div>";

    html +=
      '<div class="bn-detail-section" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">';
    html += '<div class="bn-eyebrow">CHANGE PASSWORD</div>';

    if (this.passwordChangeMessage) {
      html += '<div class="auth-error" style="margin:10px 0;background:var(--green-tint);color:var(--green-deep)">' + this.escapeHtml(this.passwordChangeMessage) + '</div>';
    }
    if (this.passwordChangeError) {
      html += '<div class="auth-error" style="margin:10px 0">' + this.escapeHtml(this.passwordChangeError) + '</div>';
    }

    html +=
      '<input id="current-password" class="text-input" type="password" autocomplete="current-password" placeholder="Current password" style="margin-top:10px" ' +
      (this.passwordChangeBusy ? "disabled" : "") + ">";
    html +=
      '<input id="new-password" class="text-input" type="password" autocomplete="new-password" placeholder="New password (8+ characters)" style="margin-top:10px" ' +
      (this.passwordChangeBusy ? "disabled" : "") + ">";
    html +=
      '<button class="btn btn-secondary btn-block" data-action="submit-change-password" style="margin-top:10px" ' +
      (this.passwordChangeBusy ? "disabled" : "") + ">" +
      (this.passwordChangeBusy ? "Changing…" : "Change password") +
      "</button>";
    html += "</div>";

    html +=
      '<div class="bn-detail-section" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">';
    html += '<div class="bn-eyebrow">DEACTIVATE ACCOUNT</div>';
    html += '<p style="font-size:12px;color:var(--grey-muted);margin:6px 0 10px">This logs you out everywhere and deactivates your account. It does not delete your data.</p>';
    html +=
      '<button class="btn btn-danger btn-block" data-action="deactivate-account" ' +
      (this.deactivateBusy ? "disabled" : "") + ">" +
      (this.deactivateBusy ? "Deactivating…" : "Deactivate my account") +
      "</button>";
    html += "</div>";

    html +=
      "</div>";

    return html;

  },


  renderHouseholdOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Household</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    if (this.householdError) {
      html += '<div class="auth-error" style="margin-bottom:16px">' + this.escapeHtml(this.householdError) + '</div>';
    }

    if (this.householdInvites && this.householdInvites.length) {
      html += '<div class="bn-eyebrow">PENDING INVITES</div>';
      this.householdInvites.forEach((invite) => {
        html +=
          '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line)">' +
          '<span>' + this.escapeHtml(invite.household.name) + '</span>' +
          '<button class="btn btn-primary btn-small" data-action="accept-household-invite" data-id="' + invite.household.id + '" ' +
          (this.householdBusy ? "disabled" : "") + '>Accept</button></div>';
      });
    }

    if (!this.household) {
      html += '<p style="font-size:13px;color:var(--grey-muted);margin:16px 0">You don\'t belong to a household yet. Create one to share loyalty benefits with family members.</p>';
      html += '<label class="field-label" for="household-name">Household name</label>';
      html += '<input id="household-name" class="text-input" type="text" placeholder="e.g. The Smiths" ' + (this.householdBusy ? "disabled" : "") + '>';
      html += '<button class="btn btn-primary btn-block" data-action="create-household" style="margin-top:14px" ' + (this.householdBusy ? "disabled" : "") + '>' +
        (this.householdBusy ? "Creating…" : "Create household") + '</button>';
    } else {
      const members = this.household.members || [];
      const isOwner = this.household.ownerUserId === (this.data && this.data.user && this.data.user.id);

      if (isOwner && this.householdEditing) {
        html += '<div style="margin-top:18px">';
        html += '<label class="field-label" for="household-edit-name">Household name</label>';
        html += '<input id="household-edit-name" class="text-input" type="text" maxlength="191" value="' +
          this.escapeAttr(this.household.name || "") + '" ' +
          (this.householdBusy ? "disabled" : "") + '>';
        html += '<div style="display:flex;gap:8px;margin-top:10px">';
        html += '<button class="btn btn-primary btn-small" data-action="save-household-name" ' +
          (this.householdBusy ? "disabled" : "") + '>' +
          (this.householdBusy ? "Saving…" : "Save") + '</button>';
        html += '<button class="btn btn-secondary btn-small" data-action="cancel-household-name" ' +
          (this.householdBusy ? "disabled" : "") + '>Cancel</button>';
        html += '</div>';
        html += '</div>';
      } else {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px">';
        html += '<div class="bn-eyebrow">' + this.escapeHtml(this.household.name) + '</div>';

        if (isOwner) {
          html += '<button class="btn btn-secondary btn-small" data-action="edit-household-name" ' +
            (this.householdBusy ? "disabled" : "") + '>Edit name</button>';
        }

        html += '</div>';
      }

      members.forEach((member) => {
        const statusLabel = member.status === "ACTIVE" ? "Active" : member.status === "INVITED" ? "Invited" : "Removed";
        html +=
          '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line)"><div>' +
          '<span>' + this.escapeHtml(member.email) + '</span>' +
          '<div style="font-size:11px;color:var(--grey-muted)">' + statusLabel + '</div></div>';
        if (isOwner && member.status !== "REMOVED") {
          html += '<button class="btn btn-danger btn-small" data-action="remove-household-member" data-id="' + member.id + '" ' +
            (this.householdBusy ? "disabled" : "") + '>Remove</button>';
        }
        html += '</div>';
      });

      if (isOwner) {
        html += '<label class="field-label" for="household-invite-email" style="margin-top:16px">Invite a member</label>';
        html += '<input id="household-invite-email" class="text-input" type="email" placeholder="their@email.com" ' + (this.householdBusy ? "disabled" : "") + '>';
        html += '<button class="btn btn-secondary btn-block" data-action="invite-household-member" style="margin-top:10px" ' + (this.householdBusy ? "disabled" : "") + '>Send invite</button>';

        html += '<div class="bn-detail-section" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">';
        html += '<div class="bn-eyebrow">DANGER ZONE</div>';
        html += '<p style="font-size:12px;color:var(--grey-muted);margin:6px 0 10px">Deleting this household removes the household and its member and invitation records. This cannot be undone.</p>';
        html += '<button class="btn btn-danger btn-block" data-action="delete-household" ' +
          (this.householdBusy ? "disabled" : "") + '>' +
          (this.householdBusy ? "Deleting…" : "Delete household") +
          '</button>';
        html += '</div>';
      }
    }

    html += "</div>";
    return html;
  },

  renderNotificationsOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Notifications</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    const prefs = this.notificationPreferences || { emailEnabled: true, rewardExpiryAlerts: true, weeklyDigest: false };
    const toggles = [
      { field: "emailEnabled", label: "Email notifications" },
      { field: "rewardExpiryAlerts", label: "Reward expiry alerts" },
      { field: "weeklyDigest", label: "Weekly savings digest" },
    ];

    html += '<div class="bn-eyebrow">PREFERENCES</div>';
    toggles.forEach((t) => {
      const on = !!prefs[t.field];
      html +=
        '<div class="bn-detail-row" style="padding:10px 0;border-bottom:1px solid var(--line)">' +
        '<span>' + t.label + '</span>' +
        '<button class="btn btn-small ' + (on ? "btn-primary" : "btn-secondary") + '" data-action="toggle-notification-pref" data-field="' + t.field + '">' +
        (on ? "On" : "Off") + '</button></div>';
    });

    html += '<div class="bn-eyebrow" style="margin-top:18px">RECENT</div>';
    const notifications = this.notifications || [];
    if (!notifications.length) {
      html += '<p style="font-size:13px;color:var(--grey-muted);margin:10px 0">No notifications yet.</p>';
    } else {
      notifications.forEach((n) => {
        const unread = n.status !== "READ";
        html +=
          '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line);align-items:flex-start">' +
          '<div><strong style="font-size:13px">' + this.escapeHtml(n.title) + '</strong>' +
          '<div style="font-size:12px;color:var(--grey-muted);margin-top:2px">' + this.escapeHtml(n.body) + '</div></div>';
        if (unread) {
          html += '<button class="btn btn-secondary btn-small" data-action="mark-notification-read" data-id="' + n.id + '">Mark read</button>';
        }
        html += '</div>';
      });
    }

    html += "</div>";
    return html;
  },

  renderPrivacyOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Privacy &amp; consent</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 18px">Control how BargaiNest uses your information.</p>';

    const consent = this.consent || { marketingCommunications: false, dataProcessing: false, thirdPartySharing: false };
    const toggles = [
      { field: "marketingCommunications", label: "Marketing communications", desc: "Product updates, promotions and offers by email." },
      { field: "dataProcessing", label: "Data processing", desc: "Allow BargaiNest to process your shopping data to find savings." },
      { field: "thirdPartySharing", label: "Third-party sharing", desc: "Share anonymised data with retail partners." },
    ];

    toggles.forEach((t) => {
      const on = !!consent[t.field];
      html +=
        '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line);align-items:flex-start">' +
        '<div><span>' + t.label + '</span><div style="font-size:11px;color:var(--grey-muted);margin-top:2px;max-width:220px">' + t.desc + '</div></div>' +
        '<button class="btn btn-small ' + (on ? "btn-primary" : "btn-secondary") + '" data-action="toggle-consent" data-field="' + t.field + '">' +
        (on ? "Granted" : "Not granted") + '</button></div>';
    });

    html += "</div>";
    return html;
  },

  renderSupportOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Support</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 18px">Tell us what\'s going on and we\'ll get back to you by email.</p>';

    if (this.supportMessage) {
      html += '<div class="auth-error" style="margin-bottom:14px;background:var(--green-tint);color:var(--green-deep)">' + this.escapeHtml(this.supportMessage) + '</div>';
    }
    if (this.supportError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.supportError) + '</div>';
    }

    html += '<label class="field-label" for="support-subject">Subject</label>';
    html += '<input id="support-subject" class="text-input" type="text" placeholder="What can we help with?" ' + (this.supportBusy ? "disabled" : "") + '>';
    html += '<label class="field-label" for="support-message" style="margin-top:14px">Message</label>';
    html += '<textarea id="support-message" class="text-input" rows="5" placeholder="Describe the issue…" ' + (this.supportBusy ? "disabled" : "") + '></textarea>';
    html += '<button class="btn btn-primary btn-block" data-action="submit-support-request" style="margin-top:14px" ' + (this.supportBusy ? "disabled" : "") + '>' +
      (this.supportBusy ? "Sending…" : "Send request") + '</button>';

    html += this.renderMySupportRequests();

    html += "</div>";
    return html;
  },

  renderMySupportRequests() {
    const requests = Array.isArray(this.mySupportRequests) ? this.mySupportRequests : null;

    // null (not yet loaded) vs [] (loaded, genuinely none) are kept
    // distinct -- showing "no requests yet" before the list has even
    // been fetched would be a real, if small, version of the exact
    // "confirmed state vs unknown state" mistake BN-025 was about.
    if (requests === null) return "";

    let html = '<div class="bn-section-heading" style="margin-top:28px"><div><div class="bn-eyebrow">YOUR REQUESTS</div><div class="bn-heading">Request history</div></div></div>';

    if (!requests.length) {
      html += '<div class="bn-benefits-empty">You haven\'t submitted any support requests yet.</div>';
      return html;
    }

    html += '<div class="bn-detail-list">';
    requests
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((req) => {
        const reference = String(req.id || "").slice(0, 8).toUpperCase();
        const isResolved = req.status === "RESOLVED";
        html +=
          '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line)"><div>' +
          '<span class="bn-detail-label">' + this.escapeHtml(req.subject || "") + '</span>' +
          '<div style="font-size:11px;color:var(--grey-muted);margin-top:2px">Ref ' + reference + ' · ' + timeAgo(req.createdAt) + '</div>' +
          '</div>' +
          '<span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;' +
          (isResolved ? 'background:var(--green-tint);color:var(--green-deep)' : 'background:var(--grey-tint, #f0f0f0);color:var(--grey-muted)') +
          '">' + (isResolved ? "Resolved" : "Open") + '</span>' +
          '</div>';
      });
    html += "</div>";

    return html;
  },

  renderPromotionsOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Specials</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 14px">Current promotions, fetched live from retailer specials pages.</p>';

    html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
    html += '<input id="promotions-search" class="text-input" type="text" placeholder="Search specials…" value="' + this.escapeHtml(this.promotionsSearchTerm || "") + '" ' + (this.promotionsBusy ? "disabled" : "") + '>';
    html += '<button class="btn btn-primary btn-small" data-action="search-promotions" ' + (this.promotionsBusy ? "disabled" : "") + '>Search</button>';
    html += "</div>";

    if (this.promotionsError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.promotionsError) + '</div>';
    }

    if (this.promotionsBusy) {
      html += '<p style="font-size:13px;color:var(--grey-muted)">Loading current specials…</p>';
    } else {
      const promotions = this.promotions || [];
      if (!promotions.length) {
        html += '<div class="bn-benefits-empty">No current specials found' + (this.promotionsSearchTerm ? ' for "' + this.escapeHtml(this.promotionsSearchTerm) + '"' : "") + '.</div>';
      } else {
        if (this.promotionsSourcesFailed) {
          html += '<div style="font-size:11px;color:var(--grey-muted);margin-bottom:10px">' + this.promotionsSourcesFailed + ' source(s) could not be checked right now.</div>';
        }
        html += '<div class="bn-detail-list">';
        promotions.forEach((promo) => {
          html +=
            '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line)"><div>' +
            '<span class="bn-detail-label">' + this.escapeHtml(promo.name) + '</span>' +
            '<div style="font-size:11px;color:var(--grey-muted);margin-top:2px">' + this.escapeHtml(promo.retailerName) +
            (promo.promotionText ? " · " + this.escapeHtml(promo.promotionText) : "") + '</div></div>' +
            '<strong>' + formatRand(promo.price) + '</strong></div>';
        });
        html += "</div>";
      }
    }

    html += "</div>";
    return html;
  },

  renderInsightsOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">My insights</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 16px">Where you stand today across all your loyalty accounts.</p>';

    if (this.insightsBusy) {
      html += '<p style="font-size:13px;color:var(--grey-muted)">Loading…</p>';
      html += "</div>";
      return html;
    }

    if (this.insightsError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.insightsError) + '</div>';
      html += "</div>";
      return html;
    }

    const insights = this.insights || {
      totalLoyaltyAccounts: 0, totalPoints: 0,
      totalAvailableRewards: 0, totalAvailableRewardValue: 0,
      totalAvailableVouchers: 0, totalAvailableVoucherValue: 0,
      retailers: [],
    };

    // REG-001: same distinction as the dashboard -- accounts existing
    // but none ever having synced is not the same as a confirmed
    // zero across the board.
    const insightsPendingSync =
      insights.totalLoyaltyAccounts > 0 &&
      !insights.retailers.some((r) => r.lastSyncedAt);

    // Manually-captured wallet vouchers (see wallet-vouchers.js) are
    // never "pending sync" -- they're real, user-entered data with no
    // retailer sync dependency at all. The Vouchers stat combines
    // both sources: sync-derived vouchers from loyalty accounts
    // (0 while genuinely pending) plus active wallet vouchers
    // (always countable). Only shows "Pending sync" itself when
    // BOTH sources are empty.
    const activeWalletVoucherCount = (this.vouchers || []).filter((v) => v.effectiveStatus === "ACTIVE").length;
    const syncedVoucherCount = insightsPendingSync ? 0 : insights.totalAvailableVouchers;
    const combinedVoucherCount = syncedVoucherCount + activeWalletVoucherCount;
    const vouchersPending = insightsPendingSync && activeWalletVoucherCount === 0;

    html += '<div class="hero-stats" style="margin-bottom:18px">';
    html += '<div class="hero-stat"><div class="num">' + insights.totalLoyaltyAccounts + '</div><div class="lbl">Loyalty accounts</div></div>';
    html += '<div class="hero-stat"><div class="num">' + (insightsPendingSync ? "Pending sync" : insights.totalPoints.toLocaleString("en-ZA")) + '</div><div class="lbl">Points</div></div>';
    html += '<div class="hero-stat"><div class="num">' + (insightsPendingSync ? "Pending sync" : insights.totalAvailableRewards) + '</div><div class="lbl">Rewards</div></div>';
    html += '<div class="hero-stat"><div class="num">' + (vouchersPending ? "Pending sync" : combinedVoucherCount) + '</div><div class="lbl">Vouchers</div></div>';
    html += "</div>";

    if (insights.totalAvailableRewardValue > 0 || insights.totalAvailableVoucherValue > 0) {
      html += '<p style="font-size:12px;color:var(--grey-muted);margin-bottom:16px">Approximate available value: ' +
        formatRand(insights.totalAvailableRewardValue + insights.totalAvailableVoucherValue) + '</p>';
    }

    html += '<div class="bn-eyebrow">BY RETAILER</div>';
    if (!insights.retailers.length) {
      html += '<div class="bn-benefits-empty">Add a loyalty card to see your insights here.</div>';
    } else {
      html += '<div class="bn-detail-list">';
      insights.retailers.forEach((r) => {
        html +=
          '<div class="bn-detail-row" style="padding:12px 0;border-bottom:1px solid var(--line)"><div>' +
          '<span class="bn-detail-label">' + this.escapeHtml(r.retailerName) + '</span>' +
          '<div style="font-size:11px;color:var(--grey-muted);margin-top:2px">' +
          (r.tier ? this.escapeHtml(r.tier) + " · " : "") +
          r.availableRewards + " reward" + (r.availableRewards === 1 ? "" : "s") + ", " +
          r.availableVouchers + " voucher" + (r.availableVouchers === 1 ? "" : "s") +
          '</div></div>' +
          '<strong>' + (r.lastSyncedAt ? r.points.toLocaleString("en-ZA") + ' pts' : 'Not yet synced') + '</strong></div>';
      });
      html += "</div>";
    }

    html += "</div>";
    return html;
  },

  renderReceiptScanOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Scan receipt</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    if (this.receiptScanBusy) {
      html += '<p style="font-size:13px;color:var(--grey-muted);text-align:center;margin-top:30px">Reading your receipt…<br>This can take a little while.</p>';
      html += "</div>";
      return html;
    }

    if (this.receiptScanError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.receiptScanError) + '</div>';
      html += '<button class="btn btn-secondary btn-block" data-action="open-receipt-scan">Try again</button>';
      html += "</div>";
      return html;
    }

    if (this.receiptReview) {
      const review = this.receiptReview;

      html += '<div class="bn-eyebrow">' + (review.retailerName ? this.escapeHtml(review.retailerName) : "RECEIPT") + '</div>';
      html += '<p style="font-size:12px;color:var(--grey-muted);margin:6px 0 16px">Review what we read from your receipt. Edit anything that\'s wrong, remove items that shouldn\'t be there, or add anything we missed -- nothing is saved until you confirm.</p>';

      if (this.receiptConfirmError) {
        html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.receiptConfirmError) + '</div>';
      }

      html += '<div class="bn-detail-list">';
      review.items.forEach((item, index) => {
        const promoBadge = item.matchedPromotionName
          ? (item.paidPromoPrice
              ? '<span class="chip" style="background:var(--green-tint);color:var(--green-deep);font-size:10px;margin-left:6px">PROMO PRICE</span>'
              : '<span class="chip" style="background:var(--gold-tint);color:var(--gold-deep);font-size:10px;margin-left:6px">PROMO AVAILABLE</span>')
          : "";
        html +=
          '<div class="bn-detail-row" style="padding:10px 0;border-bottom:1px solid var(--line);gap:8px">' +
          '<input class="text-input" data-receipt-review-field="name" data-index="' + index + '" type="text" value="' + this.escapeAttr(item.name) + '" style="flex:1" ' + (this.receiptConfirmBusy ? "disabled" : "") + '>' +
          promoBadge +
          '<input class="text-input" data-receipt-review-field="price" data-index="' + index + '" type="number" min="0" step="0.01" value="' + this.escapeAttr(item.price) + '" style="width:90px" ' + (this.receiptConfirmBusy ? "disabled" : "") + '>' +
          '<button class="btn btn-secondary" data-action="remove-receipt-review-item" data-index="' + index + '" aria-label="Remove item" style="padding:6px 10px;flex-shrink:0" ' + (this.receiptConfirmBusy ? "disabled" : "") + '>' + ICONS.x + '</button>' +
          '</div>';
      });
      html += "</div>";

      if (!review.items.length) {
        html += '<p style="font-size:12px;color:var(--grey-muted);margin:12px 0">No items yet -- add one below, or go back and try scanning again.</p>';
      }

      html += '<button class="btn btn-secondary btn-block" data-action="add-receipt-review-item" style="margin-top:10px" ' + (this.receiptConfirmBusy ? "disabled" : "") + '>' + ICONS.plus + ' Add an item</button>';

      if (review.total != null) {
        html += '<div style="display:flex;justify-content:space-between;padding:14px 0;font-weight:600">' +
          '<span>Receipt total (from OCR, not a line item)</span><span>' + formatRand(Number(review.total)) + '</span></div>';
      }

      html += '<button class="btn btn-primary btn-block" data-action="confirm-receipt-save" style="margin-top:12px" ' + (this.receiptConfirmBusy || !review.items.length ? "disabled" : "") + '>' +
        (this.receiptConfirmBusy ? "Saving…" : "Confirm and save") + '</button>';
      html += '<button class="btn btn-secondary btn-block" data-action="close-overlay" style="margin-top:8px" ' + (this.receiptConfirmBusy ? "disabled" : "") + '>Discard</button>';

      html += "</div>";
      return html;
    }

    if (this.receiptSavedMessage) {
      html += '<p style="font-size:13px;color:var(--grey-muted);text-align:center;margin:30px 0">' + this.escapeHtml(this.receiptSavedMessage) + '</p>';
      html += '<button class="btn btn-primary btn-block" data-action="close-overlay">Done</button>';
      html += "</div>";
      return html;
    }

    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 20px">Take a photo of your receipt and we\'ll log the items and check for promotions automatically.</p>';
    html += '<div class="capture-row">';
    html += '<label class="capture-btn" for="receipt-scan-file-input">' + ICONS.camera + '<span>Take or upload a photo</span></label>';
    html += '<input type="file" id="receipt-scan-file-input" accept="image/*" capture="environment" style="display:none">';
    html += "</div>";

    html += "</div>";
    return html;
  },

  renderPurchasesOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Purchase history</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    if (this.purchasesBusy) {
      html += '<p style="font-size:13px;color:var(--grey-muted)">Loading…</p>';
      html += "</div>";
      return html;
    }

    if (this.purchasesError) {
      html += '<div class="auth-error">' + this.escapeHtml(this.purchasesError) + '</div>';
      html += "</div>";
      return html;
    }

    const purchases = this.purchases || [];
    if (!purchases.length) {
      html += '<div class="bn-benefits-empty">No purchases logged yet. Scan a receipt to get started.</div>';
      html += "</div>";
      return html;
    }

    html += '<div class="bn-detail-list">';
    purchases.forEach((p) => {
      const date = p.purchasedAt ? new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(p.purchasedAt)) : "";
      const itemCount = (p.items || []).length;
      html +=
        '<button class="wallet-list-row" data-action="open-purchase-detail" data-id="' + this.escapeAttr(p.id) + '" style="width:100%;text-align:left;border:none;background:none;padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer">' +
        '<div class="bn-detail-row"><div>' +
        '<span class="bn-detail-label">' + this.escapeHtml(p.retailerName || "Purchase") + '</span>' +
        '<div style="font-size:11px;color:var(--grey-muted);margin-top:2px">' + date + ' · ' + itemCount + ' item' + (itemCount === 1 ? "" : "s") +
        (p.source === "MANUAL" ? " · Logged manually" : "") + '</div></div>' +
        (p.totalAmount != null ? '<strong>' + formatRand(Number(p.totalAmount)) + '</strong>' : "") +
        '</div></button>';
    });
    html += "</div>";

    html += "</div>";
    return html;
  },

  /**
   * REG-006: reuses the existing GET /me/purchases/:id endpoint
   * (already built for BN-028) -- no new backend model or endpoint
   * needed, since purchases/purchase_items already are the right
   * foundation.
   */
  async openPurchaseDetail(purchaseId) {
    this.overlay = "purchaseDetail";
    this.purchaseDetailBusy = true;
    this.purchaseDetailError = "";
    this.purchaseDetailMessage = "";
    this.purchaseDetail = null;
    this.buyAgainCheckedItems = null;
    this.buyAgainTargetListId = null;
    this.renderOverlay();
    try {
      const [purchase] = await Promise.all([
        apiGet("/me/purchases/" + encodeURIComponent(purchaseId)),
        // Best-effort: the shopping-list picker just falls back to
        // "you have no lists yet" if this fails, rather than blocking
        // the whole detail view from loading.
        (async () => {
          if (this.shoppingLists && this.shoppingLists.length) return;
          try {
            const payload = await apiGet("/me/shopping-lists");
            this.shoppingLists = Array.isArray(payload) ? payload : (payload && payload.data) || [];
          } catch (error) {
            // leave whatever was already loaded, if anything
          }
        })(),
      ]);
      this.purchaseDetail = purchase;
      // Issue 2 (regression testing): every item defaults to checked
      // -- "buy again, everything" stays the one-tap common case --
      // but the user can uncheck items they don't want re-added.
      this.buyAgainCheckedItems = (purchase.items || []).map(() => true);
      this.buyAgainTargetListId = (this.shoppingLists || []).some((l) => l.id === this.selectedShoppingListId)
        ? this.selectedShoppingListId
        : (this.shoppingLists && this.shoppingLists[0] && this.shoppingLists[0].id) || null;
    } catch (error) {
      this.purchaseDetailError = this.userFacingError(error);
    } finally {
      this.purchaseDetailBusy = false;
      this.renderOverlay();
    }
  },

  toggleBuyAgainItem(index) {
    if (!this.buyAgainCheckedItems) return;
    this.buyAgainCheckedItems[index] = !this.buyAgainCheckedItems[index];
    this.renderOverlay();
  },

  setBuyAgainTargetList(listId) {
    this.buyAgainTargetListId = listId;
  },

  renderPurchaseDetailOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="open-purchases" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Purchase</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    if (this.purchaseDetailBusy) {
      html += '<p style="font-size:13px;color:var(--grey-muted)">Loading…</p>';
      html += "</div>";
      return html;
    }

    if (this.purchaseDetailError) {
      html += '<div class="auth-error">' + this.escapeHtml(this.purchaseDetailError) + '</div>';
      html += "</div>";
      return html;
    }

    const purchase = this.purchaseDetail;
    if (!purchase) {
      html += '<div class="bn-benefits-empty">This purchase could not be found.</div></div>';
      return html;
    }

    if (this.purchaseDetailMessage) {
      html += '<div class="auth-error" style="margin-bottom:14px;background:var(--green-tint);color:var(--green-deep)">' + this.escapeHtml(this.purchaseDetailMessage) + '</div>';
    }

    const date = purchase.purchasedAt ? new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(purchase.purchasedAt)) : "";
    html += '<div class="bn-eyebrow">' + this.escapeHtml(purchase.retailerName || "Purchase") + '</div>';
    html += '<p style="font-size:12px;color:var(--grey-muted);margin:6px 0 16px">' + date + '</p>';

    const items = purchase.items || [];
    const checked = this.buyAgainCheckedItems || items.map(() => true);
    html += '<div class="bn-detail-list">';
    items.forEach((item, index) => {
      html +=
        '<div class="bn-detail-row" style="padding:10px 0;border-bottom:1px solid var(--line);gap:8px">' +
        '<label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">' +
        '<input type="checkbox" data-action="toggle-buy-again-item" data-index="' + index + '" ' + (checked[index] ? "checked" : "") + ' ' + (this.buyAgainBusy ? "disabled" : "") + '>' +
        '<span>' + this.escapeHtml(item.name) + '</span>' +
        '</label>' +
        '<strong>' + formatRand(Number(item.price)) + '</strong></div>';
    });
    html += "</div>";

    if (purchase.totalAmount != null) {
      html += '<div style="display:flex;justify-content:space-between;padding:14px 0;font-weight:600">' +
        '<span>Total</span><span>' + formatRand(Number(purchase.totalAmount)) + '</span></div>';
    }

    const checkedCount = checked.filter(Boolean).length;
    const lists = this.shoppingLists || [];

    if (items.length > 0) {
      html += '<label class="field-label" for="buy-again-list-select">Add to</label>';
      if (lists.length) {
        html += '<select id="buy-again-list-select" class="text-input" ' + (this.buyAgainBusy ? "disabled" : "") + '>';
        lists.forEach((list) => {
          html += '<option value="' + this.escapeAttr(list.id) + '" ' + (this.buyAgainTargetListId === list.id ? "selected" : "") + '>' + this.escapeHtml(list.name || "Shopping list") + '</option>';
        });
        html += '</select>';
      } else {
        html += '<p style="font-size:12px;color:var(--grey-muted)">You don\'t have a shopping list yet -- create one first, then come back to add these items.</p>';
      }
    }

    html += '<button class="btn btn-primary btn-block" data-action="buy-again" data-id="' + this.escapeAttr(purchase.id) + '" style="margin-top:12px" ' + (this.buyAgainBusy || !checkedCount || !lists.length ? "disabled" : "") + '>' +
      (this.buyAgainBusy ? "Adding to your list…" : "Buy again — add " + checkedCount + " item" + (checkedCount === 1 ? "" : "s") + " to my list") + '</button>';

    html += "</div>";
    return html;
  },

  /**
   * REG-006: adds every item from a past purchase back into the
   * user's currently-selected shopping list, reusing the exact same
   * single-item POST endpoint the manual "add item" form already
   * uses -- no new bulk-add endpoint built for this.
   */
  async buyAgain(purchaseId) {
    if (this.buyAgainBusy) return;
    const purchase = this.purchaseDetail && this.purchaseDetail.id === purchaseId ? this.purchaseDetail : null;
    if (!purchase || !purchase.items || !purchase.items.length) return;

    // Issue 2 (regression testing): respects the user's own checkbox
    // selections and their chosen target list, rather than always
    // adding everything to whichever list happened to be selected
    // elsewhere in the app.
    const selectedListElement = document.getElementById("buy-again-list-select");
    const targetListId = (selectedListElement && selectedListElement.value) || this.buyAgainTargetListId;

    if (!targetListId) {
      this.purchaseDetailError = "You don't have a shopping list yet. Create one first, then come back to add these items.";
      this.renderOverlay();
      return;
    }

    const checked = this.buyAgainCheckedItems || purchase.items.map(() => true);
    const itemsToAdd = purchase.items.filter((_, index) => checked[index]);

    if (!itemsToAdd.length) {
      this.purchaseDetailError = "Select at least one item to add.";
      this.renderOverlay();
      return;
    }

    this.buyAgainBusy = true;
    this.purchaseDetailError = "";
    this.renderOverlay();

    let addedCount = 0;
    try {
      for (const item of itemsToAdd) {
        await apiPost("/me/shopping-lists/" + encodeURIComponent(targetListId) + "/items", {
          description: item.name,
          quantity: 1,
        });
        addedCount += 1;
      }
      this.buyAgainBusy = false;
      this.purchaseDetailMessage = addedCount + " item" + (addedCount === 1 ? "" : "s") + " added to your shopping list.";
      this.renderOverlay();
    } catch (error) {
      this.buyAgainBusy = false;
      this.purchaseDetailError = addedCount > 0
        ? addedCount + " item" + (addedCount === 1 ? "" : "s") + " were added before this failed: " + this.userFacingError(error)
        : this.userFacingError(error);
      this.renderOverlay();
    }
  },

  async openInsights() {
    this.overlay = "insights";
    this.insightsBusy = true;
    this.insightsError = "";
    this.renderOverlay();
    try {
      const [insights] = await Promise.all([
        apiGet("/me/insights"),
        // Best-effort: if this fails, the Vouchers stat just falls
        // back to sync-derived data only, rather than blocking
        // Insights from loading at all.
        (async () => {
          try {
            this.vouchers = await apiGet("/me/wallet-vouchers");
          } catch (error) {
            // leave whatever vouchers were already loaded, if any
          }
        })(),
      ]);
      this.insights = insights;
    } catch (error) {
      this.insightsError = this.userFacingError(error);
    } finally {
      this.insightsBusy = false;
      this.renderOverlay();
    }
  },

  openReceiptScan() {
    this.overlay = "receiptScan";
    this.receiptScanBusy = false;
    this.receiptScanError = "";
    this.receiptReview = null;
    this.receiptConfirmBusy = false;
    this.receiptConfirmError = "";
    this.receiptSavedMessage = "";
    this.renderOverlay();
  },

  handleReceiptFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.receiptScanBusy = true;
    this.receiptScanError = "";
    this.renderOverlay();

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result || "").split(",")[1] || "";
        const result = await apiPost("/me/receipts/scan", { imageBase64: base64 });
        // REG-005: scanning only ever returns data for review now --
        // nothing has been saved yet. receiptReview is the editable
        // working copy the user corrects before confirming.
        this.receiptReview = {
          retailerName: result.retailerName || null,
          total: result.total != null ? result.total : null,
          items: Array.isArray(result.items) ? result.items.map((item) => ({ ...item })) : [],
        };
      } catch (error) {
        this.receiptScanError = this.userFacingError(error);
      } finally {
        this.receiptScanBusy = false;
        this.renderOverlay();
      }
    };
    reader.onerror = () => {
      this.receiptScanBusy = false;
      this.receiptScanError = "Could not read that image. Please try again.";
      this.renderOverlay();
    };
    reader.readAsDataURL(file);
  },

  /**
   * REG-005: edits made in the review screen (name/price changes)
   * update the in-memory working copy directly -- nothing is
   * persisted until confirmReceiptSave() is explicitly called.
   */
  updateReceiptReviewItem(index, field, value) {
    if (!this.receiptReview || !this.receiptReview.items[index]) return;
    if (field === "price") {
      this.receiptReview.items[index].price = Number(value);
    } else {
      this.receiptReview.items[index].name = value;
    }
  },

  removeReceiptReviewItem(index) {
    if (!this.receiptReview) return;
    this.receiptReview.items.splice(index, 1);
    this.renderOverlay();
  },

  addReceiptReviewItem() {
    if (!this.receiptReview) return;
    this.receiptReview.items.push({ name: "", price: 0, matchedPromotionName: null, paidPromoPrice: null });
    this.renderOverlay();
  },

  /**
   * REG-005: this is the actual save -- the one and only place a
   * scanned/reviewed receipt is persisted, using the exact same
   * POST /me/purchases endpoint plain manual entry already uses.
   * Whatever is in receiptReview.items at this point (edited,
   * added to, or trimmed by the user) is exactly what gets saved --
   * the receipt's own total is sent separately as totalAmount, never
   * as a line item itself.
   */
  async confirmReceiptSave() {
    if (this.receiptConfirmBusy || !this.receiptReview) return;

    const items = this.receiptReview.items
      .map((item) => ({ ...item, name: String(item.name || "").trim() }))
      .filter((item) => item.name && Number.isFinite(Number(item.price)) && Number(item.price) >= 0);

    if (!items.length) {
      this.receiptConfirmError = "Please add at least one valid item before saving.";
      this.renderOverlay();
      return;
    }

    this.receiptConfirmBusy = true;
    this.receiptConfirmError = "";
    this.renderOverlay();

    try {
      await apiPost("/me/purchases", {
        retailerName: this.receiptReview.retailerName,
        ...(this.receiptReview.total != null ? { totalAmount: this.receiptReview.total } : {}),
        source: "RECEIPT_SCAN",
        items: items.map((item) => ({
          name: item.name,
          price: Number(item.price),
          matchedPromotionName: item.matchedPromotionName ?? null,
          paidPromoPrice: item.paidPromoPrice ?? null,
        })),
      });
      this.receiptConfirmBusy = false;
      this.receiptReview = null;
      this.receiptSavedMessage = items.length + " item" + (items.length === 1 ? "" : "s") + " saved to your purchase history.";
      this.renderOverlay();
    } catch (error) {
      this.receiptConfirmBusy = false;
      this.receiptConfirmError = this.userFacingError(error);
      this.renderOverlay();
    }
  },


  /**
   * REG-004: reads the selected voucher photo, sends it for OCR +
   * field extraction, and pre-fills the add-voucher form with
   * whatever was found -- never saves anything itself. Follows the
   * exact same pattern as handleReceiptFileSelected above, reusing
   * the same base64-conversion approach rather than a second one.
   */
  handleVoucherFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.voucherExtractBusy = true;
    this.voucherExtractError = "";
    this.voucherExtractMessage = "";
    this.renderOverlay();

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result || "").split(",")[1] || "";
        const fields = await apiPost("/me/wallet-vouchers/extract", { imageBase64: base64 });
        this.voucherExtracted = fields;
        const foundAnything = fields && (fields.retailerName || fields.value != null || fields.voucherNumber || fields.expiresAt);
        this.voucherExtractMessage = foundAnything
          ? "We've pre-filled what we could read below -- please check it's correct before saving."
          : "We couldn't read much from that photo. Please fill in the details manually below.";
      } catch (error) {
        this.voucherExtractError = this.userFacingError(error);
      } finally {
        this.voucherExtractBusy = false;
        this.renderOverlay();
      }
    };
    reader.onerror = () => {
      this.voucherExtractBusy = false;
      this.voucherExtractError = "Could not read that image. Please try again, or enter the details manually.";
      this.renderOverlay();
    };
    reader.readAsDataURL(file);
  },

  async openPurchases() {
    this.overlay = "purchases";
    this.purchasesBusy = true;
    this.purchasesError = "";
    this.renderOverlay();
    try {
      this.purchases = await apiGet("/me/purchases");
    } catch (error) {
      this.purchasesError = this.userFacingError(error);
    } finally {
      this.purchasesBusy = false;
      this.renderOverlay();
    }
  },

  async openProfileEdit() {

    if (this.profileBusy) {
      return;
    }

    this.profileError = "";
    this.profileBusy = true;

    this.overlay = "profileEdit";
    this.renderOverlay();

    try {

      const profile =
        await apiGet("/me/profile");

      this.profile = {
        firstName: profile && profile.firstName ? profile.firstName : "",
        lastName: profile && profile.lastName ? profile.lastName : "",
        phone: profile && profile.phone ? profile.phone : ""
      };

      this.profileBusy = false;
      this.renderOverlay();

    } catch (error) {

      this.profileBusy = false;
      this.profileError =
        this.userFacingError(error);

      this.renderOverlay();

    }

  },


  async saveProfile() {

    if (this.profileBusy) {
      return;
    }

    const firstName =
      String(
        document.getElementById("profile-first-name")?.value || ""
      ).trim();

    const lastName =
      String(
        document.getElementById("profile-last-name")?.value || ""
      ).trim();

    const phone =
      String(
        document.getElementById("profile-phone")?.value || ""
      ).trim();

    if (!firstName && !lastName && !phone) {

      this.profileError =
        "Please enter at least one profile detail.";

      this.renderOverlay();

      return;

    }

    this.profileBusy = true;
    this.profileError = "";

    this.profile = {
      firstName,
      lastName,
      phone
    };

    this.renderOverlay();

    try {

      await cloudFetchJson(
        "/me/profile",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            firstName: firstName || null,
            lastName: lastName || null,
            phone: phone || null
          })
        }
      );

      this.data =
        await loadPilotState();

      this.profileBusy = false;
      this.profileError = "";

      this.closeOverlay();

      this.renderAll();

      this.toast("Profile updated");

    } catch (error) {

      this.profileBusy = false;
      this.profileError =
        this.userFacingError(error);

      this.renderOverlay();

    }

  },

  async resendVerification() {
    if (this.verificationBusy) return;
    this.verificationBusy = true;
    this.renderOverlay();
    try {
      await apiPost("/auth/email-verification/request", {});
      this.toast("Verification email sent — check your inbox.");
    } catch (error) {
      this.toast(this.userFacingError(error));
    } finally {
      this.verificationBusy = false;
      this.renderOverlay();
    }
  },

  async submitChangePassword() {
    if (this.passwordChangeBusy) return;

    const currentPassword = String(document.getElementById("current-password")?.value || "");
    const newPassword = String(document.getElementById("new-password")?.value || "");

    this.passwordChangeMessage = "";
    this.passwordChangeError = "";

    if (!currentPassword || newPassword.length < 8) {
      this.passwordChangeError = "Enter your current password and a new password of at least 8 characters.";
      this.renderOverlay();
      return;
    }

    this.passwordChangeBusy = true;
    this.renderOverlay();

    try {
      await apiPost("/me/change-password", { currentPassword, newPassword });
      this.passwordChangeBusy = false;
      this.passwordChangeMessage = "Your password has been changed.";
      const currentInput = document.getElementById("current-password");
      const newInput = document.getElementById("new-password");
      if (currentInput) currentInput.value = "";
      if (newInput) newInput.value = "";
      this.renderOverlay();
    } catch (error) {
      this.passwordChangeBusy = false;
      this.passwordChangeError = this.userFacingError(error);
      this.renderOverlay();
    }
  },

  confirmDeactivateAccount() {
    if (this.deactivateBusy) return;
    if (!window.confirm || window.confirm("Deactivate your account? You'll be logged out everywhere. This can be reversed by contacting support.")) {
      this.deactivateAccount();
    }
  },

  async deactivateAccount() {
    this.deactivateBusy = true;
    this.renderOverlay();
    try {
      await apiPost("/me/deactivate", {});
      this.toast("Your account has been deactivated.");
      window.location.reload();
    } catch (error) {
      this.deactivateBusy = false;
      this.toast(this.userFacingError(error));
      this.renderOverlay();
    }
  },

  /* ======================================================================
     HOUSEHOLD
     ====================================================================== */

  async openHousehold() {
    this.overlay = "household";
    this.householdBusy = true;
    this.householdError = "";
    this.renderOverlay();
    try {
      const [household, invites] = await Promise.all([
        apiGet("/me/household"),
        apiGet("/me/household/invites"),
      ]);
      this.household = household || null;
      this.householdInvites = Array.isArray(invites) ? invites : [];
    } catch (error) {
      this.householdError = this.userFacingError(error);
    } finally {
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  async createHousehold() {
    const name = String(document.getElementById("household-name")?.value || "").trim();
    if (!name) {
      this.householdError = "Enter a household name.";
      this.renderOverlay();
      return;
    }
    this.householdBusy = true;
    this.householdError = "";
    this.renderOverlay();
    try {
      this.household = await apiPost("/me/household", { name });
      this.toast("Household created");
    } catch (error) {
      this.householdError = this.userFacingError(error);
    } finally {
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  editHouseholdName() {
    if (!this.household) return;

    const isOwner =
      this.household.ownerUserId ===
      (this.data && this.data.user && this.data.user.id);

    if (!isOwner) return;

    this.householdEditing = true;
    this.householdError = "";
    this.renderOverlay();

    setTimeout(() => {
      const input = document.getElementById("household-edit-name");
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  },

  cancelHouseholdNameEdit() {
    this.householdEditing = false;
    this.householdError = "";
    this.renderOverlay();
  },

  async saveHouseholdName() {
    if (!this.household) return;

    const name = String(
      document.getElementById("household-edit-name")?.value || ""
    ).trim();

    if (!name) {
      this.householdError = "Enter a household name.";
      this.renderOverlay();
      return;
    }

    this.householdBusy = true;
    this.householdError = "";

    try {
      this.household = await apiPatch(
        "/me/household/" + encodeURIComponent(this.household.id),
        { name }
      );

      this.householdEditing = false;
      this.toast("Household name updated");
    } catch (error) {
      this.householdError = this.userFacingError(error);
    } finally {
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  confirmDeleteHousehold() {
    if (!this.household) return;

    const isOwner =
      this.household.ownerUserId ===
      (this.data && this.data.user && this.data.user.id);

    if (!isOwner) return;

    const confirmed = window.confirm(
      "Delete this household? This will permanently remove the household and its member and invitation records. This cannot be undone."
    );

    if (!confirmed) return;

    this.deleteHousehold();
  },

  async deleteHousehold() {
    if (!this.household) return;

    const isOwner =
      this.household.ownerUserId ===
      (this.data && this.data.user && this.data.user.id);

    if (!isOwner) return;

    this.householdBusy = true;
    this.householdError = "";
    this.renderOverlay();

    try {
      await apiDelete(
        "/me/household/" + encodeURIComponent(this.household.id)
      );

      this.household = null;
      this.householdInvites = [];
      this.householdEditing = false;

      this.toast("Household deleted");
    } catch (error) {
      this.householdError = this.userFacingError(error);
    } finally {
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  async inviteHouseholdMember() {
    const email = String(document.getElementById("household-invite-email")?.value || "").trim();
    if (!email || !this.household) return;
    this.householdBusy = true;
    this.householdError = "";
    this.renderOverlay();
    try {
      const member = await apiPost("/me/household/" + encodeURIComponent(this.household.id) + "/members", { email });
      this.household.members = (this.household.members || []).filter((m) => m.email !== member.email);
      this.household.members.push(member);
      const input = document.getElementById("household-invite-email");
      if (input) input.value = "";
      this.toast("Invite sent");
    } catch (error) {
      this.householdError = this.userFacingError(error);
    } finally {
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  async removeHouseholdMember(memberId) {
    if (!this.household) return;
    this.householdBusy = true;
    this.renderOverlay();
    try {
      await apiDelete("/me/household/" + encodeURIComponent(this.household.id) + "/members/" + encodeURIComponent(memberId));
      this.household.members = (this.household.members || []).filter((m) => m.id !== memberId);
      this.toast("Member removed");
    } catch (error) {
      this.toast(this.userFacingError(error));
    } finally {
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  async acceptHouseholdInvite(householdId) {
    this.householdBusy = true;
    this.renderOverlay();
    try {
      await apiPost("/me/household/" + encodeURIComponent(householdId) + "/accept", {});
      this.toast("You've joined the household");
      await this.openHousehold();
    } catch (error) {
      this.toast(this.userFacingError(error));
      this.householdBusy = false;
      this.renderOverlay();
    }
  },

  /* ======================================================================
     NOTIFICATIONS
     ====================================================================== */

  async openNotifications() {
    this.overlay = "notifications";
    this.notificationsBusy = true;
    this.renderOverlay();
    try {
      const [prefs, list] = await Promise.all([
        apiGet("/me/notification-preferences"),
        apiGet("/me/notifications"),
      ]);
      this.notificationPreferences = prefs;
      this.notifications = Array.isArray(list) ? list : [];
    } catch (error) {
      this.toast(this.userFacingError(error));
    } finally {
      this.notificationsBusy = false;
      this.renderOverlay();
    }
  },

  async toggleNotificationPref(field) {
    if (!this.notificationPreferences) return;
    const newValue = !this.notificationPreferences[field];
    this.notificationPreferences[field] = newValue; // optimistic
    this.renderOverlay();
    try {
      await apiPatch("/me/notification-preferences", { [field]: newValue });
    } catch (error) {
      this.notificationPreferences[field] = !newValue; // revert on failure
      this.toast(this.userFacingError(error));
      this.renderOverlay();
    }
  },

  async markNotificationRead(notificationId) {
    const note = (this.notifications || []).find((n) => n.id === notificationId);
    if (note) note.status = "READ";
    this.renderOverlay();
    try {
      await apiPost("/me/notifications/" + encodeURIComponent(notificationId) + "/read", {});
    } catch (error) {
      this.toast(this.userFacingError(error));
    }
  },

  /* ======================================================================
     PRIVACY & CONSENT
     ====================================================================== */

  async openPrivacy() {
    this.overlay = "privacy";
    this.privacyBusy = true;
    this.renderOverlay();
    try {
      this.consent = await apiGet("/me/consent");
    } catch (error) {
      this.toast(this.userFacingError(error));
    } finally {
      this.privacyBusy = false;
      this.renderOverlay();
    }
  },

  async toggleConsent(field) {
    if (!this.consent) return;
    const newValue = !this.consent[field];
    this.consent[field] = newValue; // optimistic
    this.renderOverlay();
    try {
      await apiPatch("/me/consent", { [field]: newValue });
    } catch (error) {
      this.consent[field] = !newValue; // revert on failure
      this.toast(this.userFacingError(error));
      this.renderOverlay();
    }
  },

  /* ======================================================================
     SUPPORT
     ====================================================================== */

  async openSupport() {
    this.overlay = "support";
    this.supportMessage = "";
    this.supportError = "";
    this.renderOverlay();
    await this.loadMySupportRequests();
  },

  /**
   * BN-022: the backend already had a complete ticket-tracking loop
   * (GET /me/support/requests, staff resolve/reply via admin.html) --
   * the consumer app only ever submitted, with no way to see a
   * request's status or that a reference number even exists. This is
   * the missing other half: fetch and show the user's own history.
   */
  async loadMySupportRequests() {
    try {
      this.mySupportRequests = await apiGet("/me/support/requests");
    } catch (error) {
      // Best-effort -- a failure here shouldn't block the submit form
      // itself from working, so the list is simply left empty/stale
      // rather than surfacing an error over the whole overlay.
      this.mySupportRequests = this.mySupportRequests || [];
    }
    this.renderOverlay();
  },

  async submitSupportRequest() {
    if (this.supportBusy) return;

    const subject = String(document.getElementById("support-subject")?.value || "").trim();
    const message = String(document.getElementById("support-message")?.value || "").trim();
    const email = (this.data && this.data.user && this.data.user.email) || "";

    if (!subject || !message) {
      this.supportError = "Please enter both a subject and a message.";
      this.renderOverlay();
      return;
    }

    this.supportBusy = true;
    this.supportError = "";
    this.renderOverlay();

    try {
      const result = await apiPost("/support/requests", { email, subject, message });
      this.supportBusy = false;
      const reference = result && result.requestId ? String(result.requestId).slice(0, 8).toUpperCase() : null;
      this.supportMessage = reference
        ? "Your request has been received (reference " + reference + "). We'll get back to you by email."
        : "Your request has been received. We'll get back to you by email.";
      const subjectInput = document.getElementById("support-subject");
      const messageInput = document.getElementById("support-message");
      if (subjectInput) subjectInput.value = "";
      if (messageInput) messageInput.value = "";
      this.renderOverlay();
      await this.loadMySupportRequests();
    } catch (error) {
      this.supportBusy = false;
      this.supportError = this.userFacingError(error);
      this.renderOverlay();
    }
  },

  /* ======================================================================
     BN-024: WALLET VOUCHERS
     A voucher a user has physically received from a retailer (printed
     coupon, SMS/email voucher, till-slip attached voucher) -- distinct
     from a loyalty card's synced rewards. No live retailer price
     lookup dependency at all; a self-contained wallet asset the user
     captures and manages directly.
     ====================================================================== */

  async openVouchers() {
    this.overlay = "vouchers";
    this.voucherFormOpen = false;
    this.voucherError = "";
    this.voucherFormBarcode = "";
    this.renderOverlay();
    await this.loadVouchers();
  },

  async loadVouchers() {
    try {
      this.vouchers = await apiGet("/me/wallet-vouchers");
    } catch (error) {
      this.vouchers = this.vouchers || [];
    }
    this.renderOverlay();
  },

  /**
   * Issue 3: switches between the retailer dropdown and the "Other"
   * free-text fallback. The hidden #voucher-retailer field (read by
   * addVoucher()) is kept in sync directly here, rather than adding a
   * second read path for the dropdown vs. the text input.
   */
  handleVoucherRetailerSelectChange(value) {
    this.voucherRetailerOther = value === "__other__";
    if (!this.voucherRetailerOther) {
      this.voucherExtracted = this.voucherExtracted || {};
      this.voucherExtracted.retailerName = value;
    }
    this.renderOverlay();
  },

  showAddVoucherForm() {
    this.voucherFormOpen = true;
    this.voucherError = "";
    this.voucherFormBarcode = "";
    this.voucherExtracted = null;
    this.voucherExtractError = "";
    this.voucherExtractMessage = "";
    this.voucherRetailerOther = null;
    this.renderOverlay();
  },

  cancelAddVoucherForm() {
    this.voucherFormOpen = false;
    this.voucherError = "";
    this.voucherExtracted = null;
    this.voucherExtractError = "";
    this.voucherExtractMessage = "";
    this.renderOverlay();
  },

  async addVoucher() {
    if (this.voucherBusy) return;

    const retailerName = String(document.getElementById("voucher-retailer")?.value || "").trim();
    const barcode = String(this.voucherFormBarcode || document.getElementById("voucher-barcode")?.value || "").trim();
    const voucherNumber = String(document.getElementById("voucher-number")?.value || "").trim();
    const valueRaw = document.getElementById("voucher-value")?.value;
    const validFromRaw = String(document.getElementById("voucher-valid-from")?.value || "").trim();
    const expiryRaw = String(document.getElementById("voucher-expiry")?.value || "").trim();

    const value = Number(valueRaw);

    if (!retailerName || !barcode) {
      this.voucherError = "Please enter the retailer and the voucher barcode.";
      this.renderOverlay();
      return;
    }

    if (!Number.isFinite(value) || value <= 0) {
      this.voucherError = "Please enter a valid voucher value.";
      this.renderOverlay();
      return;
    }

    this.voucherBusy = true;
    this.voucherError = "";
    this.renderOverlay();

    try {
      await apiPost("/me/wallet-vouchers", {
        retailerName,
        barcode,
        value,
        ...(voucherNumber ? { voucherNumber } : {}),
        ...(validFromRaw ? { validFrom: new Date(validFromRaw + "T00:00:00").toISOString() } : {}),
        ...(expiryRaw ? { expiresAt: new Date(expiryRaw + "T23:59:59").toISOString() } : {}),
      });
      this.voucherBusy = false;
      this.voucherFormOpen = false;
      this.voucherFormBarcode = "";
      this.voucherExtracted = null;
      this.renderOverlay();
      await this.loadVouchers();
    } catch (error) {
      this.voucherBusy = false;
      this.voucherError = this.userFacingError(error);
      this.renderOverlay();
    }
  },

  openVoucherDetail(voucherId) {
    this.overlay = "voucher-detail";
    this.detailVoucherId = voucherId;
    this.voucherError = "";
    this.renderOverlay();
  },

  async redeemVoucher(voucherId) {
    if (this.voucherBusy) return;
    this.voucherBusy = true;
    this.voucherError = "";
    this.renderOverlay();

    try {
      await apiPost("/me/wallet-vouchers/" + encodeURIComponent(voucherId) + "/redeem", {});
      this.voucherBusy = false;
      await this.loadVouchers();
      // The list reload already re-renders; make sure the detail
      // screen (if still open) reflects the new status too rather
      // than showing a stale "Redeem" button for a voucher that's now
      // actually redeemed.
      this.renderOverlay();
    } catch (error) {
      this.voucherBusy = false;
      this.voucherError = this.userFacingError(error);
      this.renderOverlay();
    }
  },

  /**
   * A real, permanent delete -- for a voucher captured incorrectly or
   * one that's expired and the user wants gone from their wallet.
   * Confirmed before acting, since this can't be undone the way
   * redeeming (a status change) can be reasoned about.
   */
  async deleteVoucher(voucherId) {
    if (this.voucherBusy) return;
    if (!confirm("Delete this voucher? This can't be undone.")) return;

    this.voucherBusy = true;
    this.voucherError = "";
    this.renderOverlay();

    try {
      await apiDeleteLocal("/me/wallet-vouchers/" + encodeURIComponent(voucherId));
      this.voucherBusy = false;
      this.overlay = "vouchers";
      this.renderOverlay();
      await this.loadVouchers();
    } catch (error) {
      this.voucherBusy = false;
      this.voucherError = this.userFacingError(error);
      this.renderOverlay();
    }
  },

  findVoucherById(voucherId) {
    return (this.vouchers || []).find((v) => v.id === voucherId) || null;
  },

  voucherStatusLabel(voucher) {
    if (voucher.effectiveStatus === "REDEEMED") return "Redeemed";
    if (voucher.effectiveStatus === "EXPIRED") return "Expired";
    return "Active";
  },

  renderVouchersOverlay() {
    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">My vouchers</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    if (this.voucherFormOpen) {
      html += this.renderAddVoucherForm();
      html += "</div>";
      return html;
    }

    html += '<button class="btn btn-primary btn-block" data-action="add-voucher" style="margin-bottom:18px">' + ICONS.plus + ' Add a voucher</button>';

    const vouchers = this.vouchers || [];
    if (!vouchers.length) {
      html += '<div class="bn-benefits-empty">No vouchers in your wallet yet. Add one when you receive it from a retailer.</div>';
    } else {
      html += '<div class="bn-detail-list">';
      vouchers.forEach((voucher) => {
        const isRedeemed = voucher.effectiveStatus === "REDEEMED";
        const isExpired = voucher.effectiveStatus === "EXPIRED";
        const badgeStyle = isRedeemed || isExpired
          ? "background:var(--grey-tint, #f0f0f0);color:var(--grey-muted)"
          : "background:var(--green-tint);color:var(--green-deep)";
        html +=
          '<button class="wallet-list-row" data-action="open-voucher-detail" data-id="' + this.escapeAttr(voucher.id) + '" style="width:100%;text-align:left;border:none;background:none;padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div>' +
          '<div style="font-weight:600">' + this.escapeHtml(voucher.retailerName) + '</div>' +
          '<div style="font-size:11px;color:var(--grey-muted);margin-top:2px">' +
          formatRand(voucher.value) +
          (voucher.expiresAt ? " · Expires " + new Date(voucher.expiresAt).toLocaleDateString("en-ZA") : "") +
          '</div>' +
          '</div>' +
          '<span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;' + badgeStyle + '">' +
          this.voucherStatusLabel(voucher) +
          '</span>' +
          '</div>' +
          '</button>';
      });
      html += "</div>";
    }

    html += "</div>";
    return html;
  },

  renderAddVoucherForm() {
    // REG-004: extracted fields (if a photo scan has run) pre-fill
    // the form below -- this is never auto-saved, the user reviews
    // and can correct every field before "Save voucher" actually
    // persists anything.
    const extracted = this.voucherExtracted || {};

    let html = "";
    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 18px">Add a voucher you\'ve received from a retailer, so you can find and present it again when you\'re ready to redeem it.</p>';

    if (this.voucherError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.voucherError) + '</div>';
    }
    if (this.voucherExtractError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.voucherExtractError) + '</div>';
    }
    if (this.voucherExtractMessage) {
      html += '<div class="auth-error" style="margin-bottom:14px;background:var(--green-tint);color:var(--green-deep)">' + this.escapeHtml(this.voucherExtractMessage) + '</div>';
    }

    html += '<label class="capture-btn" for="voucher-scan-file-input">' + ICONS.camera + '<span>' +
      (this.voucherExtractBusy ? "Reading voucher…" : "Scan voucher photo") + '</span></label>';
    html += '<input type="file" id="voucher-scan-file-input" accept="image/*" capture="environment" style="display:none" ' + (this.voucherExtractBusy ? "disabled" : "") + '>';
    html += '<p style="font-size:11px;color:var(--grey-muted);margin:8px 0 18px">We\'ll try to read the retailer, value, dates and reference number from the photo -- review everything below before saving.</p>';

    html += '<label class="field-label" for="voucher-retailer">Retailer</label>';
    // Issue 3 (user regression testing): a free-text retailer field
    // made users type exactly what OCR happened to find, or guess at
    // spelling if it found nothing -- a dropdown of the same real
    // retailer catalogue used everywhere else in the app (RETAILERS,
    // from /catalog/loyalty-programmes) is both easier to use and
    // keeps voucher retailer names consistent with the rest of the
    // app. "Other" is kept as an escape hatch, since a voucher can
    // genuinely come from a retailer outside this catalogue.
    const knownRetailerNames = [...new Set((typeof RETAILERS !== "undefined" ? RETAILERS : []).map((r) => r.name))];
    const extractedRetailer = extracted.retailerName || "";
    const matchedKnownRetailer = knownRetailerNames.find((n) => n.toLowerCase() === extractedRetailer.toLowerCase());
    const showOtherInput = this.voucherRetailerOther != null
      ? this.voucherRetailerOther
      : Boolean(extractedRetailer && !matchedKnownRetailer);

    html += '<select id="voucher-retailer-select" class="text-input" ' + (this.voucherBusy ? "disabled" : "") + '>';
    html += '<option value="">Select a retailer…</option>';
    knownRetailerNames.forEach((name) => {
      html += '<option value="' + this.escapeAttr(name) + '" ' + (matchedKnownRetailer === name && !showOtherInput ? "selected" : "") + '>' + this.escapeHtml(name) + '</option>';
    });
    html += '<option value="__other__" ' + (showOtherInput ? "selected" : "") + '>Other (not listed)</option>';
    html += '</select>';

    if (showOtherInput) {
      html += '<input id="voucher-retailer" class="text-input" type="text" placeholder="Enter the retailer name" value="' + this.escapeAttr(matchedKnownRetailer ? "" : extractedRetailer) + '" style="margin-top:8px" ' + (this.voucherBusy ? "disabled" : "") + '>';
    } else {
      // A hidden field keeps addVoucher()'s existing
      // getElementById("voucher-retailer") read working unchanged --
      // its value is kept in sync with the dropdown's own selection.
      html += '<input id="voucher-retailer" type="hidden" value="' + this.escapeAttr(matchedKnownRetailer || "") + '">';
    }

    html += '<label class="field-label" for="voucher-barcode" style="margin-top:14px">Voucher barcode</label>';
    html += '<input id="voucher-barcode" class="text-input" type="text" placeholder="Scan or type the barcode" value="' + this.escapeAttr(this.voucherFormBarcode || "") + '" ' + (this.voucherBusy ? "disabled" : "") + '>';

    if (this.barcodeDetectionSupported && this.barcodeDetectionSupported()) {
      if (this.scanningLive && this._barcodeScanContext === "voucher") {
        html += '<div style="margin-top:10px;border-radius:12px;overflow:hidden;background:#000"><video id="barcode-scan-video" autoplay playsinline muted style="width:100%;display:block"></video></div>';
        html += '<button class="btn btn-secondary btn-block" data-action="cancel-voucher-barcode-scan" style="margin-top:8px">Stop scanning</button>';
      } else {
        html += '<button class="btn btn-secondary btn-block" data-action="start-voucher-barcode-scan" style="margin-top:8px">Scan barcode with camera</button>';
      }
    }

    if (this.barcodeScanUnsupportedMessage) {
      html += '<div style="font-size:11px;color:var(--grey-muted);margin-top:6px">' + this.escapeHtml(this.barcodeScanUnsupportedMessage) + '</div>';
    }

    html += '<label class="field-label" for="voucher-number" style="margin-top:14px">Voucher number / reference (optional)</label>';
    html += '<input id="voucher-number" class="text-input" type="text" placeholder="e.g. REF-98765" value="' + this.escapeAttr(extracted.voucherNumber || "") + '" ' + (this.voucherBusy ? "disabled" : "") + '>';

    html += '<label class="field-label" for="voucher-value" style="margin-top:14px">Value (R)</label>';
    html += '<input id="voucher-value" class="text-input" type="number" min="0.01" step="0.01" placeholder="0.00" value="' + this.escapeAttr(extracted.value != null ? extracted.value : "") + '" ' + (this.voucherBusy ? "disabled" : "") + '>';

    html += '<label class="field-label" for="voucher-valid-from" style="margin-top:14px">Valid from (optional)</label>';
    html += '<input id="voucher-valid-from" class="text-input" type="date" value="' + this.escapeAttr(extracted.validFrom || "") + '" ' + (this.voucherBusy ? "disabled" : "") + '>';

    html += '<label class="field-label" for="voucher-expiry" style="margin-top:14px">Expiry date (optional)</label>';
    html += '<input id="voucher-expiry" class="text-input" type="date" value="' + this.escapeAttr(extracted.expiresAt || "") + '" ' + (this.voucherBusy ? "disabled" : "") + '>';

    html += '<button class="btn btn-primary btn-block" data-action="add-voucher-submit" style="margin-top:18px" ' + (this.voucherBusy ? "disabled" : "") + '>' +
      (this.voucherBusy ? "Saving…" : "Save voucher") + '</button>';
    html += '<button class="btn btn-secondary btn-block" data-action="cancel-add-voucher" style="margin-top:8px" ' + (this.voucherBusy ? "disabled" : "") + '>Cancel</button>';

    return html;
  },

  renderVoucherDetailOverlay() {
    const voucher = this.findVoucherById(this.detailVoucherId);

    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-voucher-detail" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">Voucher</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    if (!voucher) {
      html += '<div class="bn-benefits-empty">This voucher could not be found.</div></div>';
      return html;
    }

    if (this.voucherError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.voucherError) + '</div>';
    }

    const isRedeemed = voucher.effectiveStatus === "REDEEMED";
    const isExpired = voucher.effectiveStatus === "EXPIRED";
    const isActive = !isRedeemed && !isExpired;

    html += '<div style="text-align:center;padding:20px 0">';
    html += '<div style="font-size:13px;color:var(--grey-muted)">' + this.escapeHtml(voucher.retailerName) + '</div>';
    html += '<div style="font-size:32px;font-weight:700;margin-top:4px">' + formatRand(voucher.value) + '</div>';
    if (voucher.expiresAt) {
      html += '<div style="font-size:12px;color:var(--grey-muted);margin-top:4px">Expires ' + new Date(voucher.expiresAt).toLocaleDateString("en-ZA") + '</div>';
    }
    html += "</div>";

    // The barcode value itself, shown large and in a monospace font so
    // it can be read (typed in) or scanned directly off this screen at
    // checkout -- this app doesn't render an actual scannable barcode
    // symbology, just the value large enough to present or key in.
    html += '<div style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:24px;text-align:center;margin-bottom:18px">';
    html += '<div style="font-family:monospace;font-size:22px;letter-spacing:2px;word-break:break-all">' + this.escapeHtml(voucher.barcode) + '</div>';
    html += "</div>";

    if (isRedeemed) {
      html += '<div class="bn-benefits-empty">This voucher has already been redeemed' + (voucher.redeemedAt ? " (" + timeAgo(voucher.redeemedAt) + ")" : "") + '.</div>';
    } else if (isExpired) {
      html += '<div class="bn-benefits-empty">This voucher has expired and can no longer be redeemed.</div>';
    } else if (isActive) {
      html += '<button class="btn btn-primary btn-block" data-action="redeem-voucher" data-id="' + this.escapeAttr(voucher.id) + '" ' + (this.voucherBusy ? "disabled" : "") + '>' +
        (this.voucherBusy ? "Marking as redeemed…" : "Mark as redeemed") + '</button>';
    }

    html += '<button class="btn btn-secondary btn-block" data-action="delete-voucher" data-id="' + this.escapeAttr(voucher.id) + '" style="margin-top:10px" ' + (this.voucherBusy ? "disabled" : "") + '>' +
      (this.voucherBusy ? "Deleting…" : "Delete this voucher") + '</button>';

    html += "</div>";
    return html;
  },

  /* ======================================================================
     MY LOCATION
     Fundamental infrastructure for province/store-aware pricing
     (Woolworths' Constructor.io zones, Pick n Pay's real store code)
     and any future nearest-store recommendation. Saved to the user's
     profile via the existing PATCH /me/profile endpoint -- once set,
     the backend uses it automatically on every shopping-list price
     lookup, without the frontend needing to pass it on every request.
     ====================================================================== */

  SA_PROVINCES: [
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape", "Western Cape",
  ],

  async openLocation() {
    this.overlay = "location";
    this.locationError = "";
    this.locationMessage = "";
    this.locationDetecting = false;
    this.locationProfile = null;
    this.renderOverlay();

    try {
      this.locationProfile = await apiGet("/me/profile");
    } catch (error) {
      // Best-effort -- the form still works for entering a new
      // location even if the current saved one couldn't be fetched;
      // it just won't be pre-filled.
      this.locationProfile = {};
    }
    this.renderOverlay();
  },

  async saveLocation() {
    if (this.locationBusy) return;

    const province = document.getElementById("location-province")?.value || "";
    const suburb = String(document.getElementById("location-suburb")?.value || "").trim();
    const postalCode = String(document.getElementById("location-postal-code")?.value || "").trim();
    const pnpStoreCode = String(document.getElementById("location-pnp-store-code")?.value || "").trim();

    this.locationBusy = true;
    this.locationError = "";
    this.locationMessage = "";
    this.renderOverlay();

    try {
      const payload = {
        province: province || null,
        suburb: suburb || null,
        postalCode: postalCode || null,
        pnpStoreCode: pnpStoreCode || null,
      };
      // Carry forward any coordinates already resolved via
      // detectLocation() in this same session -- saveLocation() itself
      // has no way to know them otherwise, since they aren't shown as
      // editable form fields.
      if (this._detectedLatitude != null && this._detectedLongitude != null) {
        payload.latitude = this._detectedLatitude;
        payload.longitude = this._detectedLongitude;
      }

      const updated = await apiPatchLocal("/me/profile", payload);
      this.locationProfile = updated;
      this.locationBusy = false;
      this.locationMessage = "Your location has been saved.";
      this.renderOverlay();
    } catch (error) {
      this.locationBusy = false;
      this.locationError = this.userFacingError(error);
      this.renderOverlay();
    }
  },

  /**
   * "Use my current location": browser Geolocation API for
   * coordinates, then a direct client-side reverse-geocode call to
   * OpenStreetMap's free, keyless Nominatim service to derive a
   * province from those coordinates -- purely a convenience to
   * pre-fill the province dropdown; the user still confirms (or
   * corrects) it before saving. Called directly from the browser, not
   * proxied through the backend -- a single, user-triggered lookup is
   * exactly the low-volume use Nominatim's public service is meant
   * for, and the browser's own Referer header already identifies the
   * request per their usage policy, with no custom backend needed.
   */
  async detectLocation() {
    if (this.locationDetecting) return;

    if (!("geolocation" in navigator)) {
      this.locationError = "Your browser doesn't support location detection. Please select your province manually.";
      this.renderOverlay();
      return;
    }

    this.locationDetecting = true;
    this.locationError = "";
    this.renderOverlay();

    let position;
    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
    } catch (error) {
      this.locationDetecting = false;
      this.locationError = "Location permission was denied. Please select your province manually.";
      this.renderOverlay();
      return;
    }

    const { latitude, longitude } = position.coords;
    this._detectedLatitude = latitude;
    this._detectedLongitude = longitude;

    try {
      const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
        encodeURIComponent(latitude) + "&lon=" + encodeURIComponent(longitude) + "&addressdetails=1";
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Location lookup failed");
      const body = await response.json();
      const detectedState = body?.address?.state || "";

      const matchedProvince = this.SA_PROVINCES.find(
        (p) => p.toLowerCase() === String(detectedState).toLowerCase()
      );

      this.locationDetecting = false;

      if (matchedProvince) {
        const provinceSelect = document.getElementById("location-province");
        if (provinceSelect) provinceSelect.value = matchedProvince;
        this.locationMessage = "Detected: " + matchedProvince + ". Review and save below.";
      } else {
        this.locationError = "Couldn't automatically match your province. Please select it manually below.";
      }

      const suburbInput = document.getElementById("location-suburb");
      const detectedSuburb = body?.address?.suburb || body?.address?.town || body?.address?.city || "";
      if (suburbInput && detectedSuburb && !suburbInput.value) {
        suburbInput.value = detectedSuburb;
      }
      const postalInput = document.getElementById("location-postal-code");
      const detectedPostcode = body?.address?.postcode || "";
      if (postalInput && detectedPostcode && !postalInput.value) {
        postalInput.value = detectedPostcode;
      }

      this.renderOverlay();
    } catch (error) {
      this.locationDetecting = false;
      this.locationError = "Couldn't detect your location automatically. Please select your province manually.";
      this.renderOverlay();
    }
  },

  renderLocationOverlay() {
    const profile = this.locationProfile || {};

    let html = "";
    html +=
      '<div class="overlay-header"><button class="overlay-back" data-action="close-overlay" aria-label="Back">' +
      ICONS.chevronLeft + '</button><span class="title">My location</span>' +
      '<button class="overlay-close" data-action="close-overlay" aria-label="Close">' + ICONS.x + '</button></div>';
    html += '<div class="overlay-body">';

    html += '<p style="font-size:13px;color:var(--grey-muted);margin:0 0 18px">Setting your location helps us show accurate prices at retailers where pricing varies by region or store, and will help us recommend your closest stores in future.</p>';

    if (this.locationMessage) {
      html += '<div class="auth-error" style="margin-bottom:14px;background:var(--green-tint);color:var(--green-deep)">' + this.escapeHtml(this.locationMessage) + '</div>';
    }
    if (this.locationError) {
      html += '<div class="auth-error" style="margin-bottom:14px">' + this.escapeHtml(this.locationError) + '</div>';
    }

    html += '<button class="btn btn-secondary btn-block" data-action="detect-location" style="margin-bottom:18px" ' + (this.locationDetecting ? "disabled" : "") + '>' +
      (this.locationDetecting ? "Detecting your location…" : "Use my current location") + '</button>';

    html += '<label class="field-label" for="location-province">Province</label>';
    html += '<select id="location-province" class="text-input" ' + (this.locationBusy ? "disabled" : "") + '>';
    html += '<option value="">Not set</option>';
    this.SA_PROVINCES.forEach((p) => {
      html += '<option value="' + this.escapeAttr(p) + '" ' + (profile.province === p ? "selected" : "") + '>' + this.escapeHtml(p) + '</option>';
    });
    html += '</select>';

    html += '<label class="field-label" for="location-suburb" style="margin-top:14px">Suburb (optional)</label>';
    html += '<input id="location-suburb" class="text-input" type="text" value="' + this.escapeAttr(profile.suburb || "") + '" ' + (this.locationBusy ? "disabled" : "") + '>';

    html += '<label class="field-label" for="location-postal-code" style="margin-top:14px">Postal code (optional)</label>';
    html += '<input id="location-postal-code" class="text-input" type="text" value="' + this.escapeAttr(profile.postalCode || "") + '" ' + (this.locationBusy ? "disabled" : "") + '>';

    html += '<label class="field-label" for="location-pnp-store-code" style="margin-top:14px">Pick n Pay store code (optional, advanced)</label>';
    html += '<input id="location-pnp-store-code" class="text-input" type="text" placeholder="e.g. WC21" value="' + this.escapeAttr(profile.pnpStoreCode || "") + '" ' + (this.locationBusy ? "disabled" : "") + '>';
    html += '<div style="font-size:11px;color:var(--grey-muted);margin-top:4px">There\'s no automatic way to find this yet -- if you know your local Pick n Pay\'s code, entering it here gives that store\'s real price instead of a general estimate.</div>';

    html += '<button class="btn btn-primary btn-block" data-action="save-location" style="margin-top:18px" ' + (this.locationBusy ? "disabled" : "") + '>' +
      (this.locationBusy ? "Saving…" : "Save location") + '</button>';

    html += "</div>";
    return html;
  },

  async openPromotions() {
    this.overlay = "promotions";
    this.promotionsSearchTerm = "";
    await this.loadPromotions();
  },

  async searchPromotions() {
    this.promotionsSearchTerm = String(document.getElementById("promotions-search")?.value || "").trim();
    await this.loadPromotions();
  },

  async loadPromotions() {
    this.promotionsBusy = true;
    this.promotionsError = "";
    this.renderOverlay();
    try {
      const query = this.promotionsSearchTerm
        ? "?q=" + encodeURIComponent(this.promotionsSearchTerm)
        : "";
      const result = await apiGet("/promotions" + query);
      this.promotions = (result && Array.isArray(result.promotions)) ? result.promotions : [];
      this.promotionsSourcesFailed = (result && result.sourcesFailed) || 0;
    } catch (error) {
      this.promotionsError = this.userFacingError(error);
      this.promotions = [];
    } finally {
      this.promotionsBusy = false;
      this.renderOverlay();
    }
  },

  /* ========================================================================
     BIND VIEW
     ======================================================================== */

  bindView() {

    const search =
      document.getElementById(
        "wallet-search-input"
      );

    if (search) {

      search.addEventListener(
        "input",
        (e) => {

          this.query =
            e.target.value;

          this.renderView();

          this.restoreFocus(
            "wallet-search-input"
          );

        }
      );

    }

    const itemForm = document.getElementById("shopping-item-form");
    if (itemForm) itemForm.addEventListener("submit", (e) => { e.preventDefault(); this.addShoppingItem(); });

    document.querySelectorAll("[data-shopping-item-field]").forEach((input) => {
      input.addEventListener("change", (e) => {
        this.updateShoppingItem(e.currentTarget.dataset.id, e.currentTarget.dataset.shoppingItemField, e.currentTarget.value);
      });
    });

    this.root_click_bind(
      "view-root"
    );

  },


  /* ========================================================================
     BIND OVERLAY
     ======================================================================== */

  bindOverlay() {

    const addSearch =
      document.getElementById(
        "add-search-input"
      );

    if (addSearch) {

      addSearch.addEventListener(
        "input",
        (e) => {

          this.addQuery =
            e.target.value;

          this.renderOverlay();

          this.restoreFocus(
            "add-search-input"
          );

        }
      );

    }

    const cardNum =
      document.getElementById(
        "card-number-input"
      );

    if (cardNum) {

      cardNum.addEventListener(
        "input",
        (e) => {

          this.cardNumber =
            e.target.value.trim();

          const btn =
            document.getElementById(
              "confirm-add-btn"
            );

          if (btn) {
            btn.disabled =
              !this.cardNumber;
          }

        }
      );

    }

    const fileInput =
      document.getElementById(
        "capture-file-input"
      );

    if (fileInput) {

      fileInput.addEventListener(
        "change",
        (e) =>
          this.handleCapture(e)
      );

    }

    const receiptFileInput =
      document.getElementById(
        "receipt-scan-file-input"
      );

    if (receiptFileInput) {

      receiptFileInput.addEventListener(
        "change",
        (e) =>
          this.handleReceiptFileSelected(e)
      );

    }

    const voucherFileInput =
      document.getElementById(
        "voucher-scan-file-input"
      );

    if (voucherFileInput) {

      voucherFileInput.addEventListener(
        "change",
        (e) =>
          this.handleVoucherFileSelected(e)
      );

    }

    const voucherRetailerSelect =
      document.getElementById(
        "voucher-retailer-select"
      );

    if (voucherRetailerSelect) {

      voucherRetailerSelect.addEventListener(
        "change",
        (e) =>
          this.handleVoucherRetailerSelectChange(e.target.value)
      );

    }

    const overlayRootForInput =
      document.getElementById(
        "overlay-root"
      );

    if (overlayRootForInput) {

      overlayRootForInput.oninput =
        (e) => {
          const reviewField =
            e.target.closest(
              "[data-receipt-review-field]"
            );
          if (reviewField) {
            this.updateReceiptReviewItem(
              Number(reviewField.dataset.index),
              reviewField.dataset.receiptReviewField,
              reviewField.value
            );
            return;
          }

          if (e.target.id === "buy-again-list-select") {
            this.setBuyAgainTargetList(e.target.value);
          }
        };

    }

    this.root_click_bind(
      "overlay-root"
    );

  },


  restoreFocus(id) {

    const el =
      document.getElementById(id);

    if (!el) {
      return;
    }

    el.focus();

    const v =
      el.value;

    el.value = "";

    el.value = v;

  },


  root_click_bind(rootId) {

    const root =
      document.getElementById(
        rootId
      );

    if (!root) {
      return;
    }

    root.onclick =
      (e) => {

        const el =
          e.target.closest(
            "[data-action]"
          );

        if (!el) {
          return;
        }

        if (
          el.dataset.stop ===
          "1"
        ) {

          e.stopPropagation();

        }

        this.handleAction(
          el.dataset.action,
          el.dataset
        );

      };

  },


  /* ========================================================================
     ACTIONS
     ======================================================================== */

  handleAction(
    action,
    data
  ) {

    switch (action) {

      case "auth-toggle":
        this.authScreen = this.authScreen === "login" ? "register" : "login";
        this.authError = "";
        this.renderAuth();
        break;

      case "forgot-password":
        this.authScreen = "forgot-password";
        this.authError = "";
        this.authRouteMessage = "";
        this.renderAuth();
        break;

      case "back-to-login":
        this.authScreen = "login";
        this.authError = "";
        this.authRoute = null;
        this.authRouteToken = "";
        this.authRouteMessage = "";
        history.replaceState(
          {},
          document.title,
          window.location.pathname.replace(/\/(?:reset-password|verify-email)\/?$/i, "/")
        );
        this.renderAuth();
        break;

      case "logout":
        this.handleLogout(true);
        break;

      case "edit-profile":
        this.openProfileEdit();
        break;

      case "save-profile":
        this.saveProfile();
        break;

      case "resend-verification":
        this.resendVerification();
        break;

      case "submit-change-password":
        this.submitChangePassword();
        break;

      case "deactivate-account":
        this.confirmDeactivateAccount();
        break;

      case "open-household":
        this.openHousehold();
        break;

      case "create-household":
        this.createHousehold();
        break;

      case "edit-household-name":
        this.editHouseholdName();
        break;

      case "save-household-name":
        this.saveHouseholdName();
        break;

      case "cancel-household-name":
        this.cancelHouseholdNameEdit();
        break;

      case "delete-household":
        this.confirmDeleteHousehold();
        break;

      case "invite-household-member":
        this.inviteHouseholdMember();
        break;

      case "remove-household-member":
        this.removeHouseholdMember(data.id);
        break;

      case "accept-household-invite":
        this.acceptHouseholdInvite(data.id);
        break;

      case "open-notifications":
        this.openNotifications();
        break;

      case "toggle-notification-pref":
        this.toggleNotificationPref(data.field);
        break;

      case "mark-notification-read":
        this.markNotificationRead(data.id);
        break;

      case "open-privacy":
        this.openPrivacy();
        break;

      case "toggle-consent":
        this.toggleConsent(data.field);
        break;

      case "open-support":
        this.openSupport();
        break;

      case "submit-support-request":
        this.submitSupportRequest();
        break;

      case "open-promotions":
        this.openPromotions();
        break;

      case "open-location":
        this.openLocation();
        break;

      case "save-location":
        this.saveLocation();
        break;

      case "detect-location":
        this.detectLocation();
        break;

      case "open-vouchers":
        this.openVouchers();
        break;

      case "add-voucher":
        this.showAddVoucherForm();
        break;

      case "add-voucher-submit":
        this.addVoucher();
        break;

      case "cancel-add-voucher":
        this.cancelAddVoucherForm();
        break;

      case "redeem-voucher":
        this.redeemVoucher(data.id);
        break;

      case "delete-voucher":
        this.deleteVoucher(data.id);
        break;

      case "open-voucher-detail":
        this.openVoucherDetail(data.id);
        break;

      case "close-voucher-detail":
        this.overlay = "vouchers";
        this.renderOverlay();
        break;

      case "start-voucher-barcode-scan":
        this.startBarcodeScan("voucher");
        break;

      case "cancel-voucher-barcode-scan":
        this.cancelBarcodeScan();
        break;

      case "search-promotions":
        this.searchPromotions();
        break;

      case "open-insights":
        this.openInsights();
        break;

      case "open-receipt-scan":
        this.openReceiptScan();
        break;

      case "remove-receipt-review-item":
        this.removeReceiptReviewItem(Number(data.index));
        break;

      case "add-receipt-review-item":
        this.addReceiptReviewItem();
        break;

      case "confirm-receipt-save":
        this.confirmReceiptSave();
        break;

      case "open-purchases":
        this.openPurchases();
        break;

      case "open-purchase-detail":
        this.openPurchaseDetail(data.id);
        break;

      case "buy-again":
        this.buyAgain(data.id);
        break;

      case "toggle-buy-again-item":
        this.toggleBuyAgainItem(Number(data.index));
        break;

      case "start-barcode-scan":
        this.startBarcodeScan();
        break;

      case "cancel-barcode-scan":
        this.cancelBarcodeScan();
        break;

      case "goto-wallet":

        this.setView(
          "wallet"
        );

        break;

      case "create-shopping-list":
        this.createShoppingList();
        break;

      case "select-shopping-list":
        this.selectedShoppingListId = data.id;
        this.shoppingListError = "";
        this.shoppingListValue = null;
        this.renderView();
        this.loadShoppingListValue().then(() => this.renderView()).catch(() => {});
        break;

      case "remove-shopping-item":
        this.removeShoppingItem(data.id);
        break;

      case "rename-shopping-list":
        this.renameShoppingList(data.id);
        break;

      case "delete-shopping-list":
        this.deleteShoppingList(data.id);
        break;

      case "complete-shopping-list":
        this.completeShoppingList(data.id);
        break;


      case "open-add":

        this.overlay =
          "add";

        this.overlayStep =
          "search";

        this.addQuery =
          "";

        this.addRetailer =
          null;

        this.cardNumber =
          "";

        this.capturedPhoto =
          null;

        this.renderOverlay();

        break;


      case "close-overlay":

        this.closeOverlay();

        break;


      case "close-card-detail":

        this.closeOverlay();

        break;


      case "add-back":

        this.overlayStep =
          "search";

        this.renderOverlay();

        break;


      case "pick-retailer":

        this.addRetailer =
          retailerOf(
            data.id
          );

        this.overlayStep =
          "details";

        this.cardNumber =
          "";

        this.capturedPhoto =
          null;

        this.renderOverlay();

        break;


      case "confirm-add":

        this.confirmAdd();

        break;


      case "view-list":

        this.walletView =
          "list";

        this.renderView();

        break;


      case "view-grid":

        this.walletView =
          "grid";

        this.renderView();

        break;


      case "filter-cat":

        this.categoryFilter =
          data.cat;

        this.renderView();

        break;


      case "open-card":

        this.openCard(
          data.id
        );

        break;


      /* --------------------------------------------------------------------
         STEP 4 — FAVOURITE
         -------------------------------------------------------------------- */

      case "toggle-fav":

        this.toggleFavourite(
          data.id
        );

        break;

      case "sync-card":

        this.syncCard(
          data.id
        );

        break;

      case "mark-reward-redeemed":
        this.markRewardRedeemed(data.accountId, data.id, "REWARD");
        break;

      case "mark-voucher-redeemed":
        this.markRewardRedeemed(data.accountId, data.id, "VOUCHER");
        break;


      /* --------------------------------------------------------------------
         STEP 4 — COPY
         -------------------------------------------------------------------- */

      case "copy-card-number":

        this.copyCardNumber(
          data.id
        );

        break;


      /* --------------------------------------------------------------------
         STEP 4 — EDIT CARD
         -------------------------------------------------------------------- */

      case "edit-card":

        this.editCard(
          data.id
        );

        break;


      /* --------------------------------------------------------------------
         STEP 4 — REMOVE
         -------------------------------------------------------------------- */

      case "start-remove":

        this.confirmRemoveId =
          data.id;

        this.renderOverlay();

        break;


      case "cancel-remove":

        this.confirmRemoveId =
          null;

        this.renderOverlay();

        break;


      case "remove-card":

        this.removeCard(
          data.id
        );

        break;


      case "ai-teaser":

        this.toast(
          "Launching in Release 2"
        );

        break;


      case "soon":

        this.toast(
          "Coming soon"
        );

        break;


      default:
        break;

    }

  },


  /* ========================================================================
     CLOSE OVERLAY
     ======================================================================== */

  closeOverlay() {

    this.overlay =
      null;

    this.overlayStep =
      null;

    this.addRetailer =
      null;

    this.cardNumber =
      "";

    this.capturedPhoto =
      null;

    this.confirmRemoveId =
      null;

    this.detailCardId =
      null;

    this.profileError = "";

    const root =
      document.getElementById(
        "overlay-root"
      );

    if (root) {
      root.innerHTML = "";
    }

    this.renderView();

  },


  /* ========================================================================
     STEP 4 — FAVOURITE TOGGLE
     ======================================================================== */

  async toggleFavourite(id) {

    const c =
      this.data.cards.find(
        (card) =>
          card.id === id
      );

    if (!c) {
      return;
    }

    const newValue = !Boolean(c.favourite);
    c.favourite = newValue; // optimistic

    /*
     * Refresh the wallet list/grid immediately -- don't wait on the
     * network round trip to reflect the tap.
     */
    this.renderView();

    if (
      this.overlay ===
      "cardDetail"
    ) {

      this.renderOverlay();

    }

    this.toast(
      newValue
        ? "Added to favourites"
        : "Removed from favourites"
    );

    /*
     * Previously this called a persist() that was a dead no-op stub
     * (just `return true`), meaning a favourite never actually saved
     * anywhere -- not even surviving a page refresh on the same
     * device, let alone syncing across devices. Now a real property
     * of the card, synced through the API like everything else in
     * the wallet.
     */
    try {
      await apiPatch(
        "/me/loyalty-cards/" + encodeURIComponent(id),
        { favourite: newValue }
      );
    } catch (error) {
      // Revert on failure -- the server never actually saved the
      // change, so the UI shouldn't keep claiming it did.
      c.favourite = !newValue;
      this.renderView();
      if (this.overlay === "cardDetail") {
        this.renderOverlay();
      }
      this.toast(this.userFacingError(error));
    }

  },

  async syncCard(id) {
    const c = this.data.cards.find((card) => card.id === id);
    if (!c || this.cardSyncBusy) return;

    this.cardSyncBusy = id;
    this.renderOverlay();

    try {
      if (c.connected) {
        await apiPost(
          "/me/loyalty-accounts/" + encodeURIComponent(c.loyaltyAccountId) + "/sync",
          {}
        );
      } else {
        const retailer = this.data.retailers.find((r) => r.id === c.retailerId);
        const integration = retailer && retailer.availableIntegration;
        if (!integration) {
          this.toast("Live sync is not available for this retailer yet");
          this.cardSyncBusy = null;
          this.renderOverlay();
          return;
        }
        await apiPost(
          "/me/loyalty-accounts/" + encodeURIComponent(c.loyaltyAccountId) + "/connect-and-sync",
          { integrationId: integration.id, externalAccountId: c.memberNo }
        );
      }

      this.data = await loadPilotState();
      this.toast("Card synced");
    } catch (error) {
      this.toast(this.userFacingError(error));
    } finally {
      this.cardSyncBusy = null;
      if (this.overlay === "cardDetail") {
        this.renderOverlay();
      } else {
        this.renderView();
      }
    }
  },

  async markRewardRedeemed(loyaltyAccountId, externalId, kind) {
    if (!loyaltyAccountId || !externalId || this.redemptionBusy) return;

    this.redemptionBusy = externalId;
    this.renderOverlay();

    try {
      await apiPost(
        "/me/loyalty-accounts/" + encodeURIComponent(loyaltyAccountId) + "/redemptions",
        { externalId, kind }
      );

      // Optimistic local update so the button disappears immediately,
      // rather than waiting on a full reload of every account.
      const card = (this.data.cards || []).find((c) => c.loyaltyAccountId === loyaltyAccountId);
      if (card) {
        const list = kind === "REWARD" ? card.rewards : card.voucherList;
        const item = (list || []).find((i) => i.externalId === externalId);
        if (item) item.status = "REDEEMED";
      }

      this.toast("Marked as used");
    } catch (error) {
      this.toast(this.userFacingError(error));
    } finally {
      this.redemptionBusy = null;
      this.renderOverlay();
    }
  },


  /* ========================================================================
     STEP 4 — COPY MEMBERSHIP NUMBER
     ======================================================================== */

  async copyCardNumber(id) {

    const c =
      this.data.cards.find(
        (card) =>
          card.id === id
      );

    if (!c) {
      return;
    }

    const number =
      String(
        c.memberNo || ""
      ).trim();

    if (!number) {

      this.toast(
        "Membership number unavailable"
      );

      return;

    }

    try {

      /*
       * Preferred modern clipboard API.
       */
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {

        await navigator.clipboard.writeText(
          number
        );

      }

      /*
       * Fallback for environments where
       * navigator.clipboard is unavailable.
       */
      else {

        const temp =
          document.createElement(
            "textarea"
          );

        temp.value =
          number;

        temp.setAttribute(
          "readonly",
          ""
        );

        temp.style.position =
          "fixed";

        temp.style.left =
          "-9999px";

        temp.style.top =
          "0";

        document.body.appendChild(
          temp
        );

        temp.focus();

        temp.select();

        temp.setSelectionRange(
          0,
          temp.value.length
        );

        document.execCommand(
          "copy"
        );

        temp.remove();

      }

      this.toast(
        "Membership number copied"
      );

    }

    catch (error) {

      console.error(
        "BargaiNest copy error:",
        error
      );

      this.toast(
        "Unable to copy number"
      );

    }

  },


  /* ========================================================================
     PHOTO CAPTURE
     ======================================================================== */

  handleCapture(e) {

    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.capturedPhoto = URL.createObjectURL(file);
    this.scanning = false;
    this.renderOverlay();

  },

  /* ========================================================================
     BARCODE / QR AUTO-DETECTION
     ========================================================================

     Uses the native BarcodeDetector Web API (Chrome/Edge/Android Chrome)
     rather than bundling a JS decoding library -- this app has no build
     step, and a from-scratch barcode decoder is a much bigger, riskier
     undertaking than using a browser API that already exists where it's
     supported. Where it isn't (Safari/iOS, Firefox), the button simply
     isn't shown at all -- see renderAddOverlay -- and the existing
     photo-capture-plus-manual-entry flow is completely unaffected.

     `_barcodeDeps` exists so this can be unit-tested without a real
     camera or browser: production code always uses the real
     navigator/window objects; tests inject fakes. This mirrors the same
     dependency-injection pattern used throughout the backend for
     genuinely untestable boundaries (e.g. EmailSender).
  */

  _barcodeDeps: {
    getBarcodeDetectorClass: function() { return (typeof window !== "undefined" && window.BarcodeDetector) || null; },
    getMediaDevices: function() { return (typeof navigator !== "undefined" && navigator.mediaDevices) || null; },
  },

  barcodeDetectionSupported() {
    return !!(this._barcodeDeps.getBarcodeDetectorClass() && this._barcodeDeps.getMediaDevices());
  },

  async startBarcodeScan(context) {
    if (this.scanningLive) return;

    this._barcodeScanContext = context || "card";

    const BarcodeDetectorClass = this._barcodeDeps.getBarcodeDetectorClass();
    const mediaDevices = this._barcodeDeps.getMediaDevices();

    if (!BarcodeDetectorClass || !mediaDevices) {
      this.barcodeScanUnsupportedMessage = "Automatic scanning isn't supported in this browser — please use the photo option above.";
      this.renderOverlay();
      return;
    }

    this.scanningLive = true;
    this.barcodeScanUnsupportedMessage = "";
    this.renderOverlay(); // renders the <video> element into the DOM

    try {
      const stream = await mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      this._barcodeStream = stream;

      const video = document.getElementById("barcode-scan-video");
      if (!video) {
        // The overlay was closed/navigated away before getUserMedia
        // resolved -- clean up rather than attach a stream nothing
        // will ever read.
        stream.getTracks().forEach((track) => track.stop());
        this.scanningLive = false;
        return;
      }
      video.srcObject = stream;

      const detector = new BarcodeDetectorClass({
        formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });

      this._barcodeScanInterval = setInterval(async () => {
        if (!this.scanningLive) return;
        try {
          const results = await detector.detect(video);
          if (results && results.length && results[0].rawValue) {
            this.onBarcodeDetected(results[0].rawValue);
          }
        } catch (detectError) {
          // A single failed detection frame isn't fatal -- the video
          // stream may not have a decodable frame ready yet. Keep
          // polling rather than aborting the whole scan.
        }
      }, 400);
    } catch (error) {
      this.scanningLive = false;
      this.barcodeScanUnsupportedMessage = this.userFacingError(error) || "Camera access was denied or unavailable.";
      this.renderOverlay();
    }
  },

  onBarcodeDetected(rawValue) {
    const value = String(rawValue || "").trim();
    if (this._barcodeScanContext === "voucher") {
      this.voucherFormBarcode = value;
    } else {
      this.cardNumber = value;
    }
    this.cancelBarcodeScan();
  },

  cancelBarcodeScan() {
    if (this._barcodeScanInterval) {
      clearInterval(this._barcodeScanInterval);
      this._barcodeScanInterval = null;
    }
    if (this._barcodeStream) {
      this._barcodeStream.getTracks().forEach((track) => track.stop());
      this._barcodeStream = null;
    }
    this.scanningLive = false;
    this.renderOverlay();
  },


  /* ========================================================================
     ADD CARD
     ======================================================================== */

  async confirmAdd() {

    if (!this.addRetailer || !this.cardNumber || this.busy) return;

    this.busy = true;
    this.renderOverlay();

    try {
      const trimmedCardNumber = String(this.cardNumber).trim();

      /* Previously matched on loyaltyProgramId alone, so a second,
         genuinely different card number for the same retailer got
         silently attached to the first account, sharing its balance.
         Now also requires the card number to match one already on
         that account — re-adding the same card stays idempotent
         (reuses the account), but a different membership number
         correctly becomes its own account (the actual fix behind the
         @@unique constraint change: FR-WAL-005). */
      let account = (this.data.accounts || []).find(function(item) {
        var programme = item.programme || item.loyaltyProgram || {};
        var sameProgramme = (item.loyaltyProgramId || programme.id) === this.addRetailer.loyaltyProgramId;
        if (!sameProgramme) return false;
        var cards = Array.isArray(item.cards) ? item.cards : [];
        return cards.some(function(card) {
          return String(card.cardNumber || "").trim() === trimmedCardNumber;
        });
      }, this);

      if (!account) {
        account = await apiPost("/me/loyalty-accounts", {
          loyaltyProgramId: this.addRetailer.loyaltyProgramId,
          accountNumber: trimmedCardNumber
        });
      }

      await apiPost("/me/loyalty-accounts/" + encodeURIComponent(account.id) + "/cards", {
        cardNumber: this.cardNumber,
        isPrimary: true
      });

      /* BN-019 fix: previously auto-connected and synced immediately
         after adding a card whenever a live-sync integration was
         available. The only integration in this pilot is the mock
         provider, which returns fixed, fabricated data (Gold tier,
         2,450 points, an R50 voucher) for ANY connected account --
         auto-syncing meant a user who just typed in their own real
         card number immediately saw that fabricated data overlaid on
         it, with nothing distinguishing it as test data. Syncing is
         now always an explicit action: the user can connect and sync
         from the card detail screen's "Sync now" button (syncCard()),
         which is unchanged and still supports both connecting for the
         first time and refreshing an already-connected card. */

      this.data = await loadPilotState();
      this.busy = false;
      this.closeOverlay();
      this.setView("wallet");
      this.toast("Card added to your wallet");
    } catch (error) {
      this.busy = false;
      this.renderOverlay();
      this.toast(this.userFacingError(error));
    }

  },


  /* ========================================================================
     STEP 4 — EDIT CARD
     ======================================================================== */

  async editCard(id) {
    const card = this.data.cards.find((item) => item.id === id);
    if (!card) return;

    const currentNumber = card.memberNo || "";
    const updatedNumber = window.prompt(
      "Edit membership number:",
      currentNumber
    );

    if (updatedNumber === null) return;

    const normalizedNumber = updatedNumber.trim();

    if (!normalizedNumber) {
      this.toast("Membership number cannot be empty");
      return;
    }

    if (normalizedNumber === currentNumber) {
      return;
    }

    try {
      await apiPatch(
        "/me/loyalty-cards/" + encodeURIComponent(id),
        { cardNumber: normalizedNumber }
      );

      this.data = await loadPilotState();
      this.detailCardId = id;
      this.confirmRemoveId = null;
      this.toast("Card updated");
      this.renderView();
      if (this.overlay === "cardDetail") {
        this.renderOverlay();
      }
    } catch (error) {
      this.toast(this.userFacingError(error));
    }
  },


  /* ========================================================================
     STEP 4 — REMOVE CARD
     ======================================================================== */

  async removeCard(id) {
    const card = this.data.cards.find((item) => item.id === id);
    if (!card) return;

    try {
      await apiDelete(
        "/me/loyalty-cards/" + encodeURIComponent(id)
      );

      this.data = await loadPilotState();
      this.confirmRemoveId = null;
      this.detailCardId = null;
      this.overlay = null;
      this.toast("Card removed");
      this.renderView();
    } catch (error) {
      this.toast(this.userFacingError(error));
    }
  }


};


/* ==========================================================================
   START APP
   ========================================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => App.init()
);