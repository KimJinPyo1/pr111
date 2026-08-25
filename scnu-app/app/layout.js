export const metadata = {
  title: "빈 강의실 현황판 | 국립순천대학교",
  description: "지금 이 시간, 순천대학교에서 비어있는 강의실을 확인하세요.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
