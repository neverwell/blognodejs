// var mongodb = require('./db'),
//     markdown = require('markdown').markdown;

/*
创建了一个 mongodb 连接池，其中 name 指明该连接池的名字，
create 指明创建一条数据库连接的方法，并返回创建的连接，
destroy 指明如何销毁连接，max 指明连接池中最大连接数，
min 指明连接池中最小连接数，idleTimeoutMillis 指明不活跃连接销毁的毫秒数，
这里为 30000 即当一条连接 30 秒处于不活跃状态（即没有被使用过）时则销毁该连接。
log 指明是否打印连接池日志，这里我们选择打印
*/
var Db = require('./db-pool');
// var markdown = require('markdown').markdown;
var poolModule = require('generic-pool');
var pool = poolModule.Pool({
    name: 'mongoPool',
    create: function(callback) {
        var mongodb = Db();
        mongodb.open(function(err, db) {
            callback(err, db);
        })
    },
    destroy: function(mongodb) {
        mongodb.close();
    },
    max: 100,
    min: 5,
    idleTimeoutMillis: 30000,
    log: true
});



var ObjectID = require('mongodb').ObjectID;

function Post(name, head, title, tags, post) {
    this.name = name;
    this.head = head;
    this.title = title;
    this.tags = tags;
    this.post = post;
}

module.exports = Post;

//存储一篇文章及其相关信息
Post.prototype.save = function(callback) {
    var date = new Date();
    //存储各种时间格式，方便以后扩展
    var time = {
            date: date,
            year: date.getFullYear(),
            month: date.getFullYear() + "-" + (date.getMonth() + 1),
            day: date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate(),
            minute: date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " +
                date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes())
        }
        //要存入数据库的文档
    var post = {
        name: this.name,
        head: this.head,
        time: time,
        title: this.title,
        tags: this.tags,
        post: this.post,
        comments: [],
        reprint_info: {},
        pv: 0
    };
    /*
reprint_info:{
  reprint_from: {name: xxx, day: xxx, title: xxx},
  reprint_to: [
    {name: xxx, day: xxx, title: xxx},
    {name: xxx, day: xxx, title: xxx},
    ...
  ]
}
    */
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //将文档插入 posts 集合
            collection.insert(post, {
                safe: true
            }, function(err) {
                pool.release(db);
                if (err) {
                    return callback(err); //失败！返回 err
                }
                callback(null); //返回 err 为 null
            });
        });
    });
};

//读取文章及其相关信息
Post.getAll = function(name, page, count, callback) {
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            var query = {};
            if (name) {
                query.name = name;
            }
            //使用 count 返回特定查询的文档数 total
            collection.count(query, function(err, total) {
                //根据 query 对象查询，并跳过前 (page-1)*count 个结果，返回之后的 count 个结果
                collection.find(query, {
                    skip: (page - 1) * count,
                    limit: count
                }).sort({
                    time: -1
                }).toArray(function(err, docs) {
                    pool.release(db);
                    if (err) {
                        return callback(err);
                    }
                    //解析 markdown 为 html
                    // docs.forEach(function(doc) {
                    //     doc.post = markdown.toHTML(doc.post);
                    // });
                    callback(null, docs, total);
                });
            });
        });
    });
};

//获取一篇文章
Post.getOne = function(_id, callback) {
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //根据用户名、发表日期及文章名进行查询
            //使用_id查询
            collection.findOne({
                "_id": new ObjectID(_id)
            }, function(err, doc) {
                if (err) {
                    pool.release(db);
                    return callback(err);
                }
                if (doc) {
                    //每访问 1 次，pv 值增加 1
                    collection.update({
                        "_id": new ObjectID(_id)
                    }, {
                        $inc: { "pv": 1 }
                    }, function(err) {
                        pool.release(db);
                        if (err) {
                            return callback(err);
                        }
                    });
                    //解析 markdown 为 html
                    // doc.post = markdown.toHTML(doc.post);
                    // doc.comments.forEach(function(comment) {
                    //     comment.content = markdown.toHTML(comment.content);
                    // });
                    callback(null, doc); //返回查询的一篇文章
                }
            });
        });
    });
};



//返回原始发表的内容（markdown 格式）
Post.edit = function(name, day, title, callback) {
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //根据用户名、发表日期及文章名进行查询
            collection.findOne({
                "name": name,
                "time.day": day,
                "title": title
            }, function(err, doc) {
                pool.release(db);
                if (err) {
                    return callback(err);
                }
                callback(null, doc); //返回查询的一篇文章（markdown 格式）
            });
        });
    });
};


//更新一篇文章及其相关信息
Post.update = function(name, day, title, post, callback) {
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //更新文章内容
            collection.update({
                "name": name,
                "time.day": day,
                "title": title
            }, {
                $set: { post: post }
            }, function(err) {
                pool.release(db);
                if (err) {
                    return callback(err);
                }
                callback(null);
            });
        });
    });
};

//删除一篇文章
Post.remove = function(name, day, title, callback) {
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //查询要删除的文档
            collection.findOne({
                "name": name,
                "time.day": day,
                "title": title
            }, function(err, doc) {
                if (err) {
                    pool.release(db);
                    return callback(err);
                }
                //如果有 reprint_from，即该文章是转载来的，先保存下来 reprint_from
                var reprint_from = "";
                if (doc.reprint_info.reprint_from) {
                    reprint_from = doc.reprint_info.reprint_from;
                }
                if (reprint_from != "") {
                    //更新原文章所在文档的 reprint_to
                    collection.update({
                        "name": reprint_from.name,
                        "time.day": reprint_from.day,
                        "title": reprint_from.title
                    }, {
                        $pull: {
                            "reprint_info.reprint_to": {
                                "name": name,
                                "day": day,
                                "title": title
                            }
                        }
                    }, function(err) {
                        if (err) {
                            pool.release(db);
                            return callback(err);
                        }
                    });
                }

                //删除转载来的文章所在的文档
                collection.remove({
                    "name": name,
                    "time.day": day,
                    "title": title
                }, {
                    w: 1
                }, function(err) {
                    pool.release(db);
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            });
        });
    });
};


//返回所有文章存档信息
Post.getArchive = function(callback) {
    //打开数据库
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //返回只包含 name、time、title 属性的文档组成的存档数组
            collection.find({}, {
                "name": 1,
                "time": 1,
                "title": 1
            }).sort({
                time: -1
            }).toArray(function(err, docs) {
                pool.release(db);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};


//返回所有标签
Post.getTags = function(callback) {
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //distinct 用来找出给定键的所有不同值
            collection.distinct("tags", function(err, docs) {
                pool.release(db);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};


//返回含有特定标签的所有文章
Post.getTag = function(tag, callback) {
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //查询所有 tags 数组内包含 tag 的文档
            //并返回只含有 name、time、title 组成的数组
            collection.find({
                "tags": tag
            }, {
                "name": 1,
                "time": 1,
                "title": 1
            }).sort({
                time: -1
            }).toArray(function(err, docs) {
                pool.release(db);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};


//返回通过标题关键字查询的所有文章信息
Post.search = function(keyword, callback) {
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            var pattern = new RegExp(keyword, "i");
            collection.find({
                "title": pattern
            }, {
                "name": 1,
                "time": 1,
                "title": 1
            }).sort({
                time: -1
            }).toArray(function(err, docs) {
                pool.release(db);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};

//转载一篇文章
Post.reprint = function(reprint_from, reprint_to, callback) {
    pool.acquire(function(err, db) {
        if (err) {
            return callback(err);
        }
        db.collection('posts', function(err, collection) {
            if (err) {
                pool.release(db);
                return callback(err);
            }
            //找到被转载的文章的原文档
            collection.findOne({
                "name": reprint_from.name,
                "time.day": reprint_from.day,
                "title": reprint_from.title
            }, function(err, doc) {
                if (err) {
                    pool.release(db);
                    return callback(err);
                }

                var date = new Date();
                var time = {
                    date: date,
                    year: date.getFullYear(),
                    month: date.getFullYear() + "-" + (date.getMonth() + 1),
                    day: date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate(),
                    minute: date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " +
                        date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes())
                }

                delete doc._id; //注意要删掉原来的 _id

                doc.name = reprint_to.name;
                doc.head = reprint_to.head;
                doc.time = time;
                doc.title = (doc.title.search(/[转载]/) > -1) ? doc.title : "[转载]" + doc.title;
                doc.comments = [];
                doc.reprint_info = { "reprint_from": reprint_from };
                doc.pv = 0;

                //更新被转载的原文档的 reprint_info 内的 reprint_to
                collection.update({
                    "name": reprint_from.name,
                    "time.day": reprint_from.day,
                    "title": reprint_from.title
                }, {
                    $push: {
                        "reprint_info.reprint_to": {
                            "name": doc.name,
                            "day": time.day,
                            "title": doc.title
                        }
                    }
                }, function(err) {
                    if (err) {
                        pool.release(db);
                        return callback(err);
                    }
                });

                //将转载生成的副本修改后存入数据库，并返回存储后的文档
                collection.insert(doc, {
                    safe: true
                }, function(err, post) {
                    pool.release(db);
                    if (err) {
                        return callback(err);
                    }
                    callback(err, post.ops[0]);
                });
            });
        });
    });
};
