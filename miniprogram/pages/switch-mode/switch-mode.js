"use strict";
/**
 * 切换模式页
 * 展示设备可切换的两种学习/对话模式。
 */
Page({
    data: {
        deviceId: '',
        modes: [
            {
                key: 'free-chat',
                title: '自由对话模式',
                description: 'AI 伙伴随时在线，陪孩子畅聊感兴趣的话题，在轻松对话中锻炼表达与思维能力。',
            },
            {
                key: 'textbook',
                title: '教材学习',
                description: '按照教材模块与单元进行系统学习，帮助孩子巩固课堂知识，循序渐进提升听说能力。',
            },
        ],
    },
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || '';
        this.setData({ deviceId });
    },
    /**
     * 选择模式
     * - 自由对话模式：跳转选择自由对话模式页
     * - 教材学习：跳转教材学习页
     */
    onSelectMode(event) {
        const { key } = event.currentTarget.dataset;
        if (key === 'free-chat') {
            wx.navigateTo({
                url: `/pages/choose-free-chat-mode/choose-free-chat-mode?id=${this.data.deviceId}`,
            });
        }
        else if (key === 'textbook') {
            wx.navigateTo({
                url: `/pages/textbook-learning/textbook-learning?id=${this.data.deviceId}`,
            });
        }
    },
});
