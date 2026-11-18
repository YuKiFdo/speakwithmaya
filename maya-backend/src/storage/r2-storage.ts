import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';

const logger = new Logger('CloudflareR2Storage');

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Single physical R2 bucket. When set, every logical bucket ("session-recordings",
   * "roadmap-audio") is stored as a key prefix inside it, so `<publicUrl>/<logical>/<path>`
   * maps 1:1 to the object key. An R2 custom domain serves exactly one bucket, so this is
   * what makes public URLs work for more than one logical bucket.
   */
  bucketName?: string;
  publicUrl?: string;
}

export class R2BucketClient {
  /** Physical R2 bucket that receives the requests. */
  private readonly physicalBucket: string;
  /** Key prefix inside the physical bucket ('' when each logical bucket is its own R2 bucket). */
  private readonly keyPrefix: string;

  constructor(
    private readonly s3Client: S3Client,
    private readonly bucketName: string,
    private readonly publicBaseUrl: string,
    sharedBucket?: string,
  ) {
    this.physicalBucket = sharedBucket || bucketName;
    this.keyPrefix = sharedBucket ? `${bucketName}/` : '';
  }

  private key(filePath: string): string {
    return this.keyPrefix + filePath.replace(/^\/+/, '');
  }

  async upload(
    filePath: string,
    body: Buffer | Uint8Array | ArrayBuffer,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<{ data: { path: string } | null; error: Error | null }> {
    try {
      const normalizedPath = filePath.replace(/^\/+/, '');
      const buf = Buffer.isBuffer(body)
        ? body
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.from(new Uint8Array(body));

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.physicalBucket,
          Key: this.key(normalizedPath),
          Body: buf,
          ContentType: options?.contentType || 'audio/wav',
        }),
      );

      return { data: { path: normalizedPath }, error: null };
    } catch (err: any) {
      logger.error(`[CloudflareR2] Upload failed (${this.physicalBucket}/${this.key(filePath)}): ${err?.message}`);
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  getPublicUrl(filePath: string): { data: { publicUrl: string } } {
    const normalizedPath = filePath.replace(/^\/+/, '');
    const cleanBase = this.publicBaseUrl.replace(/\/+$/, '');
    
    // If user specified custom domain (e.g. https://media.speakwithmaya.com), url is https://media.speakwithmaya.com/<bucket>/<path> or direct
    const publicUrl = cleanBase.includes(this.bucketName)
      ? `${cleanBase}/${normalizedPath}`
      : `${cleanBase}/${this.bucketName}/${normalizedPath}`;

    return {
      data: {
        publicUrl,
      },
    };
  }

  async list(
    folderPrefix?: string,
  ): Promise<{ data: Array<{ name: string }> | null; error: Error | null }> {
    try {
      const folder = folderPrefix ? `${folderPrefix.replace(/^\/+|\/+$/g, '')}/` : '';
      const cleanPrefix = this.keyPrefix + folder;
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.physicalBucket,
          Prefix: cleanPrefix,
          Delimiter: '/',
        }),
      );

      const names = new Set<string>();

      // Folders / Common prefixes
      for (const prefix of response.CommonPrefixes || []) {
        if (prefix.Prefix) {
          const sub = cleanPrefix ? prefix.Prefix.slice(cleanPrefix.length) : prefix.Prefix;
          const clean = sub.replace(/\/+$/, '');
          if (clean) names.add(clean);
        }
      }

      // Individual object keys
      for (const item of response.Contents || []) {
        if (item.Key) {
          const relative = cleanPrefix && item.Key.startsWith(cleanPrefix)
            ? item.Key.slice(cleanPrefix.length)
            : item.Key;
          const firstSegment = relative.split('/')[0];
          if (firstSegment) names.add(firstSegment);
        }
      }

      return {
        data: Array.from(names).map((name) => ({ name })),
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async download(
    filePath: string,
  ): Promise<{ data: Blob | null; error: Error | null }> {
    try {
      const normalizedPath = filePath.replace(/^\/+/, '');
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.physicalBucket,
          Key: this.key(normalizedPath),
        }),
      );

      if (!response.Body) {
        return { data: null, error: new Error('Empty response body from Cloudflare R2') };
      }

      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        const chunks: any[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
      };

      const buf = await streamToBuffer(response.Body);
      const blob = new Blob([new Uint8Array(buf)], { type: response.ContentType || 'audio/wav' });
      return { data: blob, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export class CloudflareR2StorageAdapter {
  private readonly s3Client: S3Client;
  private readonly publicBaseUrl: string;
  private readonly sharedBucket?: string;

  constructor(config: R2Config) {
    this.sharedBucket = config.bucketName || undefined;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.publicBaseUrl = (config.publicUrl || `https://${config.accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, '');
  }

  async listBuckets(): Promise<{ data: Array<{ id: string; name: string }>; error: Error | null }> {
    // Shared-bucket mode: logical buckets are prefixes and always "exist". Object-scoped R2
    // tokens cannot list or create buckets, so do not call the bucket-level API at all.
    if (this.sharedBucket) {
      return {
        data: ['session-recordings', 'roadmap-audio'].map((name) => ({ id: name, name })),
        error: null,
      };
    }
    try {
      const response = await this.s3Client.send(new ListBucketsCommand({}));
      const buckets = (response.Buckets || []).map((b) => ({
        id: b.Name || '',
        name: b.Name || '',
      }));
      return { data: buckets, error: null };
    } catch (err: any) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async createBucket(
    name: string,
    _options?: { public?: boolean },
  ): Promise<{ data: { name: string } | null; error: Error | null }> {
    if (this.sharedBucket) return { data: { name }, error: null };
    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: name }));
      return { data: { name }, error: null };
    } catch (err: any) {
      // If bucket already exists or cannot be created via API, log and return success
      if (err?.name === 'BucketAlreadyExists' || err?.name === 'BucketAlreadyOwnedByYou') {
        return { data: { name }, error: null };
      }
      logger.error(
        `[CloudflareR2] Could not create bucket "${name}": ${err?.message}. ` +
          `Create it in the Cloudflare dashboard, or set R2_BUCKET to use one shared bucket.`,
      );
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  from(bucketName: string): R2BucketClient {
    return new R2BucketClient(this.s3Client, bucketName, this.publicBaseUrl, this.sharedBucket);
  }
}

/**
 * Attaches Cloudflare R2 storage if R2 environment variables are configured.
 * Returns true if R2 was attached, false otherwise.
 */
export function attachR2StorageIfConfigured(supabaseClient: any): boolean {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey || !supabaseClient) {
    return false;
  }

  try {
    const adapter = new CloudflareR2StorageAdapter({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName: process.env.R2_BUCKET?.trim() || undefined,
      publicUrl: process.env.R2_PUBLIC_URL || process.env.EXPO_PUBLIC_R2_URL || 'https://media.speakwithmaya.com',
    });

    Object.defineProperty(supabaseClient, 'storage', {
      value: adapter,
      writable: true,
      configurable: true,
    });

    logger.log(
      `Attached Cloudflare R2 Storage adapter for account ${accountId.slice(0, 6)}... ` +
        (process.env.R2_BUCKET ? `(shared bucket "${process.env.R2_BUCKET.trim()}")` : '(one R2 bucket per logical bucket)'),
    );
    return true;
  } catch (err: any) {
    logger.warn(`Failed to initialize Cloudflare R2 Storage adapter: ${err?.message}`);
    return false;
  }
}

