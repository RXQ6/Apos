/**
 * Provider credentials for Pi/pi-ai.
 * File storage uses AES-256-GCM; never commit keys.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ProviderConfig } from "./types.js";

const MAGIC = "APOS1";

function keyFromSecret(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, 32);
}

export function encryptCredentials(
  data: ProviderConfig[],
  secret: string,
): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = keyFromSecret(secret, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(MAGIC), salt, iv, tag, enc]);
}

export function decryptCredentials(blob: Buffer, secret: string): ProviderConfig[] {
  const magic = blob.subarray(0, 5).toString("utf8");
  if (magic !== MAGIC) throw new Error("bad credentials file");
  const salt = blob.subarray(5, 21);
  const iv = blob.subarray(21, 33);
  const tag = blob.subarray(33, 49);
  const enc = blob.subarray(49);
  const key = keyFromSecret(secret, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as ProviderConfig[];
}

export function saveProviderConfig(
  path: string,
  configs: ProviderConfig[],
  secret: string,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encryptCredentials(configs, secret));
}

export function loadProviderConfig(path: string, secret: string): ProviderConfig[] {
  if (!existsSync(path)) return [];
  return decryptCredentials(readFileSync(path), secret);
}

/** Machine-readable settings without secrets (for UI). */
export function redactProviders(configs: ProviderConfig[]): ProviderConfig[] {
  return configs.map((c) => ({
    id: c.id,
    label: c.label,
    baseUrl: c.baseUrl,
    model: c.model,
    apiKey: c.apiKey ? "***" : undefined,
  }));
}
