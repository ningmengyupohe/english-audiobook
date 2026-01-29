// utils/book-data.js - 英语听书共享数据模块

const bookDatabase = {
  // 经典文学系列
  '101': {
    id: '101',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cover: '/images/covers/book1.jpg',
    rating: 4.8,
    ratingCount: 1245,
    duration: 3600,
    playCount: 12567,
    chapterCount: 12,
    tags: ['经典文学', '美国文学', '爱情小说', '爵士时代'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '《了不起的盖茨比》是美国作家弗·司各特·菲茨杰拉德创作的一部以20世纪20年代的纽约市及长岛为背景的中篇小说，出版于1925年。',
    vocabularyCount: 850,
    grammarPoints: 12,
    publishedYear: 1925,
    language: '英语',
    accent: '美式英语',
    narrator: '专业配音员'
  },
  '102': {
    id: '102',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    cover: '/images/covers/book2.jpg',
    rating: 4.7,
    ratingCount: 980,
    duration: 4200,
    playCount: 9876,
    chapterCount: 16,
    tags: ['经典文学', '英国文学', '爱情小说', '社会批判'],
    difficultyLevel: 4,
    difficultyText: '中高级',
    description: '《傲慢与偏见》是英国小说家简·奥斯汀的代表作，讲述了19世纪英国乡绅班纳特五个待字闺中的女儿的爱情故事。',
    vocabularyCount: 920,
    grammarPoints: 15,
    publishedYear: 1813,
    language: '英语',
    accent: '英式英语',
    narrator: '专业配音员'
  },
  '103': {
    id: '103',
    title: '1984',
    author: 'George Orwell',
    cover: '/images/covers/book3.jpg',
    rating: 4.9,
    ratingCount: 1850,
    duration: 3800,
    playCount: 8564,
    chapterCount: 14,
    tags: ['科幻小说', '反乌托邦', '政治寓言', '经典'],
    difficultyLevel: 4,
    difficultyText: '高级',
    description: '《一九八四》是英国作家乔治·奥威尔创作的一部反乌托邦小说，出版于1949年。',
    vocabularyCount: 950,
    grammarPoints: 18,
    publishedYear: 1949,
    language: '英语',
    accent: '英式英语',
    narrator: '专业配音员'
  },
  '104': {
    id: '104',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    cover: '/images/covers/book4.jpg',
    rating: 4.8,
    ratingCount: 1320,
    duration: 4500,
    playCount: 7321,
    chapterCount: 18,
    tags: ['美国文学', '成长小说', '种族问题', '普利策奖'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '《杀死一只知更鸟》是美国作家哈珀·李于1960年发表的小说，获得1961年普利策奖。',
    vocabularyCount: 870,
    grammarPoints: 14,
    publishedYear: 1960,
    language: '英语',
    accent: '美式英语',
    narrator: '专业配音员'
  },
  '105': {
    id: '105',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    cover: '/images/covers/book5.jpg',
    rating: 4.6,
    ratingCount: 920,
    duration: 3400,
    playCount: 6543,
    chapterCount: 10,
    tags: ['青春文学', '美国文学', '成长小说', '经典'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '《麦田里的守望者》是美国作家杰罗姆·大卫·塞林格唯一的长篇小说，于1951年首次出版。',
    vocabularyCount: 820,
    grammarPoints: 10,
    publishedYear: 1951,
    language: '英语',
    accent: '美式英语',
    narrator: '专业配音员'
  },
  '106': {
    id: '106',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    cover: '/images/covers/alchemist.jpg',
    rating: 4.7,
    ratingCount: 1560,
    duration: 3100,
    playCount: 5432,
    chapterCount: 8,
    tags: ['心灵成长', '哲理小说', '巴西文学', '追寻梦想'],
    difficultyLevel: 2,
    difficultyText: '初级',
    description: '《牧羊少年奇幻之旅》是巴西作家保罗·柯艾略的著名小说。',
    vocabularyCount: 780,
    grammarPoints: 8,
    publishedYear: 1988,
    language: '英语',
    accent: '美式英语',
    narrator: '专业配音员'
  },

  // 商务英语系列
  '201': {
    id: '201',
    title: 'Business English Essentials',
    author: 'David Brown',
    cover: '/images/covers/business1.jpg',
    rating: 4.5,
    ratingCount: 890,
    duration: 2800,
    playCount: 4321,
    chapterCount: 10,
    tags: ['商务英语', '职场沟通', '实用英语', '专业英语'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '专业的商务英语课程，涵盖会议、谈判、邮件写作、电话沟通等职场必备技能。',
    vocabularyCount: 650,
    grammarPoints: 8,
    publishedYear: 2020,
    language: '英语',
    accent: '美式英语',
    narrator: '专业商务培训师'
  },
  '202': {
    id: '202',
    title: 'English for Meetings',
    author: 'Sarah Johnson',
    cover: '/images/covers/business2.jpg',
    rating: 4.6,
    ratingCount: 760,
    duration: 3200,
    playCount: 3876,
    chapterCount: 12,
    tags: ['商务英语', '会议英语', '职场技能', '专业沟通'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '专门针对会议场景的英语学习课程，包括主持会议、表达意见、参与讨论等实用技能。',
    vocabularyCount: 720,
    grammarPoints: 10,
    publishedYear: 2021,
    language: '英语',
    accent: '英式英语',
    narrator: '商务沟通专家'
  },

  // 旅游英语系列
  '301': {
    id: '301',
    title: 'Travel English Guide',
    author: 'Emma Wilson',
    cover: '/images/covers/travel1.jpg',
    rating: 4.4,
    ratingCount: 1250,
    duration: 2400,
    playCount: 5678,
    chapterCount: 8,
    tags: ['旅游英语', '实用英语', '出国旅游', '日常对话'],
    difficultyLevel: 2,
    difficultyText: '初级',
    description: '旅游必备英语对话指南，涵盖机场、酒店、餐厅、购物、问路等各种旅游场景。',
    vocabularyCount: 580,
    grammarPoints: 6,
    publishedYear: 2019,
    language: '英语',
    accent: '美式英语',
    narrator: '旅游达人'
  },
  '302': {
    id: '302',
    title: 'Airport English Conversations',
    author: 'Mike Chen',
    cover: '/images/covers/travel2.jpg',
    rating: 4.3,
    ratingCount: 980,
    duration: 1800,
    playCount: 4321,
    chapterCount: 6,
    tags: ['旅游英语', '机场英语', '实用对话', '出国必备'],
    difficultyLevel: 2,
    difficultyText: '初级',
    description: '机场场景英语对话全攻略，包括值机、安检、登机、转机、海关等各种机场场景。',
    vocabularyCount: 520,
    grammarPoints: 5,
    publishedYear: 2020,
    language: '英语',
    accent: '英式英语',
    narrator: '机场工作人员'
  },

  // 儿童英语系列
  '401': {
    id: '401',
    title: 'Fun English for Kids',
    author: 'Lucy Green',
    cover: '/images/covers/kids1.jpg',
    rating: 4.7,
    ratingCount: 1560,
    duration: 1500,
    playCount: 6789,
    chapterCount: 10,
    tags: ['儿童英语', '英语启蒙', '儿童教育', '趣味学习'],
    difficultyLevel: 1,
    difficultyText: '入门',
    description: '专为儿童设计的趣味英语课程，通过故事、歌曲、游戏等方式激发孩子对英语的兴趣。',
    vocabularyCount: 450,
    grammarPoints: 4,
    publishedYear: 2021,
    language: '英语',
    accent: '美式英语',
    narrator: '儿童教育专家'
  },
  '402': {
    id: '402',
    title: 'Bedtime English Stories',
    author: 'Peter White',
    cover: '/images/covers/kids2.jpg',
    rating: 4.8,
    ratingCount: 1890,
    duration: 1200,
    playCount: 7543,
    chapterCount: 15,
    tags: ['儿童英语', '睡前故事', '英语听力', '亲子阅读'],
    difficultyLevel: 1,
    difficultyText: '入门',
    description: '精选经典儿童英语睡前故事，帮助孩子在轻松愉快的氛围中学习英语，培养英语语感。',
    vocabularyCount: 380,
    grammarPoints: 3,
    publishedYear: 2022,
    language: '英语',
    accent: '英式英语',
    narrator: '故事讲述者'
  },

  // 科技英语系列
  '501': {
    id: '501',
    title: 'Tech English Today',
    author: 'Dr. Robert Zhang',
    cover: '/images/covers/tech1.jpg',
    rating: 4.6,
    ratingCount: 870,
    duration: 3400,
    playCount: 3456,
    chapterCount: 12,
    tags: ['科技英语', 'IT英语', '专业术语', '技术交流'],
    difficultyLevel: 4,
    difficultyText: '高级',
    description: '科技行业专业英语课程，涵盖人工智能、大数据、云计算、网络安全等领域的专业英语表达。',
    vocabularyCount: 920,
    grammarPoints: 12,
    publishedYear: 2021,
    language: '英语',
    accent: '美式英语',
    narrator: '科技专家'
  },
  '502': {
    id: '502',
    title: 'AI and Machine Learning English',
    author: 'Dr. Lisa Wang',
    cover: '/images/covers/tech2.jpg',
    rating: 4.7,
    ratingCount: 650,
    duration: 3800,
    playCount: 2876,
    chapterCount: 14,
    tags: ['科技英语', '人工智能', '机器学习', '专业英语'],
    difficultyLevel: 4,
    difficultyText: '高级',
    description: '人工智能和机器学习领域的专业英语课程，包括技术概念、算法解释、论文阅读等专业内容。',
    vocabularyCount: 980,
    grammarPoints: 15,
    publishedYear: 2022,
    language: '英语',
    accent: '英式英语',
    narrator: 'AI研究员'
  },

  // 生活英语系列
  '601': {
    id: '601',
    title: 'Daily English Conversations',
    author: 'Mary Smith',
    cover: '/images/covers/daily1.jpg',
    rating: 4.5,
    ratingCount: 2100,
    duration: 2600,
    playCount: 8765,
    chapterCount: 10,
    tags: ['生活英语', '日常对话', '实用英语', '口语练习'],
    difficultyLevel: 2,
    difficultyText: '初级',
    description: '日常生活英语对话大全，涵盖购物、餐饮、交通、社交、医疗等各方面生活场景的实用英语。',
    vocabularyCount: 680,
    grammarPoints: 8,
    publishedYear: 2020,
    language: '英语',
    accent: '美式英语',
    narrator: '英语教师'
  },
  '602': {
    id: '602',
    title: 'Shopping English Made Easy',
    author: 'Anna Lee',
    cover: '/images/covers/daily2.jpg',
    rating: 4.4,
    ratingCount: 1450,
    duration: 1900,
    playCount: 5432,
    chapterCount: 8,
    tags: ['生活英语', '购物英语', '实用对话', '消费英语'],
    difficultyLevel: 2,
    difficultyText: '初级',
    description: '购物场景英语全攻略，包括询问价格、试穿、讨价还价、退货等各种购物场景的实用英语表达。',
    vocabularyCount: 550,
    grammarPoints: 6,
    publishedYear: 2021,
    language: '英语',
    accent: '英式英语',
    narrator: '购物达人'
  },

  // 新闻英语系列
  '701': {
    id: '701',
    title: 'BBC News English',
    author: 'BBC Learning',
    cover: '/images/covers/news1.jpg',
    rating: 4.8,
    ratingCount: 1870,
    duration: 3000,
    playCount: 6543,
    chapterCount: 15,
    tags: ['新闻英语', '听力训练', '时事英语', 'BBC英语'],
    difficultyLevel: 4,
    difficultyText: '高级',
    description: '精选BBC新闻英语，涵盖国际时事、经济、科技、文化等各个领域的新闻报道，提升听力理解能力。',
    vocabularyCount: 890,
    grammarPoints: 12,
    publishedYear: 2022,
    language: '英语',
    accent: '英式英语',
    narrator: 'BBC播音员'
  },
  '702': {
    id: '702',
    title: 'VOA Special English',
    author: 'Voice of America',
    cover: '/images/covers/news2.jpg',
    rating: 4.6,
    ratingCount: 1620,
    duration: 2800,
    playCount: 5987,
    chapterCount: 12,
    tags: ['新闻英语', 'VOA英语', '慢速英语', '美国之音'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: 'VOA慢速英语特别节目，语速较慢，发音清晰，适合中级学习者提升听力水平和了解国际时事。',
    vocabularyCount: 780,
    grammarPoints: 10,
    publishedYear: 2021,
    language: '英语',
    accent: '美式英语',
    narrator: 'VOA播音员'
  },

  // 考试英语系列
  '801': {
    id: '801',
    title: 'IELTS Listening Practice',
    author: 'British Council',
    cover: '/images/covers/exam1.jpg',
    rating: 4.7,
    ratingCount: 2340,
    duration: 3600,
    playCount: 8765,
    chapterCount: 12,
    tags: ['雅思英语', '考试英语', '听力训练', '备考资料'],
    difficultyLevel: 4,
    difficultyText: '高级',
    description: '雅思听力专项训练，包含各种题型和场景的模拟练习，帮助考生提高雅思听力考试成绩。',
    vocabularyCount: 950,
    grammarPoints: 15,
    publishedYear: 2022,
    language: '英语',
    accent: '英式英语',
    narrator: '雅思考官'
  },
  '802': {
    id: '802',
    title: 'TOEFL Listening Mastery',
    author: 'ETS Official',
    cover: '/images/covers/exam2.jpg',
    rating: 4.6,
    ratingCount: 1890,
    duration: 3400,
    playCount: 7654,
    chapterCount: 10,
    tags: ['托福英语', '考试英语', '美国英语', '学术英语'],
    difficultyLevel: 4,
    difficultyText: '高级',
    description: '托福听力专项突破，包含学术讲座、校园对话等各种托福听力题型，提升托福听力考试成绩。',
    vocabularyCount: 920,
    grammarPoints: 14,
    publishedYear: 2021,
    language: '英语',
    accent: '美式英语',
    narrator: '托福考官'
  },

  // 趣味英语系列
  '901': {
    id: '901',
    title: 'English Jokes Collection',
    author: 'Tom Harris',
    cover: '/images/covers/fun1.jpg',
    rating: 4.3,
    ratingCount: 1450,
    duration: 1200,
    playCount: 4321,
    chapterCount: 8,
    tags: ['趣味英语', '英语笑话', '文化学习', '轻松英语'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '精选英语笑话集锦，在欢笑中学习英语，了解英语国家的文化和幽默方式。',
    vocabularyCount: 650,
    grammarPoints: 6,
    publishedYear: 2020,
    language: '英语',
    accent: '美式英语',
    narrator: '喜剧演员'
  },
  '902': {
    id: '902',
    title: 'English Tongue Twisters',
    author: 'Sarah Miller',
    cover: '/images/covers/fun2.jpg',
    rating: 4.2,
    ratingCount: 980,
    duration: 900,
    playCount: 3456,
    chapterCount: 6,
    tags: ['趣味英语', '绕口令', '发音练习', '口语训练'],
    difficultyLevel: 3,
    difficultyText: '中级',
    description: '英语绕口令大全，帮助改善英语发音和口语流利度，同时增加学习英语的趣味性。',
    vocabularyCount: 420,
    grammarPoints: 4,
    publishedYear: 2021,
    language: '英语',
    accent: '英式英语',
    narrator: '语音教练'
  }
}

// 根据分类获取书籍ID
const getBooksByCategory = function(categoryId) {
  const categoryMapping = {
    '1': ['103', '104'], // 历史人文
    '2': ['401', '402'], // 儿童启蒙
    '3': ['601', '602'], // 生活日常
    '4': ['101', '102', '103', '104', '105', '106'], // 经典文学
    '5': ['201', '202'], // 商务英语
    '6': ['501', '502'], // 科技科普
    '7': ['301', '302'], // 旅游文化
    '8': ['701', '702']  // 新闻时事
  }
  return categoryMapping[categoryId] || []
}

// 获取所有书籍ID
const getAllBookIds = function() {
  return Object.keys(bookDatabase)
}

// 获取书籍信息
const getBookInfo = function(bookId) {
  return bookDatabase[bookId] || null
}

// 获取热门推荐书籍
const getFeaturedBooks = function() {
  return ['201', '301', '401'].map(id => {
    const book = bookDatabase[id]
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      cover: book.cover,
      category: book.tags[0] || '未分类',
      rating: book.rating,
      description: book.description.substring(0, 30) + '...'
    }
  })
}

// 导出模块
module.exports = {
  bookDatabase,
  getBooksByCategory,
  getAllBookIds,
  getBookInfo,
  getFeaturedBooks
}