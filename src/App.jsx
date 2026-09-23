import { useEffect, useMemo, useRef, useState } from 'react'
import onlyoneVoca from './data/onlyoneVoca.json'
import './App.css'

const QUESTIONS_PER_PAGE = 50

function toText(value) {
  if (value === false) return 'false'
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getDayNumber(dayName) {
  return Number(String(dayName).match(/\d+/)?.[0] ?? 0)
}

function formatDayName(dayName) {
  return String(dayName).replace(/^Day\s*(\d+)$/i, 'Day $1')
}

const DAY_ENTRIES = Object.entries(onlyoneVoca?.days ?? {})
  .filter(([dayName, words]) => Array.isArray(words) && /\d+/.test(dayName))
  .map(([name, rawWords]) => ({
    name,
    words: rawWords
      .map((item, index) => ({
        id: item?.id ?? item?.index ?? `${name}-${index + 1}`,
        word: toText(item?.word ?? item?.english),
        meaning: toText(item?.meaning ?? item?.korean),
      }))
      .filter((item) => item.word && item.meaning),
  }))
  .filter((day) => day.words.length > 0)
  .sort((dayA, dayB) => getDayNumber(dayA.name) - getDayNumber(dayB.name))

const FIRST_DAY_NAME = DAY_ENTRIES[0]?.name ?? ''

const TOTAL_WORDS = DAY_ENTRIES.reduce(
  (total, day) => total + day.words.length,
  0,
)

function getOrderedDayNames(dayNames) {
  const selectedNames = new Set(dayNames)
  return DAY_ENTRIES
    .filter((day) => selectedNames.has(day.name))
    .map((day) => day.name)
}

function getDaySummary(dayNames) {
  const orderedNames = getOrderedDayNames(dayNames)

  if (orderedNames.length === 0) return '선택 없음'

  const numbers = orderedNames.map(getDayNumber)
  const isContinuous = numbers.every(
    (number, index) => number === numbers[0] + index,
  )

  if (numbers.length === 1) {
    return formatDayName(orderedNames[0])
  }

  if (isContinuous) {
    return `${formatDayName(orderedNames[0])}–${formatDayName(
      orderedNames[orderedNames.length - 1],
    )}`
  }

  if (orderedNames.length <= 5) {
    return orderedNames.map(formatDayName).join(', ')
  }

  return `${orderedNames.slice(0, 5).map(formatDayName).join(', ')} 외 ${
    orderedNames.length - 5
  }개 Day`
}

function getWordCountForDays(dayNames) {
  const selectedNames = new Set(dayNames)

  return DAY_ENTRIES.reduce(
    (total, day) =>
      selectedNames.has(day.name) ? total + day.words.length : total,
    0,
  )
}

function normalizeQuestionCount(value, maximum) {
  const parsed = Number.parseInt(value, 10)
  const requested =
    Number.isInteger(parsed) && parsed > 0 ? parsed : QUESTIONS_PER_PAGE

  if (maximum > 0) {
    return String(Math.min(requested, maximum))
  }

  return String(requested)
}

function makeStudentRecord(id, source = null) {
  const dayNames =
    source?.dayNames?.length > 0
      ? getOrderedDayNames(source.dayNames)
      : FIRST_DAY_NAME
        ? [FIRST_DAY_NAME]
        : []

  const maximum = getWordCountForDays(dayNames)

  return {
    id,
    name: '',
    dayNames,
    selectionMode: source?.selectionMode ?? 'range',
    anchorDayName:
      source?.anchorDayName ??
      dayNames[0] ??
      null,
    questionCount: normalizeQuestionCount(
      source?.questionCount ?? String(QUESTIONS_PER_PAGE),
      maximum,
    ),
  }
}

function makeRangeDayNames(startIndex, endIndex) {
  const start = Math.min(startIndex, endIndex)
  const end = Math.max(startIndex, endIndex)

  return DAY_ENTRIES
    .slice(start, end + 1)
    .map((day) => day.name)
}

function areSetsEqual(setA, setB) {
  if (setA.size !== setB.size) return false

  for (const value of setA) {
    if (!setB.has(value)) return false
  }

  return true
}

function getScrollTargetIndex(listElement, rowSelector) {
  const rows = Array.from(listElement.querySelectorAll(rowSelector))

  if (rows.length === 0) return null

  const atBottom =
    listElement.scrollTop + listElement.clientHeight >=
    listElement.scrollHeight - 3

  if (atBottom) {
    return Number(rows[rows.length - 1].dataset.dayIndex)
  }

  const topEdge = listElement.getBoundingClientRect().top + 2
  const topVisibleRow = rows.find(
    (row) => row.getBoundingClientRect().bottom > topEdge,
  )

  return topVisibleRow
    ? Number(topVisibleRow.dataset.dayIndex)
    : Number(rows[0].dataset.dayIndex)
}

function shuffle(items) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const temporary = result[index]

    result[index] = result[randomIndex]
    result[randomIndex] = temporary
  }

  return result
}

function splitIntoPages(items, pageSize = QUESTIONS_PER_PAGE) {
  const pages = []

  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize))
  }

  return pages
}

function makeQuestions(words, questionCount, direction, order) {
  const parsed = Number.parseInt(questionCount, 10)
  const requested =
    Number.isInteger(parsed) && parsed > 0 ? parsed : QUESTIONS_PER_PAGE

  // 문항 수의 최대는 선택한 단어 수입니다. 50으로 제한하지 않습니다.
  const actualCount = Math.min(requested, words.length)

  const orderedWords =
    order === 'random'
      ? shuffle(words)
      : [...words]

  return orderedWords
    .slice(0, actualCount)
    .map((item, index) => ({
      ...item,
      number: index + 1,
      prompt: direction === 'en-ko' ? item.word : item.meaning,
      answer: direction === 'en-ko' ? item.meaning : item.word,
    }))
}

function makePrintDocuments(groups, includeAnswers = true) {
  const examDocuments = []
  const answerDocuments = []

  groups.forEach((group) => {
    const pages = splitIntoPages(group.questions)

    pages.forEach((questions, pageIndex) => {
      const documentInfo = {
        studentId: group.studentId,
        studentName: group.studentName ?? '',
        dayNames: group.dayNames,
        direction: group.direction,
        order: group.order,
        questions,
        pageIndex,
        pageCount: pages.length,
      }

      examDocuments.push({
        ...documentInfo,
        type: 'exam',
      })

      if (includeAnswers) {
        answerDocuments.push({
          ...documentInfo,
          type: 'answer',
        })
      }
    })
  })

  const allDocuments = [...examDocuments, ...answerDocuments]

  return allDocuments.map((documentInfo, index) => ({
    ...documentInfo,
    breakAfter: index < allDocuments.length - 1,
  }))
}

function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="현재 위치">
      {items.map((item, index) => (
        <span className="breadcrumb-item" key={`${item.label}-${index}`}>
          {index > 0 && <span className="breadcrumb-separator">/</span>}

          {item.onClick ? (
            <button
              className="breadcrumb-button"
              type="button"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function SiteHeader({ view, onHome, onBack }) {
  const viewLabels = {
    home: '메뉴',
    books: '단어 시험지',
    onlyoneMenu: '온리원보카',
    neungyul: '능률 VOCA',
    single: '개인 단어 시험지',
    batch: '여러 명 단어 선택',
  }

  return (
    <header className="site-header screen-only">
      <div className="site-header-inner">
        <button
          className="brand-button"
          type="button"
          onClick={onHome}
          aria-label="메뉴 홈으로 이동"
        >
          <span className="brand-mark">V</span>
          <span className="brand-name">VOCAB DESK</span>
        </button>

        <div className="header-location">
          {viewLabels[view] ?? '메뉴'}
        </div>

        <div className="header-actions">
          {view !== 'home' && (
            <button
              className="header-button"
              type="button"
              onClick={onBack}
            >
              ← 이전
            </button>
          )}

          <button
            className="header-button"
            type="button"
            onClick={onHome}
          >
            메뉴
          </button>
        </div>
      </div>
    </header>
  )
}

function MenuHome({ onOpen }) {
  const menuItems = [
    {
      id: 'books',
      icon: 'V',
      title: '단어 시험지',
      detail: '온리원보카 · 능률 VOCA',
      badge: '사용 가능',
      available: true,
    },
    {
      id: 'coming',
      icon: 'S',
      title: '문장 연습',
      detail: '준비 중',
      badge: '준비 중',
      available: false,
    },
    {
      id: 'coming',
      icon: 'R',
      title: '복습 도구',
      detail: '준비 중',
      badge: '준비 중',
      available: false,
    },
  ]

  return (
    <section className="home-screen">
      <header className="screen-heading">
        <p className="eyebrow">VOCAB DESK</p>
        <h1>메뉴</h1>
      </header>

      <div className="menu-grid">
        {menuItems.map((item, index) => (
          <button
            className={`menu-card ${
              item.available ? '' : 'menu-card-disabled'
            }`}
            type="button"
            key={`${item.title}-${index}`}
            disabled={!item.available}
            onClick={() => onOpen(item.id)}
          >
            <span className="menu-card-top">
              <span className="menu-icon">{item.icon}</span>
              <span
                className={`status-tag ${
                  item.available ? 'status-tag-active' : ''
                }`}
              >
                {item.badge}
              </span>
            </span>

            <span className="menu-card-title">{item.title}</span>

            <span className="menu-card-bottom">
              <span>{item.detail}</span>
              {item.available && <span className="arrow">→</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function BookSelectPage({ onNavigate }) {
  return (
    <section>
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: () => onNavigate('home') },
          { label: '단어 시험지' },
        ]}
      />

      <header className="screen-heading page-heading">
        <p className="eyebrow">단어 시험지</p>
        <h1>단어장 선택</h1>
      </header>

      <div className="book-grid">
        <button
          className="book-card"
          type="button"
          onClick={() => onNavigate('onlyoneMenu')}
        >
          <span className="book-card-top">
            <span className="book-title">온리원보카</span>
            <span className="status-tag status-tag-active">사용 가능</span>
          </span>

          <span className="book-stat-line">
            <strong>{TOTAL_WORDS.toLocaleString('ko-KR')}</strong>개 단어
            <span className="separator">·</span>
            <strong>{DAY_ENTRIES.length}</strong> Day
          </span>

          <span className="book-card-bottom">
            <span>열기</span>
            <span className="arrow">→</span>
          </span>
        </button>

        <button
          className="book-card"
          type="button"
          onClick={() => onNavigate('neungyul')}
        >
          <span className="book-card-top">
            <span className="book-title">능률 VOCA</span>
            <span className="status-tag">자료 준비 중</span>
          </span>

          <span className="book-stat-line">단어 자료 미연결</span>

          <span className="book-card-bottom">
            <span>열기</span>
            <span className="arrow">→</span>
          </span>
        </button>
      </div>
    </section>
  )
}

function OnlyoneMenuPage({ onNavigate }) {
  return (
    <section>
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: () => onNavigate('home') },
          { label: '단어 시험지', onClick: () => onNavigate('books') },
          { label: '온리원보카' },
        ]}
      />

      <header className="screen-heading page-heading">
        <p className="eyebrow">온리원보카</p>
        <h1>출제 방식 선택</h1>
      </header>

      <div className="tool-grid">
        <button
          className="tool-card"
          type="button"
          onClick={() => onNavigate('single')}
        >
          <span>
            <strong>개인 단어 시험지</strong>
            <span>한 사람의 Day 범위와 문항 수 설정</span>
          </span>
          <span className="tool-arrow">→</span>
        </button>

        <button
          className="tool-card"
          type="button"
          onClick={() => onNavigate('batch')}
        >
          <span>
            <strong>여러 명 단어 선택</strong>
            <span>학생별 이름과 Day 설정 후 한 번에 인쇄</span>
          </span>
          <span className="tool-arrow">→</span>
        </button>
      </div>
    </section>
  )
}

function NeungyulPage({ onNavigate }) {
  return (
    <section>
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: () => onNavigate('home') },
          { label: '단어 시험지', onClick: () => onNavigate('books') },
          { label: '능률 VOCA' },
        ]}
      />

      <header className="screen-heading page-heading">
        <p className="eyebrow">능률 VOCA</p>
        <h1>자료 준비 중</h1>
      </header>

      <div className="notice-panel">능률 VOCA 단어 자료 미연결</div>
    </section>
  )
}

function ModeToggle({ value, onChange, prefix = 'day-mode' }) {
  return (
    <div
      className="mode-toggle"
      role="group"
      aria-label="Day 선택 방식"
    >
      <button
        className="mode-toggle-button"
        type="button"
        aria-pressed={value === 'range'}
        onClick={() => onChange('range')}
        id={`${prefix}-range`}
      >
        연속 범위
      </button>

      <button
        className="mode-toggle-button"
        type="button"
        aria-pressed={value === 'individual'}
        onClick={() => onChange('individual')}
        id={`${prefix}-individual`}
      >
        개별 선택
      </button>
    </div>
  )
}

function DaySelectionList({
  days,
  selectedDayNames,
  mode,
  anchorIndex,
  onToggle,
  onRangeScroll,
  className = '',
  ariaLabel = 'Day 목록',
}) {
  const listRef = useRef(null)

  function handleScroll(event) {
    if (mode !== 'range' || anchorIndex === null || !onRangeScroll) {
      return
    }

    const targetIndex = getScrollTargetIndex(
      event.currentTarget,
      '.day-option',
    )

    if (targetIndex !== null) {
      onRangeScroll(targetIndex)
    }
  }

  return (
    <div
      className={`day-list ${className}`}
      ref={listRef}
      onScroll={handleScroll}
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {days.map((day, index) => {
        const checked = selectedDayNames.has(day.name)

        return (
          <label
            className={`day-option ${checked ? 'selected' : ''}`}
            key={day.name}
            data-day-index={index}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) =>
                onToggle(day.name, index, event.target.checked)
              }
              aria-label={formatDayName(day.name)}
            />

            <span className="day-option-name">
              {formatDayName(day.name)}
            </span>

            <span className="day-option-count">
              {day.words.length.toLocaleString('ko-KR')}개
            </span>
          </label>
        )
      })}
    </div>
  )
}

function PageRangeTools({
  mode,
  onModeChange,
  onSelectAll,
  onClear,
  selectedLabel,
  helperText,
  selectedDayCount,
  selectedWordCount,
  days,
  selectedDayNames,
  anchorIndex,
  onToggleDay,
  onRangeScroll,
  listLabel = '출제할 Day',
}) {
  return (
    <aside className="card day-card">
      <div className="card-heading-row">
        <h2 className="card-title">{listLabel}</h2>

        <div className="mini-actions">
          <button
            className="mini-button"
            type="button"
            onClick={onSelectAll}
          >
            전체
          </button>

          <button
            className="mini-button"
            type="button"
            onClick={onClear}
          >
            해제
          </button>
        </div>
      </div>

      <ModeToggle value={mode} onChange={onModeChange} />

      <p className="mode-helper">{helperText}</p>

      <div className="mode-state" aria-live="polite">
        <strong>
          {mode === 'range' ? '연속 범위' : '개별 선택'}
        </strong>
        <span>{selectedLabel}</span>
      </div>

      <DaySelectionList
        days={days}
        selectedDayNames={selectedDayNames}
        mode={mode}
        anchorIndex={anchorIndex}
        onToggle={onToggleDay}
        onRangeScroll={onRangeScroll}
      />

      <div className="selection-summary">
        <strong>{selectedDayCount}개 Day</strong>
        <span>{selectedWordCount.toLocaleString('ko-KR')}개 단어</span>
      </div>
    </aside>
  )
}

function QuestionGrid({ questions, showAnswers }) {
  const rowsPerColumn = Math.ceil(questions.length / 2)
  const columns = [
    questions.slice(0, rowsPerColumn),
    questions.slice(rowsPerColumn),
  ]

  const gridHeight = Math.min(
    265,
    Math.max(10.6, rowsPerColumn * 10.6),
  )

  return (
    <div
      className="question-grid"
      style={{ height: `${gridHeight}mm` }}
    >
      {columns.map((column, columnIndex) => (
        <div
          className="question-column"
          key={columnIndex}
          style={{
            gridTemplateRows: column.length
              ? `repeat(${column.length}, minmax(0, 1fr))`
              : 'none',
          }}
        >
          {column.map((question) => (
            <div
              className="question-row"
              key={`${question.dayName}-${question.id}-${question.number}`}
            >
              <div className="question-number">{question.number}</div>

              <div className="question-prompt">{question.prompt}</div>

              <div
                className={`question-answer ${
                  showAnswers ? 'filled-answer' : ''
                }`}
              >
                {showAnswers ? question.answer : ''}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function PrintablePage({ documentInfo }) {
  const {
    type,
    studentName,
    dayNames,
    direction,
    order,
    questions,
    pageIndex,
    pageCount,
    breakAfter,
  } = documentInfo

  const firstNumber = questions[0]?.number ?? 0
  const lastNumber = questions[questions.length - 1]?.number ?? 0
  const isAnswer = type === 'answer'

  const title = isAnswer
    ? '단어 시험 정답지'
    : '단어 시험지'

  const orderLabel =
    order === 'random' ? '랜덤' : 'Day 순서대로'

  const directionLabel =
    direction === 'en-ko'
      ? '영어 → 한국어 뜻'
      : '한국어 뜻 → 영어'

  const subtitle =
    `${getDaySummary(dayNames)} · ${orderLabel} · ` +
    `${directionLabel} · ${firstNumber}–${lastNumber}번`

  const instruction =
    direction === 'en-ko'
      ? '영어 단어를 보고 한국어 뜻을 쓰세요.'
      : '한국어 뜻을 보고 영어를 쓰세요.'

  return (
    <article
      className={`print-page ${
        isAnswer ? 'answer-page' : 'exam-page'
      } ${breakAfter ? 'page-break-after' : 'page-break-last'}`}
    >
      <header className="paper-header">
        <div className="paper-title">
          {title} ({pageIndex + 1}/{pageCount})
        </div>

        <div className="paper-subtitle">{subtitle}</div>

        <div className="paper-student-info">
          {studentName ? (
            <span>
              이름 <strong>{studentName}</strong>
            </span>
          ) : (
            <span className="blank-student-name">
              이름 <i />
            </span>
          )}

          {!isAnswer && (
            <span className="blank-date">
              날짜 <i />
            </span>
          )}
        </div>
      </header>

      <QuestionGrid questions={questions} showAnswers={isAnswer} />

      <div className="paper-note">
        {isAnswer ? '정답지' : instruction} · {firstNumber}–{lastNumber}번
      </div>
    </article>
  )
}

function PrintArea({ documents }) {
  if (documents.length === 0) return null

  return (
    <section className="print-area" id="printArea" aria-label="시험지 인쇄 미리보기">
      {documents.map((documentInfo, index) => (
        <PrintablePage
          key={`${documentInfo.studentId}-${documentInfo.type}-${documentInfo.pageIndex}-${index}`}
          documentInfo={documentInfo}
        />
      ))}
    </section>
  )
}

function SingleExamPage({ onNavigate, documents, onDocumentsChange }) {
  const [selection, setSelection] = useState(() => ({
    dayNames: FIRST_DAY_NAME ? [FIRST_DAY_NAME] : [],
    mode: 'range',
    anchorIndex: FIRST_DAY_NAME ? 0 : null,
  }))

  const [direction, setDirection] = useState('en-ko')
  const [order, setOrder] = useState('random')
  const [questionCount, setQuestionCount] = useState(
    String(QUESTIONS_PER_PAGE),
  )
  const [status, setStatus] = useState(
    FIRST_DAY_NAME ? 'Day 1 선택' : 'Day 자료가 없습니다.',
  )
  const [statusType, setStatusType] = useState('')

  const selectedDayNames = useMemo(
    () => new Set(selection.dayNames),
    [selection.dayNames],
  )

  const selectedDays = DAY_ENTRIES.filter((day) =>
    selectedDayNames.has(day.name),
  )

  const selectedWords = useMemo(
    () =>
      selectedDays.flatMap((day) =>
        day.words.map((word) => ({
          ...word,
          dayName: day.name,
        })),
      ),
    [selectedDayNames],
  )

  const maximumQuestions = selectedWords.length

  useEffect(() => {
    if (maximumQuestions === 0) return

    setQuestionCount((current) =>
      normalizeQuestionCount(current, maximumQuestions),
    )
  }, [maximumQuestions])

  function clearOutput() {
    onDocumentsChange([])
  }

  function showStatus(message, type = '') {
    setStatus(message)
    setStatusType(type)
  }

  function handleToggleDay(dayName, dayIndex, isChecked) {
    clearOutput()

    setSelection((current) => {
      if (current.mode === 'range') {
        if (isChecked) {
          return {
            ...current,
            dayNames: [dayName],
            anchorIndex: dayIndex,
          }
        }

        return {
          ...current,
          dayNames: current.dayNames.filter((name) => name !== dayName),
          anchorIndex: null,
        }
      }

      const nextNames = new Set(current.dayNames)

      if (isChecked) {
        nextNames.add(dayName)
      } else {
        nextNames.delete(dayName)
      }

      return {
        ...current,
        dayNames: getOrderedDayNames([...nextNames]),
      }
    })

    showStatus(
      selection.mode === 'range'
        ? isChecked
          ? `${formatDayName(dayName)}에서 범위 선택 시작`
          : 'Day 선택 해제'
        : `${formatDayName(dayName)} 개별 선택 변경`,
    )
  }

  function handleRangeScroll(targetIndex) {
    if (selection.anchorIndex === null) return

    const nextNames = makeRangeDayNames(
      selection.anchorIndex,
      targetIndex,
    )

    if (
      nextNames.length === selection.dayNames.length &&
      nextNames.every((name, index) => name === selection.dayNames[index])
    ) {
      return
    }

    setSelection((current) => ({
      ...current,
      dayNames: nextNames,
    }))

    clearOutput()
    showStatus(`연속 범위 · ${getDaySummary(nextNames)}`)
  }

  function changeMode(nextMode) {
    if (selection.mode === nextMode) return

    clearOutput()

    setSelection((current) => {
      if (nextMode === 'individual') {
        return {
          ...current,
          mode: 'individual',
          anchorIndex: null,
        }
      }

      const firstSelectedIndex = DAY_ENTRIES.findIndex((day) =>
        current.dayNames.includes(day.name),
      )

      return {
        ...current,
        mode: 'range',
        anchorIndex: firstSelectedIndex >= 0 ? firstSelectedIndex : null,
      }
    })

    showStatus(
      nextMode === 'range'
        ? '연속 범위 모드 · 시작 Day를 선택하세요.'
        : '개별 선택 모드 · 선택된 Day는 유지됩니다.',
    )
  }

  function selectAllDays() {
    const allNames = DAY_ENTRIES.map((day) => day.name)

    setSelection({
      dayNames: allNames,
      mode: 'individual',
      anchorIndex: null,
    })

    setQuestionCount(
      normalizeQuestionCount(questionCount, getWordCountForDays(allNames)),
    )

    clearOutput()
    showStatus('전체 Day 선택 · 개별 선택 모드')
  }

  function clearAllDays() {
    setSelection((current) => ({
      ...current,
      dayNames: [],
      anchorIndex: null,
    }))

    clearOutput()
    showStatus('선택된 Day가 없습니다.')
  }

  function handleGenerate() {
    if (selectedWords.length === 0) {
      clearOutput()
      showStatus('출제할 Day를 하나 이상 선택하세요.', 'error')
      return
    }

    const questions = makeQuestions(
      selectedWords,
      questionCount,
      direction,
      order,
    )

    const nextDocuments = makePrintDocuments(
      [
        {
          studentId: 'single',
          studentName: '',
          dayNames: selection.dayNames,
          direction,
          order,
          questions,
        },
      ],
      true,
    )

    setQuestionCount(String(questions.length))
    onDocumentsChange(nextDocuments)
    showStatus(`${questions.length.toLocaleString('ko-KR')}문항 시험지 생성 완료`, 'success')

    window.setTimeout(() => {
      document.getElementById('printArea')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  function handleQuestionCountChange(event) {
    setQuestionCount(event.target.value)
    clearOutput()
  }

  function handleQuestionCountBlur() {
    setQuestionCount((current) =>
      normalizeQuestionCount(current, maximumQuestions),
    )
  }

  return (
    <section className="view-section">
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: () => onNavigate('home') },
          { label: '단어 시험지', onClick: () => onNavigate('books') },
          {
            label: '온리원보카',
            onClick: () => onNavigate('onlyoneMenu'),
          },
          { label: '개인 단어 시험지' },
        ]}
      />

      <header className="page-heading page-heading-with-meta">
        <div>
          <p className="eyebrow">온리원보카</p>
          <h1>개인 단어 시험지</h1>
        </div>

        <div className="book-meta">
          <strong>{TOTAL_WORDS.toLocaleString('ko-KR')}</strong>
          <span>단어</span>
          <span className="separator">·</span>
          <strong>{DAY_ENTRIES.length}</strong>
          <span>Day</span>
        </div>
      </header>

      <div className="workspace">
        <PageRangeTools
          mode={selection.mode}
          onModeChange={changeMode}
          onSelectAll={selectAllDays}
          onClear={clearAllDays}
          selectedLabel={getDaySummary(selection.dayNames)}
          helperText={
            selection.mode === 'range'
              ? '시작 Day를 체크한 뒤 목록을 스크롤하면 상단 Day까지 선택됩니다.'
              : '체크한 Day만 선택됩니다. 스크롤해도 선택은 바뀌지 않습니다.'
          }
          selectedDayCount={selectedDays.length}
          selectedWordCount={selectedWords.length}
          days={DAY_ENTRIES}
          selectedDayNames={selectedDayNames}
          anchorIndex={selection.anchorIndex}
          onToggleDay={handleToggleDay}
          onRangeScroll={handleRangeScroll}
        />

        <section className="card settings-card">
          <div className="settings-heading">
            <div>
              <h2>시험지 설정</h2>
              <p>출제 범위와 문항 수를 확인하세요.</p>
            </div>
            <span className="data-badge">
              {DAY_ENTRIES.length > 0 ? '자료 연결됨' : '자료 없음'}
            </span>
          </div>

          <div className="scope-summary">
            <div>
              <span className="field-caption">출제 범위</span>
              <strong>{getDaySummary(selection.dayNames)}</strong>
            </div>
            <div className="scope-word-count">
              <strong>{selectedWords.length.toLocaleString('ko-KR')}</strong>
              <span>단어</span>
            </div>
          </div>

          <div className="settings-grid">
            <label className="field" htmlFor="single-direction">
              출제 방향
              <select
                id="single-direction"
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value)
                  clearOutput()
                }}
              >
                <option value="en-ko">영어 → 한국어 뜻</option>
                <option value="ko-en">한국어 뜻 → 영어</option>
              </select>
            </label>

            <label className="field" htmlFor="single-order">
              출제 순서
              <select
                id="single-order"
                value={order}
                onChange={(event) => {
                  setOrder(event.target.value)
                  clearOutput()
                }}
              >
                <option value="random">랜덤</option>
                <option value="sequential">Day 순서대로</option>
              </select>
            </label>

            <label className="field" htmlFor="single-question-count">
              문항 수 · 기본 50
              <input
                id="single-question-count"
                type="number"
                min="1"
                max={maximumQuestions || undefined}
                value={questionCount}
                onChange={handleQuestionCountChange}
                onBlur={handleQuestionCountBlur}
              />
            </label>

            <div className="field">
              페이지 구성
              <div className="field-static">
                {QUESTIONS_PER_PAGE}문항 / 페이지
              </div>
            </div>
          </div>

          <div className="action-row">
            <button
              className="button button-primary"
              type="button"
              onClick={handleGenerate}
            >
              시험지 만들기
            </button>

            <button
              className="button button-secondary"
              type="button"
              disabled={documents.length === 0}
              onClick={() => window.print()}
            >
              인쇄 / PDF
            </button>

            <span className="action-summary">
              최대 {maximumQuestions.toLocaleString('ko-KR')}문항
            </span>
          </div>

          <p className={`status-message ${statusType}`} role="status">
            {status}
          </p>
        </section>
      </div>

      <PreviewStatus documents={documents} />
    </section>
  )
}

function PreviewStatus({ documents }) {
  const examPages = documents.filter(
    (documentInfo) => documentInfo.type === 'exam',
  ).length
  const answerPages = documents.filter(
    (documentInfo) => documentInfo.type === 'answer',
  ).length

  return (
    <section className="preview-status">
      <div>
        <h2>시험지 미리보기</h2>
        <p>
          {documents.length === 0
            ? '시험지를 만들면 아래에 전체 페이지가 표시됩니다.'
            : `시험지 ${examPages}쪽 · 정답지 ${answerPages}쪽`}
        </p>
      </div>
    </section>
  )
}

function DayPickerDialog({
  days,
  student,
  onCancel,
  onApply,
}) {
  const [mode, setMode] = useState(student.selectionMode ?? 'range')

  const [selectedDayNames, setSelectedDayNames] = useState(
    () => new Set(getOrderedDayNames(student.dayNames)),
  )

  const [anchorIndex, setAnchorIndex] = useState(() => {
    if ((student.selectionMode ?? 'range') !== 'range') return null

    const savedAnchor = student.anchorDayName
      ? days.findIndex((day) => day.name === student.anchorDayName)
      : -1

    if (savedAnchor >= 0) return savedAnchor

    return days.findIndex((day) => student.dayNames.includes(day.name))
  })

  const selectedDays = days.filter((day) =>
    selectedDayNames.has(day.name),
  )

  const selectedWordCount = selectedDays.reduce(
    (total, day) => total + day.words.length,
    0,
  )

  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  function handleToggleDay(dayName, dayIndex, isChecked) {
    if (mode === 'range') {
      if (isChecked) {
        setAnchorIndex(dayIndex)
        setSelectedDayNames(new Set([dayName]))
      } else {
        setAnchorIndex(null)
        setSelectedDayNames((current) => {
          const next = new Set(current)
          next.delete(dayName)
          return next
        })
      }

      return
    }

    setSelectedDayNames((current) => {
      const next = new Set(current)

      if (isChecked) {
        next.add(dayName)
      } else {
        next.delete(dayName)
      }

      return new Set(getOrderedDayNames([...next]))
    })
  }

  function handleRangeScroll(targetIndex) {
    if (anchorIndex === null) return

    const names = makeRangeDayNames(anchorIndex, targetIndex)
    const nextSet = new Set(names)

    if (areSetsEqual(selectedDayNames, nextSet)) return

    setSelectedDayNames(nextSet)
  }

  function changeMode(nextMode) {
    if (nextMode === mode) return

    if (nextMode === 'individual') {
      setAnchorIndex(null)
      setMode('individual')
      return
    }

    const firstSelectedIndex = days.findIndex((day) =>
      selectedDayNames.has(day.name),
    )

    setAnchorIndex(firstSelectedIndex >= 0 ? firstSelectedIndex : null)
    setMode('range')
  }

  function selectAll() {
    setMode('individual')
    setAnchorIndex(null)
    setSelectedDayNames(new Set(days.map((day) => day.name)))
  }

  function clearSelection() {
    setAnchorIndex(null)
    setSelectedDayNames(new Set())
  }

  function applySelection() {
    const orderedNames = getOrderedDayNames([...selectedDayNames])

    onApply({
      dayNames: orderedNames,
      selectionMode: mode,
      anchorDayName:
        mode === 'range' && anchorIndex !== null
          ? days[anchorIndex]?.name ?? null
          : null,
    })
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="day-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="dialog-header">
          <div>
            <h2 id="day-dialog-title">학생 Day 선택</h2>
            <p>
              {student.name.trim() || '학생 이름 미입력'}
            </p>
          </div>

          <button
            className="dialog-close"
            type="button"
            onClick={onCancel}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="dialog-mode-row">
          <ModeToggle
            value={mode}
            onChange={changeMode}
            prefix="dialog-mode"
          />

          <div className="mini-actions">
            <button
              className="mini-button"
              type="button"
              onClick={selectAll}
            >
              전체
            </button>
            <button
              className="mini-button"
              type="button"
              onClick={clearSelection}
            >
              해제
            </button>
          </div>
        </div>

        <p className="dialog-helper">
          {mode === 'range'
            ? '시작 Day를 체크한 뒤 목록을 스크롤하면 상단 Day까지 선택됩니다.'
            : '체크한 Day만 선택됩니다. 스크롤해도 선택은 바뀌지 않습니다.'}
        </p>

        <DaySelectionList
          days={days}
          selectedDayNames={selectedDayNames}
          mode={mode}
          anchorIndex={anchorIndex}
          onToggle={handleToggleDay}
          onRangeScroll={handleRangeScroll}
          className="day-list-dialog"
          ariaLabel="학생의 Day 목록"
        />

        <footer className="dialog-footer">
          <span>
            {selectedDays.length}개 Day ·{' '}
            {selectedWordCount.toLocaleString('ko-KR')}개 단어
          </span>

          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onCancel}
            >
              취소
            </button>

            <button
              className="button button-primary"
              type="button"
              onClick={applySelection}
            >
              적용
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function BatchExamPage({ onNavigate, documents, onDocumentsChange }) {
  const [students, setStudents] = useState(() => [
    makeStudentRecord(1),
    makeStudentRecord(2),
  ])

  const [nextStudentId, setNextStudentId] = useState(3)
  const [activeStudentId, setActiveStudentId] = useState(null)
  const [direction, setDirection] = useState('en-ko')
  const [order, setOrder] = useState('random')
  const [includeAnswers, setIncludeAnswers] = useState(true)
  const [status, setStatus] = useState(
    '학생 이름과 각 학생의 Day 범위를 설정하세요.',
  )
  const [statusType, setStatusType] = useState('')

  const activeStudent = students.find(
    (student) => student.id === activeStudentId,
  )

  const totalQuestions = documents
    .filter((documentInfo) => documentInfo.type === 'exam')
    .reduce(
      (total, documentInfo) => total + documentInfo.questions.length,
      0,
    )

  const examPageCount = documents.filter(
    (documentInfo) => documentInfo.type === 'exam',
  ).length

  const answerPageCount = documents.filter(
    (documentInfo) => documentInfo.type === 'answer',
  ).length

  function showStatus(message, type = '') {
    setStatus(message)
    setStatusType(type)
  }

  function clearDocuments() {
    onDocumentsChange([])
  }

  function updateStudent(studentId, patch) {
    setStudents((current) =>
      current.map((student) =>
        student.id === studentId
          ? { ...student, ...patch }
          : student,
      ),
    )

    clearDocuments()
  }

  function addStudent() {
    const previous = students[students.length - 1]
    const newStudent = makeStudentRecord(nextStudentId, previous)

    setStudents((current) => [...current, newStudent])
    setNextStudentId((current) => current + 1)
    clearDocuments()

    showStatus('학생 항목을 추가했습니다.')
  }

  function removeStudent(studentId) {
    if (students.length <= 1) return

    setStudents((current) =>
      current.filter((student) => student.id !== studentId),
    )

    clearDocuments()
    showStatus('학생 항목을 삭제했습니다.')
  }

  function copyFirstStudentDays() {
    if (students.length < 2) return

    const firstStudent = students[0]
    const firstMaximum = getWordCountForDays(firstStudent.dayNames)

    setStudents((current) =>
      current.map((student, index) =>
        index === 0
          ? student
          : {
              ...student,
              dayNames: [...firstStudent.dayNames],
              selectionMode: firstStudent.selectionMode,
              anchorDayName: firstStudent.anchorDayName,
              questionCount: normalizeQuestionCount(
                student.questionCount,
                firstMaximum,
              ),
            },
      ),
    )

    clearDocuments()
    showStatus('첫 학생의 Day 범위를 나머지 학생에게 적용했습니다.')
  }

  function applyStudentDays(studentId, selection) {
    const dayNames = getOrderedDayNames(selection.dayNames)
    const maximum = getWordCountForDays(dayNames)

    setStudents((current) =>
      current.map((student) =>
        student.id === studentId
          ? {
              ...student,
              dayNames,
              selectionMode: selection.selectionMode,
              anchorDayName: selection.anchorDayName,
              questionCount: normalizeQuestionCount(
                student.questionCount,
                maximum,
              ),
            }
          : student,
      ),
    )

    setActiveStudentId(null)
    clearDocuments()
    showStatus('학생별 Day 범위를 적용했습니다.')
  }

  function handleGenerate() {
    if (DAY_ENTRIES.length === 0) {
      showStatus('온리원보카 자료를 찾지 못했습니다.', 'error')
      return
    }

    const missingName = students.find(
      (student) => !student.name.trim(),
    )

    if (missingName) {
      showStatus('학생 이름을 모두 입력하세요.', 'error')
      document
        .querySelector(
          `[data-student-id="${missingName.id}"] .student-name-input`,
        )
        ?.focus()
      return
    }

    const missingDays = students.find(
      (student) => student.dayNames.length === 0,
    )

    if (missingDays) {
      showStatus(
        `${missingDays.name} 학생의 Day를 하나 이상 선택하세요.`,
        'error',
      )
      return
    }

    const groups = students.map((student) => {
      const selectedNames = new Set(student.dayNames)

      const words = DAY_ENTRIES
        .filter((day) => selectedNames.has(day.name))
        .flatMap((day) =>
          day.words.map((word) => ({
            ...word,
            dayName: day.name,
          })),
        )

      const questions = makeQuestions(
        words,
        student.questionCount,
        direction,
        order,
      )

      return {
        studentId: student.id,
        studentName: student.name.trim(),
        dayNames: getOrderedDayNames(student.dayNames),
        direction,
        order,
        questions,
      }
    })

    const nextDocuments = makePrintDocuments(
      groups,
      includeAnswers,
    )

    onDocumentsChange(nextDocuments)

    const answerText = includeAnswers
      ? ` · 정답지 ${nextDocuments.filter((item) => item.type === 'answer').length}쪽`
      : ''

    showStatus(
      `생성 완료 · ${students.length}명 · 시험지 ${examPageCountFrom(nextDocuments)}쪽${answerText}`,
      'success',
    )

    window.setTimeout(() => {
      document.getElementById('printArea')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  const batchPreviewText =
    documents.length > 0
      ? `${students.length}명 · 시험지 ${examPageCount}쪽${
          includeAnswers ? ` · 정답지 ${answerPageCount}쪽` : ''
        } · 총 ${totalQuestions.toLocaleString('ko-KR')}문항`
      : '미리보기 없음'

  return (
    <section className="view-section">
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: () => onNavigate('home') },
          { label: '단어 시험지', onClick: () => onNavigate('books') },
          {
            label: '온리원보카',
            onClick: () => onNavigate('onlyoneMenu'),
          },
          { label: '여러 명 단어 선택' },
        ]}
      />

      <header className="page-heading page-heading-with-meta">
        <div>
          <p className="eyebrow">온리원보카</p>
          <h1>여러 명 단어 선택</h1>
        </div>

        <div className="book-meta">
          <strong>{TOTAL_WORDS.toLocaleString('ko-KR')}</strong>
          <span>단어</span>
          <span className="separator">·</span>
          <strong>{DAY_ENTRIES.length}</strong>
          <span>Day</span>
        </div>
      </header>

      <section className="card batch-card">
        <div className="settings-heading">
          <div>
            <h2>학생별 출제 목록</h2>
            <p>학생 이름·Day·문항 수를 설정하세요.</p>
          </div>

          <span className="data-badge">
            {DAY_ENTRIES.length > 0 ? '자료 연결됨' : '자료 없음'}
          </span>
        </div>

        <div className="batch-toolbar">
          <strong>학생 {students.length}명</strong>

          <div className="toolbar-actions">
            <button
              className="mini-button"
              type="button"
              onClick={copyFirstStudentDays}
              disabled={students.length < 2}
            >
              첫 학생 Day 적용
            </button>

            <button
              className="mini-button mini-button-accent"
              type="button"
              onClick={addStudent}
            >
              ＋ 학생 추가
            </button>
          </div>
        </div>

        <div className="student-table-wrap">
          <table className="student-table">
            <thead>
              <tr>
                <th>학생 이름</th>
                <th>단어 목록 (Day)</th>
                <th>문항 수</th>
                <th>삭제</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student, index) => {
                const maximum = getWordCountForDays(student.dayNames)

                return (
                  <tr
                    key={student.id}
                    data-student-id={student.id}
                  >
                    <td>
                      <input
                        className="student-name-input"
                        type="text"
                        value={student.name}
                        placeholder={`학생 ${index + 1}`}
                        aria-label={`학생 ${index + 1} 이름`}
                        onChange={(event) =>
                          updateStudent(student.id, {
                            name: event.target.value,
                          })
                        }
                      />
                    </td>

                    <td>
                      <div className="student-day-cell">
                        <button
                          className="day-picker-button"
                          type="button"
                          onClick={() =>
                            setActiveStudentId(student.id)
                          }
                        >
                          <span>
                            {getDaySummary(student.dayNames)}
                          </span>
                          <span aria-hidden="true">⌄</span>
                        </button>

                        <span className="student-day-meta">
                          {student.selectionMode === 'range'
                            ? '연속 범위'
                            : '개별 선택'}
                          {' · '}
                          {maximum.toLocaleString('ko-KR')}개 단어
                        </span>
                      </div>
                    </td>

                    <td>
                      <input
                        className="question-count-input"
                        type="number"
                        min="1"
                        max={maximum || undefined}
                        value={student.questionCount}
                        aria-label={`학생 ${index + 1} 문항 수`}
                        onChange={(event) =>
                          updateStudent(student.id, {
                            questionCount: event.target.value,
                          })
                        }
                        onBlur={() =>
                          updateStudent(student.id, {
                            questionCount: normalizeQuestionCount(
                              student.questionCount,
                              maximum,
                            ),
                          })
                        }
                      />
                    </td>

                    <td className="remove-cell">
                      <button
                        className="remove-button"
                        type="button"
                        disabled={students.length <= 1}
                        aria-label={`학생 ${index + 1} 삭제`}
                        onClick={() => removeStudent(student.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="settings-grid batch-settings-grid">
          <label className="field" htmlFor="batch-direction">
            출제 방향
            <select
              id="batch-direction"
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value)
                clearDocuments()
              }}
            >
              <option value="en-ko">영어 → 한국어 뜻</option>
              <option value="ko-en">한국어 뜻 → 영어</option>
            </select>
          </label>

          <label className="field" htmlFor="batch-order">
            출제 순서
            <select
              id="batch-order"
              value={order}
              onChange={(event) => {
                setOrder(event.target.value)
                clearDocuments()
              }}
            >
              <option value="random">랜덤</option>
              <option value="sequential">Day 순서대로</option>
            </select>
          </label>

          <label className="answer-toggle">
            <input
              type="checkbox"
              checked={includeAnswers}
              onChange={(event) => {
                setIncludeAnswers(event.target.checked)
                clearDocuments()
              }}
            />
            시험지 뒤에 정답지 포함
          </label>

          <div className="field">
            페이지 구성
            <div className="field-static">
              {QUESTIONS_PER_PAGE}문항 / 페이지
            </div>
          </div>
        </div>

        <div className="action-row">
          <button
            className="button button-primary"
            type="button"
            onClick={handleGenerate}
          >
            전체 시험지 만들기
          </button>

          <button
            className="button button-secondary"
            type="button"
            disabled={documents.length === 0}
            onClick={() => window.print()}
          >
            한 번에 인쇄 / PDF
          </button>

          <span className="action-summary">{batchPreviewText}</span>
        </div>

        <p className={`status-message ${statusType}`} role="status">
          {status}
        </p>
      </section>

      <PreviewStatus documents={documents} />

      {activeStudent && (
        <DayPickerDialog
          key={activeStudent.id}
          days={DAY_ENTRIES}
          student={activeStudent}
          onCancel={() => setActiveStudentId(null)}
          onApply={(selection) =>
            applyStudentDays(activeStudent.id, selection)
          }
        />
      )}
    </section>
  )
}

function examPageCountFrom(documents) {
  return documents.filter(
    (documentInfo) => documentInfo.type === 'exam',
  ).length
}

function App() {
  const [view, setView] = useState('home')
  const [singleDocuments, setSingleDocuments] = useState([])
  const [batchDocuments, setBatchDocuments] = useState([])

  function navigate(nextView) {
    setView(nextView)
  }

  function goHome() {
    setView('home')
  }

  function goBack() {
    const backView = {
      books: 'home',
      onlyoneMenu: 'books',
      neungyul: 'books',
      single: 'onlyoneMenu',
      batch: 'onlyoneMenu',
    }

    setView(backView[view] ?? 'home')
  }

  const currentPrintDocuments =
    view === 'single'
      ? singleDocuments
      : view === 'batch'
        ? batchDocuments
        : []

  return (
    <div className="app">
      <SiteHeader
        view={view}
        onHome={goHome}
        onBack={goBack}
      />

      <main className="app-main">
        {view === 'home' && (
          <MenuHome
            onOpen={(item) => {
              if (item === 'books') navigate('books')
            }}
          />
        )}

        {view === 'books' && (
          <BookSelectPage onNavigate={navigate} />
        )}

        {view === 'onlyoneMenu' && (
          <OnlyoneMenuPage onNavigate={navigate} />
        )}

        {view === 'neungyul' && (
          <NeungyulPage onNavigate={navigate} />
        )}

        {view === 'single' && (
          <SingleExamPage
            onNavigate={navigate}
            documents={singleDocuments}
            onDocumentsChange={setSingleDocuments}
          />
        )}

        {view === 'batch' && (
          <BatchExamPage
            onNavigate={navigate}
            documents={batchDocuments}
            onDocumentsChange={setBatchDocuments}
          />
        )}
      </main>

      {currentPrintDocuments.length > 0 && (
        <PrintArea documents={currentPrintDocuments} />
      )}

<footer className="site-footer screen-only">
  {view !== 'home' && (
    <span className="footer-context">
      온리원보카 · {DAY_ENTRIES.length} Day
    </span>
  )}

  <p className="footer-contact">
    문의 사항이 있으시면{' '}
    <a
      href="https://www.instagram.com/sashimigongju/"
      target="_blank"
      rel="noreferrer"
    >
      인스타그램 @sashimigongju
    </a>
    {' / '}
    <a href="mailto:happytogether39@naver.com">
      happytogether39@naver.com
    </a>
    {' 으로 연락 부탁드립니다.'}
  </p>

  <small className="site-signature">by @sashimigongju</small>
</footer>
    </div>
  )
}

export default App