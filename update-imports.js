import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const updateImports = (dir) => {
  let count = 0
  const items = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      count += updateImports(fullPath)
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
      let content = fs.readFileSync(fullPath, 'utf-8')
      const oldContent = content
      
      content = content.replace(/from '([^']+\.jsx?)'/g, (match, p1) => {
        if (p1.startsWith('http://') || p1.startsWith('https://') || p1.startsWith('.')) {
          const newExt = p1.endsWith('.jsx') ? '.tsx' : '.ts'
          return `from '${p1.replace(/\.jsx?$/, newExt)}'`
        }
        return match
      })
      
      content = content.replace(/from "([^"]+\.jsx?)"/g, (match, p1) => {
        if (p1.startsWith('http://') || p1.startsWith('https://') || p1.startsWith('.')) {
          const newExt = p1.endsWith('.jsx') ? '.tsx' : '.ts'
          return `from "${p1.replace(/\.jsx?$/, newExt)}"`
        }
        return match
      })
      
      if (content !== oldContent) {
        fs.writeFileSync(fullPath, content, 'utf-8')
        count++
      }
    }
  }
  return count
}

console.log('=== Updating imports in frontend files ===')
const frontendCount = updateImports(path.join(__dirname, 'src'))

console.log('\n=== Updating imports in backend files ===')
const backendCount = updateImports(path.join(__dirname, 'server', 'src'))

console.log('\n=== Summary ===')
console.log(`Frontend: ${frontendCount} files updated`)
console.log(`Backend: ${backendCount} files updated`)
console.log(`Total: ${frontendCount + backendCount} files`)
