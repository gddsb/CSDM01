import 'dotenv/config';
import path from 'path';

export const config = {
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    dialect: (process.env.DB_DIALECT as 'sqlite' | 'mysql') || 'sqlite',
    storage: process.env.DB_STORAGE || './data/u9tasks.db',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'u9_tasks',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'u9-data-sync-secret',
    expiresIn: '24h',
  },

  u9: {
    baseUrl: process.env.U9_BASE_URL || 'http://120.79.24.179/U9/mvc',
    erpUrl: process.env.U9_ERP_URL || 'http://120.79.24.179/U9/erp/display.aspx',
    enterpriseId: process.env.U9_ENTERPRISE_ID || '01',
    enterpriseName: process.env.U9_ENTERPRISE_NAME || '大满包装',
    username: process.env.U9_USERNAME || '20021',
    password: process.env.U9_PASSWORD || '654321',
    orgCode: process.env.U9_ORG_CODE || '160',
    aesKeyHex: 'dad52b5719e3202e32a6619e14d0ccec',
  },

  outputDir: path.resolve(process.env.OUTPUT_DIR || './tmp_output'),
  dataDir: path.resolve('./data'),
};
