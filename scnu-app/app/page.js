"use client";

import { useState, useEffect, useMemo } from "react";
import { BUILDINGS, PERIODS, SEMESTER } from "../data/rooms";

const DAY_MAP = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" };

function periodAt(date) {
  const mins = date.getHours() * 60 + date.getMinutes();
  const hit = [];
  for (const per of PERIODS) {
    const [sh, sm] = per.start.split(":").map(Number);
    const [eh, em] = per.end.split(":").map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    if (mins >= s && mins < e) hit.push(per.p);
  }
  return hit; // 야간교시는 시간대가 겹치므로 복수 반환
}

function dayKor(date) {
  return DAY_MAP[date.getDay()] || null;
}

export default function Page() {
  const [now, setNow] = useState(null);
  const [query, setQuery] = useState("");
  const [activeBuilding, setActiveBuilding] = useState(BUILDINGS[0].name);
  const [onlyVacant, setOnlyVacant] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const today = now ? dayKor(now) : null;
  const curPeriods = now ? periodAt(now) : [];

  const isOccupied = (room) => {
    if (!today || curPeriods.length === 0) return false;
    const list = room.schedule[today] || [];
    return curPeriods.some((p) => list.includes(p));
  };

  // 검색어로 건물/강의실 필터
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return BUILDINGS;
    return BUILDINGS.map((b) => ({
      ...b,
      rooms: b.rooms.filter((r) => r.no.includes(q) || b.name.includes(q)),
    })).filter((b) => b.rooms.length > 0);
  }, [query]);

  const current =
    filtered.find((b) => b.name === activeBuilding) || filtered[0] || null;

  const vacantCount = (b) => b.rooms.filter((r) => !isOccupied(r)).length;

  const totalRooms = BUILDINGS.reduce((s, b) => s + b.rooms.length, 0);
  const totalVacant = now
    ? BUILDINGS.reduce(
        (s, b) => s + b.rooms.filter((r) => !isOccupied(r)).length,
        0
      )
    : 0;

  const shownRooms = current
    ? onlyVacant
      ? current.rooms.filter((r) => !isOccupied(r))
      : current.rooms
    : [];

  return (
    <div style={S.page}>
      <style>{css}</style>

      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>국립순천대학교 · {SEMESTER}</div>
          <h1 style={S.title}>빈 강의실 현황판</h1>
        </div>
        <div style={S.clockBox}>
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
          <div style={S.summaryNum}>{now ? totalVacant : "–"}</div>
          <div style={S.summaryLabel}>지금 비어있는 강의실</div>
        </div>
        <div style={S.summaryCard}>
          <div style={S.summaryNum}>{totalRooms}</div>
          <div style={S.summaryLabel}>전체 강의실</div>
        </div>
        <div style={S.summaryCard}>
          <div style={S.summaryNum}>
            {now && curPeriods.length ? `${curPeriods[0]}교시` : "수업 없음"}
          </div>
          <div style={S.summaryLabel}>현재 교시</div>
        </div>
      </div>

      {!today && now && (
        <div style={S.notice}>
          오늘은 일요일입니다. 등록된 수업이 없어 모든 강의실이 비어있는 것으로
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
          style={{
            ...S.toggle,
            ...(onlyVacant ? S.toggleOn : {}),
          }}
        >
          {onlyVacant ? "빈 강의실만 보는 중" : "빈 강의실만 보기"}
        </button>
      </div>

      {/* 건물 탭 */}
      <div style={S.tabRow}>
        {filtered.map((b) => {
          const active = current && b.name === current.name;
          return (
            <button
              key={b.name}
              onClick={() => setActiveBuilding(b.name)}
              style={{ ...S.tab, ...(active ? S.tabActive : {}) }}
            >
              {b.name}
              <span style={{ ...S.tabCount, opacity: active ? 0.9 : 0.6 }}>
                {now ? vacantCount(b) : "–"}/{b.rooms.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 강의실 목록 */}
      {current && shownRooms.length > 0 ? (
        <div style={S.grid}>
          {shownRooms.map((room) => {
            const occupied = isOccupied(room);
            const todayList = today ? room.schedule[today] || [] : [];
            const next = todayList.find((p) => p > (curPeriods[0] || 0));
            return (
              <div
                key={room.no}
                style={{
                  ...S.card,
                  borderColor: occupied ? "#4A2027" : "#1E4632",
                }}
              >
                <div style={S.cardTop}>
                  <span style={S.roomLabel}>{current.name}</span>
                  <span style={S.roomNo}>{room.no}</span>
                </div>
                <div
                  style={{
                    ...S.cardBottom,
                    background: occupied ? "#33161B" : "#10261A",
                  }}
                >
                  <span
                    style={{
                      ...S.status,
                      color: occupied ? "#F87171" : "#4ADE80",
                    }}
                  >
                    {occupied ? "사용 중" : "비어있음"}
                  </span>
                  <span style={S.statusSub}>
                    {occupied
                      ? `${curPeriods[0]}교시 수업 중`
                      : !today
                      ? "일요일 · 사용 가능"
                      : next
                      ? `${next}교시부터 수업 있음`
                      : "오늘 남은 수업 없음"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.empty}>
          {query.trim()
            ? "검색 결과가 없습니다. 다른 강의실 번호나 건물명으로 찾아보세요."
            : "표시할 강의실이 없습니다."}
        </div>
      )}

      <footer style={S.footer}>
        출처: 순천대학교 수업시간표 조회 시스템 · {SEMESTER} 기준 · 본부직속,
        그린스마트팜스쿨, 애니메이션·문화콘텐츠스쿨, 우주항공·첨단소재 스쿨,
        사범대학, 약학대학 개설 강좌 반영. 실습·보강 등으로 실제 사용 여부가
        다를 수 있습니다.
      </footer>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
* { box-sizing: border-box; }
body { background: #0B1622; }
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
  clockBox: { textAlign: "right" },
  clockTime: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  clockDate: { fontSize: 12, color: "#8A93A0", marginTop: 2 },

  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
    gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
    gap: 11,
  },
  card: {
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid",
    background: "#12202F",
  },
  cardTop: { padding: "12px 13px 9px", display: "flex", flexDirection: "column" },
  roomLabel: { fontSize: 10.5, color: "#6B7583", letterSpacing: "0.05em" },
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
