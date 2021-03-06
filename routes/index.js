var express = require('express');
var router = express.Router();
var multer = require('multer');
var passport = require('passport');
/*
生成一个路由实例用来捕获访问主页的GET请求，导出这个路由并在app.js中通过app.use('/', routes); 加载。
这样，当访问主页时，就会调用res.render('index', { title: 'Express' });
渲染views/index.ejs模版并显示到浏览器中.在渲染模板时我们传入了一个变量 title 值为 express 字符串，
模板引擎会将所有 <%= title %> 替换为 express ，然后将渲染后生成的html显示到浏览器中
*/
/* GET home page. */


/*
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
*/


//通过  require()  引入 crypto 模块和 user.js 用户模型文件，
//crypto 是 Node.js 的一个核心模块，我们用它生成散列值来加密密码
var crypto = require('crypto');
//var User = require('../models/user.js');
var User = require('../models/user');
var Post = require('../models/post');
var Comment = require('../models/comment.js');


//原版本使用方法
//app.use(multer({
//  dest: './public/images',
//  rename: function (fieldname, filename) {
//    return filename;
//  }
//}));
//新的使用方法
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './public/images/upload');
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});
var upload = multer({
    storage: storage
});



module.exports = function(app) {
    app.get('/', function(req, res) {
        //判断是否是第一页，并把请求的页数转换成 number 类型
        var page = parseInt(req.query.p) || 1;
        var count = 2;
        //查询并返回第 page 页的 count 篇文章
        Post.getAll(null, page, count, function(err, posts, total) {
            if (err) {
                posts = [];
            }
            res.render('index', {
                title: '主页',
                user: req.session.user,
                posts: posts,
                page: page,
                isFirstPage: (page - 1) == 0,
                isLastPage: ((page - 1) * count + posts.length) == total,
                /*
                success: req.flash('success').toString() 的意思是将成功的信息赋值给变量 success， 
                error: req.flash('error').toString() 的意思是将错误的信息赋值给变量 error ，
                然后我们在渲染 ejs 模版文件时传递这两个变量来进行检测并显示通知
                为了维护用户状态和 flash 的通知功能，我们给每个 ejs 模版文件传入了以下三个值:
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
                */
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });
    app.get('/reg', checkNotLogin);
    app.get('/reg', function(req, res) {
        res.render('reg', {
            title: '注册',
            user: req.session.user,
            success: req.flash('success').toString(),
            error: req.flash('error').toString()
        });
    });
    app.post('/reg', checkNotLogin);
    app.post('/reg', function(req, res) {
        /*req.body： 就是 POST 请求信息解析过后的对象，
        例如我们要访问 POST 来的表单内的 name="password" 域的值，
        只需访问 req.body['password'] 或 req.body.password 即可
        */
        var name = req.body.name,
            password = req.body.password,
            password_re = req.body['password-repeat'];
        //检验用户两次输入的密码是否一致
        if (password_re != password) {
            //res.redirect： 重定向功能，实现了页面的跳转
            req.flash('error', '两次输入的密码不一致!');
            return res.redirect('/reg'); //返回注册页
        }
        //生成密码的 md5 值
        var md5 = crypto.createHash('md5'),
            password = md5.update(req.body.password).digest('hex');
        var newUser = new User({
            name: name,
            password: password,
            email: req.body.email
        });
        //检查用户名是否已经存在 
        User.get(newUser.name, function(err, user) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            if (user) {
                req.flash('error', '用户已存在!');
                return res.redirect('/reg'); //返回注册页
            }
            //如果不存在则新增用户
            newUser.save(function(err, user) {
                if (err) {
                    req.flash('error', err);
                    return res.redirect('/reg'); //注册失败返回主册页
                }
                //把用户信息存储在了 session 里，以后就可以通过 req.session.user 读取用户信息
                req.session.user = newUser; //用户信息存入 session
                req.flash('success', '注册成功!');
                res.redirect('/'); //注册成功后返回主页
            });
        });

    });
    app.get('/login', checkNotLogin);
    app.get('/login', function(req, res) {
        res.render('login', {
            title: '登录',
            user: req.session.user,
            success: req.flash('success').toString(),
            error: req.flash('error').toString()
        });
    });

    app.get("/login/github", passport.authenticate("github", { session: false }));
    app.get("/login/github/callback", passport.authenticate("github", {
        session: false,
        failureRedirect: '/login',
        successFlash: '登陆成功！'
    }), function(req, res) {
        req.session.user = { name: req.user.username, head: "https://gravatar.com/avatar/" + req.user._json.gravatar_id + "?s=48" };
        res.redirect('/');
    });


    app.post('/login', checkNotLogin);
    app.post('/login', function(req, res) {
        //生成密码的 md5 值
        var md5 = crypto.createHash('md5'),
            password = md5.update(req.body.password).digest('hex');
        //检查用户是否存在
        User.get(req.body.name, function(err, user) {
            if (!user) {
                req.flash('error', '用户不存在!');
                return res.redirect('/login'); //用户不存在则跳转到登录页
            }
            //检查密码是否一致
            if (user.password != password) {
                req.flash('error', '密码错误!');
                return res.redirect('/login'); //密码错误则跳转到登录页
            }
            //用户名密码都匹配后，将用户信息存入 session
            req.session.user = user;
            req.flash('success', '登陆成功!');
            res.redirect('/'); //登陆成功后跳转到主页
        });
    });

    app.get('/post', checkLogin);
    app.get('/post', function(req, res) {
        res.render('post', {
            title: '发表',
            user: req.session.user,
            success: req.flash('success').toString(),
            error: req.flash('error').toString()
        });
    });

    app.post('/post', checkLogin);
    app.post('/post', function(req, res) {
        var currentUser = req.session.user,
            tags = [req.body.tag1, req.body.tag2, req.body.tag3],
            post = new Post(currentUser.name, currentUser.head, req.body.title, tags, req.body.post);
        post.save(function(err) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            req.flash('success', '发布成功!');
            res.redirect('/'); //发表成功跳转到主页
        });
    });

    app.get('/logout', checkLogin);
    app.get('/logout', function(req, res) {
        //通过把 req.session.user 赋值 null 丢掉 session 中用户的信息，实现用户的退出
        req.session.user = null;
        req.flash('success', '登出成功!');
        res.redirect('/'); //登出成功后跳转到主页
    });


    app.get('/upload', checkLogin);
    app.get('/upload', function(req, res) {
        res.render('upload', {
            title: '文件上传',
            user: req.session.user,
            success: req.flash('success').toString(),
            error: req.flash('error').toString()
        });
    });


    app.post('/upload', checkLogin);
    app.post('/upload', upload.single('file1'), function(req, res) {
        req.flash('success', '文件上传成功!');
        res.redirect('/upload');
    });



    app.get('/links', function(req, res) {
        res.render('links', {
            title: '友情链接',
            user: req.session.user,
            success: req.flash('success').toString(),
            error: req.flash('error').toString()
        });
    });

    app.get('/search', function(req, res) {
        Post.search(req.query.keyword, function(err, posts) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            res.render('search', {
                title: "SEARCH:" + req.query.keyword,
                posts: posts,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });



    /*这里我们添加了一条路由规则 app.get('/u/:name')，用来处理访问用户页的请求，
    然后从数据库取得该用户的数据并渲染 user.ejs 模版，生成页面并显示给用户*/
    app.get('/u/:name', function(req, res) {
        var page = parseInt(req.query.p) || 1;
        var count = 2;
        //检查用户是否存在
        User.get(req.params.name, function(err, user) {
            if (!user) {
                req.flash('error', '用户不存在!');
                return res.redirect('/');
            }
            //查询并返回该用户第 page 页的 count 篇文章
            Post.getAll(user.name, page, count, function(err, posts, total) {
                if (err) {
                    req.flash('error', err);
                    return res.redirect('/');
                }
                res.render('user', {
                    title: user.name,
                    posts: posts,
                    page: page,
                    isFirstPage: (page - 1) == 0,
                    isLastPage: ((page - 1) * count + posts.length) == total,
                    user: req.session.user,
                    success: req.flash('success').toString(),
                    error: req.flash('error').toString()
                });
            });
        });
    })

    app.get('/p/:_id', function(req, res) {
        Post.getOne(req.params._id, function(err, post) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            res.render('article', {
                title: post.title,
                post: post,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });


    app.get('/edit/:name/:day/:title', checkLogin);
    app.get('/edit/:name/:day/:title', function(req, res) {
        var currentUser = req.session.user;
        Post.edit(currentUser.name, req.params.day, req.params.title, function(err, post) {
            if (err) {
                req.flash('error', err);
                return res.redirect('back');
            }
            res.render('edit', {
                title: '编辑',
                post: post,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });


    app.post('/edit/:name/:day/:title', checkLogin);
    app.post('/edit/:name/:day/:title', function(req, res) {
        var currentUser = req.session.user;
        Post.update(currentUser.name, req.params.day, req.params.title, req.body.post, function(err) {
            var url = encodeURI('/u/' + req.params.name + '/' + req.params.day + '/' + req.params.title);
            if (err) {
                req.flash('error', err);
                return res.redirect(url); //出错！返回文章页
            }
            req.flash('success', '修改成功!');
            res.redirect(url); //成功！返回文章页
        });
    });

    app.get('/remove/:name/:day/:title', checkLogin);
    app.get('/remove/:name/:day/:title', function(req, res) {
        var currentUser = req.session.user;
        Post.remove(currentUser.name, req.params.day, req.params.title, function(err) {
            if (err) {
                req.flash('error', err);
                return res.redirect('back');
            }
            req.flash('success', '删除成功!');
            res.redirect('/');
        });
    });


    app.get('/reprint/:name/:day/:title', checkLogin);
    app.get('/reprint/:name/:day/:title', function(req, res) {
        /*我们需要通过 Post.edit() 返回一篇文章 markdown 格式的文本，
        而不是通过 Post.getOne 返回一篇转义后的 HTML 文本，
        因为我们还要将修改后的文档存入数据库，而数据库中应该存储 markdown 格式的文本。*/
        Post.edit(req.params.name, req.params.day, req.params.title, function(err, post) {
            if (err) {
                req.flash('error', err);
                return res.redirect(back);
            }
            var currentUser = req.session.user,
                reprint_from = { name: post.name, day: post.time.day, title: post.title },
                reprint_to = { name: currentUser.name, head: currentUser.head };
            Post.reprint(reprint_from, reprint_to, function(err, post) {
                if (err) {
                    req.flash('error', err);
                    return res.redirect('back');
                }
                req.flash('success', '转载成功!');
                var url = encodeURI('/u/' + post.name + '/' + post.time.day + '/' + post.title);
                //跳转到转载后的文章页面
                res.redirect(url);
            });
        });
    });


    app.post('/u/:name/:day/:title', function(req, res) {
        var date = new Date(),
            time = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " +
            date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
        var md5 = crypto.createHash('md5'),
            email_MD5 = md5.update(req.body.email.toLowerCase()).digest('hex'),
            head = "http://www.gravatar.com/avatar/" + email_MD5 + "?s=48";
        var comment = {
            name: req.body.name,
            head: head,
            email: req.body.email,
            website: req.body.website,
            time: time,
            content: req.body.content
        };
        var newComment = new Comment(req.params.name, req.params.day, req.params.title, comment);
        newComment.save(function(err) {
            if (err) {
                req.flash('error', err);
                return res.redirect('back');
            }
            req.flash('success', '留言成功!');
            res.redirect('back');
        });
    });



    app.get('/archive', function(req, res) {
        Post.getArchive(function(err, posts) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            res.render('archive', {
                title: '存档',
                posts: posts,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });


    app.get('/tags', function(req, res) {
        Post.getTags(function(err, posts) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            res.render('tags', {
                title: '标签',
                posts: posts,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });

    app.get('/tags/:tag', function(req, res) {
        Post.getTag(req.params.tag, function(err, posts) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            res.render('tag', {
                title: 'TAG:' + req.params.tag,
                posts: posts,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });
    });



    app.use(function(req, res) {
        res.render("404");
    });

    function checkLogin(req, res, next) {
        if (!req.session.user) {
            req.flash('error', '未登录!');
            res.redirect('/login');
        }
        next();
    }

    function checkNotLogin(req, res, next) {
        if (req.session.user) {
            req.flash('error', '已登录!');
            res.redirect('back'); //返回之前的页面
        }
        next();
    }




};
