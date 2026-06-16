import "@liberfi.io/ui-predict";

type OddsFormatter = (price: number) => string;

declare module "@liberfi.io/ui-predict" {
  interface TradeFormWidgetProps {
    oddsFormatter?: OddsFormatter;
  }

  interface SellFormWidgetProps {
    oddsFormatter?: OddsFormatter;
  }

  interface EventMarketDetailWidgetProps {
    oddsFormatter?: OddsFormatter;
  }
}

export {};
