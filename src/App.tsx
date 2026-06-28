import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Bell, 
  ExternalLink, 
  TrendingDown, 
  TrendingUp, 
  Coins, 
  Database, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  FileCode2, 
  Sparkles, 
  LineChart as ChartIcon, 
  Info, 
  ChevronRight, 
  HelpCircle,
  Clock,
  BookOpen,
  Languages,
  Download,
  Link2,
  Check,
  Copy
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: number;
  url: string;
  title: string;
  imageUrl: string;
  initialPrice: number;
  currentPrice: number;
  targetPrice: number | null;
  lastChecked: string;
  status: string;
  createdAt: string;
}

interface PriceHistory {
  id: number;
  productId: number;
  price: number;
  timestamp: string;
}

interface TelegramStatus {
  hasToken: boolean;
  token: string;
  chatId: string;
  botName: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const translations = {
  th: {
    title: "ระบบติดตามราคา Lazada",
    subtitle: "แผงเฝ้าระวังระดับวิศวกรผู้เชี่ยวชาญ",
    version: "เวอร์ชัน",
    dbType: "ประเภทฐานข้อมูล",
    telegramLinked: "เชื่อมโยงแล้ว 🟢",
    telegramUnlinked: "ยังไม่เชื่อมโยง ⚪",
    scanAll: "สแกนราคาทั้งหมด",
    scanning: "กำลังตรวจสอบราคา...",
    metricsTracked: "สินค้าที่กำลังติดตาม",
    metricsTrackedSub: "จำนวนข้อมูลสินค้าที่ใช้งานในระบบ",
    metricsDrops: "ราคาลดลงที่ตรวจพบ",
    metricsDropsSub: "สินค้าที่มีราคาต่ำกว่าราคาเริ่มต้น",
    metricsSavings: "ยอดเงินที่ประหยัดได้รวม",
    metricsSavingsSub: "จำนวนเงินที่ประหยัดได้จากการลดราคา",
    addNewTracker: "ติดตามสินค้า Lazada ชิ้นใหม่",
    addNewTrackerSub: "เพิ่มลิงก์หรือโค้ดหน้าเว็บสำหรับหลีกเลี่ยงการปิดกั้นของบอต",
    autoTab: "ดึงข้อมูลอัตโนมัติ",
    manualTab: "นำเข้าโค้ด HTML ของหน้าเว็บ",
    urlLabel: "ลิงก์ URL สินค้า Lazada",
    urlPlaceholder: "วางลิงก์หน้าสินค้า เช่น https://www.lazada.co.th/products/...",
    urlSub: "กรอกลิงก์หน้าสินค้าเต็มจากแอปหรือเว็บเบราว์เซอร์ของคุณ",
    targetPriceLabel: "ราคาเป้าหมาย (฿) (ไม่บังคับ)",
    targetPriceSub: "ระบบจะแจ้งเตือนเมื่อราคาปรับลดลงต่ำกว่าราคานี้",
    autoTabTip: "ระบบดึงข้อมูลอัตโนมัติจะใช้ rotating headers และใช้ระบบวิเคราะห์ข้อมูล HTML ด้วย Gemini AI ในกรณีที่ติดหน้ายืนยันตัวตน (Captcha)",
    manualLabel: "วางโค้ดหน้าเว็บ HTML (ข้ามการป้องกันบอตได้ 100%)",
    manualPlaceholder: "คลิกขวาที่หน้าสินค้า -> ดูซอร์สโค้ด (View Source) -> คัดลอกทั้งหมด -> นำมาวางที่นี่...",
    manualTip: "หลีกเลี่ยงบอตได้แน่นอน 100%: หากระบบบอตดึงข้อมูลติด Captcha ให้เปิดหน้าสินค้านั้นบนเบราว์เซอร์ของคุณ กดปุ่ม Ctrl+U คัดลอกซอร์สโค้ดหน้าเว็บทั้งหมดมาวางที่นี่",
    failedAdd: "การเพิ่มสินค้าล้มเหลว",
    failedAddManualTip: "เปลี่ยนไปใช้การนำเข้าด้วยโค้ด HTML เพื่อหลีกเลี่ยงการถูกปิดกั้น!",
    startTrackBtn: "เริ่มติดตามราคา",
    analyzingBtn: "กำลังวิเคราะห์ข้อมูลเว็บ...",
    priceTrendTitle: "แนวโน้มราคาและสถิติ",
    priceTrendSub: "ประวัติการเคลื่อนไหวของราคาสินค้าที่บันทึกในฐานข้อมูล",
    closeChart: "ปิดกราฟ",
    loadingTimeline: "กำลังโหลดประวัติราคาจากฐานข้อมูล...",
    singlePoint: "มีข้อมูลราคาเพียงชุดเดียว",
    singlePointSub: "ข้อมูลประวัติราคาจะถูกสะสมเพิ่มขึ้นเมื่อระบบตรวจพบการเปลี่ยนแปลงราคาในอนาคต!",
    trackedCount: "สินค้าที่ติดตามอยู่",
    trackedCountSub: "ระบบเฝ้าระวังราคาและแจ้งเตือนอัตโนมัติในเบื้องหลัง",
    loadingDb: "กำลังโหลดข้อมูลสินค้า...",
    emptyState: "ยังไม่มีสินค้าที่กำลังติดตาม",
    emptyStateSub: "เพิ่มลิงก์หรือนำเข้าโค้ดหน้าสินค้าด้านบนเพื่อเริ่มการเฝ้าระวังราคา",
    initialPrice: "ราคาแรกเริ่ม",
    currentPrice: "ราคาปัจจุบัน",
    targetPrice: "เป้าหมาย",
    setTarget: "- คลิกตั้งค่า -",
    priceDroppedAlert: "ลดราคาแล้ว!",
    savedAmount: "ประหยัดไปได้",
    historyBtn: "ดูประวัติราคา",
    simulateDropBtn: "จำลองราคาลด",
    simulatingBtn: "กำลังจำลอง...",
    simulateDropTip: "จำลองราคาลดลง ฿150 เพื่อทดสอบระบบแจ้งเตือนผ่าน Telegram",
    telegramTitle: "การแจ้งเตือน Telegram",
    telegramSub: "รับข้อความแจ้งเตือนทันทีบนโทรศัพท์มือถือเมื่อราคาลดลง",
    botTokenLabel: "โทเค็นบอต Telegram (Bot Token)",
    chatIdLabel: "ไอดีแชทของคุณ (Chat ID)",
    chatIdSub: "ไอดีแชทส่วนตัวของคุณหรือช่องทางกลุ่มที่ต้องการให้บอตแจ้งเตือน",
    pairingBtn: "กำลังบันทึกและตรวจสอบ...",
    saveTestBtn: "บันทึกและทดสอบเชื่อมต่อ",
    setupTitle: "ขั้นตอนการตั้งค่าบอตแจ้งเตือน:",
    setupStep1: "เปิดแอป Telegram ค้นหา @BotFather แล้วกด Start",
    setupStep2: "ส่งคำสั่ง /newbot และทำตามขั้นตอนเพื่อรับค่า Token ของบอต",
    setupStep3: "ค้นหาชื่อบอตที่คุณสร้างไว้ในแชท และกดปุ่มพิมพ์ส่งคำว่า Hello เผื่อเปิดใช้งานแชท",
    setupStep4: "ค้นหาไอดีแชทส่วนตัวของคุณด้วยการทักแชทคุยกับ @userinfobot",
    setupStep5: "นำค่า Token และ Chat ID มาวางในช่องฟอร์มด้านบน แล้วกดบันทึกเชื่อมต่อ",
    cliTitle: "ระบบควบคุมผ่านหน้าจอคำสั่ง (CLI)",
    cliSub: "ทำงานเบื้องหลังได้ทุกที่โดยไม่ต้องเปิดเว็บเบราว์เซอร์",
    cliText: "แอปพลิเคชันนี้ถูกออกแบบมาเพื่อความยืดหยุ่นสูง ตัวตรวจสอบราคาเบื้องหลังและบอตควบคุม Telegram สามารถรันเป็น Service แยกเดี่ยวได้ เหมาะสำหรับการติดตั้งบนมือถือ Termux (Android) หรือเซิร์ฟเวอร์คลาวด์ VPS!",
    cliCheckerTitle: "1. สคริปต์สแกนราคาเบื้องหลัง",
    cliCheckerSub: "สแกนราคาหนึ่งรอบแล้วทำงานเสร็จสิ้น เหมาะสำหรับการกำหนดเวลาทำงานด้วย Cron job",
    cliBotTitle: "2. บอตบริการ Telegram ทำงานตลอดเวลา",
    cliBotSub: "สแกนรอบริการและตอบสนองต่อคำสั่งแบบ Interactive ในแอป Telegram ได้แบบทันที",
    footerMade: "ระบบติดตามราคา Lazada • พัฒนาด้วย Node.js + React + TailwindCSS + Drizzle ORM",
    footerSpec: "สถาปัตยกรรมการดึงข้อมูลระดับองค์กร มั่นใจข้ามผ่านการตรวจสอบและปิดกั้นของระบบบอตได้ natively.",
    globalScanSuccess: "ตรวจสอบราคาทั่วโลกทั้งหมดเสร็จสิ้นเรียบร้อยแล้ว!",
    globalScanFailed: "เกิดข้อผิดพลาดในการตรวจสอบราคาทั่วโลก",
    simSuccess: "จำลองราคาลดลงสำเร็จ!",
    alertSent: "ระบบได้ทำการส่งข้อความแจ้งเตือนเข้า Telegram ของคุณแล้ว",
    alertNotSent: "ข้ามขั้นตอนการแจ้งเตือนเนื่องจากยังไม่ได้ผูกบอต Telegram",
    downloadZip: "ดาวน์โหลด ZIP โปรเจกต์เต็มเพื่อนำไปใช้",
    downloadingZip: "กำลังบีบอัดโปรเจกต์...",
    confirmTitle: "ยืนยันการดำเนินการ",
    confirmDeleteMsg: "คุณแน่ใจหรือไม่ว่าต้องการหยุดติดตามสินค้านี้และลบประวัติราคาทั้งหมด?",
    confirmBtn: "ยืนยันการลบ",
    cancelBtn: "ยกเลิก",
    toastScrapeSuccess: "🎉 เพิ่มและค้นหาข้อมูลสินค้าสำเร็จผ่านทาง: "
  },
  en: {
    title: "Lazada Price Tracker",
    subtitle: "Principal Engineer Grade Monitoring Panel",
    version: "v1.2.0",
    dbType: "DB",
    telegramLinked: "Linked 🟢",
    telegramUnlinked: "Unlinked ⚪",
    scanAll: "Scan All Prices",
    scanning: "Scanning...",
    metricsTracked: "Tracked Products",
    metricsTrackedSub: "Real-time database records active",
    metricsDrops: "Price Drops Caught",
    metricsDropsSub: "Products lower than register price",
    metricsSavings: "Calculated Savings",
    metricsSavingsSub: "Total cash saved across tracker",
    addNewTracker: "Track New Lazada Product",
    addNewTrackerSub: "Add URLs or raw page source code for direct parsing bypass.",
    autoTab: "Auto Scrape",
    manualTab: "Page HTML Code Import",
    urlLabel: "Lazada Product URL",
    urlPlaceholder: "https://www.lazada.co.th/products/example-item-i12345.html",
    urlSub: "Enter the full web address of the product page from your Lazada App or browser.",
    targetPriceLabel: "Target Price (฿) (Optional)",
    targetPriceSub: "You will receive notifications if the price drops below this amount.",
    autoTabTip: "Auto-crawl leverages rotating mobile headers and a Gemini AI HTML analyzer backup to auto-extract pricing if captcha screens trigger.",
    manualLabel: "Paste Lazada Page Source HTML (Bulletproof Bypass)",
    manualPlaceholder: "Right click Lazada page -> View Source -> Copy -> Paste here...",
    manualTip: "Anti-Bot Bypassed 100%: If Lazada triggers captcha on our automated robot, simply visit the product in your browser, copy the raw Page Source (Ctrl+U), and paste it above. Our scraper parses it instantly!",
    failedAdd: "Adding product failed",
    failedAddManualTip: "Switch to 'Page HTML Code Import' to paste the source manually to bypass this block!",
    startTrackBtn: "Start Price Tracking",
    analyzingBtn: "Analyzing Page Content...",
    priceTrendTitle: "Price Trend Timeline",
    priceTrendSub: "Historical price movements recorded in the database",
    closeChart: "Close Chart",
    loadingTimeline: "Loading database price timeline...",
    singlePoint: "Single Price Point Registered",
    singlePointSub: "Not enough data points to plot a line chart yet. Historical prices will populate as soon as the background scraper detects a price change!",
    trackedCount: "Tracked Items",
    trackedCountSub: "Current active monitors linked to background worker",
    loadingDb: "Loading database records...",
    emptyState: "No Tracked Products",
    emptyStateSub: "Start monitoring products by submitting a Lazada product page URL in the form above.",
    initialPrice: "Initial Price",
    currentPrice: "Current Price",
    targetPrice: "Target Price",
    setTarget: "- Set -",
    priceDroppedAlert: "Price Dropped!",
    savedAmount: "Saved",
    historyBtn: "History",
    simulateDropBtn: "Simulate Drop",
    simulatingBtn: "Simulating...",
    simulateDropTip: "Simulate ฿150 price drop to test bot alerts",
    telegramTitle: "Telegram Notifications",
    telegramSub: "Standalone alerts on price drop",
    botTokenLabel: "Telegram Bot Token",
    chatIdLabel: "Your Chat ID",
    chatIdSub: "Your personal or channel Chat ID where the bot should send notifications.",
    pairingBtn: "Linking Bot Channel...",
    saveTestBtn: "Save & Test Telegram Link",
    setupTitle: "How to setup:",
    setupStep1: "Open Telegram app, search for @BotFather and click Start.",
    setupStep2: "Send /newbot command and follow instructions to get your Token.",
    setupStep3: "Search for your bot username in Telegram and send a message, e.g. Hello.",
    setupStep4: "Search for @userinfobot in Telegram and start a chat to get your personal Chat ID.",
    setupStep5: "Paste both above and click Save & Test Telegram Link!",
    cliTitle: "Standalone CLI Services",
    cliSub: "Run anywhere without web servers",
    cliText: "This application is built for ultimate modularity. The background price checker and the Telegram command bot work as standalone tools, perfect for Termux (Android) or a headless VPS!",
    cliCheckerTitle: "1. Price Checker Daemon",
    cliCheckerSub: "Runs price checks once and exits cleanly. Perfect to pair with Cron.",
    cliBotTitle: "2. Long-Polling Bot Daemon",
    cliBotSub: "Runs in background, responding to user Telegram commands instantly.",
    footerMade: "Lazada Price Tracker • Made with Node + React + TailwindCSS + Drizzle ORM",
    footerSpec: "Enterprise Grade Scraping Architecture, Bypassing Anti-Bot Blocks natively.",
    globalScanSuccess: "Global Price check completed successfully!",
    globalScanFailed: "Failed to execute global price scan.",
    simSuccess: "Simulated price drop successfully!",
    alertSent: "Telegram drop alert successfully dispatched!",
    alertNotSent: "Telegram notification skipped (no active Telegram bot paired).",
    downloadZip: "Download Standing ZIP Archive",
    downloadingZip: "Generating standalone bundle...",
    confirmTitle: "Confirm Action",
    confirmDeleteMsg: "Are you sure you want to stop tracking this product and delete its price history?",
    confirmBtn: "Delete Tracked Item",
    cancelBtn: "Cancel",
    toastScrapeSuccess: "🎉 Product tracked successfully via: "
  }
};

export default function App() {
  // Localization State
  const [lang, setLang] = useState<'th' | 'en'>('th'); // Default to Thai for regional relevance!

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Products & Dashboard lists
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  // Add Product form state
  const [url, setUrl] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [manualHtml, setManualHtml] = useState('');
  const [activeAddTab, setActiveAddTab] = useState<'auto' | 'manual'>('auto');
  const [addingProduct, setAddingProduct] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Telegram settings state
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgMessage, setTgMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Price history popup state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Dropdown / quick settings for target price
  const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
  const [newTargetPrice, setNewTargetPrice] = useState('');

  // Demo / simulation states
  const [simulatingId, setSimulatingId] = useState<number | null>(null);

  // CLI Copied States
  const [copiedChecker, setCopiedChecker] = useState(false);
  const [copiedBot, setCopiedBot] = useState(false);

  const handleCopyCommand = (text: string, type: 'checker' | 'bot') => {
    navigator.clipboard.writeText(text);
    if (type === 'checker') {
      setCopiedChecker(true);
      setTimeout(() => setCopiedChecker(false), 2000);
    } else {
      setCopiedBot(true);
      setTimeout(() => setCopiedBot(false), 2000);
    }
    showToast(lang === 'th' ? 'คัดลอกคำสั่งเรียบร้อยแล้ว!' : 'Command copied to clipboard!', 'success');
  };

  const t = translations[lang];

  // Helper to show modern toasts
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Helper to trigger custom confirm dialogs
  const askConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  // Fetch initial data
  useEffect(() => {
    fetchProducts();
    fetchTelegramStatus();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTelegramStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setTgStatus(data);
        if (data.token) setTgToken(data.token);
        if (data.chatId) setTgChatId(data.chatId);
      }
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    }
  };

  // Trigger global re-scan
  const handleScanAll = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/tracker/check-all', { method: 'POST' });
      if (res.ok) {
        await fetchProducts();
        showToast(t.globalScanSuccess, 'success');
      } else {
        showToast(t.globalScanFailed, 'error');
      }
    } catch (err) {
      console.error('Error checking prices:', err);
      showToast(t.globalScanFailed, 'error');
    } finally {
      setScanning(false);
    }
  };

  // Add Product Submit
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setFormError(lang === 'th' ? 'จำเป็นต้องกรอก URL สินค้า' : 'Lazada URL is required');
      return;
    }

    setFormError('');
    setFormSuccess('');
    setAddingProduct(true);

    try {
      const payload = {
        url,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        manualHtml: activeAddTab === 'manual' ? manualHtml : ''
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || (lang === 'th' ? 'ล้มเหลวในการเพิ่มสินค้า กรุณาตรวจสอบ URL สินค้าอีกครั้ง' : 'Failed to add product. Please check Lazada URL.'));
        showToast(lang === 'th' ? 'เพิ่มสินค้าไม่สำเร็จ กรุณาตรวจสอบข้อผิดพลาด' : 'Failed to add product.', 'error');
      } else {
        const successMsg = `${t.toastScrapeSuccess}${data.methodUsed}`;
        setFormSuccess(successMsg);
        showToast(successMsg, 'success');
        setUrl('');
        setTargetPrice('');
        setManualHtml('');
        fetchProducts();
      }
    } catch (err: any) {
      setFormError(err.message || (lang === 'th' ? 'ข้อผิดพลาดการเชื่อมต่อเซิร์ฟเวอร์' : 'Server connection error.'));
      showToast(err.message || 'Connection error.', 'error');
    } finally {
      setAddingProduct(false);
    }
  };

  // Delete product with custom confirmation modal
  const handleDeleteProduct = (id: number, productTitle: string) => {
    askConfirm(
      t.confirmTitle,
      `${t.confirmDeleteMsg}\n\n📦 ${productTitle}`,
      async () => {
        try {
          const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
          if (res.ok) {
            setProducts(prev => prev.filter(p => p.id !== id));
            showToast(lang === 'th' ? 'ลบข้อมูลสินค้าเรียบร้อย!' : 'Product deleted successfully!', 'success');
            if (selectedProduct?.id === id) setSelectedProduct(null);
          } else {
            showToast(lang === 'th' ? 'ลบสินค้าล้มเหลว' : 'Failed to delete product', 'error');
          }
        } catch (err) {
          console.error('Error deleting product:', err);
          showToast('Connection error.', 'error');
        }
      }
    );
  };

  // Save and test Telegram link
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgToken || !tgChatId) {
      setTgMessage({ 
        type: 'error', 
        text: lang === 'th' ? 'จำเป็นต้องระบุทั้งโทเค็นบอตและไอดีแชท' : 'Both Telegram Bot Token and Chat ID are required.' 
      });
      return;
    }

    setTgLoading(true);
    setTgMessage(null);

    try {
      const res = await fetch('/api/telegram/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgToken, chatId: tgChatId })
      });

      const data = await res.json();

      if (!res.ok) {
        setTgMessage({ type: 'error', text: data.error || (lang === 'th' ? 'การทดสอบส่งข้อความล้มเหลว' : 'Connection verification failed.') });
        showToast(lang === 'th' ? 'เชื่อมโยงบอตล้มเหลว' : 'Failed to link Telegram bot.', 'error');
      } else {
        const testNotice = lang === 'th' ? '⚡ เชื่อมต่อสำเร็จ! ส่งข้อความทดสอบเข้าแชทของคุณเรียบร้อยแล้ว' : '⚡ Bot linked successfully! Check your Telegram app for confirmation.';
        setTgMessage({ type: 'success', text: testNotice });
        showToast(testNotice, 'success');
        fetchTelegramStatus();
      }
    } catch (err: any) {
      setTgMessage({ type: 'error', text: err.message || 'Failed to communicate.' });
      showToast('Error pairing telegram.', 'error');
    } finally {
      setTgLoading(false);
    }
  };

  // Show price history details
  const handleViewHistory = async (product: Product) => {
    setSelectedProduct(product);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/products/${product.id}/history`);
      if (res.ok) {
        const data: PriceHistory[] = await res.json();
        
        // Format dates for recharts
        const formatted = data.map(pt => ({
          price: pt.price,
          date: new Date(pt.timestamp).toLocaleDateString(lang === 'th' ? 'th-TH' : undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        }));
        setHistoryData(formatted);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Quick update target price
  const handleUpdateTarget = async (id: number) => {
    try {
      const price = newTargetPrice ? parseFloat(newTargetPrice) : null;
      const res = await fetch(`/api/products/${id}/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPrice: price })
      });
      if (res.ok) {
        setEditingTargetId(null);
        setNewTargetPrice('');
        showToast(lang === 'th' ? 'อัปเดตราคาเป้าหมายสำเร็จ!' : 'Target price updated successfully!', 'success');
        fetchProducts();
      }
    } catch (err) {
      console.error('Error updating target price:', err);
      showToast('Error updating target price.', 'error');
    }
  };

  // Simulate drop (10% drop on demand to verify bot alerts)
  const handleSimulateDrop = async (id: number) => {
    setSimulatingId(id);
    try {
      const res = await fetch(`/api/products/${id}/simulate-drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropAmount: 150 }) // Drops price by ฿150
      });

      const data = await res.json();
      if (res.ok) {
        await fetchProducts();
        let notice = lang === 'th' 
          ? `⚡ จำลองราคาลดลง ฿${data.dropAmount}! ราคาใหม่: ฿${data.newPrice}.`
          : `⚡ Simulated ฿${data.dropAmount} Price Drop! New Price: ฿${data.newPrice}.`;
        
        if (data.alertSent) {
          notice += lang === 'th' 
            ? `\n🔔 ส่งข้อความแจ้งเตือนผ่าน Telegram แล้ว!`
            : `\n🔔 Telegram drop alert successfully dispatched!`;
          showToast(notice, 'success');
        } else {
          notice += lang === 'th'
            ? `\nℹ️ ไม่สามารถส่งแจ้งเตือน Telegram ได้ (ยังไม่ได้ผูกบอต)`
            : `\nℹ️ Telegram notification skipped (no active Telegram bot paired).`;
          showToast(notice, 'info');
        }
      } else {
        showToast(`${t.simulatingBtn} failed: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Connection failed: ${err.message}`, 'error');
    } finally {
      setSimulatingId(null);
    }
  };

  // Compute stats
  const totalTracked = products.length;
  const totalSavings = products.reduce((acc, p) => {
    const diff = p.initialPrice - p.currentPrice;
    return diff > 0 ? acc + diff : acc;
  }, 0);
  const dropsDetected = products.filter(p => p.currentPrice < p.initialPrice).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-900 relative overflow-hidden" id="main-container">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-40 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[130px] rounded-full pointer-events-none z-0" />
      
      {/* Toast Notifications Panel */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl flex gap-3 items-start"
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              ) : (
                <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 text-xs font-semibold text-slate-200 whitespace-pre-line">
                {toast.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl z-10"
            >
              <div className="flex gap-3 sm:gap-4 items-start">
                <div className="bg-red-500/10 p-2.5 sm:p-3 rounded-xl border border-red-500/20 text-red-400 shrink-0">
                  <Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-sans">{confirmModal.title}</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-2 leading-relaxed whitespace-pre-line">{confirmModal.message}</p>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3 justify-end mt-5 sm:mt-6">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl transition duration-150 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold bg-red-600 hover:bg-red-500 border border-red-500/20 text-white rounded-xl transition duration-150 cursor-pointer"
                >
                  {t.confirmBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 transition-all py-2 sm:py-0" id="app-header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[4rem] flex flex-row items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="bg-emerald-500/10 p-1.5 sm:p-2 rounded-xl border border-emerald-500/30 shrink-0">
              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                <span className="truncate">{t.title}</span>
                <span className="text-[9px] sm:text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded-full font-mono shrink-0">
                  {t.version}
                </span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate hidden sm:block">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto sm:ml-0">
            {/* Language Selector */}
            <button 
              onClick={() => {
                const nextLang = lang === 'th' ? 'en' : 'th';
                setLang(nextLang);
                showToast(nextLang === 'th' ? 'เปลี่ยนภาษาเป็นไทยสำเร็จ' : 'Language changed to English successfully', 'info');
              }}
              className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-2 sm:px-3 py-1.5 text-xs text-slate-300 font-medium transition cursor-pointer"
              title="Switch Language / เปลี่ยนภาษา"
            >
              <Languages className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">{lang === 'th' ? 'English (EN)' : 'ภาษาไทย (TH)'}</span>
              <span className="sm:hidden font-bold">{lang === 'th' ? 'EN' : 'TH'}</span>
            </button>

            {/* Database indicator */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 font-mono">
              <Database className="h-3.5 w-3.5 text-blue-400" />
              {t.dbType}: sqlite
            </div>

            {/* Telegram status */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <Bell className="h-3.5 w-3.5 text-emerald-400" />
              Telegram: {tgStatus?.hasToken ? (
                <span className="text-emerald-400 font-medium">{t.telegramLinked}</span>
              ) : (
                <span className="text-slate-400 font-medium">{t.telegramUnlinked}</span>
              )}
            </div>

            <button 
              onClick={handleScanAll}
              disabled={scanning || products.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-slate-500 disabled:border-slate-800 border border-emerald-500/20 text-slate-950 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-500/5 transition duration-150 cursor-pointer shrink-0"
              id="btn-scan-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${scanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{scanning ? t.scanning : t.scanAll}</span>
              <span className="sm:hidden">{scanning ? '...' : (lang === 'th' ? 'สแกน' : 'Scan')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8" id="main-content">
        
        {/* Core Metrics Hub */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8" id="metrics-dashboard">
          {/* Card 1: Total Products */}
          <div className="bg-slate-900/40 border border-slate-900/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wider uppercase">{t.metricsTracked}</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono">{totalTracked}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{t.metricsTrackedSub}</p>
            </div>
            <div className="bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-800 shrink-0">
              <Info className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300" />
            </div>
          </div>

          {/* Card 2: Total Price Drops */}
          <div className="bg-slate-900/40 border border-slate-900/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wider uppercase">{t.metricsDrops}</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1 font-mono">{dropsDetected}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{t.metricsDropsSub}</p>
            </div>
            <div className="bg-emerald-500/10 p-2 sm:p-3 rounded-xl border border-emerald-500/20 shrink-0">
              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
            </div>
          </div>

          {/* Card 3: Total Savings */}
          <div className="bg-slate-900/40 border border-slate-900/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wider uppercase">{t.metricsSavings}</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono">
                ฿{totalSavings.toLocaleString()}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{t.metricsSavingsSub}</p>
            </div>
            <div className="bg-emerald-500/10 p-2 sm:p-3 rounded-xl border border-emerald-500/20 shrink-0">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8" id="workspace-grid">
          
          {/* Left Column (8 cols): Products & Dashboard */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Tab Selector & Add Tracker Form */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-2xl" id="add-tracker-section">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-4 mb-5 gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-sans">
                    <Plus className="h-4 w-4 text-emerald-400" />
                    {t.addNewTracker}
                  </h3>
                  <p className="text-xs text-slate-400">{t.addNewTrackerSub}</p>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900">
                  <button 
                    onClick={() => { setActiveAddTab('auto'); setFormError(''); }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-150 cursor-pointer ${activeAddTab === 'auto' ? 'bg-emerald-600 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    {t.autoTab}
                  </button>
                  <button 
                    onClick={() => { setActiveAddTab('manual'); setFormError(''); }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-150 cursor-pointer ${activeAddTab === 'manual' ? 'bg-emerald-600 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    {t.manualTab}
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-4" id="add-form">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {t.urlLabel}
                  </label>
                  <input 
                    type="url" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t.urlPlaceholder}
                    className="w-full bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t.urlSub}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      {t.targetPriceLabel}
                    </label>
                    <input 
                      type="number" 
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {t.targetPriceSub}
                    </p>
                  </div>

                  <div className="flex flex-col justify-end">
                    {activeAddTab === 'auto' && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex items-start gap-2.5">
                        <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-[11px] text-slate-300 leading-normal">
                          {t.autoTabTip}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {activeAddTab === 'manual' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />
                      {t.manualLabel}
                    </label>
                    <textarea 
                      value={manualHtml}
                      onChange={(e) => setManualHtml(e.target.value)}
                      placeholder={t.manualPlaceholder}
                      rows={5}
                      className="w-full bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none transition"
                      required
                    />
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex items-start gap-2 mt-1">
                      <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-300 leading-normal">
                        {t.manualTip}
                      </p>
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-2 text-xs text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{t.failedAdd}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-red-300/90">{formError}</p>
                      {activeAddTab === 'auto' && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          💡 {t.failedAddManualTip}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {formSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={addingProduct}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-slate-500 disabled:border-slate-800 border border-emerald-500/20 text-slate-950 py-3 rounded-xl font-bold transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {addingProduct ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t.analyzingBtn}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        {t.startTrackBtn}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Price History Chart Section */}
            {selectedProduct && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-2xl relative" id="history-chart-block">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-4 mb-5 gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-emerald-500/10 p-2 rounded-xl shrink-0">
                      <ChartIcon className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-white font-sans truncate" title={selectedProduct.title}>
                        {selectedProduct.title}
                      </h3>
                      <p className="text-xs text-slate-400">{t.priceTrendSub}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition cursor-pointer font-semibold self-start sm:self-auto shrink-0"
                  >
                    {t.closeChart}
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="h-60 sm:h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                    <span className="text-xs">{t.loadingTimeline}</span>
                  </div>
                ) : historyData.length <= 1 ? (
                  <div className="h-60 sm:h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 p-4 sm:p-6">
                    <Info className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600 mb-2" />
                    <span className="text-xs font-semibold">{t.singlePoint}</span>
                    <span className="text-[11px] text-slate-500 mt-1 text-center max-w-xs leading-normal">
                      {t.singlePointSub}
                    </span>
                  </div>
                ) : (
                  <div className="h-60 sm:h-72 w-full mt-4 bg-slate-950/50 p-2 sm:p-4 rounded-xl border border-slate-900">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="priceGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.00}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                          labelClassName="text-slate-400"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          name="Price (฿)"
                          stroke="#10b981" 
                          strokeWidth={2.5}
                          fill="url(#priceGlow)"
                          dot={{ r: 4, strokeWidth: 1 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* List of Tracked Products */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-2xl" id="tracked-list-section">
              <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-5">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-sans">
                    {t.trackedCount} ({products.length})
                  </h3>
                  <p className="text-xs text-slate-400">{t.trackedCountSub}</p>
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="text-xs">{t.loadingDb}</span>
                </div>
              ) : products.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-900 rounded-xl bg-slate-950/25 p-8" id="empty-state">
                  <TrendingDown className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">{t.emptyState}</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
                    {t.emptyStateSub}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="products-grid">
                  {products.map(p => {
                    const priceDiff = p.initialPrice - p.currentPrice;
                    const isDropped = priceDiff > 0;
                    const dropPercent = p.initialPrice > 0 ? Math.round((priceDiff / p.initialPrice) * 100) : 0;
                    const isChecking = simulatingId === p.id;

                    return (
                      <div 
                        key={p.id} 
                        className={`bg-slate-950/70 border rounded-xl overflow-hidden shadow-xl transition-all hover:scale-[1.01] flex flex-col ${isDropped ? 'border-emerald-500/20 ring-1 ring-emerald-500/5' : 'border-slate-900/80'}`}
                      >
                        {/* Upper Info Row */}
                        <div className="p-3 sm:p-4 flex gap-2.5 sm:gap-3 border-b border-slate-900">
                          {p.imageUrl ? (
                            <img 
                              src={p.imageUrl} 
                              alt={p.title} 
                              className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-cover shrink-0 bg-slate-900 border border-slate-800" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                              <TrendingDown className="h-5 w-5 text-slate-600" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h4 className="text-[11px] sm:text-xs font-bold text-slate-200 line-clamp-2 hover:text-emerald-400 transition">
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1">
                                {p.title}
                                <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 inline-block text-slate-500" />
                              </a>
                            </h4>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              {lang === 'th' ? 'ตรวจล่าสุด: ' : 'Checked: '}{new Date(p.lastChecked).toLocaleTimeString(lang === 'th' ? 'th-TH' : undefined)}
                            </p>
                          </div>
                        </div>

                        {/* Price Metrics row */}
                        <div className="p-3 sm:p-4 grid grid-cols-3 gap-1 sm:gap-2 bg-slate-950/20 border-b border-slate-900 text-center">
                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold">{t.initialPrice}</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-400 font-mono mt-0.5">฿{p.initialPrice.toLocaleString()}</p>
                          </div>

                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold">{t.currentPrice}</p>
                            <p className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${isDropped ? 'text-emerald-400' : 'text-slate-200'}`}>
                              ฿{p.currentPrice.toLocaleString()}
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold">{t.targetPrice}</p>
                            {editingTargetId === p.id ? (
                              <div className="flex items-center gap-1 mt-0.5 justify-center">
                                <input 
                                  type="number" 
                                  value={newTargetPrice}
                                  onChange={(e) => setNewTargetPrice(e.target.value)}
                                  placeholder="฿"
                                  className="w-12 sm:w-14 bg-slate-900 border border-slate-800 rounded px-1 text-[10px] sm:text-xs text-center text-white font-mono py-0.5"
                                />
                                <button 
                                  onClick={() => handleUpdateTarget(p.id)}
                                  className="text-[9px] sm:text-[10px] bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-1 py-0.5 rounded font-bold cursor-pointer"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <p 
                                onClick={() => { setEditingTargetId(p.id); setNewTargetPrice(p.targetPrice?.toString() || ''); }}
                                className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition cursor-pointer font-mono mt-0.5"
                                title="Click to edit target price"
                              >
                                {p.targetPrice ? `฿${p.targetPrice.toLocaleString()}` : t.setTarget}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Extra Status / Savings row */}
                        {isDropped && (
                          <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-500/5 text-emerald-400 text-[10px] sm:text-xs font-semibold flex items-center justify-between border-b border-slate-900 gap-2">
                            <span className="flex items-center gap-1 shrink-0">
                              <TrendingDown className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                              {t.priceDroppedAlert}
                            </span>
                            <span className="truncate">
                              {t.savedAmount} ฿{priceDiff.toLocaleString()} (-{dropPercent}%)
                            </span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="p-2 sm:p-3 bg-slate-950/80 flex items-center justify-between mt-auto gap-2">
                          <div className="flex gap-1.5 min-w-0">
                            <button 
                              onClick={() => handleViewHistory(p)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg border border-slate-900 transition flex items-center gap-1 text-[10px] sm:text-xs cursor-pointer font-semibold truncate"
                              title="View History Chart"
                            >
                              <ChartIcon className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{t.historyBtn}</span>
                            </button>

                            <button 
                              onClick={() => handleSimulateDrop(p.id)}
                              disabled={isChecking}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50 rounded-lg border border-emerald-500/10 bg-emerald-500/5 transition flex items-center gap-1 text-[10px] sm:text-xs font-semibold cursor-pointer truncate"
                              title={t.simulateDropTip}
                            >
                              <Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5 shrink-0" />
                              <span className="truncate">{isChecking ? t.simulatingBtn : t.simulateDropBtn}</span>
                            </button>
                          </div>

                          <button 
                            onClick={() => handleDeleteProduct(p.id, p.title)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg border border-transparent transition cursor-pointer shrink-0"
                            title="Delete and stop tracking"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column (4 cols): Settings & Guides */}
          <div className="lg:col-span-4 flex flex-col gap-6" id="sidebar-container">
            
            {/* Telegram Setup Integration Widget */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-2xl" id="telegram-pairing-hub">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-950 mb-5">
                <Bell className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white font-sans">{t.telegramTitle}</h3>
                  <p className="text-[11px] text-slate-400">{t.telegramSub}</p>
                </div>
              </div>

              <form onSubmit={handleSaveTelegram} className="space-y-4" id="telegram-form">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    {t.botTokenLabel}
                  </label>
                  <input 
                    type="password" 
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    placeholder="e.g. 123456789:ABCDefGhI..."
                    className="w-full bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    {t.chatIdLabel}
                  </label>
                  <input 
                    type="text" 
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    placeholder="e.g. 987654321"
                    className="w-full bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t.chatIdSub}
                  </p>
                </div>

                {tgMessage && (
                  <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${tgMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {tgMessage.type === 'success' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 inline mr-1 text-red-400" />
                    )}
                    {tgMessage.text}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={tgLoading}
                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {tgLoading ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                      {t.pairingBtn}
                    </>
                  ) : (
                    <>
                      <Bell className="h-3 w-3 text-emerald-400" />
                      {t.saveTestBtn}
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 border-t border-slate-950 pt-4">
                <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1 font-sans">
                  <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
                  {t.setupTitle}
                </h4>
                <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1.5 leading-relaxed pl-1">
                  <li>{t.setupStep1}</li>
                  <li>{t.setupStep2}</li>
                  <li>{t.setupStep3}</li>
                  <li>{t.setupStep4}</li>
                  <li>{t.setupStep5}</li>
                </ol>
              </div>
            </div>

            {/* Standalone Daemon Instructions */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-2xl" id="standalone-daemon-guide">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-950 mb-4">
                <BookOpen className="h-5 w-5 text-blue-400 shrink-0" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white font-sans">{t.cliTitle}</h3>
                  <p className="text-[11px] text-slate-400">{t.cliSub}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  {t.cliText}
                </p>

                <div className="border border-slate-950 rounded-xl p-3 bg-slate-950/40 relative group">
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 font-sans">
                    {t.cliCheckerTitle}
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-2">{t.cliCheckerSub}</p>
                  <div className="relative">
                    <code className="block bg-slate-950 p-2.5 rounded text-[10px] text-emerald-400 font-mono border border-slate-900 select-all pr-8">
                      npm run check
                    </code>
                    <button
                      onClick={() => handleCopyCommand('npm run check', 'checker')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition p-1 cursor-pointer"
                      title="Copy Command"
                    >
                      {copiedChecker ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="border border-slate-950 rounded-xl p-3 bg-slate-950/40 relative group">
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 font-sans">
                    {t.cliBotTitle}
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-2">{t.cliBotSub}</p>
                  <div className="relative">
                    <code className="block bg-slate-950 p-2.5 rounded text-[10px] text-emerald-400 font-mono border border-slate-900 select-all pr-8">
                      npm run bot
                    </code>
                    <button
                      onClick={() => handleCopyCommand('npm run bot', 'bot')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition p-1 cursor-pointer"
                      title="Copy Command"
                    >
                      {copiedBot ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12 text-center text-xs text-slate-500" id="app-footer">
        <p>{t.footerMade}</p>
        <p className="mt-1 text-[11px] text-slate-600">{t.footerSpec}</p>
      </footer>

    </div>
  );
}
