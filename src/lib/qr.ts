import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Public voting link for this deployment, plus a QR code SVG for it. */
export async function getVoteLink(): Promise<{ url: string; svg: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/vote`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1a0710", light: "#ffffff" } });
  return { url, svg };
}
