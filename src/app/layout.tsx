import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blue Karma Ads Dashboard",
  description:
    "Unified Google & Meta advertising analytics for Blue Karma properties — pulled daily into one dashboard.",
  // Google Search Console site-verification (renders the google-site-verification
  // meta tag into <head> on every page, including the home page Google checks).
  verification: {
    google: "lIA0poNaKnRZqzKhDIJSjlV8fzCo79CfGg2okv0NubU",
  },
};

// Applied before paint so there's no flash: default is light; only an explicit
// saved choice of "dark" adds the class. Kept inline (not a component) so it
// runs synchronously ahead of the first render.
const themeInit = `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
