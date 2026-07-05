import fs from 'fs'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  InternalHyperlink,
  BookmarkStart,
  BookmarkEnd,
} from 'docx'

const inputFile = process.argv[2] || '项目说明.md'
const outputFile = process.argv[3] || '项目说明.docx'

console.log(`正在读取: ${inputFile}`)

const markdownContent = fs.readFileSync(inputFile, 'utf-8')

const lines = markdownContent.split('\n')
const children = []
let inCodeBlock = false
let codeBuffer = []
let inTable = false
let tableBuffer = []
let headingBookmarks = new Map()

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getBookmarkId(text) {
  return slugify(text)
}

function parseInlineElements(text) {
  const elements = []
  const regex = /(\*\*.+?\*\*|`.+?`|\[.+?\]\(.+?\))/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }

    const content = match[1]

    if (content.startsWith('**')) {
      elements.push({ type: 'bold', content: content.slice(2, -2) })
    } else if (content.startsWith('`')) {
      elements.push({ type: 'code', content: content.slice(1, -1) })
    } else if (content.startsWith('[')) {
      const linkMatch = content.match(/^\[(.+?)\]\((.+?)\)$/)
      if (linkMatch) {
        const linkText = linkMatch[1]
        const linkUrl = linkMatch[2]
        if (linkUrl.startsWith('#')) {
          elements.push({ type: 'internalLink', text: linkText, target: linkUrl.slice(1) })
        } else {
          elements.push({ type: 'link', text: linkText, url: linkUrl })
        }
      } else {
        elements.push({ type: 'text', content })
      }
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    elements.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return elements
}

function elementsToRuns(elements, options = {}) {
  const runs = []
  for (const el of elements) {
    if (el.type === 'text') {
      runs.push(new TextRun({ text: el.content, ...options }))
    } else if (el.type === 'bold') {
      runs.push(new TextRun({ text: el.content, bold: true, ...options }))
    } else if (el.type === 'code') {
      runs.push(new TextRun({
        text: el.content,
        font: 'Consolas',
        size: 20,
        color: 'D32F2F',
        ...options,
      }))
    }
  }
  return runs
}

function createParagraphWithElements(elements, options = {}) {
  const children = []
  let simpleRuns = []

  for (const el of elements) {
    if (el.type === 'internalLink') {
      if (simpleRuns.length > 0) {
        children.push(...simpleRuns)
        simpleRuns = []
      }
      const bookmarkKey = el.target
      children.push(
        new InternalHyperlink({
          children: [new TextRun({ text: el.text, color: '2196F3' })],
          anchor: bookmarkKey,
        })
      )
    } else {
      if (el.type === 'text') {
        simpleRuns.push(new TextRun({ text: el.content }))
      } else if (el.type === 'bold') {
        simpleRuns.push(new TextRun({ text: el.content, bold: true }))
      } else if (el.type === 'code') {
        simpleRuns.push(new TextRun({
          text: el.content,
          font: 'Consolas',
          size: 20,
          color: 'D32F2F',
        }))
      }
    }
  }

  if (simpleRuns.length > 0) {
    children.push(...simpleRuns)
  }

  return new Paragraph({
    children,
    spacing: { before: 120, after: 120, line: 360 },
    ...options,
  })
}

function addHeading(text, level) {
  const headingLevel = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
  }[level] || HeadingLevel.HEADING_1

  const bookmarkId = getBookmarkId(text)

  const para = new Paragraph({
    heading: headingLevel,
    children: [
      new BookmarkStart(bookmarkId, bookmarkId),
      new TextRun({ text }),
      new BookmarkEnd(bookmarkId),
    ],
    spacing: { before: 240, after: 120 },
  })

  return para
}

function createTable(rows) {
  if (rows.length === 0) return null

  const headerRow = rows[0]
  const bodyRows = rows.slice(1)

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: headerRow.map(cell => new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: cell, bold: true, color: 'FFFFFF' })],
          alignment: AlignmentType.LEFT,
        }),
      ],
      shading: { fill: '2196F3' },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '1976D2' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '1976D2' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '1976D2' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '1976D2' },
      },
    })),
  })

  const tableBodyRows = bodyRows.map((row, idx) =>
    new TableRow({
      children: row.map(cell => {
        const elements = parseInlineElements(cell)
        return new TableCell({
          children: [
            new Paragraph({
              children: elementsToRuns(elements),
            }),
          ],
          shading: idx % 2 === 1 ? { fill: 'F5F5F5' } : undefined,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          },
        })
      }),
    })
  )

  return new Table({
    rows: [tableHeaderRow, ...tableBodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    spacing: { before: 120, after: 120 },
  })
}

function parseTableRow(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null

  const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())
  if (cells.every(c => /^-+$/.test(c) || /^:-+$/.test(c) || /^-+:$/.test(c) || /^:-+:$/.test(c))) return null

  return cells
}

function parseList(line) {
  const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.+)/)
  const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/)

  if (unorderedMatch) {
    const level = Math.floor(unorderedMatch[1].length / 2)
    return { type: 'unordered', level, text: unorderedMatch[2] }
  }
  if (orderedMatch) {
    const level = Math.floor(orderedMatch[1].length / 2)
    return { type: 'ordered', level, text: orderedMatch[3] }
  }
  return null
}

let listBuffer = []

function flushList() {
  if (listBuffer.length === 0) return

  for (const item of listBuffer) {
    const indent = item.level * 720
    const elements = parseInlineElements(item.text)
    const paraChildren = []

    paraChildren.push(new TextRun({ text: `${'  '.repeat(item.level)}•  ` }))

    for (const el of elements) {
      if (el.type === 'internalLink') {
        paraChildren.push(
          new InternalHyperlink({
            children: [new TextRun({ text: el.text, color: '2196F3' })],
            anchor: el.target,
          })
        )
      } else if (el.type === 'text') {
        paraChildren.push(new TextRun({ text: el.content }))
      } else if (el.type === 'bold') {
        paraChildren.push(new TextRun({ text: el.content, bold: true }))
      } else if (el.type === 'code') {
        paraChildren.push(new TextRun({
          text: el.content,
          font: 'Consolas',
          size: 20,
          color: 'D32F2F',
        }))
      }
    }

    children.push(
      new Paragraph({
        children: paraChildren,
        indent: { left: indent },
        spacing: { before: 60, after: 60, line: 320 },
      })
    )
  }
  listBuffer = []
}

console.log('正在解析 Markdown 并生成 Word 文档结构...')

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const trimmed = line.trim()

  if (trimmed.startsWith('```')) {
    if (!inCodeBlock) {
      inCodeBlock = true
      codeBuffer = []
    } else {
      inCodeBlock = false
      if (codeBuffer.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeBuffer.join('\n'),
                font: 'Consolas',
                size: 20,
              }),
            ],
            shading: { fill: 'FAFAFA' },
            border: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
            },
            spacing: { before: 120, after: 120 },
          })
        )
      }
      codeBuffer = []
    }
    continue
  }

  if (inCodeBlock) {
    codeBuffer.push(line)
    continue
  }

  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    const row = parseTableRow(line)
    if (row !== null) {
      inTable = true
      tableBuffer.push(row)
      continue
    } else if (inTable) {
      continue
    }
  } else if (inTable) {
    inTable = false
    const table = createTable(tableBuffer)
    if (table) children.push(table)
    tableBuffer = []
  }

  if (trimmed === '' || trimmed === '---') {
    flushList()
    continue
  }

  if (trimmed.startsWith('#')) {
    flushList()
    const level = trimmed.match(/^#+/)[0].length
    const text = trimmed.replace(/^#+\s*/, '')
    children.push(addHeading(text, level))
    continue
  }

  const listItem = parseList(trimmed)
  if (listItem) {
    listBuffer.push(listItem)
    continue
  } else {
    flushList()
  }

  if (trimmed.startsWith('>')) {
    const text = trimmed.replace(/^>\s*/, '')
    const elements = parseInlineElements(text)
    children.push(
      new Paragraph({
        children: elementsToRuns(elements),
        indent: { left: 360 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: '2196F3' },
        },
        shading: { fill: 'F0F7FF' },
        spacing: { before: 120, after: 120, line: 320 },
      })
    )
    continue
  }

  const elements = parseInlineElements(trimmed)
  children.push(createParagraphWithElements(elements))
}

flushList()

if (inTable && tableBuffer.length > 0) {
  const table = createTable(tableBuffer)
  if (table) children.push(table)
}

console.log('正在生成 Word 文档...')

const doc = new Document({
  sections: [
    {
      properties: {},
      children,
    },
  ],
  styles: {
    default: {
      document: {
        run: {
          font: 'Microsoft YaHei',
          size: 24,
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          size: 44,
          bold: true,
          color: '1A1A1A',
          font: 'Microsoft YaHei',
        },
        paragraph: {
          spacing: { before: 480, after: 240 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '2196F3' },
          },
        },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          size: 36,
          bold: true,
          color: '2196F3',
          font: 'Microsoft YaHei',
        },
        paragraph: {
          spacing: { before: 360, after: 180 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          },
        },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          size: 30,
          bold: true,
          color: '333333',
          font: 'Microsoft YaHei',
        },
        paragraph: {
          spacing: { before: 280, after: 140 },
        },
      },
      {
        id: 'Heading4',
        name: 'Heading 4',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          size: 26,
          bold: true,
          color: '555555',
          font: 'Microsoft YaHei',
        },
        paragraph: {
          spacing: { before: 240, after: 120 },
        },
      },
    ],
  },
})

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputFile, buffer)
  console.log(`✅ 转换完成！`)
  console.log(`输出文件: ${outputFile}`)
  const stats = fs.statSync(outputFile)
  console.log(`文件大小: ${(stats.size / 1024).toFixed(2)} KB`)
  console.log(`标题书签数量: ${headingBookmarks.size}`)
}).catch(err => {
  console.error('❌ 转换失败:', err)
  process.exit(1)
})
