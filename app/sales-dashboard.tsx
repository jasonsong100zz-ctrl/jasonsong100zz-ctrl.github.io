"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const DEFAULT_TWD_TO_CNY = 0.21;
const PASSWORD_HASH =
  "7f469b0b89e7f7dfe41555e78f8ae3ba21144802765fc65af724d4467e648fd2";

type BrandKey = "SKT" | "G2G" | "TP";
type PageKey = "overview" | "category" | "spu" | "link" | "ads";
type GvizRow = { c: Array<{ v?: unknown } | null> };
type MetricRow = {
  key: string;
  brand: BrandKey;
  sku: string;
  product: string;
  link: string;
  category: string;
  spu: string;
  gmv: number;
  previousGmv: number;
  orders: number;
  previousOrders: number;
  exposure: number;
  clicks: number;
  visitors: number;
  search: number;
  cart: number;
  units: number;
  adGmv: number;
  adSpend: number;
  adExposure: number;
  adClicks: number;
  conversions: number;
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
  spu: MetricRow[];
  links: MetricRow[];
  ads: MetricRow[];
  actualGmv: number;
};

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

const PAGE_LABELS: Array<{ key: PageKey; label: string; note: string; number: string }> = [
  { key: "overview", label: "品牌总览", note: "经营结果与效率", number: "01" },
  { key: "category", label: "品类进度", note: "品类贡献与转化", number: "02" },
  { key: "spu", label: "SPU表现", note: "产品结构与动销", number: "03" },
  { key: "link", label: "链接明细", note: "商品链接经营", number: "04" },
  { key: "ads", label: "广告数据", note: "站内投放效率", number: "06" },
];

const zeroMetric = (brand: BrandKey, key: string): MetricRow => ({
  key,
  brand,
  sku: "",
  product: "",
  link: "",
  category: "",
  spu: "",
  gmv: 0,
  previousGmv: 0,
  orders: 0,
  previousOrders: 0,
  exposure: 0,
  clicks: 0,
  visitors: 0,
  search: 0,
  cart: 0,
  units: 0,
  adGmv: 0,
  adSpend: 0,
  adExposure: 0,
  adClicks: 0,
  conversions: 0,
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

async function querySheet(sheet: string, query: string) {
  const params = new URLSearchParams({ tqx: "out:json", sheet, tq: query });
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`,
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

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodFor(month: string, mode: "same" | "full") {
  const [year, monthNumber] = month.split("-").map(Number);
  const today = new Date();
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
  const monthDays = new Date(year, monthNumber, 0).getDate();
  const endDay = mode === "same" && isCurrent ? today.getDate() : monthDays;
  const previousDate = new Date(year, monthNumber - 2, 1);
  const previousDays = new Date(previousDate.getFullYear(), previousDate.getMonth() + 1, 0).getDate();
  const previousEnd = mode === "same" ? Math.min(endDay, previousDays) : previousDays;
  return {
    start: isoDate(year, monthNumber, 1),
    end: isoDate(year, monthNumber, endDay),
    previousStart: isoDate(previousDate.getFullYear(), previousDate.getMonth() + 1, 1),
    previousEnd: isoDate(previousDate.getFullYear(), previousDate.getMonth() + 1, previousEnd),
    endDay,
  };
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

async function loadBrand(config: BrandConfig, month: string, comparison: "same" | "full", exchangeRate = DEFAULT_TWD_TO_CNY) {
  const period = periodFor(month, comparison);
  const previousPeriod = { start: period.previousStart, end: period.previousEnd };
  const linkGroupCategory = "AO";
  const linkGroupSpu = "AN";
  const linkGroupDetail = "A,C,D,AN,AO";
  const aggregateQuery = (start: string, end: string, group = "") =>
    metricQuery(config.linkSheet, "B", start, end, group);
  const shopQuery = (start: string, end: string) =>
    `select ${config.shopDate},sum(${config.shopGmv}),sum(${config.shopOrders}) where ${dateWhere(config.shopDate, start, end)} group by ${config.shopDate} order by ${config.shopDate} label sum(${config.shopGmv}) '',sum(${config.shopOrders}) ''`;
  const adsAggQuery = (start: string, end: string) =>
    `select sum(${config.adsGmv}),sum(${config.adsSpend}),sum(${config.adsExposure}),sum(${config.adsClicks}),sum(${config.adsConversions}) where ${dateWhere(config.adsDate, start, end)} label sum(${config.adsGmv}) '',sum(${config.adsSpend}) '',sum(${config.adsExposure}) '',sum(${config.adsClicks}) '',sum(${config.adsConversions}) ''`;
  const adsDetailQuery = `select ${config.adsProduct},${config.adsCategory},${config.adsId},sum(${config.adsGmv}),sum(${config.adsSpend}),sum(${config.adsExposure}),sum(${config.adsClicks}),sum(${config.adsConversions}) where ${dateWhere(config.adsDate, period.start, period.end)} group by ${config.adsProduct},${config.adsCategory},${config.adsId} label sum(${config.adsGmv}) '',sum(${config.adsSpend}) '',sum(${config.adsExposure}) '',sum(${config.adsClicks}) '',sum(${config.adsConversions}) ''`;
  const dmsQuery = `select sum(${config.dmsGmv}) where ${dateWhere(config.dmsDate, period.start, period.end)} label sum(${config.dmsGmv}) ''`;

  const [dailyRows, prevDailyRows, currentAll, prevAll, currentCategories, prevCategories, currentSpus, prevSpus, currentLinks, prevLinks, adsAgg, adsPrev, adsDetail, dms] = await Promise.all([
    querySheet(config.shopSheet, shopQuery(period.start, period.end)),
    querySheet(config.shopSheet, shopQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.linkSheet, aggregateQuery(period.start, period.end)),
    querySheet(config.linkSheet, aggregateQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.linkSheet, aggregateQuery(period.start, period.end, linkGroupCategory)),
    querySheet(config.linkSheet, aggregateQuery(previousPeriod.start, previousPeriod.end, linkGroupCategory)),
    querySheet(config.linkSheet, aggregateQuery(period.start, period.end, linkGroupSpu)),
    querySheet(config.linkSheet, aggregateQuery(previousPeriod.start, previousPeriod.end, linkGroupSpu)),
    querySheet(config.linkSheet, aggregateQuery(period.start, period.end, linkGroupDetail)),
    querySheet(config.linkSheet, aggregateQuery(previousPeriod.start, previousPeriod.end, linkGroupDetail)),
    querySheet(config.adsSheet, adsAggQuery(period.start, period.end)),
    querySheet(config.adsSheet, adsAggQuery(previousPeriod.start, previousPeriod.end)),
    querySheet(config.adsSheet, adsDetailQuery),
    querySheet(config.dmsSheet, dmsQuery),
  ]);

  const adTotal = [numberAt(adsAgg[0], 0), numberAt(adsAgg[0], 1), numberAt(adsAgg[0], 2), numberAt(adsAgg[0], 3), numberAt(adsAgg[0], 4)];
  const adMap = new Map<string, number[]>();
  adsDetail.forEach((row) => {
    const id = stringAt(row, 2);
    adMap.set(id, [numberAt(row, 3), numberAt(row, 4), numberAt(row, 5), numberAt(row, 6), numberAt(row, 7)]);
  });
  const decorateRows = (rows: GvizRow[], prevRows: GvizRow[], kind: "category" | "spu" | "link") => {
    const previousMap = new Map<string, number[]>();
    prevRows.forEach((row) => {
      const key = kind === "category" ? stringAt(row, 0) : kind === "spu" ? stringAt(row, 0) : stringAt(row, 1);
      previousMap.set(key, [numberAt(row, kind === "link" ? 5 : 1), numberAt(row, kind === "link" ? 6 : 2)]);
    });
    return rows.map((row, index) => {
      const dimensions = kind === "category"
        ? { category: stringAt(row, 0), product: stringAt(row, 0) }
        : kind === "spu"
          ? { spu: stringAt(row, 0), product: stringAt(row, 0) }
          : { link: stringAt(row, 0), sku: stringAt(row, 1), product: stringAt(row, 2), spu: stringAt(row, 3), category: stringAt(row, 4) };
      const offset = kind === "link" ? 5 : 1;
      const id = kind === "link" ? stringAt(row, 1) || stringAt(row, 0) : stringAt(row, 0);
      const values = Array.from({ length: 8 }, (_, i) => numberAt(row, offset + i));
      const ad = kind === "link" ? adMap.get(stringAt(row, 1)) || [] : [];
      const prev = previousMap.get(id) || [];
      return metricFromValues(config.key, `${kind}-${id}-${index}`, [...values, ad[0] || 0, ad[1] || 0, ad[2] || 0, ad[3] || 0, ad[4] || 0], dimensions, prev, exchangeRate);
    }).filter((row) => row.category || row.spu || row.link);
  };
  const daily = dailyRows.map((row) => ({ date: stringAt(row, 0), gmv: numberAt(row, 1) * exchangeRate, orders: numberAt(row, 2) }));
  const previousDaily = prevDailyRows.map((row) => ({ date: stringAt(row, 0), gmv: numberAt(row, 1) * exchangeRate, orders: numberAt(row, 2) }));
  const current = metricFromValues(config.key, `${config.key}-all`, [numberAt(currentAll[0], 0), numberAt(currentAll[0], 1), numberAt(currentAll[0], 2), numberAt(currentAll[0], 3), numberAt(currentAll[0], 4), numberAt(currentAll[0], 5), numberAt(currentAll[0], 6), numberAt(currentAll[0], 7), adTotal[0], adTotal[1], adTotal[2], adTotal[3], adTotal[4]], {}, [numberAt(prevAll[0], 0), numberAt(prevAll[0], 1)], exchangeRate);
  const previous = metricFromValues(config.key, `${config.key}-previous`, [numberAt(prevAll[0], 0), numberAt(prevAll[0], 1), numberAt(prevAll[0], 2), numberAt(prevAll[0], 3), numberAt(prevAll[0], 4), numberAt(prevAll[0], 5), numberAt(prevAll[0], 6), numberAt(prevAll[0], 7)], {}, [], exchangeRate);
  return {
    config,
    daily,
    previousDaily,
    current,
    previous,
    category: decorateRows(currentCategories, prevCategories, "category"),
    spu: decorateRows(currentSpus, prevSpus, "spu"),
    links: decorateRows(currentLinks, prevLinks, "link"),
    ads: adsDetail.map((row, index) => ({
      ...metricFromValues(config.key, `ad-${index}`, [numberAt(row, 3), 0, numberAt(row, 5), numberAt(row, 6), 0, 0, 0, 0, numberAt(row, 3), numberAt(row, 4), numberAt(row, 5), numberAt(row, 6), numberAt(row, 7)], { product: stringAt(row, 0), category: stringAt(row, 1), sku: stringAt(row, 2) }, [], exchangeRate),
    })),
    actualGmv: numberAt(dms[0], 0) * exchangeRate,
  } satisfies BrandData;
}

function ratio(current: number, previous: number) {
  return previous > 0 ? (current - previous) / previous : null;
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

function Table({ rows, type }: { rows: MetricRow[]; type: "category" | "spu" | "link" | "ads" }) {
  const sorted = [...rows].sort((a, b) => b.gmv - a.gmv).slice(0, 80);
  return <div className="table-wrap"><table><thead><tr>
    <th>{type === "category" ? "品类" : type === "spu" ? "SPU" : type === "ads" ? "产品 / 广告" : "链接 / 产品"}</th>
    {type === "link" && <><th>SKU码</th><th>产品名</th></>}
    {type === "ads" && <th>品类</th>}
    <th>GMV</th><th>环比</th><th>月累计</th><th>订单</th><th>客单价</th>
    {type !== "ads" && <><th>曝光</th><th>访客</th><th>点击</th><th>CTR</th><th>加购</th><th>加购率</th><th>CVR</th></>}
    {type === "ads" && <><th>花费</th><th>ROI</th><th>曝光</th><th>点击</th><th>CTR</th><th>CPC</th><th>CVR</th></>}
    {type !== "ads" && <><th>ROI</th><th>费比</th><th>广告GMV占比</th><th>自然GMV占比</th></>}
  </tr></thead><tbody>{sorted.map((row) => {
    const aov = row.orders > 0 ? row.gmv / row.orders : 0;
    const ctr = row.exposure > 0 ? row.clicks / row.exposure : 0;
    const cartRate = row.visitors > 0 ? row.cart / row.visitors : 0;
    const cvr = row.clicks > 0 ? row.orders / row.clicks : 0;
    const roi = row.adSpend > 0 ? row.adGmv / row.adSpend : 0;
    const fee = row.gmv > 0 ? row.adSpend / row.gmv : 0;
    const share = row.gmv > 0 ? row.adGmv / row.gmv : 0;
    return <tr key={row.key}>
      <td><b>{type === "category" ? row.category : type === "spu" ? row.spu : type === "ads" ? row.product : row.link}</b><small>{row.brand}{type === "link" ? ` · ${row.category}` : ""}</small></td>
      {type === "link" && <><td>{row.sku || "—"}</td><td>{row.product || "—"}</td></>}
      {type === "ads" && <td>{row.category || "—"}</td>}
      <td className="num">{formatMoney(row.gmv, true)}</td><td className={ratio(row.gmv, row.previousGmv) !== null && (ratio(row.gmv, row.previousGmv) || 0) >= 0 ? "up" : "down"}>{percent(ratio(row.gmv, row.previousGmv))}</td><td>{formatMoney(row.gmv, true)}</td><td>{formatNumber(row.orders)}</td><td>{formatMoney(aov)}</td>
      {type !== "ads" && <><td>{formatNumber(row.exposure)}</td><td>{formatNumber(row.visitors)}</td><td>{formatNumber(row.clicks)}</td><td>{percent(ctr)}</td><td>{formatNumber(row.cart)}</td><td>{percent(cartRate)}</td><td>{percent(cvr)}</td><td>{rate(roi)}</td><td>{percent(fee)}</td><td>{percent(share)}</td><td>{percent(1 - share)}</td></>}
      {type === "ads" && <><td>{formatMoney(row.adSpend, true)}</td><td>{rate(roi)}</td><td>{formatNumber(row.exposure)}</td><td>{formatNumber(row.clicks)}</td><td>{percent(ctr)}</td><td>{formatMoney(row.adSpend / Math.max(1, row.clicks))}</td><td>{percent(row.conversions > 0 ? row.conversions / Math.max(1, row.clicks) : 0)}</td></>}
    </tr>;
  })}</tbody></table></div>;
}

export function SalesDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [page, setPage] = useState<PageKey>("overview");
  const [month, setMonth] = useState("2026-07");
  const [comparison, setComparison] = useState<"same" | "full">("same");
  const [brand, setBrand] = useState<"ALL" | BrandKey>("ALL");
  const [storeType, setStoreType] = useState("全部店铺");
  const [sku, setSku] = useState("");
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [spu, setSpu] = useState("");
  const [link, setLink] = useState("");
  const [data, setData] = useState<BrandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => setUnlocked(sessionStorage.getItem("tw-sp-dashboard") === "unlocked"), []);
  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all(BRANDS.map((item) => loadBrand(item, month, comparison, DEFAULT_TWD_TO_CNY)))
      .then((result) => { if (!cancelled) setData(result); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "数据同步失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, comparison, refresh, unlocked]);

  const visible = useMemo(() => data.filter((item) => brand === "ALL" || item.config.key === brand), [brand, data]);
  const options = useMemo(() => {
    const rows = visible.flatMap((item) => [...item.category, ...item.spu, ...item.links]);
    return {
      categories: [...new Set(rows.map((row) => row.category).filter(Boolean))].sort(),
      spus: [...new Set(rows.map((row) => row.spu).filter(Boolean))].sort(),
    };
  }, [visible]);
  const matches = (row: MetricRow) => (!sku || `${row.sku} ${row.link}`.toLowerCase().includes(sku.toLowerCase())) && (!product || `${row.product} ${row.link}`.toLowerCase().includes(product.toLowerCase())) && (!link || row.link.toLowerCase().includes(link.toLowerCase())) && (!category || row.category === category) && (!spu || row.spu === spu);
  const rowsFor = (type: "category" | "spu" | "link" | "ads") => visible.flatMap((item) => (type === "category" ? item.category : type === "spu" ? item.spu : type === "link" ? item.links : item.ads).filter(matches));
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
  function resetFilters() { setBrand("ALL"); setStoreType("全部店铺"); setSku(""); setProduct(""); setCategory(""); setSpu(""); setLink(""); }

  if (!unlocked) return <main className="gate"><section className="gate-card"><div className="gate-signal"><span /><span /><span /></div><p className="eyebrow">SALES & COST EFFICIENCY</p><h1>台湾三品牌<br />销售分析室</h1><p className="gate-copy">聚焦 GMV、目标达成、费用效率和商品动销，支持品牌、时段、SKU码和产品名多维筛选。</p><form onSubmit={unlock}><label htmlFor="dashboard-password">访问密码</label><div className="password-row"><input id="dashboard-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入团队密码" /><button type="submit">进入看板</button></div>{passwordError && <p className="form-error">{passwordError}</p>}</form><p className="gate-note">数据来自每日更新的 Google Sheet · 轻量访问保护</p></section></main>;

  const period = periodFor(month, comparison);
  const currentPage = PAGE_LABELS.find((item) => item.key === page) || PAGE_LABELS[0];
  return <main className="dashboard">
    <div className="currency-note"><span>金额单位：人民币 CNY</span><small>源表 TWD 金额按运营口径 1 TWD = 0.21 CNY 换算；目标值保持人民币</small></div>
    <header className="topbar"><div><p className="eyebrow">SALES & COST EFFICIENCY</p><h1>台湾三品牌销售分析室</h1><p className="subtitle">聚焦费用投入对 GMV 的影响 · SKT / G2G / TP · {month.replace("-", "年")}月对比分析</p></div><button className="primary-button" onClick={() => setRefresh((value) => value + 1)}>＋ 更新销售数据</button></header>
    <section className="filter-bar"><div><label>品牌</label><select value={brand} onChange={(event) => setBrand(event.target.value as "ALL" | BrandKey)}><option value="ALL">全部品牌</option>{BRANDS.map((item) => <option value={item.key} key={item.key}>{item.key} · {item.name}</option>)}</select></div><div><label>主周期</label><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div><label>对比周期</label><select value={comparison} onChange={(event) => setComparison(event.target.value as "same" | "full")}><option value="same">上月同期</option><option value="full">上个完整月</option></select></div><div><label>店铺类型</label><select value={storeType} onChange={(event) => setStoreType(event.target.value)}><option>全部店铺</option><option>本土店</option><option>跨境店</option></select></div><div><label>SKU码</label><input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="输入 SKU / 商品ID" /></div><div><label>产品名</label><input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="搜索产品名" /></div><div><label>链接名</label><input value={link} onChange={(event) => setLink(event.target.value)} placeholder="搜索链接简称" /></div><div><label>品类</label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部品类</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></div><div><label>SPU</label><select value={spu} onChange={(event) => setSpu(event.target.value)}><option value="">全部SPU</option>{options.spus.map((item) => <option key={item}>{item}</option>)}</select></div><button className="reset-button" onClick={resetFilters}>重置筛选</button></section>
    <nav className="page-tabs">{PAGE_LABELS.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}><b>{item.number}</b><span>{item.label}</span><small>{item.note}</small></button>)}<span className="sync-state"><i className={error ? "error-dot" : ""} />{loading ? "同步中" : `截止 ${period.endDay} 日`}</span></nav>
    {error && <div className="data-alert"><b>数据同步失败</b><span>{error}</span><button onClick={() => setRefresh((value) => value + 1)}>重新同步</button></div>}
    {loading && data.length === 0 ? <div className="loading-state"><span className="loading-mark" /><div><strong>正在同步销售与广告数据</strong><p>读取三品牌的店铺、链接、SKU和广告明细</p></div></div> : <>
      {page === "overview" && <>
        <section className="metric-grid"><MetricCard label="累计 GMV" value={formatMoney(total.gmv, true)} delta={ratio(total.gmv, total.previous)} note={`上月同期 ${formatMoney(total.previous, true)}`} color="#2364d8" /><MetricCard label="目标 GMV 达成" value={total.goal > 0 ? `${(total.gmv / total.goal * 100).toFixed(1)}%` : "—"} note={`目标 ${formatMoney(total.goal, true)}`} color="#ff766b" /><MetricCard label="综合费比" value={percent(total.gmv > 0 ? total.adSpend / total.gmv : null)} note="站内花费 / GMV" color="#1ba89c" /><MetricCard label="综合 ROI" value={rate(totalRoi)} note={`广告GMV ${formatMoney(total.adGmv, true)}`} color="#8d7bd8" /></section>
        <section className="metric-grid secondary"><MetricCard label="订单量" value={formatNumber(total.orders)} note={`客单价 ${formatMoney(total.orders > 0 ? total.gmv / total.orders : 0)}`} color="#2364d8" /><MetricCard label="曝光量" value={formatNumber(total.exposure)} note={`访客 ${formatNumber(total.visitors)}`} color="#ff766b" /><MetricCard label="加购量" value={formatNumber(total.cart)} note={`加购率 ${percent(total.visitors > 0 ? total.cart / total.visitors : 0)}`} color="#1ba89c" /><MetricCard label="广告GMV占比" value={percent(total.gmv > 0 ? total.adGmv / total.gmv : 0)} note={`自然GMV ${formatMoney(Math.max(0, total.gmv - total.adGmv), true)}`} color="#8d7bd8" /></section>
        <section className="brand-panels">{visible.map((item) => { const mom = ratio(item.current.gmv, item.previous.gmv); const share = total.gmv > 0 ? item.current.gmv / total.gmv : 0; const roi = item.current.adSpend > 0 ? item.actualGmv / item.current.adSpend : 0; const brandColor = item.config.key === "G2G" ? "#bd1e67" : item.config.key === "SKT" ? "#2357af" : "#7656ba"; return <article className="brand-panel" style={{ "--brand-color": brandColor } as React.CSSProperties} key={item.config.key}><div className="panel-title"><b>{item.config.key}</b><span>{item.config.name}</span></div><div className="brand-main"><strong>{formatMoney(item.current.gmv, true)} GMV</strong><div><small>环比（{comparison === "same" ? "上月同期" : "上月"}）</small><b>{percent(mom)}</b></div></div><div className="brand-stats"><div><span>目标达成</span><b>{item.config.goal > 0 ? `${(item.current.gmv / item.config.goal * 100).toFixed(1)}%` : "—"}</b></div><div><span>品牌占比</span><b>{percent(share)}</b></div><div><span>综合ROI</span><b>{rate(roi)}</b></div></div><div className="brand-stats lower"><div><span>站内花费</span><b>{formatMoney(item.current.adSpend, true)}</b></div><div><span>广告GMV</span><b>{formatMoney(item.current.adGmv, true)}</b></div><div><span>自然GMV</span><b>{formatMoney(Math.max(0, item.current.gmv - item.current.adGmv), true)}</b></div><div><span>订单量</span><b>{formatNumber(item.current.orders)}</b></div></div><p>点击下方页面进入 {item.config.key} 的品类、SPU、链接和广告明细。</p></article>; })}</section>
        <Insight brands={visible} />
        <section className="comparison-panel"><div className="section-title"><span>01</span><div><h2>品牌每日销售与环比</h2><p>左侧为主周期 GMV，右侧为对比周期；用于判断节奏是否提前或落后。</p></div><em>{month} · {comparison === "same" ? "上月同期" : "上个完整月"}</em></div><div className="daily-grid">{visible.map((item) => { const max = Math.max(...item.daily.map((row) => row.gmv), 1); return <div className="daily-card" key={item.config.key}><h3><i style={{ background: item.config.key === "G2G" ? "#d52e82" : item.config.key === "SKT" ? "#2865d5" : "#8d7bd8" }} />{item.config.key} 每日 GMV</h3><div className="bars">{item.daily.slice(-20).map((row) => <span key={row.date} style={{ height: `${Math.max(4, row.gmv / max * 100)}%` }} title={`${row.date} ${formatMoney(row.gmv)}`} />)}</div><div className="daily-foot"><b>{formatMoney(item.current.gmv, true)}</b><span>共 {item.daily.length} 天</span></div></div>; })}</div></section>
      </>}
      {page !== "overview" && <section className="data-page"><div className="section-title"><span>{currentPage.number}</span><div><h2>{currentPage.label}</h2><p>{currentPage.note} · 已应用品牌、周期、SKU码、产品名、品类和SPU筛选。</p></div><em>{visible.reduce((sum, item) => sum + (page === "category" ? item.category.length : page === "spu" ? item.spu.length : page === "link" ? item.links.length : item.ads.length), 0)} 条明细</em></div><Table rows={rowsFor(page)} type={page} /></section>}
    </>}
    <footer><span>数据源：台湾 SP 三品牌数据表</span><span>站外投放字段预留 · 站内广告 ROI = 广告归因 GMV / 站内花费</span></footer>
  </main>;
}
