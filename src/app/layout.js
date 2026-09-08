import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "SyncApp Dashboard",
  description: "Premium synchronization and reminder app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ marginLeft: '260px', flexGrow: 1, padding: '32px' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
