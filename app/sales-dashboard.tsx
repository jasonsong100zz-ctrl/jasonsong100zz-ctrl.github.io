"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const DEFAULT_TWD_TO_CNY = 0.21;
const PASSWORD_HASH =
  "04155b15a8f39ef5739243f83ea8350c4394a2b630f2af8c26cc4972af72c21c";
const csvInFlight = new Map<string, Promise<string[][]>>();

type BrandKey = "SKT" | "G2G" | "TP";
type PageKey = "overview" | "category" | "link" | "offsite" | "ads" | "channels";
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
type OffsiteConfig = { brand: BrandKey; spreadsheetId: string; gid: number; date: string; spend: string; impressions: string; clicks: string; purchaseValue: string; productName: string; category: string; typeColumns: string[] };
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
  { key: "link", label: "链接明细", note: "商品链接经营", number: "04" },
  { key: "offsite", label: "站外广告数据", note: "站外投放与链接经营", number: "05" },
  { key: "ads", label: "广告数据", note: "站内投放效率", number: "06" },
  { key: "channels", label: "线上 / 线下 SKU", note: "销量差距与环比", number: "07" },
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
  { brand: "G2G", spreadsheetId: "1ptzr5wSndXdxAG3kCUvIJ9rhTDz5-SYdG0Rd8rFcsYk", gid: 0, date: "D", spend: "E", impressions: "F", clicks: "G", purchaseValue: "I", productName: "AC", category: "AD", typeColumns: ["N", "R", "U", "V", "W", "Y", "Z", "AE", "AF"] },
  { brand: "SKT", spreadsheetId: "1gt-oypX44RAr2Kis-pdfXfa0k-UbVNeZAg1zIcGwBs4", gid: 702107027, date: "I", spend: "C", impressions: "D", clicks: "E", purchaseValue: "F", productName: "Z", category: "Y", typeColumns: ["O", "R", "X", "Y", "AA"] },
  { brand: "TP", spreadsheetId: "1ZEvZNIULKovBaGvXC3v6jeIl_l5VDlXWkI4RhLPd7kg", gid: 1346236884, date: "A", spend: "F", impressions: "K", clicks: "L", purchaseValue: "G", productName: "Y", category: "Z", typeColumns: ["O", "R", "U", "X"] },
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
    const group = groups.get(date) || { gmv: 0, orders: …21903 tokens truncated…then((result) => { if (!cancelled) setChannelData(result); })
      .catch((reason) => { if (!cancelled) setChannelError(reason instanceof Error ? reason.message : "线上线下销量同步失败"); })
      .finally(() => { if (!cancelled) setChannelLoading(false); });
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
    <div className="dashboard-layout"><aside className="side-nav"><div className="side-brand"><span>TW / SP</span><b>品牌分析室</b></div><p className="side-label">看板入口</p><button className={brand === "ALL" && page === "overview" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("overview"); }}><strong>总览</strong><small>三品牌经营总览</small></button>{BRANDS.map((item) => <button key={item.key} style={{ "--brand-color": BRAND_COLORS[item.key] } as React.CSSProperties} className={brand === item.key && page === "overview" ? "active" : ""} onClick={() => { setBrand(item.key); setPage("overview"); }}><strong>{item.key}</strong><small>{item.name}</small></button>)}<div className="side-divider" /><button className={page === "channels" ? "active" : ""} onClick={() => { setBrand("ALL"); setPage("channels"); }}><strong>线上 / 线下 SKU</strong><small>销量环比与差距</small></button><div className="side-divider" /><DataSourceLinks /></aside><div className="dashboard-content">
    <header className="topbar"><div><p className="eyebrow">SALES & COST EFFICIENCY</p><h1>台湾线上销售分析</h1><p className="subtitle">聚焦费用投入对 GMV 的影响 · SKT / G2G / TP · {rangeLabel(currentRange)} 对比 {rangeLabel(previousRange)}</p></div><button className="primary-button" onClick={() => setRefresh((value) => value + 1)}>＋ 更新销售数据</button></header>
    <section className="filter-bar"><div><label>品牌</label><select value={brand} onChange={(event) => setBrand(event.target.value as "ALL" | BrandKey)}><option value="ALL">全部品牌</option>{BRANDS.map((item) => <option value={item.key} key={item.key}>{item.key} · {item.name}</option>)}</select></div><div><label>主日期从</label><input type="date" value={currentRange.start} onChange={(event) => setCurrentRange((value) => ({ ...value, start: event.target.value }))} /></div><div><label>主日期到</label><input type="date" value={currentRange.end} onChange={(event) => setCurrentRange((value) => ({ ...value, end: event.target.value }))} /></div><div><label>环比日期从</label><input type="date" value={previousRange.start} onChange={(event) => setPreviousRange((value) => ({ ...value, start: event.target.value }))} /></div><div><label>环比日期到</label><input type="date" value={previousRange.end} onChange={(event) => setPreviousRange((value) => ({ ...value, end: event.target.value }))} /></div><div><label>商品ID / ID</label><input value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="输入商品ID / ID" /></div><div><label>产品名</label><input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="搜索产品名" /></div><div><label>品类</label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部品类</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></div><button className="reset-button" onClick={resetFilters}>重置筛选</button></section>
    <nav className="page-tabs">{PAGE_LABELS.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}><b>{item.number}</b><span>{item.label}</span><small>{item.note}</small></button>)}<span className="sync-state"><i className={error || offsiteError ? "error-dot" : ""} />{loading || offsiteLoading ? "同步中" : "数据已同步"}</span></nav>
    {error && <div className="data-alert"><b>数据同步失败</b><span>{error}</span><button onClick={() => setRefresh((value) => value + 1)}>重新同步</button></div>}
    {offsiteError && <div className="data-alert"><b>站外广告数据同步失败</b><span>{offsiteError}</span><button onClick={() => setRefresh((value) => value + 1)}>重新同步</button></div>}
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
      {page !== "overview" && page !== "channels" && page !== "offsite" && <section className="data-page"><div className="section-title"><span>{currentPage.number}</span><div><h2>{currentPage.label}</h2><p>{currentPage.note} · 已应用品牌、日期范围、商品ID、产品名和品类筛选。</p></div><em>{visible.reduce((sum, item) => sum + (page === "category" ? item.category.length : page === "link" ? item.links.length : item.ads.length), 0)} 条明细</em></div><Table rows={rowsFor(page)} type={page} offsiteRows={offsiteRows} /></section>}
    </>}
    <footer><span>数据源：台湾 SP 三品牌数据表</span><span>综合费比 / 综合 ROI 已按站内广告 + 站外广告总费用计算</span></footer>
    </div></div>
  </main>;
}
