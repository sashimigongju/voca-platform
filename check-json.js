import fs from 'node:fs'

const files = [
  './src/data/neunglyul.json',
  './src/data/neunglyulExtra.json',
]

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

try {
  const data1 = readJson(files[0])
  const data2 = readJson(files[1])

  if (!Array.isArray(data1) || !Array.isArray(data2)) {
    throw new Error('두 파일 모두 최상위가 배열([])이어야 합니다.')
  }

  function getKeys(data) {
    return [...new Set(data.flatMap((item) => Object.keys(item)))].sort()
  }

  const keys1 = getKeys(data1)
  const keys2 = getKeys(data2)

  console.log('neunglyul.json 항목 수:', data1.length)
  console.log('neunglyulExtra.json 항목 수:', data2.length)
  console.log('neunglyul.json 키:', keys1)
  console.log('neunglyulExtra.json 키:', keys2)
  console.log(
    '키 구성이 같은가요?',
    JSON.stringify(keys1) === JSON.stringify(keys2)
  )

const requiredKeys = ['no', 'english', 'korean']

for (const [file, data] of [
  [files[0], data1],
  [files[1], data2],
]) {
  const invalid = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      !item ||
      typeof item !== 'object' ||
      !requiredKeys.every((key) => key in item) ||
      !('day' in item || 'category' in item) ||
      typeof item.english !== 'string' ||
      typeof item.korean !== 'string'
    )

  console.log(`${file} 필수 형식 오류: ${invalid.length}개`)

  if (invalid.length > 0) {
    console.log('오류 예시:', invalid.slice(0, 5))
  }
}
} catch (error) {
  console.error('검사 중 오류:', error.message)
  process.exitCode = 1
}