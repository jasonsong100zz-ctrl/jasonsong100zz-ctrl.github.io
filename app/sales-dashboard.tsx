"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const DEFAULT_TWD_TO_CNY = 0.21;
const PASSWORD_HASH =
  "04155b15a8f39ef5739243f83ea8350c4394a2b630f2af8c26cc4972af72c21c";

type BrandKey = "SKT" | "G2G" | "TP";
type PageKey = "overview" | "category" | "link" | "ads" | "channels";
type GvizRow = { c: Array<{ v?: unknown } | null> };
type MetricRow = {
  key: string;
  brand: BrandKey;
  id: string;
  product: string;
  link: string;
  category: string;
  gmv: number;
  previousGmv: number;
  orders: number;
  previousOrders: number;
  exposure: number;
  previousExposure: number;
  clicks: number;
  previousClicks: number;
  visitors: number;
  previousVisitors: number;
  search: number;
  previousSearch: number;
  cart: number;
  previousCart: number;
  units: number;
  previousUnits: number;
  adGmv: number;
  previousAdGmv: number;
  adSpend: number;
  previousAdSpend: number;
  adExposure: number;
  previousAdExposure: number;
  adClicks: number;
  previousAdClicks: number;
  conversions: number;
  previousConversions: number;
};
type BrandConfig = {
  key: BrandKey;
  name: string;
  goal: number;
  shopSheet: string;
  shopDate: string;
  shopGmv: string;
  shopOrders: string;
  linkSheet: string;
  adsSheet: string;
  adsDate: string;
  adsProduct: string;
  adsCategory: string;
  adsId: string;
  adsExposure: string;
  adsClicks: string;
  adsConversions: string;
  adsGmv: string;
  adsSpend: string;
  dmsSheet: string;
  dmsDate: string;
  dmsGmv: string;
};
type BrandData = {
  config: BrandConfig;
  daily: Array<{ date: string; gmv: number; orders: number }>;
  previousDaily: Array<{ date: string; gmv: number; orders: number }>;
  current: MetricRow;
  previous: MetricRow;
  category: MetricRow[];
  links: MetricRow[];
  ads: MetricRow[];
  actualGmv: number;
};

type DateRange = { start: string; end: string };

type ChannelSkuRow = {
  key: string;
  brand: BrandKey;
  id: string;
  product: string;
  online: number;
  onlinePrevious: number;
  offline: number;
  offlinePrevious: number;
};

type ChannelData = { rows: ChannelSkuRow[] };
const FALLBACK_CATEGORY = "其他/赠品";

const PAGE_LABELS: Array<{ key: PageKey; label: string; note: string; number: string }> = [
  { key: "overview", label: "品牌总览", note: "经营结果与效率", number: "01" },
  { key: "category", label: "品类进度", note: "品类贡献与转化", number: "02" },
  { key: "link", label: "链接明细", note: "商品链接经营", number: "04" },
  { key: "ads", label: "广告数据", note: "站内投放效率", number: "06" },
  { key: "channels", label: "线上 / 线下 SKU", note: "销量差距与环比", number: "07" },
];

const ONLINE_SKU_SHEET_ID = "16hb3YZRtu0jnU0hHeL1SGHirR4lWzItGlW1LQ0zj5GU";

const BRANDS: BrandConfig[] = [
  {
    key: "SKT",
    name: "SKINTIFIC",
    goal: 2_500_000,
    shopSheet: "SKT-店铺维度每日",
    shopDate: "B",
    shopGmv: "C",
    shopOrders: "D",
    linkSheet: "SKT-店铺链接维度每日",
    adsSheet: "SKT-站内广告每日",
    adsDate: "B",
    adsProduct: "C",
    adsCategory: "D",
    adsId: "I",
    adsExposure: "Q",
    adsClicks: "R",
    adsConversions: "T",
    adsGmv: "AB",
    adsSpend: "AD",
    dmsSheet: "SKT-店鋪實收（DMS）",
    dmsDate: "A",
    dmsGmv: "J",
  },
  {
    key: "G2G",
    name: "GLAD2GLOW",
    goal: 1_540_000,
    shopSheet: "G2G-店鋪維度每日",
    shopDate: "A",
    shopGmv: "B",
    shopOrders: "C",
    linkSheet: "G2G-店鋪鏈接維度每日",
    adsSheet: "G2G-站内廣告每日",
    adsDate: "A",
    adsProduct: "B",
    adsCategory: "C",
    adsId: "H",
    adsExposure: "P",
    adsClicks: "Q",
    adsConversions: "S",
    adsGmv: "AA",
    adsSpend: "AC",
    dmsSheet: "G2G-店鋪實收（DMS）",
    dmsDate: "A",
    dmsGmv: "I",
  },
  {
    key: "TP",
    name: "TIME PHORIA",
    goal: 460_000,
    shopSheet: "TP-店鋪維度每日",
    shopDate: "A",
    shopGmv: "B",
    shopOrders: "C",
    linkSheet: "TP-店鋪鏈接維度每日",
    adsSheet: "TP-站内廣告每日",
    adsDate: "B",
    adsProduct: "C",
    adsCategory: "D",
    adsId: "I",
    adsExposure: "Q",
    adsClicks: "R",
    adsConversions: "T",
    adsGmv: "AB",
    adsSpend: "AD",
    dmsSheet: "TP-店鋪實收（DMS）",
    dmsDate: "A",
    dmsGmv: "E",
  },
];

const BRAND_COLORS: Record<BrandKey, string> = { SKT: "#2357af", G2G: "#bd1e67", TP: "#7656ba" };
const CATEGORY_CHAR_MAP: Record<string, string> = {
  妝: "妆",
  粧: "妆",
  護: "护",
  膚: "肤",
  潔: "洁",
  顏: "颜",
  髮: "发",
  曬: "晒",
  聯: "联",
  鏈: "链",
  組: "组",
  贈: "赠",
  華: "华",
};

const zeroMetric = (brand: BrandKey, key: string): MetricRow => ({
  key,
  brand,
  id: "",
  product: "",
  link: "",
  category: "",
  gmv: 0,
  previousGmv: 0,
  orders: 0,
  previousOrders: 0,
  exposure: 0,
  previousExposure: 0,
  clicks: 0,
  previousClicks: 0,
  visitors: 0,
  previousVisitors: 0,
  search: 0,
  previousSearch: 0,
  cart: 0,
  previousCart: 0,
  units: 0,
  previousUnits: 0,
  adGmv: 0,
  previousAdGmv: 0,
  adSpend: 0,
  previousAdSpend: 0,
  adExposure: 0,
  previousAdExposure: 0,
  adClicks: 0,
  previousAdClicks: 0,
  conversions: 0,
  previousConversions: 0,
});

function numberAt(row: GvizRow | undefined, index: number) {
  const value = row?.c?.[index]?.v;
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringAt(row: GvizRow | undefined, index: number) {
  return String(row?.c?.[index]?.v ?? "").trim();
}

function normalizeId(value: string) {
  const normalized = value.trim().replace(/[,\s]/g, "").replace(/\.0+$/, "");
  return normalized || "未填写";
}

function normalizeCategory(value: string) {
  const normalized = (value || FALLBACK_CATEGORY).trim().replace(/[妝粧護膚潔顏髮曬聯鏈組贈華]/g, (char) => CATEGORY_CHAR_MAP[char] || char);
  return normalized || FALLBACK_CATEGORY;
}

type MatchRecord = { id: string; link: string; product: string; category: string };

function addMetric(target: MetricRow, source: MetricRow) {
  const keys = ["gmv", "previousGmv", "orders", "previousOrders", "exposure", "previousExposure", "clicks", "previousClicks", "visitors", "previousVisitors", "search", "previousSearch", "cart", "previousCart", "units", "previousUnits", "adGmv", "previousAdGmv", "adSpend", "previousAdSpend", "adExposure", "previousAdExposure", "adClicks", "previousAdClicks", "conversions", "previousConversions"] as const;
  keys.forEach((key) => { target[key] += source[key]; });
}

function aggregateByCategory(rows: MetricRow[], brand: BrandKey) {
  const groups = new Map<string, MetricRow>();
  rows.forEach((row) => {
    const category = row.category || FALLBACK_CATEGORY;
    const existing = groups.get(category) || { ...zeroMetric(brand, `category-${category}`), category, product: category };
    addMetric(existing, row);
    groups.set(category, existing);
  });
  return [...groups.values()];
}

async function querySheet(sheet: string, query: string, spreadsheetId = SHEET_ID) {
  const params = new URLSearchParams({ tqx: "out:json", sheet, tq: query });
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Google Sheets ${response.status}`);
  const text = await response.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("无法解析 Google Sheet 数据");
  const payload = JSON.parse(text.slice(start, end + 1));
  if (payload.status !== "ok") throw new Error("Google Sheet 查询失败");
  return payload.table.rows as GvizRow[];
}

async function querySheetOptional(sheet: string, query: string, spreadsheetId = SHEET_ID) {
  try {
    return await querySheet(sheet, query, spreadsheetId);
  } catch {
    return [] as GvizRow[];
  }
}

function addValues(target: number[], values: number[]) {
  values.forEach((value, index) => {
    target[index] = (target[index] || 0) + (value || 0);
  });
  return target;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function dateRangeLength(range: DateRange) {
  const start = parseIsoDate(range.start).getTime();
  const end = parseIsoDate(range.end).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
}

function normalizeDateKey(value: string) {
  const gviz = value.match(/^Date\((\d+),(\d+),(\d+)/);
  if (gviz) return isoDate(Number(gviz[1]), Number(gviz[2]) + 1, Number(gviz[3]));
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return value;
}

function defaultCurrentRange(): DateRange {
  const now = new Date();
  return { start: isoDate(now.getFullYear(), now.getMonth() + 1, 1), end: isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate()) };
}

function shiftRangePreviousMonth(range: DateRange): DateRange {
  const [startYear, startMonth, startDay] = range.start.split("-").map(Number);
  const [endYear, endMonth, endDay] = range.end.split("-").map(Number);
  const shiftedStart = new Date(startYear, startMonth - 2, 1);
  const shiftedEnd = new Date(endYear, endMonth - 2, 1);
  const startMaxDay = new Date(shiftedStart.getFullYear(), shiftedStart.getMonth() + 1, 0).getDate();
  const endMaxDay = new Date(shiftedEnd.getFullYear(), shiftedEnd.getMonth() + 1, 0).getDate();
  return {
    start: isoDate(shiftedStart.getFullYear(), shiftedStart.getMonth() + 1, Math.min(startDay, startMaxDay)),
    end: isoDate(shiftedEnd.getFullYear(), shiftedEnd.getMonth() + 1, Math.min(endDay, endMaxDay)),
  };
}

function rangeLabel(range: DateRange) {
  return `${range.start.replace(/-/g, "/")} - ${range.end.replace(/-/g, "/")}`;
}

function dateWhere(column: string, start: string, end: string) {
  return `${column} >= date '${start}' and ${column} <= date '${end}'`;
}

function formatNumber(value: number, compact = false) {
  if (compact && Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (compact && Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatMoney(value: number, compact = false) {
  return `¥${formatNumber(value, compact)}`;
}

function formatMoneyOneDecimal(value: number) {
  return `¥${new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0)}`;
}

function formatChartAmount(value: number) {
  return formatNumber(value, true);
}

function dateLabel(value: string) {
  const gviz = value.match(/^Date\((\d+),(\d+),(\d+)/);
  if (gviz) return `${Number(gviz[2]) + 1}/${Number(gviz[3])}`;
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${Number(iso[2])}/${Number(iso[3])}`;
  return value;
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function rate(value: number | null | undefined) {
  return value && Number.isFinite(value) ? `${value.toFixed(2)}x` : "—";
}

function metricFromValues(
  brand: BrandKey,
  key: string,
  values: number[],
  dimensions: Partial<MetricRow> = {},
  previous: number[] = [],
  exchangeRate = DEFAULT_TWD_TO_CNY,
): MetricRow {
  return {
    ...zeroMetric(brand, key),
    ...dimensions,
    gmv: (values[0] || 0) * exchangeRate,
    orders: values[1] || 0,
    exposure: values[2] || 0,
    clicks: values[3] || 0,
    visitors: values[4] || 0,
    search: values[5] || 0,
    cart: values[6] || 0,
    units: values[7] || 0,
    adGmv: (values[8] || 0) * exchangeRate,
    adSpend: (values[9] || 0) * exchangeRate,
    adExposure: values[10] || 0,
    adClicks: values[11] || 0,
    conversions: values[12] || 0,
    previousGmv: (previous[0] || 0) * exchangeRate,
    previousOrders: previous[1] || 0,
    previousExposure: previous[2] || 0,
    previousClicks: previous[3] || 0,
    previousVisitors: previous[4] || 0,
    previousSearch: previous[5] || 0,
    previousCart: previous[6] || 0,
    previousUnits: previous[7] || 0,
    previousAdGmv: (previous[8] || 0) * exchangeRate,
    previousAdSpend: (previous[9] || 0) * exchangeRate,
    previousAdExposure: previous[10] || 0,
    previousAdClicks: previous[11] || 0,
    previousConversions: previous[12] || 0,
  };
}

function metricQuery(
  sheet: string,
  dateColumn: string,
  start: string,
  end: string,
  groupBy: string,
) {
  return `select ${groupBy ? `${groupBy},` : ""}sum(K),sum(R),sum(M),sum(N),sum(AD),sum(AH),sum(AK),sum(T) where ${dateWhere(dateColumn, start, end)}${groupBy ? ` group by ${groupBy}` : ""} label sum(K) '',sum(R) '',sum(M) '',sum(N) '',sum(AD) '',sum(AH) '',sum(AK) '',sum(T) ''`;
}

async function loadBrand(config: BrandConfig, period: DateRange, previousPeriod: DateRange, exchangeRate = DEFAULT_TWD_TO_CNY) {
  const linkGroupDetail = "C,D";
  const mappingQuery = config.key === "SKT"
    ? "select E,F,G where E is not null"
    : config.key === "G2G"
      ? "select R,S,T where R is not null"
      : "select X,Y,Z where X is not null";
  const maintainedMappingQuery = "select A,B,C,D where B is not null";
  const aggregateQuery = (start: string, end: string, group = "") =>
    metricQuery(config.linkSheet, "B", start, end, group);
  const shopQuery = (start: string, end: string) =>
    `select ${config.shopDate},sum(${config.shopGmv}),sum(${config.shopOrders}) where ${dateWhere(config.shopDate, start, end)} group by ${config.shopDate} order by ${config.shopDate} label sum(${config.shopGmv}) '',sum(${config.shopOrders}) ''`;
  const adsAggQuery = (start: string, end: string) =>
    `select sum(${config.adsGmv}),sum(${config.adsSpend}),sum(${config.adsExposure}),sum(${config.adsClicks}),sum(${config.adsConversions}) where ${dateWhere(config.adsDate, start, end)} label sum(${config.adsGmv}) '',sum(${config.adsSpend}) '',sum(${config.adsExposure}) '',sum(${config.adsClicks}) '',sum(${config.adsConversions}) ''`;
  const adsDetailQuery = (start: string, end: string) => `select ${config.adsProduct},${config.adsCategory},${config.adsId},sum(${config.adsGmv}),sum(${config.adsSpend}),sum(${config.adsExposure}),sum(${config.adsClicks}),sum(${config.adsConversions}) where ${dateWhere(config.adsDate, start, end)} group by ${config.adsProduct},${config.adsCategory},${config.adsId} label sum(${config.adsGmv}) '',sum(${config.adsSpend}) '',sum(${config.adsExposure}) '',sum(${config.adsClicks}) '',sum(${config.adsConversions}) ''`;
  const dmsQuery = `select sum(${config.dmsGmv}) where ${dateWhere(config.dmsDate, period.start, period.end)} label sum(${config.dmsGmv}) ''`;

  const [dailyRows, prevDailyRows, currentAll, prevAll, currentLinks, prevLinks, adsAgg, adsPrev, adsDetail, adsPrevDetail, dms, mappingRows, maintainedMappingRows] = await Promise.all([
    querySheet(config.shopSheet, shopQuery(period.start, period.end)),
    querySheet(config.shopSheet, shopQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.linkSheet, aggregateQuery(period.start, period.end)),
    querySheet(config.linkSheet, aggregateQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.linkSheet, aggregateQuery(period.start, period.end, linkGroupDetail)),
    querySheet(config.linkSheet, aggregateQuery(previousPeriod.start, previousPeriod.end, linkGroupDetail)),
    querySheet(config.adsSheet, adsAggQuery(period.start, period.end)),
    querySheet(config.adsSheet, adsAggQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.adsSheet, adsDetailQuery(period.start, period.end)),
    querySheet(config.adsSheet, adsDetailQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.dmsSheet, dmsQuery),
    querySheet("匹配表", mappingQuery),
    querySheetOptional("看板归类维护", maintainedMappingQuery),
  ]);

  const matchMap = new Map<string, MatchRecord>();
  mappingRows.forEach((row) => {
    const id = stringAt(row, 0);
    if (!id) return;
    matchMap.set(normalizeId(id), { id: normalizeId(id), link: stringAt(row, 1), product: stringAt(row, 1), category: normalizeCategory(stringAt(row, 2) || FALLBACK_CATEGORY) });
  });
  maintainedMappingRows.forEach((row) => {
    if (brandFromValue(stringAt(row, 0)) !== config.key) return;
    const id = normalizeId(stringAt(row, 1));
    const product = stringAt(row, 2);
    if (!id || !product) return;
    matchMap.set(id, { id, link: product, product, category: normalizeCategory(stringAt(row, 3) || FALLBACK_CATEGORY) });
  });

  const adTotal = [numberAt(adsAgg[0], 0), numberAt(adsAgg[0], 1), numberAt(adsAgg[0], 2), numberAt(adsAgg[0], 3), numberAt(adsAgg[0], 4)];
  const previousAdTotal = [numberAt(adsPrev[0], 0), numberAt(adsPrev[0], 1), numberAt(adsPrev[0], 2), numberAt(adsPrev[0], 3), numberAt(adsPrev[0], 4)];
  const adMap = new Map<string, number[]>();
  adsDetail.forEach((row) => {
    const id = normalizeId(stringAt(row, 2));
    if (!id) return;
    adMap.set(id, addValues(adMap.get(id) || [], [numberAt(row, 3), numberAt(row, 4), numberAt(row, 5), numberAt(row, 6), numberAt(row, 7)]));
  });
  const previousAdMap = new Map<string, number[]>();
  adsPrevDetail.forEach((row) => {
    const id = normalizeId(stringAt(row, 2));
    if (!id) return;
    previousAdMap.set(id, addValues(previousAdMap.get(id) || [], [numberAt(row, 3), numberAt(row, 4), numberAt(row, 5), numberAt(row, 6), numberAt(row, 7)]));
  });
  const decorateRows = (rows: GvizRow[], prevRows: GvizRow[]) => {
    const previousMap = new Map<string, number[]>();
    prevRows.forEach((row) => {
      const key = normalizeId(stringAt(row, 0));
      if (!key) return;
      const previousValues = Array.from({ length: 8 }, (_, i) => numberAt(row, 2 + i));
      previousMap.set(key, addValues(previousMap.get(key) || [], previousValues));
    });
    const currentMap = new Map<string, { sourceProduct: string; values: number[] }>();
    rows.forEach((row) => {
      const id = normalizeId(stringAt(row, 0));
      if (!id) return;
      const currentValues = Array.from({ length: 8 }, (_, i) => numberAt(row, 2 + i));
      const existing = currentMap.get(id);
      if (existing) {
        addValues(existing.values, currentValues);
        if (!existing.sourceProduct) existing.sourceProduct = stringAt(row, 1);
      } else {
        currentMap.set(id, { sourceProduct: stringAt(row, 1), values: currentValues });
      }
    });
    return Array.from(currentMap.entries()).map(([id, row], index) => {
      const match = matchMap.get(id);
      const product = match?.product || row.sourceProduct || id;
      const dimensions = { link: product, id, product, category: normalizeCategory(match?.category || FALLBACK_CATEGORY) };
      const ad = adMap.get(id) || [];
      const prev = previousMap.get(id) || [];
      return metricFromValues(config.key, `link-${id}-${index}`, [...row.values, ad[0] || 0, ad[1] || 0, ad[2] || 0, ad[3] || 0, ad[4] || 0], dimensions, prev, exchangeRate);
    }).filter((row) => row.link || row.id);
  };
  const links = decorateRows(currentLinks, prevLinks);
  const daily = dailyRows.map((row) => ({ date: stringAt(row, 0), gmv: numberAt(row, 1) * exchangeRate, orders: numberAt(row, 2) }));
  const previousDaily = prevDailyRows.map((row) => ({ date: stringAt(row, 0), gmv: numberAt(row, 1) * exchangeRate, orders: numberAt(row, 2) }));
  const current = metricFromValues(config.key, `${config.key}-all`, [numberAt(currentAll[0], 0), numberAt(currentAll[0], 1), numberAt(currentAll[0], 2), numberAt(currentAll[0], 3), numberAt(currentAll[0], 4), numberAt(currentAll[0], 5), numberAt(currentAll[0], 6), numberAt(currentAll[0], 7), adTotal[0], adTotal[1], adTotal[2], adTotal[3], adTotal[4]], {}, [numberAt(prevAll[0], 0), numberAt(prevAll[0], 1), numberAt(prevAll[0], 2), numberAt(prevAll[0], 3), numberAt(prevAll[0], 4), numberAt(prevAll[0], 5), numberAt(prevAll[0], 6), numberAt(prevAll[0], 7), previousAdTotal[0], previousAdTotal[1], previousAdTotal[2], previousAdTotal[3], previousAdTotal[4]], exchangeRate);
  const previous = metricFromValues(config.key, `${config.key}-previous`, [numberAt(prevAll[0], 0), numberAt(prevAll[0], 1), numberAt(prevAll[0], 2), numberAt(prevAll[0], 3), numberAt(prevAll[0], 4), numberAt(prevAll[0], 5), numberAt(prevAll[0], 6), numberAt(prevAll[0], 7), previousAdTotal[0], previousAdTotal[1], previousAdTotal[2], previousAdTotal[3], previousAdTotal[4]], {}, [], exchangeRate);
  return {
    config,
    daily,
    previousDaily,
    current,
    previous,
    category: aggregateByCategory(links, config.key),
    links,
    ads: adsDetail.map((row, index) => {
      const id = normalizeId(stringAt(row, 2));
      const link = links.find((item) => item.id === id);
      const prevAd = previousAdMap.get(id) || [];
      return {
        ...metricFromValues(config.key, `ad-${index}`, [(link?.gmv || 0) / exchangeRate, 0, numberAt(row, 5), numberAt(row, 6), 0, 0, 0, 0, numberAt(row, 3), numberAt(row, 4), numberAt(row, 5), numberAt(row, 6), numberAt(row, 7)], { product: stringAt(row, 0), category: normalizeCategory(stringAt(row, 1) || link?.category || FALLBACK_CATEGORY), id }, [(link?.previousGmv || 0) / exchangeRate, 0, prevAd[2] || 0, prevAd[3] || 0, 0, 0, 0, 0, prevAd[0] || 0, prevAd[1] || 0, prevAd[2] || 0, prevAd[3] || 0, prevAd[4] || 0], exchangeRate),
      };
    }),
    actualGmv: numberAt(dms[0], 0) * exchangeRate,
  } satisfies BrandData;
}

function brandFromValue(value: string): BrandKey | null {
  const normalized = value.toUpperCase();
  if (normalized.includes("SKT") || normalized.includes("SKINTIFIC")) return "SKT";
  if (normalized.includes("G2G") || normalized.includes("GLAD2GLOW")) return "G2G";
  if (normalized.includes("TP") || normalized.includes("TIME")) return "TP";
  return null;
}

function skuQuery(start: string, end: string) {
  return `select B,sum(C),D,E where ${dateWhere("A", start, end)} group by B,D,E label sum(C) ''`;
}

function skuProductQuery() {
  return "select B,D,E where B is not null";
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [] as Array<Record<string, string>>;
  const fields = (line: string) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => match[1].replaceAll('""', '"'));
  const headers = fields(lines[0]);
  return lines.slice(1).map((line) => {
    const values = fields(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

async function loadChannelData(period: DateRange, previousPeriod: DateRange): Promise<ChannelData> {
  const [onlineCurrentRows, onlinePreviousRows, onlineProductRows, offlineResponse] = await Promise.all([
    querySheet("", skuQuery(period.start, period.end), ONLINE_SKU_SHEET_ID),
    querySheet("", skuQuery(previousPeriod.start, previousPeriod.end), ONLINE_SKU_SHEET_ID),
    querySheet("", skuProductQuery(), ONLINE_SKU_SHEET_ID),
    fetch("/offline_sku_sales.csv", { cache: "no-store" }),
  ]);
  if (!offlineResponse.ok) throw new Error(`线下销量文件读取失败（${offlineResponse.status}）`);
  const offlineRows = parseCsv(await offlineResponse.text());
  const onlineCurrent = new Map<BrandKey, Map<string, { id: string; product: string; quantity: number }>>();
  const onlinePrevious = new Map<BrandKey, Map<string, { id: string; product: string; quantity: number }>>();
  const productMap = new Map<BrandKey, Map<string, string>>();
  BRANDS.forEach((brand) => productMap.set(brand.key, new Map()));
  BRANDS.forEach((brand) => { onlineCurrent.set(brand.key, new Map()); onlinePrevious.set(brand.key, new Map()); });
  onlineProductRows.forEach((row) => {
    const brand = brandFromValue(stringAt(row, 2));
    const id = normalizeId(stringAt(row, 0));
    const product = stringAt(row, 1);
    if (brand && id && product) productMap.get(brand)?.set(id, product);
  });
  onlineCurrentRows.forEach((row) => {
    const brand = brandFromValue(stringAt(row, 3));
    if (!brand) return;
    const id = normalizeId(stringAt(row, 0));
    const product = stringAt(row, 2);
    if (product) productMap.get(brand)?.set(id, product);
    onlineCurrent.get(brand)?.set(id, { id, product, quantity: numberAt(row, 1) });
  });
  onlinePreviousRows.forEach((row) => {
    const brand = brandFromValue(stringAt(row, 3));
    if (!brand) return;
    const id = normalizeId(stringAt(row, 0));
    const product = stringAt(row, 2);
    if (product) productMap.get(brand)?.set(id, product);
    onlinePrevious.get(brand)?.set(id, { id, product, quantity: numberAt(row, 1) });
  });

  const offlineCurrent = new Map<BrandKey, Map<string, { id: string; product: string; quantity: number }>>();
  const offlinePrevious = new Map<BrandKey, Map<string, { id: string; product: string; quantity: number }>>();
  BRANDS.forEach((brand) => { offlineCurrent.set(brand.key, new Map()); offlinePrevious.set(brand.key, new Map()); });
  offlineRows.forEach((row) => {
    const brand = brandFromValue(row.brand || "");
    const id = normalizeId(row.sku || "");
    if (!brand || !id || id === "未填写") return;
    const rowDate = row.date || `${row.month || ""}-01`;
    const target = rowDate >= period.start && rowDate <= period.end ? offlineCurrent : rowDate >= previousPeriod.start && rowDate <= previousPeriod.end ? offlinePrevious : null;
    if (!target) return;
    const map = target.get(brand)!;
    const existing = map.get(id);
    const product = row.product || productMap.get(brand)?.get(id) || id;
    map.set(id, { id, product, quantity: (existing?.quantity || 0) + Number(row.quantity || 0) });
  });

  const rows: ChannelSkuRow[] = [];
  for (const config of BRANDS) {
    const currentOffline = offlineCurrent.get(config.key)!;
    const previousOffline = offlinePrevious.get(config.key)!;
    const ids = new Set([...onlineCurrent.get(config.key)!.keys(), ...onlinePrevious.get(config.key)!.keys(), ...currentOffline.keys(), ...previousOffline.keys()]);
    ids.forEach((id) => {
      const online = onlineCurrent.get(config.key)!.get(id);
      const onlinePrev = onlinePrevious.get(config.key)!.get(id);
      const offline = currentOffline.get(id);
      const offlinePrev = previousOffline.get(id);
      rows.push({ key: `${config.key}-${id}`, brand: config.key, id, product: online?.product || onlinePrev?.product || offline?.product || offlinePrev?.product || productMap.get(config.key)?.get(id) || id, online: online?.quantity || 0, onlinePrevious: onlinePrev?.quantity || 0, offline: offline?.quantity || 0, offlinePrevious: offlinePrev?.quantity || 0 });
    });
  }
  return { rows };
}

function ratio(current: number, previous: number) {
  return previous > 0 ? (current - previous) / previous : null;
}

function levelPercent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function trendClass(delta: number | null | undefined) {
  return delta !== null && delta !== undefined && delta > 0 ? "trend-up" : delta !== null && delta !== undefined && delta < 0 ? "trend-down" : "trend-flat";
}

type SortValue = string | number | null | undefined;
type SortState = { key: string; direction: "asc" | "desc" };
type SortColumn<T> = { key: string; label: string; value: (row: T) => SortValue; defaultDirection?: "asc" | "desc" };

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

function compareSortValue(left: SortValue, right: SortValue) {
  if (typeof left === "number" || typeof right === "number") return Number(left ?? Number.NEGATIVE_INFINITY) - Number(right ?? Number.NEGATIVE_INFINITY);
  return collator.compare(String(left ?? ""), String(right ?? ""));
}

function SortableHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: "asc" | "desc"; onClick: () => void }) {
  return <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}><button className={`sort-button${active ? " active" : ""}`} type="button" onClick={onClick}><span>{label}</span><i>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</i></button></th>;
}

function deltaText(current: number | null | undefined, previous: number | null | undefined, mode: "ratio" | "pp" = "ratio") {
  if (current === null || current === undefined || previous === null || previous === undefined || !Number.isFinite(current) || !Number.isFinite(previous)) return "环比 —";
  if (mode === "pp") return `变化 ${current - previous >= 0 ? "+" : "−"}${Math.abs((current - previous) * 100).toFixed(1)}pp`;
  return `环比 ${percent(ratio(current, previous))}`;
}

function MetricCell({ value, previous, format, mode = "ratio" }: { value: number | null | undefined; previous: number | null | undefined; format: (value: number) => string; mode?: "ratio" | "pp" }) {
  const delta = mode === "pp" && value !== null && value !== undefined && previous !== null && previous !== undefined ? value - previous : ratio(value || 0, previous || 0);
  return <td className="metric-value"><b>{value === null || value === undefined || !Number.isFinite(value) ? "—" : format(value)}</b><small className={trendClass(delta)}>{deltaText(value, previous, mode)}</small></td>;
}

function DailyBrandRow({ item, comparisonLabel, currentRange, previousRange }: { item: BrandData; comparisonLabel: string; currentRange: DateRange; previousRange: DateRange }) {
  const currentMap = new Map(item.daily.map((row) => [normalizeDateKey(row.date), row]));
  const previousMap = new Map(item.previousDaily.map((row) => [normalizeDateKey(row.date), row]));
  const length = Math.max(dateRangeLength(currentRange), dateRangeLength(previousRange));
  const days = Array.from({ length }, (_, index) => {
    const currentDate = addDays(currentRange.start, index);
    const previousDate = addDays(previousRange.start, index);
    return { currentDate, previousDate, current: currentMap.get(currentDate), previous: previousMap.get(previousDate) };
  });
  const max = Math.max(...days.map((day) => day.current?.gmv || 0), ...days.map((day) => day.previous?.gmv || 0), 1);
  const mom = ratio(item.current.gmv, item.previous.gmv);
  const currentFee = item.current.gmv > 0 ? item.current.adSpend / item.current.gmv : null;
  const previousFee = item.previous.gmv > 0 ? item.previous.adSpend / item.previous.gmv : null;
  const feeDelta = currentFee !== null && previousFee !== null ? currentFee - previousFee : null;
  const color = BRAND_COLORS[item.config.key];
  return <article className="brand-daily-row" style={{ "--brand-color": color } as React.CSSProperties}>
    <div className="brand-row-head"><div className="brand-row-name"><i /> <b>{item.config.key}</b><span>{item.config.name}</span></div><div className="brand-row-metrics"><span>本期 GMV <strong>{formatChartAmount(item.current.gmv)}</strong></span><span className={trendClass(mom)}>环比 {percent(mom)}</span><span>站内费比 <strong>{levelPercent(currentFee)}</strong></span><span className={trendClass(feeDelta)}>费比变化 {feeDelta === null ? "—" : `${feeDelta > 0 ? "+" : "−"}${Math.abs(feeDelta * 100).toFixed(1)}pp`}</span><small>{comparisonLabel}</small></div></div>
    <div className="brand-row-grid"><div className="daily-chart-card"><div className="chart-card-title"><b>每日 GMV</b><span>深色：本期 · 浅色：环比区间 · 上方为日环比</span></div><div className="daily-compare-bars">{days.map((day) => { const dailyMom = ratio(day.current?.gmv || 0, day.previous?.gmv || 0); return <div className="day-group" key={`${item.config.key}-${day.currentDate}-${day.previousDate}`}><em className={`daily-mom ${trendClass(dailyMom)}`}>{dailyMom === null ? "—" : percent(dailyMom)}</em><div className="bar-slot"><b>{day.current ? formatChartAmount(day.current.gmv) : ""}</b><span className="bar-current" style={{ height: `${Math.max(3, (day.current?.gmv || 0) / max * 100)}%` }} /></div><div className="bar-slot"><b className="bar-label-muted">{day.previous ? formatChartAmount(day.previous.gmv) : ""}</b><span className="bar-previous" style={{ height: `${Math.max(3, (day.previous?.gmv || 0) / max * 100)}%` }} /></div><small title={`${day.currentDate} 对比 ${day.previousDate}`}>{dateLabel(day.currentDate)}</small></div>; })}</div><div className="chart-foot"><strong>{formatChartAmount(item.current.gmv)}</strong><span>共 {days.length} 天 · 环比区间 {formatChartAmount(item.previous.gmv)}</span></div></div><div className="fee-chart-card"><div className="chart-card-title"><b>站内费比</b><span>站内花费 ÷ GMV</span></div><div className="fee-bars"><div className="fee-line"><span>本期</span><div className="fee-track"><i style={{ width: `${Math.min(100, Math.max(0, (currentFee || 0) * 100 * 3))}%` }} /><b>{levelPercent(currentFee)}</b></div></div><div className="fee-line"><span>环比</span><div className="fee-track previous"><i style={{ width: `${Math.min(100, Math.max(0, (previousFee || 0) * 100 * 3))}%` }} /><b>{levelPercent(previousFee)}</b></div></div></div><div className={`fee-delta ${trendClass(feeDelta)}`}>{feeDelta === null ? "暂无可比费比" : `费比${feeDelta > 0 ? "上升" : "下降"} ${Math.abs(feeDelta * 100).toFixed(1)} 个百分点`}</div></div></div>
  </article>;
}

function MetricCard({ label, value, delta, note, color }: { label: string; value: string; delta?: number | null; note?: string; color?: string }) {
  return <article className="metric-card" style={{ "--card-accent": color || "#2364d8" } as React.CSSProperties}>
    <span>{label}</span><strong>{value}</strong>
    {delta !== undefined && <em className={delta !== null && delta >= 0 ? "up" : "down"}>{delta === null ? "—" : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta * 100).toFixed(1)}%`}</em>}
    {note && <small>{note}</small>}
  </article>;
}

function Insight({ brands }: { brands: BrandData[] }) {
  const sales = brands.reduce((sum, item) => sum + item.current.gmv, 0);
  const previous = brands.reduce((sum, item) => sum + item.previous.gmv, 0);
  const adSpend = brands.reduce((sum, item) => sum + item.current.adSpend, 0);
  const actual = brands.reduce((sum, item) => sum + item.actualGmv, 0);
  const mom = ratio(sales, previous);
  const roi = adSpend > 0 ? actual / adSpend : 0;
  return <div className="insight"><b>经营判断</b><span>本期 GMV {mom === null ? "暂无环比" : `${mom >= 0 ? "增长" : "下滑"} ${Math.abs(mom * 100).toFixed(1)}%`}，综合 ROI {rate(roi)}。建议优先复盘下方品类与链接的异常变化。</span></div>;
}

function Table({ rows, type }: { rows: MetricRow[]; type: "category" | "link" | "ads" }) {
  const defaultSort: SortState = { key: type === "ads" ? "adGmv" : "gmv", direction: "desc" };
  const [sort, setSort] = useState<SortState>(defaultSort);
  useEffect(() => setSort(defaultSort), [type]);
  const columns: SortColumn<MetricRow>[] = type === "ads"
    ? [
      { key: "product", label: "产品 / 广告", value: (row) => row.product, defaultDirection: "asc" },
      { key: "category", label: "品类", value: (row) => row.category, defaultDirection: "asc" },
      { key: "gmv", label: "链接GMV", value: (row) => row.gmv },
      { key: "adGmv", label: "广告成交金额", value: (row) => row.adGmv },
      { key: "adShare", label: "广告成交占比", value: (row) => row.gmv > 0 ? row.adGmv / row.gmv : null },
      { key: "adSpend", label: "花费", value: (row) => row.adSpend },
      { key: "roi", label: "ROI", value: (row) => row.adSpend > 0 ? row.adGmv / row.adSpend : null },
      { key: "exposure", label: "曝光", value: (row) => row.exposure },
      { key: "clicks", label: "点击", value: (row) => row.clicks },
      { key: "ctr", label: "CTR", value: (row) => row.exposure > 0 ? row.clicks / row.exposure : null },
      { key: "cpc", label: "CPC", value: (row) => row.clicks > 0 ? row.adSpend / row.clicks : null },
      { key: "cvr", label: "CVR", value: (row) => row.clicks > 0 ? row.conversions / row.clicks : null },
    ]
    : [
      { key: "primary", label: type === "category" ? "品类" : "产品名", value: (row) => type === "category" ? row.category : row.product || row.link, defaultDirection: "asc" },
      ...(type === "link" ? [{ key: "id", label: "商品ID / ID", value: (row: MetricRow) => row.id, defaultDirection: "asc" as const }] : []),
      { key: "gmv", label: "GMV", value: (row) => row.gmv },
      { key: "orders", label: "订单", value: (row) => row.orders },
      { key: "aov", label: "客单价", value: (row) => row.orders > 0 ? row.gmv / row.orders : null },
      { key: "visitors", label: "访客", value: (row) => row.visitors },
      { key: "ctr", label: "CTR", value: (row) => row.exposure > 0 ? row.clicks / row.exposure : null },
      { key: "cart", label: "加购", value: (row) => row.cart },
      { key: "cartRate", label: "加购率", value: (row) => row.visitors > 0 ? row.cart / row.visitors : null },
      { key: "cvr", label: "CVR", value: (row) => row.clicks > 0 ? row.orders / row.clicks : null },
      { key: "roi", label: "ROI", value: (row) => row.adSpend > 0 ? row.adGmv / row.adSpend : null },
      { key: "fee", label: "费比", value: (row) => row.gmv > 0 ? row.adSpend / row.gmv : null },
      { key: "adShare", label: "广告GMV占比", value: (row) => row.gmv > 0 ? row.adGmv / row.gmv : null },
      { key: "organicShare", label: "自然GMV占比", value: (row) => row.gmv > 0 ? 1 - row.adGmv / row.gmv : null },
    ];
  const sortColumn = columns.find((column) => column.key === sort.key) || columns[0];
  const sorted = [...rows].sort((a, b) => {
    const result = compareSortValue(sortColumn.value(a), sortColumn.value(b));
    return sort.direction === "asc" ? result : -result;
  }).slice(0, 80);
  const sortBy = (column: SortColumn<MetricRow>) => setSort((current) => current.key === column.key ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: column.defaultDirection || "desc" });
  return <div className="table-wrap"><table><thead><tr>
    {columns.map((column) => <SortableHeader key={column.key} label={column.label} active={sort.key === column.key} direction={sort.direction} onClick={() => sortBy(column)} />)}
  </tr></thead><tbody>{sorted.map((row) => {
    const aov = row.orders > 0 ? row.gmv / row.orders : 0;
    const ctr = row.exposure > 0 ? row.clicks / row.exposure : 0;
    const previousCtr = row.previousExposure > 0 ? row.previousClicks / row.previousExposure : 0;
    const cartRate = row.visitors > 0 ? row.cart / row.visitors : 0;
    const previousCartRate = row.previousVisitors > 0 ? row.previousCart / row.previousVisitors : 0;
    const cvr = row.clicks > 0 ? row.orders / row.clicks : 0;
    const previousCvr = row.previousClicks > 0 ? row.previousOrders / row.previousClicks : 0;
    const roi = row.adSpend > 0 ? row.adGmv / row.adSpend : 0;
    const previousRoi = row.previousAdSpend > 0 ? row.previousAdGmv / row.previousAdSpend : 0;
    const fee = row.gmv > 0 ? row.adSpend / row.gmv : 0;
    const previousFee = row.previousGmv > 0 ? row.previousAdSpend / row.previousGmv : 0;
    const share = row.gmv > 0 ? row.adGmv / row.gmv : 0;
    const previousShare = row.previousGmv > 0 ? row.previousAdGmv / row.previousGmv : 0;
    const previousAov = row.previousOrders > 0 ? row.previousGmv / row.previousOrders : 0;
    const adDealShare = row.gmv > 0 ? row.adGmv / row.gmv : null;
    const previousAdDealShare = row.previousGmv > 0 ? row.previousAdGmv / row.previousGmv : null;
    const cpc = row.clicks > 0 ? row.adSpend / row.clicks : 0;
    const previousCpc = row.previousClicks > 0 ? row.previousAdSpend / row.previousClicks : 0;
    return <tr key={row.key}>
      <td><b>{type === "category" ? row.category : row.product || row.link || "—"}</b><small style={{ color: BRAND_COLORS[row.brand] }}>{row.brand}{type === "link" ? ` · ${row.category || FALLBACK_CATEGORY}` : ""}</small></td>
      {type === "link" && <td>{row.id || "—"}</td>}
      {type === "ads" && <td>{row.category || "—"}</td>}
      {type === "ads" ? <><MetricCell value={row.gmv > 0 ? row.gmv : null} previous={row.previousGmv > 0 ? row.previousGmv : null} format={(value) => formatMoney(value, true)} /><MetricCell value={row.adGmv} previous={row.previousAdGmv} format={(value) => formatMoney(value, true)} /><MetricCell value={adDealShare} previous={previousAdDealShare} format={(value) => percent(value)} mode="pp" /></> : <><MetricCell value={row.gmv} previous={row.previousGmv} format={(value) => formatMoney(value, true)} /><MetricCell value={row.orders} previous={row.previousOrders} format={formatNumber} /><MetricCell value={aov} previous={previousAov} format={formatMoney} /><MetricCell value={row.visitors} previous={row.previousVisitors} format={formatNumber} /><MetricCell value={ctr} previous={previousCtr} format={(value) => percent(value)} mode="pp" /><MetricCell value={row.cart} previous={row.previousCart} format={formatNumber} /><MetricCell value={cartRate} previous={previousCartRate} format={(value) => percent(value)} mode="pp" /><MetricCell value={cvr} previous={previousCvr} format={(value) => percent(value)} mode="pp" /><MetricCell value={roi} previous={previousRoi} format={rate} /><MetricCell value={fee} previous={previousFee} format={(value) => percent(value)} mode="pp" /><MetricCell value={share} previous={previousShare} format={(value) => percent(value)} mode="pp" /><MetricCell value={1 - share} previous={1 - previousShare} format={(value) => percent(value)} mode="pp" /></>}
      {type === "ads" && <><MetricCell value={row.adSpend} previous={row.previousAdSpend} format={(value) => formatMoney(value, true)} /><MetricCell value={roi} previous={previousRoi} format={rate} /><MetricCell value={row.exposure} previous={row.previousExposure} format={formatNumber} /><MetricCell value={row.clicks} previous={row.previousClicks} format={formatNumber} /><MetricCell value={ctr} previous={previousCtr} format={(value) => percent(value)} mode="pp" /><MetricCell value={cpc} previous={previousCpc} format={formatMoneyOneDecimal} /><MetricCell value={row.clicks > 0 ? row.conversions / row.clicks : 0} previous={row.previousClicks > 0 ? row.previousConversions / row.previousClicks : 0} format={(value) => percent(value)} mode="pp" /></>}
    </tr>;
  })}</tbody></table></div>;
}

function ChannelTable({ rows, brand }: { rows: ChannelSkuRow[]; brand: "ALL" | BrandKey }) {
  const [sort, setSort] = useState<SortState>({ key: "total", direction: "desc" });
  const columns: SortColumn<ChannelSkuRow>[] = [
    { key: "sku", label: "品牌 / SKU", value: (row) => `${row.brand} ${row.id}`, defaultDirection: "asc" },
    { key: "product", label: "产品名", value: (row) => row.product, defaultDirection: "asc" },
    { key: "online", label: "线上销量", value: (row) => row.online },
    { key: "offline", label: "线下销量", value: (row) => row.offline },
    { key: "gap", label: "线上－线下", value: (row) => row.online - row.offline },
    { key: "onlineShare", label: "线上占比", value: (row) => row.online + row.offline > 0 ? row.online / (row.online + row.offline) : null },
    { key: "total", label: "总销量", value: (row) => row.online + row.offline },
  ];
  const sortColumn = columns.find((column) => column.key === sort.key) || columns[8];
  const sorted = rows.filter((row) => brand === "ALL" || row.brand === brand).sort((a, b) => {
    const result = compareSortValue(sortColumn.value(a), sortColumn.value(b));
    return sort.direction === "asc" ? result : -result;
  }).slice(0, 120);
  const sortBy = (column: SortColumn<ChannelSkuRow>) => setSort((current) => current.key === column.key ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: column.defaultDirection || "desc" });
  return <div className="table-wrap channel-table"><table><colgroup><col className="channel-col-sku" /><col className="channel-col-product" /><col className="channel-col-metric" /><col className="channel-col-metric" /><col className="channel-col-gap" /><col className="channel-col-share" /></colgroup><thead><tr>{columns.filter((column) => column.key !== "total").map((column) => <SortableHeader key={column.key} label={column.label} active={sort.key === column.key} direction={sort.direction} onClick={() => sortBy(column)} />)}</tr></thead><tbody>{sorted.map((row) => {
    const gap = row.online - row.offline;
    const previousGap = row.onlinePrevious - row.offlinePrevious;
    const total = row.online + row.offline;
    const previousTotal = row.onlinePrevious + row.offlinePrevious;
    return <tr key={row.key}><td><b style={{ color: BRAND_COLORS[row.brand] }}>{row.brand} · {row.id}</b><small>按 SKU 码匹配</small></td><td className="channel-product"><b title={row.product || row.id}>{row.product || row.id}</b><small>产品名</small></td><MetricCell value={row.online} previous={row.onlinePrevious} format={formatNumber} /><MetricCell value={row.offline} previous={row.offlinePrevious} format={formatNumber} /><MetricCell value={gap} previous={previousGap} format={(value) => `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`} /><MetricCell value={total > 0 ? row.online / total : null} previous={previousTotal > 0 ? row.onlinePrevious / previousTotal : null} format={(value) => percent(value)} mode="pp" /></tr>;
  })}</tbody></table></div>;
}

export function SalesDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [page, setPage] = useState<PageKey>("overview");
  const [currentRange, setCurrentRange] = useState<DateRange>(() => defaultCurrentRange());
  const [previousRange, setPreviousRange] = useState<DateRange>(() => shiftRangePreviousMonth(defaultCurrentRange()));
  const [brand, setBrand] = useState<"ALL" | BrandKey>("ALL");
  const [productId, setProductId] = useState("");
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState<BrandData[]>([]);
  const [channelData, setChannelData] = useState<ChannelData>({ rows: [] });
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => setUnlocked(sessionStorage.getItem("tw-sp-dashboard") === "unlocked"), []);
  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all(BRANDS.map((item) => loadBrand(item, currentRange, previousRange, DEFAULT_TWD_TO_CNY)))
      .then((result) => { if (!cancelled) setData(result); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "数据同步失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentRange, previousRange, refresh, unlocked]);

  useEffect(() => {
    if (!unlocked || page !== "channels") return;
    let cancelled = false;
    setChannelLoading(true);
    setChannelError("");
    loadChannelData(currentRange, previousRange)
      .then((result) => { if (!cancelled) setChannelData(result); })
      .catch((reason) => { if (!cancelled) setChannelError(reason instanceof Error ? reason.message : "线上线下销量同步失败"); })
      .finally(() => { if (!cancelled) setChannelLoading(false); });
    return () => { cancelled = true; };
  }, [currentRange, previousRange, refresh, unlocked, page]);

  const visible = useMemo(() => data.filter((item) => brand === "ALL" || item.config.key === brand), [brand, data]);
  const options = useMemo(() => {
    const rows = visible.flatMap((item) => [...item.category, ...item.links]);
    return {
      categories: [...new Set(rows.map((row) => row.category).filter(Boolean))].sort(),
    };
  }, [visible]);
  const matches = (row: MetricRow) => (!productId || `${row.id} ${row.link}`.toLowerCase().includes(productId.toLowerCase())) && (!product || `${row.product} ${row.link}`.toLowerCase().includes(product.toLowerCase())) && (!category || row.category === category);
  const rowsFor = (type: "category" | "link" | "ads") => visible.flatMap((item) => (type === "category" ? item.category : type === "link" ? item.links : item.ads).filter(matches));
  const total = visible.reduce((acc, item) => ({ gmv: acc.gmv + item.current.gmv, previous: acc.previous + item.previous.gmv, orders: acc.orders + item.current.orders, exposure: acc.exposure + item.current.exposure, visitors: acc.visitors + item.current.visitors, cart: acc.cart + item.current.cart, adGmv: acc.adGmv + item.current.adGmv, adSpend: acc.adSpend + item.current.adSpend, actual: acc.actual + item.actualGmv, goal: acc.goal + item.config.goal }), { gmv: 0, previous: 0, orders: 0, exposure: 0, visitors: 0, cart: 0, adGmv: 0, adSpend: 0, actual: 0, goal: 0 });
  const totalRoi = total.adSpend > 0 ? total.actual / total.adSpend : 0;

  async function digest(value: string) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function unlock(event: FormEvent) {
    event.preventDefault();
    if ((await digest(password)) === PASSWORD_HASH) { sessionStorage.setItem("tw-sp-dashboard", "unlocked"); setUnlocked(true); setPasswordError(""); } else setPasswordError("密码不正确，请重新输入");
  }
  function resetFilters() { setBrand("ALL"); setProductId(""); setProduct(""); setCategory(""); }

  if (!unlocked) return <main className="gate"><section className="gate-card"><div className="gate-signal"><span /><span /><span /></div><p className="eyebrow">SALES & COST EFFICIENCY</p><h1>台湾线上<br />销售分析</h1><p className="gate-copy">聚焦 GMV、目标达成、费用效率和商品动销，支持品牌、日期范围、SKU码和产品名多维筛选。</p><form onSubmit={unlock}><label htmlFor="dashboard-password">访问密码</label><div className="password-row"><input id="dashboard-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入团队密码" /><button type="submit">进入看板</button></div>{passwordError && <p className="form-error">{passwordError}</p>}</form><p className="gate-note">数据来自每日更新的 Google Sheet · 轻量访问保护</p></section></main>;

  const currentPage = PAGE_LABELS.find((item) => item.key === page) || PAGE_LABELS[0];
  const comparisonLabel = `环比 ${rangeLabel(previousRange)}`;
  return <main className="dashboard">
    <div className="currency-note"><span>金额单位：人民币 CNY</span><small>源表 TWD 金额按运营口径 1 TWD = 0.21 CNY 换算；目标值保持人民币</small></div>
    <div className="dashboard-layout"><aside className="side-nav"><div className="side-brand"><span>TW / SP</span><b>品牌分析室</b></div><p className="side-label">看板入口</p><button className={brand === "ALL" && page === "overview" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("overview"); }}><strong>总览</strong><small>三品牌经营总览</small></button>{BRANDS.map((item) => <button key={item.key} style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} className={brand === item.key && page === "overview" ? "active" : ""} onClick={() => { setBrand(item.key); setPage("overview"); }}><strong>{item.key}</strong><small>{item.name}</small></button>)}<div className="side-divider" /><button className={page === "channels" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("channels"); }}><strong>线上 / 线下 SKU</strong><small>销量环比与差距</small></button></aside><div className="dashboard-content">
    <header className="topbar"><div><p className="eyebrow">SALES & COST EFFICIENCY</p><h1>台湾线上销售分析</h1><p className="subtitle">聚焦费用投入对 GMV 的影响 · SKT / G2G / TP · {rangeLabel(currentRange)} 对比 {rangeLabel(previousRange)}</p></div><button className="primary-button" onClick={() => setRefresh((value) => value + 1)}>＋ 更新销售数据</button></header>
    <section className="filter-bar"><div><label>品牌</label><select value={brand} onChange={(event) => setBrand(event.target.value as "ALL" | BrandKey)}><option value="ALL">全部品牌</option>{BRANDS.map((item) => <option value={item.key} key={item.key}>{item.key} · {item.name}</option>)}</select></div><div><label>主日期从</label><input type="date" value={currentRange.start} onChange={(event) => setCurrentRange((value) => ({ ...value, start: event.target.value }))} /></div><div><label>主日期到</label><input type="date" value={currentRange.end} onChange={(event) => setCurrentRange((value) => ({ ...value, end: event.target.value }))} /></div><div><label>环比日期从</label><input type="date" value={previousRange.start} onChange={(event) => setPreviousRange((value) => ({ ...value, start: event.target.value }))} /></div><div><label>环比日期到</label><input type="date" value={previousRange.end} onChange={(event) => setPreviousRange((value) => ({ ...value, end: event.target.value }))} /></div><div><label>商品ID / ID</label><input value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="输入商品ID / ID" /></div><div><label>产品名</label><input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="搜索产品名" /></div><div><label>品类</label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部品类</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></div><button className="reset-button" onClick={resetFilters}>重置筛选</button></section>
    <nav className="page-tabs">{PAGE_LABELS.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}><b>{item.number}</b><span>{item.label}</span><small>{item.note}</small></button>)}<span className="sync-state"><i className={error ? "error-dot" : ""} />{loading ? "同步中" : "数据已同步"}</span></nav>
    {error && <div className="data-alert"><b>数据同步失败</b><span>{error}</span><button onClick={() => setRefresh((value) => value + 1)}>重新同步</button></div>}
    {page === "channels" ? <section className="data-page channel-page"><div className="section-title"><span>07</span><div><h2>线上 / 线下 SKU 销量对比</h2><p>线上数据来自台湾线上 SKU 销量表；线下汇总三品牌各通路原始 SKU 销量。</p></div><em>{channelLoading ? "同步中" : `${channelData.rows.length} 个商品ID`}</em></div>{channelError && <div className="data-alert"><b>销量数据同步失败</b><span>{channelError}</span></div>}{channelLoading && channelData.rows.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步线上与线下 SKU 销量</strong><p>按主日期范围和环比日期范围汇总商品ID</p></div></div> : <ChannelTable rows={channelData.rows} brand={brand} />}</section> : loading && data.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步销售与广告数据</strong><p>读取三品牌的店铺、链接、商品ID和广告明细</p></div></div> : <>
      {page === "overview" && <>
        <section className="metric-grid"><MetricCard label="累计 GMV" value={formatMoney(total.gmv, true)} delta={ratio(total.gmv, total.previous)} note={`环比区间 ${formatMoney(total.previous, true)}`} color="#2364d8" /><MetricCard label="目标 GMV 达成" value={total.goal > 0 ? `${(total.gmv / total.goal * 100).toFixed(1)}%` : "—"} note={`目标 ${formatMoney(total.goal, true)}`} color="#ff766b" /><MetricCard label="综合费比" value={percent(total.gmv > 0 ? total.adSpend / total.gmv : null)} note="站内花费 / GMV" color="#1ba89c" /><MetricCard label="综合 ROI" value={rate(totalRoi)} note={`广告GMV ${formatMoney(total.adGmv, true)}`} color="#8d7bd8" /></section>
        <section className="metric-grid secondary"><MetricCard label="订单量" value={formatNumber(total.orders)} note={`客单价 ${formatMoney(total.orders > 0 ? total.gmv / total.orders : 0)}`} color="#2364d8" /><MetricCard label="曝光量" value={formatNumber(total.exposure)} note={`访客 ${formatNumber(total.visitors)}`} color="#ff766b" /><MetricCard label="加购量" value={formatNumber(total.cart)} note={`加购率 ${percent(total.visitors > 0 ? total.cart / total.visitors : 0)}`} color="#1ba89c" /><MetricCard label="广告GMV占比" value={percent(total.gmv > 0 ? total.adGmv / total.gmv : 0)} note={`自然GMV ${formatMoney(Math.max(0, total.gmv - total.adGmv), true)}`} color="#8d7bd8" /></section>
        <section className="brand-panels">{visible.map((item) => { const mom = ratio(item.current.gmv, item.previous.gmv); const share = total.gmv > 0 ? item.current.gmv / total.gmv : 0; const roi = item.current.adSpend > 0 ? item.actualGmv / item.current.adSpend : 0; const brandColor = BRAND_COLORS[item.config.key]; return <article className="brand-panel" style={{ "--brand-color": brandColor } as React.CSSProperties} key={item.config.key}><div className="panel-title"><b>{item.config.key}</b><span>{item.config.name}</span></div><div className="brand-main"><strong>{formatMoney(item.current.gmv, true)} GMV</strong><div><small>环比区间</small><b>{percent(mom)}</b></div></div><div className="brand-stats"><div><span>目标达成</span><b>{item.config.goal > 0 ? `${(item.current.gmv / item.config.goal * 100).toFixed(1)}%` : "—"}</b></div><div><span>品牌占比</span><b>{percent(share)}</b></div><div><span>综合ROI</span><b>{rate(roi)}</b></div></div><div className="brand-stats lower"><div><span>站内花费</span><b>{formatMoney(item.current.adSpend, true)}</b></div><div><span>广告GMV</span><b>{formatMoney(item.current.adGmv, true)}</b></div><div><span>自然GMV</span><b>{formatMoney(Math.max(0, item.current.gmv - item.current.adGmv), true)}</b></div><div><span>订单量</span><b>{formatNumber(item.current.orders)}</b></div></div><p>点击下方页面进入 {item.config.key} 的品类、链接和广告明细。</p></article>; })}</section>
        <Insight brands={visible} />
        <section className="comparison-panel"><div className="section-title"><span>01</span><div><h2>品牌每日销售与环比</h2><p>每个品牌一行：左侧比较本期 / 环比区间 GMV，右侧展示站内费比及变化。</p></div><em>{rangeLabel(currentRange)} · {rangeLabel(previousRange)}</em></div><div className="brand-daily-rows">{visible.map((item) => <DailyBrandRow key={item.config.key} item={item} comparisonLabel={comparisonLabel} currentRange={currentRange} previousRange={previousRange} />)}</div></section>
        {brand !== "ALL" && <>
          <section className="data-page"><div className="section-title"><span>02</span><div><h2>{brand} · 品类进度</h2><p>通过匹配表的商品ID补齐产品与类目。</p></div><em>{rowsFor("category").length} 条明细</em></div><Table rows={rowsFor("category")} type="category" /></section>
          <section className="data-page"><div className="section-title"><span>04</span><div><h2>{brand} · 链接明细</h2><p>以商品ID / ID为关联主键。</p></div><em>{rowsFor("link").length} 条明细</em></div><Table rows={rowsFor("link")} type="link" /></section>
          <section className="data-page"><div className="section-title"><span>06</span><div><h2>{brand} · 广告数据</h2><p>站内花费、广告GMV与投放效率。</p></div><em>{rowsFor("ads").length} 条明细</em></div><Table rows={rowsFor("ads")} type="ads" /></section>
        </>}
      </>}
      {page !== "overview" && page !== "channels" && <section className="data-page"><div className="section-title"><span>{currentPage.number}</span><div><h2>{currentPage.label}</h2><p>{currentPage.note} · 已应用品牌、日期范围、商品ID、产品名和品类筛选。</p></div><em>{visible.reduce((sum, item) => sum + (page === "category" ? item.category.length : page === "link" ? item.links.length : item.ads.length), 0)} 条明细</em></div><Table rows={rowsFor(page)} type={page} /></section>}
    </>}
    <footer><span>数据源：台湾 SP 三品牌数据表</span><span>站外投放字段预留 · 站内广告 ROI = 广告归因 GMV / 站内花费</span></footer>
    </div></div>
  </main>;
}
