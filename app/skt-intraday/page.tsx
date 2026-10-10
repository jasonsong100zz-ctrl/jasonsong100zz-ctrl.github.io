"use client";

import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const MAPPING_GID = 1668472749;
const MAINTAINED_MAPPING_GID = 305051712;
const FALLBACK_CATEGORY = "其他/赠品";
const BRANDS = {
  SKT: { timeGid: 225938746, linkGid: 1109512359, adsGid: 1227209277, mappingIdColumn: 4, mappingCategoryColumn: 6, timeSheet: "SKT-店铺分时段销售数据", linkSheet: "SKT-店铺链接维度每日", adsSheet: "SKT-站内广告每日" },
  G2G: { timeGid: 1166314866, linkGid: 870428229, adsGid: 1775304605, mappingIdColumn: 17, mappingCategoryColumn: 19, timeSheet: "TP&G2G-店铺分时段销售数据", linkSheet: "G2G-店鋪鏈接維度每日", adsSheet: "G2G-站内廣告每日" },
  TP: { timeGid: 1166314866, linkGid: 22105621, adsGid: 1379096797, mappingIdColumn: 23, mappingCategoryColumn: 25, timeSheet: "TP&G2G-店铺分时段销售数据", linkSheet: "TP-店鋪鏈接維度每日", adsSheet: "TP-站内廣告每日" },
} as const;
type Brand = keyof typeof BRANDS;

type CsvRecord = Record<string, string>;
type MetricKey = "sales" | "units" | "orders" | "visitors" | "search" | "cart";
type LinkMetricKey = "sales" | "units" | "visitors" | "search" | "cart" | "buyers";
type AdMetricKey = "sales" | "spend" | "exposure" | "clicks";
type AdLinkMetricKey = "salesShare" | "cpc" | "cpm";
type LinkMetricValues = Record<LinkMetricKey, number>;
type AdLinkMetricValues = Record<AdLinkMetricKey, number>;

type TimeRecord = { date: string; hour: number; sales: number; units: number; orders: number; visitors: number; search: number; cart: number; products: number };
type LinkRecord = { date: string; name: string; id: string; category: string; metrics: LinkMetricValues };
type AdRecord = { date: string; id: string; category: string; product: boolean; sales: number; spend: number; exposure: number; clicks: number };
type LinkSummary = { key: string; name: string; id: string; current: LinkMetricValues; previousFull: LinkMetricValues; previousComparable: LinkMetricValues };
type CategorySummary = { category: string; current: LinkMetricValues; previousFull: LinkMetricValues; previousComparable: LinkMetricValues };
type AdLinkBase = { sales: number; spend: number; exposure: number; clicks: number; linkSales: number };
type AdLinkSummary = { key: string; name: string; id: string; current: AdLinkBase & AdLinkMetricValues; previousComparable: AdLinkBase & AdLinkMetricValues };
type DashboardData = { timeRows: TimeRecord[]; linkRows: LinkRecord[]; adsRows: AdRecord[] };
type ComparisonSortKey = "current" | "previous" | "delta" | "rate" | "share";
type ComparisonSort = { key: ComparisonSortKey; direction: "asc" | "desc" };

const SALES_NAMES = ["銷售額(全部訂單) (TWD)", "销售额(全部订单) (TWD)", "销售額(全部訂單) (TWD)"];
const UNITS_NAMES = ["數量(全部訂單)", "数量(全部订单)"];
const ORDERS_NAMES = ["買家(全部訂單)", "买家(全部订单)", "已下訂單", "已下订单", "訂單數", "订单数"];
const PRODUCT_NAMES = ["被購買的商品", "被购买的商品"];
const VISITOR_NAMES = ["商品訪客數", "商品访客数", "訪客數", "访客数", "访客"];
const SEARCH_NAMES = ["搜尋點擊", "搜寻点击", "搜索点击", "搜索點擊"];
const CART_NAMES = ["加入購物車(件數)", "加入购物车(件数)", "加入購物車(件)", "加入购物车(件)", "入購物車(件數)", "入购物车(件数)", "入購物車(件)", "入购物车(件)", "加購件數", "加购件数", "加購數", "加购数"];
const LINK_METRIC_KEYS: LinkMetricKey[] = ["sales", "units", "visitors", "search", "cart", "buyers"];
const AD_LINK_METRICS: Array<{ key: AdLinkMetricKey; label: string }> = [
  { key: "salesShare", label: "广告销售占比" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM（按浏览数）" },
];
const LINK_METRICS: Array<{ key: LinkMetricKey; label: string; money?: boolean }> = [
  { key: "sales", label: "销售额", money: true },
  { key: "units", label: "商品数量" },
  { key: "visitors", label: "访客" },
  { key: "search", label: "搜索点击" },
  { key: "cart", label: "加购" },
  { key: "buyers", label: "买家数" },
];

const emptyLinkMetrics = (): LinkMetricValues => ({ sales: 0, units: 0, visitors: 0, search: 0, cart: 0, buyers: 0 });

function normalizeId(value: string) {
  return value.trim().replace(/[,\s]/g, "").replace(/\.0+$/, "");
}

function normalizeCategory(value: string) {
  const characters: Record<string, string> = { 妝: "妆", 粧: "妆", 護: "护", 膚: "肤", 潔: "洁", 顏: "颜", 髮: "发", 曬: "晒", 聯: "联", 鏈: "链", 組: "组", 贈: "赠", 華: "华" };
  return (value.trim() || FALLBACK_CATEGORY).replace(/[妝粧護膚潔顏髮曬聯鏈組贈華]/g, (character) => characters[character]);
}

function isGroupPurchase(category: string) {
  return /团购|團購/.test(category);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.trim()));
}

function recordsFromCsv(text: string) {
  const rows = parseCsv(text);
  const headers = rows[0] || [];
  return rows.slice(1).map((row) => {
    const record: CsvRecord = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    headers.forEach((_, index) => { record[`__column_${index}`] = row[index] || ""; });
    return record;
  });
}

function numberValue(value: string | undefined) {
  if (!value) return 0;
  return Number(value.replace(/,/g, "").replace(/%/g, "")) || 0;
}

function normalizeHeader(value: string) {
  return value.replace(/[\s()（）]/g, "").toLowerCase();
}

function firstValue(record: CsvRecord, names: string[]) {
  const name = names.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  if (name) return record[name];
  const normalizedNames = names.map(normalizeHeader);
  const match = Object.entries(record).find(([key]) => {
    const normalizedKey = normalizeHeader(key);
    return normalizedNames.some((candidate) => normalizedKey.includes(candidate) || candidate.includes(normalizedKey));
  });
  return match ? match[1] : "";
}

function valueOrColumn(record: CsvRecord, names: string[], columnIndex: number) {
  return firstValue(record, names) || record[`__column_${columnIndex}`] || "";
}

function normalizeDate(value: string, referenceDate = "") {
  const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const shortDate = value.match(/^(\d{1,2})月(\d{1,2})日/);
  if (!shortDate || !referenceDate) return "";
  const month = shortDate[1].padStart(2, "0");
  const day = shortDate[2].padStart(2, "0");
  const year = Number(referenceDate.slice(0, 4)) - (month + day > referenceDate.slice(5) ? 1 : 0);
  return `${year}-${month}-${day}`;
}

function hourFromDateTime(value: string) {
  const match = value.match(/(?:\s|T)(\d{1,2})/);
  return match ? Number(match[1]) : 0;
}

function previousMonthDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 2, day);
  if (date.getDate() !== day) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatMoney(value: number) {
  return `NT$ ${Math.round(value).toLocaleString("en-US")}`;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatMovement(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "上涨" : "下滑"} ${Math.abs(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatUnitCost(value: number) {
  return `NT$ ${value.toFixed(2)}`;
}

function changeRate(current: number, previous: number) {
  return previous ? current / previous - 1 : null;
}

function sortComparisonRows<T>(rows: T[], sort: ComparisonSort, getValues: (row: T) => { current: number; previous: number; share?: number }) {
  const valueFor = (row: T) => {
    const values = getValues(row);
    if (sort.key === "current") return values.current;
    if (sort.key === "previous") return values.previous;
    if (sort.key === "delta") return values.current - values.previous;
    if (sort.key === "rate") return changeRate(values.current, values.previous);
    return values.share ?? null;
  };
  return [...rows].sort((left, right) => {
    const leftValue = valueFor(left);
    const rightValue = valueFor(right);
    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return (leftValue - rightValue) * (sort.direction === "asc" ? 1 : -1);
  });
}

function toggleSort(setSort: Dispatch<SetStateAction<ComparisonSort>>, key: ComparisonSortKey) {
  setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
}

function SortButton({ label, sortKey, sort, onSort }: { label: string; sortKey: ComparisonSortKey; sort: ComparisonSort; onSort: () => void }) {
  const active = sort.key === sortKey;
  return <button type="button" className={`sort-button${active ? " active" : ""}`} onClick={onSort}><span>{label}</span><i>{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</i></button>;
}

async function loadCsv(gid: number, cacheBust: number) {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&t=${cacheBust}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet ${response.status}`);
  return recordsFromCsv(await response.text());
}

async function loadDashboardData(brand: Brand): Promise<DashboardData> {
  const cacheBust = Date.now();
  const config = BRANDS[brand];
  const [timeSource, linkSource, adsSource, mappingSource, maintainedSource] = await Promise.all([loadCsv(config.timeGid, cacheBust), loadCsv(config.linkGid, cacheBust), loadCsv(config.adsGid, cacheBust), loadCsv(MAPPING_GID, cacheBust), loadCsv(MAINTAINED_MAPPING_GID, cacheBust)]);
  const categoryById = new Map<string, string>();
  mappingSource.forEach((record) => {
    const id = normalizeId(record[`__column_${config.mappingIdColumn}`] || "");
    if (id) categoryById.set(id, normalizeCategory(record[`__column_${config.mappingCategoryColumn}`] || ""));
  });
  maintainedSource.forEach((record) => {
    const brandName = (record["品牌"] || record.__column_0 || "").trim().toUpperCase();
    const matchesBrand = brand === "SKT" ? brandName.includes("SKT") || brandName.includes("SKINTIFIC") : brand === "G2G" ? brandName.includes("G2G") || brandName.includes("GLAD2GLOW") : brandName.includes("TP") || brandName.includes("TIME");
    const id = normalizeId(record["商品ID/ID"] || record.__column_1 || "");
    const category = record["品类"] || record["品類"] || record.__column_3 || "";
    if (matchesBrand && id && category.trim()) categoryById.set(id, normalizeCategory(category));
  });
  const timeRows = timeSource.map((record) => ({
    date: normalizeDate(record["日期"] || ""),
    hour: hourFromDateTime(record["日期"] || ""),
    sales: numberValue(firstValue(record, SALES_NAMES)),
    units: numberValue(firstValue(record, UNITS_NAMES)),
    orders: numberValue(firstValue(record, ORDERS_NAMES)),
    visitors: numberValue(firstValue(record, VISITOR_NAMES)),
    search: numberValue(firstValue(record, SEARCH_NAMES)),
    cart: numberValue(valueOrColumn(record, CART_NAMES, brand === "SKT" ? 9 : 10)),
    products: numberValue(firstValue(record, PRODUCT_NAMES)),
  })).filter((row, index) => row.date && (brand === "SKT" || firstValue(timeSource[index], ["店鋪名稱", "店铺名称"]).trim().toUpperCase() === brand));
  const referenceDate = timeRows.map((row) => row.date).sort().at(-1) || "";
  const linkRows = linkSource.map((record) => ({
    date: normalizeDate(record["时间"] || record["時間"] || "", referenceDate),
    name: record["链接简称"] || record["鏈接簡稱"] || "未命名链接",
    id: normalizeId(record["商品ID"] || ""),
    category: categoryById.get(normalizeId(record["商品ID"] || "")) || normalizeCategory(record["品类"] || record["品類"] || ""),
    metrics: {
      sales: numberValue(firstValue(record, SALES_NAMES)),
      units: numberValue(firstValue(record, UNITS_NAMES)),
      visitors: numberValue(firstValue(record, VISITOR_NAMES)),
      search: numberValue(firstValue(record, SEARCH_NAMES)),
      cart: numberValue(valueOrColumn(record, CART_NAMES, 36)),
      buyers: numberValue(firstValue(record, ORDERS_NAMES)),
    },
  })).filter((row) => row.date);
  const adsRows = adsSource.map((record) => {
    const id = firstValue(record, ["商品 ID", "商品ID"]).trim();
    return {
      date: normalizeDate(firstValue(record, ["日期"]), referenceDate),
      id,
      category: categoryById.get(normalizeId(id)) || FALLBACK_CATEGORY,
      product: Boolean(id && id !== "-"),
      sales: numberValue(firstValue(record, ["直接銷售金額", "直接销售金额"])),
      spend: numberValue(firstValue(record, ["花費", "花费", "廣告花費", "广告花费"])),
      exposure: numberValue(firstValue(record, ["瀏覽數", "浏览数"])),
      clicks: numberValue(firstValue(record, ["點擊數", "点击数"])),
    };
  }).filter((row) => row.date);
  return { timeRows, linkRows, adsRows };
}

function sumTime(rows: TimeRecord[], date: string, cutoff: number | null, metric: MetricKey) {
  return rows.filter((row) => row.date === date && (cutoff === null || row.hour <= cutoff)).reduce((sum, row) => sum + row[metric], 0);
}

function sumProducts(rows: TimeRecord[], date: string, cutoff: number | null) {
  return rows.filter((row) => row.date === date && (cutoff === null || row.hour <= cutoff)).reduce((sum, row) => sum + row.products, 0);
}

function sumLinks(rows: LinkRecord[], date: string, field: LinkMetricKey) {
  return rows.filter((row) => row.date === date).reduce((sum, row) => sum + row.metrics[field], 0);
}

function sumAds(rows: AdRecord[], date: string, field: AdMetricKey, productOnly = false, excludeGroupPurchase = false) {
  return rows.filter((row) => row.date === date && (!productOnly || row.product) && (!excludeGroupPurchase || !isGroupPurchase(row.category))).reduce((sum, row) => sum + row[field], 0);
}

function emptyAdLinkBase(): AdLinkBase {
  return { sales: 0, spend: 0, exposure: 0, clicks: 0, linkSales: 0 };
}

function addAdLinkMetric(target: AdLinkBase, row: AdRecord) {
  target.sales += row.sales;
  target.spend += row.spend;
  target.exposure += row.exposure;
  target.clicks += row.clicks;
}

function addLinkSales(target: AdLinkBase, row: LinkRecord) {
  target.linkSales += row.metrics.sales;
}

function scaleAdLinkBase(base: AdLinkBase, coefficient: number): AdLinkBase {
  return {
    sales: base.sales * coefficient,
    spend: base.spend * coefficient,
    exposure: base.exposure * coefficient,
    clicks: base.clicks * coefficient,
    linkSales: base.linkSales * coefficient,
  };
}

function withAdLinkMetrics(base: AdLinkBase): AdLinkBase & AdLinkMetricValues {
  const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;
  return {
    ...base,
    salesShare: ratio(base.sales, base.linkSales),
    cpc: ratio(base.spend, base.clicks),
    cpm: ratio(base.spend, base.exposure) * 1000,
  };
}

function buildAdLinkSummary(rows: AdRecord[], links: LinkRecord[], currentDate: string, previousDate: string, salesCoefficient: number, sortMetric: AdLinkMetricKey) {
  const groups = new Map<string, { key: string; name: string; id: string; current: AdLinkBase; previousFull: AdLinkBase }>();
  const names = new Map<string, string>();
  links.filter((row) => row.id).forEach((row) => {
    if (!names.has(row.id)) names.set(row.id, row.name);
  });
  rows.filter((row) => row.product && (row.date === currentDate || row.date === previousDate)).forEach((row) => {
    const group = groups.get(row.id) || { key: row.id, name: names.get(row.id) || "未匹配链接", id: row.id, current: emptyAdLinkBase(), previousFull: emptyAdLinkBase() };
    addAdLinkMetric(row.date === currentDate ? group.current : group.previousFull, row);
    groups.set(row.id, group);
  });
  links.filter((row) => row.id && (row.date === currentDate || row.date === previousDate)).forEach((row) => {
    const group = groups.get(row.id);
    if (group) addLinkSales(row.date === currentDate ? group.current : group.previousFull, row);
  });
  return [...groups.values()].map((group): AdLinkSummary => ({
    key: group.key,
    name: group.name,
    id: group.id,
    current: withAdLinkMetrics(group.current),
    previousComparable: withAdLinkMetrics(scaleAdLinkBase(group.previousFull, salesCoefficient)),
  })).sort((left, right) => right.current[sortMetric] - left.current[sortMetric]);
}

function buildLinkSummary(rows: LinkRecord[], currentDate: string, previousDate: string, coefficients: LinkMetricValues, sortMetric: LinkMetricKey) {
  const groups = new Map<string, LinkSummary>();
  rows.filter((row) => row.date === currentDate || row.date === previousDate).forEach((row) => {
    const key = `${row.name}\u0001${row.id}`;
    const group = groups.get(key) || { key, name: row.name, id: row.id, current: emptyLinkMetrics(), previousFull: emptyLinkMetrics(), previousComparable: emptyLinkMetrics() };
    const target = row.date === currentDate ? group.current : group.previousFull;
    LINK_METRIC_KEYS.forEach((metric) => { target[metric] += row.metrics[metric]; });
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    previousComparable: LINK_METRIC_KEYS.reduce((result, metric) => {
      result[metric] = group.previousFull[metric] * coefficients[metric];
      return result;
    }, emptyLinkMetrics()),
  })).sort((left, right) => right.current[sortMetric] - left.current[sortMetric]);
}

function buildCategorySummary(rows: LinkRecord[], currentDate: string, previousDate: string, coefficients: LinkMetricValues, sortMetric: LinkMetricKey) {
  const groups = new Map<string, CategorySummary>();
  rows.filter((row) => row.date === currentDate || row.date === previousDate).forEach((row) => {
    const group = groups.get(row.category) || { category: row.category, current: emptyLinkMetrics(), previousFull: emptyLinkMetrics(), previousComparable: emptyLinkMetrics() };
    const target = row.date === currentDate ? group.current : group.previousFull;
    LINK_METRIC_KEYS.forEach((metric) => { target[metric] += row.metrics[metric]; });
    groups.set(row.category, group);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    previousComparable: LINK_METRIC_KEYS.reduce((result, metric) => {
      result[metric] = group.previousFull[metric] * coefficients[metric];
      return result;
    }, emptyLinkMetrics()),
  })).sort((left, right) => right.current[sortMetric] - left.current[sortMetric]);
}

function formatLinkMetric(metric: LinkMetricKey, value: number) {
  return metric === "sales" ? formatMoney(value) : formatNumber(value);
}

function formatAdLinkMetric(metric: AdLinkMetricKey, value: number) {
  return metric === "salesShare" ? formatRatio(value) : formatUnitCost(value);
}

function MetricCard({ label, current, previous, money = false, note = "上期按历史系数估算", formatter }: { label: string; current: number; previous: number | null; money?: boolean; note?: string; formatter?: (value: number) => string }) {
  const delta = previous === null ? null : changeRate(current, previous);
  const formatValue = formatter || (money ? formatMoney : formatNumber);
  return <article className="intraday-card"><div className="intraday-card-label">{label}</div><strong>{formatValue(current)}</strong><div className="intraday-card-compare"><span>上期可比</span><b>{previous === null ? "—" : formatValue(previous)}</b></div><div className={`intraday-delta ${delta === null ? "neutral" : delta >= 0 ? "positive" : "negative"}`}>{formatPercent(delta)}</div><small>{note}</small></article>;
}

function HourlyTable({ rows, currentDate, previousDate, cutoff }: { rows: TimeRecord[]; currentDate: string; previousDate: string; cutoff: number }) {
  const series = Array.from({ length: cutoff + 1 }, (_, hour) => ({ hour, current: rows.find((row) => row.date === currentDate && row.hour === hour)?.sales || 0, previous: rows.find((row) => row.date === previousDate && row.hour === hour)?.sales || 0 }));
  const max = Math.max(1, ...series.flatMap((row) => [row.current, row.previous]));
  const currentTotal = series.reduce((sum, row) => sum + row.current, 0);
  const previousTotal = series.reduce((sum, row) => sum + row.previous, 0);
  return <section className="intraday-panel"><div className="intraday-panel-heading"><div><h2>全店销售额分时段</h2><p>{formatDate(currentDate)} 实际 vs {formatDate(previousDate)} 同时段实际；每行显示小时环比</p></div><span>包含 {String(cutoff).padStart(2, "0")}:00 小时<br />累计{formatMovement(changeRate(currentTotal, previousTotal))}</span></div><div className="intraday-hour-list">{series.map((row) => { const delta = changeRate(row.current, row.previous); return <div className="intraday-hour-row" key={row.hour}><b>{String(row.hour).padStart(2, "0")}:00</b><div className="intraday-bar-track"><i className="intraday-bar-current" style={{ width: `${row.current / max * 100}%` }} /><i className="intraday-bar-previous" style={{ width: `${row.previous / max * 100}%` }} /></div><span>{formatMoney(row.current)}</span><small>{formatMoney(row.previous)}</small><em className={delta !== null && delta >= 0 ? "positive-text" : "negative-text"}>{formatMovement(delta)}</em></div>; })}</div><div className="intraday-legend"><span><i className="current-dot" />当前实际</span><span><i className="previous-dot" />上期实际时段数据</span><span>环比 = 当前小时 ÷ 上期同小时 − 1</span></div></section>;
}

export default function SktIntradayPage() {
  const [brand, setBrand] = useState<Brand>("SKT");
  const [data, setData] = useState<DashboardData>({ timeRows: [], linkRows: [], adsRows: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [previousDate, setPreviousDate] = useState("");
  const [cutoff, setCutoff] = useState(8);
  const [metric, setMetric] = useState<LinkMetricKey>("sales");
  const [categoryMetric, setCategoryMetric] = useState<LinkMetricKey>("sales");
  const [adMetric, setAdMetric] = useState<AdLinkMetricKey>("salesShare");
  const [linkSort, setLinkSort] = useState<ComparisonSort>({ key: "current", direction: "desc" });
  const [categorySort, setCategorySort] = useState<ComparisonSort>({ key: "current", direction: "desc" });
  const [adLinkSort, setAdLinkSort] = useState<ComparisonSort>({ key: "current", direction: "desc" });
  const [search, setSearch] = useState("");
  const [adSearch, setAdSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadDashboardData(brand).then((result) => {
      if (cancelled) return;
      const dates = [...new Set(result.timeRows.map((row) => row.date))].sort();
      const latest = dates[dates.length - 1] || "";
      setData(result);
      setCurrentDate(latest);
      setPreviousDate(previousMonthDate(latest));
      setLastUpdated(new Date());
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "数据读取失败");
    }).finally(() => {
      if (!cancelled) { setLoading(false); setRefreshing(false); }
    });
    return () => { cancelled = true; };
  }, [brand, refreshVersion]);

  const availableDates = useMemo(() => [...new Set(data.timeRows.map((row) => row.date))].sort().reverse(), [data.timeRows]);
  const previousDates = useMemo(() => [...new Set([...availableDates, previousDate].filter(Boolean))].sort().reverse(), [availableDates, previousDate]);
  const storeMetrics = useMemo(() => {
    if (!currentDate || !previousDate) return null;
    const previousFullSales = sumTime(data.timeRows, previousDate, null, "sales");
    const previousPartialSales = sumTime(data.timeRows, previousDate, cutoff, "sales");
    const previousFullUnits = sumTime(data.timeRows, previousDate, null, "units");
    const previousPartialUnits = sumTime(data.timeRows, previousDate, cutoff, "units");
    const previousFullOrders = sumTime(data.timeRows, previousDate, null, "orders");
    const previousPartialOrders = sumTime(data.timeRows, previousDate, cutoff, "orders");
    const previousFullVisitors = sumTime(data.timeRows, previousDate, null, "visitors");
    const previousPartialVisitors = sumTime(data.timeRows, previousDate, cutoff, "visitors");
    const previousFullSearch = sumTime(data.timeRows, previousDate, null, "search");
    const previousPartialSearch = sumTime(data.timeRows, previousDate, cutoff, "search");
    const previousFullCart = sumTime(data.timeRows, previousDate, null, "cart");
    const previousPartialCart = sumTime(data.timeRows, previousDate, cutoff, "cart");
    const coefficient = (full: number, partial: number) => full ? partial / full : 0;
    const salesCoefficient = coefficient(previousFullSales, previousPartialSales);
    const unitsCoefficient = coefficient(previousFullUnits, previousPartialUnits);
    const buyersCoefficient = coefficient(previousFullOrders, previousPartialOrders);
    const visitorsCoefficient = coefficient(previousFullVisitors, previousPartialVisitors);
    const searchCoefficient = coefficient(previousFullSearch, previousPartialSearch);
    const cartCoefficient = coefficient(previousFullCart, previousPartialCart);
    const linkCoefficients: LinkMetricValues = { sales: salesCoefficient, units: unitsCoefficient, visitors: visitorsCoefficient, search: searchCoefficient, cart: cartCoefficient, buyers: buyersCoefficient };
    return {
      currentSales: sumTime(data.timeRows, currentDate, cutoff, "sales"),
      currentUnits: sumTime(data.timeRows, currentDate, cutoff, "units"),
      currentOrders: sumTime(data.timeRows, currentDate, cutoff, "orders"),
      currentVisitors: sumTime(data.timeRows, currentDate, cutoff, "visitors"),
      currentCart: sumTime(data.timeRows, currentDate, cutoff, "cart"),
      currentProducts: sumProducts(data.timeRows, currentDate, cutoff),
      previousSales: previousFullSales * salesCoefficient,
      previousUnits: previousFullUnits * unitsCoefficient,
      previousOrders: previousFullOrders * buyersCoefficient,
      previousVisitors: previousFullVisitors * visitorsCoefficient,
      previousCart: previousFullCart * cartCoefficient,
      previousProducts: sumProducts(data.timeRows, previousDate, cutoff),
      salesCoefficient,
      unitsCoefficient,
      buyersCoefficient,
      visitorsCoefficient,
      searchCoefficient,
      cartCoefficient,
      linkCoefficients,
    };
  }, [currentDate, previousDate, cutoff, data]);

  const nonGroupSales = useMemo(() => {
    const rows = data.linkRows.filter((row) => !isGroupPurchase(row.category));
    return { current: sumLinks(rows, currentDate, "sales"), previousFull: sumLinks(rows, previousDate, "sales") };
  }, [data.linkRows, currentDate, previousDate]);
  const currentNonGroupLinkSales = nonGroupSales.current;
  const previousNonGroupLinkSales = nonGroupSales.previousFull;
  const adMetrics = useMemo(() => {
    if (!storeMetrics || !currentDate || !previousDate) return null;
    const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;
    const currentSales = sumAds(data.adsRows, currentDate, "sales", true);
    const currentNonGroupSales = sumAds(data.adsRows, currentDate, "sales", true, true);
    const currentSpend = sumAds(data.adsRows, currentDate, "spend");
    const currentNonGroupSpend = sumAds(data.adsRows, currentDate, "spend", false, true);
    const currentExposure = sumAds(data.adsRows, currentDate, "exposure");
    const currentClicks = sumAds(data.adsRows, currentDate, "clicks");
    const previousSales = sumAds(data.adsRows, previousDate, "sales", true) * storeMetrics.salesCoefficient;
    const previousNonGroupSales = sumAds(data.adsRows, previousDate, "sales", true, true) * storeMetrics.salesCoefficient;
    const previousSpend = sumAds(data.adsRows, previousDate, "spend") * storeMetrics.salesCoefficient;
    const previousNonGroupSpend = sumAds(data.adsRows, previousDate, "spend", false, true) * storeMetrics.salesCoefficient;
    const previousExposure = sumAds(data.adsRows, previousDate, "exposure") * storeMetrics.salesCoefficient;
    const previousClicks = sumAds(data.adsRows, previousDate, "clicks") * storeMetrics.salesCoefficient;
    const currentLinkSales = sumLinks(data.linkRows, currentDate, "sales");
    const previousLinkSales = sumLinks(data.linkRows, previousDate, "sales") * storeMetrics.salesCoefficient;
    const currentStoreSales = storeMetrics.currentSales;
    const previousStoreSales = storeMetrics.previousSales;
    return {
      currentSales,
      previousSales,
      currentSpend,
      previousSpend,
      currentSalesShare: ratio(currentSales, currentLinkSales),
      previousSalesShare: ratio(previousSales, previousLinkSales),
      currentNonGroupSalesShare: ratio(currentNonGroupSales, currentNonGroupLinkSales),
      previousNonGroupSalesShare: ratio(previousNonGroupSales, previousNonGroupLinkSales * storeMetrics.salesCoefficient),
      currentSpendRate: ratio(currentSpend, currentStoreSales),
      previousSpendRate: ratio(previousSpend, previousStoreSales),
      currentNonGroupSpendRate: ratio(currentNonGroupSpend, currentNonGroupLinkSales),
      previousNonGroupSpendRate: ratio(previousNonGroupSpend, previousNonGroupLinkSales * storeMetrics.salesCoefficient),
      currentCpc: ratio(currentSpend, currentClicks),
      previousCpc: ratio(previousSpend, previousClicks),
      currentCpm: ratio(currentSpend, currentExposure) * 1000,
      previousCpm: ratio(previousSpend, previousExposure) * 1000,
      linkRows: buildAdLinkSummary(data.adsRows, data.linkRows, currentDate, previousDate, storeMetrics.salesCoefficient, adMetric),
    };
  }, [currentDate, previousDate, data, storeMetrics, adMetric, currentNonGroupLinkSales, previousNonGroupLinkSales]);

  const linkRows = useMemo(() => {
    if (!storeMetrics || !currentDate || !previousDate) return [];
    const rows = buildLinkSummary(data.linkRows, currentDate, previousDate, storeMetrics.linkCoefficients, metric);
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = rows.filter((row) => !normalizedSearch || `${row.name} ${row.id}`.toLowerCase().includes(normalizedSearch));
    return sortComparisonRows(filtered, linkSort, (row) => ({ current: row.current[metric], previous: row.previousComparable[metric] }));
  }, [currentDate, previousDate, data, metric, search, storeMetrics, linkSort]);

  const categoryRows = useMemo(() => {
    if (!storeMetrics || !currentDate || !previousDate) return [];
    const rows = buildCategorySummary(data.linkRows, currentDate, previousDate, storeMetrics.linkCoefficients, categoryMetric);
    const total = rows.reduce((sum, row) => sum + row.current[categoryMetric], 0);
    return sortComparisonRows(rows, categorySort, (row) => ({ current: row.current[categoryMetric], previous: row.previousComparable[categoryMetric], share: total ? row.current[categoryMetric] / total : 0 }));
  }, [currentDate, previousDate, data.linkRows, storeMetrics, categoryMetric, categorySort]);
  const hasHistoricalCoefficient = sumTime(data.timeRows, previousDate, null, "sales") > 0;
  const hasPreviousLinkData = data.linkRows.some((row) => row.date === previousDate);
  const hasCategoryComparison = hasHistoricalCoefficient && hasPreviousLinkData;
  const categoryTotal = categoryRows.reduce((sum, row) => sum + row.current[categoryMetric], 0);

  const activeMetric = LINK_METRICS.find((item) => item.key === metric) || LINK_METRICS[0];
  const activeCategoryMetric = LINK_METRICS.find((item) => item.key === categoryMetric) || LINK_METRICS[0];
  const activeAdMetric = AD_LINK_METRICS.find((item) => item.key === adMetric) || AD_LINK_METRICS[0];
  const adLinkRows = useMemo(() => {
    if (!adMetrics) return [];
    const normalizedSearch = adSearch.trim().toLowerCase();
    const filtered = adMetrics.linkRows.filter((row) => !normalizedSearch || `${row.name} ${row.id}`.toLowerCase().includes(normalizedSearch));
    return sortComparisonRows(filtered, adLinkSort, (row) => ({ current: row.current[adMetric], previous: row.previousComparable[adMetric] }));
  }, [adMetrics, adSearch, adMetric, adLinkSort]);
  const refresh = () => {
    setError("");
    setRefreshing(true);
    setRefreshVersion((value) => value + 1);
  };
  const switchBrand = (nextBrand: Brand) => {
    if (nextBrand === brand) return;
    setBrand(nextBrand);
    setLoading(true);
    setError("");
    setSearch("");
    setAdSearch("");
  };
  const brandSwitch = <nav className="intraday-brand-switch" aria-label="切换品牌">{(Object.keys(BRANDS) as Brand[]).map((item) => <button key={item} type="button" className={brand === item ? "active" : ""} aria-pressed={brand === item} onClick={() => switchBrand(item)}>{item}</button>)}</nav>;

  if (loading) return <main className="intraday-shell"><div className="intraday-loading">正在读取 {brand} 分时段数据…</div></main>;
  if (error) return <main className="intraday-shell">{brandSwitch}<div className="intraday-error"><strong>数据读取失败</strong><span>{error}</span><button type="button" onClick={refresh}>重新读取</button></div></main>;
  if (!storeMetrics || !availableDates.length) return <main className="intraday-shell">{brandSwitch}<div className="intraday-error">{brand} 暂无可用分时段数据<button type="button" onClick={refresh}>重新读取</button></div></main>;

  return <main className="intraday-shell"><header className="intraday-header"><div><p className="intraday-eyebrow">{brand} · INTRADAY PILOT</p><h1>分时段销售对比试用版</h1><p className="intraday-subtitle">独立试用页面，不影响原先全天看板。上期商品链接按历史分时段系数折算。</p></div><div className="intraday-header-actions"><Link href="/" className="intraday-back">返回原看板</Link><button type="button" className="intraday-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? "刷新中…" : "刷新数据"}</button>{lastUpdated && <small>更新于 {lastUpdated.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}</div></header>
    {brandSwitch}
    <section className="intraday-controls"><label>当前日期<select value={currentDate} onChange={(event) => { setCurrentDate(event.target.value); setPreviousDate(previousMonthDate(event.target.value)); }}>{availableDates.map((date) => <option value={date} key={date}>{date}</option>)}</select></label><label>对比日期<select value={previousDate} onChange={(event) => setPreviousDate(event.target.value)}>{previousDates.map((date) => <option value={date} key={date}>{date}</option>)}</select></label><label>截止时间<select value={cutoff} onChange={(event) => setCutoff(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option value={hour} key={hour}>包含 {String(hour).padStart(2, "0")}:00 小时</option>)}</select></label><div className="intraday-rule"><b>当前口径</b><span>{formatDate(currentDate)} 00:00～{String(cutoff).padStart(2, "0")}:59</span></div></section>
    <div className="intraday-notice"><strong>上期数据按历史系数估算</strong><span>系数来自 {formatDate(previousDate)} 店铺分时段销售数据；当前默认包含 08:00 小时。</span></div>
    <section className="intraday-cards"><MetricCard label="全店销售额" current={storeMetrics.currentSales} previous={storeMetrics.previousSales} money /><MetricCard label="全店商品数量" current={storeMetrics.currentUnits} previous={storeMetrics.previousUnits} /><MetricCard label="全店买家数" current={storeMetrics.currentOrders} previous={storeMetrics.previousOrders} /><MetricCard label="全店访客数" current={storeMetrics.currentVisitors} previous={storeMetrics.previousVisitors} /><MetricCard label="全店加购件数" current={storeMetrics.currentCart} previous={storeMetrics.previousCart} /><MetricCard label="商品链接销售额" current={sumLinks(data.linkRows, currentDate, "sales")} previous={sumLinks(data.linkRows, previousDate, "sales") * storeMetrics.linkCoefficients.sales} money /><MetricCard label="商品链接销售额（剔除团购）" current={nonGroupSales.current} previous={hasCategoryComparison ? nonGroupSales.previousFull * storeMetrics.salesCoefficient : null} money note={hasCategoryComparison ? "仅剔除匹配表中归为团购的链接；上期按历史系数估算" : "对比日缺少分时或链接数据，环比暂不可用"} /></section>
    <section className="intraday-panel intraday-category-panel"><div className="intraday-panel-heading"><div><h2>品类分时段对比</h2><p>按商品 ID 匹配源表品类；当前为链接实际数据，上期全天值按对应指标的分时系数折算。未匹配的链接归入“其他/赠品”。</p></div><span>{categoryRows.length} 个品类</span></div>{!hasCategoryComparison && <div className="intraday-category-warning">{formatDate(previousDate)} 缺少全店分时段或商品链接数据，上期估算和环比暂不展示。</div>}<div className="intraday-table-actions"><div className="intraday-segment">{LINK_METRICS.map((item) => <button type="button" className={categoryMetric === item.key ? "active" : ""} onClick={() => setCategoryMetric(item.key)} key={item.key}>{item.label}</button>)}</div></div><div className="intraday-table-wrap"><table><thead><tr><th>品类</th><th><SortButton label={`${formatDate(currentDate)} 当前 · ${activeCategoryMetric.label}`} sortKey="current" sort={categorySort} onSort={() => toggleSort(setCategorySort, "current")} /></th><th><SortButton label={`${formatDate(previousDate)} 上期可比`} sortKey="previous" sort={categorySort} onSort={() => toggleSort(setCategorySort, "previous")} /></th><th><SortButton label="差额" sortKey="delta" sort={categorySort} onSort={() => toggleSort(setCategorySort, "delta")} /></th><th><SortButton label="差异率" sortKey="rate" sort={categorySort} onSort={() => toggleSort(setCategorySort, "rate")} /></th><th><SortButton label="当前占比" sortKey="share" sort={categorySort} onSort={() => toggleSort(setCategorySort, "share")} /></th></tr></thead><tbody>{categoryRows.map((row) => { const current = row.current[categoryMetric]; const previous = hasCategoryComparison ? row.previousComparable[categoryMetric] : null; return <tr key={row.category}><td><b>{row.category}</b></td><td>{formatLinkMetric(categoryMetric, current)}</td><td>{previous === null ? "—" : formatLinkMetric(categoryMetric, previous)}</td><td className={previous !== null && current - previous >= 0 ? "positive-text" : "negative-text"}>{previous === null ? "—" : formatLinkMetric(categoryMetric, current - previous)}</td><td className={previous !== null && current >= previous ? "positive-text" : "negative-text"}>{previous === null ? "—" : formatPercent(changeRate(current, previous))}</td><td>{categoryTotal ? formatRatio(current / categoryTotal) : "—"}</td></tr>; })}</tbody></table></div></section>
    {adMetrics && <>
    <section className="intraday-panel intraday-ads-panel"><div className="intraday-panel-heading"><div><h2>站内广告实时环比</h2><p>总览 CPC = 全站广告花费 ÷ 全站点击；当前总览包含无商品 ID 的店铺广告行。CPM 使用源表“瀏覽數”，不是标准曝光 CPM。</p></div><span>{BRANDS[brand].adsSheet}</span></div><div className="intraday-ads-grid"><MetricCard label="广告直接销售额（产品）" current={adMetrics.currentSales} previous={adMetrics.previousSales} money /><MetricCard label="广告销售占比" current={adMetrics.currentSalesShare} previous={adMetrics.previousSalesShare} formatter={formatRatio} note="产品广告直接销售额 ÷ 商品链接销售额" /><MetricCard label="广告销售占比（剔除团购）" current={adMetrics.currentNonGroupSalesShare} previous={adMetrics.previousNonGroupSalesShare} formatter={formatRatio} note="非团购产品广告直接销售额 ÷ 非团购商品链接销售额" /><MetricCard label="站内花费" current={adMetrics.currentSpend} previous={adMetrics.previousSpend} money note="含店铺广告行；上期按销售额系数估算" /><MetricCard label="站内花费费率" current={adMetrics.currentSpendRate} previous={adMetrics.previousSpendRate} formatter={formatRatio} note="花费 ÷ 全店销售额" /><MetricCard label="站内花费费率（剔除团购）" current={adMetrics.currentNonGroupSpendRate} previous={adMetrics.previousNonGroupSpendRate} formatter={formatRatio} note="非团购广告花费 ÷ 非团购商品链接销售额" /><MetricCard label="CPC" current={adMetrics.currentCpc} previous={adMetrics.previousCpc} formatter={formatUnitCost} note="全站花费 ÷ 全站点击；上期按系数估算" /><MetricCard label="CPM（按浏览数）" current={adMetrics.currentCpm} previous={adMetrics.previousCpm} formatter={formatUnitCost} note="全站花费 ÷ 浏览数 × 1,000" /></div></section>
      <section className="intraday-panel intraday-ad-link-panel"><div className="intraday-panel-heading"><div><h2>广告链接维度实时环比</h2><p>只统计有商品 ID 的产品广告行；按商品 ID 汇总，链接销售占比 = 该链接广告直接销售额 ÷ 该链接销售额。</p></div><span>{adLinkRows.length} 条链接</span></div><div className="intraday-table-actions"><input value={adSearch} onChange={(event) => setAdSearch(event.target.value)} placeholder="搜索广告链接简称或商品 ID" /><div className="intraday-segment">{AD_LINK_METRICS.map((item) => <button type="button" className={adMetric === item.key ? "active" : ""} onClick={() => setAdMetric(item.key)} key={item.key}>{item.label}</button>)}</div></div><div className="intraday-table-wrap"><table><thead><tr><th>链接简称</th><th><SortButton label={`${formatDate(currentDate)} 当前 · ${activeAdMetric.label}`} sortKey="current" sort={adLinkSort} onSort={() => toggleSort(setAdLinkSort, "current")} /></th><th><SortButton label={`${formatDate(previousDate)} 上期可比`} sortKey="previous" sort={adLinkSort} onSort={() => toggleSort(setAdLinkSort, "previous")} /></th><th><SortButton label="差异率" sortKey="rate" sort={adLinkSort} onSort={() => toggleSort(setAdLinkSort, "rate")} /></th><th>当前投放明细</th><th>口径</th></tr></thead><tbody>{adLinkRows.slice(0, 100).map((row) => { const current = row.current[adMetric]; const previous = row.previousComparable[adMetric]; const delta = changeRate(current, previous); return <tr key={row.key}><td><b>{row.name}</b><small>{row.id}</small></td><td>{formatAdLinkMetric(adMetric, current)}</td><td>{formatAdLinkMetric(adMetric, previous)}</td><td className={delta !== null && delta >= 0 ? "positive-text" : "negative-text"}>{formatPercent(delta)}</td><td><small>花费 {formatMoney(row.current.spend)} · 点击 {formatNumber(row.current.clicks)} · 浏览 {formatNumber(row.current.exposure)}</small></td><td><em>上期按销售额系数估算</em></td></tr>; })}</tbody></table></div></section>
    </>}
    <div className="intraday-grid"><HourlyTable rows={data.timeRows} currentDate={currentDate} previousDate={previousDate} cutoff={cutoff} /><section className="intraday-panel intraday-formula"><div className="intraday-panel-heading"><div><h2>本次折算参数</h2><p>用于商品链接每日数据的上期还原</p></div><span>估算</span></div><div className="intraday-formula-row"><span>销售额累计系数</span><strong>{(storeMetrics.salesCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>商品数量累计系数</span><strong>{(storeMetrics.unitsCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>访客累计系数</span><strong>{(storeMetrics.visitorsCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>搜索点击累计系数</span><strong>{(storeMetrics.searchCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>加购累计系数</span><strong>{(storeMetrics.cartCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>买家数累计系数</span><strong>{(storeMetrics.buyersCoefficient * 100).toFixed(2)}%</strong></div><p className="intraday-formula-note">上期可比值 = 上期全天值 × 对应指标累计系数。每个链接指标分别使用对应的全店分时段系数。</p></section></div>
    <section className="intraday-panel intraday-link-panel"><div className="intraday-panel-heading"><div><h2>商品链接分时段对比</h2><p>当前为实际累计数据；上期为全天链接数据按对应 {brand} 系数折算。</p></div><span>{linkRows.length} 条链接</span></div><div className="intraday-table-actions"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索链接简称或商品 ID" /><div className="intraday-segment">{LINK_METRICS.map((item) => <button type="button" className={metric === item.key ? "active" : ""} onClick={() => setMetric(item.key)} key={item.key}>{item.label}</button>)}</div></div><div className="intraday-table-wrap"><table><thead><tr><th>链接简称</th><th><SortButton label={`${formatDate(currentDate)} 当前 · ${activeMetric.label}`} sortKey="current" sort={linkSort} onSort={() => toggleSort(setLinkSort, "current")} /></th><th><SortButton label={`${formatDate(previousDate)} 上期可比`} sortKey="previous" sort={linkSort} onSort={() => toggleSort(setLinkSort, "previous")} /></th><th><SortButton label="差额" sortKey="delta" sort={linkSort} onSort={() => toggleSort(setLinkSort, "delta")} /></th><th><SortButton label="差异率" sortKey="rate" sort={linkSort} onSort={() => toggleSort(setLinkSort, "rate")} /></th><th>口径</th></tr></thead><tbody>{linkRows.slice(0, 100).map((row) => { const current = row.current[metric]; const previous = row.previousComparable[metric]; const delta = changeRate(current, previous); return <tr key={row.key}><td><b>{row.name}</b><small>{row.id || "未填写商品 ID"}</small></td><td>{formatLinkMetric(metric, current)}</td><td>{formatLinkMetric(metric, previous)}</td><td className={current - previous >= 0 ? "positive-text" : "negative-text"}>{formatLinkMetric(metric, current - previous)}</td><td className={delta !== null && delta >= 0 ? "positive-text" : "negative-text"}>{formatPercent(delta)}</td><td><em>按历史系数估算</em></td></tr>; })}</tbody></table></div></section>
    <footer className="intraday-footer"><span>数据源：{BRANDS[brand].timeSheet} + {BRANDS[brand].linkSheet} + {BRANDS[brand].adsSheet}</span><span>独立试用版 · 原全天看板未修改</span></footer>
  </main>;
}
