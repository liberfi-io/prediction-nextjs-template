import "@liberfi.io/ui-predict";

type OddsFormatter = (price: number) => string;
type OutcomeLabels = Partial<Record<"yes" | "no", string>>;

declare module "@liberfi.io/ui-predict" {
  interface TradeFormWidgetProps {
    oddsFormatter?: OddsFormatter;
    outcomeLabels?: OutcomeLabels;
  }

  interface SellFormWidgetProps {
    oddsFormatter?: OddsFormatter;
    outcomeLabels?: OutcomeLabels;
  }

  interface EventMarketDetailWidgetProps {
    oddsFormatter?: OddsFormatter;
  }
}

export {};
