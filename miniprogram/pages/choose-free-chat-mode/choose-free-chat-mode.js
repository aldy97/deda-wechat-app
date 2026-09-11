"use strict";
/**
 * 选择自由对话模式页
 * 展示可选择的自由对话角色/模式列表。
 * 当前为静态展示，无点击行为。
 */
Page({
    data: {
        modes: [
            {
                key: 'chinese-chat',
                title: '中文聊天陪伴',
                description: '中文智能体，不仅可以扮演树洞的角色，帮助宝贝们疏导情绪；还上知天文下知地理，随时在线给宝贝们解答各种问题。',
            },
            {
                key: 'bilingual-dialogue',
                title: '中英互动对话',
                description: '中英文双语智能体，会教小朋友们基础的词汇，用简单的英语耐心引导孩子们开口，语速相对较慢，意在培养孩子的双语表达能力。',
            },
            {
                key: 'english-story',
                title: '英文故事工坊',
                description: '全英文智能体，睡前给宝贝讲各种英语故事，从小就培养全英语环境哦。',
            },
            {
                key: 'encyclopedia',
                title: '百科大全',
                description: '宇宙超级无敌的小百科，脑袋里装满了科学的奥秘。擅长和3-10岁的孩子聊天，用最简单、最有趣的方式解答孩子的十万个为什么。',
            },
            {
                key: 'primary-english',
                title: '小学英语',
                description: '陪伴孩子学习的“超级学伴”，帮助6-12岁的小学生进行英语学习。',
            },
            {
                key: 'chinese-story',
                title: '中文故事大王',
                description: '中文智能体，全方位哄睡服务，熟读各类故事书，会用最温柔的语气给宝贝讲各种小故事。',
            },
            {
                key: 'english-correction',
                title: '全英纠错对话',
                description: '全英文智能体，大朋友们的口语陪练搭子，意在打造一个英语环境，帮助大朋友们自信开口，使用语句更地道。',
            },
        ],
    },
    onLoad() {
        // 静态展示，无需加载逻辑
    },
});
