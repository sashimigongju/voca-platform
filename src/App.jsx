import { useEffect, useMemo, useRef, useState } from 'react'
import onlyoneVoca from './data/onlyoneVoca.json'
import neunglyulWords from './data/neunglyul.json'
import neunglyulExtra from './data/neunglyulExtra.json'
import './App.css'

const QUESTIONS_PER_PAGE = 50

function toText(value) {
  if (value === false) return 'false'
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getDayNumber(name) {
  return Number(String(name).match(/\d+/)?.[0] ?? 0)
}

function formatDayName(name) {
  return String(name).replace(/^Day\s*(\d+)$/i, (_, number) => {
    return `Day ${String(number).padStart(2, '0')}`
  })
}

function makeOnlyoneEntries(data) {
  return Object.entries(data?.days ?? {})
    .filter(([name, words]) => Array.isArray(words) && /\d+/.test(name))
    .map(([name, words]) => ({
      name: formatDayName(name),
      words: words
        .map((item, index) => ({
          id: item?.id ?? item?.index ?? `${name}-${index + 1}`,
          word: toText(item?.word ?? item?.english),
          meaning: toText(item?.meaning ?? item?.korean),
        }))
        .filter((item) => item.word && item.meaning),
    }))
    .filter((entry) => entry.words.length > 0)
    .sort((a, b) => getDayNumber(a.name) - getDayNumber(b.name))
}

function makeNeunglyulEntries(words) {
  const groups = new Map()

  words.forEach((item, index) => {
    const category = item.day ?? item.category
    if (category === undefined || category === null) return

    const text = String(category).trim()
    const name = /^\d+$/.test(text)
      ? `Day ${text.padStart(2, '0')}`
      : text

    if (!groups.has(name)) groups.set(name, [])

    groups.get(name).push({
      id: `${name}-${item.no ?? index + 1}`,
      word: toText(item.english),
      meaning: toText(item.korean),
    })
  })

  return [...groups.entries()]
    .map(([name, groupWords]) => ({
      name,
      words: groupWords.filter((word) => word.word && word.meaning),
    }))
    .filter((entry) => entry.words.length > 0)
   .sort((a, b) => {
  const aIsDay = /^Day\s+\d+$/i.test(a.name)
  const bIsDay = /^Day\s+\d+$/i.test(b.name)

  // Day 분류를 일반 분류보다 앞에 둠
  if (aIsDay && !bIsDay) return -1
  if (!aIsDay && bIsDay) return 1

  // Day끼리는 숫자순
  if (aIsDay && bIsDay) {
    return getDayNumber(a.name) - getDayNumber(b.name)
  }

  // 일반 분류끼리는 JSON에 등장한 순서 유지
  return 0
})
}

const BOOKS = {
  onlyone: {
    id: 'onlyone',
    name: '온리원보카',
    entries: makeOnlyoneEntries(onlyoneVoca),
  },
  neunglyul: {
    id: 'neunglyul',
    name: '능률보카 표제어',
    entries: makeNeunglyulEntries([
      ...neunglyulWords,
      ...neunglyulExtra,
    ]),
  },
}

function countWords(entries) {
  return entries.reduce((total, entry) => total + entry.words.length, 0)
}

function getOrderedNames(names, entries) {
  const selected = new Set(names)
  return entries
    .filter((entry) => selected.has(entry.name))
    .map((entry) => entry.name)
}

function getSummary(names, entries) {
  const ordered = getOrderedNames(names, entries)
  if (ordered.length === 0) return '선택 없음'

  const allDays = ordered.every((name) => /^Day\s*\d+$/i.test(name))
  if (!allDays) {
    return ordered.length <= 3
      ? ordered.join(', ')
      : `${ordered.slice(0, 3).join(', ')} 외 ${ordered.length - 3}개`
  }

  const numbers = ordered.map(getDayNumber)
  const continuous = numbers.every(
    (number, index) => number === numbers[0] + index,
  )

  if (ordered.length === 1) return formatDayName(ordered[0])
  if (continuous) {
    return `${formatDayName(ordered[0])}–${formatDayName(
      ordered[ordered.length - 1],
    )}`
  }
  return ordered.length <= 5
    ? ordered.map(formatDayName).join(', ')
    : `${ordered.slice(0, 5).map(formatDayName).join(', ')} 외 ${
        ordered.length - 5
      }개 Day`
}

function getWordCount(names, entries) {
  const selected = new Set(names)
  return entries.reduce(
    (total, entry) =>
      selected.has(entry.name) ? total + entry.words.length : total,
    0,
  )
}

function makeRangeNames(startIndex, endIndex, entries) {
  const start = Math.min(startIndex, endIndex)
  const end = Math.max(startIndex, endIndex)
  return entries.slice(start, end + 1).map((entry) => entry.name)
}

function normalizeQuestionCount(value, maximum) {
  const parsed = Number.parseInt(value, 10)
  const requested =
    Number.isInteger(parsed) && parsed > 0 ? parsed : QUESTIONS_PER_PAGE
  return String(maximum > 0 ? Math.min(requested, maximum) : requested)
}

function makeStudent(id, entries, source = null) {
  const names =
    source?.names?.length > 0
      ? getOrderedNames(source.names, entries)
      : entries[0]
        ? [entries[0].name]
        : []

  return {
    id,
    name: '',
    names,
    mode: source?.mode ?? 'range',
    anchorName: source?.anchorName ?? names[0] ?? null,
    questionCount: normalizeQuestionCount(
      source?.questionCount ?? QUESTIONS_PER_PAGE,
      getWordCount(names, entries),
    ),
  }
}

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ]
  }
  return result
}

function splitPages(items) {
  const pages = []
  for (let index = 0; index < items.length; index += QUESTIONS_PER_PAGE) {
    pages.push(items.slice(index, index + QUESTIONS_PER_PAGE))
  }
  return pages
}

function makeQuestions(words, count, direction, order) {
  const requested = Number.parseInt(count, 10)
  const safeCount =
    Number.isInteger(requested) && requested > 0
      ? requested
      : QUESTIONS_PER_PAGE
  const selected = (order === 'random' ? shuffle(words) : [...words]).slice(
    0,
    Math.min(safeCount, words.length),
  )

  return selected.map((item, index) => ({
    ...item,
    number: index + 1,
    prompt: direction === 'en-ko' ? item.word : item.meaning,
    answer: direction === 'en-ko' ? item.meaning : item.word,
  }))
}

function makeDocuments(groups, entries, includeAnswers) {
  const exams = []
  const answers = []

  groups.forEach((group) => {
    splitPages(group.questions).forEach((questions, pageIndex, pages) => {
      const document = {
        ...group,
        questions,
        pageIndex,
        pageCount: pages.length,
        summary: getSummary(group.names, entries),
      }
      exams.push({ ...document, type: 'exam' })
      if (includeAnswers) answers.push({ ...document, type: 'answer' })
    })
  })

  return [...exams, ...answers].map((document, index, all) => ({
    ...document,
    breakAfter: index < all.length - 1,
  }))
}

function getScrollIndex(element) {
  const rows = [...element.querySelectorAll('.day-option')]
  if (rows.length === 0) return null
  if (
    element.scrollTop + element.clientHeight >=
    element.scrollHeight - 3
  ) {
    return Number(rows.at(-1).dataset.index)
  }
  const edge = element.getBoundingClientRect().top + 2
  const row = rows.find((item) => item.getBoundingClientRect().bottom > edge)
  return Number((row ?? rows[0]).dataset.index)
}

function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="현재 위치">
      {items.map((item, index) => (
        <span className="breadcrumb-item" key={`${item.label}-${index}`}>
          {index > 0 && <span className="breadcrumb-separator">/</span>}
          {item.onClick ? (
            <button className="breadcrumb-button" type="button" onClick={item.onClick}>
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

function SiteHeader({ title, onHome, onBack }) {
  return (
    <header className="site-header screen-only">
      <div className="site-header-inner">
        <button className="brand-button" type="button" onClick={onHome}>
          <span className="brand-mark">V</span>
          <span className="brand-name">VOCAB DESK</span>
        </button>
        <div className="header-location">{title}</div>
        <div className="header-actions">
          {onBack && (
            <button className="header-button" type="button" onClick={onBack}>
              ← 이전
            </button>
          )}
          <button className="header-button" type="button" onClick={onHome}>
            메뉴
          </button>
        </div>
      </div>
    </header>
  )
}

function MenuHome({ onOpen }) {
  return (
    <section className="home-screen">
      <header className="screen-heading">
        <p className="eyebrow">VOCAB DESK</p>
        <h1>메뉴</h1>
      </header>
      <div className="menu-grid">
        <button className="menu-card" type="button" onClick={onOpen}>
          <span className="menu-card-top">
            <span className="menu-icon">V</span>
            <span className="status-tag status-tag-active">사용 가능</span>
          </span>
          <span className="menu-card-title">단어 시험지</span>
          <span className="menu-card-bottom">
            <span>온리원보카 · 능률 VOCA</span>
            <span className="arrow">→</span>
          </span>
        </button>
      </div>
    </section>
  )
}

function BookSelectPage({ onHome, onSelect }) {
  return (
    <section>
      <Breadcrumbs
        items={[{ label: '메뉴', onClick: onHome }, { label: '단어 시험지' }]}
      />
      <header className="screen-heading page-heading">
        <p className="eyebrow">단어 시험지</p>
        <h1>단어장 선택</h1>
      </header>
      <div className="book-grid">
        {Object.values(BOOKS).map((book) => (
          <button
            className="book-card"
            type="button"
            key={book.id}
            onClick={() => onSelect(book.id)}
          >
            <span className="book-card-top">
              <span className="book-title">{book.name}</span>
              <span className="status-tag status-tag-active">사용 가능</span>
            </span>
            <span className="book-stat-line">
              <strong>{countWords(book.entries).toLocaleString('ko-KR')}</strong>
              개 단어 · <strong>{book.entries.length}</strong>개 분류
            </span>
            <span className="book-card-bottom">
              <span>열기</span>
              <span className="arrow">→</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function BookMenu({ book, onHome, onBooks, onOpen }) {
  return (
    <section>
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: onHome },
          { label: '단어 시험지', onClick: onBooks },
          { label: book.name },
        ]}
      />
      <header className="screen-heading page-heading">
        <p className="eyebrow">{book.name}</p>
        <h1>출제 방식 선택</h1>
      </header>
      <div className="tool-grid">
        <button className="tool-card" type="button" onClick={() => onOpen('single')}>
          <span>
            <strong>개인 단어 시험지</strong>
            <span>분류 범위와 문항 수 설정</span>
          </span>
          <span className="tool-arrow">→</span>
        </button>
        <button className="tool-card" type="button" onClick={() => onOpen('batch')}>
          <span>
            <strong>여러 명 단어 선택</strong>
            <span>학생별 분류 설정 후 한 번에 인쇄</span>
          </span>
          <span className="tool-arrow">→</span>
        </button>
      </div>
    </section>
  )
}

function ModeToggle({ value, onChange }) {
  return (
    <div className="mode-toggle" role="group" aria-label="선택 방식">
      <button
        className="mode-toggle-button"
        type="button"
        aria-pressed={value === 'range'}
        onClick={() => onChange('range')}
      >
        연속 범위
      </button>
      <button
        className="mode-toggle-button"
        type="button"
        aria-pressed={value === 'individual'}
        onClick={() => onChange('individual')}
      >
        개별 선택
      </button>
    </div>
  )
}

function SelectionList({
  entries,
  selected,
  mode,
  onToggle,
  onRange,
  onDragStart,
}) {
  const draggingRef = useRef(false)

  useEffect(() => {
    function stopDragging() {
      draggingRef.current = false
    }

    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [])

  function handlePointerDown(event, entry, index) {
    if (mode !== 'range' || event.button !== 0 || !onDragStart) return

    draggingRef.current = true
    onDragStart(entry.name, index)
  }

  function handlePointerMove(event) {
    if (!draggingRef.current || mode !== 'range') return

    const row = event.target.closest('.day-option')
    if (!row) return

    const index = Number(row.dataset.index)
    if (Number.isInteger(index)) onRange(index)
  }

  return (
    <div
      className="day-list"
      tabIndex={0}
      onPointerMove={handlePointerMove}
    >
      {entries.map((entry, index) => {
        const checked = selected.has(entry.name)

        return (
          <label
            className={`day-option ${checked ? 'selected' : ''}`}
            key={entry.name}
            data-index={index}
            onPointerDown={(event) =>
              handlePointerDown(event, entry, index)
            }
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                if (mode === 'individual') {
                  onToggle(entry.name, index, event.target.checked)
                }
              }}
              aria-label={entry.name}
            />
            <span className="day-option-name">{entry.name}</span>
            <span className="day-option-count">
              {entry.words.length.toLocaleString('ko-KR')}개
            </span>
          </label>
        )
      })}
    </div>
  )
}

function QuestionGrid({ questions, showAnswers }) {
  const rows = Math.ceil(questions.length / 2)
  const columns = [questions.slice(0, rows), questions.slice(rows)]
  return (
    <div className="question-grid" style={{ height: `${Math.min(265, Math.max(10.6, rows * 10.6))}mm` }}>
      {columns.map((column, columnIndex) => (
        <div className="question-column" key={columnIndex}>
          {column.map((question) => (
            <div className="question-row" key={`${question.id}-${question.number}`}>
              <div className="question-number">{question.number}</div>
              <div className="question-prompt">{question.prompt}</div>
              <div className={`question-answer ${showAnswers ? 'filled-answer' : ''}`}>
                {showAnswers ? question.answer : ''}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function PrintablePage({ document }) {
  const first = document.questions[0]?.number ?? 0
  const last = document.questions.at(-1)?.number ?? 0
  const answer = document.type === 'answer'
  return (
    <article className={`print-page ${answer ? 'answer-page' : 'exam-page'} ${document.breakAfter ? 'page-break-after' : 'page-break-last'}`}>
      <header className="paper-header">
        <div className="paper-title">
          {answer ? '단어 시험 정답지' : '단어 시험지'} ({document.pageIndex + 1}/{document.pageCount})
        </div>
        <div className="paper-subtitle">
          {document.bookName} · {document.summary} · {document.order === 'random' ? '랜덤' : '순서대로'} · {first}–{last}번
        </div>
        <div className="paper-student-info">
          {document.studentName ? (
            <span>이름 <strong>{document.studentName}</strong></span>
          ) : (
            <span className="blank-student-name">이름 <i /></span>
          )}
          {!answer && <span className="blank-date">날짜 <i /></span>}
        </div>
      </header>
      <QuestionGrid questions={document.questions} showAnswers={answer} />
      <div className="paper-note">
        {answer
          ? '정답지'
          : document.direction === 'en-ko'
            ? '영어 단어를 보고 한국어 뜻을 쓰세요.'
            : '한국어 뜻을 보고 영어를 쓰세요.'}{' '}
        · {first}–{last}번
      </div>
    </article>
  )
}

function SingleExamPage({ book, documents, onChange, onHome, onBooks }) {
  const entries = book.entries
  const [selection, setSelection] = useState({
    names: entries[0] ? [entries[0].name] : [],
    mode: 'range',
    anchorIndex: entries.length ? 0 : null,
  })
  const [direction, setDirection] = useState('en-ko')
  const [order, setOrder] = useState('random')
  const [count, setCount] = useState(String(QUESTIONS_PER_PAGE))
  const [status, setStatus] = useState('')
  const selected = useMemo(() => new Set(selection.names), [selection.names])
  const words = useMemo(
    () =>
      entries
        .filter((entry) => selected.has(entry.name))
        .flatMap((entry) =>
          entry.words.map((word) => ({ ...word, dayName: entry.name })),
        ),
    [entries, selected],
  )

  useEffect(() => {
    setCount((current) => normalizeQuestionCount(current, words.length))
  }, [words.length])

  function toggle(name, index, checked) {
    onChange([])
    setSelection((current) => {
      if (current.mode === 'range') {
        return checked
          ? { ...current, names: [name], anchorIndex: index }
          : {
              ...current,
              names: current.names.filter((item) => item !== name),
              anchorIndex: null,
            }
      }
      const next = new Set(current.names)
      checked ? next.add(name) : next.delete(name)
      return { ...current, names: getOrderedNames([...next], entries) }
    })
  }

  function rangeTo(index) {
    if (selection.anchorIndex === null) return
    const names = makeRangeNames(selection.anchorIndex, index, entries)
    setSelection((current) => ({ ...current, names }))
    onChange([])
  }

  function generate() {
    if (!words.length) {
      setStatus('분류를 하나 이상 선택하세요.')
      return
    }
    const questions = makeQuestions(words, count, direction, order)
    onChange(
      makeDocuments(
        [
          {
            studentId: 'single',
            studentName: '',
            bookName: book.name,
            names: selection.names,
            direction,
            order,
            questions,
          },
        ],
        entries,
        true,
      ),
    )
    setCount(String(questions.length))
    setStatus(`${questions.length}문항 생성 완료`)
  }

  return (
    <section className="view-section">
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: onHome },
          { label: '단어 시험지', onClick: onBooks },
          { label: book.name, onClick: () => onBooks(book.id) },
          { label: '개인 단어 시험지' },
        ]}
      />
      <header className="page-heading">
        <p className="eyebrow">{book.name}</p>
        <h1>개인 단어 시험지</h1>
      </header>
      <div className="workspace">
        <aside className="card day-card">
          <ModeToggle
            value={selection.mode}
            onChange={(mode) => setSelection((current) => ({ ...current, mode }))}
          />
          <SelectionList
  entries={entries}
  selected={selected}
  mode={selection.mode}
  onToggle={toggle}
  onRange={rangeTo}
  onDragStart={(name, index) => {
    setSelection((current) => ({
      ...current,
      names: [name],
      anchorIndex: index,
    }))
    onChange([])
  }}
/>
          <div className="selection-summary">
            <strong>{selected.size}개 분류</strong>
            <span>{words.length.toLocaleString('ko-KR')}개 단어</span>
          </div>
        </aside>
        <section className="card settings-card">
          <div className="scope-summary">
            <strong>{getSummary(selection.names, entries)}</strong>
          </div>
          <div className="settings-grid">
            <label className="field">
              출제 방향
              <select value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="en-ko">영어 → 한국어 뜻</option>
                <option value="ko-en">한국어 뜻 → 영어</option>
              </select>
            </label>
            <label className="field">
              출제 순서
              <select value={order} onChange={(event) => setOrder(event.target.value)}>
                <option value="random">랜덤</option>
                <option value="sequential">분류 순서대로</option>
              </select>
            </label>
            <label className="field">
              문항 수
              <input
                type="number"
                min="1"
                max={words.length || undefined}
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </label>
          </div>
          <div className="action-row">
            <button className="button button-primary" type="button" onClick={generate}>
              시험지 만들기
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!documents.length}
              onClick={() => window.print()}
            >
              인쇄 / PDF
            </button>
          </div>
          <p className="status-message" role="status">{status}</p>
        </section>
      </div>
    </section>
  )
}

function BatchExamPage({ book, documents, onChange, onHome, onBooks }) {
  const entries = book.entries
  const [students, setStudents] = useState(() => [
    makeStudent(1, entries),
    makeStudent(2, entries),
  ])
  const [nextId, setNextId] = useState(3)
  const [activeId, setActiveId] = useState(null)
  const [direction, setDirection] = useState('en-ko')
  const [order, setOrder] = useState('random')
  const [includeAnswers, setIncludeAnswers] = useState(true)
  const [status, setStatus] = useState('')
  const active = students.find((student) => student.id === activeId)

  function update(id, patch) {
    setStudents((current) =>
      current.map((student) =>
        student.id === id ? { ...student, ...patch } : student,
      ),
    )
    onChange([])
  }

  function generate() {
    if (students.some((student) => !student.name.trim())) {
      setStatus('학생 이름을 모두 입력하세요.')
      return
    }
    if (students.some((student) => student.names.length === 0)) {
      setStatus('모든 학생의 분류를 선택하세요.')
      return
    }
    const groups = students.map((student) => {
      const selected = new Set(student.names)
      const words = entries
        .filter((entry) => selected.has(entry.name))
        .flatMap((entry) =>
          entry.words.map((word) => ({ ...word, dayName: entry.name })),
        )
      return {
        studentId: student.id,
        studentName: student.name.trim(),
        bookName: book.name,
        names: student.names,
        direction,
        order,
        questions: makeQuestions(
          words,
          student.questionCount,
          direction,
          order,
        ),
      }
    })
    onChange(makeDocuments(groups, entries, includeAnswers))
    setStatus(`${students.length}명 시험지 생성 완료`)
  }

  return (
    <section className="view-section">
      <Breadcrumbs
        items={[
          { label: '메뉴', onClick: onHome },
          { label: '단어 시험지', onClick: onBooks },
          { label: book.name, onClick: () => onBooks(book.id) },
          { label: '여러 명 단어 선택' },
        ]}
      />
      <header className="page-heading">
        <p className="eyebrow">{book.name}</p>
        <h1>여러 명 단어 선택</h1>
      </header>
      <section className="card batch-card">
        <button
          className="mini-button"
          type="button"
          onClick={() => {
            setStudents((current) => [
              ...current,
              makeStudent(nextId, entries, current.at(-1)),
            ])
            setNextId((current) => current + 1)
          }}
        >
          ＋ 학생 추가
        </button>
        <table className="student-table">
          <thead>
            <tr>
              <th>학생 이름</th>
              <th>분류</th>
              <th>문항 수</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.id}>
                <td>
                  <input
                    className="student-name-input"
                    value={student.name}
                    placeholder={`학생 ${index + 1}`}
                    onChange={(event) =>
                      update(student.id, { name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <button type="button" onClick={() => setActiveId(student.id)}>
                    {getSummary(student.names, entries)}
                  </button>
                </td>
                <td>
                  <input
                    className="question-count-input"
                    type="number"
                    min="1"
                    value={student.questionCount}
                    onChange={(event) =>
                      update(student.id, { questionCount: event.target.value })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={students.length <= 1}
                    onClick={() =>
                      setStudents((current) =>
                        current.filter((item) => item.id !== student.id),
                      )
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="settings-grid">
          <select value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="en-ko">영어 → 한국어 뜻</option>
            <option value="ko-en">한국어 뜻 → 영어</option>
          </select>
          <select value={order} onChange={(event) => setOrder(event.target.value)}>
            <option value="random">랜덤</option>
            <option value="sequential">분류 순서대로</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={includeAnswers}
              onChange={(event) => setIncludeAnswers(event.target.checked)}
            />
            정답지 포함
          </label>
        </div>
        <div className="action-row">
          <button className="button button-primary" type="button" onClick={generate}>
            전체 시험지 만들기
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={!documents.length}
            onClick={() => window.print()}
          >
            한 번에 인쇄 / PDF
          </button>
        </div>
        <p className="status-message">{status}</p>
      </section>
      {active && (
        <SelectionDialog
          entries={entries}
          student={active}
          onClose={() => setActiveId(null)}
          onApply={(names) => {
            update(active.id, { names })
            setActiveId(null)
          }}
        />
      )}
    </section>
  )
}

function SelectionDialog({ entries, student, onClose, onApply }) {
  const [mode, setMode] = useState('range')
  const [selected, setSelected] = useState(new Set(student.names))
  const [anchorIndex, setAnchorIndex] = useState(() => {
    const index = entries.findIndex((entry) =>
      student.names.includes(entry.name),
    )
    return index >= 0 ? index : null
  })

  function toggle(name, index, checked) {
    if (mode === 'range') {
      if (checked) {
        setAnchorIndex(index)
        setSelected(new Set([name]))
      } else {
        setAnchorIndex(null)
        setSelected((current) => {
          const next = new Set(current)
          next.delete(name)
          return next
        })
      }
      return
    }

    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  function selectRange(index) {
    if (anchorIndex === null) return
    setSelected(new Set(makeRangeNames(anchorIndex, index, entries)))
  }

  function startDrag(name, index) {
    setAnchorIndex(index)
    setSelected(new Set([name]))
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="day-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="selection-dialog-title"
      >
        <header className="dialog-header">
          <div>
            <h2 id="selection-dialog-title">학생 분류 선택</h2>
            <p>{student.name.trim() || '학생 이름 미입력'}</p>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <ModeToggle value={mode} onChange={setMode} />

        <SelectionList
          entries={entries}
          selected={selected}
          mode={mode}
          anchorIndex={anchorIndex}
          onToggle={toggle}
          onRange={selectRange}
          onDragStart={startDrag}
        />

        <footer className="dialog-footer">
          <span>
            {selected.size}개 분류 ·{' '}
            {getWordCount([...selected], entries).toLocaleString('ko-KR')}개 단어
          </span>
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onClose}
            >
              취소
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => onApply(getOrderedNames([...selected], entries))}
            >
              적용
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function App() {
  const [view, setView] = useState('home')
  const [bookId, setBookId] = useState('onlyone')
  const [documents, setDocuments] = useState({
    onlyone: { single: [], batch: [] },
    neunglyul: { single: [], batch: [] },
  })
  const book = BOOKS[bookId]
  const currentDocuments = documents[bookId]?.[view] ?? []

  function openBook(id) {
    setBookId(id)
    setView('menu')
  }

  function back() {
    if (view === 'books') setView('home')
    else if (view === 'menu') setView('books')
    else if (view === 'single' || view === 'batch') setView('menu')
  }

  return (
    <div className="app">
      <SiteHeader
        title={
          view === 'home'
            ? '메뉴'
            : view === 'books'
              ? '단어 시험지'
              : book.name
        }
        onHome={() => setView('home')}
        onBack={view === 'home' ? null : back}
      />
      <main className="app-main">
        {view === 'home' && <MenuHome onOpen={() => setView('books')} />}
        {view === 'books' && (
          <BookSelectPage onHome={() => setView('home')} onSelect={openBook} />
        )}
        {view === 'menu' && (
          <BookMenu
            book={book}
            onHome={() => setView('home')}
            onBooks={() => setView('books')}
            onOpen={setView}
          />
        )}
        {view === 'single' && (
          <SingleExamPage
            key={`${bookId}-single`}
            book={book}
            documents={documents[bookId].single}
            onChange={(next) =>
              setDocuments((current) => ({
                ...current,
                [bookId]: { ...current[bookId], single: next },
              }))
            }
            onHome={() => setView('home')}
            onBooks={openBook}
          />
        )}
        {view === 'batch' && (
          <BatchExamPage
            key={`${bookId}-batch`}
            book={book}
            documents={documents[bookId].batch}
            onChange={(next) =>
              setDocuments((current) => ({
                ...current,
                [bookId]: { ...current[bookId], batch: next },
              }))
            }
            onHome={() => setView('home')}
            onBooks={openBook}
          />
        )}
      </main>
      {currentDocuments.length > 0 && (
        <section className="print-area" id="printArea">
          {currentDocuments.map((document, index) => (
            <PrintablePage
              key={`${document.studentId}-${document.type}-${index}`}
              document={document}
            />
          ))}
        </section>
      )}
    </div>
  )
}

export default App