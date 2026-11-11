"use client";
import QRCode from "qrcode";

/** QR as a data URL (SVG-sharp at any size) */
export function qrDataUrl(text: string, size = 600) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "H", margin: 1, width: size, color: { dark: "#15170F", light: "#FFFFFF" } });
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * Print-ready table card (1200x1680 px, ~10x14 cm at 300dpi):
 * green header with the logo, big table number, the QR, and what it does.
 */
export async function renderTableCard(label: string, zone: string, url: string) {
  await Promise.all([document.fonts.load("80px Lalezar"), document.fonts.load("900 60px Overpass"), document.fonts.load("500 40px 'Readex Pro'")]).catch(() => {});
  const W = 1200, H = 1680;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  c.direction = "rtl";

  // paper + frame
  c.fillStyle = "#F3ECDD";
  c.fillRect(0, 0, W, H);
  c.lineWidth = 14;
  c.strokeStyle = "#15170F";
  rr(c, 40, 40, W - 80, H - 80, 48);
  c.stroke();

  // header band
  c.save();
  rr(c, 40, 40, W - 80, 380, 48);
  c.clip();
  c.fillStyle = "#0E4A23";
  c.fillRect(40, 40, W - 80, 380);
  // road line
  c.fillStyle = "#F5C518";
  for (let x = 60; x < W - 60; x += 110) c.fillRect(x, 400, 64, 12);
  c.restore();

  try {
    const logo = await loadImg("/img/logo.svg");
    c.drawImage(logo, W / 2 - 110, 80, 220, 220);
  } catch {}
  c.fillStyle = "#F3ECDD";
  c.textAlign = "center";
  c.font = "900 46px Overpass, sans-serif";
  c.fillText("ROUTE 66", W / 2, 360);

  // table number
  c.fillStyle = "#15170F";
  c.font = "150px Lalezar, sans-serif";
  c.fillText(`طاولة ${label}`, W / 2, 610);
  c.font = "500 40px 'Readex Pro', sans-serif";
  c.fillStyle = "#3B3E33";
  if (zone) c.fillText(zone, W / 2, 670);

  // QR on a white plate
  const qr = await loadImg(await qrDataUrl(url, 760));
  c.fillStyle = "#FFFFFF";
  rr(c, W / 2 - 400, 720, 800, 800, 36);
  c.fill();
  c.lineWidth = 10;
  c.strokeStyle = "#15170F";
  c.stroke();
  c.drawImage(qr, W / 2 - 380, 740, 760, 760);

  c.fillStyle = "#15170F";
  c.font = "600 44px 'Readex Pro', sans-serif";
  c.fillText("امسح الكود: المنيو · نادي الويتر · الحساب", W / 2, 1590);
  return cv.toDataURL("image/png");
}

export async function downloadTableCard(label: string, zone: string, url: string) {
  const data = await renderTableCard(label, zone, url);
  const a = document.createElement("a");
  a.href = data;
  a.download = `route66-table-${label}.png`;
  a.click();
}
