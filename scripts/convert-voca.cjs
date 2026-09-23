const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const excelPath = path.join(
  process.cwd(),
  "온리원보카_팩토리보카 정리.xlsx"
);

if (!fs.existsSync(excelPath)) {
  console.error("엑셀 파일을 프로젝트 최상위 폴더에서 찾지 못했습니다.");
  console.error("파일명: 온리원보카_팩토리보카 정리.xlsx");
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames.includes("온리원보카")
  ? "온리원보카"
  : workbook.SheetNames[0];

const sheet = workbook.Sheets[sheetName];

// 엑셀을 '열 제목으로 된 객체'가 아닌 행 배열로 읽습니다.
const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: "",
  blankrows: false,
});

// 제목에 공백이나 BOM 문자가 있어도 찾을 수 있도록 정리합니다.
function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

const requiredHeaders = ["index", "항목", "단어", "뜻"];
let headerRowIndex = -1;
let headerMap = new Map();

// 첫 20행 안에서 필요한 열 제목을 찾습니다.
for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
  const candidate = new Map();

  rows[rowIndex].forEach((value, columnIndex) => {
    const key = normalizeHeader(value);
    if (key && !candidate.has(key)) {
      candidate.set(key, columnIndex);
    }
  });

  if (requiredHeaders.every((header) => candidate.has(header))) {
    headerRowIndex = rowIndex;
    headerMap = candidate;
    break;
  }
}

if (headerRowIndex === -1) {
  console.error("필요한 열 제목(Index, 항목, 단어, 뜻)을 찾지 못했습니다.");
  console.error("읽은 시트:", sheetName);
  console.error("엑셀 첫 8행:");
  console.error(JSON.stringify(rows.slice(0, 8), null, 2));
  process.exit(1);
}

const columns = {
  id: headerMap.get("index"),
  day: headerMap.get("항목"),
  word: headerMap.get("단어"),
  meaning: headerMap.get("뜻"),
};

console.log("읽은 시트:", sheetName);
console.log("열 제목 행:", headerRowIndex + 1);
console.log("변환에 사용할 열 위치:", columns);

const days = {};
let converted = 0;
let skipped = 0;
const skippedExamples = [];

for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
  const row = rows[rowIndex];

  const rawDay = row[columns.day];
  const rawWord = row[columns.word];
  const rawMeaning = row[columns.meaning];

  const day = String(rawDay ?? "").trim();

  // 엑셀에서 논리값 FALSE로 저장된 단어를 영어 단어 false로 처리합니다.
  const word =
    rawWord === false ? "false" : String(rawWord ?? "").trim();

  const meaning = String(rawMeaning ?? "").trim();

  // 내용이 없는 행은 건너뜁니다.
  if (!day && !word && !meaning) {
    continue;
  }

  // Day, 단어, 뜻 중 빠진 항목이 있으면 기록하고 건너뜁니다.
  if (!day || !word || !meaning) {
    skipped += 1;

    if (skippedExamples.length < 5) {
      skippedExamples.push({
        excelRow: rowIndex + 1,
        day,
        word,
        meaning,
      });
    }

    continue;
  }

  const rawId = row[columns.id];
  const parsedId =
    rawId === "" || rawId === null || rawId === undefined
      ? NaN
      : Number(rawId);

  if (!days[day]) {
    days[day] = [];
  }

  days[day].push({
    id: Number.isFinite(parsedId) ? parsedId : converted + 1,
    word,
    meaning,
  });

  converted += 1;
}

const outputPath = path.join(
  process.cwd(),
  "src",
  "data",
  "onlyoneVoca.json"
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      book: "온리원보카",
      days,
    },
    null,
    2
  ),
  "utf8"
);

console.log("");
console.log("엑셀 변환이 완료됐습니다.");
console.log(`변환한 단어: ${converted}개`);
console.log(`Day 수: ${Object.keys(days).length}개`);
console.log(`건너뛴 행: ${skipped}개`);
console.log(`생성 파일: ${path.relative(process.cwd(), outputPath)}`);

if (skippedExamples.length > 0) {
  console.log("건너뛴 행의 예시:");
  console.log(JSON.stringify(skippedExamples, null, 2));
}
