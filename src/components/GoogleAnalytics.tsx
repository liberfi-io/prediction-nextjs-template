import Script from "next/script";

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

interface GoogleAnalyticsProps {
  measurementId?: string;
}

/**
 * Loads Google Analytics after the page has finished its critical work.
 */
export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  if (!measurementId || !GA_MEASUREMENT_ID_PATTERN.test(measurementId)) {
    return null;
  }

  return (
    <>
      <Script
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        strategy="lazyOnload"
        id="google-analytics"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}');
        `,
        }}
      />
    </>
  );
}
