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
app.use(bodyParser.xml({ limit: '16mb' }));

const getReviews = (req, res, id, shelf, sort, perPage, collector) => https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf +
"&sort=" + sort + "&key=" + key + "&per_page=" + perPage,
(response) => {
    response.setEncoding('utf8');
    let rawData = '';
    response.on('data', (chunk) => { rawData += chunk; });
    response.on('end', () => {
        try {
            parseString(rawData, function (err, r) {
                const data = r.GoodreadsResponse.reviews[0];
                const pagination = data['$'];
                const reviews = data.review.map((r) => r.id);
                const urls = data.review.map((r) => r.url);
                const books = data.review.map((r) => {
                    return {
                        title: r.book[0].title[0],
                        author: r.book[0].authors[0].author[0].name[0],
                        reviewId: r.id[0],
                        reviewUrl: r.url[0]
                    }
                });
                // console.log({ reviews, urls });
                console.log(books);
                console.log({ pagination })
                // console.log(data)
                res.send(r);
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

    var reviews = [];

    getReviews(req, res, id, shelf, sort, perPage, reviews);
});

// Get a user's review for a given book
// Get an xml response that contains the review and rating for the specified book and user
// URL: https://www.goodreads.com/review/show_by_user_and_book.xml    (sample url)
// HTTP method: GET
// Parameters:
// key: Developer key (required).
// user_id: id of the user
// book_id: id of the book
// include_review_on_work: 'true' or 'false' indicating whether to return a review for another book in the same work if review not found for the specified book (default 'false', optional)

app.get('/review', (req, res) => {
    const book_id = req.query.book_id;
    const user_id = req.query.user_id;

    var options = {
        hostname: 'https://www.goodreads.com',
        port: 443,
        path: `/review/show_by_user_and_book.xml?user_id=${ user_id }&book_id=${ book_id }&key=${ key }`,
        method: 'GET'
      };

    https.get(`https://www.goodreads.com/review/show_by_user_and_book.xml?user_id=${ user_id }&book_id=${ book_id }&key=${ key }`,
        (response) => {
            response.setEncoding('utf8');
            let rawData = '';
            response.on('data', (chunk) => { rawData += chunk; });
            response.on('end', () => {
                try {
                    // this will be an object
                    parseString(rawData, function (err, r) {
                        // console.log(Object.keys(r.GoodreadsResponse));
                        console.log(r.GoodreadsResponse, r.GoodreadsResponse.review[0].body)
                        res.send(JSON.stringify(r.GoodreadsResponse.review[0].body));
                        // console.log(r)
                        // res.send(r);
                    });

                    // this will be the raw XML
                    // console.log(rawData);
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

// route to get a review in full (to scrape, since there is no public endpoint for a full review)
https://www.goodreads.com/review/show/2318742998?book_show_action=false
app.get('/scrape', (req, res) => {
    const userId = req.query.userId;

    // get all reviews by user

    const reviews = [];

    // scrape each review

    // if valid, push to reviews[]

    // output reviews to text file
})

console.log('App listening on port', port);
app.listen(port);