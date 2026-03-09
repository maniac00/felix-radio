/**
 * R2 Storage client for uploading and downloading files
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import type { Config } from '../types.js';
import { logger } from '../lib/logger.js';

export class R2Client {
  private client: S3Client;
  private bucketName: string;

  constructor(config: Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });

    this.bucketName = config.r2BucketName;
  }

  /**
   * Upload a file to R2
   */
  async uploadFile(localPath: string, r2Key: string): Promise<void> {
    logger.info(`Uploading file to R2`, { localPath, r2Key });

    try {
      const fileStats = await stat(localPath);
      const fileStream = createReadStream(localPath);

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: r2Key,
          Body: fileStream,
          ContentType: 'audio/mpeg',
          ContentLength: fileStats.size,
        })
      );

      logger.info(`File uploaded successfully`, {
        r2Key,
        size: fileStats.size,
      });
    } catch (error) {
      logger.error('Failed to upload file to R2', { localPath, r2Key, error });
      throw error;
    }
  }

  /**
   * Download a file from R2
   */
  async downloadFile(r2Key: string, localPath: string): Promise<void> {
    logger.info(`Downloading file from R2`, { r2Key, localPath });

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: r2Key,
        })
      );

      if (!response.Body) {
        throw new Error('No response body from R2');
      }

      const writeStream = createWriteStream(localPath);

      await new Promise((resolve, reject) => {
        // @ts-ignore - Body is a readable stream
        response.Body.pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });

      logger.info(`File downloaded successfully`, { r2Key, localPath });
    } catch (error) {
      logger.error('Failed to download file from R2', { r2Key, localPath, error });
      throw error;
    }
  }

  /**
   * Upload text content directly to R2
   */
  async uploadText(content: string, r2Key: string): Promise<void> {
    logger.info('Uploading text to R2', { r2Key });

    try {
      const body = Buffer.from(content, 'utf-8');

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: r2Key,
          Body: body,
          ContentType: 'text/plain; charset=utf-8',
          ContentLength: body.length,
        })
      );

      logger.info('Text uploaded successfully', { r2Key, size: body.length });
    } catch (error) {
      logger.error('Failed to upload text to R2', { r2Key, error });
      throw error;
    }
  }

  /**
   * Generate R2 key for user recording
   */
  static getUserRecordingKey(userId: string, filename: string): string {
    return `users/${userId}/recordings/${filename}`;
  }

  /**
   * Generate R2 key for STT text file
   */
  static getUserSTTKey(userId: string, filename: string): string {
    return `users/${userId}/stt/${filename}`;
  }
}
