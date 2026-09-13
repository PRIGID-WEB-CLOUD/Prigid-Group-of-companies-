import { useEffect, useState } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function MetaPixelTracker() {
  const [location] = useLocation();

  useEffect(() => {
    // Initialize stub immediately so trackMetaEvent can queue events
    if (!window.fbq) {
      (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    }

    // Fetch pixel config and call init
    fetch("/api/m-config")
      .then(res => res.json())
      .then(data => {
        if (data.enabled && data.pixelId) {
          window.fbq('init', data.pixelId);
        }
      })
      .catch(() => {}); // Silent fail if ad-blocker or network issues prevent loading pixel config
  }, []);

  useEffect(() => {
    if (window.fbq && window.fbq.loaded) {
      window.fbq('track', 'PageView');
    }
  }, [location]);

  return null;
}

// Helper to track custom events
export const trackMetaEvent = (eventName: string, params?: Record<string, any>, userData?: Record<string, any>) => {
  if (window.fbq) {
    window.fbq('track', eventName, params);
  }
  
  // Also send to CAPI if implemented
  fetch('/api/m-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      eventName, 
      params, 
      url: window.location.href,
      userData: {
        ...userData,
        // Automatically try to get email from session if not provided
        email: userData?.email || sessionStorage.getItem("checkout_email") || undefined
      }
    }),
  }).catch(() => {}); // Silent fail for CAPI
};
