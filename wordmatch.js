Page({
  data: {
    // 游戏状态
    gameStarted: false,
    gameCompleted: false,
    score: 0,
    timeLeft: 180, // 3分钟
    gameTimer: null,
    
    // 关卡数据
    currentLevel: 1,
    totalLevels: 3,
    matchedCount: 0,
    totalPairs: 0,
    levelScore: 0,
    levelTime: 0,
    levelTimer: null,
    
    // 连线状态
    englishWords: [],
    chineseWords: [],
    englishStyles: [],
    chineseStyles: [],
    connections: [],
    currentConnection: null,
    
    // 弹窗状态
    showResult: false,
    resultTitle: '',
    resultIcon: '',
    showHintModal: false,
    hintText: '',
    
    // 游戏数据
    levels: [
      {
        pairs: 4,
        words: [
          { english: "APPLE", chinese: "苹果" },
          { english: "BOOK", chinese: "书" },
          { english: "CAT", chinese: "猫" },
          { english: "DOG", chinese: "狗" }
        ],
        hint: "这些都是基础英文单词"
      },
      {
        pairs: 5,
        words: [
          { english: "ELEPHANT", chinese: "大象" },
          { english: "FLOWER", chinese: "花" },
          { english: "GARDEN", chinese: "花园" },
          { english: "HOUSE", chinese: "房子" },
          { english: "ISLAND", chinese: "岛屿" }
        ],
        hint: "注意单词的拼写和含义"
      },
      {
        pairs: 6,
        words: [
          { english: "JOURNEY", chinese: "旅行" },
          { english: "KNOWLEDGE", chinese: "知识" },
          { english: "LANGUAGE", chinese: "语言" },
          { english: "MOUNTAIN", chinese: "山" },
          { english: "NATURE", chinese: "自然" },
          { english: "OCEAN", chinese: "海洋" }
        ],
        hint: "这些是中级难度单词"
      }
    ]
  },

  onLoad: function() {
    this.initGame()
  },

  onUnload: function() {
    this.stopTimers()
  },

  // 初始化游戏
  initGame: function() {
    this.setData({
      gameStarted: false,
      gameCompleted: false,
      score: 0,
      timeLeft: 180,
      currentLevel: 1
    })
  },

  // 开始游戏
  startGame: function() {
    this.setData({
      gameStarted: true
    })
    
    this.startGameTimer()
    this.loadLevel(0)
  },

  // 开始游戏计时器
  startGameTimer: function() {
    this.stopGameTimer()
    
    const timer = setInterval(() => {
      const newTime = this.data.timeLeft - 1
      
      if (newTime <= 0) {
        this.gameOver()
      } else {
        this.setData({
          timeLeft: newTime
        })
      }
    }, 1000)
    
    this.setData({
      gameTimer: timer
    })
  },

  // 停止游戏计时器
  stopGameTimer: function() {
    if (this.data.gameTimer) {
      clearInterval(this.data.gameTimer)
      this.setData({
        gameTimer: null
      })
    }
  },

  // 加载关卡
  loadLevel: function(levelIndex) {
    const level = this.data.levels[levelIndex]
    
    // 打乱顺序
    const englishWords = level.words.map(w => w.english)
    const chineseWords = level.words.map(w => w.chinese).sort(() => Math.random() - 0.5)
    
    this.setData({
      englishWords: englishWords,
      chineseWords: chineseWords,
      englishStyles: englishWords.map(() => ''),
      chineseStyles: chineseWords.map(() => ''),
      connections: [],
      currentConnection: null,
      matchedCount: 0,
      totalPairs: level.pairs,
      levelScore: 0,
      levelTime: 0,
      hintText: level.hint
    })
    
    this.startLevelTimer()
  },

  // 开始关卡计时器
  startLevelTimer: function() {
    this.stopLevelTimer()
    
    const timer = setInterval(() => {
      this.setData({
        levelTime: this.data.levelTime + 1
      })
    }, 1000)
    
    this.setData({
      levelTimer: timer
    })
  },

  // 停止关卡计时器
  stopLevelTimer: function() {
    if (this.data.levelTimer) {
      clearInterval(this.data.levelTimer)
      this.setData({
        levelTimer: null
      })
    }
  },

  // 开始连接
  startConnect: function(e) {
    const index = e.currentTarget.dataset.index
    
    if (this.data.englishStyles[index].includes('word-matched')) {
      return
    }
    
    const englishStyles = [...this.data.englishStyles]
    englishStyles[index] = 'background: #bbdefb; border-color: #2196f3;'
    
    this.setData({
      currentConnection: { from: this.data.englishWords[index], fromIndex: index },
      englishStyles: englishStyles
    })
  },

  // 结束连接
  endConnect: function(e) {
    if (!this.data.currentConnection) return
    
    const fromIndex = this.data.currentConnection.fromIndex
    const toIndex = e.currentTarget.dataset.index
    
    if (this.data.chineseStyles[toIndex].includes('word-matched')) {
      return
    }
    
    // 检查是否匹配
    const isMatch = this.checkMatch(fromIndex, toIndex)
    
    const chineseStyles = [...this.data.chineseStyles]
    const englishStyles = [...this.data.englishStyles]
    
    if (isMatch) {
      chineseStyles[toIndex] = 'background: #c8e6c9; border-color: #66bb6a; color: #388e3c;'
      englishStyles[fromIndex] = 'background: #c8e6c9; border-color: #66bb6a; color: #388e3c;'
      
      this.setData({
        matchedCount: this.data.matchedCount + 1,
        connections: [...this.data.connections, { from: fromIndex, to: toIndex }],
        englishStyles: englishStyles,
        chineseStyles: chineseStyles,
        currentConnection: null
      })
      
      // 检查是否完成关卡
      if (this.data.matchedCount === this.data.totalPairs) {
        this.levelComplete()
      }
    } else {
      chineseStyles[toIndex] = 'background: #ffcdd2; border-color: #ef5350;'
      
      this.setData({
        chineseStyles: chineseStyles,
        currentConnection: null
      })
      
      // 重置样式
      setTimeout(() => {
        const resetEnglishStyles = [...this.data.englishStyles]
        const resetChineseStyles = [...this.data.chineseStyles]
        resetEnglishStyles[fromIndex] = ''
        resetChineseStyles[toIndex] = ''
        this.setData({
          englishStyles: resetEnglishStyles,
          chineseStyles: resetChineseStyles
        })
      }, 500)
    }
  },

  // 检查匹配
  checkMatch: function(englishIndex, chineseIndex) {
    const level = this.data.levels[this.data.currentLevel - 1]
    const correctChinese = level.words[englishIndex].chinese
    const selectedChinese = this.data.chineseWords[chineseIndex]
    
    return correctChinese === selectedChinese
  },

  // 关卡完成
  levelComplete: function() {
    this.stopLevelTimer()
    
    // 计算得分
    const timeBonus = Math.max(0, 300 - this.data.levelTime * 10)
    const levelScore = this.data.totalPairs * 20 + timeBonus
    
    this.setData({
      score: this.data.score + levelScore,
      levelScore: levelScore,
      resultTitle: `第${this.data.currentLevel}关完成！`,
      resultIcon: '🎉',
      showResult: true
    })
  },

  // 下一关
  nextLevel: function() {
    const nextLevel = this.data.currentLevel
    
    if (nextLevel < this.data.totalLevels) {
      this.setData({
        currentLevel: nextLevel + 1,
        showResult: false
      })
      this.loadLevel(nextLevel)
    } else {
      this.setData({
        gameCompleted: true,
        resultTitle: '恭喜通关！',
        resultIcon: '🏆',
        showResult: true
      })
    }
  },

  // 重新开始
  restartGame: function() {
    this.stopTimers()
    this.initGame()
    this.setData({
      showResult: false
    })
  },

  // 检查匹配
  checkMatches: function() {
    const level = this.data.levels[this.data.currentLevel - 1]
    let correctCount = 0
    
    for (let i = 0; i < this.data.englishWords.length; i++) {
      const englishWord = this.data.englishWords[i]
      const correctChinese = level.words.find(w => w.english === englishWord).chinese
      
      // 找到用户选择的连接
      const connection = this.data.connections.find(c => c.from === i)
      if (connection) {
        const selectedChinese = this.data.chineseWords[connection.to]
        if (selectedChinese === correctChinese) {
          correctCount++
        }
      }
    }
    
    wx.showModal({
      title: '匹配检查',
      content: `已正确匹配: ${correctCount}/${this.data.totalPairs}`,
      showCancel: false
    })
  },

  // 重置连接
  resetConnections: function() {
    this.setData({
      connections: [],
      currentConnection: null,
      englishStyles: this.data.englishWords.map(() => ''),
      chineseStyles: this.data.chineseWords.map(() => ''),
      matchedCount: 0
    })
  },

  // 显示提示
  showHint: function() {
    this.setData({
      showHintModal: true
    })
  },

  // 关闭提示
  closeHint: function() {
    this.setData({
      showHintModal: false
    })
  },

  // 游戏结束
  gameOver: function() {
    this.stopTimers()
    
    wx.showModal({
      title: '时间到！',
      content: `游戏结束！最终得分: ${this.data.score}分`,
      showCancel: false,
      confirmText: '重新开始',
      success: (res) => {
        if (res.confirm) {
          this.restartGame()
        }
      }
    })
  },

  // 停止所有计时器
  stopTimers: function() {
    this.stopGameTimer()
    this.stopLevelTimer()
  },

  // 格式化时间
  formatTime: function(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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