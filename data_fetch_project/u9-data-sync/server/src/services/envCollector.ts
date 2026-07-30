import { EnvMonitor } from '../models';

const BASE_URL = 'http://www.0531yun.com';

interface EnvConfig {
  loginName: string;
  password: string;
}

interface RealTimeDataItem {
  nodeId: number;
  registerItem: {
    registerId: number;
    registerName: string;
    data: string;
    value: number;
    alarmLevel: number;
    alarmColor: string;
    alarmInfo: string;
    unit: string;
  }[];
}

interface RealTimeDevice {
  systemCode: string;
  deviceAddr: number;
  deviceName: string;
  lat: number;
  lng: number;
  deviceStatus: string;
  relayStatus: string;
  dataItem: RealTimeDataItem[];
  timeStamp: number;
}

export class EnvCollector {
  private token: string | null = null;
  private tokenExpireAt: number = 0;
  private config: EnvConfig;

  constructor(config: EnvConfig) {
    this.config = config;
  }

  /** 获取或刷新Token */
  async ensureToken(): Promise<string | null> {
    const now = Date.now();
    if (this.token && this.tokenExpireAt > now + 60_000) {
      return this.token;
    }
    try {
      const url = `${BASE_URL}/api/getToken?loginName=${encodeURIComponent(this.config.loginName)}&password=${encodeURIComponent(this.config.password)}`;
      const res = await fetch(url);
      const json = await res.json() as any;
      if (json.code === 1000 && json.data?.token) {
        this.token = json.data.token;
        // expiration 是秒级时间戳
        this.tokenExpireAt = (json.data.expiration || 0) * 1000;
        console.log('[EnvCollector] Token refreshed, expireAt:', new Date(this.tokenExpireAt).toLocaleString());
        return this.token;
      }
      console.error('[EnvCollector] getToken failed:', json.message);
      return null;
    } catch (e) {
      console.error('[EnvCollector] getToken error:', e);
      return null;
    }
  }

  /** 获取实时数据 */
  async fetchRealTimeData(): Promise<RealTimeDevice[]> {
    const token = await this.ensureToken();
    if (!token) return [];
    try {
      const url = `${BASE_URL}/api/data/getRealTimeData`;
      const res = await fetch(url, {
        headers: { authorization: token },
      });
      const json = await res.json() as any;
      if (json.code === 1000 && Array.isArray(json.data)) {
        return json.data as RealTimeDevice[];
      }
      console.error('[EnvCollector] fetchRealTimeData failed:', json.message);
      return [];
    } catch (e) {
      console.error('[EnvCollector] fetchRealTimeData error:', e);
      return [];
    }
  }

  /** 将实时数据转换为数据库记录 */
  convertToRecords(devices: RealTimeDevice[]): any[] {
    const records: any[] = [];
    const dataTime = new Date(); // 系统采集时间
    for (const device of devices) {
      const collectTime = new Date(device.timeStamp);
      for (const item of device.dataItem) {
        for (const reg of item.registerItem) {
          records.push({
            factorId: `${device.deviceAddr}_${item.nodeId}_${reg.registerId}`,
            deviceAddr: device.deviceAddr,
            deviceName: device.deviceName,
            nodeId: item.nodeId,
            registerId: reg.registerId,
            factorName: reg.registerName,
            value: reg.value,
            rawData: reg.data,
            unit: reg.unit,
            coefficient: null, // 从设备列表获取，这里先用null
            deviceStatus: device.deviceStatus,
            collectTime,
            dataTime,
          });
        }
      }
    }
    return records;
  }

  /** 获取设备列表以补充系数 */
  async fetchDeviceList(): Promise<Map<string, number>> {
    const token = await this.ensureToken();
    if (!token) return new Map();
    try {
      const url = `${BASE_URL}/api/device/getDeviceList`;
      const res = await fetch(url, {
        headers: { authorization: token },
      });
      const json = await res.json() as any;
      const coeffMap = new Map<string, number>();
      if (json.code === 1000 && Array.isArray(json.data)) {
        for (const device of json.data) {
          if (device.factors && Array.isArray(device.factors)) {
            for (const f of device.factors) {
              coeffMap.set(f.factorId, f.coefficient);
            }
          }
        }
      }
      return coeffMap;
    } catch (e) {
      console.error('[EnvCollector] fetchDeviceList error:', e);
      return new Map();
    }
  }

  /** 提取报警信息记录 */
  extractAlarmRecords(devices: RealTimeDevice[]): any[] {
    const alarms: any[] = [];
    for (const device of devices) {
      const alarmTime = new Date(device.timeStamp);
      for (const item of device.dataItem) {
        for (const reg of item.registerItem) {
          // 只保存有报警级别且不是正常的记录 (alarmLevel > 0 或 < -1)
          if (reg.alarmLevel !== 0 && reg.alarmInfo) {
            let alarmRange: string | null = null;
            const match = reg.alarmInfo.match(/报警限值[:：]\s*([\d.]+)/);
            if (match) alarmRange = match[1];
            alarms.push({
              factorId: `${device.deviceAddr}_${item.nodeId}_${reg.registerId}`,
              deviceAddr: device.deviceAddr,
              deviceName: device.deviceName,
              nodeId: item.nodeId,
              registerId: reg.registerId,
              factorName: reg.registerName,
              alarmInfo: reg.alarmInfo,
              alarmLevel: reg.alarmLevel,
              alarmRange,
              currentValue: reg.value,
              unit: reg.unit,
              alarmTime,
            });
          }
        }
      }
    }
    return alarms;
  }

  /** 执行一次采集并保存 */
  async collectAndSave(): Promise<{ saved: number; devices: number; alarms: number }> {
    const [devices, coeffMap] = await Promise.all([
      this.fetchRealTimeData(),
      this.fetchDeviceList(),
    ]);
    if (devices.length === 0) return { saved: 0, devices: 0, alarms: 0 };

    const records = this.convertToRecords(devices);
    // 补充系数
    for (const r of records) {
      if (coeffMap.has(r.factorId)) {
        r.coefficient = coeffMap.get(r.factorId);
      }
    }

    // 提取报警信息
    const alarmRecords = this.extractAlarmRecords(devices);

    if (records.length > 0) {
      await EnvMonitor.bulkCreate(records);
    }
    if (alarmRecords.length > 0) {
      const { EnvAlarm } = await import('../models');
      await EnvAlarm.bulkCreate(alarmRecords);
    }
    console.log(`[EnvCollector] Saved ${records.length} records, ${alarmRecords.length} alarms from ${devices.length} devices`);
    return { saved: records.length, devices: devices.length, alarms: alarmRecords.length };
  }

  /** 启动定时采集 */
  startInterval(minutes = 5): ReturnType<typeof setInterval> {
    console.log(`[EnvCollector] Auto collect started (every ${minutes} min)`);
    // 立即执行一次
    this.collectAndSave().catch((e) => console.error('[EnvCollector] initial collect error:', e));
    return setInterval(() => {
      this.collectAndSave().catch((e) => console.error('[EnvCollector] interval collect error:', e));
    }, minutes * 60_000);
  }
}
