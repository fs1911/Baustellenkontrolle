import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const BUCKETS = ["company-logos", "finding-images", "generated-reports", "attachments"] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface StorageAdapter {
  readonly name: "local" | "supabase";
  put(bucket: Bucket, path: string, data: Buffer, contentType: string): Promise<void>;
  get(bucket: Bucket, path: string): Promise<Buffer>;
  remove(bucket: Bucket, paths: string[]): Promise<void>;
  /** Kurzlebige, signierte URL. Nur nach RLS-geprüfter DB-Abfrage aufrufen. */
  signedUrl(bucket: Bucket, path: string, opts?: { downloadName?: string; ttlSeconds?: number }): Promise<string>;
}

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Verhindert Path Traversal: nur einfache Segmente, keine "..". */
export function assertSafePath(path: string): void {
  const segments = path.split("/");
  if (segments.length === 0 || segments.length > 8 || segments.some((s) => !SAFE_SEGMENT.test(s) || s.includes(".."))) {
    throw new Error("Ungültiger Speicherpfad");
  }
}

function fileKey(): Uint8Array {
  return new TextEncoder().encode(`${env().SESSION_SECRET}:files`);
}

export interface FileTokenPayload {
  bucket: Bucket;
  path: string;
  downloadName?: string;
}

export async function createFileToken(payload: FileTokenPayload, ttlSeconds: number): Promise<string> {
  return new SignJWT({ b: payload.bucket, p: payload.path, d: payload.downloadName })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("bk-files")
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(fileKey());
}

export async function verifyFileToken(token: string): Promise<FileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, fileKey(), { audience: "bk-files", algorithms: ["HS256"] });
    const bucket = payload.b as Bucket;
    const path = payload.p as string;
    if (!BUCKETS.includes(bucket) || typeof path !== "string") return null;
    assertSafePath(path);
    return { bucket, path, downloadName: typeof payload.d === "string" ? payload.d : undefined };
  } catch {
    return null;
  }
}

class LocalStorage implements StorageAdapter {
  readonly name = "local" as const;
  private root = resolve(/* turbopackIgnore: true */ process.cwd(), env().LOCAL_STORAGE_DIR);

  private full(bucket: Bucket, path: string): string {
    assertSafePath(path);
    const p = resolve(join(this.root, bucket, path));
    if (!p.startsWith(join(this.root, bucket))) throw new Error("Ungültiger Speicherpfad");
    return p;
  }
  async put(bucket: Bucket, path: string, data: Buffer): Promise<void> {
    const p = this.full(bucket, path);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(bucket: Bucket, path: string): Promise<Buffer> {
    return readFile(this.full(bucket, path));
  }
  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => rm(this.full(bucket, p), { force: true })));
  }
  async signedUrl(bucket: Bucket, path: string, opts?: { downloadName?: string; ttlSeconds?: number }): Promise<string> {
    assertSafePath(path);
    const token = await createFileToken(
      { bucket, path, downloadName: opts?.downloadName },
      opts?.ttlSeconds ?? env().SIGNED_URL_TTL_SECONDS,
    );
    return `/api/files/${token}`;
  }
}

class SupabaseStorage implements StorageAdapter {
  readonly name = "supabase" as const;
  private client: SupabaseClient = createClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async put(bucket: Bucket, path: string, data: Buffer, contentType: string): Promise<void> {
    assertSafePath(path);
    const { error } = await this.client.storage.from(bucket).upload(path, data, { contentType, upsert: false });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  }
  async get(bucket: Bucket, path: string): Promise<Buffer> {
    assertSafePath(path);
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error || !data) throw new Error(`Download fehlgeschlagen: ${error?.message ?? "leer"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    paths.forEach(assertSafePath);
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
  }
  async signedUrl(bucket: Bucket, path: string, opts?: { downloadName?: string; ttlSeconds?: number }): Promise<string> {
    assertSafePath(path);
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(
        path,
        opts?.ttlSeconds ?? env().SIGNED_URL_TTL_SECONDS,
        opts?.downloadName ? { download: opts.downloadName } : undefined,
      );
    if (error || !data) throw new Error(`Signierte URL fehlgeschlagen: ${error?.message ?? "leer"}`);
    return data.signedUrl;
  }
}

let instance: StorageAdapter | undefined;
export function storage(): StorageAdapter {
  instance ??= env().STORAGE_PROVIDER === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return instance;
}
