"use client";

import { useEffect, useMemo, useState } from "react";

type MetricKey = "sales" | "units" | "views" | "transactionIndex";
type CurrencyKey = "TWD" | "USD";
type RankRow = {
  month: string;
  shopName: string;
  shopUrl: string;
  rank: number | null;
  rankStatus: "ranked" | "outsideTop10";
  rankBasis?: "source" | "orderedList" | null;
  sourceRank?: string | null;
  rankChange: string | null;
  value: number | null;
  valueUsd?: number | null;
  isMyShop: boolean;
};
type RankingData = {
  region: string;
  category: string;
  timezone: string;
  rankingLimit: number;
  months: string[];
  latestMonth: string;
  updatedAt: string;
  sourceFiles: string[];
  metricLabels: Record<MetricKey, string>;
  metrics: Record<MetricKey, RankRow[]>;
};
type OwnedShop = {
  key: "G2G" | "SKT";
  name: string;
  url: string;
  color: string;
  marker: "circle" | "square";
};
type TrendPoint = { month: string; row?: RankRow; x: number; y: number };

const EMPTY_MONTHS: string[] = [];
const EMPTY_RANK_ROWS: RankRow[] = [];

const OWNED_SHOPS: OwnedShop[] = [
  { key: "G2G", name: "Glad2Glow Official Store", url: "https://shopee.tw/amicosmetic.tw", color: "#bd1e67", marker: "square" },
  { key: "SKT", name: "SKINTIFIC Official Store", url: "https://shopee.tw/twskintific", color: "#2357af", marker: "circle" },
];

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "sales", label: "Sales" },
  { key: "units", label: "Units Sold" },
  { key: "views", label: "Product Views" },
  { key: "transactionIndex", label: "Transaction Index" },
];

const CHART = { width: 1000, height: 300, left: 62, right: 20, top: 20, bottom: 44 };

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function monthLabel(month: string) {
  const [year, number] = month.split("-");
  return `${year}-${Number(number)}`;
}

function numberLabel(value: number) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(value);
}

function moneyLabel(value: number, currency: CurrencyKey) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function rankLabel(row?: RankRow) {
  if (!row) return "未收录";
  return row.rank === null ? "Top10外" : `#${row.rank}`;
}

function metricValueLabel(row: RankRow | undefined, metric: MetricKey, currency: CurrencyKey) {
  if (!row) return "未收录";
  const value = metric === "sales" ? (currency === "TWD" ? row.value : row.valueUsd) : row.value;
  if (value === null || value === undefined) return "源表未提供";
  return metric === "sales" ? moneyLabel(value, currency) : numberLabel(value);
}

function displayShopName(row: RankRow) {
  const ownShop = OWNED_SHOPS.find((shop) => normalizeUrl(shop.url) === normalizeUrl(row.shopUrl));
  return ownShop?.name || row.shopName || row.shopUrl;
}

function previousMonth(months: string[], month: string) {
  const index = months.indexOf(month);
  return index > 0 ? months[index - 1] : undefined;
}

function getMetricRow(rows: RankRow[], month: string, shopUrl: string) {
  const normalized = normalizeUrl(shopUrl);
  return rows.find((row) => row.month === month && normalizeUrl(row.shopUrl) === normalized);
}

function pathSegments(points: TrendPoint[]) {
  const segments: TrendPoint[][] = [];
  let current: TrendPoint[] = [];
  for (const point of points) {
    if (!point.row || point.row.rank === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

export function IndustryShopRankingPage() {
  const [data, setData] = useState<RankingData | null>(null);
  const [metric, setMetric] = useState<MetricKey>("sales");
  const [currency, setCurrency] = useState<CurrencyKey>("TWD");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/beauty_shop_rankings_2026.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`行业排名数据读取失败（${response.status}）`);
        return response.json() as Promise<RankingData>;
      })
      .then((payload) => {
        if (!Array.isArray(payload.months) || !payload.metrics?.sales) throw new Error("行业排名数据格式不完整");
        setData(payload);
        setSelectedMonth(payload.latestMonth || payload.months[payload.months.length - 1] || "");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "行业排名数据读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const months = data?.months || EMPTY_MONTHS;
  const metricRows = data?.metrics[metric] || EMPTY_RANK_ROWS;
  const currentMonthRows = useMemo(
    () => metricRows.filter((row) => row.month === selectedMonth),
    [metricRows, selectedMonth],
  );
  const currentRankedRows = useMemo(
    () => currentMonthRows.filter((row) => row.rank !== null).sort((a, b) => (a.rank || 0) - (b.rank || 0)),
    [currentMonthRows],
  );
  const currentMonthBefore = previousMonth(months, selectedMonth);
  const priorMonthRows = currentMonthBefore ? metricRows.filter((row) => row.month === currentMonthBefore) : [];
  const priorByUrl = new Map(priorMonthRows.map((row) => [normalizeUrl(row.shopUrl), row]));
  const currentByUrl = new Map(currentMonthRows.map((row) => [normalizeUrl(row.shopUrl), row]));
  const newEntrants = currentRankedRows.filter((row) => {
    const prior = priorByUrl.get(normalizeUrl(row.shopUrl));
    return row.rank !== null && row.rank <= 10 && Boolean(prior) && (prior?.rank === null || (prior?.rank || 0) > 10);
  });
  const droppedOut = priorMonthRows
    .filter((row) => {
      const current = currentByUrl.get(normalizeUrl(row.shopUrl));
      return row.rank !== null && row.rank <= 10 && Boolean(current) && (current?.rank === null || (current?.rank || 0) > 10);
    })
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const frequencyRows = useMemo(() => OWNED_SHOPS.map((shop) => {
    const monthlyRecords = months.map((month) => getMetricRow(metricRows, month, shop.url));
    const covered = monthlyRecords.filter((row): row is RankRow => Boolean(row));
    const ranked = covered.filter((row) => row.rank !== null);
    const bestRank = ranked.length ? Math.min(...ranked.map((row) => row.rank as number)) : null;
    const selectedIndex = months.indexOf(selectedMonth);
    let streak = 0;
    for (let index = selectedIndex; index >= 0; index -= 1) {
      const row = monthlyRecords[index];
      if (!row || row.rank === null || row.rank > 20) break;
      streak += 1;
    }
    return {
      shop,
      covered: covered.length,
      top5: ranked.filter((row) => (row.rank || 0) <= 5).length,
      top10: ranked.filter((row) => (row.rank || 0) <= 10).length,
      bestRank,
      streak,
    };
  }), [metricRows, months, selectedMonth]);

  const chartMaxRank = Math.max(20, ...metricRows.map((row) => row.rank || 0));
  const trendSeries = useMemo(() => OWNED_SHOPS.map((shop) => {
    const points = months.map((month, index) => {
      const x = months.length < 2
        ? (CHART.left + CHART.width - CHART.right) / 2
        : CHART.left + index * (CHART.width - CHART.left - CHART.right) / (months.length - 1);
      const row = getMetricRow(metricRows, month, shop.url);
      const y = row?.rank === null || !row
        ? CHART.top + (CHART.height - CHART.top - CHART.bottom)
        : CHART.top + ((row.rank - 1) / (chartMaxRank - 1)) * (CHART.height - CHART.top - CHART.bottom);
      return { month, row, x, y };
    });
    return { shop, points, segments: pathSegments(points) };
  }), [chartMaxRank, metricRows, months]);

  const matrixRows = useMemo(() => {
    const shops = new Map<string, { url: string; name: string; bestRank: number | null; currentRank: number | null }>();
    for (const row of metricRows) {
      const url = normalizeUrl(row.shopUrl);
      const existing = shops.get(url);
      const ranks = [existing?.bestRank, row.rank].filter((value): value is number => value !== null && value !== undefined);
      shops.set(url, {
        url,
        name: displayShopName(row),
        bestRank: ranks.length ? Math.min(...ranks) : null,
        currentRank: row.month === selectedMonth ? row.rank : existing?.currentRank ?? null,
      });
    }
    const ownOrder = new Map(OWNED_SHOPS.map((shop, index) => [normalizeUrl(shop.url), index]));
    return [...shops.values()].sort((a, b) => {
      const ownA = ownOrder.get(a.url);
      const ownB = ownOrder.get(b.url);
      if (ownA !== undefined || ownB !== undefined) {
        if (ownA === undefined) return 1;
        if (ownB === undefined) return -1;
        return ownA - ownB;
      }
      const currentA = a.currentRank ?? Number.POSITIVE_INFINITY;
      const currentB = b.currentRank ?? Number.POSITIVE_INFINITY;
      if (currentA !== currentB) return currentA - currentB;
      const bestA = a.bestRank ?? Number.POSITIVE_INFINITY;
      const bestB = b.bestRank ?? Number.POSITIVE_INFINITY;
      if (bestA !== bestB) return bestA - bestB;
      return a.name.localeCompare(b.name, "zh-TW");
    });
  }, [metricRows, selectedMonth]);

  const availableRankCount = trendSeries.reduce((total, series) => total + series.points.filter((point) => point.row?.rank !== null && point.row !== undefined).length, 0);
  const chartTicks = [...new Set([1, 5, 10, 15, chartMaxRank])];

  return <section className="data-page industry-ranking-page">
    <div className="section-title">
      <span>08</span>
      <div>
        <h2>Beauty 行业店铺排名</h2>
        <p>台湾 Shopee Beauty 月度排名 · 关注 Glad2Glow 与 SKINTIFIC · 名次依据源表，不估算榜外位置。</p>
      </div>
      <em>{data ? `数据截至 ${monthLabel(data.latestMonth)}` : "月度排名"}</em>
    </div>

    {loading && <div className="loading-state"><span className="loading-mark" /><div><strong>正在读取行业排名</strong><p>载入台湾 Beauty 月度榜单</p></div></div>}
    {error && <div className="data-alert"><b>行业排名数据无法读取</b><span>{error}</span><button type="button" onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }}>重新加载</button></div>}

    {data && !loading && <>
      <div className="industry-controls">
        <div className="industry-metric-tabs" role="group" aria-label="排名指标">
          {METRICS.map((item) => <button type="button" key={item.key} className={metric === item.key ? "active" : ""} aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}>{item.label}</button>)}
        </div>
        <label className="industry-month-control"><span>查看月份</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="查看月份">
          {[...months].reverse().map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}
        </select></label>
        {metric === "sales" && <div className="industry-currency-control" role="group" aria-label="销售额币种">
          <button type="button" className={currency === "TWD" ? "active" : ""} aria-pressed={currency === "TWD"} onClick={() => setCurrency("TWD")}>NT$</button>
          <button type="button" className={currency === "USD" ? "active" : ""} aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")}>USD</button>
        </div>}
        <span className="industry-data-note">月度导出 · {data.sourceFiles.length} 个月</span>
      </div>

      <div className="industry-brand-cards">
        {OWNED_SHOPS.map((shop) => {
          const row = getMetricRow(metricRows, selectedMonth, shop.url);
          const stats = frequencyRows.find((item) => item.shop.key === shop.key);
          return <article className="industry-brand-card" style={{ "--industry-brand-color": shop.color } as React.CSSProperties} key={shop.key}>
            <div className="industry-brand-head"><div><b>{shop.key}</b><span>{shop.name}</span></div><small>{monthLabel(selectedMonth)}</small></div>
            <div className="industry-brand-main">
              <div><span>当前名次 · {METRICS.find((item) => item.key === metric)?.label}</span><strong>{rankLabel(row)}</strong></div>
              <div><span>{metric === "sales" ? `源表金额 · ${currency}` : `源表指标值 · ${METRICS.find((item) => item.key === metric)?.label}`}</span><strong className="industry-value">{metricValueLabel(row, metric, currency)}</strong></div>
            </div>
            <div className="industry-brand-foot"><span>源表记录 {stats?.covered || 0}/{months.length} 月</span><span>Top10 入榜 {stats?.top10 || 0} 月</span></div>
            {row?.rankStatus === "outsideTop10" && <p className="industry-record-note">该月源表记录为 Top10 外</p>}
            {row?.rankBasis === "orderedList" && <p className="industry-record-note">具体名次按源表 Top10 后的排序顺序编排</p>}
            {!row && <p className="industry-record-note">该月未列入源文件，不代表排名为零</p>}
            {row && row.rank === null && metricValueLabel(row, metric, currency) === "源表未提供" && <p className="industry-record-note">名次有记录，指标数值未提供</p>}
          </article>;
        })}
      </div>

      <div className="industry-insight-grid">
        <div className="industry-insight-column">
        <section className="industry-section-card">
          <div className="industry-section-heading"><div><h3>品牌入榜频次</h3><p>频次只统计该店在源文件有记录的月份；未收录月份不计为未入榜。</p></div><span>{monthLabel(selectedMonth)} 快照</span></div>
          <div className="industry-table-wrap">
            <table className="industry-table industry-frequency-table">
              <thead><tr><th>店铺</th><th>Top5</th><th>Top10</th><th>最佳名次</th><th>连续Top20</th><th>记录覆盖</th></tr></thead>
              <tbody>{frequencyRows.map((item) => <tr key={item.shop.key}>
                <td><span className="industry-shop-name" style={{ "--industry-brand-color": item.shop.color } as React.CSSProperties}><i />{item.shop.name}</span></td>
                <td>{item.top5}/{item.covered}</td><td>{item.top10}/{item.covered}</td><td>{item.bestRank ? `#${item.bestRank}` : "—"}</td><td>{item.streak ? `${item.streak} 月` : "—"}</td><td>{item.covered}/{months.length} 月</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="industry-section-card industry-trend-card">
          <div className="industry-section-heading"><div><h3>历史排名趋势</h3><p>纵轴倒序排列，#1 在最上方；Top10 后按源表顺序编为第 11 名起。</p></div><span>{monthLabel(months[0])}–{monthLabel(months[months.length - 1])}</span></div>
          <div className="industry-chart-legend">{OWNED_SHOPS.map((shop) => <span key={shop.key} style={{ "--industry-brand-color": shop.color } as React.CSSProperties}><i className={shop.marker} />{shop.name}</span>)}<b>{METRICS.find((item) => item.key === metric)?.label} 排名</b></div>
          <div className="industry-chart-scroll">
            <svg className="industry-rank-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={`Glad2Glow 与 SKINTIFIC 的 ${METRICS.find((item) => item.key === metric)?.label} 历史排名趋势，第一名位于顶部`}>
              <title>Glad2Glow 与 SKINTIFIC 的历史排名趋势</title>
              <desc>前十名使用源表名次，其后按源表排序顺序编号。未列入该序列的月份不连接折线。</desc>
              {chartTicks.map((rank) => {
                const y = CHART.top + ((rank - 1) / (chartMaxRank - 1)) * (CHART.height - CHART.top - CHART.bottom);
                return <g key={rank}><line className="industry-chart-grid" x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} /><text className="industry-chart-axis" x={CHART.left - 12} y={y + 4} textAnchor="end">#{rank}</text></g>;
              })}
              {months.map((month, index) => {
                const x = months.length < 2
                  ? (CHART.left + CHART.width - CHART.right) / 2
                  : CHART.left + index * (CHART.width - CHART.left - CHART.right) / (months.length - 1);
                return <text className="industry-chart-axis" x={x} y={CHART.height - 10} textAnchor="middle" key={month}>{monthLabel(month).slice(5)}月</text>;
              })}
              {trendSeries.map(({ shop, segments }) => <g key={shop.key}>
                {segments.map((segment, index) => <path className={`industry-chart-line ${shop.key === "G2G" ? "dashed" : ""}`} stroke={shop.color} d={segment.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} key={`${shop.key}-${index}`} />)}
                {segments.flat().map((point) => <g key={`${shop.key}-${point.month}`}>
                  {shop.marker === "circle"
                    ? <circle className="industry-chart-point" cx={point.x} cy={point.y} r="5" stroke={shop.color} tabIndex={0} aria-label={`${shop.name}，${monthLabel(point.month)}，排名第 ${point.row?.rank}`}>
                      <title>{`${shop.name} · ${monthLabel(point.month)} · #${point.row?.rank}`}</title>
                    </circle>
                    : <rect className="industry-chart-point" x={point.x - 5} y={point.y - 5} width="10" height="10" stroke={shop.color} tabIndex={0} aria-label={`${shop.name}，${monthLabel(point.month)}，排名第 ${point.row?.rank}`}>
                      <title>{`${shop.name} · ${monthLabel(point.month)} · #${point.row?.rank}`}</title>
                    </rect>}
                </g>)}
              </g>)}
            </svg>
          </div>
          {availableRankCount === 0 && <div className="industry-empty-note">所选指标下，关注店铺没有可绘制的排名记录。</div>}
          <p className="industry-chart-note">未出现在某月源文件中的店铺不推断排名。</p>
        </section>
        </div>

        <section className="industry-section-card">
          <div className="industry-section-heading"><div><h3>{monthLabel(selectedMonth)} 当月排名</h3><p>包含源表前十名及其后按排序顺序编号的店铺；空白指标值不补零。</p></div><span>{currentRankedRows.length} 家</span></div>
          <div className="industry-table-wrap industry-current-table-wrap">
            <table className="industry-table industry-current-table">
              <thead><tr><th>排名</th><th>店铺</th><th>{metric === "sales" ? `销售额 (${currency})` : METRICS.find((item) => item.key === metric)?.label}</th><th>源表变化</th></tr></thead>
              <tbody>{currentRankedRows.map((row) => <tr key={row.shopUrl}>
                <td><b className="industry-rank-number">#{row.rank}</b></td>
                <td><a href={row.shopUrl} target="_blank" rel="noreferrer">{displayShopName(row)}</a></td>
                <td>{metricValueLabel(row, metric, currency)}</td>
                <td>{row.rankChange && row.rankChange !== "-" ? row.rankChange : "—"}</td>
              </tr>)}
              {!currentRankedRows.length && <tr><td className="industry-no-data" colSpan={4}>该月份没有可显示的排名。</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="industry-alert-grid">
        <section className="industry-section-card industry-alert-card">
          <div className="industry-section-heading"><div><h3>本月新进 Top10</h3><p>仅在上月源表明确记录为 Top10 外时判定。</p></div><span>{newEntrants.length}</span></div>
          {newEntrants.length
            ? <ul>{newEntrants.map((row) => <li key={row.shopUrl}><b>#{row.rank}</b><a href={row.shopUrl} target="_blank" rel="noreferrer">{displayShopName(row)}</a></li>)}</ul>
            : <div className="industry-empty-note">{currentMonthBefore ? "没有可由连续月度记录确认的新进店铺。" : "没有更早月份可用于比较。"}</div>}
        </section>
        <section className="industry-section-card industry-alert-card">
          <div className="industry-section-heading"><div><h3>本月跌出 Top10</h3><p>仅在本月源表记录为 Top10 外时提示。</p></div><span>{droppedOut.length}</span></div>
          {droppedOut.length
            ? <ul>{droppedOut.map((row) => <li key={row.shopUrl}><b>上月 #{row.rank}</b><a href={row.shopUrl} target="_blank" rel="noreferrer">{displayShopName(row)}</a></li>)}</ul>
            : <div className="industry-empty-note">{currentMonthBefore ? "没有可由连续月度记录确认的跌出店铺。" : "没有更早月份可用于比较。"}</div>}
        </section>
      </div>

      <section className="industry-section-card industry-matrix-card">
        <div className="industry-section-heading"><div><h3>历史排名矩阵</h3><p>店铺按稳定链接合并。第 11 名起按源表排序顺序编排；“未收录”代表该月源文件没有该店记录。</p></div><span>{matrixRows.length} 家店 · {months.length} 个月</span></div>
        <div className="industry-matrix-wrap">
          <table className="industry-table industry-matrix-table">
            <thead><tr><th>店铺</th>{months.map((month) => <th key={month}>{monthLabel(month)}</th>)}</tr></thead>
            <tbody>{matrixRows.map((shop) => <tr key={shop.url}>
              <td><a className="industry-matrix-shop" href={shop.url} target="_blank" rel="noreferrer">{shop.name}</a><small>{shop.url.replace(/^https?:\/\//, "")}</small></td>
              {months.map((month) => {
                const row = getMetricRow(metricRows, month, shop.url);
                const cellLabel = row ? rankLabel(row) : "未收录";
                const tone = row?.rank === null ? "outside" : row?.rank !== undefined && row?.rank <= 3 ? "top-three" : row?.rank !== undefined && row?.rank <= 5 ? "top-five" : row?.rank !== undefined ? "ranked" : "missing";
                return <td className={`industry-rank-cell ${tone}`} title={`${monthLabel(month)} · ${shop.name} · ${cellLabel}`} aria-label={`${monthLabel(month)}，${shop.name}，${cellLabel}`} key={month}>{row?.rank !== null && row ? `#${row.rank}` : cellLabel}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <p className="industry-source-note">来源：Shopee BrandPortal 台湾 Beauty 店铺排名月度导出。数据文件生成于 {data.updatedAt}，最新覆盖月份为 {monthLabel(data.latestMonth)}。</p>
      </section>
    </>}
  </section>;
}
