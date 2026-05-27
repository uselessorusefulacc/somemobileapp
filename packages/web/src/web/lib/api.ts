// NOTE: Dead code — hono RPC client was replaced with plain fetch (see #157).
// Kept for reference in case we re-enable the typed client.
import { hc } from "hono/client";
import type { AppType } from "../../api";

const client = hc<AppType>("/");

export const api = client.api;
