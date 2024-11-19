import fs from 'fs';
import Handlebars from 'handlebars';
import juice from 'juice';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { formatInTimeZone } from 'date-fns-tz';
import { registerHelpers, registerMappingHelpers } from '../../../utils/handlebarHelpers.js';
import { getFormattedDates } from '../../../utils/dateUtils.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ES 모듈에서 __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드
dotenv.config();

// Handlebars 헬퍼 등록
registerHelpers();

// 매핑 정의 후
const mappings = {
  indexNameMap: {
    'S&P 500': 'S&P 500',
    DJI: '다우존스 산업평균지수',
    NDX: '나스닥 100',
    SOX: '필라델피아 반도체 지수',
    DXY: '달러 인덱스',
  },
  commodityNameMap: {
    Gold: '금',
    WTI: 'WTI 원유',
    Brent: '브렌트유',
    NG: '천연가스',
  },
  exchangeRateMap: {
    'USD/KRW': '달러/원',
  },
  cryptoNameMap: {
    BTC: '비트코인',
    ETH: '이더리움',
  },
  treasuryNameMap: {
    '2-Year Treasury Yield': '2년물',
    '10-Year Treasury Yield': '10년물',
    '30-Year Treasury Yield': '30년물',
  },
};

// 매핑 헬퍼 등록
registerMappingHelpers(mappings);

// __dirname을 사용하여 이미지의 절대 경로 생성
const getImagePath = (imageName) => {
  return join(__dirname, '../../../image/flags', imageName);
};

// 국가 매핑 수정
const countryMap = {
  'United States': {
    code: 'US',
    name: 'USA',
    flag: getImagePath('us.svg')
  }
};

// 원하는 데이터 목록 정의
const WANTED_INDICES = ['S&P 500', 'DJI', 'NDX', 'SOX', 'DXY'];
const WANTED_COMMODITIES = ['Gold', 'WTI', 'Brent', 'NG'];
const WANTED_EXCHANGE_RATES = ['USD/KRW'];
const WANTED_CRYPTO = ['BTC', 'ETH'];
const WANTED_TREASURY = ['2-Year Treasury Yield', '10-Year Treasury Yield', '30-Year Treasury Yield'];

// S3 클라이언트 설정
const s3Client = new S3Client({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

// MongoDB 연결 및 데이터 가져오기 함수
async function getMarketData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('MongoDB 연결 성공');

    const db = client.db('TheFince');
    const collection = db.collection('data');

    const today = new Date();
    const timeZone = 'Asia/Seoul';
    
    // 주말 처리 로직 제거하고 현재 날짜 그대로 사용
    const dateString = formatInTimeZone(today, timeZone, 'yyyy-MM-dd');

    console.log('조회하려는 날짜:', dateString);

    const data = await collection.findOne({ _id: dateString });
    console.log('조회된 데이터 여부:', !!data);

    if (!data) {
      throw new Error(`${dateString} 날짜의 데이터가 없습니다.`);
    }

    const filteredData = {
      indices: data.usa.indices?.filter((index) => WANTED_INDICES.includes(index.name)) || [],
      commodities: data.usa.commodities?.filter((commodity) => WANTED_COMMODITIES.includes(commodity.name)) || [],
      exchange_rates: data.usa.exchange_rates?.filter((rate) => WANTED_EXCHANGE_RATES.includes(rate.name)) || [],
      cryptocurrency: data.crypto.prices?.filter((crypto) => WANTED_CRYPTO.includes(crypto.name)) || [],
      treasury_yields: data.usa.treasury_yields?.filter((treasury) => WANTED_TREASURY.includes(treasury.name)) || [],
      economic_calendar: {},
      news: data.usa.news || [],
    };

    // 경제 캘린더 처리
    const calendar = data.usa.economic_calendar || {};
    for (const date in calendar) {
      if (calendar[date]?.['United States']) {
        const eventsWithCountry = calendar[date]['United States']
          .filter(event => event.importance >= 1)
          .map(event => ({
            ...event,
            country: {
              ...countryMap['United States'],
              flag: `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(countryMap['United States'].flag, 'utf8')).toString('base64')}`
            }
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        filteredData.economic_calendar[date] = eventsWithCountry;
      }
    }

    return filteredData;
  } catch (error) {
    console.error('데이터 조회 중 오류 발생:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// generateHTML 함수를 export 하도록 수정
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
      yesterday_calendar: marketData.economic_calendar[dates.previousDateString] || [],
      today_calendar: marketData.economic_calendar[dates.todayDateString] || [],
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
    
    // 파일명 변경
    const outputFileName = 'usa_output.html';
    const localFilePath = join(__dirname, 'output', outputFileName);
    
    // 로컬에 파일 저장
    fs.writeFileSync(localFilePath, inlinedHTML);

    // S3에 업로드
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const s3Key = `output/${dateStr}/${outputFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: inlinedHTML,
      ContentType: 'text/html',
    });

    await s3Client.send(putCommand);
    console.log(`HTML 파일이 S3에 업로드되었습니다: ${s3Key}`);

  } catch (error) {
    console.error('HTML 생성 중 오류 발생:', error);
    throw error;
  }
}

generateHTML();