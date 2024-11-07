import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// S3 client configuration
const s3Client = new S3Client({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

export async function writeLog(message, logFileName) {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const logMessage = `[${timeStr}] ${message}\n`;

    // 콘솔 출력
    console.log(logMessage);

    // S3 저장 로직
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const s3Key = `logs/${dateStr}/${logFileName}`;

    // 기존 로그 파일 읽기
    let existingContent = '';
    try {
      const getCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
      });
      const response = await s3Client.send(getCommand);
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      existingContent = Buffer.concat(chunks).toString('utf-8');
    } catch (error) {
      if (error.name !== 'NoSuchKey') {
        console.error(`[${timeStr}] 로그 파일 읽기 오류: ${error.message}`);
      }
    }

    // 로그 파일 업데이트
    const updatedContent = existingContent + logMessage;
    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: updatedContent,
      ContentType: 'text/plain',
    });

    await s3Client.send(putCommand);
  } catch (error) {
    console.error(`[${timeStr}] 로그 작성 오류: ${error.message}`);
  }
}