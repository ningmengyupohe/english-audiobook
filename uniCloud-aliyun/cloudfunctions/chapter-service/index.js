// cloudfunctions/chapter-service/index.js
'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;
const Response = require('./common/response');
const Utils = require('./common/utils');
const Auth = require('./common/auth');

exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    // 公开接口（不需要登录）
    const publicActions = ['getChapterList', 'getChapterDetail', 'getNextChapter'];
    
    // 需要登录的接口
    if (!publicActions.includes(action)) {
      const user = await Auth.middleware(event);
      event.user = user;
    }

    // 路由到对应的处理函数
    switch (action) {
      case 'getChapterList':
        return await getChapterList(data);
      case 'getChapterDetail':
        return await getChapterDetail(data);
      case 'getNextChapter':
        return await getNextChapter(data);
      case 'getSubtitle':
        return await getSubtitle(data);
      case 'likeChapter':
        return await likeChapter(event.user._id, data);
      case 'updateListenProgress':
        return await updateListenProgress(event.user._id, data);
      case 'downloadChapter':
        return await downloadChapter(event.user._id, data);
      case 'addChapter':
        return await addChapter(data);
      case 'updateChapter':
        return await updateChapter(data);
      case 'deleteChapter':
        return await deleteChapter(data);
      default:
        return Response.error('未知的操作类型', 400);
    }
  } catch (error) {
    console.error('章节服务错误:', error);
    return Response.error(error.message);
  }
};

// 获取章节列表
async function getChapterList(data) {
  const { bookId, page = 1, pageSize = 20 } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const { skip, limit } = Utils.handlePagination(page, pageSize);
  const chapterCollection = db.collection('book-chapter');

  const [chaptersResult, totalResult] = await Promise.all([
    chapterCollection
      .where({ bookId })
      .orderBy('sort', 'asc')
      .skip(skip)
      .limit(limit)
      .field({
        _id: true,
        title: true,
        duration: true,
        fileSize: true,
        sort: true,
        isFree: true,
        wordCount: true,
        likeCount: true
      })
      .get(),
    chapterCollection.where({ bookId }).count()
  ]);

  // 获取书籍信息
  const bookCollection = db.collection('book-info');
  const bookResult = await bookCollection.doc(bookId).get();
  const book = bookResult.data[0] || {};

  return Response.success({
    list: chaptersResult.data,
    bookInfo: {
      title: book.title,
      author: book.author,
      cover: book.cover,
      totalChapters: book.totalChapters
    },
    pagination: {
      page,
      pageSize,
      total: totalResult.total,
      totalPages: Math.ceil(totalResult.total / pageSize)
    }
  });
}

// 获取章节详情
async function getChapterDetail(data) {
  const { chapterId } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const chapterCollection = db.collection('book-chapter');
  const bookCollection = db.collection('book-info');

  // 获取章节信息
  const chapterResult = await chapterCollection.doc(chapterId).get();
  if (chapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  const chapter = chapterResult.data[0];

  // 获取书籍信息
  const bookResult = await bookCollection.doc(chapter.bookId).get();
  const book = bookResult.data[0] || {};

  // 获取上一章和下一章
  const [prevChapterResult, nextChapterResult] = await Promise.all([
    chapterCollection
      .where({ 
        bookId: chapter.bookId,
        sort: $.lt(chapter.sort)
      })
      .orderBy('sort', 'desc')
      .limit(1)
      .field({ _id: true, title: true, sort: true })
      .get(),
    chapterCollection
      .where({ 
        bookId: chapter.bookId,
        sort: $.gt(chapter.sort)
      })
      .orderBy('sort', 'asc')
      .limit(1)
      .field({ _id: true, title: true, sort: true })
      .get()
  ]);

  // 解析字幕（如果存在）
  let subtitle = [];
  try {
    if (chapter.subtitle) {
      subtitle = JSON.parse(chapter.subtitle);
    }
  } catch (error) {
    console.error('解析字幕失败:', error);
  }

  return Response.success({
    ...chapter,
    subtitle,
    bookInfo: {
      _id: book._id,
      title: book.title,
      author: book.author,
      cover: book.cover
    },
    navigation: {
      prevChapter: prevChapterResult.data[0] || null,
      nextChapter: nextChapterResult.data[0] || null
    }
  });
}

// 获取下一章
async function getNextChapter(data) {
  const { chapterId } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const chapterCollection = db.collection('book-chapter');

  // 获取当前章节信息
  const currentChapterResult = await chapterCollection.doc(chapterId).get();
  if (currentChapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  const currentChapter = currentChapterResult.data[0];

  // 获取下一章
  const nextChapterResult = await chapterCollection
    .where({ 
      bookId: currentChapter.bookId,
      sort: $.gt(currentChapter.sort)
    })
    .orderBy('sort', 'asc')
    .limit(1)
    .get();

  if (nextChapterResult.data.length === 0) {
    return Response.success(null, '已经是最后一章了');
  }

  return Response.success(nextChapterResult.data[0]);
}

// 获取字幕内容
async function getSubtitle(data) {
  const { chapterId } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const chapterCollection = db.collection('book-chapter');

  const chapterResult = await chapterCollection.doc(chapterId).get();
  if (chapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  const chapter = chapterResult.data[0];

  try {
    const subtitle = chapter.subtitle ? JSON.parse(chapter.subtitle) : [];
    return Response.success({
      subtitle,
      duration: chapter.duration,
      wordCount: chapter.wordCount
    });
  } catch (error) {
    return Response.error('字幕解析失败');
  }
}

// 点赞章节
async function likeChapter(userId, data) {
  const { chapterId } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const db = uniCloud.database();
  const chapterCollection = db.collection('book-chapter');
  const likeCollection = db.collection('user-like');

  // 检查章节是否存在
  const chapterResult = await chapterCollection.doc(chapterId).get();
  if (chapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  // 检查是否已点赞
  const existLike = await likeCollection.where({
    userId,
    targetType: '章节',
    targetId: chapterId
  }).get();

  if (existLike.data.length > 0) {
    return Response.error('已经点赞过了');
  }

  // 开始事务操作
  const transaction = await db.startTransaction();
  
  try {
    // 添加点赞记录
    await transaction.collection('user-like').add({
      userId,
      targetType: '章节',
      targetId: chapterId,
      likeTime: Date.now()
    });

    // 更新章节点赞数
    await transaction.collection('book-chapter').doc(chapterId).update({
      likeCount: $.inc(1),
      updateTime: Date.now()
    });

    await transaction.commit();
    
    return Response.success(null, '点赞成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 更新收听进度
async function updateListenProgress(userId, data) {
  const { chapterId, progress, duration, completed = false } = data;

  if (!chapterId || progress === undefined) {
    return Response.validationError('章节ID和进度不能为空');
  }

  const db = uniCloud.database();
  const historyCollection = db.collection('user-listen-history');
  const chapterCollection = db.collection('book-chapter');
  const preferenceCollection = db.collection('user-preference');

  // 检查章节是否存在
  const chapterResult = await chapterCollection.doc(chapterId).get();
  if (chapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  const chapter = chapterResult.data[0];

  // 开始事务操作
  const transaction = await db.startTransaction();
  
  try {
    // 更新或创建收听历史
    const existHistory = await transaction.collection('user-listen-history').where({
      userId,
      chapterId
    }).get();

    if (existHistory.data.length > 0) {
      // 更新现有记录
      await transaction.collection('user-listen-history').doc(existHistory.data[0]._id).update({
        progress,
        duration: duration || chapter.duration,
        completed,
        listenTime: Date.now()
      });
    } else {
      // 创建新记录
      await transaction.collection('user-listen-history').add({
        userId,
        chapterId,
        bookId: chapter.bookId,
        progress,
        duration: duration || chapter.duration,
        completed,
        listenTime: Date.now()
      });

      // 更新用户累计收听时间
      await transaction.collection('user-preference').where({ userId }).update({
        totalListenTime: $.inc(progress),
        lastUpdateTime: Date.now()
      });
    }

    // 如果是完成收听，检查是否完成整本书
    if (completed) {
      await checkBookCompletion(userId, chapter.bookId, transaction);
    }

    await transaction.commit();
    
    return Response.success(null, '进度更新成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 检查是否完成整本书
async function checkBookCompletion(userId, bookId, transaction) {
  const historyCollection = transaction.collection('user-listen-history');
  const chapterCollection = transaction.collection('book-chapter');
  const bookCollection = transaction.collection('book-info');
  const finishBookCollection = transaction.collection('user-finish-book');

  // 获取书籍所有章节
  const chaptersResult = await chapterCollection.where({ bookId }).get();
  const chapterIds = chaptersResult.data.map(chapter => chapter._id);

  // 获取用户已完成的章节
  const finishedChaptersResult = await historyCollection.where({
    userId,
    chapterId: db.command.in(chapterIds),
    completed: true
  }).get();

  // 检查是否所有章节都已完成
  if (finishedChaptersResult.data.length >= chaptersResult.data.length) {
    const bookResult = await bookCollection.doc(bookId).get();
    const book = bookResult.data[0];

    // 检查是否已记录完成
    const existFinish = await finishBookCollection.where({
      userId,
      bookId
    }).get();

    if (existFinish.data.length === 0) {
      // 记录完成
      const totalTimeSpent = finishedChaptersResult.data.reduce((sum, history) => sum + (history.duration || 0), 0);

      await finishBookCollection.add({
        userId,
        bookId,
        finishTime: Date.now(),
        totalTimeSpent,
        chaptersCompleted: finishedChaptersResult.data.length
      });
    }
  }
}

// 下载章节
async function downloadChapter(userId, data) {
  const { chapterId } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const db = uniCloud.database();
  const chapterCollection = db.collection('book-chapter');
  const downloadCollection = db.collection('user-download');

  // 检查章节是否存在
  const chapterResult = await chapterCollection.doc(chapterId).get();
  if (chapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  const chapter = chapterResult.data[0];

  // 检查是否已下载
  const existDownload = await downloadCollection.where({
    userId,
    chapterId
  }).get();

  if (existDownload.data.length > 0) {
    return Response.success({ url: chapter.audioUrl }, '已下载过');
  }

  // 记录下载
  await downloadCollection.add({
    userId,
    chapterId,
    bookId: chapter.bookId,
    downloadTime: Date.now(),
    fileSize: chapter.fileSize,
    localPath: `downloads/${chapterId}.mp3`
  });

  return Response.success({ 
    url: chapter.audioUrl,
    fileSize: chapter.fileSize,
    duration: chapter.duration
  }, '开始下载');
}

// 添加章节（管理员功能）
async function addChapter(data) {
  const { bookId, title, audioUrl, duration, sort, subtitle, isFree = true } = data;

  if (!bookId || !title || !audioUrl || !duration) {
    return Response.validationError('书籍ID、标题、音频URL和时长为必填项');
  }

  const db = uniCloud.database();
  const chapterCollection = db.collection('book-chapter');
  const bookCollection = db.collection('book-info');

  // 检查书籍是否存在
  const bookResult = await bookCollection.doc(bookId).get();
  if (bookResult.data.length === 0) {
    return Response.notFound('书籍不存在');
  }

  // 确定排序序号
  let chapterSort = sort;
  if (!chapterSort) {
    const lastChapterResult = await chapterCollection
      .where({ bookId })
      .orderBy('sort', 'desc')
      .limit(1)
      .get();
    
    chapterSort = lastChapterResult.data.length > 0 ? lastChapterResult.data[0].sort + 1 : 1;
  }

  // 计算单词数（根据字幕）
  let wordCount = 0;
  if (subtitle) {
    try {
      const subtitleObj = typeof subtitle === 'string' ? JSON.parse(subtitle) : subtitle;
      wordCount = subtitleObj.reduce((count, item) => {
        return count + (item.text?.split(' ').length || 0);
      }, 0);
    } catch (error) {
      console.error('计算单词数失败:', error);
    }
  }

  // 创建章节
  const chapterData = {
    bookId,
    title,
    audioUrl,
    duration,
    sort: chapterSort,
    subtitle: typeof subtitle === 'string' ? subtitle : JSON.stringify(subtitle),
    wordCount,
    isFree,
    likeCount: 0,
    createTime: Date.now()
  };

  const result = await chapterCollection.add(chapterData);

  // 更新书籍信息
  const transaction = await db.startTransaction();
  
  try {
    // 更新书籍总章节数
    await transaction.collection('book-info').doc(bookId).update({
      totalChapters: $.inc(1),
      totalDuration: $.inc(duration),
      updateTime: Date.now()
    });

    await transaction.commit();
    
    return Response.success({ chapterId: result.id }, '章节添加成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 更新章节（管理员功能）
async function updateChapter(data) {
  const { chapterId, ...updateData } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const chapterCollection = db.collection('book-chapter');

  // 如果更新了时长，需要同步更新书籍总时长
  if (updateData.duration) {
    const db = uniCloud.database();
    const transaction = await db.startTransaction();
    
    try {
      // 获取原章节信息
      const oldChapterResult = await transaction.collection('book-chapter').doc(chapterId).get();
      const oldChapter = oldChapterResult.data[0];

      // 更新章节
      await transaction.collection('book-chapter').doc(chapterId).update(updateData);

      // 更新书籍总时长（计算差值）
      const durationDiff = updateData.duration - (oldChapter.duration || 0);
      if (durationDiff !== 0) {
        await transaction.collection('book-info').doc(oldChapter.bookId).update({
          totalDuration: $.inc(durationDiff),
          updateTime: Date.now()
        });
      }

      await transaction.commit();
      
      return Response.success(null, '章节更新成功');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    // 普通更新
    await chapterCollection.doc(chapterId).update(updateData);
    return Response.success(null, '章节更新成功');
  }
}

// 删除章节（管理员功能）
async function deleteChapter(data) {
  const { chapterId } = data;

  if (!chapterId) {
    return Response.validationError('章节ID不能为空');
  }

  const db = uniCloud.database();
  const chapterCollection = db.collection('book-chapter');

  // 获取章节信息
  const chapterResult = await chapterCollection.doc(chapterId).get();
  if (chapterResult.data.length === 0) {
    return Response.notFound('章节不存在');
  }

  const chapter = chapterResult.data[0];

  // 开始事务操作
  const transaction = await db.startTransaction();
  
  try {
    // 删除章节
    await transaction.collection('book-chapter').doc(chapterId).remove();

    // 更新书籍信息
    await transaction.collection('book-info').doc(chapter.bookId).update({
      totalChapters: $.inc(-1),
      totalDuration: $.inc(-(chapter.duration || 0)),
      updateTime: Date.now()
    });

    // 删除相关记录（可选）
    // await transaction.collection('user-listen-history').where({ chapterId }).remove();
    // await transaction.collection('user-download').where({ chapterId }).remove();
    // await transaction.collection('user-like').where({ targetType: '章节', targetId: chapterId }).remove();

    await transaction.commit();
    
    return Response.success(null, '章节删除成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}