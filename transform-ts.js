import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const transformFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8')
  let newContent = content

  const ext = path.extname(filePath)
  const newExt = ext === '.jsx' ? '.tsx' : '.ts'
  const newPath = filePath.replace(new RegExp(ext + '$'), newExt)

  if (ext === '.jsx') {
    if (!newContent.includes('import React')) {
      if (newContent.includes('React.')) {
        newContent = "import React from 'react'\n" + newContent
      }
    }
  }

  fs.writeFileSync(newPath, newContent, 'utf-8')
  fs.unlinkSync(filePath)
  return { old: filePath, new: newPath }
}

const transformDir = (dir) => {
  const results = []
  const items = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      results.push(...transformDir(fullPath))
    } else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.jsx'))) {
      try {
        const result = transformFile(fullPath)
        results.push(result)
        console.log(`→ ${result.new}`)
      } catch (err) {
        console.error(`✗ ${fullPath}: ${err.message}`)
      }
    }
  }
  return results
}

console.log('=== Transforming frontend files ===')
const frontendResults = transformDir(path.join(__dirname, 'src'))

console.log('\n=== Transforming backend files ===')
const backendResults = transformDir(path.join(__dirname, 'server', 'src'))

console.log('\n=== Summary ===')
console.log(`Frontend: ${frontendResults.length} files transformed`)
console.log(`Backend: ${backendResults.length} files transformed`)
console.log(`Total: ${frontendResults.length + backendResults.length} files`)
