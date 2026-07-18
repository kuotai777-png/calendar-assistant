// utils/localParser.js

// 智慧型本地日期提取器
export function extractDate(text) {
  const slashMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (slashMatch) return `${slashMatch[1].padStart(2, '0')}/${slashMatch[2].padStart(2, '0')}`;
  
  const cnMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[號日]?/);
  if (cnMatch) return `${cnMatch[1].padStart(2, '0')}/${cnMatch[2].padStart(2, '0')}`;
  
  return null;
}

// 提取 JSON (防範 AI 廢話)
export function extractJSON(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.substring(start, end + 1));
      } catch (err) {
        console.warn("❌ JSON 提取解析失敗:", err);
      }
    }
    return null;
  }
}

// (保留你原本的 parseSchedule 等方法，如果在別的檔案請自行調整引入路徑)
export function parseSchedule(text) {
  // 這裡放你原本的 parseSchedule 邏輯...
  return null; 
}

export function parseDelete(text) {
  // 這裡放你原本的 parseDelete 邏輯...
  return null;
}
