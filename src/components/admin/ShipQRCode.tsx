import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ShipQRCodeProps {
  shipId: string;
  shipName?: string;
}

const qrCaptions: Record<string, { scan: string; hint: string; footer: string }> = {
  en: { scan: "Scan to leave your feedback", hint: "Available in 15+ languages", footer: "We value your feedback to make your cruise unforgettable" },
  es: { scan: "Escanea para dejar tu opinión", hint: "Disponible en más de 15 idiomas", footer: "Valoramos tu opinión para hacer tu crucero inolvidable" },
  it: { scan: "Scansiona per lasciare il tuo feedback", hint: "Disponibile in oltre 15 lingue", footer: "Apprezziamo il tuo feedback per rendere la tua crociera indimenticabile" },
  fr: { scan: "Scannez pour laisser votre avis", hint: "Disponible en plus de 15 langues", footer: "Nous apprécions vos commentaires pour rendre votre croisière inoubliable" },
  de: { scan: "Scannen Sie, um Ihr Feedback zu hinterlassen", hint: "Verfügbar in über 15 Sprachen", footer: "Wir schätzen Ihr Feedback, um Ihre Kreuzfahrt unvergesslich zu machen" },
  nl: { scan: "Scan om uw feedback achter te laten", hint: "Beschikbaar in meer dan 15 talen", footer: "Wij waarderen uw feedback om uw cruise onvergetelijk te maken" },
  pl: { scan: "Zeskanuj, aby zostawić opinię", hint: "Dostępne w ponad 15 językach", footer: "Cenimy Twoją opinię, aby uczynić Twój rejs niezapomnianym" },
  ko: { scan: "스캔하여 피드백을 남겨주세요", hint: "15개 이상의 언어로 제공", footer: "잊지 못할 크루즈를 위해 여러분의 의견을 소중히 여깁니다" },
  ja: { scan: "スキャンしてフィードバックをお寄せください", hint: "15以上の言語で利用可能", footer: "忘れられないクルーズのために、皆様のご意見を大切にしています" },
  zh: { scan: "扫描以留下您的反馈", hint: "支持15种以上语言", footer: "我们重视您的反馈，让您的邮轮之旅难以忘怀" },
  hi: { scan: "अपनी प्रतिक्रिया देने के लिए स्कैन करें", hint: "15+ भाषाओं में उपलब्ध", footer: "आपकी क्रूज़ यात्रा को अविस्मरणीय बनाने के लिए हम आपकी प्रतिक्रिया को महत्व देते हैं" },
  ar: { scan: "امسح الرمز لترك ملاحظاتك", hint: "متاح بأكثر من 15 لغة", footer: "نقدّر ملاحظاتك لجعل رحلتك البحرية لا تُنسى" },
  pt: { scan: "Digitalize para deixar o seu feedback", hint: "Disponível em mais de 15 idiomas", footer: "Valorizamos o seu feedback para tornar o seu cruzeiro inesquecível" },
  ru: { scan: "Отсканируйте, чтобы оставить отзыв", hint: "Доступно на 15+ языках", footer: "Мы ценим ваш отзыв, чтобы сделать ваш круиз незабываемым" },
  tr: { scan: "Geri bildiriminizi bırakmak için tarayın", hint: "15'ten fazla dilde mevcut", footer: "Yolculuğunuzu unutulmaz kılmak için geri bildirimlerinize değer veriyoruz" },
};

const captionLanguages = [
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "it", label: "🇮🇹 Italiano" },
  { code: "fr", label: "🇫🇷 Français" },
  { code: "de", label: "🇩🇪 Deutsch" },
  { code: "nl", label: "🇳🇱 Nederlands" },
  { code: "pl", label: "🇵🇱 Polski" },
  { code: "ko", label: "🇰🇷 한국어" },
  { code: "ja", label: "🇯🇵 日本語" },
  { code: "zh", label: "🇨🇳 中文" },
  { code: "hi", label: "🇮🇳 हिन्दी" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ru", label: "🇷🇺 Русский" },
  { code: "tr", label: "🇹🇷 Türkçe" },
];

const ShipQRCode = ({ shipId, shipName = "Grand Rose Cruise" }: ShipQRCodeProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [captionLang, setCaptionLang] = useState("en");

  const feedbackUrl = `${window.location.origin}/ship/${shipId}/feedback/lang`;
  const captions = qrCaptions[captionLang] || qrCaptions.en;

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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#1e3a5f";
      ctx.font = "bold 48px serif";
      ctx.textAlign = "center";
      ctx.fillText(shipName, 600, 80);

      ctx.fillStyle = "#c49a3c";
      ctx.fillRect(500, 100, 200, 4);

      ctx.fillStyle = "#666666";
      ctx.font = "28px sans-serif";
      ctx.fillText("Guest Feedback", 600, 150);

      ctx.drawImage(img, 200, 200, 800, 800);

      ctx.fillStyle = "#1e3a5f";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(captions.scan, 600, 1100);

      ctx.fillStyle = "#999999";
      ctx.font = "22px sans-serif";
      ctx.fillText(captions.hint, 600, 1150);

      ctx.fillStyle = "#c49a3c";
      ctx.fillRect(100, 1220, 1000, 2);
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "18px sans-serif";
      ctx.fillText(captions.footer, 600, 1260);

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
        <div class="scan-text">${captions.scan}</div>
        <div class="lang-text">${captions.hint}</div>
        <div class="footer">${captions.footer}</div>
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
          {/* Caption Language Selector */}
          <div className="w-full mb-4">
            <label className="text-sm font-medium text-foreground mb-1.5 block">Caption Language</label>
            <Select value={captionLang} onValueChange={setCaptionLang}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {captionLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            ref={qrRef}
            className="p-6 bg-white rounded-2xl border-2 border-border shadow-inner mb-2"
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

          {/* Caption Preview */}
          <div className="text-center mb-4">
            <p className="text-lg font-bold text-foreground">{captions.scan}</p>
            <p className="text-sm text-muted-foreground">{captions.hint}</p>
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
              <span>Choose the caption language above, then download or print the QR code</span>
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
