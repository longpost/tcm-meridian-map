import "./globals.css";

export const metadata = {
  title: "Meridian Map (Educational)",
  description: "Educational TCM meridian visualization."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
