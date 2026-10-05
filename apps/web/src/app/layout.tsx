import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Photo Gallery — Photography Studio Workspace",
  description: "Projects, payments and private client galleries for photography studios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

