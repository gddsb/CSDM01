import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BookmarkStart,
  BookmarkEnd,
  InternalHyperlink,
} from 'docx'
import fs from 'fs'

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new BookmarkStart('h1', 'h1'),
          new TextRun({ text: '标题1' }),
          new BookmarkEnd('h1'),
        ],
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new BookmarkStart('h2', 'h2'),
          new TextRun({ text: '标题2' }),
          new BookmarkEnd('h2'),
        ],
      }),
      new Paragraph({
        children: [
          new InternalHyperlink({
            children: [new TextRun({ text: '跳转到标题1', color: '2196F3' })],
            anchor: 'h1',
          }),
        ],
      }),
    ],
  }],
})

const buf = await Packer.toBuffer(doc)
fs.writeFileSync('test_esm2.docx', buf)
console.log('File written')

import { execSync } from 'child_process'
execSync('rm -rf test_esm2_docx && mkdir test_esm2_docx && cd test_esm2_docx && unzip -o ../test_esm2.docx > /dev/null 2>&1')
const xml = fs.readFileSync('test_esm2_docx/word/document.xml', 'utf8')
console.log('BookmarkStart count:', (xml.match(/w:bookmarkStart/g) || []).length)
console.log('Hyperlink count:', (xml.match(/w:hyperlink/g) || []).length)

const names = xml.match(/w:name="[^"]*"/g)
console.log('Bookmark names:', names?.slice(0, 10))
