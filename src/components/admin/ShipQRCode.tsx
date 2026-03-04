import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ShipQRCodeProps {
  shipId: string;
  shipName?: string;
}

const ShipQRCode = ({ shipId, shipName = "Grand Rose Cruise" }: ShipQRCodeProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const feedbackUrl = `${window.location.origin}/ship/${shipId}/feedback/lang`;

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    canvas.width = 1200;
    canvas.height = 1500;

    img.onload = () => {
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
      ctx.fillStyle = "#1e3a5f";
      ctx.font = "bold 48px serif";
      ctx.textAlign = "center";
      ctx.fillText(shipName, 600, 80);

      // Gold line
      ctx.fillStyle = "#c49a3c";
      ctx.fillRect(500, 100, 200, 4);

      // Subtitle
      ctx.fillStyle = "#666666";
      ctx.font = "28px sans-serif";
      ctx.fillText("Guest Feedback", 600, 150);

      // QR Code
      ctx.drawImage(img, 200, 200, 800, 800);

      // Scan instruction
      ctx.fillStyle = "#1e3a5f";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("Scan to share your experience", 600, 1100);

      // Multi-language hint
      ctx.fillStyle = "#999999";
      ctx.font = "22px sans-serif";
      ctx.fillText("Available in 15+ languages", 600, 1150);

      // Footer
      ctx.fillStyle = "#c49a3c";
      ctx.fillRect(100, 1220, 1000, 2);
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "18px sans-serif";
      ctx.fillText("We value your feedback to make your cruise unforgettable", 600, 1260);

      // Download
      const link = document.createElement("a");
      link.download = `${shipName.replace(/\s+/g, "_")}_QR_Code.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    toast({ title: "QR Code Downloaded", description: "Ready to print and display!" });
  };

  const printQR = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${shipName} - QR Code</title>
        <style>
          body { 
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 100vh; margin: 0; font-family: Georgia, serif; background: white;
          }
          h1 { color: #1e3a5f; font-size: 36px; margin-bottom: 4px; }
          .gold-line { width: 100px; height: 3px; background: #c49a3c; margin: 0 auto 16px; }
          .subtitle { color: #666; font-size: 20px; margin-bottom: 40px; font-family: sans-serif; }
          .qr-container { padding: 20px; }
          .scan-text { color: #1e3a5f; font-size: 24px; font-weight: bold; margin-top: 30px; font-family: sans-serif; }
          .lang-text { color: #999; font-size: 16px; margin-top: 8px; font-family: sans-serif; }
          .footer { margin-top: 40px; color: #aaa; font-size: 14px; border-top: 1px solid #c49a3c; padding-top: 16px; font-family: sans-serif; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>${shipName}</h1>
        <div class="gold-line"></div>
        <div class="subtitle">Guest Feedback</div>
        <div class="qr-container">
          ${qrRef.current?.querySelector("svg")?.outerHTML || ""}
        </div>
        <div class="scan-text">Scan to share your experience</div>
        <div class="lang-text">Available in 15+ languages</div>
        <div class="footer">We value your feedback to make your cruise unforgettable</div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    toast({ title: "Link Copied!", description: "Feedback URL copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-display">Ship QR Code</CardTitle>
          <p className="text-sm text-muted-foreground">
            Print and display this QR code for guests to scan and leave feedback.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div
            ref={qrRef}
            className="p-6 bg-white rounded-2xl border-2 border-border shadow-inner mb-6"
          >
            <QRCodeSVG
              value={feedbackUrl}
              size={280}
              level="H"
              includeMargin
              fgColor="#1e3a5f"
              bgColor="#ffffff"
            />
          </div>

          <div className="w-full space-y-2 mb-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
              <span className="text-muted-foreground truncate flex-1">{feedbackUrl}</span>
              <Button variant="ghost" size="sm" onClick={copyLink} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-cruise-excellent" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <Button onClick={downloadQR} className="flex-1 gap-2 bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4" /> Download PNG
            </Button>
            <Button onClick={printQR} variant="outline" className="flex-1 gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-base">How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <span>Download or print the QR code above</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <span>Place it in guest rooms, reception, restaurant, or common areas</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <span>Guests scan → select language → enter room number → fill feedback form</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">4</span>
              <span>Feedback appears in your dashboard automatically as PDF</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipQRCode;
