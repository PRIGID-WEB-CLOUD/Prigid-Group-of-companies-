import { useState, useEffect, useRef, useMemo } from "react";
import {
  MdSearch,
  MdSend,
  MdRefresh,
  MdVolumeUp,
  MdVolumeOff,
  MdForum,
  MdHistory,
  MdShoppingBag,
  MdModeEdit,
  MdEmail,
  MdPhone,
  MdCheckCircle,
  MdClose,
  MdDeleteSweep,
  MdEmojiEmotions,
  MdMoreVert,
  MdArrowForward,
  MdArrowBack,
  MdInfo
} from "react-icons/md";
import { SiWhatsapp, SiFacebook, SiInstagram, SiMeta } from "react-icons/si";
import { Link } from "wouter";
import AdminLayout from "./AdminLayout";

interface ChatMessage {
  id: string;
  threadId: string;
  sender: "customer" | "admin" | "system";
  text: string;
  timestamp: string | Date;
  status: "sent" | "delivered" | "read";
  customerName: string;
  phone?: string;
  email?: string;
  channel: "whatsapp" | "facebook" | "instagram";
  channelType: "chat" | "comment";
  type?: "message" | "comment" | "note";
  recipientId?: string;
}

interface ChatThread {
  threadId: string;
  customerName: string;
  lastMessage: string;
  timestamp: string | Date;
  unreadCount: number;
  channel: "whatsapp" | "facebook" | "instagram";
  phone: string;
  email: string;
  messages: ChatMessage[];
  // Mock/Simulated CRM extra info
  ordersCount: number;
  totalSpend: number;
  notes?: string;
}

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState<"all" | "whatsapp" | "facebook" | "instagram">("all");
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [healthStatus, setHealthStatus] = useState<{ db: boolean; sse: boolean }>({ db: true, sse: false });
  const [metaConnected, setMetaConnected] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check health and meta status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [healthRes, metaRes] = await Promise.all([
          fetch("/api/chat/health"),
          fetch("/api/channels/meta/status")
        ]);
        
        setHealthStatus(prev => ({ ...prev, db: healthRes.ok }));
        
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setMetaConnected(metaData.connected);
        } else {
          setMetaConnected(false);
        }
      } catch (err) {
        console.error("Status check failed:", err);
        setHealthStatus(prev => ({ ...prev, db: false }));
        setMetaConnected(false);
      }
    };
    checkStatus();
  }, []);

  // Helper to reconstruct threads from DB messages
  const threads = useMemo(() => {
    const threadMap = new Map<string, ChatThread>();

    messages.forEach((msg) => {
      if (!threadMap.has(msg.threadId)) {
        threadMap.set(msg.threadId, {
          threadId: msg.threadId,
          customerName: msg.customerName,
          lastMessage: msg.text,
          timestamp: msg.timestamp,
          unreadCount: 0,
          channel: msg.channel,
          phone: msg.phone || "N/A",
          email: msg.email || "N/A",
          messages: [],
          ordersCount: Math.floor(Math.random() * 5), // Mock
          totalSpend: Math.random() * 500, // Mock
          notes: "Regular customer interested in winter collections." // Mock
        });
      }

      const thread = threadMap.get(msg.threadId)!;
      thread.messages.push(msg);

      // Simple logic to determine unread: if sender is customer and status isn't "read"
      if (msg.sender === "customer" && msg.status !== "read") {
        thread.unreadCount++;
      }

      // Update thread summary with latest message
      const msgTime = new Date(msg.timestamp).getTime();
      const threadTime = new Date(thread.timestamp).getTime();
      if (msgTime > threadTime) {
        thread.lastMessage = msg.text;
        thread.timestamp = msg.timestamp;
      }
    });

    return Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [messages]);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.threadId === activeThreadId) || null;
  }, [threads, activeThreadId]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const matchSearch =
        t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone.includes(searchQuery) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChannel = filterChannel === "all" || t.channel === filterChannel;
      return matchSearch && matchChannel;
    });
  }, [threads, searchQuery, filterChannel]);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chat/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Fetch
  useEffect(() => {
    fetchMessages();
  }, []);

  // SSE Subscription for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource("/api/events/live");

      eventSource.onopen = () => {
        setHealthStatus(prev => ({ ...prev, sse: true }));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message") {
            const payload = data.payload;

            // Handle system sync events
            if (payload.sender === "system") {
              if (payload.action === "clear-all") {
                setMessages([]);
                setActiveThreadId(null);
              } else if (payload.action === "clear-unread") {
                setMessages(prev => prev.map(m => 
                  m.threadId === payload.threadId ? { ...m, status: "read" } : m
                ));
              } else if (payload.action === "delete-thread") {
                setMessages(prev => prev.filter(m => m.threadId !== payload.threadId));
                if (activeThreadId === payload.threadId) setActiveThreadId(null);
              } else if (payload.action === "delete-message") {
                setMessages(prev => prev.filter(m => m.id !== payload.messageId));
              }
              return;
            }

            // Normal chat message ingestion
            setMessages((prev) => {
              // De-duplicate if message already exists (e.g. sent by this client)
              if (prev.some(m => m.id === payload.id)) return prev;
              const newList = [...prev, payload];
              return newList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            });

            // Notification Sound
            if (soundEnabled && payload.sender === "customer") {
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
              audio.play().catch(() => {});
            }
          }
        } catch (err) {
          console.error("SSE parse error", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error", err);
        setHealthStatus(prev => ({ ...prev, sse: false }));
        eventSource?.close();
        // Retry connection after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();
    return () => {
      eventSource?.close();
    };
  }, [soundEnabled, activeThreadId]);

  // Scroll to bottom when messages or active thread change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeThreadId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeThread) return;

    const payload = {
      threadId: activeThread.threadId,
      text: inputMessage,
      channel: activeThread.channel,
      customerName: activeThread.customerName,
      phone: activeThread.phone,
      email: activeThread.email,
      type: isInternalNote ? "note" : "message"
    };

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setInputMessage("");
        // Note: The SSE event will update the local state with the actual DB message
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleClearUnread = async (threadId: string) => {
    try {
      await fetch(`/api/chat/threads/${threadId}/clear-unread`, { method: "POST" });
    } catch (err) {
      console.error("Error clearing unread:", err);
    }
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    handleClearUnread(threadId);
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!window.confirm("Permanently delete this entire conversation thread?")) return;
    try {
      await fetch(`/api/chat/threads/${threadId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Error deleting thread:", err);
    }
  };

  const handleClearAllMessages = async () => {
    if (!window.confirm("CRITICAL ACTION: This will erase the entire CRM chat history across all channels. Proceed?")) return;
    try {
      await fetch("/api/chat/messages", { method: "DELETE" });
    } catch (err) {
      console.error("Error clearing all messages:", err);
    }
  };

  const handleUpdateCustomerNotes = async (notes: string) => {
    // This would ideally be an API call to update customer record in DB
    // For now we just mock the local update if we had a persistent customers table
    console.log("Updating customer notes:", notes);
  };

  const quickReplies = [
    "Hello! How can I help you today?",
    "Thank you for contacting Luxe Boutique! We appreciate your query. How can we assist you today?",
    "We offer 100% organic cashmere and silk fabrics directly imported from our family mills in Milan. Let us know if you would like a digital catalog.",
    "For all domestic orders over €150, we provide complimentary Express Delivery within 2-3 business days with tracking included.",
    "Your order has been safely prepared by our team and is currently awaiting dispatch. We will send you an automated tracking link shortly!",
    "Bespoke fittings can be scheduled directly with our Florence team. Would Wednesday or Thursday suit you best?"
  ];

  return (
    <AdminLayout sidebar="channels">
      <div className="flex flex-col h-[calc(100vh-130px)] bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden" id="crm-chat-app">
        {metaConnected === false ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white p-8 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <SiFacebook className="text-4xl text-slate-300" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#0b1c30] mb-2">Meta Suite Disconnected</h2>
            <p className="text-slate-500 font-[Manrope] text-sm max-w-md mb-8">
              To access your Facebook Messenger, Instagram Direct, and WhatsApp Business communications, please connect your Meta Business Suite account first.
            </p>
            <Link 
              href="/admin/channels/meta-business"
              className="px-6 py-3 bg-[#006c49] text-white rounded-xl font-bold font-[Manrope] text-sm hover:bg-[#005a3c] transition-all shadow-sm"
            >
              Connect Meta Business Suite
            </Link>
          </div>
        ) : (
          <>
            {/* Top Control Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[#0b1c30]">Omnichannel CRM Inbox</h1>
            <p className="text-xs text-slate-500 font-[Manrope] mt-1">
              Synchronized WhatsApp Business API, Facebook Messenger, and Instagram Direct Comment Threads
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Health Status Dashboard */}
            <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5" title={healthStatus.db ? "Database Connected" : "Database Connection Error"}>
                <span className={`w-1.5 h-1.5 rounded-full ${healthStatus.db ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">DB</span>
              </div>
              <div className="w-px h-3 bg-slate-200" />
              <div className="flex items-center gap-1.5" title={healthStatus.sse ? "Live SSE Active" : "Live SSE Disconnected"}>
                <span className={`w-1.5 h-1.5 rounded-full ${healthStatus.sse ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Live</span>
              </div>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg text-slate-500 hover:text-[#006c49] hover:bg-slate-50 border border-slate-100 transition-colors"
              title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
            >
              {soundEnabled ? <MdVolumeUp className="text-base" /> : <MdVolumeOff className="text-base" />}
            </button>

            {/* Sync History Button */}
            <button
              onClick={fetchMessages}
              disabled={loading}
              className={`p-2 rounded-lg text-slate-400 hover:text-[#006c49] hover:bg-slate-50 border border-slate-100 transition-colors ${loading ? "animate-spin" : ""}`}
              title="Manually sync chat history from server (Background Check)"
            >
              <MdRefresh className="text-lg" />
            </button>

            {/* Clear All Messages Button */}
            <button
              onClick={handleClearAllMessages}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 transition-colors"
              title="Clear all CRM messages and threads"
            >
              <MdDeleteSweep className="text-lg" />
            </button>
          </div>
        </div>

        {/* Core Workspace Grid */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Section 1: Customer List & Search (Left Panel) */}
          <div className={`bg-white flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-in-out border-slate-100 ${leftSidebarOpen ? "w-80 border-r opacity-100" : "w-0 border-r-0 opacity-0 pointer-events-none"}`}>
            {/* Search Input */}
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <MdSearch className="absolute left-3 top-2.5 text-slate-400 text-lg" />
                <input
                  type="text"
                  placeholder="Search chats, numbers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-[#006c49] rounded-lg text-xs outline-none font-[Manrope]"
                />
              </div>
            </div>

            {/* Channel Filters Vertical List */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/40 space-y-1.5 shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Filter Communications</p>
              <button
                onClick={() => setFilterChannel("all")}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold font-[Manrope] rounded-lg transition-all border ${filterChannel === "all" ? "bg-white text-slate-900 shadow-sm border-slate-200" : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>All Channels</span>
                </div>
                <span className="text-[9px] text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded-full font-bold font-mono">
                  {threads.length}
                </span>
              </button>
              <button
                onClick={() => setFilterChannel("whatsapp")}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold font-[Manrope] rounded-lg transition-all border ${filterChannel === "whatsapp" ? "bg-emerald-50 text-[#25D366] border-emerald-100 shadow-xs" : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100"}`}
              >
                <div className="flex items-center gap-2">
                  <SiWhatsapp className="text-[#25D366] text-sm" />
                  <span>WhatsApp API</span>
                </div>
                <span className="text-[9px] text-emerald-600 bg-emerald-100/50 px-1.5 py-0.5 rounded-full font-bold font-mono">
                  {threads.filter(t => t.channel === "whatsapp").length}
                </span>
              </button>
              <button
                onClick={() => setFilterChannel("facebook")}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold font-[Manrope] rounded-lg transition-all border ${filterChannel === "facebook" ? "bg-blue-50 text-[#1877F2] border-blue-100 shadow-xs" : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100"}`}
              >
                <div className="flex items-center gap-2">
                  <SiFacebook className="text-[#1877F2] text-sm" />
                  <span>Facebook CRM</span>
                </div>
                <span className="text-[9px] text-blue-600 bg-blue-100/50 px-1.5 py-0.5 rounded-full font-bold font-mono">
                  {threads.filter(t => t.channel === "facebook").length}
                </span>
              </button>
              <button
                onClick={() => setFilterChannel("instagram")}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold font-[Manrope] rounded-lg transition-all border ${filterChannel === "instagram" ? "bg-rose-50 text-[#E4405F] border-rose-100 shadow-xs" : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100"}`}
              >
                <div className="flex items-center gap-2">
                  <SiInstagram className="text-[#E4405F] text-sm" />
                  <span>Instagram Direct</span>
                </div>
                <span className="text-[9px] text-rose-600 bg-rose-100/50 px-1.5 py-0.5 rounded-full font-bold font-mono">
                  {threads.filter(t => t.channel === "instagram").length}
                </span>
              </button>
            </div>

            {/* Thread Scroll Area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-slate-400 mt-10">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MdSearch className="text-xl text-slate-300" />
                  </div>
                  <p className="text-xs font-[Manrope]">No conversations match your criteria.</p>
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <div
                    key={thread.threadId}
                    onClick={() => handleSelectThread(thread.threadId)}
                    className={`group relative p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50/50 ${activeThreadId === thread.threadId ? "bg-slate-50/80 border-l-4 border-l-[#006c49]" : ""}`}
                  >
                    <div className="flex gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#0b1c30]/5 text-[#0b1c30] flex items-center justify-center font-serif font-bold text-sm">
                          {thread.customerName.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                          {thread.channel === "whatsapp" && <SiWhatsapp className="text-[#25D366] text-[10px]" />}
                          {thread.channel === "facebook" && <SiFacebook className="text-[#1877F2] text-[10px]" />}
                          {thread.channel === "instagram" && <SiInstagram className="text-[#E4405F] text-[10px]" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="font-serif font-bold text-xs text-[#0b1c30] truncate">{thread.customerName}</h3>
                          <span className="text-[9px] text-slate-400 font-medium">
                            {new Date(thread.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate ${thread.unreadCount > 0 ? "font-bold text-slate-900" : "text-slate-500"}`}>
                          {thread.lastMessage}
                        </p>
                      </div>
                      {thread.unreadCount > 0 && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#006c49] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {thread.unreadCount}
                        </div>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread.threadId); }}
                        className="absolute right-2 top-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MdClose className="text-xs" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Active Conversation & Reply Area (Center Panel) */}
          <div className="flex-1 flex flex-col bg-white min-w-0 relative">
            {activeThread ? (
              <>
                {/* Thread Header */}
                <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md lg:hidden"
                    >
                      <MdArrowBack />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-serif font-bold text-[#0b1c30] text-sm">{activeThread.customerName}</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">•</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{activeThread.channel} Thread</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold font-[Manrope]">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        <span>Connected & Syncing</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                      className={`p-2 rounded-lg transition-colors ${rightSidebarOpen ? "bg-[#006c49]/10 text-[#006c49]" : "text-slate-400 hover:bg-slate-50"}`}
                      title="Toggle CRM Customer Details Sidebar"
                    >
                      <MdInfo className="text-lg" />
                    </button>
                    <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                      <MdMoreVert className="text-lg" />
                    </button>
                  </div>
                </div>

                {/* Messages List Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/30">
                  {activeThread.messages.map((msg, idx) => {
                    const isSelf = msg.sender === "admin";
                    const isSystem = msg.sender === "system";
                    const isNote = msg.type === "note";

                    if (isSystem && !isNote) return null;

                    return (
                      <div key={msg.id || idx} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] group ${isNote ? "w-full" : ""}`}>
                          {isNote ? (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs font-[Manrope] text-amber-900 shadow-xs relative">
                              <div className="flex items-center gap-2 mb-1.5">
                                <MdModeEdit className="text-amber-500" />
                                <span className="font-bold uppercase tracking-widest text-[9px]">Internal Admin Note</span>
                                <span className="text-amber-400 ml-auto">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              {msg.text}
                            </div>
                          ) : (
                            <>
                              <div className={`text-[10px] font-bold text-slate-400 mb-1 px-1 flex items-center gap-2 ${isSelf ? "justify-end" : "justify-start"}`}>
                                {isSelf ? "Luxe Boutique Admin" : msg.customerName}
                                <span>•</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <div className={`relative px-4 py-3 rounded-2xl text-xs font-[Manrope] shadow-xs leading-relaxed ${isSelf ? "bg-[#006c49] text-white rounded-tr-none" : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"}`}>
                                {msg.text}
                                {isSelf && (
                                  <div className="absolute -bottom-4 right-0 flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase">
                                    <MdCheckCircle className={msg.status === "read" ? "text-blue-500" : "text-slate-300"} />
                                    <span>{msg.status}</span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Composition Area */}
                <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                  {/* Quick Replies Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 no-scrollbar">
                    <div className="flex items-center gap-1.5 mr-2 shrink-0">
                      <MdEmojiEmotions className="text-[#006c49]" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shortcuts:</span>
                    </div>
                    {quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => setInputMessage(reply)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-[10px] font-semibold text-slate-600 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {reply.slice(0, 30)}...
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsInternalNote(!isInternalNote)}
                      className={`p-3 rounded-xl transition-all border ${isInternalNote ? "bg-amber-100 text-amber-600 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"}`}
                      title={isInternalNote ? "Switch to Public Customer Reply" : "Switch to Private Admin Note"}
                    >
                      <MdModeEdit className="text-base" />
                    </button>
                    <input
                      type="text"
                      placeholder={isInternalNote ? "Type an internal admin note about customer..." : "Type reply to send..."}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                      className={`flex-1 px-4 py-3 border rounded-xl outline-none text-xs font-[Manrope] transition-colors focus:ring-1 ${
                        isInternalNote 
                          ? "border-amber-300 focus:border-amber-500 focus:ring-amber-300 bg-amber-50/20" 
                          : "border-slate-200 focus:border-[#006c49] focus:ring-[#006c49]"
                      }`}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim()}
                      className={`p-3 rounded-xl transition-all shadow-sm ${
                        !inputMessage.trim() 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                          : isInternalNote 
                            ? "bg-amber-500 text-white hover:bg-amber-600" 
                            : "bg-[#006c49] text-white hover:bg-[#005a3c]"
                      }`}
                    >
                      <MdSend className="text-base" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MdForum className="text-5xl text-slate-200 mb-2" />
                Select a thread to view conversation
              </div>
            )}
          </div>

          {/* Section 3: Customer CRM Profile Sidebar (Right Panel) */}
          {activeThread && (
            <div className={`bg-slate-50/50 flex flex-col gap-6 shrink-0 transition-all duration-300 ease-in-out border-l border-slate-100 ${rightSidebarOpen ? "w-80 p-6 opacity-100 overflow-y-auto" : "w-0 p-0 opacity-0 border-l-0 pointer-events-none overflow-hidden"}`}>
              {/* Profile card summary */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#006c49]/10 text-[#006c49] font-serif font-bold text-xl flex items-center justify-center mb-3">
                  {activeThread.customerName.split(" ").map(n => n[0]).join("").toUpperCase()}
                </div>
                <h3 className="font-serif font-bold text-[#0b1c30] text-sm">{activeThread.customerName}</h3>
                <span className="text-[10px] text-[#006c49] font-bold font-[Manrope] bg-[#006c49]/5 px-2.5 py-0.5 rounded-full mt-1.5 flex items-center gap-1 uppercase tracking-wider">
                  {activeThread.channel === "whatsapp" && <SiWhatsapp />}
                  {activeThread.channel === "facebook" && <SiFacebook />}
                  {activeThread.channel === "instagram" && <SiInstagram />}
                  <span>{activeThread.channel}</span>
                </span>
              </div>

              {/* CRM Contact channels */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold font-[Manrope] uppercase tracking-widest text-slate-400">
                  CRM Contact Details
                </h4>
                <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3 text-xs font-[Manrope]">
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <MdPhone className="text-slate-400 text-base" />
                    <span>{activeThread.phone}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 min-w-0">
                    <MdEmail className="text-slate-400 text-base shrink-0" />
                    <span className="truncate">{activeThread.email}</span>
                  </div>
                </div>
              </div>

              {/* Order Statistics Summary */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold font-[Manrope] uppercase tracking-widest text-slate-400 flex items-center justify-between">
                  <span>Sales & Customer Value</span>
                  <MdHistory className="text-slate-400 text-sm" />
                </h4>
                <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3 text-xs font-[Manrope]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Lifetime Purchases:</span>
                    <strong className="text-[#0b1c30]">{activeThread.ordersCount} orders</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 border-t border-slate-50 pt-3">
                    <span>Total Net Revenue:</span>
                    <strong className="text-[#006c49] text-sm">€{activeThread.totalSpend.toFixed(2)}</strong>
                  </div>
                  <div className="text-[10px] text-center text-slate-400 border-t border-slate-50 pt-3 mt-1.5 font-bold uppercase tracking-widest">
                    <Link href="/orders" className="hover:text-[#006c49] flex items-center justify-center gap-1">
                      <MdShoppingBag className="text-xs" />
                      <span>View Orders List</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Notes Context box */}
              <div className="space-y-3 flex-1 flex flex-col">
                <h4 className="text-[10px] font-bold font-[Manrope] uppercase tracking-widest text-slate-400 flex items-center justify-between">
                  <span>Customer CRM Notes</span>
                  <MdModeEdit className="text-slate-400 text-xs" />
                </h4>
                <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <textarea
                    value={activeThread.notes || ""}
                    onChange={(e) => handleUpdateCustomerNotes(e.target.value)}
                    placeholder={`Type persistent CRM notes about ${activeThread.customerName}...`}
                    className="w-full flex-1 p-3 text-xs font-[Manrope] text-slate-700 placeholder-slate-400 outline-none resize-none border-none bg-transparent"
                  />
                  <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100 text-[10px] font-bold text-[#006c49] uppercase tracking-wider text-right">
                    Auto-saved
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
        </>
        )}
      </div>
    </AdminLayout>
  );
}
