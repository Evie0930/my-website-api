const BLOCK_WORDS = ['傻逼', '垃圾', '去死', '妈的'];
export const MAX_BARRAGE_LENGTH = 20;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function countVisibleChars(text) {
  return Array.from(String(text || '')).length;
}

export function isValidViewerToken(token) {
  return typeof token === 'string' && UUID_RE.test(token.trim());
}

/** 以半角 [测试] 开头为仅自己可见测试弹幕；返回正文（去掉前缀） */
export function parseBarragePayload(raw) {
  const trimmed = String(raw || '').trim();
  const testPrefix = '[测试]';
  if (trimmed.startsWith(testPrefix)) {
    const body = trimmed.slice(testPrefix.length).trim();
    return { isPrivateTest: true, body };
  }
  return { isPrivateTest: false, body: trimmed };
}

export function sanitizeContent(text) {
  let output = text;
  BLOCK_WORDS.forEach((word) => {
    const re = new RegExp(word, 'gi');
    output = output.replace(re, '***');
  });
  return output;
}

export function isRejectedPattern(text) {
  if (/^verify-rls-/i.test(text)) return true;
  if (/^\d+$/.test(text)) return true;
  return false;
}

export function isAllowedBarrageText(text) {
  const allowedChars =
    /^[\p{Script=Han}A-Za-z0-9\s\p{Extended_Pictographic}，。！？、；：,.!?'"\-—_()（）【】《》<>@#%&+*=~`]+$/u;
  if (!allowedChars.test(text)) return false;
  const meaningful = /[\p{Script=Han}A-Za-z\p{Extended_Pictographic}]/u;
  return meaningful.test(text);
}

/** 乱码/无意义：过长重复、符号占比过高等 */
export function isGarbageOrNoise(text) {
  const t = String(text || '');
  if (t.length < 2) return false;
  const chars = Array.from(t);
  const uniq = new Set(chars).size;
  if (chars.length >= 6 && uniq <= 2) return true;
  const letters = chars.filter((ch) => /[\p{Script=Han}A-Za-z\p{Extended_Pictographic}]/u.test(ch)).length;
  const nonSpace = chars.filter((ch) => !/\s/u.test(ch)).length;
  if (nonSpace >= 4 && letters / nonSpace < 0.25) return true;
  return false;
}

export function validateBarrageBody(body, { isPrivateTest }) {
  if (!body) {
    return { ok: false, error: isPrivateTest ? '测试弹幕请写 [测试] 后的内容' : 'content is required' };
  }
  if (countVisibleChars(body) > MAX_BARRAGE_LENGTH) {
    return { ok: false, error: `content exceeds ${MAX_BARRAGE_LENGTH} characters` };
  }
  if (isRejectedPattern(body)) {
    return { ok: false, error: 'invalid content pattern' };
  }
  if (!isAllowedBarrageText(body)) {
    return { ok: false, error: 'content includes unsupported characters' };
  }
  if (isGarbageOrNoise(body)) {
    return { ok: false, error: 'invalid content pattern' };
  }
  return { ok: true };
}
