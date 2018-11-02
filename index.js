require('dotenv').config();
var express = require('express');
var fetch = require('node-fetch');
var https = require('https');
var parseString = require('xml2js').parseString;
var app = express();
var cors = require('cors');
const key = process.env["GOODREADS_KEY"];
const dbUser = process.env["DB_USER"];
const dbPassword = process.env["DB_PASSWORD"];
var port = process.env.PORT || 3000;
var bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;

var url = 'mongodb://' + dbUser + ':' + dbPassword + '@ds155934.mlab.com:55934/bookshelf-db';

app.use(cors());
app.use(bodyParser.xml({ limit: '2mb' }));

app.post('/', function (req, res) {
    console.log(req.body);
    let bodyString = req.body.toString().replace('$', 'dlr');

    MongoClient.connect(url, function (err, db) {
        if (err) {
            console.log('Unable to connect to the mongoDB server. Error:', err);
        } else {
            console.log('Connection established to', url);
            let collection = db.collection('read');
            try {
                collection.findOneAndReplace({}, {
                    "time": new Date(),
                    "data": JSON.stringify(req.body)
                });
            } catch (e) {
                console.log("Caught error:", e);
            }
            db.close();
        }
    });
});

app.get('/nudge', function (req, res) {
    // remind app to get ready to serve requests
    res.send(':)');
});

app.get('/api', function (req, res) {
    // get result from db, parse, and return
    MongoClient.connect(url, function (err, db) {
        if (err) {
            console.log('Unable to connect to the mongoDB server. Error:', err);
            res.send(err);
        } else {
            console.log('Connection established to', url);
            let collection = db.collection('read');
            try {
                let result = collection.findOne()
                    .then((result) => {
                        console.log(result);
                        res.send(result);
                    })
                    .catch((err) => {
                        console.log('error:', err);
                        res.send(err);
                    })
            } catch (e) {
                console.log(e);
                res.send(err);
            }
            db.close();
        }
    });
})

app.get('/', function (req, res) {
    const id = req.query.id;
    const shelf = req.query.shelf;
    const sort = req.query.sort;
    const perPage = req.query.per_page;

    var reviews = null;

    https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf +
        "&sort=" + sort + "&key=" + key + "&per_page=" + perPage,
        (response) => {
            response.setEncoding('utf8');
            let rawData = '';
            response.on('data', (chunk) => { rawData += chunk; });
            response.on('end', () => {
                try {
                    parseString(rawData, function (err, r) {
                        let rev = r.GoodreadsResponse.reviews[0].review;
                        console.dir(rev);
                        reviews = rev;
                        res.send(rev);
                    });
                } catch (e) {
                    console.error('e:', e.message);
                    res.send(e);
                }
            });
        }).on('error', (e) => {
            console.error(`Got error: ${e.message}`);
            res.send(e);
        });
});

console.log('App listening on port', port);
app.listen(port);