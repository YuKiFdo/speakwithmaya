import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { Logger } from '@nestjs/common';

const logger = new Logger('AzureBlobStorage');

function parseConnectionString(connStr: string): {
  accountName: string;
  accountKey: string;
  endpointSuffix: string;
} | null {
  const parts = connStr.split(';');
  let accountName = '';
  let accountKey = '';
  let endpointSuffix = 'core.windows.net';

  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === 'AccountName') accountName = val;
    if (key === 'AccountKey') accountKey = val;
    if (key === 'EndpointSuffix') endpointSuffix = val;
  }

  if (!accountName || !accountKey) return null;
  return { accountName, accountKey, endpointSuffix };
}

export class AzureBlobBucketClient {
  constructor(
    private readonly blobServiceClient: BlobServiceClient,
    private readonly sharedKeyCredential: StorageSharedKeyCredential | null,
    private readonly accountName: string,
    private readonly endpointSuffix: string,
    private readonly containerName: string,
  ) {}

  async upload(
    filePath: string,
    body: Buffer | Uint8Array | ArrayBuffer,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<{ data: { path: string } | null; error: Error | null }> {
    try {
      const normalizedPath = filePath.replace(/^\/+/, '');
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(normalizedPath);
      const buf = Buffer.isBuffer(body)
        ? body
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.from(new Uint8Array(body));

      await blockBlobClient.uploadData(buf, {
        blobHTTPHeaders: {
          blobContentType: options?.contentType || 'audio/wav',
        },
      });

      return { data: { path: normalizedPath }, error: null };
    } catch (err: any) {
      logger.error(`[AzureBlobStorage] Upload failed (${this.containerName}/${filePath}): ${err?.message}`);
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  getPublicUrl(filePath: string): { data: { publicUrl: string } } {
    const normalizedPath = filePath.replace(/^\/+/, '');
    const baseUrl = `https://${this.accountName}.blob.${this.endpointSuffix}/${this.containerName}/${normalizedPath}`;

    if (!this.sharedKeyCredential) {
      return { data: { publicUrl: baseUrl } };
    }

    // Generate deterministic long-lived read-only SAS query string so private storage accounts work seamlessly
    const startsOn = new Date('2025-01-01T00:00:00Z');
    const expiresOn = new Date('2035-01-01T00:00:00Z');
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: normalizedPath,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
      },
      this.sharedKeyCredential,
    ).toString();

    return {
      data: {
        publicUrl: `${baseUrl}?${sasToken}`,
      },
    };
  }

  async list(
    folderPrefix?: string,
  ): Promise<{ data: Array<{ name: string }> | null; error: Error | null }> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const cleanPrefix = folderPrefix ? `${folderPrefix.replace(/^\/+|\/+$/g, '')}/` : '';
      const names = new Set<string>();

      for await (const blob of containerClient.listBlobsFlat({ prefix: cleanPrefix })) {
        const relative = cleanPrefix && blob.name.startsWith(cleanPrefix)
          ? blob.name.slice(cleanPrefix.length)
          : blob.name;
        const firstSegment = relative.split('/')[0];
        if (firstSegment) {
          names.add(firstSegment);
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
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(normalizedPath);
      const buf = await blockBlobClient.downloadToBuffer();
      const blob = new Blob([new Uint8Array(buf)], { type: 'audio/wav' });
      return { data: blob, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export class AzureStorageAdapter {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly sharedKeyCredential: StorageSharedKeyCredential | null;
  private readonly accountName: string;
  private readonly endpointSuffix: string;

  constructor(connectionString: string) {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const parsed = parseConnectionString(connectionString);
    this.accountName = parsed?.accountName || 'speakwithmayastorage';
    this.endpointSuffix = parsed?.endpointSuffix || 'core.windows.net';
    this.sharedKeyCredential = parsed
      ? new StorageSharedKeyCredential(parsed.accountName, parsed.accountKey)
      : null;
  }

  async listBuckets(): Promise<{ data: Array<{ id: string; name: string }>; error: Error | null }> {
    try {
      const buckets: Array<{ id: string; name: string }> = [];
      for await (const container of this.blobServiceClient.listContainers()) {
        buckets.push({ id: container.name, name: container.name });
      }
      return { data: buckets, error: null };
    } catch (err: any) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async createBucket(
    name: string,
    _options?: { public?: boolean },
  ): Promise<{ data: { name: string } | null; error: Error | null }> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(name);
      await containerClient.createIfNotExists();
      return { data: { name }, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  from(bucketName: string): AzureBlobBucketClient {
    return new AzureBlobBucketClient(
      this.blobServiceClient,
      this.sharedKeyCredential,
      this.accountName,
      this.endpointSuffix,
      bucketName,
    );
  }
}

/**
 * If AZURE_STORAGE_CONNECTION_STRING is present, replaces `supabaseClient.storage`
 * with AzureStorageAdapter so all audio uploads/downloads use Azure Blob Storage.
 */
export function attachAzureStorageIfConfigured(supabaseClient: any): void {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr || !supabaseClient) return;

  try {
    const adapter = new AzureStorageAdapter(connStr);
    Object.defineProperty(supabaseClient, 'storage', {
      value: adapter,
      writable: true,
      configurable: true,
    });
    logger.log('Attached Azure Blob Storage adapter (speakwithmayastorage) for audio storage');
  } catch (err: any) {
    logger.warn(`Failed to initialize Azure Blob Storage adapter: ${err?.message}`);
  }
}
