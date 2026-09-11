"use strict";
/**
 * 我的页面
 * 家长个人中心，展示账号信息、孩子昵称与常用入口。
 * 当前为 MVP 骨架，所有按钮仅占位，无实际响应。
 */
Page({
    data: {
        /** 用户手机号 */
        phone: '18016235670',
        /** 孩子昵称 */
        childName: '熊熊',
    },
    onLoad() {
        // MVP 阶段使用静态 mock 数据，后续可替换为登录态或接口获取
    },
    /**
     * 设置入口（占位）
     */
    onSettingsTap() {
        // TODO: 跳转设置页
    },
    /**
     * 联系我们入口（占位）
     */
    onContactTap() {
        // TODO: 打开客服或联系页面
    },
    /**
     * 切换孩子（占位）
     */
    onSwitchChildTap() {
        // TODO: 切换/管理孩子档案
    },
});
