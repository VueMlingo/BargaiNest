/* ============================================================================
   BargaiNest Pilot — state.js
   API-backed customer state. No demo users, demo cards or loyalty data are
   stored in localStorage. The backend session is the source of truth.
   ============================================================================ */

var CLOUD_API_BASE = "https://api.anthillsolutions.co.za/api/v1";
var CLOUD_TIMEOUT_MS = 30000;
var UI_STORAGE_KEY = "bargainest_pilot_ui_v1";

/* Known presentation metadata. Loyalty data itself comes from the API. */
var RETAILER_PRESENTATION = {
  SHOPRITE: { category: "Groceries", initials: "S", color: "#E30613", textColor: "#FFFFFF", loyaltyType: "Points & Discounts" },
  CHECKERS: { category: "Groceries", initials: "C", color: "#00A99D", textColor: "#FFFFFF", loyaltyType: "Points & Discounts" },
  PICK_N_PAY: { category: "Groceries", initials: "P", color: "#003B70", textColor: "#FFFFFF", loyaltyType: "Points" },
  WOOLWORTHS: { category: "Groceries", initials: "W", color: "#000000", textColor: "#FFFFFF", loyaltyType: "Rewards" },
  SPAR: { category: "Groceries", initials: "SP", color: "#00843D", textColor: "#FFFFFF", loyaltyType: "Rewards" },
  CLICKS: { category: "Health & Beauty", initials: "CL", color: "#0072CE", textColor: "#FFFFFF", loyaltyType: "Points & Discounts" },
  DIS_CHEM: { category: "Health & Beauty", initials: "DC", color: "#00843D", textColor: "#FFFFFF", loyaltyType: "Rewards & Discounts" }
};

var RETAILERS = [];

function presentationFor(retailer) {
  var code = String((retailer && retailer.code) || "").toUpperCase();
  return RETAILER_PRESENTATION[code] || {
    category: "Other",
    initials: String((retailer && retailer.name) || "?").slice(0, 2).toUpperCase(),
    color: "#182A4A",
    textColor: "#FFFFFF",
    loyaltyType: "Rewards"
  };
}

function setRetailerCatalogue(programmes) {
  RETAILERS = (Array.isArray(programmes) ? programmes : []).map(function(programme) {
    var retailer = programme && programme.retailer ? programme.retailer : {};
    var p = presentationFor(retailer);
    return {
      id: retailer.id,
      code: retailer.code,
      name: retailer.name || "Retailer",
      shortName: retailer.name || "Retailer",
      initials: p.initials,
      category: p.category,
      loyaltyProgram: programme.name || "Loyalty Programme",
      loyaltyProgramId: programme.id || "",
      loyaltyType: p.loyaltyType,
      color: p.color,
      textColor: p.textColor,
      active: String(programme.status || "ACTIVE").toUpperCase() === "ACTIVE",
      availableIntegration: programme.availableIntegration || null,
      programme: programme
    };
  });
}

function retailerOf(retailerId) {
  var found = RETAILERS.find(function(retailer) { return retailer.id === retailerId; });
  if (found) return found;
  return {
    id: retailerId || "unknown",
    name: "Unknown retailer",
    shortName: "Unknown",
    initials: "?",
    category: "Other",
    loyaltyProgram: "Loyalty",
    loyaltyType: "Rewards",
    color: "#667085",
    textColor: "#FFFFFF",
    active: false
  };
}

function activeRetailers() {
  return RETAILERS.filter(function(retailer) { return retailer.active; });
}

function retailerCategories() {
  var categories = ["All"];
  activeRetailers().forEach(function(retailer) {
    if (categories.indexOf(retailer.category) === -1) categories.push(retailer.category);
  });
  return categories;
}

function retailersByCategory(category) {
  if (!category || category === "All") return activeRetailers();
  return activeRetailers().filter(function(retailer) {
    return retailer.category.toLowerCase() === category.toLowerCase();
  });
}

function searchRetailers(query, category) {
  query = query || "";
  category = category || "All";
  var search = query.trim().toLowerCase();
  return retailersByCategory(category).filter(function(retailer) {
    if (!search) return true;
    return retailer.name.toLowerCase().indexOf(search) !== -1 ||
      retailer.shortName.toLowerCase().indexOf(search) !== -1 ||
      retailer.category.toLowerCase().indexOf(search) !== -1 ||
      retailer.loyaltyProgram.toLowerCase().indexOf(search) !== -1;
  });
}

function maskMembershipNumber(number) {
  number = String(number || "").replace(/\s+/g, "");
  if (!number) return "•••• ----";
  return "•••• " + number.slice(-4);
}

function formatRand(value) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(Number(value) || 0);
}

function liveClock() {
  var now = new Date();
  var time = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);
  var date = new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(now);
  return { time: time, date: date };
}

function liveGreeting() {
  var hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(timestamp) {
  var difference = Math.max(0, Date.now() - new Date(timestamp || Date.now()).getTime());
  var seconds = Math.floor(difference / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  var days = Math.floor(hours / 24);
  if (seconds < 60) return "just now";
  if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  if (days === 1) return "yesterday";
  if (days < 7) return days + " days ago";
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function daysUntil(timestamp) {
  if (!timestamp) return 0;
  return Math.max(0, Math.ceil((new Date(timestamp).getTime() - Date.now()) / 86400000));
}

function inferActivityType(label) {
  var text = String(label || "").toLowerCase();
  if (text.indexOf("purchase") !== -1) return "purchase";
  if (text.indexOf("earned") !== -1 || text.indexOf("cashback") !== -1) return "earned";
  if (text.indexOf("redeem") !== -1 || text.indexOf("voucher") !== -1 || text.indexOf("reward") !== -1) return "redeemed";
  return "other";
}

function uiState() {
  try { return JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || "{}"); }
  catch (e) { return {}; }
}

function saveUiState(state) {
  try { localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(state || {})); } catch (e) {}
}

function normaliseCloudCard(account, card) {
  /* The pilot consumer API returns `programme` + `retailer` and exposes the
     latest synced balance as `currentState.balance`. Keep a small fallback
     for older backend payloads so the UI remains tolerant during rollout. */
  var programme = account.programme || account.loyaltyProgram || {};
  var retailer = account.retailer || programme.retailer || {};
  var r = RETAILERS.find(function(item) { return item.id === retailer.id; }) || presentationFor(retailer);
  var state = account.currentState || null;
  var points = state && state.balance != null
    ? Number(state.balance)
    : Number(account.pointsBalance || 0);
  var cardNumber = String(card.cardNumber || "");

  /* Previously hardcoded to 0/[] regardless of what the backend returned —
     the sync pipeline already fetches rewards/vouchers/activities from the
     retailer, it just never reached this far. */
  var rewards = state && Array.isArray(state.rewards) ? state.rewards : [];
  var vouchers = state && Array.isArray(state.vouchers) ? state.vouchers : [];
  var activities = state && Array.isArray(state.activities) ? state.activities : [];
  var offers = state && Array.isArray(state.offers) ? state.offers : [];

  var voucherValue = vouchers
    .filter(function(v) { return String(v.status || "").toUpperCase() === "AVAILABLE"; })
    .reduce(function(sum, v) { return sum + (Number(v.value) || 0); }, 0);

  var activityHistory = activities.map(function(a) {
    return {
      id: a.externalId,
      type: String(a.type || "other").toLowerCase(),
      label: a.description || (a.type === "EARN" ? "Points earned" : "Activity"),
      detail: a.points != null ? (a.points > 0 ? "+" : "") + a.points + " pts" : "",
      at: a.occurredAt ? new Date(a.occurredAt).getTime() : Date.now()
    };
  });
  activityHistory.push({
    id: "added-" + card.id,
    type: "other",
    label: "Card added",
    detail: "",
    at: new Date(card.createdAt || Date.now()).getTime()
  });

  return {
    id: card.id,
    loyaltyAccountId: account.id,
    loyaltyProgramId: programme.id || account.loyaltyProgramId || "",
    retailerId: retailer.id,
    memberNo: cardNumber,
    displayMemberNo: maskMembershipNumber(cardNumber),
    accountNumber: account.accountNumber || "",
    category: r.category,
    favourite: !!card.favourite,
    rewardType: "points",
    points: points,
    cashback: 0,
    vouchers: vouchers.length,
    value: voucherValue,
    tier: (state && state.tier) || "Member",
    expiresAt: card.expiresAt ? new Date(card.expiresAt).getTime() : null,
    benefits: rewards.map(function(rw) { return rw.title; }),
    rewards: rewards,
    voucherList: vouchers,
    offers: offers,
    activity: activityHistory,
    liveSyncAvailable: !!account.availableIntegration,
    connected: !!(account.connection && account.connection.status === "ACTIVE"),
    lastSyncedAt: account.connection ? account.connection.lastSyncedAt : null,
    status: card.status,
    issuedAt: card.issuedAt,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  };
}

function normaliseCloudAccounts(accounts) {
  var cards = [];
  (Array.isArray(accounts) ? accounts : []).forEach(function(account) {
    if (!account || !(account.programme || account.loyaltyProgram)) return;
    (Array.isArray(account.cards) ? account.cards : []).forEach(function(card) {
      if (String(card.status || "ACTIVE").toUpperCase() === "ACTIVE") cards.push(normaliseCloudCard(account, card));
    });
  });
  return cards;
}

function createInitialState(user, accounts) {
  var name = user && user.name ? user.name : "BargaiNest Member";
  return {
    user: {
      id: user ? user.id : null,
      name: name,
      email: user ? user.email : "",
      emailVerified: !!(user && user.emailVerified),
      initial: name.charAt(0).toUpperCase()
    },
    cards: normaliseCloudAccounts(accounts),
    retailers: RETAILERS,
    accounts: Array.isArray(accounts) ? accounts : [],
    createdAt: Date.now(),
    cloudConnected: true,
    cloudLoadedAt: Date.now()
  };
}

async function cloudFetchJson(path, options) {
  options = options || {};
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timeout = setTimeout(function() { if (controller) controller.abort(); }, CLOUD_TIMEOUT_MS);
  var request = Object.assign({
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store"
  }, options);
  request.headers = Object.assign({ Accept: "application/json" }, options.headers || {});
  if (controller) request.signal = controller.signal;
  try {
    var response = await fetch(CLOUD_API_BASE.replace(/\/$/, "") + path, request);
    var payload = null;
    try { payload = await response.json(); } catch (e) {}
    if (!response.ok) {
      var error = new Error((payload && payload.message) || ("Cloud Run API returned HTTP " + response.status));
      error.status = response.status;
      error.code = payload && payload.error;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function apiGet(path) { return cloudFetchJson(path); }
async function apiPost(path, body) {
  return cloudFetchJson(path, { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function apiPatch(path, body) {
  return cloudFetchJson(path, { method: "PATCH", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function apiDelete(path) {
  return cloudFetchJson(path, { method: "DELETE", credentials: "include", headers: { Accept: "application/json" } });
}

async function fetchCatalogue() {
  var payload = await apiGet("/catalog/loyalty-programmes");
  setRetailerCatalogue(Array.isArray(payload) ? payload : (payload && payload.data) || []);
  return RETAILERS;
}

async function loadPilotState() {
  await fetchCatalogue();
  var me = await apiGet("/auth/me");
  if (!me || !me.user) {
    var unauth = new Error("Not authenticated");
    unauth.status = 401;
    throw unauth;
  }
  var accounts = await apiGet("/me/loyalty-accounts");
  var state = createInitialState(me.user, Array.isArray(accounts) ? accounts : (accounts && accounts.data) || []);
  // Best-effort: manually-captured wallet vouchers need to be
  // available on the Home dashboard immediately, not only once the
  // user has visited the Vouchers screen -- but a failure here
  // shouldn't block the whole app from loading.
  try {
    var vouchers = await apiGet("/me/wallet-vouchers");
    state.vouchers = Array.isArray(vouchers) ? vouchers : [];
  } catch (e) {
    state.vouchers = [];
  }
  return state;
}

async function loginPilot(email, password) {
  await apiPost("/auth/login", { email: email, password: password });
  return loadPilotState();
}

async function registerPilot(email, password) {
  await apiPost("/auth/register", { email: email, password: password });
  return loadPilotState();
}

async function logoutPilot() {
  try { await apiPost("/auth/logout", {}); } catch (e) {}
}
