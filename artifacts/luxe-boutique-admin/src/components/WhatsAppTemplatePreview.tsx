import React, { useState, useMemo } from "react";

export interface TemplatePreviewData {
  id?: string;
  name: string;
  category: string;
  body: string;
  language?: string;
  status?: string;
}

interface WhatsAppTemplatePreviewProps {
  template: TemplatePreviewData;
  onClose?: () => void;
  onSubmitToMeta?: (template: TemplatePreviewData) => void;
}

const DEFAULT_SAMPLE_PARAMS: Record<string, string> = {
  "1": "Alexander Vance",
  "2": "LX-90821",
  "3": "2,450.00",
  "4": "Cashmere Overcoat in Charcoal",
  "5": "https://luxe-boutique.com/orders/track",
  "6": "DHL Express",
  "7": "239012",
};

/**
 * Parses WhatsApp formatting syntax (*bold*, _italics_, ```code```, {{1}} parameters, and URLs)
 */
export function formatWhatsAppBody(body: string, customParams: Record<string, string>): React.ReactNode {
  if (!body) return <span className="text-slate-400 italic">No message body provided</span>;

  // Step 1: Replace {{N}} placeholders
  let replaced = body.replace(/\{\{(\d+)\}\}/g, (_match, pNum) => {
    return customParams[pNum] ?? DEFAULT_SAMPLE_PARAMS[pNum] ?? `{{${pNum}}}`;
  });

  // Step 2: Split lines to preserve WhatsApp multiline structure
  const lines = replaced.split("\n");

  return (
    <div className="space-y-1 text-[13px] leading-relaxed font-sans text-slate-800">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-2" />;
        }

        // Inline formatting parser for line
        return <div key={lIdx}>{parseInlineWhatsApp(line)}</div>;
      })}
    </div>
  );
}

function parseInlineWhatsApp(text: string): React.ReactNode {
  // Simple regex parser for *bold*, _italic_, ```code``` and links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold: *text*
    const boldMatch = remaining.match(/^([^*]*)\*([^*]+)\*(.*)$/);
    // Italic: _text_
    const italicMatch = remaining.match(/^([^_]*)_([^_]+)_(.*)$/);
    // Monospace: ```text```
    const codeMatch = remaining.match(/^(.*?)```([^`]+)```(.*)$/);

    // Pick earliest match
    const bPos = remaining.indexOf("*");
    const iPos = remaining.indexOf("_");
    const cPos = remaining.indexOf("```");

    let matchType: "bold" | "italic" | "code" | "none" = "none";
    let minPos = Infinity;

    if (bPos !== -1 && boldMatch && bPos < minPos) {
      minPos = bPos;
      matchType = "bold";
    }
    if (iPos !== -1 && italicMatch && iPos < minPos) {
      minPos = iPos;
      matchType = "italic";
    }
    if (cPos !== -1 && codeMatch && cPos < minPos) {
      minPos = cPos;
      matchType = "code";
    }

    if (matchType === "bold" && boldMatch) {
      const [, prefix, content, suffix] = boldMatch;
      if (prefix) parts.push(<span key={keyIdx++}>{prefix}</span>);
      parts.push(
        <strong key={keyIdx++} className="font-bold text-slate-900">
          {content}
        </strong>
      );
      remaining = suffix;
    } else if (matchType === "italic" && italicMatch) {
      const [, prefix, content, suffix] = italicMatch;
      if (prefix) parts.push(<span key={keyIdx++}>{prefix}</span>);
      parts.push(
        <em key={keyIdx++} className="italic text-slate-700">
          {content}
        </em>
      );
      remaining = suffix;
    } else if (matchType === "code" && codeMatch) {
      const [, prefix, content, suffix] = codeMatch;
      if (prefix) parts.push(<span key={keyIdx++}>{prefix}</span>);
      parts.push(
        <code key={keyIdx++} className="font-mono text-xs bg-slate-100 text-emerald-800 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
          {content}
        </code>
      );
      remaining = suffix;
    } else {
      // Plain text or URLs
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

export function WhatsAppPhoneFrame({
  template,
  customParams,
  onParamChange,
}: {
  template: TemplatePreviewData;
  customParams: Record<string, string>;
  onParamChange?: (key: string, value: string) => void;
}) {
  const paramKeys = useMemo(() => {
    const matches = template.body.match(/\{\{(\d+)\}\}/g) || [];
    const keys = Array.from(new Set(matches.map((m) => m.replace(/\D/g, ""))));
    return keys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [template.body]);

  return (
    <div className="flex flex-col items-center">
      {/* Smartphone Device Mockup Container */}
      <div className="w-[340px] h-[580px] bg-slate-900 rounded-[40px] p-3 shadow-[0px_25px_60px_rgba(15,23,42,0.35)] ring-1 ring-slate-800 relative flex flex-col overflow-hidden">
        {/* Device Camera Notch / Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30 flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-900/40" />
        </div>

        {/* Device Screen Area */}
        <div className="w-full h-full bg-[#efeae2] rounded-[32px] overflow-hidden flex flex-col relative z-20">
          {/* Status Bar */}
          <div className="bg-[#075e54] text-white px-5 pt-3 pb-1 flex justify-between items-center text-[10px] font-semibold tracking-tight">
            <span>9:41</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="material-symbols-outlined text-xs">signal_cellular_4_bar</span>
              <span className="material-symbols-outlined text-xs">wifi</span>
              <span className="material-symbols-outlined text-xs">battery_full</span>
            </div>
          </div>

          {/* WhatsApp Header */}
          <div className="bg-[#075e54] text-white px-3 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-sm cursor-pointer opacity-80">arrow_back</span>
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-[#C5A880] border border-[#C5A880]/40 flex items-center justify-center font-serif text-[10px] font-bold tracking-widest shadow-inner">
                  LUXE
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#25D366] rounded-full border border-[#075e54] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[8px] text-white font-bold">check</span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs leading-tight">Luxe Boutique</span>
                  <span className="material-symbols-outlined text-[12px] text-[#25D366]">verified</span>
                </div>
                <p className="text-[9px] text-emerald-100/80 leading-none">Official Business Account</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-100/90">
              <span className="material-symbols-outlined text-base cursor-pointer">videocam</span>
              <span className="material-symbols-outlined text-base cursor-pointer">call</span>
              <span className="material-symbols-outlined text-base cursor-pointer">more_vert</span>
            </div>
          </div>

          {/* WhatsApp Chat Wallpaper Body */}
          <div
            className="flex-1 p-3 overflow-y-auto flex flex-col justify-start relative"
            style={{
              backgroundImage:
                "radial-gradient(#d5cebe 1px, transparent 1px), radial-gradient(#d5cebe 1px, #efeae2 1px)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 10px 10px",
            }}
          >
            {/* System Security Notice Header */}
            <div className="self-center bg-[#ffeecd] border border-[#f5d796] text-[#715413] text-[9px] font-medium px-3 py-1 rounded-lg text-center max-w-[260px] shadow-sm mb-3">
              🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
            </div>

            {/* Template Category Tag */}
            <div className="self-center bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-600 text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-3 shadow-xs">
              {template.category || "Utility"} Template · Meta Approved Standard
            </div>

            {/* WhatsApp Outgoing / System Message Bubble */}
            <div className="self-start max-w-[280px] bg-white rounded-lg rounded-tl-none p-3 shadow-[0px_1px_3px_rgba(0,0,0,0.12)] relative border-l-4 border-[#006c49]">
              {/* Category Badge Header inside Bubble */}
              <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100 text-[9px]">
                <span className="font-bold text-[#006c49] uppercase tracking-wider">{template.name}</span>
                <span className="text-slate-400 font-mono">
                  {template.language ? template.language.toUpperCase() : "EN"}
                </span>
              </div>

              {/* Formatted Text Body */}
              {formatWhatsAppBody(template.body, customParams)}

              {/* Message Time and Read Receipts */}
              <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-slate-400">
                <span>10:42 AM</span>
                <span className="text-[#34B7F1] font-bold text-[10px]">✓✓</span>
              </div>
            </div>
          </div>

          {/* Fake Message Input Footer */}
          <div className="bg-[#f0f0f0] p-2 flex items-center gap-2 border-t border-slate-200">
            <span className="material-symbols-outlined text-slate-500 text-lg">mood</span>
            <div className="flex-1 bg-white rounded-full px-3 py-1 text-xs text-slate-400 font-sans">
              Type a message
            </div>
            <div className="w-7 h-7 rounded-full bg-[#008469] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm">mic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Parameter Customizers Section */}
      {paramKeys.length > 0 && (
        <div className="w-full max-w-[340px] mt-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-[#006c49]">tune</span> Dynamic Parameters
            </span>
            <span className="text-[9px] text-slate-400 font-mono">{paramKeys.length} variable(s)</span>
          </div>
          <div className="space-y-2">
            {paramKeys.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                  {`{{${k}}}`}
                </span>
                <input
                  type="text"
                  value={customParams[k] ?? DEFAULT_SAMPLE_PARAMS[k] ?? ""}
                  onChange={(e) => onParamChange?.(k, e.target.value)}
                  placeholder={`Value for {{${k}}}…`}
                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs font-sans outline-none focus:border-[#006c49]"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppTemplatePreviewModal({
  template,
  onClose,
  onSubmitToMeta,
}: WhatsAppTemplatePreviewProps) {
  const [customParams, setCustomParams] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const handleParamChange = (key: string, val: string) => {
    setCustomParams((prev) => ({ ...prev, [key]: val }));
  };

  const handleCopyPreview = () => {
    let replaced = template.body.replace(/\{\{(\d+)\}\}/g, (_m, pNum) => {
      return customParams[pNum] ?? DEFAULT_SAMPLE_PARAMS[pNum] ?? `{{${pNum}}}`;
    });
    navigator.clipboard.writeText(replaced).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006c49]">
              <span className="material-symbols-outlined">chat</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold text-slate-900">{template.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {template.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans">
                Meta WhatsApp Business Cloud API Formatted Preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body with Device Mockup */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col md:flex-row items-center md:items-start justify-center gap-8 py-2">
          {/* Left: Device Frame */}
          <WhatsAppPhoneFrame
            template={template}
            customParams={customParams}
            onParamChange={handleParamChange}
          />

          {/* Right: Meta Submission Guidelines & Actions */}
          <div className="flex-1 space-y-5 max-w-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <h4 className="font-serif font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-700 text-base">verified</span>
                Formatting Guidelines
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 font-sans leading-relaxed">
                <li>
                  <strong className="text-slate-800">*bold*</strong> converts to bold display text.
                </li>
                <li>
                  <strong className="text-slate-800">_italics_</strong> renders styled typography.
                </li>
                <li>
                  <strong className="text-slate-800">```monospace```</strong> formats security codes.
                </li>
                <li>
                  Placeholders like <strong className="text-slate-800 font-mono">{"{{1}}"}</strong> map to dynamic variables.
                </li>
              </ul>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
              <p className="text-xs font-bold text-[#006c49] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span> Meta Approval Policy
              </p>
              <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                Meta standard templates are usually approved within 15–30 minutes. Once approved, the status turns green.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {onSubmitToMeta && template.status === "Pending" && (
                <button
                  onClick={() => {
                    onSubmitToMeta(template);
                    onClose?.();
                  }}
                  className="w-full py-3 bg-[#006c49] text-white font-bold text-xs uppercase tracking-widest hover:bg-black transition-colors rounded-xl shadow-sm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">send</span> Submit to Meta
                </button>
              )}

              <button
                onClick={handleCopyPreview}
                className="w-full py-2.5 border border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied!" : "Copy Formatted Text"}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
