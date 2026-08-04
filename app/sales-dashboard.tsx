"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const DEFAULT_TWD_TO_CNY = 0.21;
const PASSWORD_HASH =
  "04155b15a8f39ef5739243f83ea8350c4394a2b630f2af8c26cc4972af72c21c";
const csvInFlight = new Map<string, Promise<string[][]>>();

type BrandKey = "SKT" | "G2G" | "TP";
type PageKey = "overview" | "category" | "shops" | "link" | "offsite" | "ads" | "channels";
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
  shopGid: number;
  shopDate: string;
  shopGmv: string;
  shopOrders: string;
  linkSheet: string;
  linkGid: number;
  adsSheet: string;
  adsGid: number;
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
  dmsGid: number;
  dmsDate: string;
  dmsGmv: string;
  dmsVoucher: string;
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
  previousActualGmv: number;
  voucherShopee: number;
  previousVoucherShopee: number;
};

type DateRange = { start: string; end: string };

type ChannelSkuRow = {
  key: string;
  brand: BrandKey;
  id: string;
  product: string;
  spu: string;
  category: string;
  online: number;
  onlinePrevious: number;
  offline: number;
  offlinePrevious: number;
};

type ChannelRollupRow = {
  key: string;
  brand: BrandKey;
  category: string;
  online: number;
  onlinePrevious: number;
  offline: number;
  offlinePrevious: number;
};

type ChannelProductMapRow = {
  brand: BrandKey;
  category: string;
  sku: string;
  spu: string;
  product: string;
};

type ChannelSpuRow = {
  key: string;
  brand: BrandKey;
  category: string;
  spu: string;
  product: string;
  skuCount: number;
  children: ChannelSkuRow[];
  online: number;
  onlinePrevious: number;
  offline: number;
  offlinePrevious: number;
};

type ChannelData = { rows: ChannelSkuRow[] };
type ShopDailyRow = {
  brand: BrandKey;
  date: string;
  sales: number;
  orders: number;
  pageviews: number;
  visitors: number;
  buyers: number;
  newBuyers: number;
};
type ShopMetric = Omit<ShopDailyRow, "brand" | "date"> & { conversion: number | null; aov: number | null };
type ShopMetricKey = "sales" | "visitors" | "buyers" | "newBuyers" | "conversion" | "aov";
type ShopDailyConfig = { brand: BrandKey; sheet: string; date: string; sales: string; orders: string; pageviews: string; visitors: string; buyers: string; newBuyers: string };
type OffsiteConfig = { brand: BrandKey; spreadsheetId: string; gid: number; sheet: string; date: string; spend: string; impressions: string; clicks: string; purchaseValue: string; productName: string; category: string; typeColumns: string[] };
type OffsiteMapRecord = { brand: BrandKey; id: string; link: string; category: string };
type OffsiteApiRow = {
  brand: BrandKey;
  link_id?: string;
  link_name?: string;
  category?: string;
  spend?: number | string;
  impressions?: number | string;
  clicks?: number | string;
  purchase_value?: number | string;
  co_create_spend?: number | string;
  graphic_spend?: number | string;
  brand_ad_spend?: number | string;
};
type OffsiteRow = {
  key: string;
  brand: BrandKey;
  id: string;
  category: string;
  link: string;
  linkGmv: number | null;
  previousLinkGmv: number | null;
  linkVisitors: number | null;
  previousLinkVisitors: number | null;
  spend: number;
  previousSpend: number;
  impressions: number;
  previousImpressions: number;
  clicks: number;
  previousClicks: number;
  purchaseValue: number;
  previousPurchaseValue: number;
  coCreateSpend: number;
  previousCoCreateSpend: number;
  graphicSpend: number;
  previousGraphicSpend: number;
  brandAdSpend: number;
  previousBrandAdSpend: number;
};
type OffsiteSpendSummary = {
  spend: number;
  previousSpend: number;
  clicks: number;
  previousClicks: number;
};
const FALLBACK_CATEGORY = "其他/赠品";

const PAGE_LABELS: Array<{ key: PageKey; label: string; note: string; number: string }> = [
  { key: "overview", label: "品牌总览", note: "经营结果与效率", number: "01" },
  { key: "category", label: "品类进度", note: "品类贡献与转化", number: "02" },
  { key: "shops", label: "店铺维度", note: "访客、买家与转化趋势", number: "03" },
  { key: "link", label: "链接明细", note: "商品链接经营", number: "04" },
  { key: "offsite", label: "站外广告数据", note: "站外投放与链接经营", number: "05" },
  { key: "ads", label: "广告数据", note: "站内投放效率", number: "06" },
  { key: "channels", label: "线上 / 线下 SKU", note: "销量差距与环比", number: "07" },
];

const SHOP_DAILY_CONFIGS: ShopDailyConfig[] = [
  { brand: "SKT", sheet: "SKT-店铺维度每日", date: "B", sales: "C", orders: "D", pageviews: "F", visitors: "G", buyers: "M", newBuyers: "N" },
  { brand: "G2G", sheet: "G2G-店鋪維度每日", date: "A", sales: "B", orders: "C", pageviews: "E", visitors: "F", buyers: "L", newBuyers: "M" },
  { brand: "TP", sheet: "TP-店鋪維度每日", date: "A", sales: "B", orders: "C", pageviews: "E", visitors: "F", buyers: "L", newBuyers: "M" },
];

const ONLINE_SKU_SHEET_ID = SHEET_ID;
const ONLINE_SKU_SHEET_NAME = "三品牌SKU銷量";
const ONLINE_SKU_SHEET_GID = 1699578973;
const OFFSITE_PRODUCT_MAP_SHEET_ID = "1f77vjXSXYPRo531hdNoS_BWdNBqzNwcLW-56TF8IcFw";
const OFFSITE_PRODUCT_MAP_GID = 1697343653;
const OFFSITE_API_URL = "https://tw-offsite-api-26k2ltlrsq-de.a.run.app";
const MAPPING_GID = 1668472749;
const MAINTAINED_MAPPING_GID = 305051712;
const OFFSITE_CONFIGS: OffsiteConfig[] = [
  { brand: "G2G", spreadsheetId: "1ptzr5wSndXdxAG3kCUvIJ9rhTDz5-SYdG0Rd8rFcsYk", gid: 0, sheet: "2025广告数据源", date: "D", spend: "E", impressions: "F", clicks: "G", purchaseValue: "I", productName: "AC", category: "AD", typeColumns: ["N", "R", "U", "V", "W", "Y", "Z", "AE", "AF"] },
  { brand: "SKT", spreadsheetId: "1gt-oypX44RAr2Kis-pdfXfa0k-UbVNeZAg1zIcGwBs4", gid: 702107027, sheet: "广告数据源汇总", date: "I", spend: "C", impressions: "D", clicks: "E", purchaseValue: "F", productName: "Z", category: "Y", typeColumns: ["O", "R", "X", "Y", "AA"] },
  { brand: "TP", spreadsheetId: "1ZEvZNIULKovBaGvXC3v6jeIl_l5VDlXWkI4RhLPd7kg", gid: 1346236884, sheet: "广告数据源", date: "A", spend: "F", impressions: "K", clicks: "L", purchaseValue: "G", productName: "Y", category: "Z", typeColumns: ["O", "R", "U", "X"] },
];

const sheetUrl = (spreadsheetId: string, gid?: number | string) =>
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${gid === undefined ? "" : `?gid=${gid}#gid=${gid}`}`;

const DATA_SOURCE_GROUPS = [
  {
    title: "销售经营",
    items: [
      { label: "三品牌销售源表", detail: "店铺 / 链接 / 站内广告 / DMS", href: sheetUrl(SHEET_ID) },
      { label: "产品 / 品类 / SPU 匹配", detail: "链接ID、链接简称、品类归属", href: sheetUrl(OFFSITE_PRODUCT_MAP_SHEET_ID, 0) },
      { label: "站外产品 map", detail: "FB产品名、链接简称、链接ID", href: sheetUrl(OFFSITE_PRODUCT_MAP_SHEET_ID, OFFSITE_PRODUCT_MAP_GID) },
    ],
  },
  {
    title: "SKU 销量",
    items: [
      { label: "台湾线上 SKU", detail: "线上销量源表", href: sheetUrl(ONLINE_SKU_SHEET_ID, ONLINE_SKU_SHEET_GID) },
      { label: "线下 SKU 汇总", detail: "看板实际读取 CSV", href: "/offline_sku_sales.csv" },
      { label: "线下原始表 1", detail: "原始线下销量", href: sheetUrl("1xEBYyD6q0rv2NNv2Ws7vJ5fKg4ZLbk6RCEoHeUsEqFE", 785032278) },
      { label: "线下原始表 2", detail: "原始线下销量", href: sheetUrl("1d9tjvyVicHVN5Eb1CdLBOIV-V3O8YzWK7s5YUB33CLU", 1734680924) },
      { label: "线下原始表 3", detail: "原始线下销量", href: sheetUrl("16BHn3Lm1wP7ueh89Xb2Z6x4xYOFMX5p34wHZyz8xgdk", 1001308640) },
    ],
  },
  {
    title: "站外广告",
    items: [
      ...OFFSITE_CONFIGS.map((item) => ({ label: `${item.brand} 站外投放`, detail: `gid ${item.gid}`, href: sheetUrl(item.spreadsheetId, item.gid) })),
      { label: "站外 API 检查", detail: "看板读取接口", href: `${OFFSITE_API_URL}/health` },
    ],
  },
  {
    title: "数据仓库",
    items: [
      { label: "BigQuery · id-g2g.tw", detail: "raw_offsite_* / product_map / offsite_*", href: "https://console.cloud.google.com/bigquery?project=id-g2g" },
      { label: "Google Cloud 项目", detail: "id-g2g", href: "https://console.cloud.google.com/welcome?project=id-g2g" },
    ],
  },
];

const BRANDS: BrandConfig[] = [
  {
    key: "SKT",
    name: "SKINTIFIC",
    goal: 2_500_000,
    shopSheet: "SKT-店铺维度每日",
    shopGid: 1296056613,
    shopDate: "B",
    shopGmv: "C",
    shopOrders: "D",
    linkSheet: "SKT-店铺链接维度每日",
    linkGid: 1109512359,
    adsSheet: "SKT-站内广告每日",
    adsGid: 1227209277,
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
    dmsGid: 0,
    dmsDate: "A",
    dmsGmv: "J",
    dmsVoucher: "T",
  },
  {
    key: "G2G",
    name: "GLAD2GLOW",
    goal: 1_540_000,
    shopSheet: "G2G-店鋪維度每日",
    shopGid: 651661997,
    shopDate: "A",
    shopGmv: "B",
    shopOrders: "C",
    linkSheet: "G2G-店鋪鏈接維度每日",
    linkGid: 870428229,
    adsSheet: "G2G-站内廣告每日",
    adsGid: 1775304605,
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
    dmsGid: 1812440936,
    dmsDate: "A",
    dmsGmv: "I",
    dmsVoucher: "S",
  },
  {
    key: "TP",
    name: "TIME PHORIA",
    goal: 460_000,
    shopSheet: "TP-店鋪維度每日",
    shopGid: 501805468,
    shopDate: "A",
    shopGmv: "B",
    shopOrders: "C",
    linkSheet: "TP-店鋪鏈接維度每日",
    linkGid: 22105621,
    adsSheet: "TP-站内廣告每日",
    adsGid: 1379096797,
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
    dmsGid: 1661028147,
    dmsDate: "A",
    dmsGmv: "E",
    dmsVoucher: "O",
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

function normalizeLookupText(value: string) {
  return normalizeCategory(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·・\-—_/｜|（）()［\][\]【】「」"'“”]/g, "");
}

function indexOffsiteProductMap(rows: string[][]) {
  const byName = new Map<BrandKey, Map<string, OffsiteMapRecord>>();
  BRANDS.forEach((item) => byName.set(item.key, new Map()));
  const blocks = [
    { brandColumn: "A", idColumn: "B", linkColumn: "C", categoryColumn: "D", aliasColumn: "" },
    { brandColumn: "F", idColumn: "G", linkColumn: "H", categoryColumn: "I", aliasColumn: "" },
    { brandColumn: "K", idColumn: "L", linkColumn: "M", categoryColumn: "N", aliasColumn: "O" },
  ];
  const put = (brand: BrandKey, name: string, record: OffsiteMapRecord) => {
    const normalized = normalizeLookupText(name);
    if (normalized) byName.get(brand)?.set(normalized, record);
  };
  rows.slice(1).forEach((row) => {
    blocks.forEach((block) => {
      const brand = brandFromValue(csvStringAt(row, block.brandColumn));
      const id = normalizeId(csvStringAt(row, block.idColumn));
      const link = csvStringAt(row, block.linkColumn);
      if (!brand || !link || id === "未填写") return;
      const record = { brand, id, link, category: normalizeCategory(csvStringAt(row, block.categoryColumn) || FALLBACK_CATEGORY) };
      put(brand, link, record);
      if (block.aliasColumn) put(brand, csvStringAt(row, block.aliasColumn), record);
    });
  });
  return byName;
}

function findOffsiteMapRecord(map: Map<BrandKey, Map<string, OffsiteMapRecord>>, brand: BrandKey, name: string) {
  const normalized = normalizeLookupText(name);
  const brandMap = map.get(brand);
  if (!normalized || !brandMap) return null;
  const exact = brandMap.get(normalized);
  if (exact) return exact;
  for (const [key, value] of brandMap.entries()) {
    if (key.length >= 3 && (normalized.includes(key) || key.includes(normalized))) return value;
  }
  return null;
}

function classifyOffsiteSpend(row: string[], config: OffsiteConfig) {
  const text = config.typeColumns.map((column) => csvStringAt(row, column)).join(" ");
  if (/品牌/.test(text)) return "brand";
  if (/图文|圖文/.test(text)) return "graphic";
  if (/合创|合創|kol/i.test(text)) return "coCreate";
  return "graphic";
}

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

function parseCsvMatrix(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cellValue) => cellValue.trim()));
}

async function loadSheetCsv(gid: number, spreadsheetId = SHEET_ID) {
  const key = `${spreadsheetId}:${gid}`;
  if (csvInFlight.has(key)) return csvInFlight.get(key)!;
  const promise = fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Google Sheets CSV ${response.status}`);
      return parseCsvMatrix(await response.text());
    })
    .finally(() => csvInFlight.delete(key));
  csvInFlight.set(key, promise);
  return promise;
}

function gvizRowsToCsvMatrix(rows: GvizRow[], columns: string[]) {
  const width = Math.max(...columns.map(columnIndex)) + 1;
  return [Array(width).fill(""), ...rows.map((row) => {
    const output = Array(width).fill("");
    columns.forEach((column, index) => {
      const cell = row.c?.[index];
      output[columnIndex(column)] = String(cell?.v ?? cell?.f ?? "");
    });
    return output;
  })];
}

async function loadOffsiteSourceRows(config: OffsiteConfig, start: string, end: string) {
  const columns = [...new Set([config.date, config.spend, config.impressions, config.clicks, config.purchaseValue, config.productName, config.category, ...config.typeColumns])];
  const rows = await querySheet(config.sheet, `select ${columns.join(",")} where ${dateWhere(config.date, start, end)}`, config.spreadsheetId);
  return gvizRowsToCsvMatrix(rows, columns);
}

async function loadOffsiteProductMapRows() {
  const blocks = [
    { columns: ["A", "B", "C", "D"], linkColumn: "C" },
    { columns: ["F", "G", "H", "I"], linkColumn: "H" },
    { columns: ["K", "L", "M", "N", "O"], linkColumn: "M" },
  ];
  const result = [Array(15).fill("")];
  const blockRows = await Promise.all(blocks.map((block) => querySheet("产品map", `select ${block.columns.join(",")} where ${block.linkColumn} is not null`, OFFSITE_PRODUCT_MAP_SHEET_ID)));
  blockRows.forEach((rows, blockIndex) => {
    const columns = blocks[blockIndex].columns;
    gvizRowsToCsvMatrix(rows, columns).slice(1).forEach((row) => result.push(row));
  });
  return result;
}

function columnIndex(column: string) {
  return column.toUpperCase().split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function csvStringAt(row: string[] | undefined, column: string) {
  return String(row?.[columnIndex(column)] ?? "").trim();
}

function csvNumberAt(row: string[] | undefined, column: string) {
  const raw = csvStringAt(row, column).replace(/[,%\s]/g, "");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function rowFromValues(values: unknown[]): GvizRow {
  return { c: values.map((value) => ({ v: value })) };
}

function csvRowsInRange(rows: string[][], dateColumn: string, start: string, end: string) {
  return rows.slice(1).filter((row) => {
    const date = normalizeDateKey(csvStringAt(row, dateColumn));
    return date >= start && date <= end;
  });
}

function csvMetricRows(rows: string[][], dateColumn: string, start: string, end: string, groupColumns: string[] = []) {
  const metricColumns = ["K", "R", "M", "N", "AD", "AH", "AK", "T"];
  const groups = new Map<string, { dimensions: string[]; values: number[] }>();
  csvRowsInRange(rows, dateColumn, start, end).forEach((row) => {
    const dimensions = groupColumns.map((column) => csvStringAt(row, column));
    const key = dimensions.join("\u0001") || "__all__";
    const group = groups.get(key) || { dimensions, values: Array(metricColumns.length).fill(0) };
    metricColumns.forEach((column, index) => {
      group.values[index] += csvNumberAt(row, column);
    });
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => rowFromValues([...group.dimensions, ...group.values]));
}

function csvDailyRows(rows: string[][], dateColumn: string, gmvColumn: string, ordersColumn: string, start: string, end: string) {
  const groups = new Map<string, { gmv: number; orders: number }>();
  csvRowsInRange(rows, dateColumn, start, end).forEach((row) => {
    const date = normalizeDateKey(csvStringAt(row, dateColumn));
    const group = groups.get(date) || { gmv: 0, orders: 0 };
    group.gmv += csvNumberAt(row, gmvColumn);
    group.orders += csvNumberAt(row, ordersColumn);
    groups.set(date, group);
  });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => rowFromValues([date, value.gmv, value.orders]));
}

function csvDailyGmvRows(rows: string[][], dateColumn: string, gmvColumn: string, start: string, end: string) {
  const groups = new Map<string, number>();
  csvRowsInRange(rows, dateColumn, start, end).forEach((row) => {
    const date = normalizeDateKey(csvStringAt(row, dateColumn));
    groups.set(date, (groups.get(date) || 0) + csvNumberAt(row, gmvColumn));
  });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, gmv]) => rowFromValues([date, gmv, 0]));
}

function csvAdsAggRows(rows: string[][], config: BrandConfig, start: string, end: string) {
  const totals = [0, 0, 0, 0, 0];
  csvRowsInRange(rows, config.adsDate, start, end).forEach((row) => {
    [config.adsGmv, config.adsSpend, config.adsExposure, config.adsClicks, config.adsConversions].forEach((column, index) => {
      totals[index] += csvNumberAt(row, column);
    });
  });
  return [rowFromValues(totals)];
}

function csvAdsDetailRows(rows: string[][], config: BrandConfig, start: string, end: string) {
  const groups = new Map<string, { dimensions: string[]; values: number[] }>();
  csvRowsInRange(rows, config.adsDate, start, end).forEach((row) => {
    const dimensions = [csvStringAt(row, config.adsProduct), csvStringAt(row, config.adsCategory), normalizeId(csvStringAt(row, config.adsId))];
    const key = dimensions.join("\u0001");
    const group = groups.get(key) || { dimensions, values: [0, 0, 0, 0, 0] };
    [config.adsGmv, config.adsSpend, config.adsExposure, config.adsClicks, config.adsConversions].forEach((column, index) => {
      group.values[index] += csvNumberAt(row, column);
    });
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => rowFromValues([...group.dimensions, ...group.values]));
}

function csvSumRow(rows: string[][], dateColumn: string, valueColumn: string, start: string, end: string) {
  const total = csvRowsInRange(rows, dateColumn, start, end).reduce((sum, row) => sum + csvNumberAt(row, valueColumn), 0);
  return [rowFromValues([total])];
}

function csvSelectRows(rows: string[][], columns: string[], requiredColumn: string) {
  return rows.slice(1)
    .filter((row) => csvStringAt(row, requiredColumn))
    .map((row) => rowFromValues(columns.map((column) => csvStringAt(row, column))));
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
  const monthDay = value.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (monthDay) {
    const currentYear = new Date().getFullYear();
    return isoDate(currentYear, Number(monthDay[1]), Number(monthDay[2]));
  }
  return value;
}

function shopRowsInRange(rows: ShopDailyRow[], range: DateRange) {
  return rows.filter((row) => row.date >= range.start && row.date <= range.end);
}

function aggregateShopRows(rows: ShopDailyRow[]): ShopMetric {
  const total = rows.reduce((acc, row) => ({
    sales: acc.sales + row.sales,
    orders: acc.orders + row.orders,
    pageviews: acc.pageviews + row.pageviews,
    visitors: acc.visitors + row.visitors,
    buyers: acc.buyers + row.buyers,
    newBuyers: acc.newBuyers + row.newBuyers,
  }), { sales: 0, orders: 0, pageviews: 0, visitors: 0, buyers: 0, newBuyers: 0 });
  return {
    ...total,
    conversion: total.pageviews > 0 ? total.orders / total.pageviews : null,
    aov: total.orders > 0 ? total.sales / total.orders : null,
  };
}

async function loadShopDailyData(range: DateRange) {
  const rows = await Promise.all(SHOP_DAILY_CONFIGS.map(async (config) => {
    const columns = [config.date, config.sales, config.orders, config.pageviews, config.visitors, config.buyers, config.newBuyers];
    const query = `select ${columns.join(",")} where ${config.date} >= date '${range.start}' and ${config.date} <= date '${range.end}'`;
    const result = await querySheet(config.sheet, query);
    return result.map((row): ShopDailyRow => ({
      brand: config.brand,
      date: normalizeDateKey(stringAt(row, 0)),
      sales: numberAt(row, 1) * DEFAULT_TWD_TO_CNY,
      orders: numberAt(row, 2),
      pageviews: numberAt(row, 3),
      visitors: numberAt(row, 4),
      buyers: numberAt(row, 5),
      newBuyers: numberAt(row, 6),
    })).filter((row) => row.date >= range.start && row.date <= range.end);
  }));
  return rows.flat();
}

function defaultCurrentRange(): DateRange {
  const now = new Date();
  const lastCompletedDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return {
    start: isoDate(lastCompletedDay.getFullYear(), lastCompletedDay.getMonth() + 1, 1),
    end: isoDate(lastCompletedDay.getFullYear(), lastCompletedDay.getMonth() + 1, lastCompletedDay.getDate()),
  };
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
  const mappingColumns = config.key === "SKT" ? ["E", "F", "G"] : config.key === "G2G" ? ["R", "S", "T"] : ["X", "Y", "Z"];
  const [shopRows, linkRows, adsRows, dmsRows, mappingCsvRows, maintainedCsvRows] = await Promise.all([
    loadSheetCsv(config.shopGid),
    loadSheetCsv(config.linkGid),
    loadSheetCsv(config.adsGid),
    loadSheetCsv(config.dmsGid),
    loadSheetCsv(MAPPING_GID),
    loadSheetCsv(MAINTAINED_MAPPING_GID),
  ]);
  const dailyRows = csvDailyGmvRows(dmsRows, config.dmsDate, config.dmsGmv, period.start, period.end);
  const prevDailyRows = csvDailyGmvRows(dmsRows, config.dmsDate, config.dmsGmv, previousPeriod.start, previousPeriod.end);
  const currentAll = csvMetricRows(linkRows, "B", period.start, period.end);
  const prevAll = csvMetricRows(linkRows, "B", previousPeriod.start, previousPeriod.end);
  const currentLinks = csvMetricRows(linkRows, "B", period.start, period.end, ["C", "D"]);
  const prevLinks = csvMetricRows(linkRows, "B", previousPeriod.start, previousPeriod.end, ["C", "D"]);
  const adsAgg = csvAdsAggRows(adsRows, config, period.start, period.end);
  const adsPrev = csvAdsAggRows(adsRows, config, previousPeriod.start, previousPeriod.end);
  const adsDetail = csvAdsDetailRows(adsRows, config, period.start, period.end);
  const adsPrevDetail = csvAdsDetailRows(adsRows, config, previousPeriod.start, previousPeriod.end);
  const dms = csvSumRow(dmsRows, config.dmsDate, config.dmsGmv, period.start, period.end);
  const previousDms = csvSumRow(dmsRows, config.dmsDate, config.dmsGmv, previousPeriod.start, previousPeriod.end);
  const dmsVoucher = csvSumRow(dmsRows, config.dmsDate, config.dmsVoucher, period.start, period.end);
  const previousDmsVoucher = csvSumRow(dmsRows, config.dmsDate, config.dmsVoucher, previousPeriod.start, previousPeriod.end);
  const mappingRows = csvSelectRows(mappingCsvRows, mappingColumns, mappingColumns[0]);
  const maintainedMappingRows = csvSelectRows(maintainedCsvRows, ["A", "B", "C", "D"], "B");

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
      const prevAd = previousAdMap.get(id) || [];
      const prev = previousMap.get(id) || [];
      return metricFromValues(
        config.key,
        `link-${id}-${index}`,
        [...row.values, ad[0] || 0, ad[1] || 0, ad[2] || 0, ad[3] || 0, ad[4] || 0],
        dimensions,
        [...prev, prevAd[0] || 0, prevAd[1] || 0, prevAd[2] || 0, prevAd[3] || 0, prevAd[4] || 0],
        exchangeRate,
      );
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
    previousActualGmv: numberAt(previousDms[0], 0) * exchangeRate,
    voucherShopee: numberAt(dmsVoucher[0], 0) * exchangeRate,
    previousVoucherShopee: numberAt(previousDmsVoucher[0], 0) * exchangeRate,
  } satisfies BrandData;
}

async function loadOffsiteData(period: DateRange, previousPeriod: DateRange, brands: BrandData[], exchangeRate = DEFAULT_TWD_TO_CNY) {
  try {
    const fetchRows = async (range: DateRange) => {
      const url = new URL(`${OFFSITE_API_URL}/offsite`);
      url.searchParams.set("start", range.start);
      url.searchParams.set("end", range.end);
      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { rows?: OffsiteApiRow[]; error?: string; detail?: string } | null;
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "BigQuery 站外广告接口读取失败");
      return payload?.rows || [];
    };
    const [currentRows, previousRows] = await Promise.all([fetchRows(period), fetchRows(previousPeriod)]);
    if (currentRows.length === 0) throw new Error("站外 API 当前区间无数据，改读 Google Sheet");
    const linkById = new Map<string, MetricRow>();
    const linkByName = new Map<string, MetricRow>();
    brands.forEach((brandData) => {
      brandData.links.forEach((link) => {
        if (link.id) linkById.set(`${link.brand}:${normalizeId(link.id)}`, link);
        [link.link, link.product].filter(Boolean).forEach((name) => linkByName.set(`${link.brand}:${normalizeLookupText(name)}`, link));
      });
    });
    const toNumber = (value: number | string | undefined) => (typeof value === "number" ? value : Number(value || 0)) || 0;
    const cleanText = (value: string | undefined) => {
      const text = (value || "").trim();
      return text && text !== "/" && text !== "-" ? text : "";
    };
    const groups = new Map<string, OffsiteRow>();
    currentRows.forEach((row, rowIndex) => {
      const brand = row.brand;
      const sourceName = cleanText(row.link_name);
      const isMixed = /混合目录|混合目錄/i.test(sourceName);
      const rawId = cleanText(row.link_id);
      const id = rawId ? normalizeId(rawId) : "";
      const linkFromSales = id ? linkById.get(`${brand}:${id}`) : linkByName.get(`${brand}:${normalizeLookupText(sourceName)}`);
      const link = isMixed ? "混合目录" : sourceName || linkFromSales?.product || "未填写";
      const category = isMixed ? "" : normalizeCategory(cleanText(row.category) || linkFromSales?.category || FALLBACK_CATEGORY);
      const key = `${brand}:${isMixed ? "mixed" : id || normalizeLookupText(link) || normalizeLookupText(sourceName) || `row-${rowIndex}`}`;
      const existing = groups.get(key) || {
        key,
        brand,
        id,
        category,
        link,
        linkGmv: isMixed ? null : linkFromSales?.gmv ?? null,
        previousLinkGmv: isMixed ? null : linkFromSales?.previousGmv ?? null,
        linkVisitors: isMixed ? null : linkFromSales?.visitors ?? null,
        previousLinkVisitors: isMixed ? null : linkFromSales?.previousVisitors ?? null,
        spend: 0,
        previousSpend: 0,
        impressions: 0,
        previousImpressions: 0,
        clicks: 0,
        previousClicks: 0,
        purchaseValue: 0,
        previousPurchaseValue: 0,
        coCreateSpend: 0,
        previousCoCreateSpend: 0,
        graphicSpend: 0,
        previousGraphicSpend: 0,
        brandAdSpend: 0,
        previousBrandAdSpend: 0,
      };
      existing.spend += toNumber(row.spend);
      existing.impressions += toNumber(row.impressions);
      existing.clicks += toNumber(row.clicks);
      existing.purchaseValue += toNumber(row.purchase_value);
      existing.coCreateSpend += toNumber(row.co_create_spend);
      existing.graphicSpend += toNumber(row.graphic_spend);
      existing.brandAdSpend += toNumber(row.brand_ad_spend);
      if (!existing.id && id) existing.id = id;
      if (!existing.category && category) existing.category = category;
      if (existing.linkGmv === null && !isMixed && linkFromSales) existing.linkGmv = linkFromSales.gmv;
      if (existing.previousLinkGmv === null && !isMixed && linkFromSales) existing.previousLinkGmv = linkFromSales.previousGmv;
      if (existing.linkVisitors === null && !isMixed && linkFromSales) existing.linkVisitors = linkFromSales.visitors;
      if (existing.previousLinkVisitors === null && !isMixed && linkFromSales) existing.previousLinkVisitors = linkFromSales.previousVisitors;
      groups.set(key, existing);
    });
    previousRows.forEach((row, rowIndex) => {
      const brand = row.brand;
      const sourceName = cleanText(row.link_name);
      const isMixed = /混合目录|混合目錄/i.test(sourceName);
      const rawId = cleanText(row.link_id);
      const id = rawId ? normalizeId(rawId) : "";
      const linkFromSales = id ? linkById.get(`${brand}:${id}`) : linkByName.get(`${brand}:${normalizeLookupText(sourceName)}`);
      const link = isMixed ? "混合目录" : sourceName || linkFromSales?.product || "未填写";
      const category = isMixed ? "" : normalizeCategory(cleanText(row.category) || linkFromSales?.category || FALLBACK_CATEGORY);
      const key = `${brand}:${isMixed ? "mixed" : id || normalizeLookupText(link) || normalizeLookupText(sourceName) || `row-${rowIndex}`}`;
      const existing = groups.get(key) || {
        key,
        brand,
        id,
        category,
        link,
        linkGmv: isMixed ? null : linkFromSales?.gmv ?? null,
        previousLinkGmv: isMixed ? null : linkFromSales?.previousGmv ?? null,
        linkVisitors: isMixed ? null : linkFromSales?.visitors ?? null,
        previousLinkVisitors: isMixed ? null : linkFromSales?.previousVisitors ?? null,
        spend: 0,
        previousSpend: 0,
        impressions: 0,
        previousImpressions: 0,
        clicks: 0,
        previousClicks: 0,
        purchaseValue: 0,
        previousPurchaseValue: 0,
        coCreateSpend: 0,
        previousCoCreateSpend: 0,
        graphicSpend: 0,
        previousGraphicSpend: 0,
        brandAdSpend: 0,
        previousBrandAdSpend: 0,
      };
      existing.previousSpend += toNumber(row.spend);
      existing.previousImpressions += toNumber(row.impressions);
      existing.previousClicks += toNumber(row.clicks);
      existing.previousPurchaseValue += toNumber(row.purchase_value);
      existing.previousCoCreateSpend += toNumber(row.co_create_spend);
      existing.previousGraphicSpend += toNumber(row.graphic_spend);
      existing.previousBrandAdSpend += toNumber(row.brand_ad_spend);
      if (!existing.id && id) existing.id = id;
      if (!existing.category && category) existing.category = category;
      if ((!existing.link || existing.link === "未填写") && link) existing.link = link;
      if (existing.linkGmv === null && !isMixed && linkFromSales) existing.linkGmv = linkFromSales.gmv;
      if (existing.previousLinkGmv === null && !isMixed && linkFromSales) existing.previousLinkGmv = linkFromSales.previousGmv;
      if (existing.linkVisitors === null && !isMixed && linkFromSales) existing.linkVisitors = linkFromSales.visitors;
      if (existing.previousLinkVisitors === null && !isMixed && linkFromSales) existing.previousLinkVisitors = linkFromSales.previousVisitors;
      groups.set(key, existing);
    });
    return [...groups.values()].sort((left, right) => (right.spend - left.spend) || (right.previousSpend - left.previousSpend));
  } catch (error) {
    console.warn("站外 API 无法覆盖当前区间，改读 Google Sheet", error);
  }
  const sourceStart = previousPeriod.start < period.start ? previousPeriod.start : period.start;
  const sourceEnd = previousPeriod.end > period.end ? previousPeriod.end : period.end;
  const [productMapRows, ...sourceRows] = await Promise.all([
    loadOffsiteProductMapRows().catch((error) => {
      console.warn("站外产品映射读取失败，继续使用源表名称", error);
      return [Array(15).fill("")];
    }),
    ...OFFSITE_CONFIGS.map((config) => loadOffsiteSourceRows(config, sourceStart, sourceEnd).catch((error) => {
      console.warn(`${config.brand} 站外源表读取失败`, error);
      return [Array(1).fill("")];
    })),
  ]);
  const productMap = indexOffsiteProductMap(productMapRows);
  const linkById = new Map<string, MetricRow>();
  const linkByName = new Map<string, MetricRow>();
  brands.forEach((brandData) => {
    brandData.links.forEach((link) => {
      if (link.id) linkById.set(`${link.brand}:${normalizeId(link.id)}`, link);
      const names = [link.link, link.product].filter(Boolean);
      names.forEach((name) => linkByName.set(`${link.brand}:${normalizeLookupText(name)}`, link));
    });
  });
  const groups = new Map<string, OffsiteRow>();
  const addSheetRange = (range: DateRange, previous: boolean) => {
    OFFSITE_CONFIGS.forEach((config, configIndex) => {
      csvRowsInRange(sourceRows[configIndex], config.date, range.start, range.end).forEach((row, rowIndex) => {
        const sourceName = csvStringAt(row, config.productName) || csvStringAt(row, config.category) || "未填写";
        const isMixed = /混合目录|混合目錄/i.test(sourceName);
        const mapped = isMixed ? null : findOffsiteMapRecord(productMap, config.brand, sourceName);
        const id = mapped?.id || "";
        const linkFromSales = id ? linkById.get(`${config.brand}:${id}`) : linkByName.get(`${config.brand}:${normalizeLookupText(sourceName)}`);
        const link = isMixed ? "混合目录" : mapped?.link || linkFromSales?.product || sourceName;
        const category = isMixed ? "" : mapped?.category || linkFromSales?.category || normalizeCategory(csvStringAt(row, config.category) || FALLBACK_CATEGORY);
        const key = `${config.brand}:${isMixed ? "mixed" : id || normalizeLookupText(link) || rowIndex}`;
        const spend = csvNumberAt(row, config.spend);
        const impressions = csvNumberAt(row, config.impressions);
        const clicks = csvNumberAt(row, config.clicks);
        const purchaseValue = csvNumberAt(row, config.purchaseValue);
        const type = classifyOffsiteSpend(row, config);
        const existing = groups.get(key) || {
          key,
          brand: config.brand,
          id,
          category,
          link,
          linkGmv: isMixed ? null : linkFromSales?.gmv ?? null,
          previousLinkGmv: isMixed ? null : linkFromSales?.previousGmv ?? null,
          linkVisitors: isMixed ? null : linkFromSales?.visitors ?? null,
          previousLinkVisitors: isMixed ? null : linkFromSales?.previousVisitors ?? null,
          spend: 0,
          previousSpend: 0,
          impressions: 0,
          previousImpressions: 0,
          clicks: 0,
          previousClicks: 0,
          purchaseValue: 0,
          previousPurchaseValue: 0,
          coCreateSpend: 0,
          previousCoCreateSpend: 0,
          graphicSpend: 0,
          previousGraphicSpend: 0,
          brandAdSpend: 0,
          previousBrandAdSpend: 0,
        };
        if (previous) {
          existing.previousSpend += spend;
          existing.previousImpressions += impressions;
          existing.previousClicks += clicks;
          existing.previousPurchaseValue += purchaseValue;
          if (type === "brand") existing.previousBrandAdSpend += spend;
          else if (type === "coCreate") existing.previousCoCreateSpend += spend;
          else existing.previousGraphicSpend += spend;
        } else {
          existing.spend += spend;
          existing.impressions += impressions;
          existing.clicks += clicks;
          existing.purchaseValue += purchaseValue;
          if (type === "brand") existing.brandAdSpend += spend;
          else if (type === "coCreate") existing.coCreateSpend += spend;
          else existing.graphicSpend += spend;
        }
        if (!existing.id && id) existing.id = id;
        if (!existing.category && category) existing.category = category;
        if (existing.linkGmv === null && !isMixed && linkFromSales) existing.linkGmv = linkFromSales.gmv;
        if (existing.previousLinkGmv === null && !isMixed && linkFromSales) existing.previousLinkGmv = linkFromSales.previousGmv;
        if (existing.linkVisitors === null && !isMixed && linkFromSales) existing.linkVisitors = linkFromSales.visitors;
        if (existing.previousLinkVisitors === null && !isMixed && linkFromSales) existing.previousLinkVisitors = linkFromSales.previousVisitors;
        groups.set(key, existing);
      });
    });
  };
  addSheetRange(period, false);
  addSheetRange(previousPeriod, true);
  return [...groups.values()].sort((left, right) => (right.spend - left.spend) || (right.previousSpend - left.previousSpend));
}

function brandFromValue(value: string): BrandKey | null {
  const normalized = value.toUpperCase();
  if (normalized.includes("SKT") || normalized.includes("SKINTIFIC")) return "SKT";
  if (normalized.includes("G2G") || normalized.includes("GLAD2GLOW")) return "G2G";
  if (normalized.includes("TP") || normalized.includes("TIME")) return "TP";
  return null;
}

function channelCategoryFromProduct(product: string, sku = "") {
  const text = normalizeCategory(`${product} ${sku}`).toLowerCase();
  if (/氣墊|气垫|粉底|遮瑕|粉餅|粉饼|彩妆|唇|口紅|口红|唇釉|唇膏|腮紅|腮红/.test(text)) return "彩妆";
  if (/防曬|防晒|spf|隔離|隔离/.test(text)) return "防晒";
  if (/面膜|泥膜|膜棒|凍膜|冻膜/.test(text)) return "面膜";
  if (/面霜|乳霜|保濕霜|保湿霜|霜/.test(text)) return "面霜";
  if (/精華|精华|安瓶|精粹|serum/.test(text)) return "精华";
  if (/化妝水|化妆水|爽膚水|爽肤水|噴霧|喷雾|toner/.test(text)) return "爽肤水";
  if (/洗面|潔面|洁面|卸妝|卸妆|清潔|清洁/.test(text)) return "洁面";
  if (/眼霜|眼膜|眼/.test(text)) return "眼部护理";
  if (/套組|套组|組合|组合|禮盒|礼盒|旅行|集合|鏈子版|链子版/.test(text)) return "套组";
  return FALLBACK_CATEGORY;
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

async function loadChannelProductMap() {
  const response = await fetch("/channel_spu_map.csv", { cache: "no-store" });
  if (!response.ok) return new Map<string, ChannelProductMapRow>();
  const [headers = [], ...rows] = parseCsvMatrix(await response.text());
  const indexOf = (name: string) => headers.findIndex((header) => header.trim().toLowerCase() === name);
  const brandIndex = indexOf("brand");
  const categoryIndex = indexOf("category");
  const skuIndex = indexOf("sku");
  const spuIndex = indexOf("spu");
  const productIndex = indexOf("product");
  const map = new Map<string, ChannelProductMapRow>();
  rows.forEach((row) => {
    const brand = brandFromValue(row[brandIndex] || "");
    const sku = normalizeId(row[skuIndex] || "");
    if (!brand || !sku || sku === "未填写") return;
    const product = (row[productIndex] || "").trim() || sku;
    const spu = (row[spuIndex] || "").trim() || product;
    const category = normalizeCategory((row[categoryIndex] || "").trim() || channelCategoryFromProduct(product, sku));
    map.set(`${brand}:${sku.toUpperCase()}`, { brand, sku, category, spu, product });
  });
  return map;
}

async function loadChannelData(period: DateRange, previousPeriod: DateRange): Promise<ChannelData> {
  const [onlineCurrentRows, onlinePreviousRows, onlineProductRows, offlineResponse, channelProductMap] = await Promise.all([
    querySheet(ONLINE_SKU_SHEET_NAME, skuQuery(period.start, period.end), ONLINE_SKU_SHEET_ID),
    querySheet(ONLINE_SKU_SHEET_NAME, skuQuery(previousPeriod.start, previousPeriod.end), ONLINE_SKU_SHEET_ID),
    querySheet(ONLINE_SKU_SHEET_NAME, skuProductQuery(), ONLINE_SKU_SHEET_ID),
    fetch("/offline_sku_sales.csv", { cache: "no-store" }),
    loadChannelProductMap(),
  ]);
  if (!offlineResponse.ok) throw new Error(`线下销量文件读取失败（${offlineResponse.status}）`);
  const offlineRows = parseCsv(await offlineResponse.text());
  const onlineCurrent = new Map<BrandKey, Map<string, { id: string; product: string; quantity: number }>>();
  const onlinePrevious = new Map<BrandKey, Map<string, { id: string; product: string; quantity: number }>>();
  const productMap = new Map<BrandKey, Map<string, string>>();
  BRANDS.forEach((brand) => productMap.set(brand.key, new Map()));
  BRANDS.forEach((brand) => { onlineCurrent.set(brand.key, new Map()); onlinePrevious.set(brand.key, new Map()); });
  channelProductMap.forEach((record) => {
    productMap.get(record.brand)?.set(record.sku, record.product || record.spu || record.sku);
  });
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
      const mapping = channelProductMap.get(`${config.key}:${id.toUpperCase()}`);
      const product = mapping?.product || online?.product || onlinePrev?.product || offline?.product || offlinePrev?.product || productMap.get(config.key)?.get(id) || id;
      const spu = mapping?.spu || product;
      const category = mapping?.category || channelCategoryFromProduct(product, id);
      rows.push({ key: `${config.key}-${id}`, brand: config.key, id, product, spu, category, online: online?.quantity || 0, onlinePrevious: onlinePrev?.quantity || 0, offline: offline?.quantity || 0, offlinePrevious: offlinePrev?.quantity || 0 });
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

function excelCell(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function exportExcel(fileName: string, sheetName: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const table = `<table><thead><tr>${headers.map((header) => `<th>${excelCell(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${excelCell(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const html = `<!doctype html><html><head><meta charset="UTF-8" /></head><body>${table}</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName.replace(/[\\/:*?"<>|]/g, "-")}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function TableExportButton({ label, onClick, count }: { label: string; onClick: () => void; count: number }) {
  return <div className="table-actions"><span>{count} 条数据</span><button type="button" onClick={onClick}>导出 Excel</button></div>;
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
  const dailyMomValues = days.map((day) => ratio(day.current?.gmv || 0, day.previous?.gmv || 0));
  const validDailyMomValues = dailyMomValues.filter((value): value is number => value !== null && Number.isFinite(value));
  const rawPercentMin = validDailyMomValues.length ? Math.min(0, ...validDailyMomValues) : -1;
  const rawPercentMax = validDailyMomValues.length ? Math.max(0, ...validDailyMomValues) : 1;
  const percentPadding = Math.max(0.05, (rawPercentMax - rawPercentMin) * 0.08);
  const percentMin = rawPercentMin === rawPercentMax ? rawPercentMin - 0.1 : rawPercentMin - percentPadding;
  const percentMax = rawPercentMin === rawPercentMax ? rawPercentMax + 0.1 : rawPercentMax + percentPadding;
  const percentRange = percentMax - percentMin || 1;
  const momLineY = (value: number | null) => value === null ? null : 100 - (value - percentMin) / percentRange * 100;
  const momLinePoints = dailyMomValues
    .map((value, index) => {
      const y = momLineY(value);
      if (y === null) return "";
      const x = days.length <= 1 ? 50 : index / (days.length - 1) * 100;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");
  const percentMid = (percentMax + percentMin) / 2;
  const mom = ratio(item.current.gmv, item.previous.gmv);
  const currentFee = item.current.gmv > 0 ? item.current.adSpend / item.current.gmv : null;
  const previousFee = item.previous.gmv > 0 ? item.previous.adSpend / item.previous.gmv : null;
  const feeDelta = currentFee !== null && previousFee !== null ? currentFee - previousFee : null;
  const color = BRAND_COLORS[item.config.key];
  return <article className="brand-daily-row" style={{ "--brand-color": color } as React.CSSProperties}>
    <div className="brand-row-head"><div className="brand-row-name"><i /> <b>{item.config.key}</b><span>{item.config.name}</span></div><div className="brand-row-metrics"><span>本期 GMV <strong>{formatChartAmount(item.current.gmv)}</strong></span><span className={trendClass(mom)}>环比 {percent(mom)}</span><span>站内费比 <strong>{levelPercent(currentFee)}</strong></span><span className={trendClass(feeDelta)}>费比变化 {feeDelta === null ? "—" : `${feeDelta > 0 ? "+" : "−"}${Math.abs(feeDelta * 100).toFixed(1)}pp`}</span><small>{comparisonLabel}</small></div></div>
    <div className="brand-row-grid"><div className="daily-chart-card"><div className="chart-card-title"><b>每日 GMV</b><span>左轴 GMV · 右轴日环比 · 折线为本期对环比区间变化</span></div><div className="combo-chart"><div className="gmv-axis"><span>{formatChartAmount(max)}</span><span>{formatChartAmount(max / 2)}</span><span>0</span></div><div className="percent-axis"><span>{percent(percentMax)}</span><span>{percent(percentMid)}</span><span>{percent(percentMin)}</span></div><div className="daily-compare-bars">{momLinePoints && <svg className="daily-mom-line" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={momLinePoints} /></svg>}{days.map((day, index) => { const dailyMom = dailyMomValues[index]; const dailyMomY = momLineY(dailyMom); return <div className="day-group" key={`${item.config.key}-${day.currentDate}-${day.previousDate}`}>{dailyMom !== null && <em className={`daily-mom ${trendClass(dailyMom)}`} style={{ top: `calc(${dailyMomY}% - 16px)` }}>{percent(dailyMom)}</em>}<div className="bar-slot"><b>{day.current ? formatChartAmount(day.current.gmv) : ""}</b><span className="bar-current" style={{ height: `${Math.max(3, (day.current?.gmv || 0) / max * 100)}%` }} /></div><div className="bar-slot"><b className="bar-label-muted">{day.previous ? formatChartAmount(day.previous.gmv) : ""}</b><span className="bar-previous" style={{ height: `${Math.max(3, (day.previous?.gmv || 0) / max * 100)}%` }} /></div><small title={`${day.currentDate} 对比 ${day.previousDate}`}>{dateLabel(day.currentDate)}</small></div>; })}</div></div><div className="chart-foot"><strong>{formatChartAmount(item.current.gmv)}</strong><span>共 {days.length} 天 · 环比区间 {formatChartAmount(item.previous.gmv)}</span></div></div><div className="fee-chart-card"><div className="chart-card-title"><b>站内费比</b><span>站内花费 ÷ GMV</span></div><div className="fee-bars"><div className="fee-line"><span>本期</span><div className="fee-track"><i style={{ width: `${Math.min(100, Math.max(0, (currentFee || 0) * 100 * 3))}%` }} /><b>{levelPercent(currentFee)}</b></div></div><div className="fee-line"><span>环比</span><div className="fee-track previous"><i style={{ width: `${Math.min(100, Math.max(0, (previousFee || 0) * 100 * 3))}%` }} /><b>{levelPercent(previousFee)}</b></div></div></div><div className={`fee-delta ${trendClass(feeDelta)}`}>{feeDelta === null ? "暂无可比费比" : `费比${feeDelta > 0 ? "上升" : "下降"} ${Math.abs(feeDelta * 100).toFixed(1)} 个百分点`}</div></div></div>
  </article>;
}

function MetricCard({ label, value, delta, note, color, deltaMode = "ratio" }: { label: string; value: string; delta?: number | null; note?: string; color?: string; deltaMode?: "ratio" | "pp" }) {
  const deltaLabel = delta === undefined || delta === null
    ? "—"
    : deltaMode === "pp"
      ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta * 100).toFixed(1)}pp`
      : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta * 100).toFixed(1)}%`;
  return <article className="metric-card" style={{ "--card-accent": color || "#2364d8" } as React.CSSProperties}>
    <span>{label}</span><strong>{value}</strong>
    {delta !== undefined && <em className={delta !== null && delta >= 0 ? "up" : "down"}>{deltaLabel}</em>}
    {note && <small>{note}</small>}
  </article>;
}

function PanelDelta({ value, previous, mode = "ratio" }: { value: number | null; previous: number | null; mode?: "ratio" | "pp" }) {
  const delta = mode === "pp" && value !== null && previous !== null ? value - previous : ratio(value || 0, previous || 0);
  return <small className={`panel-delta ${trendClass(delta)}`}>{deltaText(value, previous, mode)}</small>;
}

function Insight({ brands, offsiteSpend = 0 }: { brands: BrandData[]; offsiteSpend?: number }) {
  const sales = brands.reduce((sum, item) => sum + item.actualGmv, 0);
  const previous = brands.reduce((sum, item) => sum + item.previousActualGmv, 0);
  const adSpend = brands.reduce((sum, item) => sum + item.current.adSpend, 0) + offsiteSpend;
  const actual = brands.reduce((sum, item) => sum + item.actualGmv, 0);
  const mom = ratio(sales, previous);
  const roi = adSpend > 0 ? actual / adSpend : 0;
  return <div className="insight"><b>经营判断</b><span>本期 GMV {mom === null ? "暂无环比" : `${mom >= 0 ? "增长" : "下滑"} ${Math.abs(mom * 100).toFixed(1)}%`}，综合 ROI {rate(roi)}（含站内+站外花费）。建议优先复盘下方品类与链接的异常变化。</span></div>;
}

function offsiteForMetricRow(row: MetricRow, type: "category" | "link" | "ads", offsiteRows: OffsiteRow[]): OffsiteSpendSummary {
  if (type === "ads") return { spend: 0, previousSpend: 0, clicks: 0, previousClicks: 0 };
  const rawRowId = (row.id || "").trim();
  const rowId = rawRowId ? normalizeId(rawRowId) : "";
  const rowNameKey = normalizeLookupText(row.link || row.product || "");
  const rowCategoryKey = normalizeLookupText(row.category || "");
  const matches = offsiteRows.filter((item) => {
    if (item.brand !== row.brand) return false;
    if (type === "category") return normalizeLookupText(item.category || "") === rowCategoryKey;
    if (rowId && item.id && normalizeId(item.id) === rowId) return true;
    return rowNameKey && normalizeLookupText(item.link) === rowNameKey;
  });
  return matches.reduce((acc, item) => ({
    spend: acc.spend + item.spend,
    previousSpend: acc.previousSpend + item.previousSpend,
    clicks: acc.clicks + item.clicks,
    previousClicks: acc.previousClicks + item.previousClicks,
  }), { spend: 0, previousSpend: 0, clicks: 0, previousClicks: 0 });
}

function Table({ rows, type, offsiteRows = [] }: { rows: MetricRow[]; type: "category" | "link" | "ads"; offsiteRows?: OffsiteRow[] }) {
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
      { key: "totalSpend", label: "总花费", value: (row) => row.adSpend + offsiteForMetricRow(row, type, offsiteRows).spend },
      { key: "orders", label: "订单", value: (row) => row.orders },
      { key: "aov", label: "客单价", value: (row) => row.orders > 0 ? row.gmv / row.orders : null },
      { key: "visitors", label: "访客", value: (row) => row.visitors },
      { key: "cvr", label: "CVR", value: (row) => row.clicks > 0 ? row.orders / row.clicks : null },
      { key: "fee", label: "费比", value: (row) => row.gmv > 0 ? (row.adSpend + offsiteForMetricRow(row, type, offsiteRows).spend) / row.gmv : null },
      { key: "adShare", label: "站内广告GMV占比", value: (row) => row.gmv > 0 ? row.adGmv / row.gmv : null },
      { key: "onsiteSpend", label: "站内广告花费", value: (row) => row.adSpend },
      { key: "offsiteSpend", label: "站外广告花费", value: (row) => offsiteForMetricRow(row, type, offsiteRows).spend },
      { key: "onsiteClicks", label: "站内广告点击量", value: (row) => row.adClicks },
      { key: "offsiteClicks", label: "站外广告点击量", value: (row) => offsiteForMetricRow(row, type, offsiteRows).clicks },
    ];
  const sortColumn = columns.find((column) => column.key === sort.key) || columns[0];
  const sorted = [...rows].sort((a, b) => {
    const result = compareSortValue(sortColumn.value(a), sortColumn.value(b));
    return sort.direction === "asc" ? result : -result;
  });
  const sortBy = (column: SortColumn<MetricRow>) => setSort((current) => current.key === column.key ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: column.defaultDirection || "desc" });
  const metricColumnCount = columns.length - (type === "link" || type === "ads" ? 2 : 1);
  const exportMetricTable = () => {
    const headers = type === "ads"
      ? ["产品/广告", "品类", "链接GMV", "链接GMV环比", "广告成交金额", "广告成交金额环比", "广告成交占比", "广告成交占比变化", "花费", "花费环比", "ROI", "ROI环比", "曝光", "曝光环比", "点击", "点击环比", "CTR", "CTR变化", "CPC", "CPC环比", "CVR", "CVR变化"]
      : [type === "category" ? "品类" : "产品名", ...(type === "link" ? ["商品ID / ID"] : []), "GMV", "GMV环比", "总花费", "总花费环比", "订单", "订单环比", "客单价", "客单价环比", "访客", "访客环比", "CVR", "CVR变化", "费比", "费比变化", "站内广告GMV占比", "站内广告GMV占比变化", "站内广告花费", "站内广告花费环比", "站外广告花费", "站外广告花费环比", "站内广告点击量", "站内广告点击量环比", "站外广告点击量", "站外广告点击量环比"];
    const exportRows = sorted.map((row) => {
      const aov = row.orders > 0 ? row.gmv / row.orders : 0;
      const previousAov = row.previousOrders > 0 ? row.previousGmv / row.previousOrders : 0;
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
      const adDealShare = row.gmv > 0 ? row.adGmv / row.gmv : null;
      const previousAdDealShare = row.previousGmv > 0 ? row.previousAdGmv / row.previousGmv : null;
      const cpc = row.clicks > 0 ? row.adSpend / row.clicks : 0;
      const previousCpc = row.previousClicks > 0 ? row.previousAdSpend / row.previousClicks : 0;
      if (type === "ads") return [row.product || "—", row.category || "—", formatMoney(row.gmv, true), deltaText(row.gmv, row.previousGmv), formatMoney(row.adGmv, true), deltaText(row.adGmv, row.previousAdGmv), levelPercent(adDealShare), deltaText(adDealShare, previousAdDealShare, "pp"), formatMoney(row.adSpend, true), deltaText(row.adSpend, row.previousAdSpend), rate(roi), deltaText(roi, previousRoi), formatNumber(row.exposure), deltaText(row.exposure, row.previousExposure), formatNumber(row.clicks), deltaText(row.clicks, row.previousClicks), levelPercent(ctr), deltaText(ctr, previousCtr, "pp"), formatMoneyOneDecimal(cpc), deltaText(cpc, previousCpc), levelPercent(row.clicks > 0 ? row.conversions / row.clicks : 0), deltaText(row.clicks > 0 ? row.conversions / row.clicks : 0, row.previousClicks > 0 ? row.previousConversions / row.previousClicks : 0, "pp")];
      const offsite = offsiteForMetricRow(row, type, offsiteRows);
      const totalSpend = row.adSpend + offsite.spend;
      const previousTotalSpend = row.previousAdSpend + offsite.previousSpend;
      const totalFee = row.gmv > 0 ? totalSpend / row.gmv : 0;
      const previousTotalFee = row.previousGmv > 0 ? previousTotalSpend / row.previousGmv : 0;
      return [type === "category" ? row.category : row.product || row.link || "—", ...(type === "link" ? [row.id || "—"] : []), formatMoney(row.gmv, true), deltaText(row.gmv, row.previousGmv), formatMoney(totalSpend, true), deltaText(totalSpend, previousTotalSpend), formatNumber(row.orders), deltaText(row.orders, row.previousOrders), formatMoney(aov), deltaText(aov, previousAov), formatNumber(row.visitors), deltaText(row.visitors, row.previousVisitors), levelPercent(cvr), deltaText(cvr, previousCvr, "pp"), levelPercent(totalFee), deltaText(totalFee, previousTotalFee, "pp"), levelPercent(share), deltaText(share, previousShare, "pp"), formatMoney(row.adSpend, true), deltaText(row.adSpend, row.previousAdSpend), formatMoney(offsite.spend, true), deltaText(offsite.spend, offsite.previousSpend), formatNumber(row.adClicks), deltaText(row.adClicks, row.previousAdClicks), formatNumber(offsite.clicks), deltaText(offsite.clicks, offsite.previousClicks)];
    });
    exportExcel(`台湾线上销售分析-${type === "category" ? "品类进度" : type === "link" ? "链接明细" : "广告数据"}`, "数据", headers, exportRows);
  };
  return <><TableExportButton label="导出 Excel" onClick={exportMetricTable} count={sorted.length} /><div className={`table-wrap compact-metric-table ${type}-table`}><table><colgroup><col className="primary-col" />{(type === "link" || type === "ads") && <col className="secondary-col" />}{Array.from({ length: metricColumnCount }, (_, index) => <col className="metric-col" key={index} />)}</colgroup><thead><tr>
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
    const offsite = offsiteForMetricRow(row, type, offsiteRows);
    const totalSpend = row.adSpend + offsite.spend;
    const previousTotalSpend = row.previousAdSpend + offsite.previousSpend;
    const totalFee = row.gmv > 0 ? totalSpend / row.gmv : 0;
    const previousTotalFee = row.previousGmv > 0 ? previousTotalSpend / row.previousGmv : 0;
    return <tr key={row.key}>
      <td className="primary-cell"><b title={type === "category" ? row.category : row.product || row.link || "—"}>{type === "category" ? row.category : row.product || row.link || "—"}</b><small style={{ color: BRAND_COLORS[row.brand] }}>{row.brand}{type === "link" ? ` · ${row.category || FALLBACK_CATEGORY}` : ""}</small></td>
      {type === "link" && <td>{row.id || "—"}</td>}
      {type === "ads" && <td>{row.category || "—"}</td>}
      {type === "ads" ? <><MetricCell value={row.gmv > 0 ? row.gmv : null} previous={row.previousGmv > 0 ? row.previousGmv : null} format={(value) => formatMoney(value, true)} /><MetricCell value={row.adGmv} previous={row.previousAdGmv} format={(value) => formatMoney(value, true)} /><MetricCell value={adDealShare} previous={previousAdDealShare} format={levelPercent} mode="pp" /></> : <><MetricCell value={row.gmv} previous={row.previousGmv} format={(value) => formatMoney(value, true)} /><MetricCell value={totalSpend} previous={previousTotalSpend} format={(value) => formatMoney(value, true)} /><MetricCell value={row.orders} previous={row.previousOrders} format={formatNumber} /><MetricCell value={aov} previous={previousAov} format={formatMoney} /><MetricCell value={row.visitors} previous={row.previousVisitors} format={formatNumber} /><MetricCell value={cvr} previous={previousCvr} format={levelPercent} mode="pp" /><MetricCell value={totalFee} previous={previousTotalFee} format={levelPercent} mode="pp" /><MetricCell value={share} previous={previousShare} format={levelPercent} mode="pp" /><MetricCell value={row.adSpend} previous={row.previousAdSpend} format={(value) => formatMoney(value, true)} /><MetricCell value={offsite.spend} previous={offsite.previousSpend} format={(value) => formatMoney(value, true)} /><MetricCell value={row.adClicks} previous={row.previousAdClicks} format={formatNumber} /><MetricCell value={offsite.clicks} previous={offsite.previousClicks} format={formatNumber} /></>}
      {type === "ads" && <><MetricCell value={row.adSpend} previous={row.previousAdSpend} format={(value) => formatMoney(value, true)} /><MetricCell value={roi} previous={previousRoi} format={rate} /><MetricCell value={row.exposure} previous={row.previousExposure} format={formatNumber} /><MetricCell value={row.clicks} previous={row.previousClicks} format={formatNumber} /><MetricCell value={ctr} previous={previousCtr} format={levelPercent} mode="pp" /><MetricCell value={cpc} previous={previousCpc} format={formatMoneyOneDecimal} /><MetricCell value={row.clicks > 0 ? row.conversions / row.clicks : 0} previous={row.previousClicks > 0 ? row.previousConversions / row.previousClicks : 0} format={levelPercent} mode="pp" /></>}
    </tr>;
  })}</tbody></table></div></>;
}

function OffsiteTable({ rows }: { rows: OffsiteRow[] }) {
  const [sort, setSort] = useState<SortState>({ key: "spend", direction: "desc" });
  const share = (part: number, total: number) => total > 0 ? part / total : null;
  const columns: SortColumn<OffsiteRow>[] = [
    { key: "category", label: "类目", value: (row) => row.category, defaultDirection: "asc" },
    { key: "link", label: "链接简称", value: (row) => row.link, defaultDirection: "asc" },
    { key: "linkGmv", label: "链接GMV", value: (row) => row.linkGmv },
    { key: "linkVisitors", label: "链接访客", value: (row) => row.linkVisitors },
    { key: "spend", label: "站外花费", value: (row) => row.spend },
    { key: "impressions", label: "曝光", value: (row) => row.impressions },
    { key: "clicks", label: "点击量", value: (row) => row.clicks },
    { key: "purchaseValue", label: "成交金额", value: (row) => row.purchaseValue },
    { key: "coCreate", label: "合创", value: (row) => share(row.coCreateSpend, row.spend) },
    { key: "graphic", label: "图文", value: (row) => share(row.graphicSpend, row.spend) },
    { key: "brandAd", label: "品牌广告", value: (row) => share(row.brandAdSpend, row.spend) },
  ];
  const sortColumn = columns.find((column) => column.key === sort.key) || columns[4];
  const sorted = [...rows].sort((a, b) => {
    const result = compareSortValue(sortColumn.value(a), sortColumn.value(b));
    return sort.direction === "asc" ? result : -result;
  });
  const sortBy = (column: SortColumn<OffsiteRow>) => setSort((current) => current.key === column.key ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: column.defaultDirection || "desc" });
  const exportOffsiteRows = () => {
    const headers = ["品牌", "类目", "链接简称", "商品ID / ID", "链接GMV", "链接GMV环比", "链接访客", "链接访客环比", "站外花费", "站外花费环比", "曝光", "曝光环比", "点击量", "点击量环比", "成交金额", "成交金额环比", "合创占比", "合创占比变化", "图文占比", "图文占比变化", "品牌广告占比", "品牌广告占比变化"];
    const exportRows = sorted.map((row) => {
      const coCreateShare = share(row.coCreateSpend, row.spend);
      const previousCoCreateShare = share(row.previousCoCreateSpend, row.previousSpend);
      const graphicShare = share(row.graphicSpend, row.spend);
      const previousGraphicShare = share(row.previousGraphicSpend, row.previousSpend);
      const brandAdShare = share(row.brandAdSpend, row.spend);
      const previousBrandAdShare = share(row.previousBrandAdSpend, row.previousSpend);
      return [
        row.brand,
        row.category || "",
        row.link,
        row.id || "",
        row.linkGmv === null ? "" : formatMoney(row.linkGmv, true),
        deltaText(row.linkGmv, row.previousLinkGmv),
        row.linkVisitors === null ? "" : formatNumber(row.linkVisitors),
        deltaText(row.linkVisitors, row.previousLinkVisitors),
        formatMoney(row.spend, true),
        deltaText(row.spend, row.previousSpend),
        formatNumber(row.impressions),
        deltaText(row.impressions, row.previousImpressions),
        formatNumber(row.clicks),
        deltaText(row.clicks, row.previousClicks),
        formatMoney(row.purchaseValue, true),
        deltaText(row.purchaseValue, row.previousPurchaseValue),
        levelPercent(coCreateShare),
        deltaText(coCreateShare, previousCoCreateShare, "pp"),
        levelPercent(graphicShare),
        deltaText(graphicShare, previousGraphicShare, "pp"),
        levelPercent(brandAdShare),
        deltaText(brandAdShare, previousBrandAdShare, "pp"),
      ];
    });
    exportExcel("台湾线上销售分析-站外广告数据", "站外广告数据", headers, exportRows);
  };
  return <><TableExportButton label="导出 Excel" onClick={exportOffsiteRows} count={sorted.length} /><div className="table-wrap offsite-table"><table><colgroup><col className="offsite-category-col" /><col className="offsite-link-col" /><col className="offsite-metric-col" /><col className="offsite-metric-col" /><col className="offsite-metric-col" /><col className="offsite-metric-col" /><col className="offsite-metric-col" /><col className="offsite-metric-col" /><col className="offsite-share-col" /><col className="offsite-share-col" /><col className="offsite-share-col" /></colgroup><thead><tr className="group-head"><th colSpan={4}>经营数据</th><th colSpan={4}>广告数据</th><th colSpan={3}>消耗占比</th></tr><tr>{columns.map((column) => <SortableHeader key={column.key} label={column.label} active={sort.key === column.key} direction={sort.direction} onClick={() => sortBy(column)} />)}</tr></thead><tbody>{sorted.length === 0 ? <tr><td colSpan={11}>暂无站外广告数据</td></tr> : sorted.map((row) => {
    const coCreateShare = share(row.coCreateSpend, row.spend);
    const previousCoCreateShare = share(row.previousCoCreateSpend, row.previousSpend);
    const graphicShare = share(row.graphicSpend, row.spend);
    const previousGraphicShare = share(row.previousGraphicSpend, row.previousSpend);
    const brandAdShare = share(row.brandAdSpend, row.spend);
    const previousBrandAdShare = share(row.previousBrandAdSpend, row.previousSpend);
    return <tr key={row.key}><td><b>{row.category || "—"}</b><small style={{ color: BRAND_COLORS[row.brand] }}>{row.brand}</small></td><td className="primary-cell"><b title={row.link}>{row.link}</b><small>{row.id || "混合目录"}</small></td><MetricCell value={row.linkGmv} previous={row.previousLinkGmv} format={(value) => formatMoney(value, true)} /><MetricCell value={row.linkVisitors} previous={row.previousLinkVisitors} format={formatNumber} /><MetricCell value={row.spend} previous={row.previousSpend} format={(value) => formatMoney(value, true)} /><MetricCell value={row.impressions} previous={row.previousImpressions} format={formatNumber} /><MetricCell value={row.clicks} previous={row.previousClicks} format={formatNumber} /><MetricCell value={row.purchaseValue} previous={row.previousPurchaseValue} format={(value) => formatMoney(value, true)} /><MetricCell value={coCreateShare} previous={previousCoCreateShare} format={levelPercent} mode="pp" /><MetricCell value={graphicShare} previous={previousGraphicShare} format={levelPercent} mode="pp" /><MetricCell value={brandAdShare} previous={previousBrandAdShare} format={levelPercent} mode="pp" /></tr>;
  })}</tbody></table></div></>;
}

function channelRollup(rows: ChannelSkuRow[], brand: "ALL" | BrandKey = "ALL", category?: string): ChannelRollupRow {
  return rows
    .filter((row) => (brand === "ALL" || row.brand === brand) && (!category || row.category === category))
    .reduce((acc, row) => ({ ...acc, online: acc.online + row.online, onlinePrevious: acc.onlinePrevious + row.onlinePrevious, offline: acc.offline + row.offline, offlinePrevious: acc.offlinePrevious + row.offlinePrevious }), { key: `${brand}-${category || "all"}`, brand: brand === "ALL" ? "SKT" : brand, category: category || "全部品类", online: 0, onlinePrevious: 0, offline: 0, offlinePrevious: 0 });
}

function channelRatio(row: Pick<ChannelRollupRow, "online" | "offline">) {
  return row.offline > 0 ? row.online / row.offline : null;
}

function previousChannelRatio(row: Pick<ChannelRollupRow, "onlinePrevious" | "offlinePrevious">) {
  return row.offlinePrevious > 0 ? row.onlinePrevious / row.offlinePrevious : null;
}

function ChannelSummaryMetric({ label, value, previous, format = formatNumber, mode = "ratio" }: { label: string; value: number | null; previous: number | null; format?: (value: number) => string; mode?: "ratio" | "pp" }) {
  const delta = mode === "pp" && value !== null && previous !== null ? value - previous : ratio(value || 0, previous || 0);
  return <div><span>{label}</span><b>{value === null ? "—" : format(value)}</b><small className={trendClass(delta)}>{deltaText(value, previous, mode)}</small></div>;
}

function ChannelSummary({ rows }: { rows: ChannelSkuRow[] }) {
  return <section className="channel-summary-grid">{BRANDS.map((item) => {
    const summary = channelRollup(rows, item.key);
    const gap = summary.online - summary.offline;
    const previousGap = summary.onlinePrevious - summary.offlinePrevious;
    const ratioValue = channelRatio(summary);
    const previousRatioValue = previousChannelRatio(summary);
    return <article className="channel-summary-card" style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} key={item.key}>
      <div className="channel-summary-head"><b>{item.key}</b><span>{item.name}</span></div>
      <div className="channel-summary-metrics">
        <ChannelSummaryMetric label="线上销量" value={summary.online} previous={summary.onlinePrevious} />
        <ChannelSummaryMetric label="线下销量" value={summary.offline} previous={summary.offlinePrevious} />
        <ChannelSummaryMetric label="本月差距" value={gap} previous={previousGap} format={(value) => `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`} />
        <ChannelSummaryMetric label="线上vs线下" value={ratioValue} previous={previousRatioValue} format={rate} />
      </div>
    </article>;
  })}</section>;
}

function channelBrandItems(brand: "ALL" | BrandKey) {
  return brand === "ALL" ? BRANDS : BRANDS.filter((item) => item.key === brand);
}

function ChannelCategoryTable({ rows, brand }: { rows: ChannelSkuRow[]; brand: "ALL" | BrandKey }) {
  return <div className={`channel-brand-tables category-brand-tables${brand === "ALL" ? "" : " single-brand-table"}`}>{channelBrandItems(brand).map((item) => {
    const brandRows = rows.filter((row) => row.brand === item.key);
    return <article className="channel-brand-block" style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} key={item.key}>
      <div className="channel-brand-head"><div><b>{item.key}</b><span>{item.name}</span></div><em>{brandRows.length} SKU</em></div>
      <ChannelCategoryBrandTable rows={brandRows} brand={item.key} />
    </article>;
  })}</div>;
}

function ChannelCategoryBrandTable({ rows, brand }: { rows: ChannelSkuRow[]; brand: BrandKey }) {
  const [sort, setSort] = useState<SortState>({ key: "total", direction: "desc" });
  const categoryRows = useMemo(() => {
    const groups = new Map<string, ChannelRollupRow>();
    rows.forEach((row) => {
      const key = `${row.brand}-${row.category}`;
      const existing = groups.get(key) || { key, brand: row.brand, category: row.category, online: 0, onlinePrevious: 0, offline: 0, offlinePrevious: 0 };
      existing.online += row.online;
      existing.onlinePrevious += row.onlinePrevious;
      existing.offline += row.offline;
      existing.offlinePrevious += row.offlinePrevious;
      groups.set(key, existing);
    });
    return [...groups.values()];
  }, [rows]);
  const columns: SortColumn<ChannelRollupRow>[] = [
    { key: "category", label: "品类", value: (row) => row.category, defaultDirection: "asc" },
    { key: "online", label: "线上销量", value: (row) => row.online },
    { key: "offline", label: "线下销量", value: (row) => row.offline },
    { key: "gap", label: "线上－线下", value: (row) => row.online - row.offline },
    { key: "onlineOfflineRatio", label: "线上vs线下", value: (row) => channelRatio(row) },
    { key: "total", label: "总销量", value: (row) => row.online + row.offline },
  ];
  const sortColumn = columns.find((column) => column.key === sort.key) || columns[columns.length - 1];
  const sorted = [...categoryRows].sort((a, b) => {
    const result = compareSortValue(sortColumn.value(a), sortColumn.value(b));
    return sort.direction === "asc" ? result : -result;
  });
  const sortBy = (column: SortColumn<ChannelRollupRow>) => setSort((current) => current.key === column.key ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: column.defaultDirection || "desc" });
  const exportCategoryRows = () => {
    exportExcel(`台湾线上销售分析-${brand}线上线下品类销量对比`, `${brand}品类销量对比`, ["品牌", "品类", "线上销量", "线上销量环比", "线下销量", "线下销量环比", "线上－线下", "差距环比", "线上vs线下", "倍数环比"], sorted.map((row) => {
      const gap = row.online - row.offline;
      const previousGap = row.onlinePrevious - row.offlinePrevious;
      const ratioValue = channelRatio(row);
      const previousRatioValue = previousChannelRatio(row);
      return [row.brand, row.category, formatNumber(row.online), deltaText(row.online, row.onlinePrevious), formatNumber(row.offline), deltaText(row.offline, row.offlinePrevious), `${gap >= 0 ? "+" : "-"}${formatNumber(Math.abs(gap))}`, deltaText(gap, previousGap), rate(ratioValue), deltaText(ratioValue, previousRatioValue)];
    }));
  };
  return <><TableExportButton label="导出 Excel" onClick={exportCategoryRows} count={sorted.length} /><div className="table-wrap channel-category-table"><table><thead><tr>{columns.filter((column) => column.key !== "total").map((column) => <SortableHeader key={column.key} label={column.label} active={sort.key === column.key} direction={sort.direction} onClick={() => sortBy(column)} />)}</tr></thead><tbody>{sorted.length === 0 ? <tr><td colSpan={5}>暂无数据</td></tr> : sorted.map((row) => {
    const gap = row.online - row.offline;
    const previousGap = row.onlinePrevious - row.offlinePrevious;
    const ratioValue = channelRatio(row);
    const previousRatioValue = previousChannelRatio(row);
    return <tr key={row.key}><td><b>{row.category}</b></td><MetricCell value={row.online} previous={row.onlinePrevious} format={formatNumber} /><MetricCell value={row.offline} previous={row.offlinePrevious} format={formatNumber} /><MetricCell value={gap} previous={previousGap} format={(value) => `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`} /><MetricCell value={ratioValue} previous={previousRatioValue} format={rate} /></tr>;
  })}</tbody></table></div></>;
}

function ChannelSpuTable({ rows, brand }: { rows: ChannelSkuRow[]; brand: "ALL" | BrandKey }) {
  return <div className="channel-brand-tables spu-brand-tables">{channelBrandItems(brand).map((item) => {
    const brandRows = rows.filter((row) => row.brand === item.key);
    return <article className="channel-brand-block" style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} key={item.key}>
      <div className="channel-brand-head"><div><b>{item.key}</b><span>{item.name}</span></div><em>{brandRows.length} SKU</em></div>
      <ChannelSpuBrandTable rows={brandRows} brand={item.key} />
    </article>;
  })}</div>;
}

function ChannelSpuBrandTable({ rows, brand }: { rows: ChannelSkuRow[]; brand: BrandKey }) {
  const [sort, setSort] = useState<SortState>({ key: "total", direction: "desc" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const spuRows = useMemo(() => {
    const groups = new Map<string, ChannelSpuRow>();
    rows.forEach((row) => {
      const key = `${row.brand}-${row.category}-${row.spu}`;
      const existing = groups.get(key) || { key, brand: row.brand, category: row.category, spu: row.spu, product: row.spu, skuCount: 0, children: [], online: 0, onlinePrevious: 0, offline: 0, offlinePrevious: 0 };
      existing.children.push(row);
      existing.skuCount = existing.children.length;
      existing.online += row.online;
      existing.onlinePrevious += row.onlinePrevious;
      existing.offline += row.offline;
      existing.offlinePrevious += row.offlinePrevious;
      groups.set(key, existing);
    });
    return [...groups.values()].map((row) => ({ ...row, children: [...row.children].sort((a, b) => (b.online + b.offline) - (a.online + a.offline)) }));
  }, [rows]);
  const columns: SortColumn<ChannelSpuRow>[] = [
    { key: "category", label: "品类", value: (row) => row.category, defaultDirection: "asc" },
    { key: "spu", label: "SPU / SKU码", value: (row) => row.spu, defaultDirection: "asc" },
    { key: "skuCount", label: "SKU名", value: (row) => row.skuCount },
    { key: "online", label: "线上销量", value: (row) => row.online },
    { key: "offline", label: "线下销量", value: (row) => row.offline },
    { key: "gap", label: "线上－线下", value: (row) => row.online - row.offline },
    { key: "onlineOfflineRatio", label: "线上vs线下", value: (row) => row.offline > 0 ? row.online / row.offline : null },
    { key: "total", label: "总销量", value: (row) => row.online + row.offline },
  ];
  const sortColumn = columns.find((column) => column.key === sort.key) || columns[columns.length - 1];
  const sorted = [...spuRows].sort((a, b) => {
    const result = compareSortValue(sortColumn.value(a), sortColumn.value(b));
    return sort.direction === "asc" ? result : -result;
  });
  const sortBy = (column: SortColumn<ChannelSpuRow>) => setSort((current) => current.key === column.key ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: column.defaultDirection || "desc" });
  const toggle = (key: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const exportSpuRows = () => {
    const exportRows = sorted.flatMap((row) => {
      const gap = row.online - row.offline;
      const previousGap = row.onlinePrevious - row.offlinePrevious;
      const ratioValue = row.offline > 0 ? row.online / row.offline : null;
      const previousRatioValue = row.offlinePrevious > 0 ? row.onlinePrevious / row.offlinePrevious : null;
      const parent = ["SPU", row.brand, row.category, row.spu, "", row.spu, formatNumber(row.online), deltaText(row.online, row.onlinePrevious), formatNumber(row.offline), deltaText(row.offline, row.offlinePrevious), `${gap >= 0 ? "+" : "-"}${formatNumber(Math.abs(gap))}`, deltaText(gap, previousGap), rate(ratioValue), deltaText(ratioValue, previousRatioValue)];
      const children = row.children.map((sku) => {
        const skuGap = sku.online - sku.offline;
        const previousSkuGap = sku.onlinePrevious - sku.offlinePrevious;
        const skuRatio = sku.offline > 0 ? sku.online / sku.offline : null;
        const previousSkuRatio = sku.offlinePrevious > 0 ? sku.onlinePrevious / sku.offlinePrevious : null;
        return ["SKU", sku.brand, sku.category, sku.spu, sku.id, sku.product, formatNumber(sku.online), deltaText(sku.online, sku.onlinePrevious), formatNumber(sku.offline), deltaText(sku.offline, sku.offlinePrevious), `${skuGap >= 0 ? "+" : "-"}${formatNumber(Math.abs(skuGap))}`, deltaText(skuGap, previousSkuGap), rate(skuRatio), deltaText(skuRatio, previousSkuRatio)];
      });
      return [parent, ...children];
    });
    exportExcel(`台湾线上销售分析-${brand}线上线下SPU销量明细`, `${brand}SPU销量明细`, ["层级", "品牌", "品类", "SPU", "SKU码", "SKU名", "线上销量", "线上销量环比", "线下销量", "线下销量环比", "线上－线下", "差距环比", "线上vs线下", "倍数环比"], exportRows);
  };
  return <><TableExportButton label="导出 Excel" onClick={exportSpuRows} count={sorted.length} /><div className="table-wrap channel-table channel-spu-table"><table><colgroup><col className="channel-col-category" /><col className="channel-col-spu" /><col className="channel-col-product" /><col className="channel-col-metric" /><col className="channel-col-metric" /><col className="channel-col-gap" /><col className="channel-col-share" /></colgroup><thead><tr>{columns.filter((column) => column.key !== "total").map((column) => <SortableHeader key={column.key} label={column.label} active={sort.key === column.key} direction={sort.direction} onClick={() => sortBy(column)} />)}</tr></thead><tbody>{sorted.length === 0 ? <tr><td colSpan={7}>暂无数据</td></tr> : sorted.map((row) => {
    const gap = row.online - row.offline;
    const previousGap = row.onlinePrevious - row.offlinePrevious;
    const onlineOfflineRatio = row.offline > 0 ? row.online / row.offline : null;
    const previousOnlineOfflineRatio = row.offlinePrevious > 0 ? row.onlinePrevious / row.offlinePrevious : null;
    return <Fragment key={row.key}><tr className="spu-row"><td><b>{row.category}</b></td><td className="channel-product"><button className="spu-toggle" type="button" onClick={() => toggle(row.key)} aria-expanded={expanded.has(row.key)}><i>{expanded.has(row.key) ? "-" : "+"}</i><b title={row.spu}>{row.spu}</b></button></td><td><b>{row.skuCount} 个SKU</b><small>点击展开 SKU</small></td><MetricCell value={row.online} previous={row.onlinePrevious} format={formatNumber} /><MetricCell value={row.offline} previous={row.offlinePrevious} format={formatNumber} /><MetricCell value={gap} previous={previousGap} format={(value) => `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`} /><MetricCell value={onlineOfflineRatio} previous={previousOnlineOfflineRatio} format={rate} /></tr>{expanded.has(row.key) && row.children.map((sku) => {
      const skuGap = sku.online - sku.offline;
      const previousSkuGap = sku.onlinePrevious - sku.offlinePrevious;
      const skuRatio = sku.offline > 0 ? sku.online / sku.offline : null;
      const previousSkuRatio = sku.offlinePrevious > 0 ? sku.onlinePrevious / sku.offlinePrevious : null;
      return <tr key={`${row.key}-${sku.id}`} className="sku-child-row"><td><small>{sku.category}</small></td><td><b>{sku.id}</b><small>SKU码</small></td><td className="channel-product"><b title={sku.product || sku.id}>{sku.product || sku.id}</b><small>SKU名</small></td><MetricCell value={sku.online} previous={sku.onlinePrevious} format={formatNumber} /><MetricCell value={sku.offline} previous={sku.offlinePrevious} format={formatNumber} /><MetricCell value={skuGap} previous={previousSkuGap} format={(value) => `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`} /><MetricCell value={skuRatio} previous={previousSkuRatio} format={rate} /></tr>;
    })}</Fragment>;
  })}</tbody></table></div></>;
}

const SHOP_METRICS: Array<{ key: ShopMetricKey; label: string }> = [
  { key: "sales", label: "销售额" },
  { key: "visitors", label: "访客" },
  { key: "buyers", label: "买家数" },
  { key: "newBuyers", label: "新买家数" },
  { key: "conversion", label: "转化率" },
  { key: "aov", label: "客单价" },
];

function formatShopMetric(key: ShopMetricKey, value: number | null) {
  if (value === null) return "—";
  if (key === "sales" || key === "aov") return formatMoney(value, key === "sales");
  if (key === "conversion") return levelPercent(value);
  return formatNumber(value);
}

function ShopPage({ rows, brand, currentRange, previousRange, loading, error }: { rows: ShopDailyRow[]; brand: "ALL" | BrandKey; currentRange: DateRange; previousRange: DateRange; loading: boolean; error: string }) {
  const [trendMetric, setTrendMetric] = useState<ShopMetricKey>("sales");
  const trendRange = { start: addDays(currentRange.end, -29), end: currentRange.end };
  const visibleBrands = channelBrandItems(brand);
  const summaries = visibleBrands.map((item) => ({
    item,
    current: aggregateShopRows(shopRowsInRange(rows.filter((row) => row.brand === item.key), currentRange)),
    previous: aggregateShopRows(shopRowsInRange(rows.filter((row) => row.brand === item.key), previousRange)),
  }));
  const trendDates = Array.from({ length: 30 }, (_, index) => addDays(trendRange.start, index));
  const trendLines = visibleBrands.map((item) => ({
    item,
    values: trendDates.map((date) => {
      const metric = aggregateShopRows(rows.filter((row) => row.brand === item.key && row.date === date));
      return metric[trendMetric];
    }),
  }));
  const validValues = trendLines.flatMap((line) => line.values).filter((value): value is number => value !== null && Number.isFinite(value));
  const max = Math.max(1, ...validValues);
  const pointString = (values: Array<number | null>) => values.map((value, index) => {
    const x = 30 + index / Math.max(1, trendDates.length - 1) * 840;
    const y = 220 - ((value || 0) / max * 190);
    return `${x},${y}`;
  }).join(" ");

  return <>
    <section className="data-page shop-page">
      <div className="section-title"><span>03</span><div><h2>店铺维度数据</h2><p>来自“台灣SP三品牌數據表”的店铺维度每日；金额按运营汇率换算为人民币。</p></div><em>{rangeLabel(currentRange)} · 对比 {rangeLabel(previousRange)}</em></div>
      {error && <div className="data-alert"><b>店铺数据同步失败</b><span>{error}</span></div>}
      {loading && rows.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步店铺每日数据</strong><p>读取三品牌访客、销售、买家与转化指标</p></div></div> : <>
        <div className="shop-overview-grid">{summaries.map(({ item, current, previous }) => <article className="shop-brand-card" style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} key={item.key}>
          <div className="shop-brand-head"><div><b>{item.key}</b><span>{item.name}</span></div><small>环比所选对比区间</small></div>
          <div className="shop-kpis">{SHOP_METRICS.map((metric) => <div key={metric.key}><span>{metric.label}</span><b>{formatShopMetric(metric.key, current[metric.key])}</b><PanelDelta value={current[metric.key]} previous={previous[metric.key]} mode={metric.key === "conversion" ? "pp" : "ratio"} /></div>)}</div>
        </article>)}</div>
      </>}
    </section>
    {(!loading || rows.length > 0) && <section className="data-page shop-trend-page">
      <div className="section-title"><span>30D</span><div><h2>近三十天趋势</h2><p>固定回看截至主日期到的 30 个完整日；可切换六项核心指标。</p></div><em>{rangeLabel(trendRange)}</em></div>
      <div className="shop-metric-tabs">{SHOP_METRICS.map((metric) => <button type="button" className={trendMetric === metric.key ? "active" : ""} onClick={() => setTrendMetric(metric.key)} key={metric.key}>{metric.label}</button>)}</div>
      <div className="shop-chart-card">
        <div className="shop-chart-legend">{trendLines.map(({ item }) => <span style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} key={item.key}><i />{item.key}</span>)}<strong>{SHOP_METRICS.find((item) => item.key === trendMetric)?.label}</strong></div>
        <div className="shop-chart"><div className="shop-y-axis"><span>{formatShopMetric(trendMetric, max)}</span><span>{formatShopMetric(trendMetric, max / 2)}</span><span>0</span></div><svg viewBox="0 0 900 240" preserveAspectRatio="none" role="img" aria-label={`近三十天${SHOP_METRICS.find((item) => item.key === trendMetric)?.label}趋势`}><line x1="30" y1="30" x2="870" y2="30" /><line x1="30" y1="125" x2="870" y2="125" /><line x1="30" y1="220" x2="870" y2="220" />{trendLines.map(({ item, values }) => <polyline key={item.key} points={pointString(values)} style={{ stroke: BRAND_COLORS[item.key] }} />)}</svg></div>
        <div className="shop-x-axis">{trendDates.map((date, index) => index % 5 === 0 || index === trendDates.length - 1 ? <span style={{ left: `${index / Math.max(1, trendDates.length - 1) * 100}%` }} key={date}>{dateLabel(date)}</span> : null)}</div>
      </div>
    </section>}
  </>;
}

function DataSourceLinks() {
  return <details className="source-panel" open>
    <summary>数据源路径</summary>
    <p>修数优先改源表；线下 SKU 当前读取内置 CSV；站外数据经 BigQuery / API 同步。</p>
    <div className="source-list">
      {DATA_SOURCE_GROUPS.map((group) => <div className="source-group" key={group.title}>
        <strong>{group.title}</strong>
        {group.items.map((item) => {
          const external = !item.href.startsWith("/");
          return <a className="source-link" key={`${group.title}-${item.label}`} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </a>;
        })}
      </div>)}
    </div>
  </details>;
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
  const [shopRows, setShopRows] = useState<ShopDailyRow[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState("");
  const [offsiteRows, setOffsiteRows] = useState<OffsiteRow[]>([]);
  const [offsiteLoading, setOffsiteLoading] = useState(false);
  const [offsiteError, setOffsiteError] = useState("");
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

  useEffect(() => {
    if (!unlocked || page !== "shops") return;
    let cancelled = false;
    const trendStart = addDays(currentRange.end, -29);
    const fetchRange = {
      start: [currentRange.start, previousRange.start, trendStart].sort()[0],
      end: [currentRange.end, previousRange.end].sort().at(-1) || currentRange.end,
    };
    setShopLoading(true);
    setShopError("");
    loadShopDailyData(fetchRange)
      .then((result) => { if (!cancelled) setShopRows(result); })
      .catch((reason) => { if (!cancelled) setShopError(reason instanceof Error ? reason.message : "店铺数据同步失败"); })
      .finally(() => { if (!cancelled) setShopLoading(false); });
    return () => { cancelled = true; };
  }, [currentRange, previousRange, refresh, unlocked, page]);

  useEffect(() => {
    if (!unlocked || data.length === 0 || (page !== "offsite" && page !== "overview" && page !== "link" && page !== "category")) return;
    let cancelled = false;
    setOffsiteLoading(true);
    setOffsiteError("");
    loadOffsiteData(currentRange, previousRange, data, DEFAULT_TWD_TO_CNY)
      .then((result) => { if (!cancelled) setOffsiteRows(result); })
      .catch((reason) => { if (!cancelled) setOffsiteError(reason instanceof Error ? reason.message : "站外广告数据同步失败"); })
      .finally(() => { if (!cancelled) setOffsiteLoading(false); });
    return () => { cancelled = true; };
  }, [currentRange, previousRange, refresh, unlocked, page, brand, data]);

  const visible = useMemo(() => data.filter((item) => brand === "ALL" || item.config.key === brand), [brand, data]);
  const options = useMemo(() => {
    const rows = visible.flatMap((item) => [...item.category, ...item.links]);
    return {
      categories: [...new Set(rows.map((row) => row.category).filter(Boolean))].sort(),
    };
  }, [visible]);
  const matches = (row: MetricRow) => (!productId || `${row.id} ${row.link}`.toLowerCase().includes(productId.toLowerCase())) && (!product || `${row.product} ${row.link}`.toLowerCase().includes(product.toLowerCase())) && (!category || row.category === category);
  const rowsFor = (type: "category" | "link" | "ads") => visible.flatMap((item) => (type === "category" ? item.category : type === "link" ? item.links : item.ads).filter(matches));
  const filteredOffsiteRows = useMemo(() => offsiteRows.filter((row) => (brand === "ALL" || row.brand === brand) && (!productId || `${row.id} ${row.link}`.toLowerCase().includes(productId.toLowerCase())) && (!product || row.link.toLowerCase().includes(product.toLowerCase())) && (!category || row.category === category)), [offsiteRows, brand, productId, product, category]);
  const visibleBrandSet = useMemo(() => new Set(visible.map((item) => item.config.key)), [visible]);
  const overviewOffsite = useMemo(() => offsiteRows
    .filter((row) => visibleBrandSet.has(row.brand))
    .reduce((acc, row) => ({
      spend: acc.spend + row.spend,
      previousSpend: acc.previousSpend + row.previousSpend,
      clicks: acc.clicks + row.clicks,
      previousClicks: acc.previousClicks + row.previousClicks,
    }), { spend: 0, previousSpend: 0, clicks: 0, previousClicks: 0 }), [offsiteRows, visibleBrandSet]);
  const offsiteByBrand = useMemo(() => {
    const map = new Map<BrandKey, OffsiteSpendSummary>();
    offsiteRows.forEach((row) => {
      const current = map.get(row.brand) || { spend: 0, previousSpend: 0, clicks: 0, previousClicks: 0 };
      current.spend += row.spend;
      current.previousSpend += row.previousSpend;
      current.clicks += row.clicks;
      current.previousClicks += row.previousClicks;
      map.set(row.brand, current);
    });
    return map;
  }, [offsiteRows]);
  const total = visible.reduce((acc, item) => ({
    gmv: acc.gmv + item.actualGmv,
    previous: acc.previous + item.previousActualGmv,
    orders: acc.orders + item.current.orders,
    previousOrders: acc.previousOrders + item.previous.orders,
    visitors: acc.visitors + item.current.visitors,
    previousVisitors: acc.previousVisitors + item.previous.visitors,
    cart: acc.cart + item.current.cart,
    previousCart: acc.previousCart + item.previous.cart,
    adGmv: acc.adGmv + item.current.adGmv,
    previousAdGmv: acc.previousAdGmv + item.previous.adGmv,
    adSpend: acc.adSpend + item.current.adSpend,
    previousAdSpend: acc.previousAdSpend + item.previous.adSpend,
    voucher: acc.voucher + item.voucherShopee,
    previousVoucher: acc.previousVoucher + item.previousVoucherShopee,
    goal: acc.goal + item.config.goal,
  }), { gmv: 0, previous: 0, orders: 0, previousOrders: 0, visitors: 0, previousVisitors: 0, cart: 0, previousCart: 0, adGmv: 0, previousAdGmv: 0, adSpend: 0, previousAdSpend: 0, voucher: 0, previousVoucher: 0, goal: 0 });
  const totalAdCost = total.adSpend + overviewOffsite.spend;
  const previousTotalAdCost = total.previousAdSpend + overviewOffsite.previousSpend;
  const totalRoi = totalAdCost > 0 ? total.gmv / totalAdCost : 0;
  const previousTotalRoi = previousTotalAdCost > 0 ? total.previous / previousTotalAdCost : null;

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
    <div className="dashboard-layout"><aside className="side-nav"><div className="side-brand"><span>TW / SP</span><b>品牌分析室</b></div><p className="side-label">看板入口</p><button className={brand === "ALL" && page === "overview" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("overview"); }}><strong>总览</strong><small>三品牌经营总览</small></button>{BRANDS.map((item) => <button key={item.key} style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} className={brand === item.key && page === "overview" ? "active" : ""} onClick={() => { setBrand(item.key); setPage("overview"); }}><strong>{item.key}</strong><small>{item.name}</small></button>)}<div className="side-divider" /><button className={page === "shops" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("shops"); }}><strong>店铺维度数据</strong><small>访客、销售与转化</small></button><button className={page === "channels" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("channels"); }}><strong>线上 / 线下 SKU</strong><small>销量环比与差距</small></button><div className="side-divider" /><DataSourceLinks /></aside><div className="dashboard-content">
    <header className="topbar"><div><p className="eyebrow">SALES & COST EFFICIENCY</p><h1>台湾线上销售分析</h1><p className="subtitle">聚焦费用投入对 GMV 的影响 · SKT / G2G / TP · {rangeLabel(currentRange)} 对比 {rangeLabel(previousRange)}</p></div><button className="primary-button" onClick={() => setRefresh((value) => value + 1)}>＋ 更新销售数据</button></header>
    <section className="filter-bar"><div><label>品牌</label><select value={brand} onChange={(event) => setBrand(event.target.value as "ALL" | BrandKey)}><option value="ALL">全部品牌</option>{BRANDS.map((item) => <option value={item.key} key={item.key}>{item.key} · {item.name}</option>)}</select></div><div><label>主日期从</label><input type="date" value={currentRange.start} onChange={(event) => setCurrentRange((value) => ({ ...value, start: event.target.value }))} /></div><div><label>主日期到</label><input type="date" value={currentRange.end} onChange={(event) => setCurrentRange((value) => ({ ...value, end: event.target.value }))} /></div><div><label>环比日期从</label><input type="date" value={previousRange.start} onChange={(event) => setPreviousRange((value) => ({ ...value, start: event.target.value }))} /></div><div><label>环比日期到</label><input type="date" value={previousRange.end} onChange={(event) => setPreviousRange((value) => ({ ...value, end: event.target.value }))} /></div><div><label>商品ID / ID</label><input value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="输入商品ID / ID" /></div><div><label>产品名</label><input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="搜索产品名" /></div><div><label>品类</label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部品类</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></div><button className="reset-button" onClick={resetFilters}>重置筛选</button></section>
    <nav className="page-tabs">{PAGE_LABELS.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}><b>{item.number}</b><span>{item.label}</span><small>{item.note}</small></button>)}<span className="sync-state"><i className={error || offsiteError || shopError ? "error-dot" : ""} />{loading || offsiteLoading || shopLoading ? "同步中" : "数据已同步"}</span></nav>
    {error && <div className="data-alert"><b>数据同步失败</b><span>{error}</span><button onClick={() => setRefresh((value) => value + 1)}>重新同步</button></div>}
    {offsiteError && <div className="data-alert"><b>站外广告数据同步失败</b><span>{offsiteError}</span><button onClick={() => setRefresh((value) => value + 1)}>重新同步</button></div>}
    {page === "shops" && <ShopPage rows={shopRows} brand={brand} currentRange={currentRange} previousRange={previousRange} loading={shopLoading} error={shopError} />}
    {page === "channels" ? <><ChannelSummary rows={channelData.rows} /><section className="data-page channel-page"><div className="section-title"><span>07</span><div><h2>线上 / 线下 SKU 销量对比</h2><p>线上数据来自台湾线上 SKU 销量表；线下汇总三品牌各通路原始 SKU 销量；07 独立按 SKU 匹配到 SPU 与品类，不影响链接明细和品类进度。</p></div><em>{channelLoading ? "同步中" : `${channelData.rows.length} 个SKU`}</em></div>{channelError && <div className="data-alert"><b>销量数据同步失败</b><span>{channelError}</span></div>}{channelLoading && channelData.rows.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步线上与线下 SKU 销量</strong><p>按主日期范围和环比日期范围汇总 SKU，再映射到 SPU</p></div></div> : <><div className="channel-subsection"><div><h3>品类销量对比</h3><p>先看各品牌品类层级的线上、线下差距与倍数。</p></div></div><ChannelCategoryTable rows={channelData.rows} brand={brand} /><div className="channel-subsection sku-subsection"><div><h3>SPU 销量明细</h3><p>默认按 SPU 汇总；展开后查看 SKU 码和 SKU 名。</p></div></div><ChannelSpuTable rows={channelData.rows} brand={brand} /></>}</section></> : loading && data.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步销售与广告数据</strong><p>读取三品牌的店铺、链接、商品ID和广告明细</p></div></div> : <>
      {page === "overview" && <>
        <section className="metric-grid"><MetricCard label="累计 GMV" value={formatMoney(total.gmv, true)} delta={ratio(total.gmv, total.previous)} note={`DMS折后实收 · 环比区间 ${formatMoney(total.previous, true)}`} color="#2364d8" /><MetricCard label="目标 GMV 达成" value={levelPercent(total.goal > 0 ? total.gmv / total.goal : null)} delta={total.goal > 0 ? (total.gmv - total.previous) / total.goal : null} deltaMode="pp" note={`目标 ${formatMoney(total.goal, true)}`} color="#ff766b" /><MetricCard label="综合费比" value={levelPercent(total.gmv > 0 ? totalAdCost / total.gmv : null)} delta={(total.gmv > 0 && total.previous > 0) ? totalAdCost / total.gmv - previousTotalAdCost / total.previous : null} deltaMode="pp" note="总花费 / DMS GMV" color="#1ba89c" /><MetricCard label="综合 ROI" value={rate(totalRoi)} delta={ratio(totalRoi, previousTotalRoi || 0)} note="DMS GMV / 总花费" color="#8d7bd8" /></section>
        <section className="metric-grid secondary"><MetricCard label="订单量" value={formatNumber(total.orders)} delta={ratio(total.orders, total.previousOrders)} note={`客单价 ${formatMoney(total.orders > 0 ? total.gmv / total.orders : 0)}`} color="#2364d8" /><MetricCard label="虾皮补贴券" value={formatMoney(total.voucher, true)} delta={ratio(total.voucher, total.previousVoucher)} note={`Voucher from shopee · 占GMV ${levelPercent(total.gmv > 0 ? total.voucher / total.gmv : null)}`} color="#ff766b" /><MetricCard label="站外花费" value={formatMoney(overviewOffsite.spend, true)} delta={ratio(overviewOffsite.spend, overviewOffsite.previousSpend)} note={`站外点击 ${formatNumber(overviewOffsite.clicks)}`} color="#1ba89c" /><MetricCard label="站内广告GMV占比" value={levelPercent(total.gmv > 0 ? total.adGmv / total.gmv : null)} delta={(total.gmv > 0 && total.previous > 0) ? total.adGmv / total.gmv - total.previousAdGmv / total.previous : null} deltaMode="pp" note={`站内广告GMV ${formatMoney(total.adGmv, true)}`} color="#8d7bd8" /></section>
        <section className="brand-panels">{visible.map((item) => { const brandOffsite = offsiteByBrand.get(item.config.key) || { spend: 0, previousSpend: 0, clicks: 0, previousClicks: 0 }; const mom = ratio(item.actualGmv, item.previousActualGmv); const share = total.gmv > 0 ? item.actualGmv / total.gmv : null; const previousShare = total.previous > 0 ? item.previousActualGmv / total.previous : null; const brandCost = item.current.adSpend + brandOffsite.spend; const previousBrandCost = item.previous.adSpend + brandOffsite.previousSpend; const roi = brandCost > 0 ? item.actualGmv / brandCost : null; const previousRoi = previousBrandCost > 0 ? item.previousActualGmv / previousBrandCost : null; const goalRate = item.config.goal > 0 ? item.actualGmv / item.config.goal : null; const previousGoalRate = item.config.goal > 0 ? item.previousActualGmv / item.config.goal : null; const brandColor = BRAND_COLORS[item.config.key]; return <article className="brand-panel" style={{ "--brand-color": brandColor } as React.CSSProperties} key={item.config.key}><div className="panel-title"><b>{item.config.key}</b><span>{item.config.name}</span></div><div className="brand-main"><strong>{formatMoney(item.actualGmv, true)} GMV</strong><div><small>环比区间</small><b>{percent(mom)}</b></div></div><div className="brand-stats"><div><span>目标达成</span><b>{levelPercent(goalRate)}</b><PanelDelta value={goalRate} previous={previousGoalRate} mode="pp" /></div><div><span>品牌占比</span><b>{levelPercent(share)}</b><PanelDelta value={share} previous={previousShare} mode="pp" /></div><div><span>综合ROI</span><b>{rate(roi)}</b><PanelDelta value={roi} previous={previousRoi} /></div></div><div className="brand-stats lower"><div><span>站内花费</span><b>{formatMoney(item.current.adSpend, true)}</b><PanelDelta value={item.current.adSpend} previous={item.previous.adSpend} /></div><div><span>站外花费</span><b>{formatMoney(brandOffsite.spend, true)}</b><PanelDelta value={brandOffsite.spend} previous={brandOffsite.previousSpend} /></div><div><span>站内广告GMV</span><b>{formatMoney(item.current.adGmv, true)}</b><PanelDelta value={item.current.adGmv} previous={item.previous.adGmv} /></div><div><span>订单量</span><b>{formatNumber(item.current.orders)}</b><PanelDelta value={item.current.orders} previous={item.previous.orders} /></div></div><p>点击下方页面进入 {item.config.key} 的品类、链接和广告明细。</p></article>; })}</section>
        <Insight brands={visible} offsiteSpend={overviewOffsite.spend} />
        <section className="comparison-panel"><div className="section-title"><span>01</span><div><h2>品牌每日销售与环比</h2><p>每个品牌一行：左侧比较本期 / 环比区间 GMV，右侧展示站内费比及变化。</p></div><em>{rangeLabel(currentRange)} · {rangeLabel(previousRange)}</em></div><div className="brand-daily-rows">{visible.map((item) => <DailyBrandRow key={item.config.key} item={item} comparisonLabel={comparisonLabel} currentRange={currentRange} previousRange={previousRange} />)}</div></section>
        {brand !== "ALL" && <>
          <section className="data-page"><div className="section-title"><span>02</span><div><h2>{brand} · 品类进度</h2><p>通过匹配表的商品ID补齐产品与类目。</p></div><em>{rowsFor("category").length} 条明细</em></div><Table rows={rowsFor("category")} type="category" offsiteRows={offsiteRows} /></section>
          <section className="data-page"><div className="section-title"><span>04</span><div><h2>{brand} · 链接明细</h2><p>以商品ID / ID为关联主键。</p></div><em>{rowsFor("link").length} 条明细</em></div><Table rows={rowsFor("link")} type="link" offsiteRows={offsiteRows} /></section>
          <section className="data-page"><div className="section-title"><span>05</span><div><h2>{brand} · 站外广告数据</h2><p>按电商产品名匹配链接简称，再以商品ID回填链接经营数据；混合目录仅保留广告数据。</p></div><em>{offsiteLoading ? "同步中" : `${filteredOffsiteRows.length} 条明细`}</em></div>{offsiteLoading && offsiteRows.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步站外广告数据</strong><p>读取站外投放表和产品 map</p></div></div> : <OffsiteTable rows={filteredOffsiteRows} />}</section>
          <section className="data-page"><div className="section-title"><span>06</span><div><h2>{brand} · 广告数据</h2><p>站内花费、广告GMV与投放效率。</p></div><em>{rowsFor("ads").length} 条明细</em></div><Table rows={rowsFor("ads")} type="ads" /></section>
        </>}
      </>}
      {page === "offsite" && <section className="data-page"><div className="section-title"><span>05</span><div><h2>站外广告数据</h2><p>经营数据按商品ID / ID回填现有链接明细；广告数据来自三品牌站外投放源表。</p></div><em>{offsiteLoading ? "同步中" : `${filteredOffsiteRows.length} 条明细`}</em></div>{offsiteLoading && offsiteRows.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步站外广告数据</strong><p>读取站外投放表和产品 map</p></div></div> : <OffsiteTable rows={filteredOffsiteRows} />}</section>}
      {page !== "overview" && page !== "shops" && page !== "channels" && page !== "offsite" && <section className="data-page"><div className="section-title"><span>{currentPage.number}</span><div><h2>{currentPage.label}</h2><p>{currentPage.note} · 已应用品牌、日期范围、商品ID、产品名和品类筛选。</p></div><em>{visible.reduce((sum, item) => sum + (page === "category" ? item.category.length : page === "link" ? item.links.length : item.ads.length), 0)} 条明细</em></div><Table rows={rowsFor(page)} type={page} offsiteRows={offsiteRows} /></section>}
    </>}
    <footer><span>数据源：台湾 SP 三品牌数据表</span><span>综合费比 / 综合 ROI 已按站内广告 + 站外广告总费用计算</span></footer>
    </div></div>
  </main>;
}
