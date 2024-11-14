import fs from 'fs';
import Handlebars from 'handlebars';
import juice from 'juice';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { formatInTimeZone } from 'date-fns-tz';
import { registerHelpers, registerMappingHelpers } from '../../../../utils/handlebarHelpers.js';
import { getFormattedDates } from '../../../../utils/dateUtils.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

registerHelpers();

const mappings = {
  exchangeRateMap: {
    'USD/KRW': '달러/원',
  },
  cryptoNameMap: {
    BTC: '비트코인',
  },
  stockNameMap: {
    // 필요한 주식 매핑이 있다면 여기에 추가
  }
};

registerMappingHelpers(mappings);

const WANTED_EXCHANGE_RATES = ['USD/KRW'];

const s3Client = new S3Client({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

async function getMarketData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('MongoDB 연결 성공');

    const db = client.db('TheFince');
    const collection = db.collection('data');

    const today = new Date();
    const timeZone = 'Asia/Seoul';
    
    const dateString = formatInTimeZone(today, timeZone, 'yyyy-MM-dd');

    console.log('조회하려는 날짜:', dateString);

    const data = await collection.findOne({ _id: dateString });
    console.log('조회된 데이터 여부:', !!data);

    if (!data) {
      throw new Error(`${dateString} 날짜의 데이터가 없습니다.`);
    }

    const filteredData = {
      bitcoin: {
        price: data.crypto.prices.find(crypto => crypto.name === 'BTC'),
        market_cap: data.crypto.btc.market_cap.value,
      },
      exchange_rates: data.usa.exchange_rates?.filter((rate) => WANTED_EXCHANGE_RATES.includes(rate.name)) || [],
      news: data.crypto.btc.news || [],
    };

    return filteredData;
  } catch (error) {
    console.error('데이터 조회 중 오류 발생:', error);
    throw error;
  } finally {
    await client.close();
  }
}

export async function generateHTML() {
  try {
    const outputDir = join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const marketData = await getMarketData();
    if (!marketData) {
      throw new Error('시장 데이터를 가져오는데 실패했습니다.');
    }

    const now = new Date();
    const timeZone = 'Asia/Seoul';
    const dates = getFormattedDates(now, timeZone);

    const data = {
      ...marketData,
      ...dates,
    };

    const template = fs.readFileSync(join(__dirname, 'template', 'template.html'), 'utf-8');
    const cssContent = fs.readFileSync(join(__dirname, 'template', 'styles.css'), 'utf-8');

    const compiledTemplate = Handlebars.compile(template);
    const htmlContent = compiledTemplate(data);

    const options = {
      applyStyleTags: true,
      removeStyleTags: true,
      preserveMediaQueries: true,
      extraCss: cssContent,
    };

    const inlinedHTML = juice(htmlContent, options);
    
    const outputFileName = 'btc_output.html';
    const localFilePath = join(__dirname, 'output', outputFileName);
    
    fs.writeFileSync(localFilePath, inlinedHTML);

    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const s3Key = `output/${dateStr}/${outputFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: inlinedHTML,
      ContentType: 'text/html',
    });

    // await s3Client.send(putCommand);
    // console.log(`HTML 파일이 S3에 업로드되었습니다: ${s3Key}`);

  } catch (error) {
    console.error('HTML 생성 중 오류 발생:', error);
    throw error;
  }
}

generateHTML();