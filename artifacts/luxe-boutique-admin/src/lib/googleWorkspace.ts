import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../../../firebase-applet-config.json";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/chat.spaces",
  "https://www.googleapis.com/auth/chat.messages",
  "https://www.googleapis.com/auth/chat.memberships",
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/meetings.space.settings",
];

const safeApp = (() => {
  try {
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (e) {
    console.warn("[AI Studio] Failed to initialize Firebase App for Workspace:", e);
    return null;
  }
})();

export const auth = (() => {
  try {
    if (safeApp) return getAuth(safeApp);
  } catch (e) {
    console.warn("[AI Studio] Failed to initialize Firebase Auth for Workspace:", e);
  }
  return {
    currentUser: null,
    onAuthStateChanged: (cb: any) => {
      setTimeout(() => cb(null), 0);
      return () => {};
    },
    config: {},
  } as any;
})();

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("luxe_gws_access_token") : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(
    auth,
    async (user: User | null) => {
      if (user) {
        const storedToken = cachedAccessToken || (typeof window !== "undefined" ? localStorage.getItem("luxe_gws_access_token") : null);
        if (storedToken) {
          cachedAccessToken = storedToken;
          if (onAuthSuccess) onAuthSuccess(user, storedToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (typeof window !== "undefined") localStorage.removeItem("luxe_gws_access_token");
        if (onAuthFailure) onAuthFailure();
      }
    },
    (error) => {
      console.warn("Firebase Auth state observer encountered an error:", error);
      if (onAuthFailure) onAuthFailure();
    }
  );
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Google authentication");
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("luxe_gws_access_token", credential.accessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google sign in error:", error);
    const errCode = error?.code || "";
    const errMessage = error?.message || "";
    if (errCode === "auth/network-request-failed" || errMessage.includes("auth/network-request-failed")) {
      throw new Error(
        "Google Authentication network request failed (auth/network-request-failed). If you are in a preview iframe or restricted environment, please open the app in a new browser window/tab to sign in with Google Workspace."
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== "undefined") {
    cachedAccessToken = localStorage.getItem("luxe_gws_access_token");
  }
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("luxe_gws_access_token");
  }
};

// ── Google Contacts (People API) Types & Methods ────────────────────────────

export interface GoogleContact {
  resourceName?: string;
  etag?: string;
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
  emailAddresses?: Array<{ value: string; type?: string }>;
  phoneNumbers?: Array<{ value: string; type?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  biographies?: Array<{ value?: string }>;
}

export async function listGoogleContacts(token: string): Promise<GoogleContact[]> {
  const url = "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,biographies&pageSize=100";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch Google Contacts (${res.status})`);
  }
  const data = await res.json();
  return data.connections || [];
}

export async function createGoogleContact(
  token: string,
  contact: {
    givenName: string;
    familyName?: string;
    email: string;
    phone?: string;
    organization?: string;
    notes?: string;
  }
): Promise<GoogleContact> {
  const payload: Record<string, unknown> = {
    names: [
      {
        givenName: contact.givenName,
        familyName: contact.familyName || "",
      },
    ],
    emailAddresses: [
      {
        value: contact.email,
        type: "work",
      },
    ],
    organizations: [
      {
        name: contact.organization || "LUXE Boutique Client",
        title: "Customer",
      },
    ],
    biographies: [
      {
        value: contact.notes || "Client account synced from LUXE Boutique.",
      },
    ],
  };

  if (contact.phone) {
    payload.phoneNumbers = [{ value: contact.phone, type: "mobile" }];
  }

  const res = await fetch("https://people.googleapis.com/v1/people:createContact", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create Google Contact (${res.status})`);
  }

  return res.json();
}

// ── Gmail API Methods ───────────────────────────────────────────────────────

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  date?: string;
  from?: string;
  to?: string;
  subject?: string;
}

function base64UrlEncode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(
  token: string,
  params: {
    to: string;
    subject: string;
    bodyHtml: string;
  }
): Promise<{ id: string; threadId: string }> {
  const emailLines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    params.bodyHtml,
  ];
  const rawEmail = emailLines.join("\r\n");
  const encodedEmail = base64UrlEncode(rawEmail);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to send Gmail message (${res.status})`);
  }

  return res.json();
}

export async function listGmailMessagesForEmail(
  token: string,
  customerEmail: string
): Promise<GmailMessageSummary[]> {
  const query = encodeURIComponent(`to:${customerEmail} OR from:${customerEmail}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=8`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch messages (${listRes.status})`);
  }

  const listData = await listRes.json();
  const messageRefs: Array<{ id: string; threadId: string }> = listData.messages || [];

  if (messageRefs.length === 0) return [];

  // Fetch headers & snippet for each message
  const details = await Promise.all(
    messageRefs.map(async (m) => {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!detailRes.ok) return null;
        const msg = await detailRes.json();
        const headers = (msg.payload?.headers || []) as Array<{ name: string; value: string }>;
        const getH = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: msg.snippet || "",
          date: getH("Date"),
          from: getH("From"),
          to: getH("To"),
          subject: getH("Subject") || "(No Subject)",
        } as GmailMessageSummary;
      } catch {
        return null;
      }
    })
  );

  return details.filter((d): d is GmailMessageSummary => d !== null);
}

// ── Google Sheets API Types & Methods ──────────────────────────────────────

export interface GoogleSpreadsheet {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties?: {
    title: string;
  };
  sheets?: Array<{
    properties?: {
      sheetId: number;
      title: string;
      gridProperties?: {
        rowCount: number;
        columnCount: number;
      };
    };
  }>;
}

export async function createGoogleSpreadsheet(
  token: string,
  title: string,
  sheetTitles: string[] = ["Sheet1"]
): Promise<GoogleSpreadsheet> {
  const payload = {
    properties: { title },
    sheets: sheetTitles.map((t, idx) => ({
      properties: {
        sheetId: idx,
        title: t,
        gridProperties: { rowCount: 1000, columnCount: 20 },
      },
    })),
  };

  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create Google Sheet (${res.status})`);
  }

  return res.json();
}

export async function updateGoogleSheetValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][]
): Promise<{ updatedCells: number; updatedRows: number }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update sheet values (${res.status})`);
  }

  return res.json();
}

export async function appendGoogleSheetValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][]
): Promise<{ updates: { updatedCells: number; updatedRows: number } }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to append sheet values (${res.status})`);
  }

  return res.json();
}

export async function getGoogleSheetValues(
  token: string,
  spreadsheetId: string,
  range: string
): Promise<(string | number)[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to read sheet values (${res.status})`);
  }

  const data = await res.json();
  return data.values || [];
}

// Format header row (Bold + Navy Header styling)
export async function formatGoogleSheetHeader(
  token: string,
  spreadsheetId: string,
  sheetId: number = 0
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const requests = [
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.08, green: 0.12, blue: 0.2 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
  ];

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  }).catch(() => {
    // Ignore format errors
  });
}

// ── Google Drive API Types & Methods ───────────────────────────────────────

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  size?: string;
  iconLink?: string;
  parents?: string[];
}

export async function listGoogleDriveFiles(
  token: string,
  parentFolderId?: string
): Promise<GoogleDriveFile[]> {
  const queryParts = ["trashed = false"];
  if (parentFolderId) {
    queryParts.push(`'${parentFolderId}' in parents`);
  }
  const q = encodeURIComponent(queryParts.join(" and "));
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,webViewLink,webContentLink,createdTime,size,iconLink,parents)&orderBy=folder,createdTime%20desc&pageSize=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch Google Drive files (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function createGoogleDriveFolder(
  token: string,
  folderName: string,
  parentFolderId?: string
): Promise<GoogleDriveFile> {
  const payload: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentFolderId) {
    payload.parents = [parentFolderId];
  }

  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create Drive folder (${res.status})`);
  }

  return res.json();
}

export async function uploadTextFileToGoogleDrive(
  token: string,
  params: {
    name: string;
    content: string;
    mimeType?: string;
    parentFolderId?: string;
  }
): Promise<GoogleDriveFile> {
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: Record<string, unknown> = {
    name: params.name,
    mimeType: params.mimeType || "text/plain",
  };
  if (params.parentFolderId) {
    metadata.parents = [params.parentFolderId];
  }

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${params.mimeType || "text/plain"}\r\n\r\n` +
    params.content +
    closeDelimiter;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to upload file to Drive (${res.status})`);
  }

  return res.json();
}

export async function uploadBinaryFileToGoogleDrive(
  token: string,
  file: File,
  parentFolderId?: string
): Promise<GoogleDriveFile> {
  const metadata: Record<string, unknown> = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" })
  );
  formData.append("file", file);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to upload asset to Drive (${res.status})`);
  }

  return res.json();
}

export async function setupLuxeDriveWorkspace(
  token: string
): Promise<{
  rootFolder: GoogleDriveFile;
  lookbooksFolder: GoogleDriveFile;
  receiptsFolder: GoogleDriveFile;
  marketingFolder: GoogleDriveFile;
}> {
  // Check for existing root folder
  const files = await listGoogleDriveFiles(token);
  let root = files.find(
    (f) => f.name === "LUXE Boutique Archive" && f.mimeType === "application/vnd.google-apps.folder"
  );
  if (!root) {
    root = await createGoogleDriveFolder(token, "LUXE Boutique Archive");
  }

  // Check subfolders
  const subfiles = await listGoogleDriveFiles(token, root.id);
  let lookbooks = subfiles.find(
    (f) => f.name === "Product Lookbooks" && f.mimeType === "application/vnd.google-apps.folder"
  );
  if (!lookbooks) {
    lookbooks = await createGoogleDriveFolder(token, "Product Lookbooks", root.id);
  }

  let receipts = subfiles.find(
    (f) => f.name === "Order Receipts & Invoices" && f.mimeType === "application/vnd.google-apps.folder"
  );
  if (!receipts) {
    receipts = await createGoogleDriveFolder(token, "Order Receipts & Invoices", root.id);
  }

  let marketing = subfiles.find(
    (f) => f.name === "Marketing & Brand Assets" && f.mimeType === "application/vnd.google-apps.folder"
  );
  if (!marketing) {
    marketing = await createGoogleDriveFolder(token, "Marketing & Brand Assets", root.id);
  }

  return {
    rootFolder: root,
    lookbooksFolder: lookbooks,
    receiptsFolder: receipts,
    marketingFolder: marketing,
  };
}

// ── Google Calendar API Types & Methods ────────────────────────────────────

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
      label?: string;
    }>;
    conferenceSolution?: {
      name?: string;
      iconUri?: string;
    };
    conferenceId?: string;
  };
  status?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  created?: string;
  updated?: string;
}

export interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO 8601 string, e.g. "2026-09-04T10:00:00"
  endDateTime: string;   // ISO 8601 string, e.g. "2026-09-04T11:00:00"
  attendees?: Array<{ email: string; displayName?: string }>;
  timeZone?: string;
  sendUpdates?: "all" | "none";
  addGoogleMeet?: boolean;
}

export async function listGoogleCalendarEvents(
  token: string,
  calendarId: string = "primary",
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  
  if (timeMin) {
    url.searchParams.set("timeMin", timeMin);
  } else {
    // Default to from 30 days ago to future
    const d = new Date();
    d.setDate(d.getDate() - 30);
    url.searchParams.set("timeMin", d.toISOString());
  }

  if (timeMax) {
    url.searchParams.set("timeMax", timeMax);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch calendar events (${res.status})`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function createGoogleCalendarEvent(
  token: string,
  params: CreateCalendarEventParams,
  calendarId: string = "primary"
): Promise<GoogleCalendarEvent> {
  const timeZone = params.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  
  const payload: Record<string, unknown> = {
    summary: params.summary,
    description: params.description || "",
    location: params.location || "LUXE Boutique Flagship Suite",
    start: {
      dateTime: new Date(params.startDateTime).toISOString(),
      timeZone,
    },
    end: {
      dateTime: new Date(params.endDateTime).toISOString(),
      timeZone,
    },
  };

  if (params.attendees && params.attendees.length > 0) {
    payload.attendees = params.attendees;
  }

  if (params.addGoogleMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
  }

  const sendUpdates = params.sendUpdates || "all";
  const conferenceParam = params.addGoogleMeet ? "&conferenceDataVersion=1" : "";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendUpdates}${conferenceParam}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err?.error?.message;
    if (res.status === 401) {
      throw new Error("Google Workspace session expired or unauthorized. Please reconnect your account.");
    }
    if (res.status === 403) {
      throw new Error(`Google Calendar access denied (403): ${message || "Please ensure the calendar.events scope is granted."}`);
    }
    throw new Error(message || `Failed to schedule calendar event (${res.status})`);
  }

  return res.json();
}

export async function deleteGoogleCalendarEvent(
  token: string,
  eventId: string,
  calendarId: string = "primary"
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
      eventId
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to delete calendar event (${res.status})`);
  }
}



export async function updateGoogleCalendarEvent(
  token: string,
  eventId: string,
  params: CreateCalendarEventParams,
  calendarId: string = "primary"
): Promise<GoogleCalendarEvent> {
  const timeZone = params.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  
  const payload: Record<string, unknown> = {
    summary: params.summary,
    description: params.description || "",
    location: params.location || "LUXE Boutique Flagship Suite",
    start: {
      dateTime: new Date(params.startDateTime).toISOString(),
      timeZone,
    },
    end: {
      dateTime: new Date(params.endDateTime).toISOString(),
      timeZone,
    },
  };

  if (params.attendees && params.attendees.length > 0) {
    payload.attendees = params.attendees;
  }

  if (params.addGoogleMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
  }

  const sendUpdates = params.sendUpdates || "all";
  const conferenceParam = params.addGoogleMeet ? "&conferenceDataVersion=1" : "";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}${conferenceParam}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err?.error?.message;
    if (res.status === 401) {
      throw new Error("Google Workspace session expired or unauthorized. Please reconnect your account.");
    }
    throw new Error(`Failed to update calendar event: ${message || res.statusText}`);
  }

  return await res.json();
}

export interface GoogleChatWebhookPayload {
  text?: string;
  cardsV2?: Array<{
    cardId?: string;
    card?: {
      header?: {
        title: string;
        subtitle?: string;
        imageUrl?: string;
        imageType?: "SQUARE" | "CIRCLE";
      };
      sections?: Array<{
        header?: string;
        widgets: Array<any>;
      }>;
    };
  }>;
}

export async function sendGoogleChatWebhook(
  webhookUrl: string,
  payload: GoogleChatWebhookPayload
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to send Google Chat message (${res.status}): ${errText || res.statusText}`);
  }
}

export interface GoogleChatSpace {
  name: string; // e.g. "spaces/AAAA..."
  displayName?: string;
  type?: string;
  spaceType?: string;
}

export interface GoogleChatMessage {
  name: string; // e.g. "spaces/AAAA.../messages/CCCC..."
  sender?: {
    name?: string;
    displayName?: string;
    avatarUrl?: string;
    type?: string;
  };
  createTime?: string;
  text?: string;
}

export async function listGoogleChatSpaces(accessToken: string): Promise<GoogleChatSpace[]> {
  const res = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=100", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to list Google Chat spaces: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.spaces || [];
}

export async function listGoogleChatMessages(
  accessToken: string,
  spaceName: string
): Promise<GoogleChatMessage[]> {
  const formattedSpace = spaceName.startsWith("spaces/") ? spaceName : `spaces/${spaceName}`;
  const res = await fetch(`https://chat.googleapis.com/v1/${formattedSpace}/messages?pageSize=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to fetch Chat messages: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.messages || [];
}

export async function sendGoogleChatMessageApi(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<GoogleChatMessage> {
  const formattedSpace = spaceName.startsWith("spaces/") ? spaceName : `spaces/${spaceName}`;
  const res = await fetch(`https://chat.googleapis.com/v1/${formattedSpace}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to send Chat message: ${err?.error?.message || res.statusText}`);
  }
  return await res.json();
}

export interface GoogleMeetSpaceResponse {
  name: string; // e.g. "spaces/CONF_ID"
  meetingUri: string; // e.g. "https://meet.google.com/abc-defg-hij"
  meetingCode?: string; // e.g. "abc-defg-hij"
}

export async function createGoogleMeetSpace(accessToken: string): Promise<GoogleMeetSpaceResponse> {
  const res = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        accessType: "OPEN",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to create Google Meet space: ${err?.error?.message || res.statusText}`);
  }
  return await res.json();
}
