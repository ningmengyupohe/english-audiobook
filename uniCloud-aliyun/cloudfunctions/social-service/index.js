// cloudfunctions/social-service/index.js
'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;
const Response = require('./common/response');
const Auth = require('./common/auth');

exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    // 公开接口
    const publicActions = ['getComments', 'getCommentDetail', 'getHotComments'];
    
    // 需要登录的接口
    if (!publicActions.includes(action)) {
      const user = await Auth.middleware(event);
      event.user = user;
    }

    switch (action) {
      case 'addComment':
        return await addComment(event.user._id, data);
      case 'replyComment':
        return await replyComment(event.user._id, data);
      case 'getComments':
        return await getComments(data);
      case 'getCommentDetail':
        return await getCommentDetail(data);
      case 'likeComment':
        return await likeComment(event.user._id, data);
      case 'reportComment':
        return await reportComment(event.user._id, data);
      case 'deleteComment':
        return await deleteComment(event.user._id, data);
      case 'getHotComments':
        return await getHotComments(data);
      case 'getUserComments':
        return await getUserComments(event.user._id, data);
      case 'updateComment':
        return await updateComment(event.user._id, data);
      default:
        return Response.error('未知的操作类型', 400);
    }
  } catch (error) {
    console.error('社交服务错误:', error);
    return Response.error(error.message);
  }
};

// 添加评论
async function addComment(userId, data) {
  const { targetType, targetId, content, parentId } = data;

  if (!targetType || !targetId || !content) {
    return Response.validationError('评论目标、内容和内容不能为空');
  }

  if (content.length > 1000) {
    return Response.validationError('评论内容不能超过1000字');
  }

  const commentCollection = db.collection('comment-info');
  const db = uniCloud.database();

  // 检查目标是否存在
  let targetExists = false;
  switch (targetType) {
    case '书籍':
      const bookResult = await db.collection('book-info').doc(targetId).get();
      targetExists = bookResult.data.length > 0;
      break;
    case '章节':
      const chapterResult = await db.collection('book-chapter').doc(targetId).get();
      targetExists = chapterResult.data.length > 0;
      break;
    case '评论':
      const parentCommentResult = await commentCollection.doc(targetId).get();
      targetExists = parentCommentResult.data.length > 0;
      break;
  }

  if (!targetExists) {
    return Response.notFound('评论目标不存在');
  }

  // 检查父评论
  if (parentId) {
    const parentResult = await commentCollection.doc(parentId).get();
    if (parentResult.data.length === 0) {
      return Response.notFound('父评论不存在');
    }
  }

  const commentData = {
    userId,
    targetType,
    targetId,
    content,
    parentId: parentId || '',
    likeCount: 0,
    replyCount: 0,
    status: '待审核', // 需要审核
    createTime: Date.now(),
    updateTime: Date.now()
  };

  const transaction = await db.startTransaction();
  
  try {
    // 添加评论
    const result = await transaction.collection('comment-info').add(commentData);

    // 如果是对评论的回复，更新父评论的回复数
    if (parentId) {
      await transaction.collection('comment-info').doc(parentId).update({
        replyCount: $.inc(1),
        updateTime: Date.now()
      });
    }

    // 更新目标的评论数
    if (targetType === '书籍') {
      await transaction.collection('book-info').doc(targetId).update({
        commentCount: $.inc(1),
        updateTime: Date.now()
      });
    }

    await transaction.commit();
    
    return Response.success({ commentId: result.id }, '评论已提交，等待审核');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 回复评论
async function replyComment(userId, data) {
  const { commentId, content } = data;

  if (!commentId || !content) {
    return Response.validationError('评论ID和内容不能为空');
  }

  const commentCollection = db.collection('comment-info');
  
  // 获取原评论
  const originalComment = await commentCollection.doc(commentId).get();
  if (originalComment.data.length === 0) {
    return Response.notFound('评论不存在');
  }

  const original = originalComment.data[0];

  // 调用添加评论，设置parentId
  return await addComment(userId, {
    targetType: '评论',
    targetId: commentId,
    content,
    parentId: commentId
  });
}

// 获取评论列表
async function getComments(data) {
  const { targetType, targetId, page = 1, pageSize = 20, sortBy = 'createTime' } = data;

  if (!targetType || !targetId) {
    return Response.validationError('评论目标不能为空');
  }

  const { skip, limit } = Utils.handlePagination(page, pageSize);
  const commentCollection = db.collection('comment-info');
  const userCollection = db.collection('user');

  // 构建查询条件
  let query = commentCollection.where({
    targetType,
    targetId,
    parentId: '', // 只获取顶级评论
    status: '通过' // 只显示审核通过的
  });

  // 排序
  const sortOptions = {};
  if (sortBy === 'hot') {
    sortOptions.likeCount = -1;
  } else {
    sortOptions[sortBy] = -1;
  }

  const [commentsResult, totalResult] = await Promise.all([
    query
      .orderBy(sortBy === 'hot' ? 'likeCount' : sortBy, 'desc')
      .skip(skip)
      .limit(limit)
      .get(),
    query.count()
  ]);

  if (commentsResult.data.length === 0) {
    return Response.success({
      list: [],
      pagination: { page, pageSize, total: 0, totalPages: 0 }
    });
  }

  // 获取用户信息和回复
  const userIds = commentsResult.data.map(c => c.userId);
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

  // 获取回复（前3条）
  const commentIds = commentsResult.data.map(c => c._id);
  const repliesResult = await commentCollection
    .where({
      parentId: db.command.in(commentIds),
      status: '通过'
    })
    .orderBy('createTime', 'asc')
    .limit(100) // 一次获取较多，然后分组
    .get();

  // 分组回复
  const replyMap = {};
  repliesResult.data.forEach(reply => {
    if (!replyMap[reply.parentId]) {
      replyMap[reply.parentId] = [];
    }
    if (replyMap[reply.parentId].length < 3) { // 每条评论只显示3条回复
      replyMap[reply.parentId].push(reply);
    }
  });

  // 获取回复的用户信息
  const replyUserIds = repliesResult.data.map(r => r.userId);
  const replyUsersResult = await userCollection
    .where({ _id: db.command.in(replyUserIds) })
    .field({ _id: true, username: true, avatar: true })
    .get();

  const replyUserMap = {};
  replyUsersResult.data.forEach(user => {
    replyUserMap[user._id] = user;
  });

  // 组合数据
  const list = commentsResult.data.map(comment => {
    const replies = (replyMap[comment._id] || []).map(reply => ({
      ...reply,
      userInfo: replyUserMap[reply.userId] || { username: '未知用户' }
    }));

    return {
      ...comment,
      userInfo: userMap[comment.userId] || { username: '未知用户' },
      replies,
      replyCount: comment.replyCount,
      hasMoreReplies: comment.replyCount > replies.length
    };
  });

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

// 获取评论详情
async function getCommentDetail(data) {
  const { commentId } = data;

  if (!commentId) {
    return Response.validationError('评论ID不能为空');
  }

  const commentCollection = db.collection('comment-info');
  const userCollection = db.collection('user');

  const commentResult = await commentCollection.doc(commentId).get();
  if (commentResult.data.length === 0) {
    return Response.notFound('评论不存在');
  }

  const comment = commentResult.data[0];

  // 获取用户信息
  const userResult = await userCollection.doc(comment.userId).get();
  const user = userResult.data[0] || {};

  // 获取所有回复（分页）
  const repliesResult = await commentCollection
    .where({
      parentId: commentId,
      status: '通过'
    })
    .orderBy('createTime', 'asc')
    .get();

  // 获取回复的用户信息
  const replyUserIds = repliesResult.data.map(r => r.userId);
  const replyUsersResult = await userCollection
    .where({ _id: db.command.in(replyUserIds) })
    .field({ _id: true, username: true, avatar: true })
    .get();

  const replyUserMap = {};
  replyUsersResult.data.forEach(u => {
    replyUserMap[u._id] = u;
  });

  const replies = repliesResult.data.map(reply => ({
    ...reply,
    userInfo: replyUserMap[reply.userId] || { username: '未知用户' }
  }));

  return Response.success({
    ...comment,
    userInfo: {
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      level: user.level
    },
    replies
  });
}

// 点赞评论
async function likeComment(userId, data) {
  const { commentId } = data;

  if (!commentId) {
    return Response.validationError('评论ID不能为空');
  }

  const db = uniCloud.database();
  const commentCollection = db.collection('comment-info');
  const likeCollection = db.collection('user-like');

  // 检查评论是否存在
  const commentResult = await commentCollection.doc(commentId).get();
  if (commentResult.data.length === 0) {
    return Response.notFound('评论不存在');
  }

  const comment = commentResult.data[0];

  // 检查是否已点赞
  const existLike = await likeCollection.where({
    userId,
    targetType: '评论',
    targetId: commentId
  }).get();

  if (existLike.data.length > 0) {
    return Response.error('已经点赞过了');
  }

  const transaction = await db.startTransaction();
  
  try {
    // 添加点赞记录
    await transaction.collection('user-like').add({
      userId,
      targetType: '评论',
      targetId: commentId,
      likeTime: Date.now()
    });

    // 更新评论点赞数
    await transaction.collection('comment-info').doc(commentId).update({
      likeCount: $.inc(1),
      updateTime: Date.now()
    });

    // 更新评论作者的获赞数
    await transaction.collection('user').doc(comment.userId).update({
      likeCount: $.inc(1)
    });

    await transaction.commit();
    
    return Response.success(null, '点赞成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 举报评论
async function reportComment(userId, data) {
  const { commentId, reportType, description } = data;

  if (!commentId || !reportType) {
    return Response.validationError('评论ID和举报类型不能为空');
  }

  const commentCollection = db.collection('comment-info');
  const reportCollection = db.collection('user-report');

  // 检查评论是否存在
  const commentResult = await commentCollection.doc(commentId).get();
  if (commentResult.data.length === 0) {
    return Response.notFound('评论不存在');
  }

  const comment = commentResult.data[0];

  // 检查是否已举报过
  const existReport = await reportCollection.where({
    userId,
    targetType: '评论',
    targetId: commentId
  }).get();

  if (existReport.data.length > 0) {
    return Response.error('已举报过该评论');
  }

  // 创建举报记录
  await reportCollection.add({
    userId,
    targetType: '评论',
    targetId: commentId,
    reportType,
    description: description || '',
    reportTime: Date.now(),
    status: '待处理'
  });

  return Response.success(null, '举报已提交，我们会尽快处理');
}

// 删除评论（作者或管理员）
async function deleteComment(userId, data) {
  const { commentId } = data;

  if (!commentId) {
    return Response.validationError('评论ID不能为空');
  }

  const db = uniCloud.database();
  const commentCollection = db.collection('comment-info');

  // 获取评论信息
  const commentResult = await commentCollection.doc(commentId).get();
  if (commentResult.data.length === 0) {
    return Response.notFound('评论不存在');
  }

  const comment = commentResult.data[0];

  // 检查权限（只能是作者或管理员）
  // 这里需要您的权限验证逻辑
  if (comment.userId !== userId) {
    // 检查是否是管理员
    const userResult = await db.collection('user').doc(userId).get();
    const user = userResult.data[0];
    
    // 假设管理员有 isAdmin 字段
    if (!user.isAdmin) {
      return Response.forbidden('没有权限删除此评论');
    }
  }

  const transaction = await db.startTransaction();
  
  try {
    // 删除评论
    await transaction.collection('comment-info').doc(commentId).remove();

    // 如果评论有回复，也删除
    await transaction.collection('comment-info').where({ parentId: commentId }).remove();

    // 如果评论有父评论，更新父评论的回复数
    if (comment.parentId) {
      await transaction.collection('comment-info').doc(comment.parentId).update({
        replyCount: $.inc(-1),
        updateTime: Date.now()
      });
    }

    // 更新目标的评论数
    if (comment.targetType === '书籍') {
      await transaction.collection('book-info').doc(comment.targetId).update({
        commentCount: $.inc(-1),
        updateTime: Date.now()
      });
    }

    await transaction.commit();
    
    return Response.success(null, '评论删除成功');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 获取热门评论
async function getHotComments(data) {
  const { limit = 10 } = data;
  
  const commentCollection = db.collection('comment-info');
  const userCollection = db.collection('user');

  const commentsResult = await commentCollection
    .where({ status: '通过' })
    .orderBy('likeCount', 'desc')
    .limit(limit)
    .get();

  if (commentsResult.data.length === 0) {
    return Response.success([]);
  }

  // 获取用户信息
  const userIds = commentsResult.data.map(c => c.userId);
  const usersResult = await userCollection
    .where({ _id: db.command.in(userIds) })
    .field({
      _id: true,
      username: true,
      avatar: true
    })
    .get();

  const userMap = {};
  usersResult.data.forEach(user => {
    userMap[user._id] = user;
  });

  // 获取目标信息（书籍或章节）
  const bookIds = [];
  const chapterIds = [];
  
  commentsResult.data.forEach(comment => {
    if (comment.targetType === '书籍') {
      bookIds.push(comment.targetId);
    } else if (comment.targetType === '章节') {
      chapterIds.push(comment.targetId);
    }
  });

  const [booksResult, chaptersResult] = await Promise.all([
    bookIds.length > 0 ? db.collection('book-info')
      .where({ _id: db.command.in(bookIds) })
      .field({ _id: true, title: true, cover: true })
      .get() : { data: [] },
    chapterIds.length > 0 ? db.collection('book-chapter')
      .where({ _id: db.command.in(chapterIds) })
      .field({ _id: true, title: true, bookId: true })
      .get() : { data: [] }
  ]);

  const bookMap = {};
  booksResult.data.forEach(book => {
    bookMap[book._id] = book;
  });

  const chapterMap = {};
  chaptersResult.data.forEach(chapter => {
    chapterMap[chapter._id] = chapter;
  });

  // 组合数据
  const hotComments = commentsResult.data.map(comment => {
    let targetInfo = null;
    
    if (comment.targetType === '书籍') {
      targetInfo = bookMap[comment.targetId];
    } else if (comment.targetType === '章节') {
      const chapter = chapterMap[comment.targetId];
      if (chapter) {
        targetInfo = {
          ...chapter,
          type: '章节'
        };
      }
    }

    return {
      ...comment,
      userInfo: userMap[comment.userId] || { username: '未知用户' },
      targetInfo
    };
  });

  return Response.success(hotComments);
}

// 获取用户评论
async function getUserComments(userId, data) {
  const { page = 1, pageSize = 20 } = data;
  
  const { skip, limit } = Utils.handlePagination(page, pageSize);
  const commentCollection = db.collection('comment-info');

  const [commentsResult, totalResult] = await Promise.all([
    commentCollection
      .where({ userId })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get(),
    commentCollection.where({ userId }).count()
  ]);

  return Response.success({
    list: commentsResult.data,
    pagination: {
      page,
      pageSize,
      total: totalResult.total,
      totalPages: Math.ceil(totalResult.total / pageSize)
    }
  });
}

// 更新评论
async function updateComment(userId, data) {
  const { commentId, content } = data;

  if (!commentId || !content) {
    return Response.validationError('评论ID和内容不能为空');
  }

  const commentCollection = db.collection('comment-info');

  // 获取评论
  const commentResult = await commentCollection.doc(commentId).get();
  if (commentResult.data.length === 0) {
    return Response.notFound('评论不存在');
  }

  const comment = commentResult.data[0];

  // 检查权限（只能是作者）
  if (comment.userId !== userId) {
    return Response.forbidden('只能修改自己的评论');
  }

  // 检查评论状态
  if (comment.status !== '通过') {
    return Response.error('评论未通过审核，不能修改');
  }

  // 更新评论
  await commentCollection.doc(commentId).update({
    content,
    status: '待审核', // 修改后需要重新审核
    updateTime: Date.now()
  });

  return Response.success(null, '评论已修改，等待重新审核');
}