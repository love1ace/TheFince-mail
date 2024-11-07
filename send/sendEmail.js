import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AWS SES 클라이언트 설정
const sesClient = new SESClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// 이전 영업일 계산 함수 추가
function getPreviousBusinessDay(date) {
  const prevDay = new Date(date);
  prevDay.setDate(date.getDate() - 1);
  
  // 일요일(0)이면 금요일로, 토요일(6)이면 금요일로
  if (prevDay.getDay() === 0) {
    prevDay.setDate(prevDay.getDate() - 2);
  } else if (prevDay.getDay() === 6) {
    prevDay.setDate(prevDay.getDate() - 1);
  }
  
  return prevDay;
}

// 날짜 포맷팅 함수 추가
function formatKoreanDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

async function sendEmail() {
  try {
    // 서울 시간대 기준으로 현재 날짜 가져오기 및 이전 영업일 계산
    const seoulDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const previousBusinessDay = getPreviousBusinessDay(seoulDate);
    const formattedDate = formatKoreanDate(previousBusinessDay);

    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, '..', 'generate', 'output', 'output.html'),
      'utf8'
    );

    const params = {
        Source: '"TheFince.com" <report@thefince.com>',
        Destination: {
          ToAddresses: ['lovelacedud@gmail.com']
        },
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: htmlTemplate
            }
          },
          Subject: {
            Charset: 'UTF-8',
            Data: `[TheFince] ${formattedDate} - 미국 증시 요약`
          }
        }
      };

    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    console.log('이메일 전송 성공:', result.MessageId);
    return result;

  } catch (error) {
    console.error('이메일 전송 실패:', error);
    throw error;
  }
}

export default sendEmail; 