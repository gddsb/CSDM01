import { Router } from 'express';
import { Op } from 'sequelize';
import { Item, Customer, EnvMonitor, EnvAlarm, WeatherInfo } from '../models';

const router = Router();

/** 表结构元数据 */
const SCHEMA: Record<string, { field: string; type: string; label: string }[]> = {
  items: [
    { field: 'id', type: 'INTEGER', label: 'ID' },
    { field: 'itemCode', type: 'STRING', label: '料号' },
    { field: 'itemName', type: 'STRING', label: '品名' },
    { field: 'mainCategoryCode', type: 'STRING', label: '主分类代码' },
    { field: 'categoryName', type: 'STRING', label: '分类名称' },
    { field: 'specification', type: 'STRING', label: '规格' },
    { field: 'unitName', type: 'STRING', label: '单位名称' },
    { field: 'filmNo', type: 'STRING', label: '菲林编号' },
    { field: 'cuttingSize', type: 'STRING', label: '开料尺寸' },
    { field: 'printProcess', type: 'STRING', label: '印刷工艺' },
    { field: 'colorInfo', type: 'STRING', label: '分色信息' },
    { field: 'blankDiameter', type: 'STRING', label: '落料直径' },
    { field: 'materialThickness', type: 'STRING', label: '材料厚度' },
    { field: 'materialWidth', type: 'STRING', label: '材料宽度' },
    { field: 'materialHeight', type: 'STRING', label: '材料高度' },
    { field: 'scrapWeight', type: 'STRING', label: '边角料重量' },
    { field: 'stockUnitWeight', type: 'STRING', label: '库存单位重量' },
    { field: 'stockUnitVolume', type: 'STRING', label: '库存单位体积' },
    { field: 'weightUnit', type: 'STRING', label: '重量单位' },
    { field: 'volumeUnit', type: 'STRING', label: '体积单位' },
    { field: 'inventoryCategory', type: 'STRING', label: '存货分类' },
    { field: 'unitCode', type: 'STRING', label: '单位编码' },
    { field: 'isActive', type: 'BOOLEAN', label: '是否生效' },
    { field: 'effectiveDate', type: 'STRING', label: '生效日期' },
    { field: 'expirationDate', type: 'STRING', label: '失效日期' },
    { field: 'createdAt', type: 'DATE', label: '创建时间' },
    { field: 'updatedAt', type: 'DATE', label: '更新时间' },
  ],
  customers: [
    { field: 'id', type: 'INTEGER', label: 'ID' },
    { field: 'customerCode', type: 'STRING', label: '编码' },
    { field: 'customerName', type: 'STRING', label: '名称' },
    { field: 'shortName', type: 'STRING', label: '简称' },
    { field: 'categoryId', type: 'STRING', label: '客户分类ID' },
    { field: 'categoryName', type: 'STRING', label: '分类' },
    { field: 'isActive', type: 'BOOLEAN', label: '是否生效' },
    { field: 'expireDate', type: 'STRING', label: '失效日期' },
    { field: 'effectiveDate', type: 'STRING', label: '生效日期' },
    { field: 'createdAt', type: 'DATE', label: '创建时间' },
    { field: 'updatedAt', type: 'DATE', label: '更新时间' },
  ],
  env_monitor: [
    { field: 'id', type: 'INTEGER', label: 'ID' },
    { field: 'factorId', type: 'STRING', label: '因子ID' },
    { field: 'deviceAddr', type: 'INTEGER', label: '设备地址' },
    { field: 'deviceName', type: 'STRING', label: '设备名称' },
    { field: 'nodeId', type: 'INTEGER', label: '节点' },
    { field: 'registerId', type: 'INTEGER', label: '寄存器' },
    { field: 'factorName', type: 'STRING', label: '因子名称' },
    { field: 'value', type: 'DOUBLE', label: '当前值' },
    { field: 'rawData', type: 'STRING', label: '原始数据' },
    { field: 'unit', type: 'STRING', label: '单位' },
    { field: 'coefficient', type: 'FLOAT', label: '系数' },
    { field: 'deviceStatus', type: 'STRING', label: '设备状态' },
    { field: 'collectTime', type: 'DATE', label: '采集时间' },
    { field: 'dataTime', type: 'DATE', label: '数据时间' },
    { field: 'createdAt', type: 'DATE', label: '创建时间' },
    { field: 'updatedAt', type: 'DATE', label: '更新时间' },
  ],
  env_alarm: [
    { field: 'id', type: 'INTEGER', label: 'ID' },
    { field: 'factorId', type: 'STRING', label: '因子ID' },
    { field: 'deviceAddr', type: 'INTEGER', label: '设备地址' },
    { field: 'deviceName', type: 'STRING', label: '设备名称' },
    { field: 'nodeId', type: 'INTEGER', label: '节点' },
    { field: 'registerId', type: 'INTEGER', label: '寄存器' },
    { field: 'factorName', type: 'STRING', label: '因子名称' },
    { field: 'alarmInfo', type: 'STRING', label: '报警信息' },
    { field: 'alarmLevel', type: 'INTEGER', label: '报警级别' },
    { field: 'alarmRange', type: 'STRING', label: '报警限值' },
    { field: 'currentValue', type: 'DOUBLE', label: '当前报警值' },
    { field: 'unit', type: 'STRING', label: '单位' },
    { field: 'alarmTime', type: 'DATE', label: '报警时间' },
    { field: 'isHandled', type: 'BOOLEAN', label: '是否已处理' },
    { field: 'handleMsg', type: 'STRING', label: '处理意见' },
    { field: 'createdAt', type: 'DATE', label: '创建时间' },
    { field: 'updatedAt', type: 'DATE', label: '更新时间' },
  ],
  weather: [
    { field: 'id', type: 'INTEGER', label: 'ID' },
    { field: 'city', type: 'STRING', label: '城市' },
    { field: 'temperature', type: 'DOUBLE', label: '温度(℃)' },
    { field: 'humidity', type: 'DOUBLE', label: '相对湿度(%)' },
    { field: 'pressure', type: 'DOUBLE', label: '大气压(hPa)' },
    { field: 'weatherTime', type: 'DATE', label: '气象发布时间' },
    { field: 'source', type: 'STRING', label: '数据来源' },
    { field: 'createdAt', type: 'DATE', label: '创建时间' },
    { field: 'updatedAt', type: 'DATE', label: '更新时间' },
  ],
};

/** GET /api/archive/schema/:type - 表结构 */
router.get('/schema/:type', async (req, res, next) => {
  try {
    const type = req.params.type as 'items' | 'customers' | 'env_monitor' | 'env_alarm' | 'weather';
    if (!SCHEMA[type]) {
      return res.status(400).json({ success: false, message: '未知档案类型' });
    }
    const Model: any = type === 'items' ? Item : type === 'customers' ? Customer : type === 'env_alarm' ? EnvAlarm : type === 'weather' ? WeatherInfo : EnvMonitor;
    const count = await Model.count();
    const tableNameMap: Record<string, string> = {
      items: 'u9_items',
      customers: 'u9_customers',
      env_monitor: 'env_monitor_data',
      env_alarm: 'env_alarm_records',
      weather: 'weather_info',
    };
    res.json({
      success: true,
      data: {
        type,
        tableName: tableNameMap[type],
        totalRecords: count,
        columns: SCHEMA[type],
      },
    });
  } catch (e) { next(e); }
});

/** GET /api/archive/:type - 数据列表（分页、搜索、分类筛选） */
router.get('/:type', async (req, res, next) => {
  try {
    const type = req.params.type as 'items' | 'customers' | 'env_monitor' | 'env_alarm' | 'weather';
    if (!SCHEMA[type]) {
      return res.status(400).json({ success: false, message: '未知档案类型' });
    }
    const Model: any = type === 'items' ? Item : type === 'customers' ? Customer : type === 'env_alarm' ? EnvAlarm : type === 'weather' ? WeatherInfo : EnvMonitor;

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20));
    const keyword = (req.query.keyword as string) || '';

    // 分类筛选参数
    const deviceName = (req.query.deviceName as string) || '';
    const factorName = (req.query.factorName as string) || '';
    const alarmLevel = req.query.alarmLevel !== undefined ? Number(req.query.alarmLevel) : undefined;
    const isHandled = req.query.isHandled !== undefined ? req.query.isHandled === 'true' : undefined;

    const where: any = {};
    if (keyword) {
      if (type === 'items') {
        where[Op.or] = [
          { itemCode: { [Op.like]: `%${keyword}%` } },
          { itemName: { [Op.like]: `%${keyword}%` } },
          { specification: { [Op.like]: `%${keyword}%` } },
        ];
      } else if (type === 'customers') {
        where[Op.or] = [
          { customerCode: { [Op.like]: `%${keyword}%` } },
          { customerName: { [Op.like]: `%${keyword}%` } },
          { shortName: { [Op.like]: `%${keyword}%` } },
        ];
      } else if (type === 'env_monitor') {
        where[Op.or] = [
          { factorId: { [Op.like]: `%${keyword}%` } },
          { factorName: { [Op.like]: `%${keyword}%` } },
          { deviceName: { [Op.like]: `%${keyword}%` } },
        ];
      } else if (type === 'env_alarm') {
        where[Op.or] = [
          { factorId: { [Op.like]: `%${keyword}%` } },
          { factorName: { [Op.like]: `%${keyword}%` } },
          { deviceName: { [Op.like]: `%${keyword}%` } },
          { alarmInfo: { [Op.like]: `%${keyword}%` } },
        ];
      } else if (type === 'weather') {
        where[Op.or] = [
          { city: { [Op.like]: `%${keyword}%` } },
          { source: { [Op.like]: `%${keyword}%` } },
        ];
      }
    }

    // 分类筛选条件
    if (type === 'env_monitor' || type === 'env_alarm') {
      if (deviceName) where.deviceName = deviceName;
      if (factorName) where.factorName = factorName;
    }
    if (type === 'env_alarm') {
      if (alarmLevel !== undefined && !isNaN(alarmLevel)) where.alarmLevel = alarmLevel;
      if (isHandled !== undefined) where.isHandled = isHandled;
    }

    // 默认按时间倒序：env_monitor按collectTime, env_alarm按alarmTime, weather按weatherTime, 其他按id倒序
    const order: any = type === 'env_alarm'
      ? [['alarmTime', 'DESC']]
      : type === 'env_monitor'
      ? [['collectTime', 'DESC'], ['id', 'DESC']]
      : type === 'weather'
      ? [['weatherTime', 'DESC'], ['id', 'DESC']]
      : [['id', 'DESC']];

    const { count, rows } = await Model.findAndCountAll({
      where,
      order,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({
      success: true,
      data: {
        list: rows.map((r: any) => r.toJSON()),
        pagination: {
          page,
          pageSize,
          total: count,
          totalPages: Math.ceil(count / pageSize),
        },
      },
    });
  } catch (e) { next(e); }
});

/** GET /api/archive/:type/filters - 获取分类筛选选项 */
router.get('/:type/filters', async (req, res, next) => {
  try {
    const type = req.params.type as 'items' | 'customers' | 'env_monitor' | 'env_alarm' | 'weather';
    if (!SCHEMA[type]) {
      return res.status(400).json({ success: false, message: '未知档案类型' });
    }
    const Model: any = type === 'items' ? Item : type === 'customers' ? Customer : type === 'env_alarm' ? EnvAlarm : type === 'weather' ? WeatherInfo : EnvMonitor;

    const filters: any = {};

    if (type === 'env_monitor' || type === 'env_alarm') {
      // 设备名称列表
      const devices = await Model.findAll({
        attributes: ['deviceName'],
        group: ['deviceName'],
        order: [['deviceName', 'ASC']],
        raw: true,
      });
      filters.deviceNames = devices.map((d: any) => d.deviceName).filter(Boolean);

      // 因子名称列表
      const factors = await Model.findAll({
        attributes: ['factorName'],
        group: ['factorName'],
        order: [['factorName', 'ASC']],
        raw: true,
      });
      filters.factorNames = factors.map((f: any) => f.factorName).filter(Boolean);
    }

    if (type === 'env_alarm') {
      // 报警级别列表
      const levels = await Model.findAll({
        attributes: ['alarmLevel'],
        group: ['alarmLevel'],
        order: [['alarmLevel', 'ASC']],
        raw: true,
      });
      filters.alarmLevels = levels.map((l: any) => l.alarmLevel);
    }

    res.json({ success: true, data: filters });
  } catch (e) { next(e); }
});

export default router;
