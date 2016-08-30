var express = require('express'); //生成一个express实例 app
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var session = require('express-session');
var MongoStore = require('connect-mongo')(session);





var routes = require('./routes/index');
var settings = require('./settings');
var flash = require('connect-flash');


var fs = require('fs');
var accessLog = fs.createWriteStream('access.log', { flags: 'a' });
var errorLog = fs.createWriteStream('error.log', { flags: 'a' });

var app = express();
var passport = require('passport'),
    GithubStrategy = require('passport-github').Strategy;

// view engine setup
//设置 views 文件夹为存放视图文件的目录, 即存放模板文件的地方,__dirname 为全局变量,存储当前正在执行的脚本所在的目录
app.set('views', path.join(__dirname, 'views'));
console.log(__dirname); ///home/neverwell/workspaces/blog

app.set('view engine', 'ejs'); //设置视图模板引擎为 ejs

app.use(flash());


// uncomment after placing your favicon in /public
//设置/public/favicon.ico为favicon图标
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev')); //加载日志中间件
app.use(logger({ stream: accessLog })); //把日志保存为日志文件

app.use(bodyParser.json()); //加载解析json的中间件
app.use(bodyParser.urlencoded({ extended: false })); //加载解析urlencoded请求体的中间件
app.use(cookieParser()); //加载解析cookie的中间件
app.use(express.static(path.join(__dirname, 'public'))); //设置public文件夹为存放静态文件的目录
app.use(function(err, req, res, next) {
    var meta = '[' + new Date() + '] ' + req.url + '\n';
    errorLog.write(meta + err.stack + '\n');
    next();
});

app.use(session({
    secret: settings.cookieSecret, //用来防止篡改 cookie
    key: settings.db, //cookie name
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }, //30 days
    store: new MongoStore({
            url: 'mongodb://localhost/blog'
        }) // MongoStore 实例，把会话信息存储到数据库中，以避免丢失
}));





//路由控制器
//app.use('/', routes);
//app.use('/users', users);


app.use(passport.initialize()); //初始化 Passport
routes(app);

// catch 404 and forward to error handler.捕获404错误，并转发到错误处理器
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});



passport.use(new GithubStrategy({
    clientID: "2dc846b62b7def5bf2c0",
    clientSecret: "992366c43fa96c1864a8bc2c6fe556e84a0abd51",
    callbackURL: "http://localhost:3000/login/github/callback"
}, function(accessToken, refreshToken, profile, done) {
    done(null, profile);
}));
// error handlers

// development error handler
// will print stacktrace
//开发环境下的错误处理器，将错误信息渲染error模版并显示到浏览器中
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
//生产环境下的错误处理器，不会将错误信息泄露给用户
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

//导出app实例供其他模块调用
module.exports = app;
