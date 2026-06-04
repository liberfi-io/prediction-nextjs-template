/**
 * Odds number animation timing — measured from Polymarket's World Cup games
 * page. Two systems: NumberFlow odometer roll (numeric formats) and an opacity
 * fade (moneyline / fractional). See `.plans/worldcup/research/02-number-animation.md`.
 */

/** NumberFlow default spring curve, sampled as a CSS `linear()` easing. */
export const SPRING_EASING =
  "linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)";

export const NUMBERFLOW_TRANSFORM_TIMING = {
  duration: 450,
  easing: SPRING_EASING,
} as const;

export const NUMBERFLOW_OPACITY_TIMING = {
  duration: 450,
  easing: "ease-out",
} as const;

export const FADE_OUT: KeyframeAnimationOptions = {
  duration: 200,
  easing: "linear",
  fill: "both",
};

export const FADE_IN: KeyframeAnimationOptions = {
  duration: 500,
  easing: "linear",
  fill: "both",
};

export const FADE_MIN_OPACITY = 0.25;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
