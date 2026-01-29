Page({
  data: {
    // 游戏数据
    score: 0,
    currentIndex: 1,
    totalWords: 10,
    
    // 当前单词
    currentWord: {
      english: '',
      chinese: '',
      hint: ''
    },
    
    // 游戏状态
    currentSpelling: [],
    letterOptions: [],
    showHint: false,
    showResult: false,
    resultTitle: '',
    resultIcon: '',
    
    // 单词库
    words: [
      { english: 'APPLE', chinese: '苹果', hint: '一种常见的水果，红色或绿色' },
      { english: 'BOOK', chinese: '书', hint: '用于阅读和学习的物品' },
      { english: 'CAT', chinese: '猫', hint: '一种常见的宠物，会喵喵叫' },
      { english: 'DOG', chinese: '狗', hint: '人类最好的朋友' },
      { english: 'ELEPHANT', chinese: '大象', hint: '陆地上最大的动物' },
      { english: 'FLOWER', chinese: '花', hint: '植物的繁殖器官，通常很美丽' },
      { english: 'GARDEN', chinese: '花园', hint: '种植花草树木的地方' },
      { english: 'HOUSE', chinese: '房子', hint: '人们居住的建筑物' },
      { english: 'ISLAND', chinese: '岛屿', hint: '四面环水的陆地' },
      { english: 'JOURNEY', chinese: '旅行', hint: '从一个地方到另一个地方的过程' }
    ]
  },

  onLoad: function() {
    this.startNewGame()
  },

  // 开始新游戏
  startNewGame: function() {
    // 打乱单词顺序
    const shuffledWords = [...this.data.words].sort(() => Math.random() - 0.5)
    
    // 取前totalWords个单词
    const gameWords = shuffledWords.slice(0, this.data.totalWords)
    
    this.setData({
      score: 0,
      currentIndex: 1,
      words: gameWords,
      currentSpelling: [],
      showHint: false,
      showResult: false
    })
    
    this.loadWord(0)
  },

  // 加载单词
  loadWord: function(index) {
    const word = this.data.words[index]
    
    // 打乱字母
    const letters = word.english.split('')
    const shuffledLetters = [...letters].sort(() => Math.random() - 0.5)
    
    this.setData({
      currentWord: word,
      currentSpelling: [],
      letterOptions: shuffledLetters,
      showHint: false,
      showResult: false
    })
  },

  // 选择字母
  selectLetter: function(e) {
    const letter = e.currentTarget.dataset.letter
    const currentSpelling = [...this.data.currentSpelling, letter]
    
    this.setData({
      currentSpelling: currentSpelling
    })
  },

  // 删除字母
  deleteLetter: function() {
    const currentSpelling = [...this.data.currentSpelling]
    if (currentSpelling.length > 0) {
      currentSpelling.pop()
      this.setData({
        currentSpelling: currentSpelling
      })
    }
  },

  // 检查答案
  checkAnswer: function() {
    const userAnswer = this.data.currentSpelling.join('')
    const correctAnswer = this.data.currentWord.english
    
    if (userAnswer === correctAnswer) {
      // 回答正确
      this.setData({
        score: this.data.score + 10,
        resultTitle: '回答正确！',
        resultIcon: '🎉',
        showResult: true
      })
    } else {
      // 回答错误
      this.setData({
        resultTitle: '回答错误',
        resultIcon: '😢',
        showResult: true
      })
    }
  },

  // 下一个单词
  nextWord: function() {
    const nextIndex = this.data.currentIndex
    
    if (nextIndex < this.data.totalWords) {
      this.setData({
        currentIndex: nextIndex + 1
      })
      this.loadWord(nextIndex)
    } else {
      // 游戏结束
      wx.showModal({
        title: '游戏结束',
        content: `恭喜！你的最终得分是：${this.data.score}分`,
        showCancel: false,
        confirmText: '重新开始',
        success: (res) => {
          if (res.confirm) {
            this.startNewGame()
          }
        }
      })
    }
  },

  // 切换提示
  toggleHint: function() {
    this.setData({
      showHint: !this.data.showHint
    })
  },

  // 返回播放器
  backToPlayer: function() {
    wx.navigateBack()
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  }
})