"use client";

import { useEffect, useMemo, useState } from "react";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const TIME_GID = 225938746;
const LINK_GID = 1109512359;

type CsvRecord = Record<string, string>;
type MetricKey = "sales" | "units" | "orders";

type TimeRecord = { date: string; hour: number; sales: number; units: number; orders: number; products: number };
type LinkRecord = { date: string; name: string; id: string; sales: number; units: number };
type LinkSummary = { key: string; name: string; id: string; current: number; previousFull: number; previousComparable: number; unitsCurrent: number; unitsPreviousFull: number; unitsPreviousComparable: number };
type DashboardData = { timeRows: TimeRecord[]; linkRows: LinkRecord[] };

const SALES_NAMES = ["銷售額(全部訂單) (TWD)", "销售额(全部订单) (TWD)", "销售額(全部訂單) (TWD)"];
const UNITS_NAMES = ["數量(全部訂單)", "数量(全部订单)"];
const ORDERS_NAMES = ["買家(全部訂單)", "买家(全部订单)"];
const PRODUCT_NAMES = ["被購買的商品", "被购买的商品"];

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
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function numberValue(value: string | undefined) {
  if (!value) return 0;
  return Number(value.replace(/,/g, "").replace(/%/g, "")) || 0;
}

function firstValue(record: CsvRecord, names: string[]) {
  const name = names.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  return name ? record[name] : "";
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
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 2, day);
  if (date.getDate() !== day) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
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

function changeRate(current: number, previous: number) {
  return previous ? current / previous - 1 : null;
}

async function loadCsv(gid: number) {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet ${response.status}`);
  return recordsFromCsv(await response.text());
}

async function loadDashboardData(): Promise<DashboardData> {
  const [timeSource, linkSource] = await Promise.all([loadCsv(TIME_GID), loadCsv(LINK_GID)]);
  const timeRows = timeSource.map((record) => ({
    date: normalizeDate(record["日期"] || ""),
    hour: hourFromDateTime(record["日期"] || ""),
    sales: numberValue(firstValue(record, SALES_NAMES)),
    units: numberValue(firstValue(record, UNITS_NAMES)),
    orders: numberValue(firstValue(record, ORDERS_NAMES)),
    products: numberValue(firstValue(record, PRODUCT_NAMES)),
  })).filter((row) => row.date);
  const linkRows = linkSource.map((record) => ({
    date: normalizeDate(record["时间"] || record["時間"] || ""),
    name: record["链接简称"] || record["鏈接簡稱"] || "未命名链接",
    id: record["商品ID"] || "",
    sales: numberValue(firstValue(record, SALES_NAMES)),
    units: numberValue(firstValue(record, UNITS_NAMES)),
  })).filter((row) => row.date);
  return { timeRows, linkRows };
}

function sumTime(rows: TimeRecord[], date: string, cutoff: number | null, metric: MetricKey) {
  return rows.filter((row) => row.date === date && (cutoff === null || row.hour <= cutoff)).reduce((sum, row) => sum + row[metric], 0);
}

function sumProducts(rows: TimeRecord[], date: string, cutoff: number | null) {
  return rows.filter((row) => row.date === date && (cutoff === null || row.hour <= cutoff)).reduce((sum, row) => sum + row.products, 0);
}

function sumLinks(rows: LinkRecord[], date: string, field: "sales" | "units") {
  return rows.filter((row) => row.date === date).reduce((sum, row) => sum + row[field], 0);
}

function buildLinkSummary(rows: LinkRecord[], currentDate: string, previousDate: string, salesCoefficient: number, unitsCoefficient: number) {
  const groups = new Map<string, LinkSummary>();
  rows.filter((row) => row.date === currentDate || row.date === previousDate).forEach((row) => {
    const key = `${row.name}\u0001${row.id}`;
    const group = groups.get(key) || { key, name: row.name, id: row.id, current: 0, previousFull: 0, previousComparable: 0, unitsCurrent: 0, unitsPreviousFull: 0, unitsPreviousComparable: 0 };
    if (row.date === currentDate) { group.current += row.sales; group.unitsCurrent += row.units; }
    else { group.previousFull += row.sales; group.unitsPreviousFull += row.units; }
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({ ...group, previousComparable: group.previousFull * salesCoefficient, unitsPreviousComparable: group.unitsPreviousFull * unitsCoefficient })).sort((left, right) => right.current - left.current);
}

function MetricCard({ label, current, previous, money = false, note = "上期按历史系数估算" }: { label: string; current: number; previous: number; money?: boolean; note?: string }) {
  const delta = changeRate(current, previous);
  return <article className="intraday-card"><div className="intraday-card-label">{label}</div><strong>{money ? formatMoney(current) : formatNumber(current)}</strong><div className="intraday-card-compare"><span>上期可比</span><b>{money ? formatMoney(previous) : formatNumber(previous)}</b></div><div className={`intraday-delta ${delta !== null && delta >= 0 ? "positive" : "negative"}`}>{formatPercent(delta)}</div><small>{note}</small></article>;
}

function HourlyTable({ rows, currentDate, previousDate, cutoff }: { rows: TimeRecord[]; currentDate: string; previousDate: string; cutoff: number }) {
  const series = Array.from({ length: cutoff + 1 }, (_, hour) => ({ hour, current: rows.find((row) => row.date === currentDate && row.hour === hour)?.sales || 0, previous: rows.find((row) => row.date === previousDate && row.hour === hour)?.sales || 0 }));
  const max = Math.max(1, ...series.flatMap((row) => [row.current, row.previous]));
  return <section className="intraday-panel"><div className="intraday-panel-heading"><div><h2>全店销售额分时段</h2><p>{formatDate(currentDate)} 实际 vs {formatDate(previousDate)} 同时段实际</p></div><span>包含 {String(cutoff).padStart(2, "0")}:00 小时</span></div><div className="intraday-hour-list">{series.map((row) => <div className="intraday-hour-row" key={row.hour}><b>{String(row.hour).padStart(2, "0")}:00</b><div className="intraday-bar-track"><i className="intraday-bar-current" style={{ width: `${row.current / max * 100}%` }} /><i className="intraday-bar-previous" style={{ width: `${row.previous / max * 100}%` }} /></div><span>{formatMoney(row.current)}</span><small>{formatMoney(row.previous)}</small></div>)}</div><div className="intraday-legend"><span><i className="current-dot" />当前实际</span><span><i className="previous-dot" />上期实际时段数据</span></div></section>;
}

export default function SktIntradayPage() {
  const [data, setData] = useState<DashboardData>({ timeRows: [], linkRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [previousDate, setPreviousDate] = useState("");
  const [cutoff, setCutoff] = useState(8);
  const [metric, setMetric] = useState<"sales" | "units">("sales");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDashboardData().then((result) => {
      const dates = [...new Set([...result.timeRows.map((row) => row.date), ...result.linkRows.map((row) => row.date)])].sort();
      const latest = dates[dates.length - 1] || "";
      setData(result);
      setCurrentDate(latest);
      setPreviousDate(previousMonthDate(latest));
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "数据读取失败")).finally(() => setLoading(false));
  }, []);

  const availableDates = useMemo(() => [...new Set([...data.timeRows.map((row) => row.date), ...data.linkRows.map((row) => row.date)])].sort().reverse(), [data]);
  const storeMetrics = useMemo(() => {
    if (!currentDate || !previousDate) return null;
    const previousFullSales = sumTime(data.timeRows, previousDate, null, "sales");
    const previousPartialSales = sumTime(data.timeRows, previousDate, cutoff, "sales");
    const previousFullUnits = sumTime(data.timeRows, previousDate, null, "units");
    const previousPartialUnits = sumTime(data.timeRows, previousDate, cutoff, "units");
    const previousFullOrders = sumTime(data.timeRows, previousDate, null, "orders");
    const previousPartialOrders = sumTime(data.timeRows, previousDate, cutoff, "orders");
    const salesCoefficient = previousFullSales ? previousPartialSales / previousFullSales : 0;
    const unitsCoefficient = previousFullUnits ? previousPartialUnits / previousFullUnits : 0;
    const ordersCoefficient = previousFullOrders ? previousPartialOrders / previousFullOrders : 0;
    return { currentSales: sumTime(data.timeRows, currentDate, cutoff, "sales"), currentUnits: sumTime(data.timeRows, currentDate, cutoff, "units"), currentOrders: sumTime(data.timeRows, currentDate, cutoff, "orders"), currentProducts: sumProducts(data.timeRows, currentDate, cutoff), previousSales: previousFullSales * salesCoefficient, previousUnits: previousFullUnits * unitsCoefficient, previousOrders: previousFullOrders * ordersCoefficient, previousProducts: sumProducts(data.timeRows, previousDate, cutoff), salesCoefficient, unitsCoefficient, ordersCoefficient };
  }, [currentDate, previousDate, cutoff, data]);

  const linkRows = useMemo(() => {
    if (!storeMetrics || !currentDate || !previousDate) return [];
    const rows = buildLinkSummary(data.linkRows, currentDate, previousDate, storeMetrics.salesCoefficient, storeMetrics.unitsCoefficient);
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => !normalizedSearch || `${row.name} ${row.id}`.toLowerCase().includes(normalizedSearch)).sort((left, right) => metric === "sales" ? right.current - left.current : right.unitsCurrent - left.unitsCurrent);
  }, [currentDate, previousDate, data, metric, search, storeMetrics]);

  if (loading) return <main className="intraday-shell"><div className="intraday-loading">正在读取 SKT 分时段数据…</div></main>;
  if (error) return <main className="intraday-shell"><div className="intraday-error"><strong>数据读取失败</strong><span>{error}</span><button onClick={() => window.location.reload()}>重新读取</button></div></main>;
  if (!storeMetrics) return <main className="intraday-shell"><div className="intraday-error">暂无可用数据</div></main>;

  return <main className="intraday-shell"><header className="intraday-header"><div><p className="intraday-eyebrow">SKT · INTRADAY PILOT</p><h1>分时段销售对比试用版</h1><p className="intraday-subtitle">独立试用页面，不影响原先全天看板。上期商品链接按历史分时段系数折算。</p></div><a href="/" className="intraday-back">返回原看板</a></header>
    <section className="intraday-controls"><label>当前日期<select value={currentDate} onChange={(event) => { setCurrentDate(event.target.value); setPreviousDate(previousMonthDate(event.target.value)); }}>{availableDates.map((date) => <option value={date} key={date}>{date}</option>)}</select></label><label>对比日期<select value={previousDate} onChange={(event) => setPreviousDate(event.target.value)}>{availableDates.map((date) => <option value={date} key={date}>{date}</option>)}</select></label><label>截止时间<select value={cutoff} onChange={(event) => setCutoff(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option value={hour} key={hour}>包含 {String(hour).padStart(2, "0")}:00 小时</option>)}</select></label><div className="intraday-rule"><b>当前口径</b><span>{formatDate(currentDate)} 00:00～{String(cutoff).padStart(2, "0")}:59</span></div></section>
    <div className="intraday-notice"><strong>上期数据按历史系数估算</strong><span>系数来自 {formatDate(previousDate)} 店铺分时段销售数据；当前默认包含 08:00 小时。</span></div>
    <section className="intraday-cards"><MetricCard label="全店销售额" current={storeMetrics.currentSales} previous={storeMetrics.previousSales} money /><MetricCard label="全店商品数量" current={storeMetrics.currentUnits} previous={storeMetrics.previousUnits} /><MetricCard label="全店买家数" current={storeMetrics.currentOrders} previous={storeMetrics.previousOrders} /><MetricCard label="商品链接销售额" current={sumLinks(data.linkRows, currentDate, "sales")} previous={sumLinks(data.linkRows, previousDate, "sales") * storeMetrics.salesCoefficient} money /></section>
    <div className="intraday-grid"><HourlyTable rows={data.timeRows} currentDate={currentDate} previousDate={previousDate} cutoff={cutoff} /><section className="intraday-panel intraday-formula"><div className="intraday-panel-heading"><div><h2>本次折算参数</h2><p>用于商品链接每日数据的上期还原</p></div><span>估算</span></div><div className="intraday-formula-row"><span>销售额累计系数</span><strong>{(storeMetrics.salesCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>商品数量累计系数</span><strong>{(storeMetrics.unitsCoefficient * 100).toFixed(2)}%</strong></div><div className="intraday-formula-row"><span>买家数累计系数</span><strong>{(storeMetrics.ordersCoefficient * 100).toFixed(2)}%</strong></div><p className="intraday-formula-note">上期可比值 = 上期全天值 × 对应指标累计系数。若以后有上期实际分时段数据，将优先使用实际数据。</p></section></div>
    <section className="intraday-panel intraday-link-panel"><div className="intraday-panel-heading"><div><h2>商品链接分时段对比</h2><p>当前为实际累计数据；上期为全天链接数据按 SKT 系数折算。</p></div><span>{linkRows.length} 条链接</span></div><div className="intraday-table-actions"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索链接简称或商品 ID" /><div className="intraday-segment"><button className={metric === "sales" ? "active" : ""} onClick={() => setMetric("sales")}>销售额</button><button className={metric === "units" ? "active" : ""} onClick={() => setMetric("units")}>商品数量</button></div></div><div className="intraday-table-wrap"><table><thead><tr><th>链接简称</th><th>{formatDate(currentDate)} 当前</th><th>{formatDate(previousDate)} 上期可比</th><th>差额</th><th>差异率</th><th>口径</th></tr></thead><tbody>{linkRows.slice(0, 100).map((row) => { const current = metric === "sales" ? row.current : row.unitsCurrent; const previous = metric === "sales" ? row.previousComparable : row.unitsPreviousComparable; const delta = changeRate(current, previous); return <tr key={row.key}><td><b>{row.name}</b><small>{row.id || "未填写商品 ID"}</small></td><td>{metric === "sales" ? formatMoney(current) : formatNumber(current)}</td><td>{metric === "sales" ? formatMoney(previous) : formatNumber(previous)}</td><td className={current - previous >= 0 ? "positive-text" : "negative-text"}>{metric === "sales" ? formatMoney(current - previous) : formatNumber(current - previous)}</td><td className={delta !== null && delta >= 0 ? "positive-text" : "negative-text"}>{formatPercent(delta)}</td><td><em>按历史系数估算</em></td></tr>; })}</tbody></table></div></section>
    <footer className="intraday-footer"><span>数据源：SKT-店铺分时段销售数据 + SKT-店铺链接维度每日</span><span>独立试用版 · 原全天看板未修改</span></footer>
  </main>;
}
