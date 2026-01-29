// cloudfunctions/player-service/index.js - 完整修复版
'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;
const Response = require('./common/response');

exports.main = async (event, context) => {
  console.log('🎯 收到播放服务请求:', JSON.stringify(event, null, 2));
  
  let action, data, _timestamp, _platform;
  
  // 🚨 修复：正确解析参数
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      action = body.action;
      data = body.data || {};
      _timestamp = body._timestamp;
      _platform = body._platform;
    } catch (e) {
      console.error('解析请求体失败:', e);
      return Response.error('请求参数格式错误', 400);
    }
  } else {
    action = event.action;
    data = event.data || {};
    _timestamp = event._timestamp;
    _platform = event._platform;
  }
  
  console.log(`🎯 处理播放服务请求，操作: ${action}`);
  
  try {
    // 🚨 关键修复：接受前端传入的userId，但不进行登录验证
    let userId = data.userId || 0;
    
    console.log(`用户ID: ${userId || '未登录用户或未提供用户ID'}, 操作: ${action}`);
    
    switch (action) {
      case 'getPlayHistory':
        return await getPlayHistory(userId, data);
      case 'savePlayProgress':
        return await savePlayProgress(userId, data);
      case 'getContinuePlay':
        return await getContinuePlay(userId);
      case 'clearPlayHistory':
        return await clearPlayHistory(userId, data);
      case 'getPlayStatistics':
        return await getPlayStatistics(userId, data);
      case 'getRecentlyPlayed':
        return await getRecentlyPlayed(userId, data);
      default:
        return Response.error('未知的操作类型', 400);
    }
  } catch (error) {
    console.error('播放服务错误:', error);
    return Response.error(error.message || '服务器内部错误');
  }
};

// 获取播放历史
async function getPlayHistory(userId, data) {
  const { page = 1, pageSize = 20 } = data;
  
  // 🚨 修复：允许未登录用户
  if (!userId) {
    userId = 0;
  }
  
  const historyCollection = db.collection('user-listen-history');
  const chapterCollection = db.collection('book-chapter');
  const bookCollection = db.collection('book-info');

  const skip = (page - 1) * pageSize;
  const limit = parseInt(pageSize);

  try {
    // 获取播放历史
    const historyResult = await historyCollection
      .where({ userId: Number(userId) })
      .orderBy('listenTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    if (historyResult.data.length === 0) {
      return Response.success({
        list: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 }
      });
    }

    // 获取章节和书籍信息
    const chapterIds = historyResult.data.map(h => h.chapterId);
    const chaptersResult = await chapterCollection
      .where({ _id: db.command.in(chapterIds) })
      .get();

    const bookIds = chaptersResult.data.map(c => c.bookId);
    const booksResult = await bookCollection
      .where({ _id: db.command.in(bookIds) })
      .get();

    // 构建映射
    const chapterMap = {};
    chaptersResult.data.forEach(chapter => {
      chapterMap[chapter._id] = chapter;
    });

    const bookMap = {};
    booksResult.data.forEach(book => {
      bookMap[book._id] = book;
    });

    // 组合数据
    const list = historyResult.data.map(history => {
      const chapter = chapterMap[history.chapterId] || {};
      const book = bookMap[chapter.bookId] || {};
      
      return {
        ...history,
        chapterTitle: chapter.title,
        chapterDuration: chapter.duration,
        bookTitle: book.title,
        bookCover: book.cover,
        bookAuthor: book.author
      };
    });

    // 获取总数
    const totalResult = await historyCollection.where({ userId: Number(userId) }).count();

    return Response.success({
      list,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取播放历史失败:', error);
    return Response.error('获取播放历史失败');
  }
}

// 保存播放进度
async function savePlayProgress(userId, data) {
  const { chapterId, progress, duration, completed } = data;

  if (!chapterId || progress === undefined) {
    return Response.validationError('章节ID和进度不能为空');
  }
  
  // 🚨 修复：允许未登录用户
  if (!userId) {
    userId = 0;
  }

  const historyCollection = db.collection('user-listen-history');
  const preferenceCollection = db.collection('user-preference');

  // 检查是否已有记录
  const existHistory = await historyCollection.where({
    userId: Number(userId),
    chapterId: chapterId
  }).get();

  const historyData = {
    userId: Number(userId),
    chapterId: chapterId,
    progress: Number(progress),
    duration: duration ? Number(duration) : 0,
    completed: completed || false,
    listenTime: Date.now()
  };

  const transaction = await db.startTransaction();
  
  try {
    if (existHistory.data.length > 0) {
      // 更新现有记录
      await transaction.collection('user-listen-history')
        .doc(existHistory.data[0]._id)
        .update(historyData);
    } else {
      // 创建新记录
      await transaction.collection('user-listen-history')
        .add(historyData);

      // 只有登录用户才更新偏好统计
      if (userId > 0 && progress > 0) {
        const prefExist = await preferenceCollection.where({ userId: Number(userId) }).get();
        if (prefExist.data.length > 0) {
          await transaction.collection('user-preference')
            .doc(prefExist.data[0]._id)
            .update({
              totalListenTime: $.inc(Number(progress)),
              lastUpdateTime: Date.now()
            });
        } else {
          await transaction.collection('user-preference')
            .add({
              userId: Number(userId),
              totalListenTime: Number(progress),
              lastUpdateTime: Date.now(),
              createTime: Date.now()
            });
        }
      }
    }

    await transaction.commit();
    return Response.success({ saved: true }, '进度保存成功');
  } catch (error) {
    await transaction.rollback();
    console.error('保存播放进度失败:', error);
    throw error;
  }
}

// 获取继续播放（上次未听完的）
async function getContinuePlay(userId) {
  // 🚨 修复：允许未登录用户
  if (!userId) {
    userId = 0;
  }
  
  const historyCollection = db.collection('user-listen-history');
  const chapterCollection = db.collection('book-chapter');
  const bookCollection = db.collection('book-info');

  try {
    // 查找最近未听完的记录
    const historyResult = await historyCollection
      .where({
        userId: Number(userId),
        completed: false,
        progress: $.gt(0)
      })
      .orderBy('listenTime', 'desc')
      .limit(1)
      .get();

    if (historyResult.data.length === 0) {
      return Response.success(null, '没有待继续的播放记录');
    }

    const history = historyResult.data[0];

    // 获取章节和书籍信息
    const [chapterResult, bookResult] = await Promise.all([
      chapterCollection.doc(history.chapterId).get(),
      bookCollection.where({
        _id: history.bookId || ''
      }).get()
    ]);

    if (chapterResult.data.length === 0) {
      return Response.notFound('章节不存在');
    }

    const chapter = chapterResult.data[0];
    const book = bookResult.data[0] || {};

    return Response.success({
      historyId: history._id,
      chapterId: chapter._id,
      bookId: chapter.bookId,
      chapterTitle: chapter.title,
      bookTitle: book.title || '',
      bookCover: book.cover || '',
      progress: history.progress,
      duration: chapter.duration,
      audioUrl: chapter.audioUrl,
      listenTime: history.listenTime
    });
  } catch (error) {
    console.error('获取继续播放失败:', error);
    return Response.error('获取继续播放失败');
  }
}

// 清空播放历史
async function clearPlayHistory(userId, data) {
  // 🚨 修复：允许未登录用户
  if (!userId) {
    userId = 0;
  }
  
  const { clearType = 'all' } = data;

  const historyCollection = db.collection('user-listen-history');
  let query = { userId: Number(userId) };

  if (clearType === 'completed') {
    query.completed = true;
  }

  try {
    const result = await historyCollection.where(query).remove();
    return Response.success({
      deletedCount: result.deleted
    }, `已清除${clearType === 'all' ? '全部' : '已完成的'}播放记录`);
  } catch (error) {
    console.error('清空播放历史失败:', error);
    return Response.error('清空播放历史失败');
  }
}

// 获取播放统计
async function getPlayStatistics(userId, data) {
  // 🚨 修复：允许未登录用户
  if (!userId) {
    userId = 0;
  }
  
  const { startDate, endDate } = data;
  
  const historyCollection = db.collection('user-listen-history');
  const preferenceCollection = db.collection('user-preference');

  // 构建时间查询条件
  let timeQuery = {};
  if (startDate || endDate) {
    timeQuery.listenTime = {};
    if (startDate) timeQuery.listenTime.$gte = new Date(startDate);
    if (endDate) timeQuery.listenTime.$lte = new Date(endDate);
  }

  const query = { userId: Number(userId), ...timeQuery };

  try {
    // 获取统计数据
    const [totalResult, completedResult, dailyStats] = await Promise.all([
      historyCollection.where(query).count(),
      historyCollection.where({ ...query, completed: true }).count(),
      getDailyPlayStats(Number(userId), startDate, endDate)
    ]);

    // 只有登录用户才获取偏好统计
    let totalListenTime = 0;
    let dailyGoal = 30;
    
    if (userId > 0) {
      const preferenceResult = await preferenceCollection.where({ userId: Number(userId) }).get();
      const preference = preferenceResult.data[0] || {};
      totalListenTime = preference.totalListenTime || 0;
      dailyGoal = preference.dailyGoal || 30;
    }

    return Response.success({
      totalPlays: totalResult.total,
      completedPlays: completedResult.total,
      totalListenTime: totalListenTime,
      dailyGoal: dailyGoal,
      dailyStats: dailyStats,
      completionRate: totalResult.total > 0 
        ? Math.round((completedResult.total / totalResult.total) * 100) 
        : 0
    });
  } catch (error) {
    console.error('获取播放统计失败:', error);
    return Response.error('获取播放统计失败');
  }
}

// 获取每日播放统计
async function getDailyPlayStats(userId, startDate, endDate) {
  if (!userId) {
    userId = 0;
  }
  
  const historyCollection = db.collection('user-listen-history');
  
  const pipeline = [
    { $match: { userId: Number(userId) } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $toDate: "$listenTime" }
          }
        },
        totalTime: { $sum: "$progress" },
        playCount: { $sum: 1 },
        completedCount: {
          $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 30 }
  ];

  try {
    const result = await historyCollection.aggregate(pipeline);
    return result;
  } catch (error) {
    console.error('获取每日播放统计失败:', error);
    return [];
  }
}

// 获取最近播放
async function getRecentlyPlayed(userId, data) {
  // 🚨 修复：允许未登录用户
  if (!userId) {
    userId = 0;
  }
  
  const { limit = 10 } = data;
  
  const historyCollection = db.collection('user-listen-history');
  const chapterCollection = db.collection('book-chapter');
  const bookCollection = db.collection('book-info');

  try {
    // 获取最近播放记录
    const historyResult = await historyCollection
      .where({ userId: Number(userId) })
      .orderBy('listenTime', 'desc')
      .limit(limit)
      .get();

    if (historyResult.data.length === 0) {
      return Response.success([]);
    }

    // 去重章节ID
    const chapterIds = [...new Set(historyResult.data.map(h => h.chapterId))];
    
    // 获取章节和书籍信息
    const chaptersResult = await chapterCollection
      .where({ _id: db.command.in(chapterIds) })
      .get();

    const bookIds = [...new Set(chaptersResult.data.map(c => c.bookId))];
    const booksResult = await bookCollection
      .where({ _id: db.command.in(bookIds) })
      .get();

    // 构建映射
    const chapterMap = {};
    chaptersResult.data.forEach(chapter => {
      chapterMap[chapter._id] = chapter;
    });

    const bookMap = {};
    booksResult.data.forEach(book => {
      bookMap[book._id] = book;
    });

    // 组合数据
    const recentPlays = historyResult.data.map(history => {
      const chapter = chapterMap[history.chapterId] || {};
      const book = bookMap[chapter.bookId] || {};
      
      return {
        historyId: history._id,
        chapterId: history.chapterId,
        bookId: chapter.bookId,
        chapterTitle: chapter.title,
        bookTitle: book.title,
        bookCover: book.cover,
        bookAuthor: book.author,
        progress: history.progress,
        duration: chapter.duration,
        completed: history.completed,
        listenTime: history.listenTime
      };
    });

    return Response.success(recentPlays);
  } catch (error) {
    console.error('获取最近播放失败:', error);
    return Response.error('获取最近播放失败');
  }
}