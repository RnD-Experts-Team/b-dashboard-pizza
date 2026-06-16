/**
 * ──────────────────────────────────────────────────────────────────────────
 *  WBR Reports — MOCK DATA
 * ──────────────────────────────────────────────────────────────────────────
 *  This entire module is throwaway static data used to build the WBR Reports
 *  UI before the backend exists. Everything here is generated deterministically
 *  from a small seed so the numbers stay stable between renders.
 *
 *  ⚠️  REMOVE THIS FILE once the page is wired to the real API.
 * ──────────────────────────────────────────────────────────────────────────
 */

/* ── deterministic pseudo-random helpers ──────────────────────────────── */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295; // 0..1
}
const rand = (key: string, lo: number, hi: number) => lo + hash(key) * (hi - lo);
const randInt = (key: string, lo: number, hi: number) => Math.round(rand(key, lo, hi));
const pick = <T,>(key: string, arr: T[]): T => arr[Math.floor(hash(key) * arr.length) % arr.length];

/* ── reference catalogues ─────────────────────────────────────────────── */
export interface WbrStore {
  id: string;
  name: string;
  market: string;
  code: string;
  num: number;
}

export const STORES: WbrStore[] = [
  { id: "s1", name: "Downtown", market: "Metro", code: "03795-00001", num: 1 },
  { id: "s2", name: "Riverside", market: "Metro", code: "03795-00002", num: 2 },
  { id: "s3", name: "Northgate", market: "North", code: "03795-00003", num: 3 },
  { id: "s4", name: "Oak Park", market: "North", code: "03795-00004", num: 4 },
  { id: "s5", name: "Lakeview", market: "West", code: "03795-00005", num: 5 },
  { id: "s6", name: "Summit", market: "West", code: "03795-00006", num: 6 },
  { id: "s7", name: "Eastview", market: "South", code: "03795-00007", num: 7 },
  { id: "s8", name: "Harbor", market: "South", code: "03795-00008", num: 8 },
];

export interface WbrWeek {
  id: string;
  num: number;
  label: string;
  range: string;
}

export const WEEKS: WbrWeek[] = [
  { id: "w24", num: 24, label: "Week 24", range: "Jun 9 – Jun 15" },
  { id: "w23", num: 23, label: "Week 23", range: "Jun 2 – Jun 8" },
  { id: "w22", num: 22, label: "Week 22", range: "May 26 – Jun 1" },
  { id: "w21", num: 21, label: "Week 21", range: "May 19 – May 25" },
];

/* ── formatting helpers (exported for the UI) ─────────────────────────── */
export const fmt$ = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;
export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const wow = (cur: number, prev: number) =>
  prev ? ((cur - prev) / prev) * 100 : 0;

/* ── global / network-wide datasets ───────────────────────────────────── */
export const PROMO_CODES = ["B1G1", "LRG50", "LUNCH", "FAM30"];

export const TOP_ITEMS = [
  { item: "Large Pepperoni", price: 14.99, qty: 1842, sales: 27621, qtyPct: 18 },
  { item: "Medium Cheese", price: 11.99, qty: 1510, sales: 18105, qtyPct: 15 },
  { item: "Buffalo Wings (12)", price: 13.49, qty: 1188, sales: 16026, qtyPct: 12 },
  { item: "Large Supreme", price: 18.99, qty: 902, sales: 17129, qtyPct: 9 },
  { item: "Garlic Knots", price: 5.99, qty: 1320, sales: 7907, qtyPct: 13 },
  { item: "2L Soda", price: 3.49, qty: 1610, sales: 5619, qtyPct: 16 },
  { item: "Personal Pan", price: 7.99, qty: 740, sales: 5913, qtyPct: 7 },
];

export const PROMO_CALENDAR = [
  { label: "Summer B1G1 Large", range: "Jun 16 – Jun 22", channel: "All channels" },
  { label: "Lunch Combo $7.99", range: "Jun 16 – Jun 30", channel: "In-store" },
  { label: "DoorDash 20% Boost", range: "Jun 20 – Jun 23", channel: "DoorDash" },
  { label: "Mtn Dew Mango LTO", range: "Jun 1 – Jul 1", channel: "All channels" },
];

export const DD_CAMPAIGNS = [
  { name: "Always-on 15% off $25+", hours: "All day", items: "Whole menu", costPct: "11%" },
  { name: "Slow-day Tue/Wed boost", hours: "11a – 4p", items: "Pizzas + wings", costPct: "18%" },
  { name: "Late-night munchies", hours: "9p – close", items: "Sides + drinks", costPct: "14%" },
];

export const HIRING_EXPENSE = {
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  rows: [
    { company: "Indeed", values: [1200, 980, 1340, 1100, 1450, 760] },
    { company: "ZipRecruiter", values: [640, 720, 580, 690, 610, 430] },
    { company: "Snagajob", values: [320, 410, 380, 350, 420, 210] },
    { company: "Local referrals", values: [150, 200, 175, 225, 180, 90] },
  ],
};

export interface Transfer {
  date: string;
  from: WbrStore;
  to: WbrStore;
  item: string;
  qty: number;
  unit: string;
  cost: number;
}

export function transfers(weekId: string): Transfer[] {
  const items = [
    ["Mozzarella", "case", 42.5],
    ["Pizza boxes (L)", "bundle", 18.0],
    ["Pepperoni", "case", 64.25],
    ["Wing sauce", "tub", 11.75],
    ["Dough balls", "tray", 22.0],
  ] as const;
  const n = randInt(`tx-${weekId}`, 3, 6);
  const out: Transfer[] = [];
  for (let i = 0; i < n; i++) {
    const k = `tx-${weekId}-${i}`;
    const fromIdx = Math.floor(hash(k + "f") * STORES.length);
    let toIdx = Math.floor(hash(k + "t") * STORES.length);
    if (toIdx === fromIdx) toIdx = (toIdx + 1) % STORES.length;
    const it = items[Math.floor(hash(k + "i") * items.length)];
    const qty = randInt(k + "q", 1, 6);
    out.push({
      date: `Jun ${randInt(k + "d", 9, 15)}`,
      from: STORES[fromIdx],
      to: STORES[toIdx],
      item: it[0],
      qty,
      unit: it[1],
      cost: +(it[2] * qty).toFixed(2),
    });
  }
  return out;
}

/* ── per store / week metric builder ──────────────────────────────────── */
export interface ChannelBreakdown {
  register: number;
  phone: number;
  doordash: number;
  ubereats: number;
  webInstore: number;
  mobInstore: number;
  driveThru: number;
}

export interface Cmp {
  wow: number;
  pop: number;
  qoq: number;
  yoy: number;
}

export interface StoreWeek {
  store: WbrStore;
  week: WbrWeek;
  sales: number;
  customers: number;
  avgTicket: number;
  channels: ChannelBreakdown;
  promoTotal: number;
  promoToSales: number;
  promoCodes: Record<string, number>;
  lto: {
    sales: number;
    pctOfSales: number;
    qty: number;
    inStoreQty: number;
    wowQty: number;
  };
  hours: number;
  hoursRange: [number, number];
  pay: number;
  laborPct: number;
  deposit: {
    physical: number;
    cashTips: number;
    cashSales: number;
    cashDrop: number;
    bank: number;
    variance: number;
  };
  downtimeMin: number;
  downtimeEvents: { disabled: string; minutes: number; note: string }[];
  over60: number;
  over60List: {
    name: string;
    position: string;
    hours: number;
    hourlyPay: number;
    grossPay: number;
  }[];
  projected: { range: [number, number]; sales: number; otHours: number };
  wasteGWPct: number;
  wasteALTPct: number;
  portionVarPct: number;
  portioning: {
    theo: number;
    totalPct: number;
    rows: { key: string; label: string; target: number; variance: number; pct: number }[];
  };
  disputes: { ddSales: number; amount: number; last4w: number };
  supplier: {
    blueline: number;
    blPct: number;
    pepsi: number;
    pepsiPct: number;
    bl4w: number;
    bl12w: number;
    bl6m: number;
  };
  hiring: { tours: number; hired: number; started: number };
  moneyOwed: { smName: string; desc: string; amount: number }[];
  feedback: { name: string; suggestion: string; respected: number; schedule: number }[];
  qa: { guestPass: number; lobbyPass: number; upsellPass: number; driveThruPass: number };
  callsExt: {
    total: number;
    missed: number;
    missedPct: number;
    inStore: number;
    storeManager: number;
    callCenter: number;
  };
  reviews: { count: number; avg: number };
  reviewsList: {
    name: string;
    date: string;
    rating: number;
    recommend: boolean;
    comment: string;
  }[];
  cmp: {
    sales: Cmp;
    customers: Cmp;
    phone: Cmp;
    instore: Cmp;
  };
}

const ING = [
  { key: "cheese", label: "Cheese", short: "Cheese", target: 0.4 },
  { key: "sauce", label: "Sauce", short: "Sauce", target: 0.25 },
  { key: "pepperoni", label: "Pepperoni", short: "Pepp", target: 0.5 },
  { key: "boxes", label: "Boxes", short: "Boxes", target: 0.3 },
  { key: "flour", label: "Flour / Dough", short: "Flour", target: 0.35 },
  { key: "wings", label: "Wings", short: "Wings", target: 0.6 },
];
export const ING_LIST = ING;

const FIRST_NAMES = ["Maria", "James", "Aisha", "Tyler", "Sofia", "Liam", "Noah", "Emma", "Omar", "Grace"];
const LAST_NAMES = ["Lopez", "Chen", "Patel", "Brooks", "Reed", "Kim", "Diaz", "Walsh", "Hayes", "Nguyen"];
const POSITIONS = ["Driver", "Cook", "CSR", "Shift Lead", "Asst Manager"];
const SM_NAMES = ["D. Scott", "P. Beesly", "J. Halpert", "A. Martin"];

function cmp(key: string): Cmp {
  return {
    wow: +rand(key + "wow", -8, 12).toFixed(1),
    pop: +rand(key + "pop", -6, 10).toFixed(1),
    qoq: +rand(key + "qoq", -10, 14).toFixed(1),
    yoy: +rand(key + "yoy", -5, 18).toFixed(1),
  };
}

export function storeWeek(store: WbrStore, week: WbrWeek): StoreWeek {
  const k = `${store.id}-${week.id}`;
  const sales = Math.round(rand(k + "sales", 38000, 92000));
  const avgTicket = +rand(k + "ticket", 18, 31).toFixed(2);
  const customers = Math.round(sales / avgTicket);

  // channel split — weights normalised to sales
  const weights = {
    register: rand(k + "reg", 0.18, 0.3),
    phone: rand(k + "ph", 0.08, 0.16),
    doordash: rand(k + "dd", 0.12, 0.22),
    ubereats: rand(k + "ue", 0.06, 0.14),
    webInstore: rand(k + "web", 0.06, 0.12),
    mobInstore: rand(k + "mob", 0.05, 0.1),
    driveThru: rand(k + "dt", 0.04, 0.12),
  };
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0);
  const channels = Object.fromEntries(
    Object.entries(weights).map(([key, w]) => [key, Math.round((w / wsum) * sales)])
  ) as unknown as ChannelBreakdown;

  const promoToSales = +rand(k + "promo", 3, 11).toFixed(1);
  const promoTotal = Math.round((promoToSales / 100) * sales);
  const promoCodes = Object.fromEntries(
    PROMO_CODES.map((cd, i) => [cd, Math.round((promoTotal / PROMO_CODES.length) * rand(k + cd + i, 0.5, 1.5))])
  );

  const ltoQty = randInt(k + "ltoqty", 40, 260);
  const lto = {
    sales: +(ltoQty * 2.99).toFixed(2),
    pctOfSales: +((ltoQty * 2.99) / sales * 100).toFixed(2),
    qty: ltoQty,
    inStoreQty: Math.round(ltoQty * rand(k + "ltois", 0.4, 0.8)),
    wowQty: +rand(k + "ltowow", -20, 35).toFixed(1),
  };

  const hoursLo = randInt(k + "hlo", 380, 460);
  const hoursRange: [number, number] = [hoursLo, hoursLo + randInt(k + "hhi", 40, 80)];
  const hours = randInt(k + "hours", hoursLo - 20, hoursRange[1] + 30);
  const pay = Math.round(hours * rand(k + "rate", 15, 19));
  const laborPct = +((pay / sales) * 100).toFixed(1);

  const physical = +rand(k + "dep", 1800, 5200).toFixed(2);
  const variance = +rand(k + "var", -45, 25).toFixed(2);
  const deposit = {
    physical,
    cashTips: +rand(k + "tips", 20, 120).toFixed(2),
    cashSales: +(physical * rand(k + "cs", 0.7, 0.95)).toFixed(2),
    cashDrop: +(physical * rand(k + "cd", 0.05, 0.2)).toFixed(2),
    bank: +(physical + variance).toFixed(2),
    variance,
  };

  const downtimeMin = hash(k + "dt2") > 0.55 ? randInt(k + "dtm", 10, 95) : 0;
  const downtimeEvents = downtimeMin
    ? Array.from({ length: randInt(k + "dte", 1, 2) }).map((_, i) => ({
        disabled: pick(k + "dis" + i, ["online ordering", "DoorDash", "phone line", "ovens"]),
        minutes: randInt(k + "dtmin" + i, 8, 60),
        note: pick(k + "note" + i, ["Power flicker", "POS reboot", "Staff shortage", "Didn't fill the form"]),
      }))
    : [];

  const over60 = hash(k + "ot") > 0.6 ? randInt(k + "otn", 1, 3) : 0;
  const over60List = Array.from({ length: over60 }).map((_, i) => {
    const hrs = +rand(k + "oth" + i, 61, 74).toFixed(1);
    const rate = +rand(k + "otr" + i, 16, 22).toFixed(2);
    return {
      name: `${pick(k + "fn" + i, FIRST_NAMES)} ${pick(k + "ln" + i, LAST_NAMES)}`,
      position: pick(k + "pos" + i, POSITIONS),
      hours: hrs,
      hourlyPay: rate,
      grossPay: +(hrs * rate + (hrs - 40) * rate * 0.5).toFixed(2),
    };
  });

  const projected = {
    range: [hoursRange[0] + 10, hoursRange[1] + 10] as [number, number],
    sales: Math.round(sales * rand(k + "psales", 0.95, 1.12)),
    otHours: randInt(k + "otp", 38, 58),
  };

  const wasteGWPct = +rand(k + "gw", 1.5, 9.5).toFixed(2);
  const wasteALTPct = +(wasteGWPct + rand(k + "alt", -1.5, 1.5)).toFixed(2);
  const portionVarPct = +rand(k + "pv", -6, 8).toFixed(2);

  const portRows = ING.map((g) => {
    const pct = +rand(k + "port" + g.key, -3, 4).toFixed(2);
    return {
      key: g.key,
      label: g.label,
      target: g.target,
      variance: Math.round(rand(k + "pvar" + g.key, -180, 260)),
      pct,
    };
  });
  const portioning = {
    theo: Math.round(rand(k + "theo", 9000, 16000)),
    totalPct: +(portRows.reduce((a, r) => a + r.pct, 0) / portRows.length).toFixed(2),
    rows: portRows,
  };

  const ddSales = channels.doordash;
  const disputes = {
    ddSales,
    amount: +rand(k + "disp", 8, 95).toFixed(1),
    last4w: +rand(k + "disp4", 40, 320).toFixed(0),
  };

  const blueline = Math.round(rand(k + "bl", 9000, 22000));
  const pepsi = Math.round(rand(k + "pep", 1800, 5200));
  const supplier = {
    blueline,
    blPct: +((blueline / sales) * 100).toFixed(1),
    pepsi,
    pepsiPct: +((pepsi / sales) * 100).toFixed(1),
    bl4w: +rand(k + "bl4", 24, 34).toFixed(1),
    bl12w: +rand(k + "bl12", 24, 33).toFixed(1),
    bl6m: +rand(k + "bl6", 25, 32).toFixed(1),
  };

  const hiring = {
    tours: randInt(k + "tours", 2, 9),
    hired: randInt(k + "hired", 1, 5),
    started: randInt(k + "started", 0, 4),
  };

  const moneyOwed =
    hash(k + "owe") > 0.55
      ? Array.from({ length: randInt(k + "owen", 1, 2) }).map((_, i) => ({
          smName: pick(k + "sm" + i, SM_NAMES),
          desc: pick(k + "od" + i, ["Cleaning supplies", "Light bulbs", "Printer ink", "Uniforms"]),
          amount: +rand(k + "oa" + i, 12, 85).toFixed(2),
        }))
      : [];

  const feedback =
    hash(k + "fb") > 0.4
      ? Array.from({ length: randInt(k + "fbn", 1, 2) }).map((_, i) => ({
          name: `${pick(k + "ffn" + i, FIRST_NAMES)} ${pick(k + "fln" + i, LAST_NAMES).charAt(0)}.`,
          suggestion: pick(k + "fs" + i, [
            "More consistent shift start times would help.",
            "Could use a second prep station on weekends.",
            "Cross-training on the line is going well.",
            "Break room could use a fridge.",
          ]),
          respected: randInt(k + "fr" + i, 3, 5),
          schedule: randInt(k + "fsc" + i, 2, 5),
        }))
      : [];

  const qa = {
    guestPass: randInt(k + "qg", 1, 3),
    lobbyPass: randInt(k + "ql", 1, 3),
    upsellPass: randInt(k + "qu", 0, 3),
    driveThruPass: hash(k + "qdt") > 0.3 ? randInt(k + "qd", 1, 3) : 0,
  };

  const totalCalls = randInt(k + "calls", 120, 480);
  const missed = randInt(k + "miss", 4, Math.round(totalCalls * 0.18));
  const answered = totalCalls - missed;
  const inStore = Math.round(answered * rand(k + "cis", 0.4, 0.6));
  const storeManager = Math.round(answered * rand(k + "csm", 0.1, 0.25));
  const callsExt = {
    total: totalCalls,
    missed,
    missedPct: +((missed / totalCalls) * 100).toFixed(1),
    inStore,
    storeManager,
    callCenter: answered - inStore - storeManager,
  };

  const reviewCount = randInt(k + "rev", 3, 18);
  const reviewAvg = +rand(k + "ravg", 3.4, 4.9).toFixed(1);
  const reviewsList = Array.from({ length: Math.min(reviewCount, 4) }).map((_, i) => {
    const rating = randInt(k + "rr" + i, 2, 5);
    return {
      name: `${pick(k + "rn" + i, FIRST_NAMES)} ${pick(k + "rl" + i, LAST_NAMES).charAt(0)}.`,
      date: `Jun ${randInt(k + "rd" + i, 9, 15)}`,
      rating,
      recommend: rating >= 4,
      comment: pick(k + "rc" + i, [
        "Fast delivery and the pizza was hot. Will order again.",
        "Order was missing the wings but staff fixed it quickly.",
        "Best crust in town, friendly counter staff.",
        "Waited 40 minutes for pickup, a bit disappointing.",
        "Consistent quality every single time.",
      ]),
    };
  });

  return {
    store,
    week,
    sales,
    customers,
    avgTicket,
    channels,
    promoTotal,
    promoToSales,
    promoCodes,
    lto,
    hours,
    hoursRange,
    pay,
    laborPct,
    deposit,
    downtimeMin,
    downtimeEvents,
    over60,
    over60List,
    projected,
    wasteGWPct,
    wasteALTPct,
    portionVarPct,
    portioning,
    disputes,
    supplier,
    hiring,
    moneyOwed,
    feedback,
    qa,
    callsExt,
    reviews: { count: reviewCount, avg: reviewAvg },
    reviewsList,
    cmp: {
      sales: cmp(k + "csales"),
      customers: cmp(k + "ccust"),
      phone: cmp(k + "cphone"),
      instore: cmp(k + "cinst"),
    },
  };
}

/* ── aggregate selector ───────────────────────────────────────────────── */
export interface WbrData {
  scope: "all" | "store";
  week: WbrWeek;
  store?: WbrStore;
  /** per-store rows (always present; single-store scope has one row) */
  rows: StoreWeek[];
  /** previous-week rows, aligned 1:1 with `rows` */
  prevRows: StoreWeek[];
  /** aggregate totals for the current selection */
  totals: {
    sales: number;
    customers: number;
    avgTicket: number;
    promoTotal: number;
    channels: ChannelBreakdown;
    hiring: { tours: number; hired: number; started: number };
  };
  prevTotals: { sales: number; customers: number; avgTicket: number };
}

function prevWeekOf(week: WbrWeek): WbrWeek {
  const idx = WEEKS.findIndex((w) => w.id === week.id);
  return WEEKS[Math.min(idx + 1, WEEKS.length - 1)];
}

function sumChannels(rows: StoreWeek[]): ChannelBreakdown {
  const keys: (keyof ChannelBreakdown)[] = [
    "register", "phone", "doordash", "ubereats", "webInstore", "mobInstore", "driveThru",
  ];
  return Object.fromEntries(
    keys.map((key) => [key, rows.reduce((a, r) => a + r.channels[key], 0)])
  ) as unknown as ChannelBreakdown;
}

export function getWbrData(storeId: string, weekId: string): WbrData {
  const week = WEEKS.find((w) => w.id === weekId) ?? WEEKS[0];
  const prevWeek = prevWeekOf(week);
  const scope: "all" | "store" = storeId === "all" ? "all" : "store";
  const selStores = scope === "all" ? STORES : STORES.filter((s) => s.id === storeId);

  const rows = selStores.map((s) => storeWeek(s, week));
  const prevRows = selStores.map((s) => storeWeek(s, prevWeek));

  const sales = rows.reduce((a, r) => a + r.sales, 0);
  const customers = rows.reduce((a, r) => a + r.customers, 0);
  const prevSales = prevRows.reduce((a, r) => a + r.sales, 0);
  const prevCustomers = prevRows.reduce((a, r) => a + r.customers, 0);

  return {
    scope,
    week,
    store: scope === "store" ? selStores[0] : undefined,
    rows,
    prevRows,
    totals: {
      sales,
      customers,
      avgTicket: customers ? +(sales / customers).toFixed(2) : 0,
      promoTotal: rows.reduce((a, r) => a + r.promoTotal, 0),
      channels: sumChannels(rows),
      hiring: {
        tours: rows.reduce((a, r) => a + r.hiring.tours, 0),
        hired: rows.reduce((a, r) => a + r.hiring.hired, 0),
        started: rows.reduce((a, r) => a + r.hiring.started, 0),
      },
    },
    prevTotals: {
      sales: prevSales,
      customers: prevCustomers,
      avgTicket: prevCustomers ? +(prevSales / prevCustomers).toFixed(2) : 0,
    },
  };
}

/** 4-week chronological trend of a numeric metric for one store */
export function storeTrend(store: WbrStore, key: keyof StoreWeek): number[] {
  return [...WEEKS]
    .reverse()
    .map((wk) => storeWeek(store, wk)[key] as number);
}
