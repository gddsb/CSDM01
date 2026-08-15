import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

export const U9_CONFIG = {
  baseUrl: process.env.U9_BASE_URL || 'http://120.79.24.179/U9/mvc',
  erpUrl: process.env.U9_ERP_URL || 'http://120.79.24.179/U9/erp/display.aspx',
  enterpriseId: process.env.U9_ENTERPRISE_ID || '01',
  enterpriseName: process.env.U9_ENTERPRISE_NAME || '大满包装',
  username: process.env.U9_USERNAME || '20021',
  password: process.env.U9_PASSWORD || '654321',
  orgCode: process.env.U9_ORG_CODE || '160',
  aesKeyHex: process.env.U9_AES_KEY || 'dad52b5719e3202e32a6619e14d0ccec',
};

export interface U9Org {
  ID: number;
  Code: string;
  Name: string;
}

export interface U9LoginResult {
  http: AxiosInstance;
  org: U9Org;
  cookies: string;
}

export type ProgressCallback = (message: string, percent: number) => Promise<void> | void;

/** MD5 工具 */
function md5Hex(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
}
function md5Digest(buf: Buffer): Buffer {
  return crypto.createHash('md5').update(buf).digest();
}

/** 计算 Password (MD5 方式) */
function computePassword(password: string, salt: string): string {
  // 1. UTF-16LE -> MD5 -> Base64
  const utf16le = Buffer.from(password, 'utf16le');
  const step1 = md5Digest(utf16le).toString('base64');
  // 2. MD5(step1 + salt) -> hex
  return md5Hex(Buffer.from(step1 + salt, 'utf-8'));
}

/** AES-ECB + PKCS7 加密（hex输出） */
function aesEcbEncryptHex(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(true); // PKCS7
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf-8')), cipher.final()]);
  return enc.toString('hex');
}

/**
 * 登录 U9 系统。
 * 使用 axios + 自定义 cookie 字符串（保持简单，无需 tough-cookie）
 */
export async function loginU9(onProgress?: ProgressCallback): Promise<U9LoginResult> {
  const u9 = U9_CONFIG;
  const baseURL = u9.baseUrl;

  const report = async (msg: string, pct: number) => {
    if (onProgress) await onProgress(msg, pct);
  };

  // 用 jar-like 方式：保存 cookie 字符串，拦截器统一携带
  let cookies = '';

  const http = axios.create({
    baseURL,
    timeout: 60_000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  const setCookiesFromResp = (respHeaders: any) => {
    const list = respHeaders?.['set-cookie'] || [];
    for (const item of list) {
      const m = /^([^=;]+)=([^;]*)/.exec(item);
      if (!m) continue;
      const [, name, value] = m;
      // 追加/替换
      const pairs = cookies.split('; ').filter(Boolean);
      const idx = pairs.findIndex((p) => p.startsWith(name + '='));
      const nv = `${name}=${value}`;
      if (idx >= 0) pairs[idx] = nv;
      else pairs.push(nv);
      cookies = pairs.join('; ');
    }
  };

  http.interceptors.request.use((cfg) => {
    if (cookies) {
      cfg.headers = (cfg.headers || {}) as any;
      // AxiosHeaders 实例用 set，普通对象直接赋值
      if (typeof (cfg.headers as any).set === 'function') {
        (cfg.headers as any).set('Cookie', cookies);
      } else {
        (cfg.headers as any).Cookie = cookies;
      }
    }
    return cfg;
  });
  http.interceptors.response.use((resp) => {
    setCookiesFromResp(resp.headers);
    return resp;
  });

  // Step 1
  await report('访问登录页面，获取初始 Cookie...', 10);
  await http.get('/login/index');

  // Step 2
  await report('调用 UserChange API，获取盐值与组织列表...', 25);
  const uc = await http.post('/Login/UserChange', new URLSearchParams({
    EnterpriseID: u9.enterpriseId,
    LanguageKey: '',
    UserName: u9.username,
    LoginType: 'Form',
    IsChange: 'true',
    mt: '',
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const ucData = uc.data as { PwdSalt: string; OrganizationInfo: { Organizations: U9Org[] } };
  const salt = ucData.PwdSalt;

  const targetOrg =
    ucData.OrganizationInfo.Organizations.find((o) => o.Code === u9.orgCode) ||
    ucData.OrganizationInfo.Organizations[0];
  if (!targetOrg) throw new Error('找不到目标组织');

  // Step 3
  await report('计算 MD5+AES 加密密码...', 50);
  const pwd = computePassword(u9.password, salt);
  const encPwd = aesEcbEncryptHex(`${u9.username}@@${u9.password}`, u9.aesKeyHex);

  // Step 4
  await report(`提交登录请求，组织: ${targetOrg.Name}...`, 80);
  const loginBody = new URLSearchParams({
    IsLogin: 'true',
    CertSN: '',
    LoginType: 'Form',
    Password: pwd,
    EncryptPassword: encPwd,
    UserName: u9.username,
    EnterpriseName: u9.enterpriseName,
    OrgName: targetOrg.Name,
    OrgID: String(targetOrg.ID),
    EnterpriseID: u9.enterpriseId,
    Language: 'zh-CN',
    ScreenSize: '1920x1080',
    ValidateCode: '',
    ManipulateDate: '',
    RemeberTime: '0',
    lurl: '',
    e: 'm',
    LoginTimes: '2',
  });
  const loginResp = await http.post('/login/login', loginBody.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const loginData = loginResp.data as { StatusCode?: string; Message?: string };
  if (loginData.StatusCode !== '200') {
    throw new Error(`登录失败: ${loginData.Message || JSON.stringify(loginData)}`);
  }

  await report(`登录成功，组织: ${targetOrg.Name}`, 100);
  return { http, org: targetOrg, cookies };
}
