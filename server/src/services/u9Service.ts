import crypto from 'crypto'
import axios, { AxiosInstance } from 'axios'

export interface U9Org {
  ID: number
  Code: string
  Name: string
}

export interface U9LoginConfig {
  baseUrl: string
  enterpriseId: string
  enterpriseName: string
  username: string
  password: string
  orgCode: string
  aesKeyHex: string
}

function md5Hex(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex')
}

function md5Digest(buf: Buffer): Buffer {
  return crypto.createHash('md5').update(buf).digest()
}

function computePassword(password: string, salt: string): string {
  const utf16le = Buffer.from(password, 'utf16le')
  const step1 = md5Digest(utf16le).toString('base64')
  return md5Hex(Buffer.from(step1 + salt, 'utf-8'))
}

function aesEcbEncryptHex(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null)
  cipher.setAutoPadding(true)
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf-8')), cipher.final()])
  return enc.toString('hex')
}

export async function fetchU9Orgs(cfg: U9LoginConfig): Promise<U9Org[]> {
  const baseURL = cfg.baseUrl
  let cookies = ''
  const http = axios.create({
    baseURL,
    timeout: 60_000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  })
  const setCookiesFromResp = (respHeaders: any) => {
    const list = respHeaders?.['set-cookie'] || []
    for (const item of list) {
      const m = /^([^=;]+)=([^;]*)/.exec(item)
      if (!m) continue
      const [, name, value] = m
      const pairs = cookies.split('; ').filter(Boolean)
      const idx = pairs.findIndex((p) => p.startsWith(name + '='))
      const nv = `${name}=${value}`
      if (idx >= 0) pairs[idx] = nv
      else pairs.push(nv)
      cookies = pairs.join('; ')
    }
  }
  http.interceptors.request.use((c) => {
    if (cookies) {
      c.headers = c.headers || {}
      if (typeof (c.headers as any).set === 'function') {
        (c.headers as any).set('Cookie', cookies)
      } else {
        (c.headers as any).Cookie = cookies
      }
    }
    return c
  })
  http.interceptors.response.use((resp) => {
    setCookiesFromResp(resp.headers)
    return resp
  })

  await http.get('/login/index')
  const uc = await http.post('/Login/UserChange', new URLSearchParams({
    EnterpriseID: cfg.enterpriseId,
    LanguageKey: '',
    UserName: cfg.username,
    LoginType: 'Form',
    IsChange: 'true',
    mt: '',
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const ucData = uc.data as { PwdSalt: string; OrganizationInfo: { Organizations: U9Org[] } }
  return ucData.OrganizationInfo?.Organizations || []
}

export const DEFAULT_U9_CONFIG: U9LoginConfig = {
  baseUrl: process.env.U9_BASE_URL || 'http://120.79.24.179/U9/mvc',
  enterpriseId: process.env.U9_ENTERPRISE_ID || '01',
  enterpriseName: process.env.U9_ENTERPRISE_NAME || '大满包装',
  username: process.env.U9_USERNAME || '20021',
  password: process.env.U9_PASSWORD || '654321',
  orgCode: process.env.U9_ORG_CODE || '160',
  aesKeyHex: process.env.U9_AES_KEY || 'dad52b5719e3202e32a6619e14d0ccec',
}
