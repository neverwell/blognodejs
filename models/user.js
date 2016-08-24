var mongodb = require('./db');
var crypto = require('crypto');
/*
User：User 是一个描述数据的对象，即 MVC 架构中的模型。
前面我们使用了许多视图和控制器，这是第一次接触到模型。
与视图和控制器不同，模型是真正与数据打交道的工具，没有模型，
网站就只是一个外壳，不能发挥真实的作用，因此它是框架中最根本的部分
*/



function User(user) {
    this.name = user.name;
    this.password = user.password;
    this.email = user.email;
};

module.exports = User;

//存储用户信息
User.prototype.save = function(callback) {
    //要存入数据库的用户文档
    var md5 = crypto.createHash('md5'),
        email_MD5 = md5.update(this.email.toLowerCase()).digest('hex'),
        head = "http://www.gravatar.com/avatar/" + email_MD5 + "?s=48";
    //要存入数据库的用户信息文档
    var user = {
        name: this.name,
        password: this.password,
        email: this.email,
        head: head
    };
    //打开数据库
    mongodb.open(function(err, db) {
        if (err) {
            return callback(err); //错误，返回 err 信息
        }
        //读取 users 集合
        db.collection('users', function(err, collection) {
            if (err) {
                mongodb.close();
                return callback(err); //错误，返回 err 信息
            }
            //将用户数据插入 users 集合
            collection.insert(user, {
                safe: true
            }, function(err, user) {
                mongodb.close();
                if (err) {
                    return callback(err); //错误，返回 err 信息
                }
                callback(null, user[0]); //成功！err 为 null，并返回存储后的用户文档
            });
        });
    });
};

//读取用户信息
User.get = function(name, callback) {
    //打开数据库
    mongodb.open(function(err, db) {
        if (err) {
            return callback(err); //错误，返回 err 信息
        }
        //读取 users 集合
        db.collection('users', function(err, collection) {
            if (err) {
                mongodb.close();
                return callback(err); //错误，返回 err 信息
            }
            //查找用户名（name键）值为 name 一个文档
            collection.findOne({
                name: name
            }, function(err, user) {
                mongodb.close();
                if (err) {
                    return callback(err); //失败！返回 err 信息
                }
                callback(null, user); //成功！返回查询的用户信息
            });
        });
    });
};
