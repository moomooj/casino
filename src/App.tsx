import React, { useState, useEffect, useMemo } from "react";
import "./App.css";

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type RouletteNumber = number | "00";

function getPocketColor(value: RouletteNumber): "red" | "black" | "green" {
  if (value === 0 || value === "00") return "green";
  return RED_NUMBERS.has(value) ? "red" : "black";
}

function toKey(value: RouletteNumber) {
  return String(value);
}

/** American roulette wheel order (clockwise from top) */
const WHEEL_ORDER: RouletteNumber[] = [
  0,
  28,
  9,
  26,
  30,
  11,
  7,
  20,
  32,
  17,
  5,
  22,
  34,
  15,
  3,
  24,
  36,
  13,
  1,
  "00",
  27,
  10,
  25,
  29,
  12,
  8,
  19,
  31,
  18,
  6,
  21,
  33,
  16,
  4,
  23,
  35,
  14,
  2,
];

const CX = 100;
const CY = 100;
const R_OUTER = 98;
const R_INNER = 62;
const R_LABEL = 80;
const R_BAR_MIN = 16;

function polar(r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

function ringSegment(rOut: number, rIn: number, start: number, end: number) {
  const o1 = polar(rOut, start);
  const o2 = polar(rOut, end);
  const i2 = polar(rIn, end);
  const i1 = polar(rIn, start);
  const large = end - start > 180 ? 1 : 0;

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

function countSpins(spins: RouletteNumber[]) {
  const map = new Map<string, number>();
  for (const n of spins) {
    const key = toKey(n);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function parseRouletteNumber(key: string): RouletteNumber {
  if (key === "00") return "00";
  return Number(key);
}

function getHotNumbers(spins: RouletteNumber[], limit = 4) {
  const counts = countSpins(spins);

  return [...counts.entries()]
    .map(([key, count]) => ({
      value: parseRouletteNumber(key),
      count,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || String(a.value).localeCompare(String(b.value)),
    )
    .slice(0, limit);
}

function getColdNumbers(spins: RouletteNumber[], limit = 4) {
  const counts = new Map<string, number>();
  const lastSeen = new Map<string, number>();

  WHEEL_ORDER.forEach((n) => {
    const key = toKey(n);
    counts.set(key, 0);
    lastSeen.set(key, -1);
  });

  spins.forEach((n, i) => {
    const key = toKey(n);
    counts.set(key, counts.get(key)! + 1);
    lastSeen.set(key, i);
  });

  return [...counts.entries()]
    .map(([key, count]) => ({
      value: parseRouletteNumber(key),
      count,
      lastIndex: lastSeen.get(key)!,
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.lastIndex - b.lastIndex;
    })
    .slice(0, limit);
}

// 🔥 연속 출현(Streak) 계산 함수 추가
function getActiveStreaks(spins: RouletteNumber[]) {
  if (spins.length < 3) return []; // 3번 미만이면 알림 없음

  const reversed = [...spins].reverse();
  const streaks: {
    type: string;
    value: string;
    count: number;
    label: string;
  }[] = [];

  // 1. 색상(Color) 연속 출현 검사
  const lastColor = getPocketColor(reversed[0]);
  let colorCount = 0;
  for (const n of reversed) {
    if (getPocketColor(n) === lastColor) colorCount++;
    else break;
  }
  if (colorCount >= 3) {
    streaks.push({
      type: "color",
      value: lastColor,
      count: colorCount,
      label: lastColor.toUpperCase(),
    });
  }

  // 2. 홀/짝(Odd/Even) 연속 출현 검사 (0, 00은 홀/짝에서 제외되므로 흐름이 끊김)
  if (reversed[0] !== 0 && reversed[0] !== "00") {
    const lastParity = (reversed[0] as number) % 2 === 0 ? "even" : "odd";
    let parityCount = 0;
    for (const n of reversed) {
      if (n === 0 || n === "00") break;
      const currentParity = (n as number) % 2 === 0 ? "even" : "odd";
      if (currentParity === lastParity) parityCount++;
      else break;
    }
    if (parityCount >= 3) {
      streaks.push({
        type: "parity",
        value: lastParity,
        count: parityCount,
        label: lastParity.toUpperCase(),
      });
    }
  }

  return streaks;
}

function RouletteWheel({ spins }: { spins: RouletteNumber[] }) {
  const slice = 360 / WHEEL_ORDER.length;

  const { counts, maxCount } = useMemo(() => {
    const countsMap = countSpins(spins);
    return {
      counts: countsMap,
      maxCount: Math.max(1, ...Array.from(countsMap.values())),
    };
  }, [spins]);

  const maxBarLen = R_INNER - R_BAR_MIN;

  return (
    <div className="wheel-wrap">
      <div className="wheel">
        <svg className="wheel__ring" viewBox="0 0 200 200" aria-label="룰렛">
          <circle
            cx={CX}
            cy={CY}
            r={R_INNER - 0.5}
            className="wheel__center-fill"
          />

          {WHEEL_ORDER.map((value, i) => {
            const start = i * slice;
            const mid = start + slice / 2;
            const count = counts.get(toKey(value)) ?? 0;
            const barLen = (count / maxCount) * maxBarLen;
            const barHalf = slice * 0.32;

            return (
              <g key={`bar-${value}-${i}`}>
                {count > 0 && (
                  <path
                    d={ringSegment(
                      R_INNER - 1,
                      R_INNER - 1 - barLen,
                      mid - barHalf,
                      mid + barHalf,
                    )}
                    className="wheel__bar"
                  />
                )}
              </g>
            );
          })}

          {WHEEL_ORDER.map((value, i) => {
            const start = i * slice;
            const end = start + slice;
            const mid = start + slice / 2;
            const label = polar(R_LABEL, mid);
            const color = getPocketColor(value);

            return (
              <g key={`pocket-${value}-${i}`}>
                <path
                  d={ringSegment(R_OUTER, R_INNER, start, end)}
                  className={`wheel__pocket wheel__pocket--${color}`}
                />
                <text
                  x={label.x}
                  y={label.y}
                  className="wheel__label"
                  transform={`rotate(${mid}, ${label.x}, ${label.y})`}
                >
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

type CategoryId = "black" | "red" | "odd" | "even";

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "black", label: "BLACK" },
  { id: "red", label: "RED" },
  { id: "odd", label: "ODD" },
  { id: "even", label: "EVEN" },
];

function matchesCategory(value: RouletteNumber, id: CategoryId) {
  if (value === 0 || value === "00") return false;
  if (id === "red") return getPocketColor(value) === "red";
  if (id === "black") return getPocketColor(value) === "black";
  if (id === "odd") return value % 2 === 1;
  return value % 2 === 0;
}

function getCategoryStats(spins: RouletteNumber[]) {
  const total = spins.length || 1;

  return CATEGORIES.map((cat) => {
    const count = spins.filter((n) => matchesCategory(n, cat.id)).length;
    const percent = Math.round((count / total) * 100);
    return { ...cat, count, percent };
  });
}

function App() {
  const [spins, setSpins] = useState<RouletteNumber[]>(() => {
    const saved = localStorage.getItem("roulette_spins");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    localStorage.setItem("roulette_spins", JSON.stringify(spins));
  }, [spins]);

  const categoryStats = useMemo(() => getCategoryStats(spins), [spins]);

  const hotNumbers = useMemo(() => {
    const result: { value: RouletteNumber | null; count: number }[] =
      getHotNumbers(spins);
    while (result.length < 4) {
      result.push({ value: null, count: 0 });
    }
    return result;
  }, [spins]);

  const coldNumbers = useMemo(() => {
    if (spins.length === 0) {
      return Array(4).fill({ value: null, count: 0 });
    }
    return getColdNumbers(spins);
  }, [spins]);

  const historySlots = useMemo(() => {
    const recent = spins.slice(-16);
    const reversed = [...recent].reverse();
    const emptyCount = 16 - reversed.length;
    return [...reversed, ...Array(emptyCount).fill(null)];
  }, [spins]);

  // 🔥 연속 출현 상태 계산 (최근 3번 이상 연속 시 발생)
  const activeStreaks = useMemo(() => getActiveStreaks(spins), [spins]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) return;

    let newSpin: RouletteNumber | null = null;
    if (trimmed === "00") {
      newSpin = "00";
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 0 && num <= 36) {
        newSpin = num;
      }
    }

    if (newSpin !== null) {
      setSpins((prev) => [...prev, newSpin!]);
      setInputValue("");
    } else {
      alert("유효한 숫자 (0~36 또는 '00')를 입력해주세요.");
      setInputValue("");
    }
  };

  const handleReset = () => {
    if (window.confirm("모든 기록을 지우시겠습니까?")) {
      setSpins([]);
      localStorage.removeItem("roulette_spins");
    }
  };

  return (
    <main className="stage">
      <aside className="left-panel">
        {historySlots.map((value, i) => (
          <div
            key={i}
            className={`left-panel__cell ${
              value !== null
                ? `left-panel__cell--${getPocketColor(value)}`
                : "left-panel__cell--empty"
            }`}
          >
            {value !== null ? value : ""}
          </div>
        ))}
      </aside>

      <section className="main-panel">
        <div className="category-row">
          {categoryStats.map((cat) => (
            <div
              key={cat.id}
              className={`category-box category-box--${cat.id}`}
            >
              <span className="category-box__percent">{cat.percent}%</span>
              <span className="category-box__label">{cat.label}</span>
            </div>
          ))}
        </div>
        {/* 🔥 연속 출현 (Streak) 경보 알림창 */}
        {activeStreaks.length > 0 && (
          <div className="streak-container">
            {activeStreaks.map((streak, idx) => (
              <div
                key={idx}
                className={`streak-banner streak-banner--${streak.value}`}
              >
                🚨 {streak.label} {streak.count}번 연속 출현 중! 🚨
              </div>
            ))}
          </div>
        )}

        <div className="stats-group">
          <div className="sub-row">
            <span className="sub-row__title">🔥</span>
            {hotNumbers.map((item, idx) => (
              <div
                key={`hot-${item.value !== null ? toKey(item.value) : `empty-${idx}`}`}
                className="sub-box sub-box--hot"
              >
                <span className="sub-box__number">
                  {item.value !== null ? item.value : "-"}
                </span>
                <span className="sub-box__count">
                  {item.value !== null ? `x${item.count}` : "-"}
                </span>
              </div>
            ))}
          </div>

          <div className="sub-row">
            <span className="sub-row__title">🥶</span>
            {coldNumbers.map((item, idx) => (
              <div
                key={`cold-${item.value !== null ? toKey(item.value) : `empty-${idx}`}`}
                className="sub-box sub-box--cold"
              >
                <span className="sub-box__number">
                  {item.value !== null ? item.value : "-"}
                </span>
                <span className="sub-box__count">
                  {item.value !== null ? `x${item.count}` : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <RouletteWheel spins={spins} />

        <form className="input-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className="btn btn--reset"
            onClick={handleReset}
          >
            초기화
          </button>
          <input
            type="text"
            className="input-field"
            placeholder="숫자 입력 (0~36, 00)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className="btn btn--submit">
            입력
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
