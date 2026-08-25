"use client";

import { useState, useEffect, useMemo } from "react";
import { BUILDINGS, PERIODS, SEMESTER } from "../data/rooms";

const DAY_MAP = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" };
const FAV_KEY = "scnu-vacancy-favorites";
const FAV_TAB = "__favorites__";

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const roomKey = (building, no) => `${building}::${no}`;

/**
 * 현재 시각을 교시 정보로 환산한다.
 *  - inClass: 지금이 수업 시간인지 (쉬는시간이면 false)
 *  - periods: 지금 진행 중인 교시 (야간은 시간대가 겹쳐 복수일 수 있음)
 *  - nextPeriods: 다음에 시작하는 교시들
 */
function resolveTime(date) {
  const mins = date.getHours() * 60 + date.getMinutes();

  const current = PERIODS.filter(
    (p) => mins >= toMin(p.start) && mins < toMin(p.end)
  );
  if (current.length > 0) {
    return { inClass: true, periods: current, nextPeriods: [] };
  }

  // 쉬는시간(또는 수업 전/후) — 다음에 시작하는 교시 찾기
  const upcoming = PERIODS.filter((p) => toMin(p.start) > mins);
  if (upcoming.length === 0) {
    return { inClass: false, periods: [], nextPeriods: [] };
  }
  const earliest = Math.min(...upcoming.map((p) => toMin(p.start)));
  const nextPeriods = upcoming.filter((p) => toMin(p.start) === earliest);
  return { inClass: false, periods: [], nextPeriods };
}

function Star({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
        fill={filled ? "#F0A830" : "none"}
        stroke={filled ? "#F0A830" : "#5A6472"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Page() {
  const [now, setNow] = useState(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(BUILDINGS[0].name);
  const [onlyVacant, setOnlyVacant] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favLoaded, setFavLoaded] = useState(false);

  // 시계 시작 + 저장된 즐겨찾기 불러오기
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    try {
      const saved = localStorage.getItem(FAV_KEY);
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {
      // 저장소를 못 쓰는 환경이면 이번 세션에서만 유지
    }
    setFavLoaded(true);
    return () => clearInterval(timer);
  }, []);

  // 즐겨찾기 변경 시 저장
  useEffect(() => {
    if (!favLoaded) return;
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites, favLoaded]);

  const toggleFavorite = (key) =>
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const today = now ? DAY_MAP[now.getDay()] || null : null;
  const timeInfo = useMemo(
    () => (now ? resolveTime(now) : { inClass: false, periods: [], nextPeriods: [] }),
    [now]
  );

  /**
   * 강의실 상태 판정
   *  occupied → 지금 수업 중 (빨강)
   *  soon     → 쉬는시간이고, 다음 교시에 수업 있음 (노랑)
   *  vacant   → 비어있음 (초록)
   */
  const getState = (room) => {
    if (!today || !now) return { kind: "vacant", note: "사용 가능" };

    const list = room.schedule[today] || [];
    const { inClass, periods, nextPeriods } = timeInfo;

    if (inClass) {
      const hit = periods.find((p) => list.includes(p.p));
      if (hit) {
        return { kind: "occupied", note: `${hit.p}교시 수업 중 (~${hit.end})` };
      }
      const after = list.filter((p) => p > periods[0].p).sort((a, b) => a - b)[0];
      return {
        kind: "vacant",
        note: after ? `${after}교시부터 수업 있음` : "오늘 남은 수업 없음",
      };
    }

    // 쉬는시간
    const soonHit = nextPeriods.find((p) => list.includes(p.p));
    if (soonHit) {
      const mins = toMin(soonHit.start) - (now.getHours() * 60 + now.getMinutes());
      return {
        kind: "soon",
        note: `${mins}분 뒤 ${soonHit.p}교시 수업 시작`,
      };
    }

    const nextNo = nextPeriods.length ? nextPeriods[0].p : 0;
    const after = list.filter((p) => p > nextNo).sort((a, b) => a - b)[0];
    return {
      kind: "vacant",
      note: after ? `${after}교시부터 수업 있음` : "오늘 남은 수업 없음",
    };
  };

  // 전체 강의실을 평평하게 (즐겨찾기 뷰에서 사용)
  const allRooms = useMemo(
    () =>
      BUILDINGS.flatMap((b) =>
        b.rooms.map((r) => ({ building: b.name, room: r }))
      ),
    []
  );

  const favRooms = useMemo(
    () => allRooms.filter((x) => favorites.includes(roomKey(x.building, x.room.no))),
    [allRooms, favorites]
  );

  // 검색 필터
  const q = query.trim();
  const matches = (buildingName, room) =>
    !q || room.no.includes(q) || buildingName.includes(q);

  const filteredBuildings = useMemo(() => {
    if (!q) return BUILDINGS;
    return BUILDINGS.map((b) => ({
      ...b,
      rooms: b.rooms.filter((r) => matches(b.name, r)),
    })).filter((b) => b.rooms.length > 0);
  }, [q]);

  const isFavView = activeTab === FAV_TAB;

  // 현재 탭에 표시할 강의실
  let shown = [];
  let currentBuildingName = null;
  if (isFavView) {
    shown = favRooms.filter((x) => matches(x.building, x.room));
  } else {
    const b =
      filteredBuildings.find((x) => x.name === activeTab) || filteredBuildings[0];
    if (b) {
      currentBuildingName = b.name;
      shown = b.rooms.map((r) => ({ building: b.name, room: r }));
    }
  }
  if (onlyVacant) shown = shown.filter((x) => getState(x.room).kind === "vacant");

  const countVacant = (rooms) =>
    rooms.filter((r) => getState(r).kind === "vacant").length;

  const totalRooms = allRooms.length;
  const totalVacant = now
    ? allRooms.filter((x) => getState(x.room).kind === "vacant").length
    : 0;
  const totalSoon = now
    ? allRooms.filter((x) => getState(x.room).kind === "soon").length
    : 0;

  const periodLabel = () => {
    if (!now) return "–";
    if (timeInfo.inClass) return `${timeInfo.periods[0].p}교시`;
    if (timeInfo.nextPeriods.length) return "쉬는시간";
    return "수업 없음";
  };

  return (
    <div style={S.page}>
      <style>{css}</style>

      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>국립순천대학교 · {SEMESTER}</div>
          <h1 style={S.title}>빈 강의실 현황판</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={S.clockTime}>
            {now
              ? now.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "--:--"}
          </div>
          <div style={S.clockDate}>
            {now
              ? now.toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })
              : "불러오는 중"}
          </div>
        </div>
      </header>

      {/* 요약 */}
      <div style={S.summaryRow}>
        <div style={S.summaryCard}>
          <div style={{ ...S.summaryNum, color: "#4ADE80" }}>
            {now ? totalVacant : "–"}
          </div>
          <div style={S.summaryLabel}>지금 비어있는 강의실</div>
        </div>
        <div style={S.summaryCard}>
          <div style={{ ...S.summaryNum, color: "#FBBF24" }}>
            {now ? totalSoon : "–"}
          </div>
          <div style={S.summaryLabel}>곧 수업 시작</div>
        </div>
        <div style={S.summaryCard}>
          <div style={S.summaryNum}>{totalRooms}</div>
          <div style={S.summaryLabel}>전체 강의실</div>
        </div>
        <div style={S.summaryCard}>
          <div style={{ ...S.summaryNum, fontSize: 22 }}>{periodLabel()}</div>
          <div style={S.summaryLabel}>현재 교시</div>
        </div>
      </div>

      {now && !today && (
        <div style={S.notice}>
          오늘은 일요일입니다. 등록된 수업이 없어 모든 강의실이 비어있는 것으로
          표시됩니다.
        </div>
      )}

      {now && today && !timeInfo.inClass && timeInfo.nextPeriods.length > 0 && (
        <div style={S.breakNotice}>
          지금은 쉬는시간입니다. 다음 교시({timeInfo.nextPeriods[0].p}교시,{" "}
          {timeInfo.nextPeriods[0].start} 시작)에 수업이 있는 강의실은 노란색으로
          표시됩니다.
        </div>
      )}

      {/* 검색 + 필터 */}
      <div style={S.controls}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="강의실 번호 또는 건물명 검색 (예: 305호, E8호관)"
          style={S.search}
        />
        <button
          onClick={() => setOnlyVacant((v) => !v)}
          style={{ ...S.toggle, ...(onlyVacant ? S.toggleOn : {}) }}
        >
          {onlyVacant ? "빈 강의실만 보는 중" : "빈 강의실만 보기"}
        </button>
      </div>

      {/* 탭 */}
      <div style={S.tabRow}>
        <button
          onClick={() => setActiveTab(FAV_TAB)}
          style={{
            ...S.tab,
            ...(isFavView ? S.tabActive : {}),
            borderColor: isFavView ? "#F0A830" : "#3A3117",
          }}
        >
          <Star filled={true} />
          즐겨찾기
          <span style={{ ...S.tabCount, opacity: isFavView ? 0.9 : 0.65 }}>
            {now && favRooms.length > 0
              ? `${countVacant(favRooms.map((x) => x.room))}/${favRooms.length}`
              : favRooms.length}
          </span>
        </button>

        {filteredBuildings.map((b) => {
          const active = !isFavView && b.name === currentBuildingName;
          return (
            <button
              key={b.name}
              onClick={() => setActiveTab(b.name)}
              style={{ ...S.tab, ...(active ? S.tabActive : {}) }}
            >
              {b.name}
              <span style={{ ...S.tabCount, opacity: active ? 0.9 : 0.6 }}>
                {now ? countVacant(b.rooms) : "–"}/{b.rooms.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 강의실 목록 */}
      {shown.length > 0 ? (
        <div style={S.grid}>
          {shown.map(({ building, room }) => {
            const st = getState(room);
            const theme = THEME[st.kind];
            const key = roomKey(building, room.no);
            const fav = favorites.includes(key);
            return (
              <div
                key={key}
                style={{ ...S.card, borderColor: theme.border }}
              >
                <div style={S.cardTop}>
                  <div style={S.cardTopRow}>
                    <span style={S.roomLabel}>{building}</span>
                    <button
                      onClick={() => toggleFavorite(key)}
                      style={S.starBtn}
                      aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      title={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    >
                      <Star filled={fav} />
                    </button>
                  </div>
                  <span style={S.roomNo}>{room.no}</span>
                </div>
                <div style={{ ...S.cardBottom, background: theme.bg }}>
                  <span style={{ ...S.status, color: theme.text }}>
                    {theme.label}
                  </span>
                  <span style={S.statusSub}>{st.note}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.empty}>
          {isFavView && favRooms.length === 0
            ? "아직 즐겨찾기한 강의실이 없습니다. 강의실 카드의 별을 눌러 추가해보세요."
            : q
            ? "검색 결과가 없습니다. 다른 강의실 번호나 건물명으로 찾아보세요."
            : onlyVacant
            ? "지금은 이 조건에 맞는 빈 강의실이 없습니다."
            : "표시할 강의실이 없습니다."}
        </div>
      )}

      <footer style={S.footer}>
        출처: 순천대학교 수업시간표 조회 시스템 · {SEMESTER} 기준 · 본부직속,
        그린스마트팜스쿨, 애니메이션·문화콘텐츠스쿨, 우주항공·첨단소재 스쿨,
        사범대학, 약학대학 개설 강좌 반영. 즐겨찾기는 이 브라우저에만 저장됩니다.
        실습·보강 등으로 실제 사용 여부가 다를 수 있습니다.
      </footer>
    </div>
  );
}

const THEME = {
  vacant: {
    label: "비어있음",
    text: "#4ADE80",
    bg: "#10261A",
    border: "#1E4632",
  },
  soon: {
    label: "곧 수업",
    text: "#FBBF24",
    bg: "#2E2510",
    border: "#5A4517",
  },
  occupied: {
    label: "사용 중",
    text: "#F87171",
    bg: "#33161B",
    border: "#4A2027",
  },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
* { box-sizing: border-box; }
body { background: #0B1622; margin: 0; }
input::placeholder { color: #5A6472; }
button { font-family: inherit; }
`;

const S = {
  page: {
    minHeight: "100vh",
    background: "#0B1622",
    color: "#EDF0F3",
    fontFamily: "'IBM Plex Sans KR', sans-serif",
    padding: "26px 22px 44px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 14,
    borderBottom: "1px solid #1E2C3D",
    paddingBottom: 16,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11.5,
    letterSpacing: "0.1em",
    color: "#F0A830",
    marginBottom: 5,
    fontWeight: 600,
  },
  title: { fontSize: 27, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" },
  clockTime: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  clockDate: { fontSize: 12, color: "#8A93A0", marginTop: 2 },

  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    background: "#12202F",
    border: "1px solid #1E2C3D",
    borderRadius: 10,
    padding: "14px 16px",
  },
  summaryNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 24,
    fontWeight: 700,
    color: "#F0A830",
  },
  summaryLabel: { fontSize: 12, color: "#8A93A0", marginTop: 3 },

  notice: {
    background: "#132A1D",
    border: "1px solid #24512F",
    color: "#93DDA9",
    fontSize: 13,
    padding: "10px 14px",
    borderRadius: 9,
    marginBottom: 16,
  },
  breakNotice: {
    background: "#2A2310",
    border: "1px solid #5A4517",
    color: "#F5CE7A",
    fontSize: 13,
    padding: "10px 14px",
    borderRadius: 9,
    marginBottom: 16,
  },

  controls: { display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 18 },
  search: {
    flex: "1 1 260px",
    background: "#12202F",
    border: "1px solid #1E2C3D",
    borderRadius: 9,
    padding: "11px 14px",
    color: "#EDF0F3",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  },
  toggle: {
    background: "#12202F",
    border: "1px solid #1E2C3D",
    borderRadius: 9,
    padding: "11px 16px",
    color: "#A8B0BC",
    fontSize: 13.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  toggleOn: {
    background: "#F0A830",
    borderColor: "#F0A830",
    color: "#0B1622",
    fontWeight: 600,
  },

  tabRow: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 },
  tab: {
    background: "#12202F",
    border: "1px solid #1E2C3D",
    color: "#A8B0BC",
    borderRadius: 999,
    padding: "7px 13px",
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  tabActive: {
    background: "#F0A830",
    borderColor: "#F0A830",
    color: "#0B1622",
    fontWeight: 700,
  },
  tabCount: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
    gap: 11,
  },
  card: {
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid",
    background: "#12202F",
  },
  cardTop: { padding: "10px 13px 9px", display: "flex", flexDirection: "column" },
  cardTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  roomLabel: { fontSize: 10.5, color: "#6B7583", letterSpacing: "0.05em" },
  starBtn: {
    background: "none",
    border: "none",
    padding: 2,
    cursor: "pointer",
    lineHeight: 0,
    display: "flex",
  },
  roomNo: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 21,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  cardBottom: {
    padding: "10px 13px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  status: { fontSize: 13.5, fontWeight: 700 },
  statusSub: { fontSize: 11.5, color: "#8A93A0" },

  empty: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#6B7583",
    fontSize: 14,
    background: "#12202F",
    border: "1px solid #1E2C3D",
    borderRadius: 10,
    lineHeight: 1.7,
  },

  footer: {
    marginTop: 30,
    fontSize: 11.5,
    color: "#5A6472",
    borderTop: "1px solid #1E2C3D",
    paddingTop: 14,
    lineHeight: 1.7,
  },
};
