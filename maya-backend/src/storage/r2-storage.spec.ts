import { describe, it, expect } from 'vitest';
import { R2BucketClient, CloudflareR2StorageAdapter } from './r2-storage.js';

function fakeS3() {
  const sent: any[] = [];
  return {
    sent,
    client: {
      send: async (cmd: any) => {
        sent.push(cmd.input);
        return {};
      },
    } as any,
  };
}

describe('R2BucketClient key mapping', () => {
  it('shared bucket: stores logical bucket as key prefix and URL matches the key', async () => {
    const s3 = fakeS3();
    const c = new R2BucketClient(s3.client, 'session-recordings', 'https://media.example.com', 'maya-media');

    const res = await c.upload('/abc/turns/user_turn_0.wav', Buffer.from('x'));
    expect(res.error).toBeNull();
    expect(s3.sent[0]).toMatchObject({ Bucket: 'maya-media', Key: 'session-recordings/abc/turns/user_turn_0.wav' });

    expect(c.getPublicUrl('abc/turns/user_turn_0.wav').data.publicUrl).toBe(
      'https://media.example.com/session-recordings/abc/turns/user_turn_0.wav',
    );
  });

  it('shared bucket: list prefixes include the logical bucket', async () => {
    const s3 = fakeS3();
    const c = new R2BucketClient(s3.client, 'roadmap-audio', 'https://media.example.com', 'maya-media');
    await c.list('level-1');
    expect(s3.sent[0]).toMatchObject({ Bucket: 'maya-media', Prefix: 'roadmap-audio/level-1/' });
  });

  it('without shared bucket: keeps one R2 bucket per logical bucket (old behaviour)', async () => {
    const s3 = fakeS3();
    const c = new R2BucketClient(s3.client, 'session-recordings', 'https://media.example.com');
    await c.upload('abc.wav', Buffer.from('x'));
    expect(s3.sent[0]).toMatchObject({ Bucket: 'session-recordings', Key: 'abc.wav' });
  });
});

describe('CloudflareR2StorageAdapter shared-bucket mode', () => {
  it('reports logical buckets as existing without calling the bucket API', async () => {
    const a = new CloudflareR2StorageAdapter({
      accountId: 'acc',
      accessKeyId: 'k',
      secretAccessKey: 's',
      bucketName: 'maya-media',
    });
    const { data } = await a.listBuckets();
    expect(data.map((b) => b.name)).toEqual(['session-recordings', 'roadmap-audio']);
    expect((await a.createBucket('session-recordings')).error).toBeNull();
  });
});
