import {
  createPredictClient,
  type PredictClientOptions,
} from "@liberfi.io/react-predict/server";

/**
 * Server-side PredictClient factory.
 *
 * Uses `PREDICT_URL` (the actual backend URL) directly, bypassing the
 * Next.js rewrite proxy that client-side code goes through via
 * `NEXT_PUBLIC_PREDICT_URL`.
 */
export function getServerPredictClient(options?: PredictClientOptions) {
  return createPredictClient(process.env.PREDICT_URL!, options);
}
