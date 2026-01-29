// cloudfunctions/game-service/index.js
'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;
const Response = require('./common/response');
const Auth = require('./common/auth');

exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    // 公开接口
    const publicActions = ['getGameList', 'getGameDetail', 'getGameRank'];
    
    // 需要登录的接口
    if (!publicActions.includes(action)) {
      const user = await Auth.middleware(event);
      event.user = user;
    }

    switch (action) {
      case 'getGameList':
        return await getGameList(data);
      case 'getGameDetail':
        return await getGameDetail(data);
      case 'playGame':
        return await playGame(event.user._id, data);
      case 'getGameRecord':
        return await getGameRecord(event.user._id, data);
      case 'getGameRank':
        return await getGameRank(data);
      case 'getUserGameStats':
        return await getUserGameStats(event.user._id);
      case 'updateGameScore':
        return await updateGameScore(event.user._id, data);
      case 'getDailyChallenge':
        return await getDailyChallenge();
      case 'submitGameResult':
        return await submitGameResult(event.user._id, data);
      default:
        return Response.error('未知的操作类型', 400);
    }
  } catch (error) {
    console.error('游戏服务错误:', error);
    return Response.error(error.message);
  }
};

// 获取游戏列表
async function getGameList(data) {
  const { gameType, difficulty } = data;
  
  const gameCollection = db.collection('game-info');
  let query = gameCollection.where({ isActive: true });

  if (gameType) {
    query = query.where({ gameType });
  }

  if (difficulty) {
    query = query.where({ difficulty });
  }

  const result = await query
    .orderBy('sort', 'asc')
    .field({
      _id: true,
      name: true,
      icon: true,
      description: true,
      gameType: true,
      difficulty: true,
      maxScore: true
    })
    .get();

  return Response.success(result.data);
}

// 获取游戏详情
async function getGameDetail(data) {
  const { gameId } = data;

  if (!gameId) {
    return Response.validationError('游戏ID不能为空');
  }

  const gameCollection = db.collection('game-info');
  
  const result = await gameCollection.doc(gameId).get();
  if (result.data.length === 0) {
    return Response.notFound('游戏不存在');
  }

  return Response.success(result.data[0]);
}

// 玩游戏（记录开始）
async function playGame(userId, data) {
  const { gameId } = data;

  if (!gameId) {
    return Response.validationError('游戏ID不能为空');
  }

  const gameCollection = db.collection('game-info');
  
  const gameResult = await gameCollection.doc(gameId).get();
  if (gameResult.data.length === 0) {
    return Response.notFound('游戏不存在');
  }

  // 这里可以记录游戏开始时间，返回游戏配置等
  const game = gameResult.data[0];

  return Response.success({
    gameId: game._id,
    gameName: game.name,
    gameType: game.gameType,
    rules: game.rules,
    maxScore: game.maxScore,
    startTime: Date.now()
  }, '游戏开始');
}

// 获取游戏记录
async function getGameRecord(userId, data) {
  const { gameId, page = 1, pageSize = 10 } = data;
  
  const { skip, limit } = Utils.handlePagination(page, pageSize);
  const recordCollection = db.collection('user-game-record');

  let query = recordCollection.where({ userId });
  if (gameId) {
    query = query.where({ gameId });
  }

  const [recordsResult, totalResult] = await Promise.all([
    query
      .orderBy('playDate', 'desc')
      .skip(skip)
      .limit(limit)
      .get(),
    query.count()
  ]);

  // 获取游戏信息
  if (recordsResult.data.length > 0) {
    const gameIds = [...new Set(recordsResult.data.map(r => r.gameId))];
    const gameCollection = db.collection('game-info');
    const gamesResult = await gameCollection
      .where({ _id: db.command.in(gameIds) })
      .get();

    const gameMap = {};
    gamesResult.data.forEach(game => {
      gameMap[game._id] = game;
    });

    const list = recordsResult.data.map(record => ({
      ...record,
      gameInfo: gameMap[record.gameId]
    }));

    return Response.success({
      list,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  }

  return Response.success({
    list: [],
    pagination: { page, pageSize, total: 0, totalPages: 0 }
  });
}

// 获取游戏排行榜
async function getGameRank(data) {
  const { gameId, rankType = '日榜', limit = 50 } = data;

  if (!gameId) {
    return Response.validationError('游戏ID不能为空');
  }

  const rankCollection = db.collection('game-rank');
  const userCollection = db.collection('user');

  // 构建查询条件
  let query = rankCollection.where({ gameId, rankType });
  
  // 根据排行榜类型确定时间范围
  const now = new Date();
  let startDate;
  
  switch (rankType) {
    case '日榜':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case '周榜':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      break;
    case '月榜':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      // 总榜不需要时间限制
  }

  if (startDate) {
    query = query.where({ rankDate: db.command.gte(startDate) });
  }

  const rankResult = await query
    .orderBy('score', 'desc')
    .orderBy('updateTime', 'desc')
    .limit(limit)
    .get();

  if (rankResult.data.length === 0) {
    return Response.success([]);
  }

  // 获取用户信息
  const userIds = rankResult.data.map(r => r.userId);
  const usersResult = await userCollection
    .where({ _id: db.command.in(userIds) })
    .field({
      _id: true,
      username: true,
      avatar: true,
      level: true
    })
    .get();

  const userMap = {};
  usersResult.data.forEach(user => {
    userMap[user._id] = user;
  });

  // 组合数据
  const rankList = rankResult.data.map((rank, index) => ({
    rank: index + 1,
    score: rank.score,
    userInfo: userMap[rank.userId] || { username: '未知用户' },
    updateTime: rank.updateTime
  }));

  return Response.success(rankList);
}

// 获取用户游戏统计
async function getUserGameStats(userId) {
  const recordCollection = db.collection('user-game-record');

  const pipeline = [
    { $match: { userId } },
    {
      $group: {
        _id: "$gameId",
        totalPlays: { $sum: 1 },
        totalScore: { $sum: "$score" },
        bestScore: { $max: "$score" },
        lastPlay: { $max: "$playDate" }
      }
    }
  ];

  const statsResult = await recordCollection.aggregate(pipeline);

  // 获取游戏信息
  if (statsResult.length > 0) {
    const gameIds = statsResult.map(s => s._id);
    const gameCollection = db.collection('game-info');
    const gamesResult = await gameCollection
      .where({ _id: db.command.in(gameIds) })
      .get();

    const gameMap = {};
    gamesResult.data.forEach(game => {
      gameMap[game._id] = game;
    });

    const stats = statsResult.map(stat => ({
      gameId: stat._id,
      gameInfo: gameMap[stat._id],
      totalPlays: stat.totalPlays,
      totalScore: stat.totalScore,
      bestScore: stat.bestScore,
      lastPlay: stat.lastPlay,
      averageScore: stat.totalPlays > 0 ? Math.round(stat.totalScore / stat.totalPlays) : 0
    }));

    // 计算总体统计
    const totalStats = {
      totalGamesPlayed: stats.reduce((sum, s) => sum + s.totalPlays, 0),
      totalGames: stats.length,
      bestScore: Math.max(...stats.map(s => s.bestScore)),
      totalScore: stats.reduce((sum, s) => sum + s.totalScore, 0)
    };

    return Response.success({
      stats,
      total: totalStats
    });
  }

  return Response.success({
    stats: [],
    total: {
      totalGamesPlayed: 0,
      totalGames: 0,
      bestScore: 0,
      totalScore: 0
    }
  });
}

// 更新游戏分数
async function updateGameScore(userId, data) {
  const { gameId, score, level = 1, playTime, extraData } = data;

  if (!gameId || score === undefined) {
    return Response.validationError('游戏ID和分数不能为空');
  }

  const db = uniCloud.database();
  const recordCollection = db.collection('user-game-record');
  const rankCollection = db.collection('game-rank');
  const gameCollection = db.collection('game-info');

  // 检查游戏是否存在
  const gameResult = await gameCollection.doc(gameId).get();
  if (gameResult.data.length === 0) {
    return Response.notFound('游戏不存在');
  }

  const game = gameResult.data[0];

  // 检查分数是否超过上限
  if (score > game.maxScore) {
    return Response.error(`分数不能超过${game.maxScore}`);
  }

  const recordData = {
    userId,
    gameId,
    score,
    level,
    playTime: playTime || 0,
    playDate: Date.now(),
    extraData: extraData || {}
  };

  const transaction = await db.startTransaction();
  
  try {
    // 保存游戏记录
    const recordResult = await transaction.collection('user-game-record').add(recordData);

    // 更新排行榜
    await updateRankList(userId, gameId, score, transaction);

    await transaction.commit();
    
    return Response.success({
      recordId: recordResult.id,
      score,
      rank: await getUserRank(userId, gameId)
    }, '分数保存成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 更新排行榜
async function updateRankList(userId, gameId, score, transaction) {
  const now = new Date();
  const rankTypes = ['日榜', '周榜', '月榜', '总榜'];

  for (const rankType of rankTypes) {
    let rankDate;
    
    switch (rankType) {
      case '日榜':
        rankDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '周榜':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        rankDate = new Date(now.getFullYear(), now.getMonth(), diff);
        break;
      case '月榜':
        rankDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '总榜':
        rankDate = new Date(0); // 总榜使用固定日期
        break;
    }

    // 检查是否已有记录
    const existRank = await transaction.collection('game-rank').where({
      userId,
      gameId,
      rankType,
      rankDate
    }).get();

    if (existRank.data.length > 0) {
      // 更新现有记录（只保留最高分）
      if (score > existRank.data[0].score) {
        await transaction.collection('game-rank').doc(existRank.data[0]._id).update({
          score,
          updateTime: Date.now()
        });
      }
    } else {
      // 创建新记录
      await transaction.collection('game-rank').add({
        userId,
        gameId,
        score,
        rankType,
        rankDate,
        updateTime: Date.now()
      });
    }
  }
}

// 获取用户排名
async function getUserRank(userId, gameId) {
  const rankCollection = db.collection('game-rank');
  
  // 获取用户的总榜记录
  const userRank = await rankCollection.where({
    userId,
    gameId,
    rankType: '总榜'
  }).get();

  if (userRank.data.length === 0) {
    return null;
  }

  // 获取所有用户的总榜记录并排序
  const allRanks = await rankCollection.where({
    gameId,
    rankType: '总榜'
  })
  .orderBy('score', 'desc')
  .get();

  // 计算排名
  const userScore = userRank.data[0].score;
  let rank = 1;
  
  for (const r of allRanks.data) {
    if (r.score > userScore) {
      rank++;
    } else if (r.userId === userId) {
      break;
    }
  }

  return rank;
}

// 获取每日挑战
async function getDailyChallenge() {
  const gameCollection = db.collection('game-info');
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  // 根据日期选择游戏（确保每天不同）
  const gamesResult = await gameCollection
    .where({ isActive: true })
    .orderBy('sort', 'asc')
    .get();

  if (gamesResult.data.length === 0) {
    return Response.success(null, '暂无游戏');
  }

  const gameIndex = dayOfYear % gamesResult.data.length;
  const dailyGame = gamesResult.data[gameIndex];

  // 设置每日挑战的特殊目标
  const challenge = {
    gameId: dailyGame._id,
    gameName: dailyGame.name,
    gameType: dailyGame.gameType,
    difficulty: dailyGame.difficulty,
    targetScore: Math.floor(dailyGame.maxScore * 0.7), // 目标分数为最高分的70%
    description: `今日挑战：${dailyGame.name}`,
    reward: 100, // 完成奖励
    date: now.toISOString().split('T')[0]
  };

  return Response.success(challenge);
}

// 提交游戏结果
async function submitGameResult(userId, data) {
  const { gameId, score, level, playTime, extraData } = data;

  // 首先记录游戏分数
  const scoreResult = await updateGameScore(userId, {
    gameId,
    score,
    level,
    playTime,
    extraData
  });

  // 检查是否完成每日挑战
  const challengeResult = await checkDailyChallenge(userId, gameId, score);

  return Response.success({
    scoreResult: scoreResult.data,
    challengeResult: challengeResult.data
  }, '游戏结果提交成功');
}

// 检查每日挑战
async function checkDailyChallenge(userId, gameId, score) {
  const challenge = await getDailyChallenge();
  
  if (challenge.code === 0 && challenge.data && challenge.data.gameId === gameId) {
    if (score >= challenge.data.targetScore) {
      // 完成挑战，给予奖励
      return Response.success({
        completed: true,
        reward: challenge.data.reward,
        message: `恭喜完成每日挑战！获得${challenge.data.reward}积分`
      });
    }
  }

  return Response.success({
    completed: false,
    reward: 0,
    message: '继续努力哦！'
  });
}