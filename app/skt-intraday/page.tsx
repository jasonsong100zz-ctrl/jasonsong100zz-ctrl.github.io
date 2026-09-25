"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const TIME_GID = 225938746;
const LINK_GID = 1109512359;
const ADS_GID = 1227209277;
const ADS_COLUMNS = { date: 1, exposure: 16, clicks: 17, gmv: 27, spend: 29 } as const;

type CsvRecord = Record<string, string>;
type MetricKey = "sales" | "units" | "orders" | "visitors" | "search" | "cart";
type LinkMetricKey = "sales" | "units" | "visitors" | "search" | "cart" | "buyers";
type LinkMetricValues = Record<LinkMetricKey, number>;

type TimeRecord = { date: string; hour: number; sales: number; units: number; orders: number; visitors: number; search: number; cart: number; products: number };
type LinkRecord = { date: string; name: string; id: string; metrics: LinkMetricValues };
type AdRecord = { date: string; sales: number; spend: number; exposure: number; clicks: number };
type LinkSummary = { key: string; name: string; id: string; current: LinkMetricValues; previousFull: LinkMetricValues; previousComparable: LinkMetricValues };
type DashboardData = { timeRows: TimeRecord[]; linkRows: LinkRecord[]; adsRows: AdRecord[] };

const SALES_NAMES = ["銷售額(全部訂單) (TWD)", "销售额(全部订单) (TWD)", "销售額(全部訂單) (TWD)"];
const UNITS_NAMES = ["數量(全部訂單)", "数量(全部订单)"];
const ORDERS_NAMES = ["買家(全部訂單)", "买家(全部订单)", "已下訂單", "已下订单", "訂單數", "订单数"];
const PRODUCT_NAMES = ["被購買的商品", "被购买的商品"];
const VISITOR_NAMES = ["商品訪客數", "商品访客数", "訪客數", "访客数", "访客"];
const SEARCH_NAMES = ["搜尋點擊", "搜寻点击", "搜索点击", "搜索點擊"];
const CART_NAMES = ["加入購物車(件數)", "加入购物车(件数)", "加入購物車(件)", "加入购物车(件)", "入購物車(件數)", "入购物车(件数)", "入購物車(件)", "入购物车(件)", "加購件數", "加购件数", "加購數", "加购数"];
const LINK_METRIC_KEYS: LinkMetricKey[] = ["sales", "units", "visitors", "search", "cart", "buyers"];
const LINK_METRICS: Array<{ key: LinkMetricKey; label: string; money?: boolean }> = [
  { key: "sales", label: "销售额", money: true },
  { key: "units", label: "商品数量" },
  { key: "visitors", label: "访客" },
  { key: "search", label: "搜索点击" },
  { key: "cart", label: "加购" },
  { key: "buyers", label: "买家数" },
];

const emptyLinkMetrics = (): LinkMetricValues => ({ sales: 0, units: 0, visitors: 0, search: 0, cart: 0, buyers: 0 });

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

function normalizeDate(value: string) {
  const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
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

async function loadCsv(gid: number, cacheBust: number) {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&t=${cacheBust}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet ${response.status}`);
  return recordsFromCsv(await response.text());
}

async function loadDashboardData(): Promise<DashboardData> {
  const cacheBust = Date.now();
  const [timeSource, linkSource, adsSource] = await Promise.all([loadCsv(TIME_GID, cacheBust), loadCsv(LINK_GID, cacheBust), loadCsv(ADS_GID, cacheBust)]);
  const timeRows = timeSource.map((record) => ({
    date: normalizeDate(record["日期"] || ""),
    hour: hourFromDateTime(record["日期"] || ""),
    sales: numberValue(firstValue(record, SALES_NAMES)),
    units: numberValue(firstValue(record, UNITS_NAMES)),
    orders: numberValue(firstValue(record, ORDERS_NAMES)),
    visitors: numberValue(firstValue(record, VISITOR_NAMES)),
    search: numberValue(firstValue(record, SEARCH_NAMES)),
    cart: numberValue(valueOrColumn(record, CART_NAMES, 9)),
    products: numberValue(firstValue(record, PRODUCT_NAMES)),
  })).filter((row) => row.date);
  const linkRows = linkSource.map((record) => ({
    date: normalizeDate(record["时间"] || record["時間"] || ""),
    name: record["链接简称"] || record["鏈接簡稱"] || "未命名链接",
    id: record["商品ID"] || "",
    metrics: {
      sales: numberValue(firstValue(record, SALES_NAMES)),
      units: numberValue(firstValue(record, UNITS_NAMES)),
      visitors: numberValue(firstValue(record, VISITOR_NAMES)),
      search: numberValue(firstValue(record, SEARCH_NAMES)),
      cart: numberValue(valueOrColumn(record, CART_NAMES, 36)),
      buyers: numberValue(firstValue(record, ORDERS_NAMES)),
    },
  })).filter((row) => row.date);
  const adsRows = adsSource.map((record) => ({
    date: normalizeDate(record[`__column_${ADS_COLUMNS.date}`] || firstValue(record, ["日期", "日期"])),
    sales: numberValue(record[`__column_${ADS_COLUMNS.gmv}`] || firstValue(record, ["直接銷售金額", "直接销售金额"])),
    spend: numberValue(record[`__column_${ADS_COLUMNS.spend}`] || firstValue(record, ["花費", "花费", "廣告花費", "广告花费"])),
    exposure: numberValue(record[`__column_${ADS_COLUMNS.exposure}`] || firstValue(record, ["曝光", "曝光次數", "曝光次数"])),
    clicks: numberValue(record[`__column_${ADS_COLUMNS.clicks}`] || firstValue(record, ["點擊", "点击", "點擊次數", "点击次数"])),
  })).filter((row) => row.date);
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

function sumAds(rows: AdRecord[], date: string, field: keyof Omit<AdRecord, "date">) {
  return rows.filter((row) => row.date === date).reduce((sum, row) => sum + row[field], 0);
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

function formatLinkMetric(metric: LinkMetricKey, value: number) {
  return metric === "sales" ? formatMoney(value) : formatNumber(value);
}

function MetricCard({ label, current, previous, money = false, note = "上期按历史系数估算", formatter }: { label: string; current: number; previous: number; money?: boolean; note?: string; formatter?: (value: number) => string }) {
  const delta = changeRate(current, previous);
  const formatValue = formatter || (money ? formatMoney : formatNumber);
  return <article className="intraday-card"><div className="intraday-card-label">{label}</div><strong>{formatValue(current)}</strong><div className="intraday-card-compare"><span>上期可比</span><b>{formatValue(previous)}</b></div><div className={`intraday-delta ${delta !== null && delta >= 0 ? "positive" : "negative"}`}>{formatPercent(delta)}</div><small>{note}</small></article>;
}

function HourlyTable({ rows, currentDate, previousDate, cutoff }: { rows: TimeRecord[]; currentDate: string; previousDate: string; cutoff: number }) {
  const series = Array.from({ length: cutoff + 1 }, (_, hour) => ({ hour, current: rows.find((row) => row.date === currentDate && row.hour === hour)?.sales || 0, previous: rows.find((row) => row.date === previousDate && row.hour === hour)?.sales || 0 }));
  const max = Math.max(1, ...series.flatMap((row) => [row.current, row.previous]));
  const currentTotal = series.reduce((sum, row) => sum + row.current, 0);
  const previousTotal = series.reduce((sum, row) => sum + row.previous, 0);
  return <section className="intraday-panel"><div className="intraday-panel-heading"><div><h2>全店销售额分时段</h2><p>{formatDate(currentDate)} 实际 vs {formatDate(previousDate)} 同时段实际；每行显示小时环比</p></div><span>包含 {String(cutoff).padStart(2, "0")}:00 小时<br />累计{formatMovement(changeRate(currentTotal, previousTotal))}</span></div><div className="intraday-hour-list">{series.map((row) => { const delta = changeRate(row.current, row.previous); return <div className="intraday-hour-row" key={row.hour}><b>{String(row.hour).padStart(2, "0")}:00</b><div className="intraday-bar-track"><i className="intraday-bar-current" style={{ width: `${row.current / max * 100}%` }} /><i className="intraday-bar-previous" style={{ width: `${row.previous / max * 100}%` }} /></div><span>{formatMoney(row.current)}</span><small>{formatMoney(row.previous)}</small><em className={delta !== null && delta >= 0 ? "positive-text" : "negative-text"}>{formatMovement(delta)}</em></div>; })}</div><div className="intraday-legend"><span><i className="current-dot" />当前实际</span><span><i className="previous-dot" />上期实际时段数据</span><span>环比 = 当前小时 ÷ 上期同小时 − 1</span></div></section>;
}

export default function SktIntradayPage() {
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
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDashboardData().then((result) => {
      const dates = [...new Set([...result.timeRows.map((row) => row.date), ...result.linkRows.map((row) => row.date), ...result.adsRows.map((row) => row.date)])].sort();
      const latest = dates[dates.length - 1] || "";
      setData(result);
      setCurrentDate(latest);
      setPreviousDate(previousMonthDate(latest));
      setLastUpdated(new Date());
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "数据读取失败")).finally(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [refreshVersion]);

  const availableDates = useMemo(() => [...new Set([...data.timeRows.map((row) => row.date), ...data.linkRows.map((row) => row.date), ...data.adsRows.map((row) => row.date)])].sort().reverse(), [data]);
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

  const adMetrics = useMemo(() => {
    if (!storeMetrics || !currentDate || !previousDate) return null;
    const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;
    const currentSales = sumAds(data.adsRows, currentDate, "sales");
    const currentSpend = sumAds(data.adsRows, currentDate, "spend");
    const currentExposure = sumAds(data.adsRows, currentDate, "exposure");
    const currentClicks = sumAds(data.adsRows, currentDate, "clicks");
    const previousSales = sumAds(data.adsRows, previousDate, "sales") * storeMetrics.salesCoefficient;
    const previousSpend = sumAds(data.adsRows, previousDate, "spend") * storeMetrics.salesCoefficient;
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
      currentSpendRate: ratio(currentSpend, currentStoreSales),
      previousSpendRate: ratio(previousSpend, previousStoreSales),
      currentCpc: ratio(currentSpend, currentClicks),
      previousCpc: ratio(previousSpend, previousClicks),
      currentCpm: ratio(currentSpend, currentExposure) * 1000,
      previousCpm: ratio(previousSpend, previousExposure) * 1000,
    };
  }, [currentDate, previousDate, data, storeMetrics]);

  const linkRows = useMemo(() => {
    if (!storeMetrics || !currentDate || !previousDate) return [];
    const rows = buildLinkSummary(data.linkRows, currentDate, previousDate, storeMetrics.linkCoefficients, metric);
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => !normalizedSearch || `${row.name} ${row.id}`.toLowerCase().includes(normalizedSearch));
  }, [currentDate, previousDate, data, metric, search, storeMetrics]);

  const activeMetric = LINK_METRICS.find((item) => item.key === metric) || LINK_METRICS[0];
  const refresh = () => {
    setError("");
    setRefreshing(true);
    setRefreshVersion((value) => value + 1);
  };

  if (loading) return <main className="intraday-shell"><div className="intraday-loading">正在读取 SKT 分时段数据…</div></main>;
  if (error) return <main className="intraday-shell"><div className="intraday-error"><strong>数据读取失败</strong><span>{error}</span><button type="button" onClick={refresh}>重新读取</button></div></main>;
  if (!storeMetrics) return <main className="intraday-shell"><div className="intraday-error">暂无可用数据</div></main>;

  return <main className="intraday-shell"><header className="intraday-header"><div><p className="intraday-eyebrow">SKT · INTRADAY PILOT</p><h1>分时段销售对比试用版</h1><p className="intraday-subtitle">独立试用页面，不影响原先全天看板。上期商品链接按历史分时段系数折算。</p></div><div className="intraday-header-actions"><Link href="/" className="intraday-back">返回原看板</Link><button type="button" className="intraday-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? "刷新中…" : "刷新数据"}</button>{lastUpdated && <small>更新于 {lastUpdated.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}</div></header>
    <section className="intraday-controls"><label>当前日期<select value={currentDate} onChange={(event) => { setCurrentDate(event.target.value); setPreviousDate(previousMonthDate(event.target.value)); }}>{availableDates.map((date) => <option value={date} key={date}>{date}</option>)}</select></label><label>对比日期<select value={previousDate} onChange={(event) => setPreviousDate(event.target.value)}>{availableDates.map((date) => <option value={date} key={date}>{date}</option>)}</select></label><label>截止时间<select value={cutoff} onChange={(event) => setCutoff(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option value={hour} key={hour}>包含 {String(hour).padStart(2, "0")}:00 小时</option>)}</select></label><div className="intraday-rule"><b>当前口径</b><span>{formatDate(currentDate)} 00:00～{String(cutoff).padStart(2, "0")}:59</span></div></section>
    <div className="intraday-notice"><strong>上期数据按历史系数估算</strong><span>系数来自 {formatDate(previousDate)} 店铺分时段销售数据；当前默认包含 08:00 小时。</span></div>
    <section className="intraday-cards"><MetricCard label="全店销售额" current={storeMetrics.currentSales} previous={storeMetrics.previousSales} money /><MetricCard label="全店商品数量" current={storeMetrics.currentUnits} previous={storeMetrics.previousUnits} /><MetricCard label="全店买家数" current={storeMetrics.currentOrders} previous={storeMetrics.previousOrders} /><MetricCard label="全店访客数" current={storeMetrics.currentVisitors} previous={storeMetrics.previousVisitors} /><MetricCard label="全店加购件数" current={storeMetrics.currentCart} previous={storeMetrics.previousCart} /><MetricCard label="商品链接销售额" current={sumLinks(data.linkRows, currentDate, "sales")} previous={sumLinks(data.linkRows, previousDate, "sales") * storeMetrics.linkCoefficients.sales} money /></section>
    {adMetrics && <section className="intraday-panel intraday-ads-panel"><div className="intraday-panel-heading"><div><h2>站内广告实时环比</h2><p>广告销售占比 = 广告产品直接销售金额 ÷ 商品链接销售额；上期广告指标按销售额系数估算。</p></div><span>SKT-站内广告每日</span></div><div className="intraday-ads-grid"><MetricCard label="广告直接销售额" current={adMetrics.currentSales} previous={adMetrics.previousSales} money /><MetricCard label="广告销售占比" current={adMetrics.currentSalesShare} previous={adMetrics.previousSalesShare} formatter={formatRatio} note="上期按销售额系数估算" /><MetricCard label="站内花费" current={adMetrics.currentSpend} previous={adMetrics.previousSpend} money note="上期按销售额系数估算" /><MetricCard label="站内花费费率" current={adMetrics.currentSpendRate} previous={adMetrics.previousSpendRate} formatter={formatRatio} note="花费 ÷ 全店销售额" /><MetricCard label="CPC" current={adMetrics.currentCpc} previous={adMetrics.previousCpc} formatter={formatUnitCost} note="花费 ÷ 点击；上期按系数估算" /><MetricCard label="CPM" current={adMetrics.currentCpm} previous={adMetrics.previousCpm} formatter={formatUnitCost} note="花费 ÷ 曝光 × 1,000；上期按系数估算" /></div></section>}
    <div className="intraday-grid"><HourlyTable rows={data.timeRows} currentDate={currentDate} previousDate={previousDate} cutoff={cutoff} /><section className="intraday-panel intraday-formula"><div className="intraday-panel-heading"><div><h2>本次折算参数</h2><p>用于商品链接每日数据的上期还原</p></div><span>估算</span></div><div className="intraday-formula-row"><span>销售额累计系数</span><strong>{(storeMetrics.salesCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>商品数量累计系数</span><strong>{(storeMetrics.unitsCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>访客累计系数</span><strong>{(storeMetrics.visitorsCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>搜索点击累计系数</span><strong>{(storeMetrics.searchCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>加购累计系数</span><strong>{(storeMetrics.cartCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>买家数累计系数</span><strong>{(storeMetrics.buyersCoefficient * 100).toFixed(2)}%</strong></div><p className="intraday-formula-note">上期可比值 = 上期全天值 × 对应指标累计系数。每个链接指标分别使用对应的全店分时段系数。</p></section></div>
    <section className="intraday-panel intraday-link-panel"><div className="intraday-panel-heading"><div><h2>商品链接分时段对比</h2><p>当前为实际累计数据；上期为全天链接数据按对应 SKT 系数折算。</p></div><span>{linkRows.length} 条链接</span></div><div className="intraday-table-actions"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索链接简称或商品 ID" /><div className="intraday-segment">{LINK_METRICS.map((item) => <button type="button" className={metric === item.key ? "active" : ""} onClick={() => setMetric(item.key)} key={item.key}>{item.label}</button>)}</div></div><div className="intraday-table-wrap"><table><thead><tr><th>链接简称</th><th>{formatDate(currentDate)} 当前 · {activeMetric.label}</th><th>{formatDate(previousDate)} 上期可比</th><th>差额</th><th>差异率</th><th>口径</th></tr></thead><tbody>{linkRows.slice(0, 100).map((row) => { const current = row.current[metric]; const previous = row.previousComparable[metric]; const delta = changeRate(current, previous); return <tr key={row.key}><td><b>{row.name}</b><small>{row.id || "未填写商品 ID"}</small></td><td>{formatLinkMetric(metric, current)}</td><td>{formatLinkMetric(metric, previous)}</td><td className={current - previous >= 0 ? "positive-text" : "negative-text"}>{formatLinkMetric(metric, current - previous)}</td><td className={delta !== null && delta >= 0 ? "positive-text" : "negative-text"}>{formatPercent(delta)}</td><td><em>按历史系数估算</em></td></tr>; })}</tbody></table></div></section>
    <footer className="intraday-footer"><span>数据源：SKT-店铺分时段销售数据 + SKT-店铺链接维度每日 + SKT-站内广告每日</span><span>独立试用版 · 原全天看板未修改</span></footer>
  </main>;
}
