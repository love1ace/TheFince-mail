import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';

export function getPreviousBusinessDay(date) {
  return subDays(new Date(date), 1);
}

export function getFormattedDates(now, timeZone = 'Asia/Seoul') {
  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
  const koreaTime = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
  const previousBusinessDay = getPreviousBusinessDay(koreaTime);

  return {
    today_date: {
      year: formatInTimeZone(now, timeZone, 'yyyy'),
      month: formatInTimeZone(now, timeZone, 'M'),
      day: formatInTimeZone(now, timeZone, 'd'),
      weekday: weekdays[formatInTimeZone(now, timeZone, 'i') - 1],
    },
    yesterday_date: {
      year: formatInTimeZone(previousBusinessDay, timeZone, 'yyyy'),
      month: formatInTimeZone(previousBusinessDay, timeZone, 'M'),
      day: formatInTimeZone(previousBusinessDay, timeZone, 'd'),
      weekday: weekdays[formatInTimeZone(previousBusinessDay, timeZone, 'i') - 1],
    },
    previousDateString: formatInTimeZone(previousBusinessDay, timeZone, 'yyyy-MM-dd'),
    todayDateString: formatInTimeZone(now, timeZone, 'yyyy-MM-dd'),
  };
} 