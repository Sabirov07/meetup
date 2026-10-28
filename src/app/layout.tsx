import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/feedback";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Meetup",
    template: "%s · Meetup",
  },
  description:
    "Turn conversations into clear ownership. Meetup captures what was agreed, who owns it and what should happen next.",
};

export const viewport: Viewport = {
  themeColor: "#101114",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={350} skipDelayDuration={200}>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          gap={8}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-[20rem] items-start gap-2.5 rounded-lg border border-line-strong bg-overlay p-3 text-[13px] text-text shadow-popover",
              title: "font-medium leading-5",
              description: "mt-0.5 text-xs leading-5 text-text-muted",
              actionButton:
                "ml-auto shrink-0 rounded-md bg-accent-solid px-2 py-1 text-2xs font-medium text-white",
              cancelButton:
                "shrink-0 rounded-md px-2 py-1 text-2xs font-medium text-text-muted hover:text-text",
              icon: "shrink-0",
              error: "border-danger/35",
              success: "border-success/30",
            },
          }}
        />
      </body>
    </html>
  );
}
