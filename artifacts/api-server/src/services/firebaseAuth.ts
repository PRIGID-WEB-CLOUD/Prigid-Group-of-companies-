import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cachedPublicKeys: Record<string, string> | null = null;
let cacheExpiresAt = 0;

export function getFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  const configPaths = [
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(process.cwd(), "../firebase-applet-config.json"),
    path.resolve(process.cwd(), "../../firebase-applet-config.json"),
    "/firebase-applet-config.json",
  ];
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (parsed.projectId) return parsed.projectId;
      } catch {}
    }
  }
  return "gen-lang-client-0152852248";
}

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedPublicKeys && now < cacheExpiresAt) {
    return cachedPublicKeys;
  }

  const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public certificates: HTTP ${res.status}`);
  }

  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedPublicKeys = (await res.json()) as Record<string, string>;
  cacheExpiresAt = now + maxAgeSeconds * 1000;
  return cachedPublicKeys;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing or invalid Firebase ID token.");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format for Firebase ID token.");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: {
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    auth_time?: number;
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: any;
  };

  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    throw new Error("Failed to decode Firebase token header or payload.");
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid token algorithm or missing kid header.");
  }

  const projectId = getFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  // Verify Issuer
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Firebase token issuer mismatch: expected ${expectedIssuer}, received ${payload.iss}`);
  }

  // Verify Audience
  if (payload.aud !== projectId) {
    throw new Error(`Firebase token audience mismatch: expected ${projectId}, received ${payload.aud}`);
  }

  // Verify Expiration
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowInSeconds) {
    throw new Error("Firebase ID token has expired.");
  }

  // Verify Subject (UID)
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new Error("Firebase ID token missing sub claim (UID).");
  }

  // Verify Signature
  const publicKeys = await getGooglePublicKeys();
  const certificate = publicKeys[header.kid];
  if (!certificate) {
    throw new Error(`No matching public key found for kid: ${header.kid}`);
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const isSignatureValid = verifier.verify(certificate, signatureB64, "base64url");

  if (!isSignatureValid) {
    throw new Error("Firebase ID token signature verification failed.");
  }

  if (!payload.email) {
    throw new Error("Firebase ID token does not contain a verified email address.");
  }

  return {
    uid: payload.sub,
    email: payload.email.toLowerCase().trim(),
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture,
  };
}
