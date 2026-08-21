/**
 * Distra Official Logo (Image1.png vector rendition & Base64 PNG generator for jsPDF & HTML)
 */

// SVG vector representation of Distra logo
export const DISTRA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120">
  <defs>
    <linearGradient id="distraGreen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9ad826" />
      <stop offset="45%" stop-color="#84bd00" />
      <stop offset="100%" stop-color="#6ea300" />
    </linearGradient>
    <linearGradient id="distraBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a6699" />
      <stop offset="100%" stop-color="#14436c" />
    </linearGradient>
    <filter id="distraShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.15" />
    </filter>
  </defs>

  <!-- Distra Wordmark -->
  <g filter="url(#distraShadow)">
    <text x="8" y="96" font-family="'Century Gothic', 'Montserrat', 'Segoe UI Black', Arial, sans-serif" font-size="88" font-weight="900" fill="url(#distraGreen)" letter-spacing="-2">Distra</text>
  </g>

  <!-- Tri-Node Molecular Symbol on top right -->
  <g transform="translate(210, 8)" filter="url(#distraShadow)">
    <!-- Connector branches -->
    <path d="M 50 35 Q 38 48 22 55 Q 35 62 48 55 Q 60 48 50 35 Z" fill="url(#distraBlue)" />
    <path d="M 50 35 Q 55 52 72 72 Q 78 58 65 42 Q 55 35 50 35 Z" fill="url(#distraBlue)" />
    <path d="M 22 55 Q 45 65 72 72 Q 52 68 22 55 Z" fill="url(#distraBlue)" />
    
    <!-- Central Hub -->
    <circle cx="48" cy="52" r="13" fill="url(#distraBlue)" />
    
    <!-- Node 1 (Top) -->
    <circle cx="50" cy="22" r="14" fill="url(#distraBlue)" />
    <circle cx="46" cy="18" r="4.5" fill="#ffffff" opacity="0.8" />
    
    <!-- Node 2 (Bottom Left) -->
    <circle cx="18" cy="58" r="14" fill="url(#distraBlue)" />
    <circle cx="14" cy="54" r="4.5" fill="#ffffff" opacity="0.8" />
    
    <!-- Node 3 (Bottom Right) -->
    <circle cx="76" cy="78" r="14" fill="url(#distraBlue)" />
    <circle cx="72" cy="74" r="4.5" fill="#ffffff" opacity="0.8" />
  </g>
</svg>`;

/**
 * Generates a high-resolution base64 PNG data URI for jsPDF
 */
let cachedLogoDataUri: string | null = null;

export function getDistraLogoDataUri(): string {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  
  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw crisp Distra Logo on canvas
        ctx.clearRect(0, 0, 640, 240);

        // Distra text
        const grad = ctx.createLinearGradient(0, 40, 0, 200);
        grad.addColorStop(0, "#9ed828");
        grad.addColorStop(0.5, "#84bd00");
        grad.addColorStop(1, "#6ba100");

        ctx.fillStyle = grad;
        ctx.font = "900 170px 'Century Gothic', 'Arial Rounded MT Bold', 'Montserrat', sans-serif";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("Distra", 16, 195);

        // Molecule Tri-Node Symbol
        const blueGrad = ctx.createLinearGradient(420, 20, 600, 200);
        blueGrad.addColorStop(0, "#28689c");
        blueGrad.addColorStop(1, "#14446e");

        ctx.fillStyle = blueGrad;
        ctx.strokeStyle = blueGrad;
        ctx.lineWidth = 26;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Center hub & arms
        const cx1 = 510, cy1 = 50;  // top node
        const cx2 = 445, cy2 = 125; // bottom left node
        const cx3 = 565, cy3 = 165; // bottom right node
        const hubX = 505, hubY = 115;

        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.lineTo(hubX, hubY);
        ctx.lineTo(cx2, cy2);
        ctx.moveTo(hubX, hubY);
        ctx.lineTo(cx3, cy3);
        ctx.stroke();

        // Nodes
        const drawNode = (x: number, y: number, r: number) => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = blueGrad;
          ctx.fill();

          // highlight reflection
          ctx.beginPath();
          ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fill();
        };

        drawNode(hubX, hubY, 22);
        drawNode(cx1, cy1, 28);
        drawNode(cx2, cy2, 28);
        drawNode(cx3, cy3, 28);

        cachedLogoDataUri = canvas.toDataURL("image/png");
        return cachedLogoDataUri;
      }
    } catch (e) {
      console.error("Failed to generate Distra Logo Data URI", e);
    }
  }

  // Fallback data URI svg
  return `data:image/svg+xml;utf8,${encodeURIComponent(DISTRA_LOGO_SVG)}`;
}
