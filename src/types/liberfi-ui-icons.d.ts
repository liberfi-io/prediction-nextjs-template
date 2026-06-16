import type { SVGProps } from "react";
import "@liberfi.io/ui";

declare module "@liberfi.io/ui" {
  export function PinIcon(props: SVGProps<SVGSVGElement>): JSX.Element;
  export function UnPinIcon(props: SVGProps<SVGSVGElement>): JSX.Element;
}

export {};
