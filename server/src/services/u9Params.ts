/** u9Params —— U9 ERP 接口参数常量 */

export const ITEM_LIST_PARAMS: Record<string, string> = {
  lnk: 'CBO.Pub.Item.ItemList',
  sId: '3000nid',
  bId: '1001101159162183',
  ShowType: 'NavigatePage',
  ParentForm: '053a1be3-2c56-428b-b221-b5291644f2cb',
  __fsk: '__SK95275*__SK95275',
  __curOId: '1002406170039099',
};

/** ========= 客户列表 ========= */
export const CUSTOMER_LIST_PARAMS: Record<string, string> = {
  lnk: 'CBO.Pub.Customer.CustomerList',
  sId: '3000nid',
  bId: '1001101159162177',
  ShowType: 'NavigatePage',
  ParentForm: 'a0e3a0ab-bf8a-4e1b-9a1b-8ffd2bbf6f2e',
  __fsk: '__SK88231*__SK88231',
  __curOId: '1002406170039099',
};

/** ========= 生产订单列表 ========= */
export const PRODUCTION_ORDER_LIST_PARAMS: Record<string, string> = {
  lnk: 'MFG.MO.DiscreteMO.DiscreteMOList',
  sId: '3025nid',
  bId: '1001101160309210',
  ShowType: 'NavigatePage',
  CardPageID: 'MFG.MO.DiscreteMO.DiscreteMO',
  IsStartMO: '0',
  ParentForm: '99dc1cbe-7014-45a9-b688-445dcf08a7af',
  __fsk: '__SK52539*__SK52539',
  __curOId: '1002406170039099',
};

/** ========= 采购收货（标准收货）列表 ========= */
// lnk=SCM.PM.PM6010_20 为列表视图，使用默认查询方案自动加载数据
export const PURCHASE_RECEIPT_LIST_PARAMS: Record<string, string> = {
  lnk: 'SCM.PM.PM6010_20',
  sId: '3016nid',
  bId: '1001101160311129',
  ShowType: 'NavigatePage',
  RCV_Type: 'PM6010',
  ParentForm: '91afbfb8-28af-44e6-9cf2-86d66ee16cb1',
  __fsk: '__SK81088*__SK81088',
  __curOId: '1002406170039099',
};
