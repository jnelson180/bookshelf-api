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
app.use(bodyParser.xml({limit: '2mb'}));

app.post('/', function (req, res) {
    console.log(req);
    console.log(req.body);
// Use connect method to connect to the Server
    MongoClient.connect(url, function (err, db) {
    if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
        console.log('Connection established to', url);
        // do some db work
        let collection = db.collection('read');
        try {
            collection.updateOne({}, {$set: {"latest": req.body.toString()}});
        } catch(e) {
            console.log(e);
        }
        //Close connection
        db.close();
    }
    });    
});

app.get('/', function (req, res) {
        console.log(req.query);
        const id = req.query.id;
        const shelf = req.query.shelf;
        const sort = req.query.sort;
        const perPage = req.query.per_page;

        var reviews = null;

        https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf + 
            "&sort=" + sort + "&key=" + key + "&per_page=" + perPage, 
            (response) => {
                // console.log(response);
                response.setEncoding('utf8');
                let rawData = '';
                response.on('data', (chunk) => { rawData += chunk; });
                response.on('end', () => {
                    try {
                        parseString(rawData, function (err, r) {
                            let rev = r.GoodreadsResponse.reviews[0].review;
                            // console.dir(rev);
                            reviews = rev;
                            console.log(rev);
                            res.send(rev);
                        });
                    } catch (e) {
                    console.error('e:', e.message);
                    }
                });
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
                res.send(reviews);
            });
    });
        
console.log('App listening on port', port);
app.listen(port);