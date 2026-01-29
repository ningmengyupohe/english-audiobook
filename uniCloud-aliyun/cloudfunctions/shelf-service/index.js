// cloudfunctions/shelf-service/index.js - 去除登录验证版
'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;
const Response = require('./common/response');

exports.main = async (event, context) => {
  console.log('📦 书架服务请求:', { action: event.action, data: event.data });
  
  try {
    // 🚨 关键修改：不验证登录，接受任意userId（包括0）
    let userId = 0;
    let action = event.action;
    let data = event.data || {};
    
    // 尝试解析不同的请求格式
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        action = body.action || action;
        data = body.data || data;
        userId = body.userId || 0;
      } catch (e) {
        console.log('解析请求体失败:', e);
      }
    } else if (event.data) {
      userId = event.data.userId || 0;
    }
    
    console.log('🔍 请求详情:', { 
      action, 
      userId, 
      数据大小: JSON.stringify(data).length 
    });
    
    // 🚨 直接路由到处理函数，不检查登录状态
    switch (action) {
      case 'getUserCollections':
        return await getUserCollections(userId, data);
      case 'addCollection':
        return await addToCollection(userId, data);
      case 'deleteCollection':
        return await removeFromCollection(userId, data);
      case 'getUserHistory':
        return await getUserHistory(userId, data);
      case 'deleteHistory':
        return await deleteHistoryRecord(userId, data);
      case 'getShelfList':
        return await getShelfList(userId, data);
      case 'checkInShelf':
        return await checkInShelf(userId, data);
      case 'getShelfCount':
        return await getShelfCount(userId);
      case 'clearShelf':
        return await clearShelf(userId);
      case 'moveShelfPosition':
        return await moveShelfPosition(userId, data);
      case 'getShelfCategories':
        return await getShelfCategories(userId);
      default:
        return Response.error('未知的操作类型', 400);
    }
  } catch (error) {
    console.error('书架服务错误:', error);
    return Response.error(error.message);
  }
};

// 获取用户收藏列表
async function getUserCollections(userId, data) {
  try {
    const { page = 1, pageSize = 20 } = data || {};
    const skip = (page - 1) * pageSize;
    
    console.log('📚 获取用户收藏，用户ID:', userId, '分页:', { page, pageSize });
    
    // 🚨 如果userId为0或未提供，返回空数据
    if (!userId || userId <= 0) {
      console.log('用户未登录或userId为0，返回空收藏列表');
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }
    
    const collectionCollection = db.collection('user-collection');
    const bookCollection = db.collection('book-info');
    
    // 查询用户的收藏记录
    const [collectionsResult, totalResult] = await Promise.all([
      collectionCollection
        .where({
          userId: Number(userId)
        })
        .orderBy('collectTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get(),
      collectionCollection
        .where({
          userId: Number(userId)
        })
        .count()
    ]);
    
    console.log('📊 收藏记录查询结果:', {
      count: collectionsResult.data.length,
      total: totalResult.total
    });
    
    if (collectionsResult.data.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }
    
    // 获取所有书籍ID
    const bookIds = collectionsResult.data.map(item => item.bookId);
    
    // 查询书籍详细信息
    const booksResult = await bookCollection
      .where({
        _id: db.command.in(bookIds)
      })
      .get();
    
    console.log('📚 获取到书籍信息:', booksResult.data.length, '本');
    
    // 创建书籍映射表
    const bookMap = {};
    booksResult.data.forEach(book => {
      bookMap[book._id] = book;
    });
    
    // 组合数据
    const list = collectionsResult.data.map(item => {
      const book = bookMap[item.bookId] || {};
      return {
        _id: item._id,
        collectTime: item.collectTime,
        bookId: item.bookId,
        bookInfo: {
          _id: book._id || '',
          title: book.title || '未知书名',
          author: book.author || '未知作者',
          cover: book.cover || '/images/covers/default.jpg',
          category: book.category || '未分类',
          totalChapters: book.totalChapters || 0,
          completedChapters: book.completedChapters || 0,
          totalDuration: book.totalDuration || 0,
          playCount: book.playCount || 0,
          description: book.description || ''
        }
      };
    }).filter(item => item.bookInfo._id); // 过滤掉书籍不存在的记录
    
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
    console.error('获取收藏列表失败:', error);
    return Response.error('获取收藏列表失败');
  }
}

// 添加到收藏
async function addToCollection(userId, data) {
  try {
    const { bookId } = data;
    
    if (!bookId) {
      return Response.validationError('书籍ID不能为空');
    }
    
    // 🚨 如果userId为0或未提供，返回错误
    if (!userId || userId <= 0) {
      return Response.error('请先登录后添加收藏', 401);
    }
    
    console.log('➕ 添加收藏，用户ID:', userId, '书籍ID:', bookId);
    
    const collectionCollection = db.collection('user-collection');
    const bookCollection = db.collection('book-info');
    
    // 检查书籍是否存在
    const bookResult = await bookCollection.doc(bookId).get();
    if (bookResult.data.length === 0) {
      return Response.notFound('书籍不存在');
    }
    
    // 检查是否已收藏
    const existResult = await collectionCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .get();
    
    if (existResult.data.length > 0) {
      return Response.error('已在收藏中');
    }
    
    // 添加到收藏
    const result = await collectionCollection.add({
      userId: userId,
      bookId: bookId,
      collectTime: Date.now()
    });
    
    console.log('✅ 收藏添加成功，记录ID:', result.id);
    
    return Response.success({
      _id: result.id,
      collectTime: Date.now()
    }, '已添加到收藏');
    
  } catch (error) {
    console.error('添加收藏失败:', error);
    return Response.error('添加收藏失败');
  }
}

// 从收藏移除
async function removeFromCollection(userId, data) {
  try {
    const { bookId, recordId } = data;
    
    if (!bookId && !recordId) {
      return Response.validationError('书籍ID或记录ID不能为空');
    }
    
    // 🚨 如果userId为0或未提供，返回错误
    if (!userId || userId <= 0) {
      return Response.error('请先登录后删除收藏', 401);
    }
    
    console.log('➖ 移除收藏，用户ID:', userId, '书籍ID:', bookId, '记录ID:', recordId);
    
    const collectionCollection = db.collection('user-collection');
    
    let query = { userId: userId };
    
    if (recordId) {
      query._id = recordId;
    } else if (bookId) {
      query.bookId = bookId;
    }
    
    // 查找收藏记录
    const existResult = await collectionCollection
      .where(query)
      .get();
    
    if (existResult.data.length === 0) {
      return Response.error('不在收藏中');
    }
    
    // 删除记录
    const deleteResult = await collectionCollection
      .doc(existResult.data[0]._id)
      .remove();
    
    console.log('✅ 收藏移除成功');
    
    return Response.success({
      deleted: deleteResult.deleted
    }, '已从收藏移除');
    
  } catch (error) {
    console.error('移除收藏失败:', error);
    return Response.error('移除收藏失败');
  }
}

// 获取用户历史记录
async function getUserHistory(userId, data) {
  try {
    const { page = 1, pageSize = 20 } = data || {};
    const skip = (page - 1) * pageSize;
    
    console.log('🕒 获取用户历史，用户ID:', userId, '分页:', { page, pageSize });
    
    // 🚨 如果userId为0或未提供，返回空数据
    if (!userId || userId <= 0) {
      console.log('用户未登录或userId为0，返回空历史记录');
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }
    
    const historyCollection = db.collection('user-history');
    const bookCollection = db.collection('book-info');
    const chapterCollection = db.collection('book-chapter');
    
    // 查询用户的历史记录
    const [historyResult, totalResult] = await Promise.all([
      historyCollection
        .where({
          userId: Number(userId)
        })
        .orderBy('listenTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get(),
      historyCollection
        .where({
          userId: Number(userId)
        })
        .count()
    ]);
    
    console.log('📊 历史记录查询结果:', {
      count: historyResult.data.length,
      total: totalResult.total
    });
    
    if (historyResult.data.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }
    
    // 获取所有章节ID
    const chapterIds = historyResult.data.map(item => item.chapterId);
    
    // 查询章节信息
    const chaptersResult = await chapterCollection
      .where({
        _id: db.command.in(chapterIds)
      })
      .get();
    
    // 获取书籍ID
    const bookIds = chaptersResult.data.map(chapter => chapter.bookId);
    const uniqueBookIds = [...new Set(bookIds)];
    
    // 查询书籍信息
    const booksResult = await bookCollection
      .where({
        _id: db.command.in(uniqueBookIds)
      })
      .get();
    
    console.log('📚 获取到书籍信息:', booksResult.data.length, '本');
    console.log('📖 获取到章节信息:', chaptersResult.data.length, '章');
    
    // 创建映射表
    const chapterMap = {};
    chaptersResult.data.forEach(chapter => {
      chapterMap[chapter._id] = chapter;
    });
    
    const bookMap = {};
    booksResult.data.forEach(book => {
      bookMap[book._id] = book;
    });
    
    // 组合数据
    const list = historyResult.data.map(item => {
      const chapter = chapterMap[item.chapterId] || {};
      const book = bookMap[chapter.bookId] || {};
      
      return {
        _id: item._id,
        listenTime: item.listenTime,
        progress: item.progress,
        duration: item.duration,
        completed: item.completed || false,
        chapterId: item.chapterId,
        chapterInfo: {
          _id: chapter._id || '',
          title: chapter.title || '未知章节',
          chapterNumber: chapter.chapterNumber || 0,
          duration: chapter.duration || 0
        },
        bookInfo: {
          _id: book._id || '',
          title: book.title || '未知书名',
          author: book.author || '未知作者',
          cover: book.cover || '/images/covers/default.jpg',
          category: book.category || '未分类'
        }
      };
    }).filter(item => item.bookInfo._id); // 过滤掉书籍不存在的记录
    
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
    console.error('获取历史记录失败:', error);
    return Response.error('获取历史记录失败');
  }
}

// 删除历史记录
async function deleteHistoryRecord(userId, data) {
  try {
    const { recordId } = data;
    
    if (!recordId) {
      return Response.validationError('记录ID不能为空');
    }
    
    // 🚨 如果userId为0或未提供，返回错误
    if (!userId || userId <= 0) {
      return Response.error('请先登录后删除历史记录', 401);
    }
    
    console.log('🗑️ 删除历史记录，用户ID:', userId, '记录ID:', recordId);
    
    const historyCollection = db.collection('user-history');
    
    // 验证记录是否存在且属于该用户
    const existResult = await historyCollection
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (existResult.data.length === 0) {
      return Response.error('记录不存在');
    }
    
    // 删除记录
    const deleteResult = await historyCollection
      .doc(recordId)
      .remove();
    
    console.log('✅ 历史记录删除成功');
    
    return Response.success({
      deleted: deleteResult.deleted
    }, '历史记录已删除');
    
  } catch (error) {
    console.error('删除历史记录失败:', error);
    return Response.error('删除历史记录失败');
  }
}

// 获取书架列表（兼容旧接口）
async function getShelfList(userId, data) {
  // 调用getUserCollections
  return await getUserCollections(userId, data);
}

// 检查是否在书架中
async function checkInShelf(userId, data) {
  try {
    const { bookId } = data;
    
    if (!bookId) {
      return Response.validationError('书籍ID不能为空');
    }
    
    console.log('🔍 检查是否在书架中，用户ID:', userId, '书籍ID:', bookId);
    
    // 🚨 如果userId为0或未提供，返回未收藏
    if (!userId || userId <= 0) {
      return Response.success({
        inShelf: false,
        collectTime: null,
        recordId: null
      });
    }
    
    const collectionCollection = db.collection('user-collection');
    
    const result = await collectionCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .get();
    
    return Response.success({
      inShelf: result.data.length > 0,
      collectTime: result.data[0]?.collectTime || null,
      recordId: result.data[0]?._id || null
    });
    
  } catch (error) {
    console.error('检查书架状态失败:', error);
    return Response.error('检查书架状态失败');
  }
}

// 获取书架数量
async function getShelfCount(userId) {
  try {
    console.log('🔢 获取书架数量，用户ID:', userId);
    
    // 🚨 如果userId为0或未提供，返回0
    if (!userId || userId <= 0) {
      return Response.success({
        count: 0
      });
    }
    
    const collectionCollection = db.collection('user-collection');
    
    const result = await collectionCollection
      .where({
        userId: userId
      })
      .count();
    
    return Response.success({
      count: result.total
    });
    
  } catch (error) {
    console.error('获取书架数量失败:', error);
    return Response.error('获取书架数量失败');
  }
}

// 清空书架
async function clearShelf(userId) {
  try {
    console.log('🧹 清空书架，用户ID:', userId);
    
    // 🚨 如果userId为0或未提供，返回错误
    if (!userId || userId <= 0) {
      return Response.error('请先登录后清空书架', 401);
    }
    
    const collectionCollection = db.collection('user-collection');
    
    // 查询所有收藏记录
    const collectionsResult = await collectionCollection
      .where({
        userId: userId
      })
      .get();
    
    if (collectionsResult.data.length === 0) {
      return Response.success({
        deletedCount: 0
      }, '书架已是空的');
    }
    
    // 批量删除
    const deletePromises = collectionsResult.data.map(item => 
      collectionCollection.doc(item._id).remove()
    );
    
    const results = await Promise.all(deletePromises);
    const deletedCount = results.reduce((sum, result) => sum + (result.deleted || 0), 0);
    
    console.log('✅ 清空书架成功，删除记录数:', deletedCount);
    
    return Response.success({
      deletedCount: deletedCount
    }, '书架已清空');
    
  } catch (error) {
    console.error('清空书架失败:', error);
    return Response.error('清空书架失败');
  }
}

// 移动书架位置（更新排序）
async function moveShelfPosition(userId, data) {
  try {
    const { bookId, newPosition } = data;
    
    if (!bookId || newPosition === undefined) {
      return Response.validationError('书籍ID和新位置不能为空');
    }
    
    // 🚨 如果userId为0或未提供，返回错误
    if (!userId || userId <= 0) {
      return Response.error('请先登录后移动位置', 401);
    }
    
    console.log('🔄 移动书架位置，用户ID:', userId, '书籍ID:', bookId, '新位置:', newPosition);
    
    const collectionCollection = db.collection('user-collection');
    
    // 查找记录
    const existResult = await collectionCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .get();
    
    if (existResult.data.length === 0) {
      return Response.error('书籍不在书架中');
    }
    
    // 更新记录
    const updateData = {
      collectTime: Date.now()
    };
    
    const updateResult = await collectionCollection
      .doc(existResult.data[0]._id)
      .update(updateData);
    
    console.log('✅ 位置更新成功');
    
    return Response.success({
      updated: updateResult.updated
    }, '位置更新成功');
    
  } catch (error) {
    console.error('移动书架位置失败:', error);
    return Response.error('移动书架位置失败');
  }
}

// 获取书架分类统计
async function getShelfCategories(userId) {
  try {
    console.log('🏷️ 获取书架分类统计，用户ID:', userId);
    
    // 🚨 如果userId为0或未提供，返回空数组
    if (!userId || userId <= 0) {
      return Response.success([]);
    }
    
    const collectionCollection = db.collection('user-collection');
    const bookCollection = db.collection('book-info');
    
    // 先获取用户的收藏书籍
    const collectionsResult = await collectionCollection
      .where({
        userId: userId
      })
      .get();
    
    if (collectionsResult.data.length === 0) {
      return Response.success([]);
    }
    
    // 获取所有书籍ID
    const bookIds = collectionsResult.data.map(item => item.bookId);
    
    // 查询书籍的分类信息
    const booksResult = await bookCollection
      .where({
        _id: db.command.in(bookIds)
      })
      .field({
        _id: true,
        category: true,
        categoryId: true
      })
      .get();
    
    // 统计分类
    const categoryCounts = {};
    booksResult.data.forEach(book => {
      const category = book.category || '未分类';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    // 转换为数组格式
    const categories = Object.keys(categoryCounts).map(category => ({
      name: category,
      count: categoryCounts[category]
    }));
    
    console.log('📊 分类统计结果:', categories);
    
    return Response.success(categories);
    
  } catch (error) {
    console.error('获取分类统计失败:', error);
    return Response.error('获取分类统计失败');
  }
}