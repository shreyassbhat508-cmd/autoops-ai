import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoOps AI — Operational Co-Pilot for Local Businesses",
  description:
    "Voice booking, receipt scanning, and revenue recovery for independent service businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: "#1A2229",
              border: "1px solid #232C33",
              color: "#E8EDEF",
            },
          }}
        />
      </body>
    </html>
  );
}
