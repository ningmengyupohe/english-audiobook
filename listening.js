Page({
  data: {
    // 游戏数据
    score: 0,
    currentIndex: 1,
    totalQuestions: 8,
    
    // 音频状态
    isPlaying: false,
    audioCurrentTime: 0,
    audioDuration: 30,
    audioProgress: 0,
    audioTimer: null,
    playCount: 3,
    
    // 当前问题
    currentQuestion: {},
    selectedOption: -1,
    optionStyles: [],
    
    // 弹窗状态
    showResult: false,
    resultTitle: '',
    resultIcon: '',
    resultDescription: '',
    showHintModal: false,
    
    // 问题库
    questions: [
      {
        audioText: "I usually get up at 7 o'clock in the morning.",
        question: "What time does the speaker usually get up?",
        options: ["6 o'clock", "7 o'clock", "8 o'clock", "9 o'clock"],
        correctAnswer: 1,
        hint: "注意听时间数字"
      },
      {
        audioText: "My favorite color is blue, but my sister prefers green.",
        question: "What color does the speaker's sister prefer?",
        options: ["Blue", "Red", "Green", "Yellow"],
        correctAnswer: 2,
        hint: "注意but后面的内容"
      },
      {
        audioText: "We went to the beach last weekend and had a great time.",
        question: "Where did they go last weekend?",
        options: ["Mountain", "Beach", "Park", "Mall"],
        correctAnswer: 1,
        hint: "注意地点名词"
      },
      {
        audioText: "The weather is sunny and warm, perfect for a picnic.",
        question: "What is the weather like?",
        options: ["Rainy and cold", "Sunny and warm", "Cloudy and cool", "Windy"],
        correctAnswer: 1,
        hint: "注意形容词描述"
      },
      {
        audioText: "I need to buy some milk, bread, and eggs from the supermarket.",
        question: "What does the speaker NOT need to buy?",
        options: ["Milk", "Bread", "Eggs", "Fruit"],
        correctAnswer: 3,
        hint: "注意列举的物品"
      },
      {
        audioText: "She's wearing a red dress and black shoes for the party.",
        question: "What color is her dress?",
        options: ["Black", "Blue", "Red", "White"],
        correctAnswer: 2,
        hint: "注意颜色的描述"
      },
      {
        audioText: "The library opens at 9 AM and closes at 6 PM from Monday to Friday.",
        question: "When does the library close?",
        options: ["5 PM", "6 PM", "7 PM", "8 PM"],
        correctAnswer: 1,
        hint: "注意听关闭时间"
      },
      {
        audioText: "He can speak three languages: English, French, and Chinese.",
        question: "How many languages can he speak?",
        options: ["Two", "Three", "Four", "Five"],
        correctAnswer: 1,
        hint: "注意听数字"
      }
    ]
  },

  onLoad: function() {
    this.startNewGame()
  },

  onUnload: function() {
    this.stopAudioTimer()
  },

  // 开始新游戏
  startNewGame: function() {
    // 打乱问题顺序
    const shuffledQuestions = [...this.data.questions].sort(() => Math.random() - 0.5)
    
    this.setData({
      score: 0,
      currentIndex: 1,
      questions: shuffledQuestions.slice(0, this.data.totalQuestions),
      selectedOption: -1,
      optionStyles: [],
      playCount: 3,
      isPlaying: false,
      audioCurrentTime: 0,
      audioProgress: 0,
      showResult: false
    })
    
    this.loadQuestion(0)
  },

  // 加载问题
  loadQuestion: function(index) {
    const question = this.data.questions[index]
    const optionStyles = question.options.map(() => '')
    
    this.setData({
      currentQuestion: question,
      selectedOption: -1,
      optionStyles: optionStyles,
      playCount: 3,
      isPlaying: false,
      audioCurrentTime: 0,
      audioProgress: 0,
      showResult: false,
      showHintModal: false
    })
    
    this.stopAudioTimer()
  },

  // 播放/暂停音频
  togglePlay: function() {
    if (this.data.playCount <= 0) {
      wx.showToast({
        title: '播放次数已用完',
        icon: 'none'
      })
      return
    }
    
    const newIsPlaying = !this.data.isPlaying
    
    if (newIsPlaying) {
      this.startAudioTimer()
      this.setData({
        playCount: this.data.playCount - 1
      })
    } else {
      this.stopAudioTimer()
    }
    
    this.setData({
      isPlaying: newIsPlaying
    })
  },

  // 开始音频计时器
  startAudioTimer: function() {
    this.stopAudioTimer()
    
    const duration = this.data.audioDuration
    const timer = setInterval(() => {
      const newTime = this.data.audioCurrentTime + 1
      const progress = (newTime / duration) * 100
      
      if (newTime >= duration) {
        this.setData({
          isPlaying: false,
          audioCurrentTime: 0,
          audioProgress: 0
        })
        this.stopAudioTimer()
      } else {
        this.setData({
          audioCurrentTime: newTime,
          audioProgress: progress
        })
      }
    }, 1000)
    
    this.setData({
      audioTimer: timer
    })
  },

  // 停止音频计时器
  stopAudioTimer: function() {
    if (this.data.audioTimer) {
      clearInterval(this.data.audioTimer)
      this.setData({
        audioTimer: null
      })
    }
  },

  // 选择选项
  selectOption: function(e) {
    const index = e.currentTarget.dataset.index
    const optionStyles = this.data.optionStyles.map(() => '')
    optionStyles[index] = 'background: #bbdefb; border-color: #2196f3;'
    
    this.setData({
      selectedOption: index,
      optionStyles: optionStyles
    })
  },

  // 提交答案
  submitAnswer: function() {
    if (this.data.selectedOption === -1) {
      wx.showToast({
        title: '请先选择一个答案',
        icon: 'none'
      })
      return
    }
    
    const isCorrect = this.data.selectedOption === this.data.currentQuestion.correctAnswer
    
    if (isCorrect) {
      this.setData({
        score: this.data.score + 12,
        resultTitle: '回答正确！',
        resultIcon: '🎉',
        resultDescription: `正确答案: ${this.data.currentQuestion.options[this.data.currentQuestion.correctAnswer]}`,
        showResult: true
      })
    } else {
      this.setData({
        resultTitle: '回答错误',
        resultIcon: '😢',
        resultDescription: `正确答案: ${this.data.currentQuestion.options[this.data.currentQuestion.correctAnswer]}`,
        showResult: true
      })
    }
  },

  // 下一题
  nextQuestion: function() {
    const nextIndex = this.data.currentIndex
    
    if (nextIndex < this.data.totalQuestions) {
      this.setData({
        currentIndex: nextIndex + 1
      })
      this.loadQuestion(nextIndex)
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