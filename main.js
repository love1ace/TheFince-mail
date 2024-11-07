import { writeLog } from './utils/logger.js';

// 서버 시작 로그
writeLog('서버가 시작되었습니다.', 'sendmail.log');

// HTML 생성 함수
async function generateHTMLFile() {
  try {
    const { generateHTML } = await import('./generate/generateMail.js');
    await writeLog('메일 생성 시작...', 'sendmail.log');
    await generateHTML();
    await writeLog('✅ 메일 생성 완료', 'sendmail.log');
    return true;
  } catch (error) {
    await writeLog(`❌ 메일 생성 중 에러 발생: ${error.message}`, 'sendmail.log');
    return false;
  }
}

// 이메일 전송 함수
async function sendEmailReport() {
  try {
    const { default: sendEmail } = await import('./send/sendEmail.js');
    await writeLog('이메일 전송 시작...', 'sendmail.log');
    await sendEmail();
    await writeLog('✅ 이메일 전송 완료', 'sendmail.log');
    return true;
  } catch (error) {
    await writeLog(`❌ 이메일 전송 중 에러 발생: ${error.message}`, 'sendmail.log');
    return false;
  }
}

// 메인 실행 함수
async function main() {
  try {
    // HTML 파일 생성
    const htmlGenerated = await generateHTMLFile();
    if (!htmlGenerated) {
      await writeLog('❌ HTML 생성 실패로 이메일 전송 중단', 'sendmail.log');
      return;
    }

    // 이메일 전송
    const emailSent = await sendEmailReport();
    if (!emailSent) {
      await writeLog('❌ 이메일 전송 실패', 'sendmail.log');
      return;
    }

    await writeLog('✅ 전체 프로세스 완료', 'sendmail.log');
  } catch (error) {
    await writeLog(`❌ 실행 중 오류 발생: ${error.message}`, 'sendmail.log');
  }
}

// 프로그램 실행
main();

