/**
 * 协议聚合页：/pages/agreement/agreement?doc=privacy|terms
 * 纯静态文案展示，不请求接口；doc 非法或缺省时兜底隐私政策。
 */
import { resolveLegalDoc } from "../../constants/legal-docs";

Page({
  data: {
    doc: resolveLegalDoc(),
  },

  onLoad(query?: Record<string, string | undefined>) {
    const doc = resolveLegalDoc(query?.doc);
    this.setData({ doc });
    wx.setNavigationBarTitle({ title: doc.title });
  },
});
