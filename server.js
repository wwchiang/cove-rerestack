var express = require('express');
var expressJwt = require('express-jwt');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var multer = require('multer');
var mysql = require('mysql');
var crypto = require('crypto');

//Database
var pool = mysql.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cove',
    debug: false
});

//Basic wrap for creating a connection
function doQuery(req, res, queryfunc)
{
    pool.getConnection(function (err, connection)
    {
        if (err) {
            connection.release();
            res.json({ "code": 100, "status": "Error in connection database" });
            return;
        }

        console.log('connected as id ' + connection.threadId);

        queryfunc(connection);

        connection.on('error', function (err)
        {
            res.json({ "code": 100, "status": "Error in connection database" });
            return;
        });
    });
}

//Encrypt
function md5(text)
{
    return crypto.createHash('md5').update(text).digest('hex');
};

var secret = '123';

//App
var app = express();

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(multer()); // for parsing multipart/form-data

app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/www'));

app.listen(app.get('port'), function(){
  console.log( 'Express started on http://localhost:' +
    app.get('port') + '; press Ctrl-C to terminate.' );
});

// User login
app.post('/api/login', function (req, res)
{
    var username = req.body.username
    var password = req.body.password

    if (!username || !password) {
        return res.json(401, { err: 'username and password required' });
    }

    doQuery(req, res, function (conn)
    {
        var qstr = "SELECT UserID FROM users WHERE Username = '" + username + "' AND Password = '" + password + "'";
        conn.query(qstr, function (err, row)
        {
            conn.release();
            if (!err) {
                if (row.length === 1) {
                    //Store db result in the profile
                    var profile = {
                        username: req.body.username,
                        uid: row[0].UserID
                    };
                    //Sign the profile into token using jwt
                    var token = jwt.sign(profile, secret, { expiresInMinutes: 60 * 5 });
                    //Send back to the browser
                    res.json({ token: token });
                }
                else {
                    res.send(401, 'invalid username or password');
                }
            }
            else
                console.log(err);
        });
    });
});

// Authentication verification
app.get('/api/check', function (req, res)
{
    var token = req.headers.token;
    if (token)
    {
        var decoded = jwt.verify(token, secret);
        console.log(decoded);
        res.json({ result: true });
    }
    else
    {
        res.json({ result: false });
    }
});

// Get colony list
app.get('/api/colonylist', function (req, res)
{
    if (req.headers.token) {
        var uid = jwt.verify(req.headers.token, secret).uid;
        console.log(uid);
        doQuery(req, res, function (conn)
        {
            var qstr = "SELECT cid, control FROM user_colonies WHERE uid = '" + uid + "'";
            conn.query(qstr, function (err, row)
            {
                conn.release();
                if (!err)
                    res.json({ colonylist: row });
                else
                    console.log(err);
            });
        });
    }
    else {
        res.send(401, 'unautherized');
    }
});

// Get colony data
app.post('/api/colonydata', function (req, res)
{
    if (req.headers.token) {
        // TODO
        //var uid = jwt.verify(req.headers.token, secret).uid;
        var cid = req.body.cid;
        doQuery(req, res, function (conn)
        {
            var qstr = "SELECT colonies.data FROM colonies WHERE cid = " + cid;
            conn.query(qstr, function (err, row)
            {
                conn.release();
                if (!err)
                    res.json({ colonydata: row });
                else
                    console.log(err);
            });
        });
    }
    else {
        res.send(401, 'unautherized');
    }
});