import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableTally — Restaurant Manager",
  description: "Multi-outlet restaurant sales, expenses and reporting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
