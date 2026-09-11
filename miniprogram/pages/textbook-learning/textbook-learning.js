"use strict";
/**
 * 教材学习页
 * 展示北上广深 6-12 岁常见英语教材、考试及 Lookee 相关课程。
 * 当前为静态展示，无点击行为。
 */
Page({
    data: {
        textbooks: [
            {
                key: 'pep-primary',
                title: '人教版 PEP 小学英语',
                description: '国内小学最普及的英语教材，贴近课堂进度，帮助孩子巩固课内词汇与句型。',
            },
            {
                key: 'fltrp-new-standard',
                title: '外研社新标准英语',
                description: '外研社经典小学英语教材，注重听说读写综合能力培养。',
            },
            {
                key: 'oxford-shanghai',
                title: '牛津上海版小学英语',
                description: '上海地区主流小学英语教材，话题生动，适合日常交际练习。',
            },
            {
                key: 'new-concept',
                title: '新概念英语',
                description: '经典英语培训教材，语法体系清晰，适合小学高年级系统提升。',
            },
            {
                key: 'yle',
                title: '剑桥少儿英语 YLE',
                description: '剑桥专为小学生设计的英语能力测评，分 Starters / Movers / Flyers 三级。',
            },
            {
                key: 'ket',
                title: '剑桥 KET',
                description: '剑桥英语入门考试，对应欧标 A2，适合小学高年级及初中低年级备考。',
            },
            {
                key: 'pet',
                title: '剑桥 PET',
                description: '剑桥英语初级考试，对应欧标 B1，是 KET 的进阶目标。',
            },
            {
                key: 'lookee-cambridge',
                title: 'Lookee 剑桥口语备考',
                description: 'Lookee 无屏 AI 口语陪练，围绕 KET/PET/FCE 真题与模考卡进行口语训练。',
            },
        ],
    },
    onLoad() {
        // 静态展示，无需加载逻辑
    },
});
