import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { bcp47 } from "@/shared/i18n";
import { getTranslator, resolveLocale } from "@/backend/i18n/locale";
import { I18nProvider } from "@/frontend/i18n";
import { TooltipProvider } from "@/frontend/components/ui/feedback";
import "@/frontend/styles/globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: {
      default: "Meetup",
      template: "%s · Meetup",
    },
    description: t("app.description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#101114",
  width: "device-width",
  initialScale: 1,
};

/**
 * The locale cookie is read here, so the first byte of HTML is already in the
 * right language. That costs the app its static shell — which it never had:
 * every route below is gated on the session cookie and declares the same.
 */
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await resolveLocale();

  return (
    <html lang={bcp47[locale]} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider initialLocale={locale}>
          <TooltipProvider delayDuration={350} skipDelayDuration={200}>
            {children}
          </TooltipProvider>
        </I18nProvider>
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
