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

// ES 모듈에서 __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드
dotenv.config();

// Handlebars 헬퍼 등록
registerHelpers();

// 이름 매핑 수정
const mappings = {
  indexNameMap: {
    'S&P 500': 'S&P 500',
    'NDX': '나스닥 100',
    'DJI': '다우존스 산업평균지수',
    'DXY': '달러 인덱스',
    'SSEC': '상해종합지수',
    'N225': '닛케이 225',
    'KOSPI': '코스피',
    'EU50': '유로스톡스 50',
    'UK100': 'FTSE 100',
    'DAX': 'DAX 40'
  },
  commodityNameMap: {
    'Gold': '금',
    'WTI': 'WTI 원유',
    'Brent': '브렌트유',
    'NG': '천연가스'
  },
  exchangeRateMap: {
    'USD/KRW': '달러/원',
    'EUR/KRW': '유로/원',
    'JPY/KRW': '엔/원'
  },
  cryptoNameMap: {
    'BTC': '비트코인',
    'ETH': '이더리움'
  }
};

// 매핑 헬퍼 등록
registerMappingHelpers(mappings);

// __dirname을 사용하여 이미지의 절대 경로 생성
const getImagePath = (imageName) => {
  return join(__dirname, '../../../image/flags', imageName);
};

// 국가 매핑 수정
const countryMap = {
  'Euro Area': {
    code: 'EU',
    name: 'EUR',
    flag: getImagePath('eu.svg')
  },
  'United Kingdom': {
    code: 'GB',
    name: 'GBR',
    flag: getImagePath('gb.svg')
  },
  'Germany': {
    code: 'DE',
    name: 'DEU',
    flag: getImagePath('de.svg')
  },
  'France': {
    code: 'FR',
    name: 'FRA',
    flag: getImagePath('fr.svg')
  },
  'United States': {
    code: 'US',
    name: 'USA',
    flag: getImagePath('us.svg')
  },
  'China': {
    code: 'CN',
    name: 'CHN',
    flag: getImagePath('cn.svg')
  },
  'Japan': {
    code: 'JP',
    name: 'JPN',
    flag: getImagePath('jp.svg')
  },
  'South Korea': {
    code: 'KR',
    name: 'KOR',
    flag: getImagePath('kr.svg')
  },
  'Taiwan': {
    code: 'TW',
    name: 'TWN',
    flag: getImagePath('tw.svg')
  },
  'Hong Kong': {
    code: 'HK',
    name: 'HKG',
    flag: getImagePath('hk.svg')
  }
};

// 원하는 데이터 목록 수정
const WANTED_INDICES = ['S&P 500', 'NDX', 'DJI', 'DXY', 'SSEC', 'N225', 'KOSPI', 'EU50', 'UK100', 'DAX'];
const WANTED_COMMODITIES = ['Gold', 'WTI', 'Brent', 'NG'];
const WANTED_EXCHANGE_RATES = ['USD/KRW', 'EUR/KRW', 'JPY/KRW'];
const WANTED_CRYPTO = ['BTC', 'ETH'];

// 지수 분류 정의
const US_INDICES = ['S&P 500', 'NDX', 'DJI', 'DXY'];
const ASIA_INDICES = ['SSEC', 'N225', 'KOSPI'];
const EUROPE_INDICES = ['EU50', 'UK100', 'DAX'];

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
    const dateString = formatInTimeZone(today, timeZone, 'yyyy-MM-dd');

    console.log('조회하려는 날짜:', dateString);

    const data = await collection.findOne({ _id: dateString });
    console.log('조회된 데이터 여부:', !!data);

    if (!data) {
      throw new Error(`${dateString} 날짜의 데이터가 없습니다.`);
    }

    const filteredData = {
      us_indices: data.market_data.indices?.filter((index) => US_INDICES.includes(index.name)) || [],
      asia_indices: data.market_data.indices?.filter((index) => ASIA_INDICES.includes(index.name)) || [],
      europe_indices: data.market_data.indices?.filter((index) => EUROPE_INDICES.includes(index.name)) || [],
      commodities: data.market_data.commodities?.filter((commodity) => WANTED_COMMODITIES.includes(commodity.name)) || [],
      exchange_rates: data.market_data.exchange_rates
        ?.filter(rate => {
          // USD/KRW는 직접 사용
          if (rate.name === 'USD/KRW') return true;
          
          // EUR/KRW, JPY/KRW를 위한 USD/EUR, USD/JPY 필터링
          const wantedRates = WANTED_EXCHANGE_RATES
            .filter(r => r !== 'USD/KRW')  // USD/KRW는 이미 처리했으므로 제외
            .map(r => r.replace('/KRW', ''))
            .map(r => `USD/${r}`);
          
          return wantedRates.includes(rate.name);
        })
        .map(rate => {
          // USD/KRW는 변환 없이 그대로 사용
          if (rate.name === 'USD/KRW') {
            return {
              name: 'USD/KRW',
              current_price: rate.current_price,
              change_amount: rate.change_amount,
              change_percent: rate.change_percent
            };
          }
          
          // 다른 통화들은 KRW로 변환
          const usdKrw = data.market_data.exchange_rates.find(r => r.name === 'USD/KRW')?.current_price || 1;
          const currency = rate.name.split('/')[1];
          return {
            name: `${currency}/KRW`,
            current_price: usdKrw / rate.current_price,
            change_amount: rate.change_amount,
            change_percent: rate.change_percent
          };
        }) || [],
      cryptocurrency: data.market_data.cryptocurrency?.filter((crypto) => WANTED_CRYPTO.includes(crypto.name)) || [],
      economic_calendar: {},
    };

    const calendar = data.market_data.economic_calendar || {};
    for (const date in calendar) {
      filteredData.economic_calendar[date] = {};
      
      Object.keys(calendar[date] || {}).forEach(country => {
        if (calendar[date]?.[country] && countryMap[country]) {
          const eventsWithCountry = calendar[date][country]
            .filter(event => event.importance >= 2)  // 중요도 2-3인 이벤트만 필터링
            .map(event => {
              const flagPath = countryMap[country].flag;
              const flagContent = fs.readFileSync(flagPath, 'utf8');
              return {
                ...event,
                country: {
                  ...countryMap[country],
                  flag: `data:image/svg+xml;base64,${Buffer.from(flagContent).toString('base64')}`
                }
              };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          if (eventsWithCountry.length > 0) {
            filteredData.economic_calendar[date][country] = eventsWithCountry;
          }
        }
      });
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
      us_indices: marketData.us_indices,
      asia_indices: marketData.asia_indices,
      europe_indices: marketData.europe_indices,
      commodities: marketData.commodities,
      exchange_rates: marketData.exchange_rates,
      cryptocurrency: marketData.cryptocurrency,
      ...dates,
      yesterday_calendar: Object.values(marketData.economic_calendar[dates.previousDateString] || {})
        .flat()
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
      today_calendar: Object.values(marketData.economic_calendar[dates.todayDateString] || {})
        .flat()
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
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

    fs.writeFileSync(join(__dirname, 'output', 'output.html'), inlinedHTML);
  } catch (error) {
    console.error('HTML 생성 중 오류 발생:', error);
    throw error;
  }
}

generateHTML();